// Script JavaScript simple pour créer les utilisateurs
// Peut être exécuté directement avec node (sans TypeScript)

require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed...');

  try {
    // Créer un admin
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        passwordHash: adminPasswordHash,
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
    const userPasswordHash = await bcrypt.hash('user123', 10);
    const contributeur = await prisma.user.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        email: 'user@example.com',
        passwordHash: userPasswordHash,
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
    console.error('❌ Erreur lors du seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

