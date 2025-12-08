import { prisma } from '../utils/prisma';

export class ProjetService {
  async findAll(filters?: {
    statut?: string;
    entiteId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.entiteId) {
      where.entites = {
        some: {
          entiteId: filters.entiteId,
        },
      };
    }
    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { codeProjet: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Définir l'ordre de tri
    let orderBy: any = { updatedAt: 'desc' };
    
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'asc';
      
      switch (filters.sortBy) {
        case 'codeProjet':
          orderBy = { codeProjet: sortOrder };
          break;
        case 'nom':
          orderBy = { nom: sortOrder };
          break;
        case 'statut':
          orderBy = { statut: sortOrder };
          break;
        case 'createdAt':
          orderBy = { createdAt: sortOrder };
          break;
        case 'updatedAt':
          orderBy = { updatedAt: sortOrder };
          break;
        default:
          orderBy = { updatedAt: 'desc' };
      }
    }

    const projetList = await prisma.projet.findMany({
      where,
      include: {
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
      },
      orderBy,
    });

    // Filtrer par tags si une recherche est effectuée
    let filteredList = projetList;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredList = projetList.filter((p) => {
        // Vérifier si un des tags contient le terme de recherche
        if (p.tags && Array.isArray(p.tags) && p.tags.length > 0) {
          const tagMatch = p.tags.some((tag: string) => 
            tag.toLowerCase().includes(searchLower)
          );
          if (tagMatch) return true;
        }
        return true;
      });
    }

    // Enrichir avec le nombre de documents
    const projetsWithCounts = await Promise.all(
      filteredList.map(async (p) => {
        const nombreDocuments = await prisma.document.count({
          where: {
            referenceType: 'projet',
            referenceId: p.id,
          },
        });
        return {
          ...p,
          nombreDocuments,
        };
      })
    );

    return projetsWithCounts;
  }

  async getConsultationCount(id: string): Promise<number> {
    return prisma.journalAcces.count({
      where: {
        ressourceType: 'projet',
        ressourceId: id,
        action: 'lecture',
      },
    });
  }

  async findOne(id: string) {
    return prisma.projet.findUnique({
      where: { id },
      include: {
        entites: {
          include: {
            entite: true,
          },
        },
      },
    });
  }

  async create(data: {
    nom: string;
    codeProjet: string;
    description?: string;
    tags?: string[];
    entiteIds?: string[];
    type?: string;
    statut?: string;
    responsableId?: string;
    gestionnaireId?: string;
  }) {
    const { entiteIds, ...projetData } = data;
    
    return prisma.projet.create({
      data: {
        ...projetData,
        statut: projetData.statut || 'planifie',
        type: projetData.type || 'interne',
        entites: entiteIds && entiteIds.length > 0 ? {
          create: entiteIds.map((entiteId) => ({
            entiteId,
          })),
        } : undefined,
      },
      include: {
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    codeProjet?: string;
    description?: string;
    tags?: string[];
    entiteIds?: string[];
    type?: string;
    statut?: string;
    responsableId?: string;
    gestionnaireId?: string;
  }) {
    const { entiteIds, ...updateData } = data;
    
    // Si entiteIds est fourni, mettre à jour les relations
    if (entiteIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.projetEntite.deleteMany({
        where: { projetId: id },
      });
      
      // Créer les nouvelles relations
      if (entiteIds.length > 0) {
        await prisma.projetEntite.createMany({
          data: entiteIds.map((entiteId) => ({
            projetId: id,
            entiteId,
          })),
        });
      }
    }
    
    return prisma.projet.update({
      where: { id },
      data: updateData,
      include: {
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.projet.delete({ where: { id } });
  }
}


export class ProjetService {
  async findAll(filters?: {
    statut?: string;
    entiteId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.entiteId) {
      where.entites = {
        some: {
          entiteId: filters.entiteId,
        },
      };
    }
    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { codeProjet: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Définir l'ordre de tri
    let orderBy: any = { updatedAt: 'desc' };
    
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'asc';
      
      switch (filters.sortBy) {
        case 'codeProjet':
          orderBy = { codeProjet: sortOrder };
          break;
        case 'nom':
          orderBy = { nom: sortOrder };
          break;
        case 'statut':
          orderBy = { statut: sortOrder };
          break;
        case 'createdAt':
          orderBy = { createdAt: sortOrder };
          break;
        case 'updatedAt':
          orderBy = { updatedAt: sortOrder };
          break;
        default:
          orderBy = { updatedAt: 'desc' };
      }
    }

    const projetList = await prisma.projet.findMany({
      where,
      include: {
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
      },
      orderBy,
    });

    // Filtrer par tags si une recherche est effectuée
    let filteredList = projetList;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredList = projetList.filter((p) => {
        // Vérifier si un des tags contient le terme de recherche
        if (p.tags && Array.isArray(p.tags) && p.tags.length > 0) {
          const tagMatch = p.tags.some((tag: string) => 
            tag.toLowerCase().includes(searchLower)
          );
          if (tagMatch) return true;
        }
        return true;
      });
    }

    // Enrichir avec le nombre de documents
    const projetsWithCounts = await Promise.all(
      filteredList.map(async (p) => {
        const nombreDocuments = await prisma.document.count({
          where: {
            referenceType: 'projet',
            referenceId: p.id,
          },
        });
        return {
          ...p,
          nombreDocuments,
        };
      })
    );

    return projetsWithCounts;
  }

  async getConsultationCount(id: string): Promise<number> {
    return prisma.journalAcces.count({
      where: {
        ressourceType: 'projet',
        ressourceId: id,
        action: 'lecture',
      },
    });
  }

  async findOne(id: string) {
    return prisma.projet.findUnique({
      where: { id },
      include: {
        entites: {
          include: {
            entite: true,
          },
        },
      },
    });
  }

  async create(data: {
    nom: string;
    codeProjet: string;
    description?: string;
    tags?: string[];
    entiteIds?: string[];
    type?: string;
    statut?: string;
    responsableId?: string;
    gestionnaireId?: string;
  }) {
    const { entiteIds, ...projetData } = data;
    
    return prisma.projet.create({
      data: {
        ...projetData,
        statut: projetData.statut || 'planifie',
        type: projetData.type || 'interne',
        entites: entiteIds && entiteIds.length > 0 ? {
          create: entiteIds.map((entiteId) => ({
            entiteId,
          })),
        } : undefined,
      },
      include: {
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    codeProjet?: string;
    description?: string;
    tags?: string[];
    entiteIds?: string[];
    type?: string;
    statut?: string;
    responsableId?: string;
    gestionnaireId?: string;
  }) {
    const { entiteIds, ...updateData } = data;
    
    // Si entiteIds est fourni, mettre à jour les relations
    if (entiteIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.projetEntite.deleteMany({
        where: { projetId: id },
      });
      
      // Créer les nouvelles relations
      if (entiteIds.length > 0) {
        await prisma.projetEntite.createMany({
          data: entiteIds.map((entiteId) => ({
            projetId: id,
            entiteId,
          })),
        });
      }
    }
    
    return prisma.projet.update({
      where: { id },
      data: updateData,
      include: {
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.projet.delete({ where: { id } });
  }
}


