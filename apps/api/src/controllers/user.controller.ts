import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';

const userService = new UserService();

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, entiteId, statut, search } = req.query;
    const users = await userService.findAll({
      role: role as any,
      entiteId: entiteId as string,
      statut: statut as any,
      search: search as string,
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.findOne(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    // Log de consultation (non bloquant)
    logAccess(req, res, 'lecture', 'utilisateur', user.id, `${user.prenom} ${user.nom}`).catch(() => {});
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.create(req.body);
    await logAccess(req, res, 'creation', 'utilisateur', user.id, `${user.prenom} ${user.nom}`);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.update(req.params.id, req.body);
    await logAccess(req, res, 'modification', 'utilisateur', user.id, `${user.prenom} ${user.nom}`);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    await userService.updatePassword(req.params.id, req.body.password);
    await logAccess(req, res, 'modification', 'utilisateur', req.params.id, undefined, {
      action: 'changement_mot_de_passe',
    });
    res.json({ message: 'Mot de passe mis à jour' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    await userService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'utilisateur', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
