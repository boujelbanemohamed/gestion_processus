const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('./db');
const logger   = require('./logger');
const { authenticate, adminOnly, JWT_SECRET } = require('./auth');

const router = express.Router();
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ── POST /api/auth/login ──────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username=$1 AND is_active=TRUE', [username]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      logger.warn('Tentative de connexion échouée', { username, ip: req.ip });
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    // Mettre à jour last_login
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    logger.info('Connexion réussie', { username: user.username, role: user.role });

    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
    });
  } catch (e) {
    logger.error('Erreur login', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, username, full_name, role, last_login, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/change-password ────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Champs manquants' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });

  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!(await bcrypt.compare(current_password, r.rows[0].password_hash)))
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    logger.info('Mot de passe changé', { username: req.user.username });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/auth/users — liste (admin) ───────────────
router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, username, full_name, role, is_active, last_login, created_at, created_by FROM users ORDER BY created_at DESC'
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/users — créer (admin) ──────────────
router.post('/users', authenticate, adminOnly, async (req, res) => {
  const { username, password, full_name, role } = req.body;
  const validRoles = ['admin', 'stock', 'livraison', 'consultation'];

  if (!username || !password || !full_name || !role)
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, username, full_name, role, is_active, created_at`,
      [username, hash, full_name, role, req.user.username]
    );
    logger.info('Utilisateur créé', { by: req.user.username, newUser: username, role });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: "Nom d'utilisateur déjà pris" });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/auth/users/:id — modifier (admin) ────────
router.put('/users/:id', authenticate, adminOnly, async (req, res) => {
  const { full_name, role, is_active, password } = req.body;
  const validRoles = ['admin', 'stock', 'livraison', 'consultation'];

  if (role && !validRoles.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  try {
    // Empêcher de désactiver le dernier admin
    if (is_active === false || role !== 'admin') {
      const admins = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=TRUE AND id!=$1", [req.params.id]
      );
      const current = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
      if (current.rows[0]?.role === 'admin' && parseInt(admins.rows[0].count) === 0)
        return res.status(400).json({ error: 'Impossible : il doit rester au moins un administrateur actif' });
    }

    let q = 'UPDATE users SET full_name=COALESCE($1,full_name), role=COALESCE($2,role), is_active=COALESCE($3,is_active)';
    const v = [full_name || null, role || null, is_active !== undefined ? is_active : null];

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court' });
      const hash = await bcrypt.hash(password, 10);
      q += `, password_hash=$${v.length + 1}`;
      v.push(hash);
    }

    q += ` WHERE id=$${v.length + 1} RETURNING id, username, full_name, role, is_active`;
    v.push(req.params.id);

    const r = await pool.query(q, v);
    if (!r.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });

    logger.info('Utilisateur modifié', { by: req.user.username, userId: req.params.id });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/auth/users/:id — supprimer (admin) ────
router.delete('/users/:id', authenticate, adminOnly, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });

  try {
    const admins = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=TRUE AND id!=$1", [req.params.id]
    );
    const target = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
    if (target.rows[0]?.role === 'admin' && parseInt(admins.rows[0].count) === 0)
      return res.status(400).json({ error: 'Impossible : dernier administrateur actif' });

    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    logger.info('Utilisateur supprimé', { by: req.user.username, userId: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
