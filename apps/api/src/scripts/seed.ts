import 'dotenv/config';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/hash';

async function main() {
  console.log('🌱 Démarrage du seed...');

  // Créer un admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: await hashPassword('admin123'),
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
  const contributeur = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      passwordHash: await hashPassword('user123'),
      nom: 'Dupont',
      prenom: 'Jean',
      role: 'contributeur',
      entiteId: direction.id,
      statut: 'actif',
    },
  });

  console.log('✅ Contributeur créé:', contributeur.email);

  // Créer une catégorie
  const categorie = await prisma.categorieProcessus.create({
    data: {
      nom: 'Gestion',
      description: 'Processus de gestion',
      couleur: '#3B82F6',
    },
  });

  console.log('✅ Catégorie créée:', categorie.nom);

  // Créer un processus exemple
  const processus = await prisma.processus.create({
    data: {
      nom: 'Processus d\'exemple',
      codeProcessus: 'PROC-001',
      description: 'Un processus de démonstration',
      categorieId: categorie.id,
      entiteId: direction.id,
      proprietaireId: contributeur.id,
      createdById: contributeur.id,
      statut: 'brouillon',
    },
  });

  console.log('✅ Processus créé:', processus.nom);

  console.log('🎉 Seed terminé avec succès!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
