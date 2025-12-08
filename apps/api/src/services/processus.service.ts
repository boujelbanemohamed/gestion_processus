import { prisma } from '../utils/prisma';
import { ProcessusStatut } from '@prisma/client';

export class ProcessusService {
  async findAll(filters?: {
    statut?: ProcessusStatut;
    entiteId?: string;
    categorieId?: string;
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
    if (filters?.categorieId) {
      where.categories = {
        some: {
          categorieId: filters.categorieId,
        },
      };
    }
    if (filters?.search) {
      // Recherche dans nom, code, description ET tags
      // Pour les tags, on utilise une recherche avec hasSome pour une correspondance exacte
      // et on complète avec un filtre côté application pour une recherche partielle
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { codeProcessus: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        // Recherche exacte dans les tags (si le terme de recherche correspond exactement à un tag)
        { tags: { hasSome: [filters.search] } },
      ];
    }

    // Définir l'ordre de tri
    let orderBy: any = { updatedAt: 'desc' }; // Par défaut, tri par date de mise à jour décroissante
    
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'asc';
      
      switch (filters.sortBy) {
        case 'codeProcessus':
          orderBy = { codeProcessus: sortOrder };
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
        case 'proprietaire':
          // Pour proprietaire, on trie par nom de l'utilisateur (via relation)
          orderBy = { proprietaire: { nom: sortOrder } };
          break;
        default:
          orderBy = { updatedAt: 'desc' };
      }
    }

    // Exclure les processus supprimés (soft delete)
    where.deletedAt = null;

    const processusList = await prisma.processus.findMany({
      where,
      include: {
        proprietaire: { select: { id: true, nom: true, prenom: true, email: true } },
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
        categories: {
          include: {
            categorie: { select: { id: true, nom: true, couleur: true } },
          },
        },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy,
    });

    // Filtrer par tags si une recherche est effectuée (recherche partielle dans les tags)
    let filteredList = processusList;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredList = processusList.filter((p) => {
        // Vérifier si le processus correspond déjà aux critères Prisma (nom, code, description)
        const matchesPrismaCriteria = 
          (p.nom && p.nom.toLowerCase().includes(searchLower)) ||
          (p.codeProcessus && p.codeProcessus.toLowerCase().includes(searchLower)) ||
          (p.description && p.description.toLowerCase().includes(searchLower));
        
        // Vérifier si un des tags contient le terme de recherche (recherche partielle)
        let tagMatch = false;
        if (p.tags && Array.isArray(p.tags) && p.tags.length > 0) {
          tagMatch = p.tags.some((tag: string) => 
            tag.toLowerCase().includes(searchLower)
          );
        }
        
        // Garder le processus s'il correspond aux critères Prisma OU aux tags
        return matchesPrismaCriteria || tagMatch;
      });
    }

    // Enrichir avec le nombre de documents (les documents sont liés via referenceType et referenceId)
    const processusWithCounts = await Promise.all(
      filteredList.map(async (p) => {
        const nombreDocuments = await prisma.document.count({
          where: {
            referenceType: 'processus',
            referenceId: p.id,
          },
        });
        return {
          ...p,
          nombreDocuments,
        };
      })
    );

    return processusWithCounts;
  }

  async getConsultationCount(id: string): Promise<number> {
    return prisma.journalAcces.count({
      where: {
        ressourceType: 'processus',
        ressourceId: id,
        action: 'lecture',
      },
    });
  }

  async findOne(id: string) {
    return prisma.processus.findFirst({
      where: { 
        id,
        deletedAt: null, // Exclure les processus supprimés
      },
      include: {
        proprietaire: true,
        entites: {
          include: {
            entite: true,
          },
        },
        categories: {
          include: {
            categorie: true,
          },
        },
        createdBy: true,
      },
    });
  }

  async create(data: {
    nom: string;
    codeProcessus: string;
    description?: string;
    categorieIds?: string[];
    entiteIds?: string[];
    proprietaireId?: string;
    createdById: string;
  }) {
    const { entiteIds, categorieIds, ...processusData } = data;
    
    return prisma.processus.create({
      data: {
        ...processusData,
        statut: 'brouillon',
        entites: entiteIds && entiteIds.length > 0 ? {
          create: entiteIds.map((entiteId) => ({
            entiteId,
          })),
        } : undefined,
        categories: categorieIds && categorieIds.length > 0 ? {
          create: categorieIds.map((categorieId) => ({
            categorieId,
          })),
        } : undefined,
      },
      include: {
        proprietaire: { select: { id: true, nom: true, prenom: true } },
        entites: {
          include: {
            entite: { select: { id: true, nom: true } },
          },
        },
        categories: {
          include: {
            categorie: { select: { id: true, nom: true, couleur: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    codeProcessus?: string;
    description?: string;
    tags?: string[];
    categorieIds?: string[];
    entiteIds?: string[];
    proprietaireId?: string;
    dateProchaineRevision?: Date;
  }) {
    const { entiteIds, categorieIds, ...updateData } = data;
    
    // Si entiteIds est fourni, mettre à jour les relations
    if (entiteIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.processusEntite.deleteMany({
        where: { processusId: id },
      });
      
      // Créer les nouvelles relations
      if (entiteIds.length > 0) {
        await prisma.processusEntite.createMany({
          data: entiteIds.map((entiteId) => ({
            processusId: id,
            entiteId,
          })),
        });
      }
    }

    // Si categorieIds est fourni, mettre à jour les relations
    if (categorieIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.processusCategorie.deleteMany({
        where: { processusId: id },
      });
      
      // Créer les nouvelles relations
      if (categorieIds.length > 0) {
        await prisma.processusCategorie.createMany({
          data: categorieIds.map((categorieId) => ({
            processusId: id,
            categorieId,
          })),
        });
      }
    }
    
    return prisma.processus.update({
      where: { id },
      data: updateData,
      include: {
        proprietaire: { select: { id: true, nom: true, prenom: true, email: true } },
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
        categories: {
          include: {
            categorie: { select: { id: true, nom: true, couleur: true } },
          },
        },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async updateStatus(id: string, statut: ProcessusStatut, validatedBy?: string) {
    const updateData: any = { statut };
    if (statut === 'valide' || statut === 'actif') {
      updateData.dateValidation = new Date();
      if (validatedBy) {
        // Note: valideBy n'existe pas dans le modèle, on pourrait l'ajouter
      }
    }

    const processus = await prisma.processus.update({
      where: { id },
      data: updateData,
    });

    // Mettre à jour le statut du dernier document uploadé pour ce processus
    const dernierDocument = await prisma.document.findFirst({
      where: {
        referenceType: 'processus',
        referenceId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (dernierDocument) {
      // Mapper le statut du processus au statut du document
      let documentStatut: any = dernierDocument.statut;
      if (statut === 'valide' || statut === 'actif') {
        documentStatut = 'valide';
      } else if (statut === 'en_revision') {
        documentStatut = 'en_revision';
      } else if (statut === 'archive' || statut === 'obsolete') {
        documentStatut = 'archive';
      }

      await prisma.document.update({
        where: { id: dernierDocument.id },
        data: { statut: documentStatut },
      });
    }

    return processus;
  }

  async canDelete(id: string, userId: string, userRole: string): Promise<boolean> {
    // Le super admin peut toujours supprimer
    if (userRole === 'admin') {
      return true;
    }

    // Récupérer le processus pour vérifier le propriétaire et le créateur
    const processus = await prisma.processus.findUnique({
      where: { id },
      select: {
        proprietaireId: true,
        createdById: true,
      },
    });

    if (!processus) {
      return false;
    }

    // Le propriétaire ou le créateur peut supprimer
    return processus.proprietaireId === userId || processus.createdById === userId;
  }

  async canModifyCode(id: string, userId: string, userRole: string): Promise<boolean> {
    // Le super admin peut toujours modifier le code
    if (userRole === 'admin') {
      return true;
    }

    // Récupérer le processus pour vérifier le propriétaire et le créateur
    const processus = await prisma.processus.findUnique({
      where: { id },
      select: {
        proprietaireId: true,
        createdById: true,
      },
    });

    if (!processus) {
      return false;
    }

    // Le propriétaire ou le créateur peut modifier le code
    return processus.proprietaireId === userId || processus.createdById === userId;
  }

  async canAccess(id: string, userId: string, userRole: string): Promise<{ canAccess: boolean; reason?: string }> {
    // Récupérer le processus pour vérifier le statut et les permissions
    const processus = await prisma.processus.findUnique({
      where: { id },
      select: {
        statut: true,
        proprietaireId: true,
        createdById: true,
      },
    });

    if (!processus) {
      return { canAccess: false, reason: 'Processus non trouvé' };
    }

    // Si le processus est archivé ou obsolète, seuls le super admin, le propriétaire ou le créateur peuvent y accéder
    if (processus.statut === 'archive' || processus.statut === 'obsolete') {
      // Le super admin peut toujours accéder
      if (userRole === 'admin') {
        return { canAccess: true };
      }

      // Le propriétaire ou le créateur peut accéder
      if (processus.proprietaireId === userId || processus.createdById === userId) {
        return { canAccess: true };
      }

      // Les autres utilisateurs ne peuvent pas accéder
      return { 
        canAccess: false, 
        reason: `Vous ne pouvez plus accéder à ce processus car son statut est "${processus.statut === 'archive' ? 'Archivé' : 'Obsolète'}". Seuls le super admin, le propriétaire ou le créateur peuvent accéder aux processus archivés ou obsolètes.` 
      };
    }

    // Pour les autres statuts, tout le monde peut accéder
    return { canAccess: true };
  }

  async delete(id: string) {
    // Soft delete : marquer comme supprimé au lieu de supprimer réellement
    return prisma.processus.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

      if (entiteIds.length > 0) {
        await prisma.processusEntite.createMany({
          data: entiteIds.map((entiteId) => ({
            processusId: id,
            entiteId,
          })),
        });
      }
    }

    // Si categorieIds est fourni, mettre à jour les relations
    if (categorieIds !== undefined) {
      // Supprimer toutes les relations existantes
      await prisma.processusCategorie.deleteMany({
        where: { processusId: id },
      });
      
      // Créer les nouvelles relations
      if (categorieIds.length > 0) {
        await prisma.processusCategorie.createMany({
          data: categorieIds.map((categorieId) => ({
            processusId: id,
            categorieId,
          })),
        });
      }
    }
    
    return prisma.processus.update({
      where: { id },
      data: updateData,
      include: {
        proprietaire: { select: { id: true, nom: true, prenom: true, email: true } },
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
        categories: {
          include: {
            categorie: { select: { id: true, nom: true, couleur: true } },
          },
        },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async updateStatus(id: string, statut: ProcessusStatut, validatedBy?: string) {
    const updateData: any = { statut };
    if (statut === 'valide' || statut === 'actif') {
      updateData.dateValidation = new Date();
      if (validatedBy) {
        // Note: valideBy n'existe pas dans le modèle, on pourrait l'ajouter
      }
    }

    const processus = await prisma.processus.update({
      where: { id },
      data: updateData,
    });

    // Mettre à jour le statut du dernier document uploadé pour ce processus
    const dernierDocument = await prisma.document.findFirst({
      where: {
        referenceType: 'processus',
        referenceId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (dernierDocument) {
      // Mapper le statut du processus au statut du document
      let documentStatut: any = dernierDocument.statut;
      if (statut === 'valide' || statut === 'actif') {
        documentStatut = 'valide';
      } else if (statut === 'en_revision') {
        documentStatut = 'en_revision';
      } else if (statut === 'archive' || statut === 'obsolete') {
        documentStatut = 'archive';
      }

      await prisma.document.update({
        where: { id: dernierDocument.id },
        data: { statut: documentStatut },
      });
    }

    return processus;
  }

  async canDelete(id: string, userId: string, userRole: string): Promise<boolean> {
    // Le super admin peut toujours supprimer
    if (userRole === 'admin') {
      return true;
    }

    // Récupérer le processus pour vérifier le propriétaire et le créateur
    const processus = await prisma.processus.findUnique({
      where: { id },
      select: {
        proprietaireId: true,
        createdById: true,
      },
    });

    if (!processus) {
      return false;
    }

    // Le propriétaire ou le créateur peut supprimer
    return processus.proprietaireId === userId || processus.createdById === userId;
  }

  async canModifyCode(id: string, userId: string, userRole: string): Promise<boolean> {
    // Le super admin peut toujours modifier le code
    if (userRole === 'admin') {
      return true;
    }

    // Récupérer le processus pour vérifier le propriétaire et le créateur
    const processus = await prisma.processus.findUnique({
      where: { id },
      select: {
        proprietaireId: true,
        createdById: true,
      },
    });

    if (!processus) {
      return false;
    }

    // Le propriétaire ou le créateur peut modifier le code
    return processus.proprietaireId === userId || processus.createdById === userId;
  }

  async canAccess(id: string, userId: string, userRole: string): Promise<{ canAccess: boolean; reason?: string }> {
    // Récupérer le processus pour vérifier le statut et les permissions
    const processus = await prisma.processus.findUnique({
      where: { id },
      select: {
        statut: true,
        proprietaireId: true,
        createdById: true,
      },
    });

    if (!processus) {
      return { canAccess: false, reason: 'Processus non trouvé' };
    }

    // Si le processus est archivé ou obsolète, seuls le super admin, le propriétaire ou le créateur peuvent y accéder
    if (processus.statut === 'archive' || processus.statut === 'obsolete') {
      // Le super admin peut toujours accéder
      if (userRole === 'admin') {
        return { canAccess: true };
      }

      // Le propriétaire ou le créateur peut accéder
      if (processus.proprietaireId === userId || processus.createdById === userId) {
        return { canAccess: true };
      }

      // Les autres utilisateurs ne peuvent pas accéder
      return { 
        canAccess: false, 
        reason: `Vous ne pouvez plus accéder à ce processus car son statut est "${processus.statut === 'archive' ? 'Archivé' : 'Obsolète'}". Seuls le super admin, le propriétaire ou le créateur peuvent accéder aux processus archivés ou obsolètes.` 
      };
    }

    // Pour les autres statuts, tout le monde peut accéder
    return { canAccess: true };
  }
  async delete(id: string) {
    // Soft delete : marquer comme supprimé au lieu de supprimer réellement
    return prisma.processus.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
