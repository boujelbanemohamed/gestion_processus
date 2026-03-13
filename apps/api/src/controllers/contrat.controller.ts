import { Request, Response } from 'express';
import { contratService } from '../services/contrat.service';
import { prisma } from '../utils/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => { const dir = '/app/uploads'; if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
  filename: (req, file, cb) => { cb(null, `${Date.now()}-${file.originalname}`); }
});
export const uploadContrat = multer({ storage }).array('documents', 10);

export const getContrats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contrats = await contratService.findAll(user.userId, user.role);
    res.json(contrats);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getContrat = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contrat = await contratService.findOne(req.params.id, user.userId, user.role);
    if (!contrat) return res.status(404).json({ error: 'Non trouvé ou accès refusé' });
    res.json(contrat);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createContrat = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = { ...req.body };
    if (data.partiesPrenantes && typeof data.partiesPrenantes === 'string') data.partiesPrenantes = JSON.parse(data.partiesPrenantes);
    if (data.projetIds && typeof data.projetIds === 'string') data.projetIds = JSON.parse(data.projetIds);
    if (data.tags && typeof data.tags === 'string') data.tags = JSON.parse(data.tags);
    if (data.dateSignature) data.dateSignature = new Date(data.dateSignature);
    if (data.dateEnregistrement) data.dateEnregistrement = new Date(data.dateEnregistrement);
    if (data.dateExpiration) data.dateExpiration = new Date(data.dateExpiration);
    if (!user?.userId) return res.status(401).json({ error: "Utilisateur non authentifié" });
    const contrat = await contratService.create(data, user.userId);
    // Upload documents si présents
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files as Express.Multer.File[]) {
        const doc = await prisma.document.create({
          data: { nom: file.originalname, fichierUrl: file.filename, typeDocument: "contrat", estConfidentiel: true, uploadedById: user.userId }
        });
        await contratService.addDocument(contrat.id, doc.id);
      }
    }
    res.status(201).json(contrat);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const updateContrat = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contrat = await contratService.findOne(req.params.id, user.userId, user.role);
    if (!contrat) return res.status(404).json({ error: 'Non trouvé ou accès refusé' });
    const perm = contrat.permissions.find((p: any) => p.userId === user.userId);
    if (user.role !== 'admin' && contrat.createdById !== user.userId && perm?.niveau !== 'modification') {
      return res.status(403).json({ error: 'Accès modification refusé' });
    }
    const data = { ...req.body };
    if (data.partiesPrenantes && typeof data.partiesPrenantes === 'string') data.partiesPrenantes = JSON.parse(data.partiesPrenantes);
    if (data.projetIds && typeof data.projetIds === 'string') data.projetIds = JSON.parse(data.projetIds);
    if (data.tags && typeof data.tags === 'string') data.tags = JSON.parse(data.tags);
    if (data.dateSignature) data.dateSignature = new Date(data.dateSignature);
    if (data.dateEnregistrement) data.dateEnregistrement = new Date(data.dateEnregistrement);
    if (data.dateExpiration) data.dateExpiration = new Date(data.dateExpiration);
    const updated = await contratService.update(req.params.id, data);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deleteContrat = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contrat = await contratService.findOne(req.params.id, user.userId, user.role);
    if (!contrat) return res.status(404).json({ error: 'Non trouvé ou accès refusé' });
    const perm = contrat.permissions.find((p: any) => p.userId === user.userId);
    if (user.role !== 'admin' && contrat.createdById !== user.userId && perm?.niveau !== 'suppression') {
      return res.status(403).json({ error: 'Accès suppression refusé' });
    }
    await contratService.delete(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const addPermission = async (req: Request, res: Response) => {
  try {
    const { userId, niveau } = req.body;
    const perm = await contratService.addPermission(req.params.id, userId, niveau);
    res.json(perm);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const removePermission = async (req: Request, res: Response) => {
  try {
    await contratService.removePermission(req.params.id, req.params.userId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const addDocumentToContrat = async (req: Request, res: Response) => {
  uploadContrat(req, res, async (err) => {
  if (err) return res.status(500).json({ error: err.message });
  try {
    const user = (req as any).user;
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const docs = [];
      for (const file of req.files as Express.Multer.File[]) {
        const doc = await prisma.document.create({
          data: { nom: file.originalname, fichierUrl: file.filename, typeDocument: "contrat", estConfidentiel: true, uploadedById: user.userId }
        });
        await contratService.addDocument(req.params.id, doc.id);
        docs.push(doc);
      }
      res.json(docs);
    } else if (req.body.documentId) {
      await contratService.addDocument(req.params.id, req.body.documentId);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Aucun document fourni' });
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  }); // fin uploadContrat callback
};

export const uploadAndLinkDocument = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log('[UPLOAD] req.files:', req.files);
    console.log('[UPLOAD] req.headers content-type:', req.headers['content-type']);
    if (!user?.userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    const docs = [];
    for (const file of req.files as Express.Multer.File[]) {
      const doc = await prisma.document.create({
        data: {
          nom: file.originalname,
          fichierUrl: file.filename,
          fichierNomOriginal: file.originalname,
          fichierTaille: file.size,
          fichierType: file.mimetype,
          typeDocument: "contrat", estConfidentiel: true,
          uploadedById: user.userId,
        }
      });
      await contratService.addDocument(req.params.id, doc.id);
      docs.push(doc);
    }
    res.json(docs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const linkDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: 'documentId requis' });
    await contratService.addDocument(req.params.id, documentId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const removeDocumentFromContrat = async (req: Request, res: Response) => {
  try {
    await contratService.removeDocument(req.params.id, req.params.documentId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
