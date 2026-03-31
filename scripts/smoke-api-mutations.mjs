#!/usr/bin/env node
/**
 * Tests API : auth négative + cycle CRUD sur ressources de configuration (nettoyage systématique).
 * Usage : node scripts/smoke-api-mutations.mjs
 */

const API = (process.env.API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

const suffix = `e2e${Date.now()}`;

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

async function main() {
  console.log(`API mutations: ${API}\n`);

  // ——— Auth négative ———
  let r = await req('/dashboard', { headers: {} });
  if (r.status !== 401) fail(`/dashboard sans token devrait être 401, reçu ${r.status}`);

  r = await req('/dashboard', { headers: { Authorization: 'Bearer invalid.token.here' } });
  if (r.status !== 401) fail(`/dashboard avec JWT invalide devrait être 401, reçu ${r.status}`);

  console.log('✓ Auth négative (401 sans token / JWT invalide)\n');

  // ——— Login admin ———
  r = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (r.status !== 200 || !r.body?.token) fail(`Login admin échoué: ${r.status}`);
  const token = r.body.token;
  const auth = { Authorization: `Bearer ${token}` };

  console.log(`✓ Login admin\n`);

  const assertOk = (label, status, expected, body) => {
    if (status !== expected) {
      console.error(body);
      fail(`${label} → attendu ${expected}, reçu ${status}`);
    }
  };

  // ——— Types de licence ———
  const tlNom = `TL-${suffix}`;
  r = await req('/types-licence', { method: 'POST', headers: auth, body: JSON.stringify({ nom: tlNom }) });
  assertOk('POST types-licence', r.status, 201, r.body);
  const tlId = r.body.id;

  r = await req(`/types-licence/${tlId}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ nom: `${tlNom}-upd` }),
  });
  assertOk('PUT types-licence', r.status, 200, r.body);

  r = await req(`/types-licence/${tlId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE types-licence', r.status, 200, r.body);

  console.log('✓ CRUD types-licence');

  // ——— Devises ———
  const devCode = `X${suffix}`.toUpperCase().slice(0, 12);
  r = await req('/devises', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ code: devCode, libelle: 'Smoke E2E' }),
  });
  assertOk('POST devises', r.status, 201, r.body);
  const devId = r.body.id;

  r = await req(`/devises/${devId}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ code: devCode, libelle: 'Smoke E2E maj' }),
  });
  assertOk('PUT devises', r.status, 200, r.body);

  r = await req(`/devises/${devId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE devises', r.status, 200, r.body);

  console.log('✓ CRUD devises');

  // ——— Types de société ———
  const tsNom = `TS-${suffix}`;
  r = await req('/types-societe', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ nom: tsNom, description: 'e2e' }),
  });
  assertOk('POST types-societe', r.status, 201, r.body);
  const tsId = r.body.id;

  r = await req(`/types-societe/${tsId}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ nom: `${tsNom}-upd`, description: 'e2e2' }),
  });
  assertOk('PUT types-societe', r.status, 200, r.body);

  r = await req(`/types-societe/${tsId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE types-societe', r.status, 200, r.body);

  console.log('✓ CRUD types-societe');

  // ——— Catégories (sans lien processus) ———
  const catNom = `Cat-${suffix}`;
  r = await req('/categories', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ nom: catNom, couleur: '#111111' }),
  });
  assertOk('POST categories', r.status, 201, r.body);
  const catId = r.body.id;

  r = await req(`/categories/${catId}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ nom: `${catNom}-upd`, couleur: '#222222' }),
  });
  assertOk('PUT categories', r.status, 200, r.body);

  r = await req(`/categories/${catId}`, { method: 'DELETE', headers: auth });
  assertOk('DELETE categories', r.status, 204, r.body);

  console.log('✓ CRUD categories');

  // ——— Contributeur : même utilisateur seed peut encore appeler l’API (pas de 403 sur ces routes) ———
  const cr = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.E2E_CONTRIB_EMAIL || 'user@example.com',
      password: process.env.E2E_CONTRIB_PASSWORD || 'user123',
    }),
  });
  if (cr.status !== 200 || !cr.body?.token) {
    console.log('\n⚠ Login contributeur absent — skip vérification token contributeur');
  } else {
    const ct = { Authorization: `Bearer ${cr.body.token}` };
    r = await req('/processus', { headers: ct });
    assertOk('GET /processus (contributeur)', r.status, 200, r.body);
    r = await req('/dashboard', { headers: ct });
    assertOk('GET /dashboard (contributeur)', r.status, 200, r.body);
    console.log('\n✓ Token contributeur : GET dashboard + processus OK');
  }

  console.log('\nTous les tests mutations / auth étendus sont passés.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
