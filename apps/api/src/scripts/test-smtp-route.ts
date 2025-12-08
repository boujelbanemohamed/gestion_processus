/**
 * Script pour tester la route SMTP avec un token JWT valide
 * Usage: npx tsx src/scripts/test-smtp-route.ts
 */

import jwt from 'jsonwebtoken';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const API_URL = process.env.API_URL || 'http://172.17.5.198:4000/api/v1';

async function testSMTPRoute() {
  try {
    console.log('==========================================');
    console.log('TEST DE LA ROUTE SMTP');
    console.log('==========================================\n');

    // 1. Récupérer un utilisateur réel de la base de données
    console.log('1. Récupération d\'un utilisateur de la base de données...');
    const user = await prisma.user.findFirst({
      where: { statut: 'actif' },
    });

    if (!user) {
      console.error('❌ Aucun utilisateur actif trouvé dans la base de données');
      process.exit(1);
    }

    console.log(`✅ Utilisateur trouvé: ${user.email} (${user.role})`);
    console.log(`   ID: ${user.id}\n`);

    // 2. Générer un token JWT avec les mêmes paramètres que l'application
    console.log('2. Génération du token JWT...');
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    console.log(`✅ Token généré (${token.length} caractères)`);
    console.log(`   Premiers 50 caractères: ${token.substring(0, 50)}...\n`);

    // 3. Tester la route GET /api/v1/smtp
    console.log('3. Test de la route GET /api/v1/smtp...');
    try {
      const getResponse = await axios.get(`${API_URL}/smtp`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ GET /api/v1/smtp - Succès');
      console.log('   Réponse:', JSON.stringify(getResponse.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.error('❌ GET /api/v1/smtp - Erreur');
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Données:`, error.response.data);
      } else {
        console.error('❌ Erreur réseau:', error.message);
      }
    }

    console.log('\n');

    // 4. Tester la route POST /api/v1/smtp
    console.log('4. Test de la route POST /api/v1/smtp...');
    const testData = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      user: 'test@example.com',
      password: 'testpassword',
      fromEmail: 'test@example.com',
      fromName: 'Test SMTP',
      isActive: false,
    };

    try {
      const postResponse = await axios.post(`${API_URL}/smtp`, testData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ POST /api/v1/smtp - Succès');
      console.log('   Réponse:', JSON.stringify(postResponse.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.error('❌ POST /api/v1/smtp - Erreur');
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Données:`, error.response.data);
        console.error(`   Headers reçus:`, error.response.headers);
      } else {
        console.error('❌ Erreur réseau:', error.message);
      }
    }

    console.log('\n==========================================');
    console.log('TEST TERMINÉ');
    console.log('==========================================');
  } catch (error: any) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testSMTPRoute();

