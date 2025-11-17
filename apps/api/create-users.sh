#!/bin/sh
# Script pour créer les utilisateurs par défaut

node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Création des utilisateurs...');
    
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
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
}

main();
"

