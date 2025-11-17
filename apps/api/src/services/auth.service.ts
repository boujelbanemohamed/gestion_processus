import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { LogAction, ResourceType } from '@prisma/client';

export class AuthService {
  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      throw new Error('Email ou mot de passe incorrect');
    }

    if (user.statut !== 'actif') {
      throw new Error('Compte inactif ou suspendu');
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // Mettre à jour la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { derniereConnexion: new Date() },
    });

    // Journaliser la connexion
    await prisma.journalAcces.create({
      data: {
        userId: user.id,
        action: 'connexion',
        ressourceType: 'utilisateur',
        ressourceId: user.id,
        ressourceNom: `${user.prenom} ${user.nom}`,
        ipAddress: ip,
        userAgent,
        details: { email: user.email },
      },
    });

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      token: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        entiteId: user.entiteId,
      },
    };
  }

  async register(email: string, password: string, nom: string, prenom: string, role: string = 'contributeur') {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new Error('Email déjà utilisé');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        nom,
        prenom,
        role: role as any,
      },
    });

    return {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
    };
  }
}
