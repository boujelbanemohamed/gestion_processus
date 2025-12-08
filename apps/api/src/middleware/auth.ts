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

    // Essayer d'abord le header Authorization, puis le paramètre de requête (pour les téléchargements directs)
    let token: string | undefined;
    
    const rawHeader = (req.get('authorization') || (req.headers as any).authorization || (req.headers as any).Authorization) as string | undefined;
    if (rawHeader) {
      const match = /^Bearer\s+(.+)$/i.exec(rawHeader.trim());
      if (match && match[1]) {
        token = match[1].trim();
      }
    }
    
    // Si pas de token dans le header, essayer le paramètre de requête
    if (!token && req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      console.warn('[AUTH] No Authorization header or token query param. headers=', req.headers);
      return res.status(401).json({ error: 'Token manquant', reason: 'no authorization header or token param' });
    }

    try {
      console.log('[AUTH] Vérification du token, longueur:', token.length);
      console.log('[AUTH] Token (first 50 chars):', token.substring(0, 50));
      const payload = verifyAccessToken(token);
      req.user = payload;
      console.log('[AUTH] Token valide pour utilisateur:', payload.email, 'role:', payload.role);
      console.log('[AUTH] Passage au prochain middleware/route');
      next();
    } catch (verifyError) {
      // Log détaillé côté serveur pour diagnostiquer (invalid signature, jwt expired, etc.)
      const reason = (verifyError as any)?.message || 'invalid token';
      console.error('[AUTH] JWT verification error:', reason);
      console.error('[AUTH] Token (first 50 chars):', token.substring(0, 50));
      console.error('[AUTH] Token (last 50 chars):', token.substring(Math.max(0, token.length - 50)));
      console.error('[AUTH] Token length:', token.length);
      console.error('[AUTH] URL de la requête:', req.url);
      console.error('[AUTH] Méthode:', req.method);
      return res.status(401).json({ error: 'Token invalide ou expiré', reason });
    }
  } catch (error) {
    // Erreur générale (pas de token, etc.)
    const reason = (error as any)?.message || 'invalid token';
    console.error('[AUTH] General error:', reason);
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
