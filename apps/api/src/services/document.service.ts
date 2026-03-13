import { prisma } from '../utils/prisma';
import { DocType, DocStatut, RefType } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export class DocumentService {
  async ensureUploadDir() {
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  async findAll(filters?: {
    typeDocument?: DocType;
    referenceType?: RefType;
    referenceId?: string;
    statut?: DocStatut;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};
    if (filters?.typeDocument) where.typeDocument = filters.typeDocument;
    if (filters?.referenceType) where.referenceType = filters.referenceType;
    if (filters?.referenceId) where.referenceId = filters.referenceId;
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Définir l'ordre de tri
    let orderBy: any = { createdAt: 'desc' }; // Par défaut, tri par date de création décroissante
    
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'asc';
      
      switch (filters.sortBy) {
        case 'nom':
          orderBy = { nom: sortOrder };
          break;
        case 'typeDocument':
          orderBy = { typeDocument: sortOrder };
          break;
        case 'statut':
          orderBy = { statut: sortOrder };
          break;
        case 'createdAt':
          orderBy = { createdAt: sortOrder };
          break;
        case 'updatedAt':
          orderBy = { updatedAt: sortOrder };
          break;
        case 'uploadedBy':
          // Pour uploadedBy, on trie par nom de l'utilisateur (via relation)
          orderBy = { uploadedBy: { nom: sortOrder } };
          break;
        default:
          orderBy = { createdAt: 'desc' };
      }
    }

    // Exclure les documents supprimés (soft delete)
    where.deletedAt = null;

    const documents = await prisma.document.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true, email: true } },
        valideBy: { select: { id: true, nom: true, prenom: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, nom: true, prenom: true } },
          },
        },
        permissionsUtilisateurs: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
        _count: { select: { versions: true } },
      },
      orderBy,
    });

    // Enrichir avec les informations du processus et les statistiques
    const documentsWithProcessus = await Promise.all(
      documents.map(async (doc) => {
        let processus = null;
        if (doc.referenceType === 'processus' && doc.referenceId) {
          processus = await prisma.processus.findUnique({
            where: { id: doc.referenceId },
            select: { id: true, nom: true, codeProcessus: true },
          });
        }
        let projet = null;
        if (doc.referenceType === 'projet' && doc.referenceId) {
          projet = await prisma.projet.findUnique({
            where: { id: doc.referenceId },
            select: { id: true, nom: true, codeProjet: true },
          });
        }
        // Récupérer les contrats liés
        const contrats = await prisma.contratDocument.findMany({
          where: { documentId: doc.id },
          include: { contrat: { select: { id: true, nom: true } } },
        });
        
        // Compter les téléchargements et visualisations
        const [telechargements, visualisations] = await Promise.all([
          prisma.journalAcces.count({
            where: {
              ressourceType: 'document',
              ressourceId: doc.id,
              action: 'telechargement',
            },
          }),
          prisma.journalAcces.count({
            where: {
              ressourceType: 'document',
              ressourceId: doc.id,
              action: 'lecture',
            },
          }),
        ]);
        
        return {
          ...doc,
          processus: processus || null,
          projet: projet || null,
          contrats: contrats || [],
          nombreTelechargements: telechargements,
          nombreVisualisations: visualisations,
        };
      })
    );

    return documentsWithProcessus;
  }

  async findOne(id: string) {
    const document = await prisma.document.findFirst({
      where: { 
        id,
        deletedAt: null, // Exclure les documents supprimés
      },
      include: {
        uploadedBy: true,
        valideBy: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, nom: true, prenom: true } },
          },
        },
        permissionsUtilisateurs: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    // Compter les téléchargements et visualisations
    const [telechargements, visualisations] = await Promise.all([
      prisma.journalAcces.count({
        where: {
          ressourceType: 'document',
          ressourceId: id,
          action: 'telechargement',
        },
      }),
      prisma.journalAcces.count({
        where: {
          ressourceType: 'document',
          ressourceId: id,
          action: 'lecture',
        },
      }),
    ]);

    return {
      ...document,
      nombreTelechargements: telechargements,
      nombreVisualisations: visualisations,
    };
  }

  async canUserAccessDocument(documentId: string, userId: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        permissionsUtilisateurs: true,
        uploadedBy: { select: { id: true } },
      },
    });

    if (!document) return false;

    // Si le document n'est pas confidentiel, tout le monde peut y accéder
    if (!document.estConfidentiel) return true;

    // L'utilisateur qui a uploadé peut toujours accéder
    if (document.uploadedById === userId) return true;

    // Vérifier si le document est lié à un processus et si l'utilisateur est propriétaire ou créateur
    if (document.referenceType === 'processus' && document.referenceId) {
      const processus = await prisma.processus.findUnique({
        where: { id: document.referenceId },
        select: { proprietaireId: true, createdById: true },
      });
      if (processus && (processus.proprietaireId === userId || processus.createdById === userId)) {
        return true;
      }
    }
    // Vérifier si le document est lié à un projet et si l'utilisateur fait partie de la gouvernance
    if (document.referenceType === 'projet' && document.referenceId) {
      const projet = await prisma.projet.findUnique({
        where: { id: document.referenceId },
        include: {
          sponsors: true,
          chefsProjet: true,
          techLeads: true,
          equipe: true,
        },
      });
      if (projet) {
        if (projet.createdById === userId) return true;
        if (projet.responsableId === userId) return true;
        if (projet.gestionnaireId === userId) return true;
        const gouvernanceIds = [
          ...projet.sponsors.map((s: any) => s.userId),
          ...projet.chefsProjet.map((s: any) => s.userId),
          ...projet.techLeads.map((s: any) => s.userId),
          ...projet.equipe.map((s: any) => s.userId),
        ];
        if (gouvernanceIds.includes(userId)) return true;
      }
    }

    // Vérifier si l'utilisateur est dans la liste des permissions
    const hasPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId,
        userId,
      },
    });

    return !!hasPermission;
  }

  async canUserDeleteOrAddVersion(documentId: string, userId: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        permissionsUtilisateurs: true,
        uploadedBy: { select: { id: true } },
      },
    });

    if (!document) return false;

    // Si le document n'est pas confidentiel, tout le monde peut supprimer/ajouter version
    if (!document.estConfidentiel) return true;

    // L'utilisateur qui a uploadé peut toujours supprimer/ajouter version
    if (document.uploadedById === userId) return true;

    // Pour les documents confidentiels, seuls les utilisateurs explicitement dans la liste des permissions peuvent supprimer/ajouter version
    // (le propriétaire/créateur du processus n'a pas automatiquement ce droit, sauf s'il est dans la liste)
    const hasPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId,
        userId,
      },
    });

    return !!hasPermission;
  }

  async create(data: {
    nom: string;
    typeDocument: DocType;
    referenceType?: RefType;
    referenceId?: string;
    fichierUrl: string;
    fichierNomOriginal: string;
    fichierTaille: number;
    fichierType: string;
    description?: string;
    uploadedById: string;
    versionMajeure?: number;
    versionMineure?: number;
    versionPatch?: number;
    tags?: any;
    estConfidentiel?: boolean;
    permissionUserIds?: string[];
  }) {
    const version = `${data.versionMajeure || 1}.${data.versionMineure || 0}.${data.versionPatch || 0}`;
    
    // Extraire versionPatch et permissionUserIds car ils n'existent pas dans le schéma Prisma directement
    const { versionPatch, permissionUserIds, ...documentData } = data;
    
    const document = await prisma.document.create({
      data: {
        ...documentData,
        version,
        statut: 'brouillon',
      },
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
      },
    });

    // Créer les permissions si le document est confidentiel et qu'il y a des utilisateurs sélectionnés
    if (data.estConfidentiel && permissionUserIds && permissionUserIds.length > 0) {
      await prisma.documentPermission.createMany({
        data: permissionUserIds.map(userId => ({
          documentId: document.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    
    return document;
  }

  async createVersion(documentId: string, data: {
    fichierUrl: string;
    commentaireVersion?: string;
    uploadedById: string;
  }) {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error('Document non trouvé');

    const versionParts = (document.version || '1.0.0').split('.');
    const newMinor = parseInt(versionParts[1] || '0') + 1;
    const newVersion = `${versionParts[0]}.${newMinor}.0`;

    await prisma.versionDocument.create({
      data: {
        documentId,
        version: newVersion,
        ...data,
      },
    });

    return prisma.document.update({
      where: { id: documentId },
      data: {
        version: newVersion,
        versionMineure: newMinor,
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    description?: string;
    statut?: DocStatut;
    estConfidentiel?: boolean;
    tags?: any;
    valideById?: string;
    permissionUserIds?: string[];
  }) {
    const { permissionUserIds, ...updateData } = data;
    
    if (data.statut === 'valide' && data.valideById) {
      updateData.dateValidation = new Date();
    }

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
      },
    });

    // Gérer les permissions si le document est confidentiel
    if (data.estConfidentiel !== undefined) {
      // Supprimer toutes les permissions existantes
      await prisma.documentPermission.deleteMany({
        where: { documentId: id },
      });

      // Créer les nouvelles permissions si le document est confidentiel
      if (data.estConfidentiel && permissionUserIds && permissionUserIds.length > 0) {
        await prisma.documentPermission.createMany({
          data: permissionUserIds.map(userId => ({
            documentId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    } else if (permissionUserIds !== undefined) {
      // Si on met à jour seulement les permissions sans changer estConfidentiel
      // Supprimer toutes les permissions existantes
      await prisma.documentPermission.deleteMany({
        where: { documentId: id },
      });

      // Créer les nouvelles permissions
      if (permissionUserIds.length > 0) {
        await prisma.documentPermission.createMany({
          data: permissionUserIds.map(userId => ({
            documentId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return document;
  }

  async delete(id: string) {
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) throw new Error('Document non trouvé');

    // Supprimer le fichier physique
    try {
      const filePath = path.join(UPLOAD_DIR, document.fichierUrl);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignorer si le fichier n'existe pas
      console.warn(`Fichier non trouvé: ${document.fichierUrl}`);
    }

    // Soft delete : marquer comme supprimé au lieu de supprimer réellement
    // Les fichiers physiques seront supprimés lors d'une suppression définitive depuis la corbeille
    return prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}