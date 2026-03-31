#!/usr/bin/env node
/**
 * Parcours API élargi : GET par id / historiques, mutations ciblées avec nettoyage.
 * Complète smoke-api.mjs et smoke-api-mutations.mjs (configuration).
 * Usage : node scripts/smoke-api-deep.mjs
 */

const API = (process.env.API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

const suffix = `deep${Date.now()}`;

async function req(path, opts = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function assertOk(label, status, expected, body) {
  if (status !== expected) {
    console.error(body);
    fail(`${label} → attendu ${expected}, reçu ${status}`);
  }
}

async function main() {
  console.log(`API deep: ${API}\n`);

  let r = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (r.status !== 200 || !r.body?.token) fail(`Login admin échoué: ${r.status}`);
  const token = r.body.token;
  const auth = { Authorization: `Bearer ${token}` };

  console.log('✓ Login admin\n');

  // ——— Listes existantes : GET détail + historique ———
  r = await req('/processus', { headers: auth });
  assertOk('GET /processus', r.status, 200, r.body);
  const procs = Array.isArray(r.body) ? r.body : [];
  const existingProc = procs.find((p) => !p.deletedAt) || procs[0];
  if (existingProc?.id) {
    r = await req(`/processus/${existingProc.id}`, { headers: auth });
    assertOk('GET /processus/:id', r.status, 200, r.body);
    r = await req(`/processus/${existingProc.id}/history`, { headers: auth });
    assertOk('GET /processus/:id/history', r.status, 200, r.body);
  }
  console.log('✓ Processus (liste + détail + historique si données)');

  r = await req('/entites', { headers: auth });
  assertOk('GET /entites', r.status, 200, r.body);
  const entites = Array.isArray(r.body) ? r.body : [];
  const root = entites.find((e) => e.code === 'DIR-001') || entites[0];
  if (root?.id) {
    r = await req(`/entites/${root.id}`, { headers: auth });
    assertOk('GET /entites/:id', r.status, 200, r.body);
    r = await req(`/entites/${root.id}/history`, { headers: auth });
    assertOk('GET /entites/:id/history', r.status, 200, r.body);
  }
  console.log('✓ Entités (détail + historique si données)');

  r = await req('/projets', { headers: auth });
  assertOk('GET /projets', r.status, 200, r.body);
  const projets = Array.isArray(r.body) ? r.body : [];
  if (projets[0]?.id) {
    r = await req(`/projets/${projets[0].id}`, { headers: auth });
    assertOk('GET /projets/:id', r.status, 200, r.body);
    r = await req(`/projets/${projets[0].id}/history`, { headers: auth });
    assertOk('GET /projets/:id/history', r.status, 200, r.body);
  }
  console.log('✓ Projets (détail + historique si données)');

  r = await req('/users', { headers: auth });
  assertOk('GET /users', r.status, 200, r.body);
  const users = Array.isArray(r.body) ? r.body : [];
  if (users[0]?.id) {
    r = await req(`/users/${users[0].id}`, { headers: auth });
    assertOk('GET /users/:id', r.status, 200, r.body);
  }
  console.log('✓ Utilisateurs (détail si données)');

  r = await req('/categories', { headers: auth });
  assertOk('GET /categories', r.status, 200, r.body);
  const cats = Array.isArray(r.body) ? r.body : [];
  if (cats[0]?.id) {
    r = await req(`/categories/${cats[0].id}`, { headers: auth });
    assertOk('GET /categories/:id', r.status, 200, r.body);
  }
  console.log('✓ Catégories (détail si données)');

  r = await req('/documents', { headers: auth });
  assertOk('GET /documents', r.status, 200, r.body);
  const docs = Array.isArray(r.body) ? r.body : [];
  if (docs[0]?.id) {
    r = await req(`/documents/${docs[0].id}`, { headers: auth });
    assertOk('GET /documents/:id', r.status, 200, r.body);
    r = await req(`/documents/${docs[0].id}/comments`, { headers: auth });
    assertOk('GET /documents/:id/comments', r.status, 200, r.body);
  }
  console.log('✓ Documents (détail + commentaires si données)');

  r = await req('/ocr/search?q=smoke', { headers: auth });
  assertOk('GET /ocr/search', r.status, 200, r.body);

  r = await req('/notifications/count', { headers: auth });
  assertOk('GET /notifications/count', r.status, 200, r.body);
  r = await req('/notifications', { headers: auth });
  assertOk('GET /notifications', r.status, 200, r.body);
  const notifs = Array.isArray(r.body) ? r.body : [];
  if (notifs[0]?.id) {
    r = await req(`/notifications/${notifs[0].id}/lue`, { method: 'PATCH', headers: auth });
    assertOk('PATCH /notifications/:id/lue', r.status, 200, r.body);
  }
  r = await req('/notifications/toutes-lues', { method: 'PATCH', headers: auth });
  assertOk('PATCH /notifications/toutes-lues', r.status, 200, r.body);
  console.log('✓ Notifications');

  r = await req('/licences', { headers: auth });
  assertOk('GET /licences', r.status, 200, r.body);
  console.log('✓ Licences (liste)');

  if (!root?.id) fail('Aucune entité racine : impossible de créer projet / entité enfant');

  // ——— Processus : création, statut, favoris, suppression ———
  const codeProcessus = `PROC-DEEP-${suffix}`;
  r = await req('/processus', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      nom: `Processus deep ${suffix}`,
      codeProcessus,
      entiteIds: [root.id],
      categorieIds: cats[0]?.id ? [cats[0].id] : undefined,
    }),
  });
  assertOk('POST /processus', r.status, 201, r.body);
  const newProcId = r.body.id;

  r = await req(`/processus/${newProcId}/history`, { headers: auth });
  assertOk('GET historique nouveau processus', r.status, 200, r.body);

  r = await req(`/processus/${newProcId}/status`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ statut: 'valide' }),
  });
  assertOk('PATCH /processus/:id/status', r.status, 200, r.body);

  r = await req(`/favoris/processus/${newProcId}`, { method: 'POST', headers: auth });
  assertOk('POST favoris processus', r.status, 201, r.body);
  r = await req(`/favoris/processus/${newProcId}/check`, { headers: auth });
  assertOk('GET favoris check', r.status, 200, r.body);
  r = await req(`/favoris/processus/${newProcId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE favoris processus', r.status, 204, r.body);

  r = await req(`/processus/${newProcId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE /processus/:id', r.status, 204, r.body);
  console.log('✓ Cycle processus (création → statut → favoris → suppression)');

  // ——— Entité enfant ———
  const childCode = `E2E-${suffix}`;
  r = await req('/entites', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      nom: `Entité deep ${suffix}`,
      type: 'service',
      code: childCode,
      parentId: root.id,
    }),
  });
  assertOk('POST /entites', r.status, 201, r.body);
  const childEntId = r.body.id;
  r = await req(`/entites/${childEntId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE /entites/:id (enfant)', r.status, 204, r.body);
  console.log('✓ Entité enfant créée puis supprimée');

  // ——— Projet ———
  const codeProjet = `PRJ-${suffix}`;
  r = await req('/projets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      nom: `Projet deep ${suffix}`,
      codeProjet,
      entiteIds: [root.id],
    }),
  });
  assertOk('POST /projets', r.status, 201, r.body);
  const projId = r.body.id;
  r = await req(`/projets/${projId}/history`, { headers: auth });
  assertOk('GET /projets/:id/history (nouveau)', r.status, 200, r.body);
  r = await req(`/projets/${projId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE /projets/:id', r.status, 204, r.body);
  console.log('✓ Projet créé → historique → supprimé');

  // ——— Tâche ———
  r = await req('/taches', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ nom: `Tâche deep ${suffix}` }),
  });
  assertOk('POST /taches', r.status, 201, r.body);
  const tacheId = r.body.id;
  r = await req(`/taches/${tacheId}`, { headers: auth });
  assertOk('GET /taches/:id', r.status, 200, r.body);
  r = await req(`/taches/${tacheId}/commentaires`, { headers: auth });
  assertOk('GET /taches/:id/commentaires', r.status, 200, r.body);
  r = await req(`/taches/${tacheId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE /taches/:id', r.status, 204, r.body);
  console.log('✓ Tâche créée → détail → commentaires → supprimée');

  // ——— Client / fournisseur ———
  r = await req('/clients-fournisseurs', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ type: 'client', nom: `Client deep ${suffix}` }),
  });
  assertOk('POST /clients-fournisseurs', r.status, 201, r.body);
  const cfId = r.body.id;
  r = await req(`/clients-fournisseurs/${cfId}`, { headers: auth });
  assertOk('GET /clients-fournisseurs/:id', r.status, 200, r.body);
  r = await req(`/clients-fournisseurs/${cfId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE /clients-fournisseurs/:id', r.status, 200, r.body);
  console.log('✓ Client créé → détail → supprimé');

  // ——— Contrat (JSON, sans pièce jointe) ———
  r = await req('/contrats', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ nom: `Contrat deep ${suffix}` }),
  });
  assertOk('POST /contrats', r.status, 201, r.body);
  const contratId = r.body.id;
  r = await req(`/contrats/${contratId}`, { headers: auth });
  assertOk('GET /contrats/:id', r.status, 200, r.body);
  r = await req(`/contrats/${contratId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE /contrats/:id', r.status, 200, r.body);
  console.log('✓ Contrat créé → détail → supprimé');

  console.log('\nTous les contrôles API deep sont passés.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
