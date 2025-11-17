import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Laisser passer les requêtes de préflight CORS
    if (req.method === 'OPTIONS') {
      return next();
    }

    const rawHeader = (req.get('authorization') || (req.headers as any).authorization || (req.headers as any).Authorization) as string | undefined;
    if (!rawHeader) {
      console.warn('[AUTH] No Authorization header. headers=', req.headers);
      return res.status(401).json({ error: 'Token manquant', reason: 'no authorization header' });
    }

    const match = /^Bearer\s+(.+)$/i.exec(rawHeader.trim());
    if (!match || !match[1]) {
      console.warn('[AUTH] Malformed Authorization header:', rawHeader);
      return res.status(401).json({ error: 'Token manquant', reason: 'malformed authorization header' });
    }

    const token = match[1].trim();
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    // Log détaillé côté serveur pour diagnostiquer (invalid signature, jwt expired, etc.)
    // En dev, on renvoie aussi la raison pour faciliter le debug côté client
    const reason = (error as any)?.message || 'invalid token';
    console.error('[AUTH] JWT error:', reason);
    return res.status(401).json({ error: 'Token invalide ou expiré', reason });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  };
};
