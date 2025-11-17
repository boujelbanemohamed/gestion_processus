import { Request, Response } from 'express';
import { DocumentService } from '../services/document.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';

const documentService = new DocumentService();
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Configuration multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await documentService.ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  },
});

export const uploadMiddleware = upload.single('file');

export const getAllDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { typeDocument, referenceType, referenceId, statut, search } = req.query;
    const documents = await documentService.findAll({
      typeDocument: typeDocument as any,
      referenceType: referenceType as any,
      referenceId: referenceId as string,
      statut: statut as any,
      search: search as string,
    });
    
    // Logger la consultation si c'est pour un processus spécifique
    if (referenceType === 'processus' && referenceId) {
      await logAccess(req, res, 'lecture', 'processus', referenceId as string, undefined, {
        action: 'consultation_documents',
        nombreDocuments: documents.length,
      });
    }
    
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDocument = async (req: AuthRequest, res: Response) => {
  try {
    const document = await documentService.findOne(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    await logAccess(req, res, 'lecture', 'document', document.id, document.nom, {
      processusId: document.referenceId,
    });
    res.json(document);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier requis' });
    }

    const estConfidentiel = req.body.estConfidentiel === 'true' || req.body.estConfidentiel === true;
    const permissionUserIds = req.body.permissionUserIds 
      ? (Array.isArray(req.body.permissionUserIds) ? req.body.permissionUserIds : req.body.permissionUserIds.split(','))
      : [];

    // Vérifier si l'utilisateur peut définir le document comme confidentiel
    if (estConfidentiel) {
      // Si le document est lié à un processus, vérifier si l'utilisateur est propriétaire ou créateur
      if (req.body.referenceType === 'processus' && req.body.referenceId) {
        const { prisma } = await import('../utils/prisma');
        const processus = await prisma.processus.findUnique({
          where: { id: req.body.referenceId },
          select: { proprietaireId: true, createdById: true },
        });
        
        if (!processus) {
          return res.status(404).json({ error: 'Processus non trouvé' });
        }
        
        if (processus.proprietaireId !== req.user!.userId && processus.createdById !== req.user!.userId) {
          return res.status(403).json({ error: 'Seul le propriétaire ou le créateur du processus peut définir un document comme confidentiel' });
        }
      }

      // Vérifier qu'au moins un utilisateur est sélectionné
      if (permissionUserIds.length === 0) {
        return res.status(400).json({ error: 'Au moins un utilisateur doit être sélectionné pour un document confidentiel' });
      }
    }

    const fichierUrl = req.file.filename;
    const document = await documentService.create({
      nom: req.body.nom || req.file.originalname,
      typeDocument: req.body.typeDocument || 'general',
      referenceType: req.body.referenceType || undefined,
      referenceId: req.body.referenceId || undefined,
      fichierUrl,
      fichierNomOriginal: req.file.originalname,
      fichierTaille: req.file.size,
      fichierType: req.file.mimetype,
      description: req.body.description,
      uploadedById: req.user!.userId,
      versionMajeure: parseInt(req.body.versionMajeure) || 1,
      versionMineure: parseInt(req.body.versionMineure) || 0,
      versionPatch: parseInt(req.body.versionPatch) || 0,
      tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
      estConfidentiel,
      permissionUserIds: estConfidentiel ? permissionUserIds : undefined,
    });

    await logAccess(req, res, 'creation', 'document', document.id, document.nom, {
      processusId: req.body.referenceId,
      version: `${req.body.versionMajeure || 1}.${req.body.versionMineure || 0}.${req.body.versionPatch || 0}`,
      estConfidentiel,
      nombreUtilisateursAutorises: estConfidentiel ? permissionUserIds.length : 0,
    });
    res.status(201).json(document);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const createVersion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier requis' });
    }

    // Récupérer l'ancienne version avant la création
    const oldDocument = await documentService.findOne(req.params.id);
    if (!oldDocument) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Vérifier les permissions pour les documents confidentiels
    // Pour ajouter une version, seuls les utilisateurs explicitement autorisés peuvent ajouter une version
    if (oldDocument.estConfidentiel) {
      const canAddVersion = await documentService.canUserDeleteOrAddVersion(oldDocument.id, req.user!.userId);
      if (!canAddVersion) {
        return res.status(403).json({ error: 'Seuls les utilisateurs autorisés peuvent ajouter une version à ce document confidentiel' });
      }
    }

    const oldVersion = oldDocument.version || '1.0.0';

    const document = await documentService.createVersion(req.params.id, {
      fichierUrl: req.file.filename,
      commentaireVersion: req.body.commentaireVersion,
      uploadedById: req.user!.userId,
    });

    await logAccess(req, res, 'modification', 'document', document.id, document.nom, {
      action: 'nouvelle_version',
      ancienneVersion: oldVersion,
      nouvelleVersion: document.version,
      commentaire: req.body.commentaireVersion,
    });
    res.json(document);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const downloadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const document = await documentService.findOne(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Vérifier les permissions pour les documents confidentiels
    const canAccess = await documentService.canUserAccessDocument(document.id, req.user!.userId);
    if (!canAccess) {
      return res.status(403).json({ error: 'Accès non autorisé à ce document confidentiel' });
    }

    const filePath = path.join(UPLOAD_DIR, document.fichierUrl);
    
    // Logger avant le téléchargement pour capturer l'action
    await logAccess(req, res, 'telechargement', 'document', document.id, document.nom, {
      version: document.version,
      processusId: document.referenceId,
    });
    
    res.download(filePath, document.fichierNomOriginal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { id, versionId } = req.params;
    const document = await documentService.findOne(id);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Vérifier les permissions pour les documents confidentiels
    const canAccess = await documentService.canUserAccessDocument(document.id, req.user!.userId);
    if (!canAccess) {
      return res.status(403).json({ error: 'Accès non autorisé à ce document confidentiel' });
    }

    const version = document.versions?.find((v: any) => v.id === versionId);
    if (!version) {
      return res.status(404).json({ error: 'Version non trouvée' });
    }

    const filePath = path.join(UPLOAD_DIR, version.fichierUrl);
    
    // Logger avant le téléchargement
    await logAccess(req, res, 'telechargement', 'document', document.id, document.nom, {
      version: version.version,
      typeTelechargement: 'version_ancienne',
      processusId: document.referenceId,
    });
    
    res.download(filePath, `${document.fichierNomOriginal}_v${version.version}`);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDocument = async (req: AuthRequest, res: Response) => {
  try {
    const oldDocument = await documentService.findOne(req.params.id);
    if (!oldDocument) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const estConfidentiel = req.body.estConfidentiel !== undefined 
      ? (req.body.estConfidentiel === 'true' || req.body.estConfidentiel === true)
      : oldDocument.estConfidentiel;
    const permissionUserIds = req.body.permissionUserIds 
      ? (Array.isArray(req.body.permissionUserIds) ? req.body.permissionUserIds : req.body.permissionUserIds.split(','))
      : undefined;

    // Vérifier si l'utilisateur essaie de définir/retirer confidentiel
    if (req.body.estConfidentiel !== undefined) {
      // Si le document est lié à un processus, vérifier si l'utilisateur est propriétaire ou créateur
      if (oldDocument.referenceType === 'processus' && oldDocument.referenceId) {
        const { prisma } = await import('../utils/prisma');
        const processus = await prisma.processus.findUnique({
          where: { id: oldDocument.referenceId },
          select: { proprietaireId: true, createdById: true },
        });
        
        if (processus && (processus.proprietaireId !== req.user!.userId && processus.createdById !== req.user!.userId)) {
          return res.status(403).json({ error: 'Seul le propriétaire ou le créateur du processus peut définir un document comme confidentiel' });
        }
      }

      // Si on définit comme confidentiel, vérifier qu'au moins un utilisateur est sélectionné
      if (estConfidentiel && (!permissionUserIds || permissionUserIds.length === 0)) {
        return res.status(400).json({ error: 'Au moins un utilisateur doit être sélectionné pour un document confidentiel' });
      }
    }

    // Vérifier les permissions pour modifier un document confidentiel
    if (oldDocument.estConfidentiel) {
      const canModify = await documentService.canUserAccessDocument(oldDocument.id, req.user!.userId);
      if (!canModify) {
        return res.status(403).json({ error: 'Seuls les utilisateurs autorisés peuvent modifier ce document confidentiel' });
      }
    }
    
    const document = await documentService.update(req.params.id, {
      ...req.body,
      estConfidentiel: req.body.estConfidentiel !== undefined ? estConfidentiel : undefined,
      permissionUserIds,
    });
    
    // Détails des modifications
    const details: any = {};
    if (req.body.statut && oldDocument?.statut !== req.body.statut) {
      details.changementStatut = `${oldDocument?.statut} → ${req.body.statut}`;
    }
    if (req.body.nom && oldDocument?.nom !== req.body.nom) {
      details.changementNom = `${oldDocument?.nom} → ${req.body.nom}`;
    }
    if (req.body.estConfidentiel !== undefined && oldDocument?.estConfidentiel !== req.body.estConfidentiel) {
      details.changementConfidentiel = req.body.estConfidentiel;
    }
    
    await logAccess(req, res, 'modification', 'document', document.id, document.nom, Object.keys(details).length > 0 ? details : undefined);
    res.json(document);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const document = await documentService.findOne(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Vérifier les permissions pour les documents confidentiels
    // Pour la suppression, seuls les utilisateurs explicitement autorisés peuvent supprimer
    if (document.estConfidentiel) {
      const canDelete = await documentService.canUserDeleteOrAddVersion(document.id, req.user!.userId);
      if (!canDelete) {
        return res.status(403).json({ error: 'Seuls les utilisateurs autorisés peuvent supprimer ce document confidentiel' });
      }
    }

    await documentService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'document', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
