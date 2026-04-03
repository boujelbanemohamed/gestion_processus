import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CorbeilleService } from '../services/corbeille.service';
import { logAccess } from '../middleware/logger';
import { prisma } from '../utils/prisma';

const corbeilleService = new CorbeilleService();

// Récupérer tous les éléments supprimés (processus et documents)
export const getCorbeille = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Seul le super admin peut accéder à la corbeille
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut accéder à la corbeille.' });
    }

    const [
      processus,
      documents,
      licences,
      clientsFournisseurs,
      contrats,
      entites,
      projets,
      tachesAgile,
      epicsAgile,
      userStoriesAgile,
    ] = await Promise.all([
      corbeilleService.getProcessusSupprimes(),
      corbeilleService.getDocumentsSupprimes(),
      corbeilleService.getLicencesSupprimees(),
      corbeilleService.getClientsFournisseursSupprimes(),
      corbeilleService.getContratsSupprimes(),
      corbeilleService.getEntitesSupprimees(),
      corbeilleService.getProjetsSupprimes(),
      corbeilleService.getTachesAgileSupprimees(),
      corbeilleService.getEpicsAgileSupprimes(),
      corbeilleService.getUserStoriesAgileSupprimees(),
    ]);

    res.json({
      processus,
      documents,
      licences,
      clientsFournisseurs,
      contrats,
      entites,
      projets,
      tachesAgile,
      epicsAgile,
      userStoriesAgile,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Restaurer un processus (admin, créateur ou propriétaire — aligné projets)
export const restaurerProcessus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const deleted = await prisma.processus.findFirst({
      where: { id: req.params.id, deletedAt: { not: null } },
      select: { createdById: true, proprietaireId: true },
    });
    if (!deleted) {
      return res.status(400).json({ error: 'Élément introuvable ou non en corbeille' });
    }
    const isAdmin = req.user.role === 'admin';
    const isCreator = deleted.createdById === req.user.userId;
    const isProprietaire = deleted.proprietaireId === req.user.userId;
    if (!isAdmin && !isCreator && !isProprietaire) {
      return res.status(403).json({
        error: "Accès refusé. Seuls l'administrateur, le créateur ou le propriétaire peuvent restaurer ce processus.",
      });
    }

    const processus = await corbeilleService.restaurerProcessus(req.params.id);
    await logAccess(req, res, 'modification', 'processus', processus.id, processus.nom, { action: 'restauration' });
    res.json(processus);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Processus non trouvé' });
    }
    res.status(400).json({ error: error.message });
  }
};

// Restaurer un document
export const restaurerDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Seul le super admin peut restaurer
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
    }

    const document = await corbeilleService.restaurerDocument(req.params.id);
    await logAccess(req, res, 'modification', 'document', document.id, document.nom, { action: 'restauration' });
    res.json(document);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    res.status(400).json({ error: error.message });
  }
};

// Supprimer définitivement un processus
export const supprimerDefinitivementProcessus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Seul le super admin peut supprimer définitivement
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut supprimer définitivement des éléments.' });
    }

    await corbeilleService.supprimerDefinitivementProcessus(req.params.id);
    await logAccess(req, res, 'suppression', 'processus', req.params.id, undefined, { action: 'suppression_definitive' });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Processus non trouvé' });
    }
    res.status(400).json({ error: error.message });
  }
};

export const restaurerLicence = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
    }
    const licence = await corbeilleService.restaurerLicence(req.params.id, req.user.userId, req.user.role);
    await logAccess(req, res, 'modification', 'licence', licence.id, licence.nom, { action: 'restauration' });
    res.json(licence);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementLicence = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementLicence(req.params.id);
    await logAccess(req, res, 'suppression', 'licence', req.params.id, undefined, { action: 'suppression_definitive' });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Supprimer définitivement un document
export const supprimerDefinitivementDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Seul le super admin peut supprimer définitivement
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut supprimer définitivement des éléments.' });
    }

    await corbeilleService.supprimerDefinitivementDocument(req.params.id);
    await logAccess(req, res, 'suppression', 'document', req.params.id, undefined, { action: 'suppression_definitive' });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    res.status(400).json({ error: error.message });
  }
};

export const restaurerClientFournisseur = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
    }
    const row = await corbeilleService.restaurerClientFournisseur(req.params.id, req.user.userId);
    await logAccess(req, res, 'modification', 'clientFournisseur', row.id, row.nom, { action: 'restauration' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementClientFournisseur = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementClientFournisseur(req.params.id);
    await logAccess(req, res, 'suppression', 'clientFournisseur', req.params.id, undefined, {
      action: 'suppression_definitive',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const restaurerContrat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
    }
    const row = await corbeilleService.restaurerContrat(req.params.id, req.user.userId);
    await logAccess(req, res, 'modification', 'contrat', row.id, row.nom, { action: 'restauration' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementContrat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementContrat(req.params.id);
    await logAccess(req, res, 'suppression', 'contrat', req.params.id, undefined, {
      action: 'suppression_definitive',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const restaurerEntite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
    }
    const row = await corbeilleService.restaurerEntite(req.params.id);
    await logAccess(req, res, 'modification', 'entite', row.id, row.nom, { action: 'restauration' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementEntite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementEntite(req.params.id);
    await logAccess(req, res, 'suppression', 'entite', req.params.id, undefined, {
      action: 'suppression_definitive',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const restaurerProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const deleted = await prisma.projet.findFirst({
      where: { id: req.params.id, deletedAt: { not: null } },
      select: { createdById: true },
    });
    if (!deleted) {
      return res.status(400).json({ error: 'Élément introuvable ou non en corbeille' });
    }
    const isAdmin = req.user.role === 'admin';
    const isCreator = deleted.createdById === req.user.userId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Accès refusé. Seuls l’administrateur ou le créateur peuvent restaurer ce projet.' });
    }
    const row = await corbeilleService.restaurerProjet(req.params.id);
    await logAccess(req, res, 'modification', 'projet', row.id, row.nom, { action: 'restauration' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementProjet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementProjet(req.params.id);
    await logAccess(req, res, 'suppression', 'projet', req.params.id, undefined, {
      action: 'suppression_definitive',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const restaurerTacheAgile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
    }
    const row = await corbeilleService.restaurerTacheAgile(req.params.id);
    await logAccess(req, res, 'modification', 'projet', row!.id, row!.nom, { action: 'restauration_tache' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementTacheAgile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementTacheAgile(req.params.id);
    await logAccess(req, res, 'suppression', 'projet', req.params.id, undefined, {
      action: 'suppression_definitive_tache',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const restaurerEpicAgile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    const row = await corbeilleService.restaurerEpicAgile(req.params.id);
    await logAccess(req, res, 'modification', 'projet', row!.id, row!.nom, { action: 'restauration_epic' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementEpicAgile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementEpicAgile(req.params.id);
    await logAccess(req, res, 'suppression', 'projet', req.params.id, undefined, {
      action: 'suppression_definitive_epic',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const restaurerUserStoryAgile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    const row = await corbeilleService.restaurerUserStoryAgile(req.params.id);
    await logAccess(req, res, 'modification', 'projet', row!.id, 'User story', { action: 'restauration_user_story' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const supprimerDefinitivementUserStoryAgile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    await corbeilleService.supprimerDefinitivementUserStoryAgile(req.params.id);
    await logAccess(req, res, 'suppression', 'projet', req.params.id, undefined, {
      action: 'suppression_definitive_user_story',
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
