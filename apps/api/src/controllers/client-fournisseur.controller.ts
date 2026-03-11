import { Request, Response } from 'express';
import { typeSocieteService, clientFournisseurService } from '../services/client-fournisseur.service';
import { prisma } from '../utils/prisma';

// Types de société
export const getTypesSociete = async (req: Request, res: Response) => {
  try {
    const types = await typeSocieteService.findAll();
    res.json(types);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const createTypeSociete = async (req: Request, res: Response) => {
  try {
    const type = await typeSocieteService.create(req.body);
    res.status(201).json(type);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const updateTypeSociete = async (req: Request, res: Response) => {
  try {
    const type = await typeSocieteService.update(req.params.id, req.body);
    res.json(type);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const deleteTypeSociete = async (req: Request, res: Response) => {
  try {
    await typeSocieteService.delete(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// Clients / Fournisseurs
export const getClientsFournisseurs = async (req: Request, res: Response) => {
  try {
    const { type, search } = req.query;
    const data = await clientFournisseurService.findAll(type as string, search as string);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const getClientFournisseur = async (req: Request, res: Response) => {
  try {
    const data = await clientFournisseurService.findOne(req.params.id);
    if (!data) return res.status(404).json({ error: 'Non trouvé' });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const createClientFournisseur = async (req: Request, res: Response) => {
  try {
    const data = await clientFournisseurService.create(req.body);
    res.status(201).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const updateClientFournisseur = async (req: Request, res: Response) => {
  try {
    const data = await clientFournisseurService.update(req.params.id, req.body);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const deleteClientFournisseur = async (req: Request, res: Response) => {
  try {
    await clientFournisseurService.delete(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// Représentants légaux
export const addRepresentant = async (req: Request, res: Response) => {
  try {
    const data = await clientFournisseurService.addRepresentant(req.params.id, req.body);
    res.status(201).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const updateRepresentant = async (req: Request, res: Response) => {
  try {
    const data = await clientFournisseurService.updateRepresentant(req.params.repId, req.body);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const deleteRepresentant = async (req: Request, res: Response) => {
  try {
    await clientFournisseurService.deleteRepresentant(req.params.repId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const addProjet = async (req: Request, res: Response) => {
  try {
    const { projetId } = req.body;
    const data = await prisma.clientFournisseurProjet.create({
      data: { clientFournisseurId: req.params.id, projetId }
    });
    res.status(201).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
export const removeProjet = async (req: Request, res: Response) => {
  try {
    await prisma.clientFournisseurProjet.deleteMany({
      where: { clientFournisseurId: req.params.id, projetId: req.params.projetId }
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
