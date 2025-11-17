import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DocumentCommentService } from '../services/document-comment.service';
import { logAccess } from '../middleware/logger';

const service = new DocumentCommentService();

export const listComments = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // documentId
    const comments = await service.list(id);
    res.json(comments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    const { id } = req.params; // documentId
    const { contenu } = req.body;

    const comment = await service.add(id, req.user.userId, contenu);
    await logAccess(req, res, 'modification', 'document', id, 'Ajout commentaire');
    res.status(201).json(comment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
