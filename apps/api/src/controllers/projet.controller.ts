import { Response } from 'express';
import { ProjetService } from '../services/projet.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';
import { prisma } from '../utils/prisma';

const projetService = new ProjetService();

export const getAllProjets = async (req: AuthRequest, res: Response) => {
  try {
    const { statut, entiteId, search, sortBy, sortOrder } = req.query;
    const projets = await projetService.findAll({
      statut: statut as string,
      entiteId: entiteId as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
    });
    res.json(projets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const projet = await projetService.findOne(req.params.id);
    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    // Récupérer le nombre de consultations
    const nombreConsultations = await projetService.getConsultationCount(req.params.id);
    
    await logAccess(req, res, 'lecture', 'projet', projet.id, projet.nom);
    res.json({
      ...projet,
      nombreConsultations,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createProjet = async (req: AuthRequest, res: Response) => {
  try {
    const createData: any = { ...req.body };
    // Convertir entiteIds si nécessaire
    if (req.body.entiteIds !== undefined) {
      createData.entiteIds = Array.isArray(req.body.entiteIds) 
        ? req.body.entiteIds 
        : req.body.entiteIds ? [req.body.entiteIds] : [];
    }
    if (req.body.tags !== undefined) {
      createData.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    }
    
    const projet = await projetService.create(createData);
    await logAccess(req, res, 'creation', 'projet', projet.id, projet.nom);
    res.status(201).json(projet);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const oldProjet = await projetService.findOne(req.params.id);
    
    const updateData: any = { ...req.body };
    if (req.body.entiteIds !== undefined) {
      updateData.entiteIds = Array.isArray(req.body.entiteIds)
        ? req.body.entiteIds
        : req.body.entiteIds ? [req.body.entiteIds] : [];
    }
    if (req.body.tags !== undefined) {
      updateData.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    }
    
    const projet = await projetService.update(req.params.id, updateData);
    
    const details: any = {};
    if (req.body.tags && JSON.stringify(oldProjet?.tags || []) !== JSON.stringify(req.body.tags)) {
      details.anciensTags = oldProjet?.tags || [];
      details.nouveauxTags = req.body.tags;
    }
    const oldEntiteIds = oldProjet?.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).sort() || [];
    const newEntiteIds = (updateData.entiteIds || []).sort();
    if (JSON.stringify(oldEntiteIds) !== JSON.stringify(newEntiteIds)) {
      details.changementEntites = true;
    }
    
    await logAccess(req, res, 'modification', 'projet', projet.id, projet.nom, Object.keys(details).length > 0 ? details : undefined);
    res.json(projet);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    await projetService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'projet', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getProjetHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [history, total] = await Promise.all([
      prisma.journalAcces.findMany({
        where: {
          ressourceType: 'projet',
          ressourceId: req.params.id,
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
        take: limitNum,
      }),
      prisma.journalAcces.count({
        where: {
          ressourceType: 'projet',
          ressourceId: req.params.id,
        },
      }),
    ]);

    res.json({
      data: history,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';
import { prisma } from '../utils/prisma';

const projetService = new ProjetService();

export const getAllProjets = async (req: AuthRequest, res: Response) => {
  try {
    const { statut, entiteId, search, sortBy, sortOrder } = req.query;
    const projets = await projetService.findAll({
      statut: statut as string,
      entiteId: entiteId as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
    });
    res.json(projets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const projet = await projetService.findOne(req.params.id);
    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    // Récupérer le nombre de consultations
    const nombreConsultations = await projetService.getConsultationCount(req.params.id);
    
    await logAccess(req, res, 'lecture', 'projet', projet.id, projet.nom);
    res.json({
      ...projet,
      nombreConsultations,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createProjet = async (req: AuthRequest, res: Response) => {
  try {
    const createData: any = { ...req.body };
    // Convertir entiteIds si nécessaire
    if (req.body.entiteIds !== undefined) {
      createData.entiteIds = Array.isArray(req.body.entiteIds) 
        ? req.body.entiteIds 
        : req.body.entiteIds ? [req.body.entiteIds] : [];
    }
    if (req.body.tags !== undefined) {
      createData.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    }
    
    const projet = await projetService.create(createData);
    await logAccess(req, res, 'creation', 'projet', projet.id, projet.nom);
    res.status(201).json(projet);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const oldProjet = await projetService.findOne(req.params.id);
    
    const updateData: any = { ...req.body };
    if (req.body.entiteIds !== undefined) {
      updateData.entiteIds = Array.isArray(req.body.entiteIds)
        ? req.body.entiteIds
        : req.body.entiteIds ? [req.body.entiteIds] : [];
    }
    if (req.body.tags !== undefined) {
      updateData.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    }
    
    const projet = await projetService.update(req.params.id, updateData);
    
    const details: any = {};
    if (req.body.tags && JSON.stringify(oldProjet?.tags || []) !== JSON.stringify(req.body.tags)) {
      details.anciensTags = oldProjet?.tags || [];
      details.nouveauxTags = req.body.tags;
    }
    const oldEntiteIds = oldProjet?.entites?.map((pe: any) => pe.entite?.id || pe.entiteId).sort() || [];
    const newEntiteIds = (updateData.entiteIds || []).sort();
    if (JSON.stringify(oldEntiteIds) !== JSON.stringify(newEntiteIds)) {
      details.changementEntites = true;
    }
    
    await logAccess(req, res, 'modification', 'projet', projet.id, projet.nom, Object.keys(details).length > 0 ? details : undefined);
    res.json(projet);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    await projetService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'projet', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getProjetHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [history, total] = await Promise.all([
      prisma.journalAcces.findMany({
        where: {
          ressourceType: 'projet',
          ressourceId: req.params.id,
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
        take: limitNum,
      }),
      prisma.journalAcces.count({
        where: {
          ressourceType: 'projet',
          ressourceId: req.params.id,
        },
      }),
    ]);

    res.json({
      data: history,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


