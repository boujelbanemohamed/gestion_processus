import { prisma } from '../utils/prisma';
import { EntiteType } from '@prisma/client';

export class EntiteService {
  async findAll(filters?: { parentId?: string; type?: EntiteType; search?: string; responsableId?: string }) {
    const where: any = {};
    if (filters?.parentId !== undefined && filters.parentId !== '') where.parentId = filters.parentId;
    if (filters?.type) where.type = filters.type;
    if (filters?.responsableId) where.responsableId = filters.responsableId;
    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.entite.findMany({
      where,
      include: {
        responsable: {
          select: { id: true, email: true, nom: true, prenom: true },
        },
        parent: {
          select: { id: true, nom: true, code: true, type: true },
        },
        membres: {
          include: {
            user: {
              select: { id: true, email: true, nom: true, prenom: true, role: true },
            },
          },
        },
        _count: {
          select: { membres: true, processus: true },
        },
      },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string) {
    return prisma.entite.findUnique({
      where: { id },
      include: {
        responsable: true,
        parent: {
          select: { id: true, nom: true, code: true, type: true },
        },
        children: {
          include: {
            responsable: { select: { id: true, nom: true, prenom: true } },
            _count: { select: { membres: true } },
          },
        },
        membres: {
          include: {
            user: {
              select: { id: true, email: true, nom: true, prenom: true, role: true },
            },
          },
        },
        _count: { select: { processus: true, membres: true } },
      },
    });
  }

  async create(data: {
    nom: string;
    type: EntiteType;
    code: string;
    parentId?: string;
    responsableId?: string;
    description?: string;
    membreIds?: string[];
  }) {
    const { membreIds, ...entiteData } = data;
    
    return prisma.entite.create({
      data: {
        ...entiteData,
        membres: membreIds && membreIds.length > 0 ? {
          create: membreIds.map((userId) => ({
            userId,
          })),
        } : undefined,
      },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        parent: { select: { id: true, nom: true } },
        membres: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    type?: EntiteType;
    code?: string;
    parentId?: string;
    responsableId?: string;
    description?: string;
    membreIds?: string[];
  }) {
    const { membreIds, ...updateData } = data;
    
    // Si membreIds est fourni, mettre à jour les relations
    if (membreIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.userEntite.deleteMany({
        where: { entiteId: id },
      });
      
      // Créer les nouvelles relations
      if (membreIds.length > 0) {
        await prisma.userEntite.createMany({
          data: membreIds.map((userId) => ({
            entiteId: id,
            userId,
          })),
        });
      }
    }
    
    return prisma.entite.update({
      where: { id },
      data: updateData,
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        parent: { select: { id: true, nom: true } },
        membres: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
      },
    });
  }

  async delete(id: string) {
    // Vérifier qu'il n'y a pas d'enfants
    const children = await prisma.entite.findMany({ where: { parentId: id } });
    if (children.length > 0) {
      throw new Error('Impossible de supprimer une entité avec des sous-entités');
    }

    // Vérifier qu'il n'y a pas de membres
    const membres = await prisma.userEntite.findMany({ where: { entiteId: id } });
    if (membres.length > 0) {
      throw new Error('Impossible de supprimer une entité avec des membres');
    }

    return prisma.entite.delete({ where: { id } });
  }

  async getTree() {
    const all = await this.findAll();
    const root = all.filter(e => !e.parentId);
    
    const buildTree = (parentId: string | null): any[] => {
      return all
        .filter(e => e.parentId === parentId)
        .map(e => ({
          ...e,
          children: buildTree(e.id),
        }));
    };

    return root.map(e => ({
      ...e,
      children: buildTree(e.id),
    }));
  }
}
