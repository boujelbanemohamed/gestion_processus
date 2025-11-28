import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CorbeilleService } from '../services/corbeille.service';
import { logAccess } from '../middleware/logger';

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

    const [processus, documents] = await Promise.all([
      corbeilleService.getProcessusSupprimes(),
      corbeilleService.getDocumentsSupprimes(),
    ]);

    res.json({
      processus,
      documents,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Restaurer un processus
export const restaurerProcessus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Seul le super admin peut restaurer
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé. Seul le super admin peut restaurer des éléments.' });
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

