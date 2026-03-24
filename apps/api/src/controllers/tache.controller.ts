import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TacheService } from '../services/tache.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';

const tacheService = new TacheService();

// ── Upload pièces jointes commentaires ────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'taches');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

export const uploadMiddleware = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('fichier');

// ── CRUD Tâches ───────────────────────────────────────────────────────────────

export const getAllTaches = async (req: AuthRequest, res: Response) => {
  try {
    const { statut, projetId } = req.query;
    const taches = await tacheService.findAll({
      statut: statut as string,
      projetId: projetId as string,
    });
    res.json(taches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTache = async (req: AuthRequest, res: Response) => {
  try {
    const tache = await tacheService.findOne(req.params.id);
    if (!tache) return res.status(404).json({ error: 'Tâche non trouvée' });
    res.json(tache);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTache = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const tache = await tacheService.create(req.body, req.user.userId);
    await logAccess(req, res, 'creation', 'projet', tache.id, tache.nom);
    res.status(201).json(tache);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateTache = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });

    // Vérif rôle : admin / contributeur peuvent tout modifier
    const role = req.user.role;
    if (role !== 'admin' && role !== 'contributeur') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const tache = await tacheService.update(req.params.id, req.body);
    if (!tache) return res.status(404).json({ error: 'Tâche non trouvée' });
    await logAccess(req, res, 'modification', 'projet', tache.id, tache.nom);
    res.json(tache);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteTache = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    await tacheService.delete(req.params.id);
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── Commentaires ──────────────────────────────────────────────────────────────

export const getCommentaires = async (req: AuthRequest, res: Response) => {
  try {
    const commentaires = await tacheService.getCommentaires(req.params.id);
    res.json(commentaires);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addCommentaire = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { contenu } = req.body;
    if (!contenu?.trim() && !req.file) {
      return res.status(400).json({ error: 'Contenu ou fichier requis' });
    }
    const commentaire = await tacheService.addCommentaire(
      req.params.id,
      req.user.userId,
      contenu?.trim() || '',
      req.file,
    );
    res.status(201).json(commentaire);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const downloadCommentaireFichier = async (req: AuthRequest, res: Response) => {
  try {
    const { commentaireId } = req.params;
    const commentaire = await tacheService.getCommentaireFichier(commentaireId);
    if (!commentaire?.pieceJointePath) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    res.download(commentaire.pieceJointePath, commentaire.pieceJointeNom || 'fichier');
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const { nom, description } = req.body;
    const document = await tacheService.uploadDocument(
      req.params.id,
      req.user.userId,
      req.file,
      nom || req.file.originalname,
      description,
    );
    res.status(201).json(document);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const lierDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: 'documentId requis' });
    await tacheService.lierDocument(req.params.id, documentId);
    res.status(201).json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const delierDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    await tacheService.delierDocument(req.params.id, req.params.documentId);
    res.status(204).end();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getDocumentsLiables = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const documents = await tacheService.getDocumentsLiables(search as string);
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
