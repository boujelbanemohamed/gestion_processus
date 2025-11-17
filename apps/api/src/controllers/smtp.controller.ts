import { Response } from 'express';
import { SMTPService } from '../services/smtp.service';
import { AuthRequest } from '../middleware/auth';
import { logAccess } from '../middleware/logger';

const smtpService = new SMTPService();

export const getAllSMTPConfigs = async (req: AuthRequest, res: Response) => {
  try {
    const configs = await smtpService.findAll();
    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSMTPConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await smtpService.findOne(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Configuration SMTP non trouvée' });
    }
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSMTPConfig = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const config = await smtpService.create(req.body, req.user.id);
    await logAccess(req, res, 'creation', 'utilisateur', config.id, 'Configuration SMTP');
    res.status(201).json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateSMTPConfig = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const config = await smtpService.update(req.params.id, req.body, req.user.id);
    await logAccess(req, res, 'modification', 'utilisateur', config.id, 'Configuration SMTP');
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteSMTPConfig = async (req: AuthRequest, res: Response) => {
  try {
    await smtpService.delete(req.params.id);
    await logAccess(req, res, 'suppression', 'utilisateur', req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const testSMTPConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { testEmail } = req.body;
    const result = await smtpService.testConnection(req.params.id, testEmail);
    await logAccess(req, res, 'modification', 'utilisateur', req.params.id, 'Test SMTP');
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

