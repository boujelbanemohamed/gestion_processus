import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/hash';
import { Role, UserStatus } from '@prisma/client';

export class UserService {
  async findAll(filters?: {
    role?: Role;
    entiteId?: string;
    statut?: UserStatus;
    search?: string;
  }) {
    const where: any = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.entiteId) {
      where.entitesMembres = {
        some: {
          entiteId: filters.entiteId,
        },
      };
    }
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { prenom: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
      where,
      include: {
        entitesMembres: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
        _count: {
          select: {
            processusProprietaire: true,
            documentsUploaded: true,
          },
        },
      },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        entitesMembres: {
          include: {
            entite: true,
          },
        },
        processusProprietaire: { take: 10, orderBy: { updatedAt: 'desc' } },
        documentsUploaded: { take: 10, orderBy: { createdAt: 'desc' } },
        journalAcces: {
          take: 20,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async create(data: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role?: Role;
    statut?: UserStatus;
    entiteIds?: string[];
  }) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) {
      throw new Error('Email déjà utilisé');
    }

    const passwordHash = await hashPassword(data.password);
    const { entiteIds } = data;
    
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        nom: data.nom,
        prenom: data.prenom,
        role: data.role || 'contributeur',
        statut: data.statut || 'actif',
        entitesMembres: entiteIds && entiteIds.length > 0 ? {
          create: entiteIds.map((entiteId) => ({
            entiteId,
          })),
        } : undefined,
      },
      include: {
        entitesMembres: {
          include: {
            entite: { select: { id: true, nom: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    prenom?: string;
    role?: Role;
    entiteIds?: string[];
    statut?: UserStatus;
    avatarUrl?: string;
  }) {
    const { entiteIds, ...updateData } = data;
    
    // Si entiteIds est fourni, mettre à jour les relations
    if (entiteIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.userEntite.deleteMany({
        where: { userId: id },
      });
      
      // Créer les nouvelles relations
      if (entiteIds.length > 0) {
        await prisma.userEntite.createMany({
          data: entiteIds.map((entiteId) => ({
            userId: id,
            entiteId,
          })),
        });
      }
    }
    
    return prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        entitesMembres: {
          include: {
            entite: { select: { id: true, nom: true } },
          },
        },
      },
    });
  }

  async updatePassword(id: string, newPassword: string) {
    const passwordHash = await hashPassword(newPassword);
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  }
}
