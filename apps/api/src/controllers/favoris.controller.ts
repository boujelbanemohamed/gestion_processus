import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FavorisService } from '../services/favoris.service';

const favorisService = new FavorisService();

// Récupérer tous les favoris de l'utilisateur connecté
export const getFavoris = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const favoris = await favorisService.getFavorisByUser(req.user.userId);
    res.json(favoris);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Ajouter un processus aux favoris
export const ajouterProcessusFavori = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const favori = await favorisService.ajouterProcessusFavori(req.user.userId, req.params.id);
    res.status(201).json(favori);
  } catch (error: any) {
    if (error.message.includes('déjà dans vos favoris')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// Retirer un processus des favoris
export const retirerProcessusFavori = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    await favorisService.retirerProcessusFavori(req.user.userId, req.params.id);
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Favori non trouvé' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Ajouter un document aux favoris
export const ajouterDocumentFavori = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const favori = await favorisService.ajouterDocumentFavori(req.user.userId, req.params.id);
    res.status(201).json(favori);
  } catch (error: any) {
    if (error.message.includes('déjà dans vos favoris')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// Retirer un document des favoris
export const retirerDocumentFavori = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    await favorisService.retirerDocumentFavori(req.user.userId, req.params.id);
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Favori non trouvé' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Vérifier si un processus est en favoris
export const estProcessusFavori = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const estFavori = await favorisService.estProcessusFavori(req.user.userId, req.params.id);
    res.json({ estFavori });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Vérifier si un document est en favoris
export const estDocumentFavori = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const estFavori = await favorisService.estDocumentFavori(req.user.userId, req.params.id);
    res.json({ estFavori });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

