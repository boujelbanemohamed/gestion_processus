# 🔧 Créer les utilisateurs dans la base de données

## 📋 Solution 1 : Via Prisma Studio (Interface graphique)

```bash
cd /opt/applications

# Démarrer Prisma Studio
docker compose -f docker-compose-app1-only.yml exec api-app1 npx prisma studio

# Accéder à http://172.17.5.198:5555
# Créer manuellement les utilisateurs via l'interface
```

## 📋 Solution 2 : Créer les utilisateurs directement avec SQL

```bash
cd /opt/applications

# Entrer dans PostgreSQL
docker compose -f docker-compose-app1-only.yml exec postgres-app1 psql -U postgres -d cursor_process
```

Dans psql, exécuter :

```sql
-- Générer un hash bcrypt pour 'admin123' (vous pouvez utiliser un générateur en ligne)
-- Hash bcrypt pour 'admin123': $2b$10$rOzJqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq

-- Créer l'admin (remplacer le hash par un hash valide)
INSERT INTO "User" (id, email, "passwordHash", nom, prenom, role, statut, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  '$2b$10$rOzJqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq',
  'Admin',
  'Super',
  'admin',
  'actif',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Créer le contributeur
INSERT INTO "User" (id, email, "passwordHash", nom, prenom, role, statut, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'user@example.com',
  '$2b$10$rOzJqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq',
  'Dupont',
  'Jean',
  'contributeur',
  'actif',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Vérifier
SELECT email, role, statut FROM "User";
```

## 📋 Solution 3 : Utiliser un conteneur temporaire avec toutes les dépendances

```bash
cd /opt/applications

# Créer un conteneur temporaire avec node et exécuter le seed
docker compose -f docker-compose-app1-only.yml run --rm api-app1 sh -c "
  cd /app && 
  node -e \"
    const bcrypt = require('bcrypt');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function main() {
      const adminHash = await bcrypt.hash('admin123', 10);
      const userHash = await bcrypt.hash('user123', 10);
      
      await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
          email: 'admin@example.com',
          passwordHash: adminHash,
          nom: 'Admin',
          prenom: 'Super',
          role: 'admin',
          statut: 'actif',
        },
      });
      
      await prisma.user.upsert({
        where: { email: 'user@example.com' },
        update: {},
        create: {
          email: 'user@example.com',
          passwordHash: userHash,
          nom: 'Dupont',
          prenom: 'Jean',
          role: 'contributeur',
          statut: 'actif',
        },
      });
      
      console.log('✅ Utilisateurs créés');
      await prisma.\$disconnect();
    }
    
    main().catch(console.error);
  \"
"
```

