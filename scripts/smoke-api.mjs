#!/usr/bin/env node
/**
 * Smoke test des endpoints GET principaux (après login admin).
 * Usage : node scripts/smoke-api.mjs
 * Variables : API_URL (défaut http://localhost:4000/api/v1),
 *             E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 */

const API = (process.env.API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

const PUBLIC_GET = ['/health'];

const AUTH_GET = [
  '/dashboard',
  '/entites',
  '/entites/tree',
  '/processus',
  '/projets',
  '/documents',
  '/users',
  '/categories',
  '/journal',
  '/smtp',
  '/corbeille',
  '/favoris',
  '/types-societe',
  '/clients-fournisseurs',
  '/contrats',
  '/ocr/documents',
  '/taches',
  '/taches/documents-liables',
  '/licences',
  '/types-licence',
  '/devises',
  '/notifications',
  '/notifications/count',
];

async function fetchJson(path, opts = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
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
  return { path, status: res.status, ok: res.ok, body };
}

async function main() {
  console.log(`API: ${API}\n`);

  let failed = 0;

  for (const path of PUBLIC_GET) {
    const r = await fetchJson(path);
    const pass = r.status === 200;
    console.log(`${pass ? '✓' : '✗'} ${path} → ${r.status}`);
    if (!pass) failed++;
  }

  const loginRes = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (loginRes.status !== 200 || !loginRes.body?.token) {
    console.error(`\n✗ Login échoué (${loginRes.status}). Vérifiez l’API, la base et les identifiants.`);
    if (loginRes.body?.error) console.error('  ', loginRes.body.error);
    process.exit(1);
  }

  console.log(`✓ /auth/login → 200 (utilisateur: ${loginRes.body.user?.email || EMAIL})\n`);

  const token = loginRes.body.token;

  for (const path of AUTH_GET) {
    const r = await fetchJson(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pass = r.status === 200;
    console.log(`${pass ? '✓' : '✗'} ${path} → ${r.status}`);
    if (!pass) {
      failed++;
      if (r.body?.error) console.log(`    erreur: ${r.body.error}`);
    }
  }

  console.log('');
  if (failed) {
    console.error(`Échecs : ${failed}`);
    process.exit(1);
  }
  console.log('Tous les contrôles API smoke sont passés.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
