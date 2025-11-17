-- Script SQL pour créer les utilisateurs par défaut
-- Hash bcrypt pour 'admin123': $2b$10$BrpOsYEy3Ioa2cjQugGDG.d/ItJoeEKvtI.DmCY3M7PGgrqnSbZIu
-- Hash bcrypt pour 'user123': $2b$10$gIVN9wnXYwqN4IM0FBKxju3A6Ca/ceZzC/EkueAQXh5bElBF5OuYG

-- Créer l'admin
INSERT INTO "User" (id, email, "passwordHash", nom, prenom, role, statut, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  '$2b$10$BrpOsYEy3Ioa2cjQugGDG.d/ItJoeEKvtI.DmCY3M7PGgrqnSbZIu',
  'Admin',
  'Super',
  'admin',
  'actif',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  nom = EXCLUDED.nom,
  prenom = EXCLUDED.prenom,
  role = EXCLUDED.role,
  statut = EXCLUDED.statut,
  "updatedAt" = NOW();

-- Créer le contributeur
INSERT INTO "User" (id, email, "passwordHash", nom, prenom, role, statut, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'user@example.com',
  '$2b$10$gIVN9wnXYwqN4IM0FBKxju3A6Ca/ceZzC/EkueAQXh5bElBF5OuYG',
  'Dupont',
  'Jean',
  'contributeur',
  'actif',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  nom = EXCLUDED.nom,
  prenom = EXCLUDED.prenom,
  role = EXCLUDED.role,
  statut = EXCLUDED.statut,
  "updatedAt" = NOW();

-- Créer une entité racine (si elle n'existe pas)
INSERT INTO "Entite" (id, nom, code, type, description, "responsableId", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Direction Générale',
  'DIR-001',
  'direction',
  'Direction principale',
  (SELECT id FROM "User" WHERE email = 'admin@example.com' LIMIT 1),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Entite" WHERE code = 'DIR-001')
ON CONFLICT (code) DO NOTHING;

-- Créer une catégorie (si elle n'existe pas)
INSERT INTO "CategorieProcessus" (id, nom, description, couleur, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Gestion',
  'Processus de gestion',
  '#3B82F6',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "CategorieProcessus" WHERE nom = 'Gestion')
ON CONFLICT (nom) DO NOTHING;

-- Vérifier les utilisateurs créés
SELECT email, nom, prenom, role, statut FROM "User";

