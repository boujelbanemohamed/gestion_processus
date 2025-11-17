# 🔧 Créer les utilisateurs avec SQL

## 📋 Solution : Créer directement avec SQL et hash bcrypt pré-généré

Les hashs bcrypt pour les mots de passe :
- `admin123` → `$2b$10$rOzJqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq`
- `user123` → `$2b$10$rOzJqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq`

**Note**: Ces hashs sont des exemples. Il faut générer les vrais hashs.

## 🔧 Solution 1 : Utiliser le conteneur builder (recommandé)

```bash
cd /opt/applications

# Utiliser le conteneur builder qui a toutes les dépendances
docker compose -f docker-compose-app1-only.yml build api-app1

# Exécuter le seed dans le conteneur builder
docker run --rm \
  --network applications_app1-network \
  -e DATABASE_URL="postgresql://postgres:postgres@postgres-app1:5432/cursor_process?schema=public" \
  -v $(pwd)/apps/api:/app \
  -w /app \
  node:20-alpine sh -c "
    npm ci && 
    npx prisma generate && 
    node -e \"
      const bcrypt = require('bcrypt');
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      (async () => {
        const adminHash = await bcrypt.hash('admin123', 10);
        const userHash = await bcrypt.hash('user123', 10);
        await prisma.user.upsert({
          where: { email: 'admin@example.com' },
          update: {},
          create: { email: 'admin@example.com', passwordHash: adminHash, nom: 'Admin', prenom: 'Super', role: 'admin', statut: 'actif' },
        });
        await prisma.user.upsert({
          where: { email: 'user@example.com' },
          update: {},
          create: { email: 'user@example.com', passwordHash: userHash, nom: 'Dupont', prenom: 'Jean', role: 'contributeur', statut: 'actif' },
        });
        console.log('✅ Utilisateurs créés');
        await prisma.\$disconnect();
      })();
    \"
  "
```

## 🔧 Solution 2 : Générer les hashs localement et les utiliser en SQL

```bash
# Sur votre machine locale (Mac), générer les hashs
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(h => console.log('Admin:', h));"
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('user123', 10).then(h => console.log('User:', h));"

# Copier les hashs générés et les utiliser dans SQL
```

## 🔧 Solution 3 : Utiliser un conteneur Node.js temporaire

```bash
cd /opt/applications

# Créer un conteneur temporaire avec toutes les dépendances
docker run --rm -it \
  --network applications_app1-network \
  -e DATABASE_URL="postgresql://postgres:postgres@postgres-app1:5432/cursor_process?schema=public" \
  -v $(pwd)/apps/api:/app \
  -w /app \
  node:20-alpine sh -c "
    apk add --no-cache python3 make g++ && 
    npm ci && 
    npx prisma generate && 
    node -e \"
      require('dotenv/config');
      const bcrypt = require('bcrypt');
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      (async () => {
        try {
          const adminHash = await bcrypt.hash('admin123', 10);
          const admin = await prisma.user.upsert({
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
          console.log('✅ Admin créé:', admin.email);
          
          const userHash = await bcrypt.hash('user123', 10);
          const user = await prisma.user.upsert({
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
          console.log('✅ Contributeur créé:', user.email);
          await prisma.\$disconnect();
        } catch (e) {
          console.error('❌ Erreur:', e.message);
          process.exit(1);
        }
      })();
    \"
  "
```

