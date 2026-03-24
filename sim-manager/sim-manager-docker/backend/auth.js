const jwt    = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || 'changez_ce_secret_jwt_en_production_2025';

// ── Permissions par rôle ──────────────────────────────
const PERMISSIONS = {
  admin:        ['*'],                                          // tout
  stock:        ['stock:read', 'stock:write'],                  // stock R/W
  livraison:    ['stock:read', 'livraison:read', 'livraison:write'], // livraisons + lecture stock
  consultation: ['stock:read', 'livraison:read', 'stats:read'], // lecture seule
};

// ── Vérifier le token JWT ─────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token manquant ou invalide' });

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// ── Vérifier une permission ───────────────────────────
function authorize(permission) {
  return (req, res, next) => {
    const userPerms = PERMISSIONS[req.user?.role] || [];
    const allowed   = userPerms.includes('*') || userPerms.includes(permission);
    if (!allowed) {
      logger.warn('Accès refusé', { user: req.user?.username, role: req.user?.role, permission });
      return res.status(403).json({ error: 'Accès refusé — permissions insuffisantes' });
    }
    next();
  };
}

// ── Réservé aux admins ────────────────────────────────
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Réservé aux administrateurs' });
  next();
}

module.exports = { authenticate, authorize, adminOnly, JWT_SECRET, PERMISSIONS };
