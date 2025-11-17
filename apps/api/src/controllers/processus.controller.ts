import { Request, Response } from 'express';
import { ProcessusService } from '../services/processus.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';
import { prisma } from '../utils/prisma';

const processusService = new ProcessusService();

export const getAllProcessus = async (req: AuthRequest, res: Response) => {
  try {
    const { statut, entiteId, categorieId, search } = req.query;
    const processus = await processusService.findAll({
      statut: statut as any,
      entiteId: entiteId as string,
      categorieId: categorieId as string,
      search: search as string,
    });
    res.json(processus);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProcessus = async (req: AuthRequest, res: Response) => {
  try {
    const processus = await processusService.findOne(req.params.id);
    if (!processus) {
      return res.status(404).json({ error: 'Processus non trouvé' });
    }
    await logAccess(req, res, 'lecture', 'processus', processus.id, processus.nom);
    res.json(processus);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createProcessus = async (req: AuthRequest, res: Response) => {
  try {
    const createData: any = { ...req.body };
    // Convertir entiteIds si nécessaire
    if (req.body.entiteIds !== undefined) {
      createData.entiteIds = Array.isArray(req.body.entiteIds) 
        ? req.body.entiteIds 
        : req.body.entiteIds ? [req.body.entiteIds] : [];
    }
    // Convertir categorieIds si nécessaire
    if (req.body.categorieIds !== undefined) {
      createData.categorieIds = Array.isArray(req.body.categorieIds) 
        ? req.body.categorieIds 
        : req.body.categorieIds ? [req.body.categorieIds] : [];
    }
    
    const processus = await processusService.create({
      ...createData,
      createdById: req.user!.userId,
    });
    await logAccess(req, res, 'creation', 'processus', processus.id, processus.nom);
    res.status(201).json(processus);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateProcessus = async (req: AuthRequest, res: Response) => {
  try {
    const oldProcessus = await processusService.findOne(req.params.id);
    
    // Convertir entiteIds si c'est une chaîne ou un tableau
    const updateData: any = { ...req.body };
    if (req.body.entiteIds !== undefined) {
      updateData.entiteIds = Array.isArray(req.body.entiteIds) 
        ? req.body.entiteIds 
        : req.body.entiteIds ? [req.body.entiteIds] : [];
    }
    // Convertir categorieIds si c'est une chaîne ou un tableau
    if (req.body.categorieIds !== undefined) {
      updateData.categorieIds = Array.isArray(req.body.categorieIds) 
        ? req.body.categorieIds 
        : req.body.categorieIds ? [req.body.categorieIds] : [];
    }
    
    const processus = await processusService.update(req.params.id, updateData);
    
    // Détails des modifications
    const details: any = {};
    if (req.body.proprietaireId && oldProcessus?.proprietaireId !== req.body.proprietaireId) {
      details.changementProprietaire = true;
    }
    const oldEntiteIds = oldProcessus?.entites?.map((pe: any) => pe.entite.id).sort() || [];
    const newEntiteIds = (updateData.entiteIds || []).sort();
    if (JSON.stringify(oldEntiteIds) !== JSON.stringify(newEntiteIds)) {
      details.changementEntites = true;
    }
    const oldCategorieIds = oldProcessus?.categories?.map((pc: any) => pc.categorie.id).sort() || [];
    const newCategorieIds = (updateData.categorieIds || []).sort();
    if (JSON.stringify(oldCategorieIds) !== JSON.stringify(newCategorieIds)) {
      details.changementCategories = true;
    }
    
    await logAccess(req, res, 'modification', 'processus', processus.id, processus.nom, Object.keys(details).length > 0 ? details : undefined);
    res.json(processus);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateProcessusStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { statut } = req.body;
    const processus = await processusService.updateStatus(
      req.params.id,
      statut,
      req.user!.userId
    );
    await logAccess(req, res, 'modification', 'processus', processus.id, processus.nom, {
      changementStatut: statut,
    });
    res.json(processus);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteProcessus = async (req: AuthRequest, res: Response) => {
  try {
    await processusService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'processus', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getProcessusHistory = async (req: AuthRequest, res: Response) => {
  try {
    // Récupérer les paramètres de pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Récupérer les IDs des documents liés à ce processus
    const documents = await prisma.document.findMany({
      where: {
        referenceType: 'processus',
        referenceId: req.params.id,
      },
      select: { id: true },
    });
    const documentIds = documents.map(d => d.id);

    // Compter le total d'entrées
    const total = await prisma.journalAcces.count({
      where: {
        OR: [
          {
            ressourceType: 'processus',
            ressourceId: req.params.id,
          },
          {
            ressourceType: 'document',
            ressourceId: { in: documentIds },
          },
        ],
      },
    });

    // Récupérer l'historique du processus et de ses documents avec pagination
    const history = await prisma.journalAcces.findMany({
      where: {
        OR: [
          {
            ressourceType: 'processus',
            ressourceId: req.params.id,
          },
          {
            ressourceType: 'document',
            ressourceId: { in: documentIds },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
