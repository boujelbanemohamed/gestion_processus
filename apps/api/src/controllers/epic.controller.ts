import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
    await logAccess(req, res, 'creation', 'projet', epic!.id, epic!.nom, { type: 'epic' });
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
    await logAccess(req, res, 'creation', 'projet', us!.id, 'User story', { type: 'user_story' });
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
    res.json(us);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
