const express  = require('express');
const cors     = require('cors');
require('dotenv').config();

const pool        = require('./db');
const logger      = require('./logger');
const { authenticate, authorize } = require('./auth');
const authRouter    = require('./routes.auth');
const clientsRouter = require('./routes.clients');

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(logger.httpMiddleware);

// ── PUBLIC ────────────────────────────────────────────
app.use('/api/auth', authRouter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (e) { res.status(500).json({ status: 'error', db: 'disconnected', error: e.message }); }
});

// ── CLIENTS ───────────────────────────────────────────
app.use('/api/clients', clientsRouter);

// ── STATS ─────────────────────────────────────────────
app.get('/api/stats', authenticate, authorize('stats:read'), async (req, res) => {
  try {
    const [total, dispo, livre, nbLiv, parOp, nbClients] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM sim_cards'),
      pool.query("SELECT COUNT(*) FROM sim_cards WHERE status='disponible'"),
      pool.query("SELECT COUNT(*) FROM sim_cards WHERE status='livre'"),
      pool.query('SELECT COUNT(*) FROM livraisons'),
      pool.query(`SELECT operateur, COUNT(*) AS total,
        SUM(CASE WHEN status='disponible' THEN 1 ELSE 0 END) AS disponible,
        SUM(CASE WHEN status='livre' THEN 1 ELSE 0 END) AS livre
        FROM sim_cards GROUP BY operateur ORDER BY operateur`),
      pool.query("SELECT COUNT(*) FROM clients WHERE is_active=TRUE"),
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      disponible: parseInt(dispo.rows[0].count),
      livre: parseInt(livre.rows[0].count),
      livraisons: parseInt(nbLiv.rows[0].count),
      clients: parseInt(nbClients.rows[0].count),
      parOperateur: parOp.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SIMS GET ──────────────────────────────────────────
app.get('/api/sims', authenticate, authorize('stock:read'), async (req, res) => {
  try {
    const { operateur, status, search, limit = 200, offset = 0 } = req.query;
    let q = 'SELECT * FROM sim_cards WHERE 1=1';
    const v = []; let i = 1;
    if (operateur) { q += ` AND operateur=$${i++}`; v.push(operateur); }
    if (status)    { q += ` AND status=$${i++}`;    v.push(status); }
    if (search)    { q += ` AND iccid ILIKE $${i++}`; v.push(`%${search}%`); }
    q += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    v.push(parseInt(limit), parseInt(offset));
    res.json((await pool.query(q, v)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SIMS ADD LOT ──────────────────────────────────────
app.post('/api/sims/lot', authenticate, authorize('stock:write'), async (req, res) => {
  const { operateur, lot, iccids } = req.body;
  if (!operateur || !lot || !iccids?.length)
    return res.status(400).json({ error: 'Champs manquants' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let added = 0, skipped = 0;
    for (const iccid of iccids) {
      const clean = iccid.trim(); if (!clean) continue;
      try { await client.query(`INSERT INTO sim_cards(iccid,operateur,lot,date_entree,status) VALUES($1,$2,$3,CURRENT_DATE,'disponible')`, [clean, operateur, lot]); added++; }
      catch { skipped++; }
    }
    await client.query('COMMIT');
    logger.info('Lot ajouté', { by: req.user.username, operateur, lot, added, skipped });
    res.json({ success: true, added, skipped });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ── SIMS DELETE ───────────────────────────────────────
app.delete('/api/sims/:iccid', authenticate, authorize('stock:write'), async (req, res) => {
  try {
    await pool.query('DELETE FROM sim_cards WHERE iccid=$1', [req.params.iccid]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LIVRAISONS GET ALL ────────────────────────────────
app.get('/api/livraisons', authenticate, authorize('livraison:read'), async (req, res) => {
  try {
    const { client_id } = req.query;
    let q = `SELECT l.*, c.nom as client_nom_complet, c.adresse as client_adresse
             FROM livraisons l LEFT JOIN clients c ON l.client_id = c.id WHERE 1=1`;
    const v = []; let i = 1;
    if (client_id) { q += ` AND l.client_id=$${i++}`; v.push(client_id); }
    q += ' ORDER BY l.created_at DESC';
    const livs = await pool.query(q, v);
    const result = await Promise.all(livs.rows.map(async l => {
      const sims = await pool.query('SELECT iccid FROM livraison_sims WHERE livraison_ref=$1', [l.ref]);
      return { ...l, sims: sims.rows.map(r => r.iccid) };
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LIVRAISONS GET ONE ────────────────────────────────
app.get('/api/livraisons/:ref', authenticate, authorize('livraison:read'), async (req, res) => {
  try {
    const liv = await pool.query(
      `SELECT l.*, c.adresse as client_adresse FROM livraisons l
       LEFT JOIN clients c ON l.client_id=c.id WHERE l.ref=$1`, [req.params.ref]
    );
    if (!liv.rows.length) return res.status(404).json({ error: 'Non trouvé' });
    const sims = await pool.query('SELECT iccid FROM livraison_sims WHERE livraison_ref=$1', [req.params.ref]);
    res.json({ ...liv.rows[0], sims: sims.rows.map(r => r.iccid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LIVRAISONS CREATE ─────────────────────────────────
app.post('/api/livraisons', authenticate, authorize('livraison:write'), async (req, res) => {
  const { ref, client_id, client_nom, operateur, date_livraison, iccids } = req.body;
  if (!ref || !client_nom || !operateur || !date_livraison || !iccids?.length)
    return res.status(400).json({ error: 'Champs manquants' });
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const ph = iccids.map((_,i) => `$${i+1}`).join(',');
    const check = await dbClient.query(
      `SELECT iccid FROM sim_cards WHERE iccid IN (${ph}) AND status!='disponible'`, iccids
    );
    if (check.rows.length)
      return res.status(409).json({ error: 'Certaines puces ne sont plus disponibles', iccids: check.rows.map(r=>r.iccid) });

    await dbClient.query(
      `INSERT INTO livraisons(ref,client_id,client_nom,operateur,date_livraison,quantite,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [ref, client_id || null, client_nom, operateur, date_livraison, iccids.length, req.user.username]
    );
    for (const iccid of iccids) {
      await dbClient.query('INSERT INTO livraison_sims(livraison_ref,iccid) VALUES($1,$2)', [ref, iccid]);
      await dbClient.query("UPDATE sim_cards SET status='livre',livraison_ref=$1 WHERE iccid=$2", [ref, iccid]);
    }
    await dbClient.query('COMMIT');
    logger.info('Livraison créée', { by: req.user.username, ref, client_nom, quantite: iccids.length });
    res.json({ success: true, ref, quantite: iccids.length });
  } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { dbClient.release(); }
});

// ── LIVRAISONS DELETE ─────────────────────────────────
app.delete('/api/livraisons/:ref', authenticate, authorize('*'), async (req, res) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query("UPDATE sim_cards SET status='disponible',livraison_ref=NULL WHERE livraison_ref=$1", [req.params.ref]);
    await dbClient.query('DELETE FROM livraisons WHERE ref=$1', [req.params.ref]);
    await dbClient.query('COMMIT');
    logger.info('Livraison supprimée', { by: req.user.username, ref: req.params.ref });
    res.json({ success: true });
  } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { dbClient.release(); }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('SIM Manager API démarrée', { port: PORT, env: process.env.NODE_ENV });
});
process.on('uncaughtException',  e => logger.error('uncaughtException',  { error: e.message }));
process.on('unhandledRejection', e => logger.error('unhandledRejection', { error: String(e) }));
