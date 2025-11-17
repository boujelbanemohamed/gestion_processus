import { Request, Response } from 'express';
import { EntiteService } from '../services/entite.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';
import { prisma } from '../utils/prisma';

const entiteService = new EntiteService();

export const getAllEntites = async (req: AuthRequest, res: Response) => {
  try {
    const { parentId, type, search, responsableId } = req.query;
    const entites = await entiteService.findAll({
      parentId: parentId as string,
      type: type as any,
      search: search as string,
      responsableId: responsableId as string,
    });
    res.json(entites);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEntiteTree = async (req: AuthRequest, res: Response) => {
  try {
    const tree = await entiteService.getTree();
    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEntite = async (req: AuthRequest, res: Response) => {
  try {
    const entite = await entiteService.findOne(req.params.id);
    if (!entite) {
      return res.status(404).json({ error: 'Entité non trouvée' });
    }
    // Envoyer la réponse d'abord, puis logger (non bloquant)
    res.json(entite);
    // Logger en arrière-plan (ne pas bloquer la réponse)
    logAccess(req, res, 'lecture', 'entite', entite.id, entite.nom).catch((logError) => {
      console.error('Erreur lors du logging (non bloquant):', logError);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createEntite = async (req: AuthRequest, res: Response) => {
  try {
    const createData: any = { ...req.body };
    // Convertir membreIds si nécessaire
    if (req.body.membreIds !== undefined) {
      createData.membreIds = Array.isArray(req.body.membreIds) 
        ? req.body.membreIds 
        : req.body.membreIds ? [req.body.membreIds] : [];
    }
    
    const entite = await entiteService.create(createData);
    await logAccess(req, res, 'creation', 'entite', entite.id, entite.nom);
    res.status(201).json(entite);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateEntite = async (req: AuthRequest, res: Response) => {
  try {
    const oldEntite = await entiteService.findOne(req.params.id);
    
    // Convertir membreIds si c'est une chaîne ou un tableau
    const updateData: any = { ...req.body };
    if (req.body.membreIds !== undefined) {
      updateData.membreIds = Array.isArray(req.body.membreIds) 
        ? req.body.membreIds 
        : req.body.membreIds ? [req.body.membreIds] : [];
    }
    
    const entite = await entiteService.update(req.params.id, updateData);
    
    // Détails des modifications
    const details: any = {};
    if (oldEntite) {
      if (updateData.nom && updateData.nom !== oldEntite.nom) {
        details.changementNom = updateData.nom;
      }
      if (updateData.type && updateData.type !== oldEntite.type) {
        details.changementType = true;
      }
      if (updateData.responsableId !== undefined && updateData.responsableId !== oldEntite.responsableId) {
        details.changementResponsable = true;
      }
      if (updateData.parentId !== undefined && updateData.parentId !== oldEntite.parentId) {
        details.changementParent = true;
      }
      const oldMembreIds = oldEntite.membres?.map((m: any) => m.user?.id || m.userId).sort() || [];
      const newMembreIds = (updateData.membreIds || []).sort();
      if (JSON.stringify(oldMembreIds) !== JSON.stringify(newMembreIds)) {
        details.changementMembres = true;
      }
    }
    
    await logAccess(req, res, 'modification', 'entite', entite.id, entite.nom, Object.keys(details).length > 0 ? details : undefined);
    res.json(entite);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteEntite = async (req: AuthRequest, res: Response) => {
  try {
    await entiteService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'entite', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getEntiteHistory = async (req: AuthRequest, res: Response) => {
  try {
    // Récupérer les paramètres de pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Compter le total d'entrées
    const total = await prisma.journalAcces.count({
      where: {
        ressourceType: 'entite',
        ressourceId: req.params.id,
      },
    });

    // Récupérer l'historique de l'entité avec pagination
    const history = await prisma.journalAcces.findMany({
      where: {
        ressourceType: 'entite',
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
