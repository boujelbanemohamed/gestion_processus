const express  = require('express');
const pool     = require('./db');
const logger   = require('./logger');
const { authenticate, authorize } = require('./auth');

const router = express.Router();

// ── GET tous les clients ──────────────────────────────
router.get('/', authenticate, authorize('stock:read'), async (req, res) => {
  try {
    const { search, active } = req.query;
    let q = 'SELECT * FROM clients WHERE 1=1';
    const v = []; let i = 1;
    if (search) { q += ` AND nom ILIKE $${i++}`; v.push(`%${search}%`); }
    if (active === 'true')  { q += ` AND is_active=TRUE`; }
    if (active === 'false') { q += ` AND is_active=FALSE`; }
    q += ' ORDER BY nom ASC';
    const r = await pool.query(q, v);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET un client + ses livraisons ───────────────────
router.get('/:id', authenticate, authorize('stock:read'), async (req, res) => {
  try {
    const client = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: 'Client introuvable' });

    const livraisons = await pool.query(
      'SELECT * FROM livraisons WHERE client_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ ...client.rows[0], livraisons: livraisons.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CREATE client ────────────────────────────────────
router.post('/', authenticate, authorize('stock:write'), async (req, res) => {
  const { nom, adresse } = req.body;
  if (!nom?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  try {
    const r = await pool.query(
      `INSERT INTO clients (nom, adresse, created_by) VALUES ($1,$2,$3)
       RETURNING *`,
      [nom.trim(), adresse?.trim() || null, req.user.username]
    );
    logger.info('Client créé', { by: req.user.username, nom });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ce client existe déjà' });
    res.status(500).json({ error: e.message });
  }
});

// ── UPDATE client ────────────────────────────────────
router.put('/:id', authenticate, authorize('stock:write'), async (req, res) => {
  const { nom, adresse, is_active } = req.body;
  try {
    const r = await pool.query(
      `UPDATE clients SET
         nom       = COALESCE($1, nom),
         adresse   = COALESCE($2, adresse),
         is_active = COALESCE($3, is_active)
       WHERE id=$4 RETURNING *`,
      [nom?.trim() || null, adresse?.trim() || null, is_active !== undefined ? is_active : null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Client introuvable' });
    logger.info('Client modifié', { by: req.user.username, id: req.params.id });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ce nom est déjà utilisé' });
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE client ────────────────────────────────────
router.delete('/:id', authenticate, authorize('stock:write'), async (req, res) => {
  try {
    const livs = await pool.query('SELECT COUNT(*) FROM livraisons WHERE client_id=$1', [req.params.id]);
    if (parseInt(livs.rows[0].count) > 0)
      return res.status(409).json({ error: `Impossible : ce client a ${livs.rows[0].count} livraison(s). Désactivez-le plutôt.` });
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    logger.info('Client supprimé', { by: req.user.username, id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
