import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ResourceType } from '../generated/prisma/enums';
import { EpicService } from '../services/epic.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';

const epicService = new EpicService();

const uploadDir = path.join(process.cwd(), 'uploads', 'epics');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

export const epicUploadMiddleware = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }).single('fichier');

const epicCommentDir = path.join(process.cwd(), 'uploads', 'epics', 'commentaires');
if (!fs.existsSync(epicCommentDir)) fs.mkdirSync(epicCommentDir, { recursive: true });
const epicCommentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, epicCommentDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
export const epicCommentUploadMiddleware = multer({
  storage: epicCommentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('fichier');

const usCommentDir = path.join(process.cwd(), 'uploads', 'user-stories', 'commentaires');
if (!fs.existsSync(usCommentDir)) fs.mkdirSync(usCommentDir, { recursive: true });
const usCommentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, usCommentDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
export const userStoryCommentUploadMiddleware = multer({
  storage: usCommentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('fichier');

export const getEpics = async (req: AuthRequest, res: Response) => {
  try {
    const { projetId } = req.query;
    const list = await epicService.listEpics({ projetId: projetId as string | undefined });
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getEpic = async (req: AuthRequest, res: Response) => {
  try {
    const row = await epicService.getEpic(req.params.id);
    if (!row) return res.status(404).json({ error: 'Epic introuvable' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const updateEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { nom, description, projetId, entiteIds } = req.body;
    const eIds = entiteIds !== undefined
      ? Array.isArray(entiteIds)
        ? entiteIds
        : entiteIds
          ? [entiteIds]
          : []
      : undefined;
    const row = await epicService.updateEpic(req.params.id, {
      ...(nom !== undefined && { nom }),
      ...(description !== undefined && { description: description ?? null }),
      ...(projetId !== undefined && { projetId }),
      ...(eIds !== undefined && { entiteIds: eIds }),
    });
    await logAccess(req, res, 'modification', ResourceType.epic, row!.id, row!.nom);
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const createEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { nom, description, projetId, entiteId, entiteIds, documentIds, userStoryIdsToAttach } = req.body;
    if (!nom?.trim() || !projetId) {
      return res.status(400).json({ error: 'nom et projetId sont requis' });
    }
    const docIds = Array.isArray(documentIds) ? documentIds : documentIds ? [documentIds] : [];
    const eIds = Array.isArray(entiteIds) ? entiteIds : entiteIds ? [entiteIds] : [];
    const usIds = Array.isArray(userStoryIdsToAttach)
      ? userStoryIdsToAttach
      : userStoryIdsToAttach
        ? [userStoryIdsToAttach]
        : [];
    const epic = await epicService.createEpic({
      nom,
      description: description ?? null,
      projetId,
      entiteIds: eIds,
      entiteId: entiteId || null,
      createdById: req.user.userId,
      documentIds: docIds,
      userStoryIdsToAttach: usIds,
    });
    await logAccess(req, res, 'creation', ResourceType.epic, epic!.id, epic!.nom);
    res.status(201).json(epic);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const lierDocumentEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: 'documentId requis' });
    await epicService.lierDocumentEpic(req.params.id, documentId);
    res.status(204).end();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const uploadDocumentEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const nom = (req.body.nom as string) || req.file.originalname;
    const description = req.body.description as string | undefined;
    const doc = await epicService.uploadDocumentEpic(req.params.id, req.user.userId, req.file, nom, description);
    res.status(201).json(doc);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const delierDocumentEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    await epicService.delierDocumentEpic(req.params.id, req.params.documentId);
    res.status(204).end();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const getUserStories = async (req: AuthRequest, res: Response) => {
  try {
    const { epicId, projetId, orphelines } = req.query;
    const list = await epicService.listUserStories({
      epicId: epicId as string | undefined,
      projetId: projetId as string | undefined,
      orphelines: orphelines === 'true' || orphelines === '1',
    });
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getUserStory = async (req: AuthRequest, res: Response) => {
  try {
    const row = await epicService.getUserStory(req.params.id);
    if (!row) return res.status(404).json({ error: 'User story introuvable' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const createUserStory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { description, epicId, tacheIds } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'description requise' });
    if (!epicId) return res.status(400).json({ error: 'epicId requis' });
    const ids = Array.isArray(tacheIds) ? tacheIds : tacheIds ? [tacheIds] : [];
    const us = await epicService.createUserStory({ description, epicId, tacheIds: ids });
    const usLabel =
      us!.description.length > 120 ? `${us!.description.slice(0, 117)}…` : us!.description;
    await logAccess(req, res, 'creation', ResourceType.userStory, us!.id, usLabel);
    res.status(201).json(us);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const updateUserStory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { description, epicId, tacheIds } = req.body;
    const us = await epicService.updateUserStory(req.params.id, {
      ...(description !== undefined && { description }),
      ...(epicId !== undefined && { epicId: epicId || null }),
      ...(tacheIds !== undefined && {
        tacheIds: Array.isArray(tacheIds) ? tacheIds : tacheIds ? [tacheIds] : [],
      }),
    });
    if (!us) return res.status(404).json({ error: 'User story introuvable' });
    const usLabel =
      us.description.length > 120 ? `${us.description.slice(0, 117)}…` : us.description;
    await logAccess(req, res, 'modification', ResourceType.userStory, us.id, usLabel);
    res.json(us);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

// ── Commentaires epic / user story ───────────────────────────────────────────

export const getEpicCommentaires = async (req: AuthRequest, res: Response) => {
  try {
    const list = await epicService.getCommentairesEpic(req.params.id);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const addEpicCommentaire = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { contenu } = req.body;
    if (!contenu?.trim() && !req.file) {
      return res.status(400).json({ error: 'Contenu ou fichier requis' });
    }
    const row = await epicService.addCommentaireEpic(
      req.params.id,
      req.user.userId,
      contenu?.trim() || '',
      req.file,
    );
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const downloadEpicCommentaireFichier = async (req: AuthRequest, res: Response) => {
  try {
    const row = await epicService.getEpicCommentaireFichier(req.params.commentaireId);
    if (!row?.pieceJointePath) return res.status(404).json({ error: 'Fichier non trouvé' });
    res.download(row.pieceJointePath, row.pieceJointeNom || 'fichier');
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getUserStoryCommentaires = async (req: AuthRequest, res: Response) => {
  try {
    const list = await epicService.getCommentairesUserStory(req.params.id);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const addUserStoryCommentaire = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { contenu } = req.body;
    if (!contenu?.trim() && !req.file) {
      return res.status(400).json({ error: 'Contenu ou fichier requis' });
    }
    const row = await epicService.addCommentaireUserStory(
      req.params.id,
      req.user.userId,
      contenu?.trim() || '',
      req.file,
    );
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const downloadUserStoryCommentaireFichier = async (req: AuthRequest, res: Response) => {
  try {
    const row = await epicService.getUserStoryCommentaireFichier(req.params.commentaireId);
    if (!row?.pieceJointePath) return res.status(404).json({ error: 'Fichier non trouvé' });
    res.download(row.pieceJointePath, row.pieceJointeNom || 'fichier');
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getEpicsCorbeille = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const list = await epicService.listEpicsCorbeille(req.user.userId, req.user.role);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const softDeleteEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    await epicService.softDeleteEpic(req.params.id, req.user.userId, req.user.role);
    await logAccess(req, res, 'suppression', ResourceType.epic, req.params.id, undefined, {
      action: 'corbeille_epic',
    });
    res.status(204).end();
  } catch (e: any) {
    const code = e.message === 'Accès refusé' ? 403 : e.message === 'Epic introuvable' ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
};

export const restoreEpic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const row = await epicService.restoreEpic(req.params.id, req.user.userId, req.user.role);
    await logAccess(req, res, 'modification', ResourceType.epic, row!.id, row!.nom, {
      action: 'restauration',
    });
    res.json(row);
  } catch (e: any) {
    const code =
      e.message === 'Accès refusé' ? 403 : e.message?.includes('introuvable') ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
};

export const getUserStoriesCorbeille = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const list = await epicService.listUserStoriesCorbeille(req.user.userId, req.user.role);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const softDeleteUserStory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    await epicService.softDeleteUserStory(req.params.id, req.user.userId, req.user.role);
    await logAccess(req, res, 'suppression', ResourceType.userStory, req.params.id, undefined, {
      action: 'corbeille_user_story',
    });
    res.status(204).end();
  } catch (e: any) {
    const code = e.message === 'Accès refusé' ? 403 : e.message === 'User story introuvable' ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
};

export const restoreUserStory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const row = await epicService.restoreUserStory(req.params.id, req.user.userId, req.user.role);
    const label =
      row!.description.length > 120 ? `${row!.description.slice(0, 117)}…` : row!.description;
    await logAccess(req, res, 'modification', ResourceType.userStory, row!.id, label, {
      action: 'restauration',
    });
    res.json(row);
  } catch (e: any) {
    const code =
      e.message === 'Accès refusé' ? 403 : e.message?.includes('introuvable') ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
};

export const getEpicHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const row = await epicService.getEpic(req.params.id);
    if (!row) return res.status(404).json({ error: 'Epic introuvable' });
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 80, 200);
    const out = await epicService.getEpicJournalHistory(req.params.id, page, limit);
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getUserStoryHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const row = await epicService.getUserStory(req.params.id);
    if (!row) return res.status(404).json({ error: 'User story introuvable' });
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 80, 200);
    const out = await epicService.getUserStoryJournalHistory(req.params.id, page, limit);
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
