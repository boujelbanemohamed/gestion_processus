# 🔧 Créer les utilisateurs - Solution inline

## 📋 Solution : Commande inline avec Node.js

```bash
cd /opt/applications

# Exécuter une commande inline pour créer les utilisateurs
docker compose -f docker-compose-app1-only.yml exec api-app1 node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Création des utilisateurs...');
    
    // Créer l'admin
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
    
    // Créer une entité racine
    const direction = await prisma.entite.upsert({
      where: { code: 'DIR-001' },
      update: {},
      create: {
        nom: 'Direction Générale',
        code: 'DIR-001',
        type: 'direction',
        description: 'Direction principale',
        responsableId: admin.id,
      },
    });
    console.log('✅ Entité créée:', direction.nom);
    
    // Créer un contributeur
    const userHash = await bcrypt.hash('user123', 10);
    const contributeur = await prisma.user.upsert({
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
    console.log('✅ Contributeur créé:', contributeur.email);
    
    // Créer une catégorie
    const categorie = await prisma.categorieProcessus.upsert({
      where: { nom: 'Gestion' },
      update: {},
      create: {
        nom: 'Gestion',
        description: 'Processus de gestion',
        couleur: '#3B82F6',
      },
    });
    console.log('✅ Catégorie créée:', categorie.nom);
    
    console.log('🎉 Seed terminé avec succès!');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await prisma.\$disconnect();
  }
}

main();
"
```

---

## 🔧 Alternative : Si le conteneur API n'est pas démarré

```bash
cd /opt/applications

# Utiliser un conteneur temporaire
docker compose -f docker-compose-app1-only.yml run --rm api-app1 node -e "
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
"
```

---

## ✅ Vérification

```bash
# Vérifier que les utilisateurs ont été créés
docker compose -f docker-compose-app1-only.yml exec postgres-app1 psql -U postgres -d cursor_process -c "SELECT email, role, statut FROM \"User\";"
```

