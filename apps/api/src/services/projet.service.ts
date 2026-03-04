import { prisma } from '../utils/prisma';

export class ProjetService {
  async findAll(filters?: {
    statut?: string;
    entiteId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    priorite?: string;
    type?: string;
  }) {
    const where: any = {};
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.priorite) where.priorite = filters.priorite;
    if (filters?.type) where.type = filters.type;
    if (filters?.entiteId) {
      where.entites = { some: { entiteId: filters.entiteId } };
    }
    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { codeProjet: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { updatedAt: 'desc' };
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'asc';
      const sortableFields = ['codeProjet', 'nom', 'statut', 'priorite', 'createdAt', 'updatedAt'];
      if (sortableFields.includes(filters.sortBy)) {
        orderBy = { [filters.sortBy]: sortOrder };
      }
    }

    const projetList = await prisma.projet.findMany({
      where,
      include: {
        entites: {
          include: { entite: { select: { id: true, nom: true, code: true } } },
        },
        sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
      orderBy,
    });

    // Parser les champs JSON et ajouter le nombre de documents
    const projetsWithCounts = await Promise.all(
      projetList.map(async (p) => {
        const nombreDocuments = await prisma.document.count({
          where: { referenceType: 'projet', referenceId: p.id },
        });
        return {
          ...p,
          partiesPrenantes: p.partiesPrenantes ? JSON.parse(p.partiesPrenantes) : [],
          kpis: p.kpis ? JSON.parse(p.kpis) : [],
          objectifsStrategiques: p.objectifsStrategiques ? JSON.parse(p.objectifsStrategiques) : [],
          objectifsOperationnels: p.objectifsOperationnels ? JSON.parse(p.objectifsOperationnels) : [],
          // Aplatir les relations gouvernance pour le frontend
          sponsorsData: p.sponsors.map((s) => s.user),
          chefsProjetData: p.chefsProjet.map((c) => c.user),
          techLeadsData: p.techLeads.map((t) => t.user),
          equipeData: p.equipe.map((e) => e.user),
          nombreDocuments,
        };
      })
    );

    return projetsWithCounts;
  }

  async getConsultationCount(id: string): Promise<number> {
    return prisma.journalAcces.count({
      where: { ressourceType: 'projet', ressourceId: id, action: 'lecture' },
    });
  }

  async findOne(id: string) {
    const projet = await prisma.projet.findUnique({
      where: { id },
      include: {
        entites: { include: { entite: true } },
        sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
    });

    if (!projet) return null;

    // Parser les champs JSON et aplatir les relations gouvernance
    return {
      ...projet,
      partiesPrenantes: projet.partiesPrenantes ? JSON.parse(projet.partiesPrenantes) : [],
      kpis: projet.kpis ? JSON.parse(projet.kpis) : [],
      objectifsStrategiques: projet.objectifsStrategiques ? JSON.parse(projet.objectifsStrategiques) : [],
      objectifsOperationnels: projet.objectifsOperationnels ? JSON.parse(projet.objectifsOperationnels) : [],
      sponsors: projet.sponsors.map((s) => s.user),
      chefsProjet: projet.chefsProjet.map((c) => c.user),
      techLeads: projet.techLeads.map((t) => t.user),
      equipe: projet.equipe.map((e) => e.user),
    };
  }

  async create(data: {
    nom: string;
    codeProjet: string;
    description?: string;
    tags?: string[];
    entiteIds?: string[];
    type?: string;
    nomClient?: string;
    statut?: string;
    priorite?: string;
    responsableId?: string;
    gestionnaireId?: string;
    dateDebut?: string;
    dateFinPrevue?: string;
    contexte?: string;
    mission?: string;
    vision?: string;
    scopeInclus?: string;
    scopeExclus?: string;
    sponsorIds?: string[];
    chefProjetIds?: string[];
    techLeadIds?: string[];
    equipeIds?: string[];
    partiesPrenantes?: any[];
    kpis?: string[];
    objectifsStrategiques?: string[];
    objectifsOperationnels?: string[];
  }) {
    const {
      entiteIds, sponsorIds, chefProjetIds, techLeadIds, equipeIds,
      partiesPrenantes, kpis, objectifsStrategiques, objectifsOperationnels,
      dateDebut, dateFinPrevue, ...projetData
    } = data;

    return prisma.projet.create({
      data: {
        ...projetData,
        statut: projetData.statut || 'en_preparation',
        type: projetData.type || 'interne',
        priorite: projetData.priorite || 'moyenne',
        dateDebut: dateDebut ? new Date(dateDebut) : undefined,
        dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : undefined,
        partiesPrenantes: partiesPrenantes ? JSON.stringify(partiesPrenantes) : undefined,
        kpis: kpis ? JSON.stringify(kpis) : undefined,
        objectifsStrategiques: objectifsStrategiques ? JSON.stringify(objectifsStrategiques) : undefined,
        objectifsOperationnels: objectifsOperationnels ? JSON.stringify(objectifsOperationnels) : undefined,
        entites: entiteIds?.length ? {
          create: entiteIds.map((entiteId) => ({ entiteId })),
        } : undefined,
        sponsors: sponsorIds?.length ? {
          create: sponsorIds.map((userId) => ({ userId })),
        } : undefined,
        chefsProjet: chefProjetIds?.length ? {
          create: chefProjetIds.map((userId) => ({ userId })),
        } : undefined,
        techLeads: techLeadIds?.length ? {
          create: techLeadIds.map((userId) => ({ userId })),
        } : undefined,
        equipe: equipeIds?.length ? {
          create: equipeIds.map((userId) => ({ userId })),
        } : undefined,
      },
      include: {
        entites: { include: { entite: { select: { id: true, nom: true, code: true } } } },
        sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
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
    nomClient?: string;
    statut?: string;
    priorite?: string;
    responsableId?: string;
    gestionnaireId?: string;
    dateDebut?: string;
    dateFinPrevue?: string;
    contexte?: string;
    mission?: string;
    vision?: string;
    scopeInclus?: string;
    scopeExclus?: string;
    sponsorIds?: string[];
    chefProjetIds?: string[];
    techLeadIds?: string[];
    equipeIds?: string[];
    partiesPrenantes?: any[];
    kpis?: string[];
    objectifsStrategiques?: string[];
    objectifsOperationnels?: string[];
  }) {
    const {
      entiteIds, sponsorIds, chefProjetIds, techLeadIds, equipeIds,
      partiesPrenantes, kpis, objectifsStrategiques, objectifsOperationnels,
      dateDebut, dateFinPrevue, ...updateData
    } = data;

    // Mettre à jour les relations entites si fournies
    if (entiteIds !== undefined) {
      await prisma.projetEntite.deleteMany({ where: { projetId: id } });
      if (entiteIds.length > 0) {
        await prisma.projetEntite.createMany({
          data: entiteIds.map((entiteId) => ({ projetId: id, entiteId })),
        });
      }
    }

    // Mettre à jour les relations gouvernance si fournies
    if (sponsorIds !== undefined) {
      await prisma.projetSponsor.deleteMany({ where: { projetId: id } });
      if (sponsorIds.length > 0) {
        await prisma.projetSponsor.createMany({
          data: sponsorIds.map((userId) => ({ projetId: id, userId })),
        });
      }
    }
    if (chefProjetIds !== undefined) {
      await prisma.projetChefProjet.deleteMany({ where: { projetId: id } });
      if (chefProjetIds.length > 0) {
        await prisma.projetChefProjet.createMany({
          data: chefProjetIds.map((userId) => ({ projetId: id, userId })),
        });
      }
    }
    if (techLeadIds !== undefined) {
      await prisma.projetTechLead.deleteMany({ where: { projetId: id } });
      if (techLeadIds.length > 0) {
        await prisma.projetTechLead.createMany({
          data: techLeadIds.map((userId) => ({ projetId: id, userId })),
        });
      }
    }
    if (equipeIds !== undefined) {
      await prisma.projetEquipe.deleteMany({ where: { projetId: id } });
      if (equipeIds.length > 0) {
        await prisma.projetEquipe.createMany({
          data: equipeIds.map((userId) => ({ projetId: id, userId })),
        });
      }
    }

    return prisma.projet.update({
      where: { id },
      data: {
        ...updateData,
        dateDebut: dateDebut ? new Date(dateDebut) : undefined,
        dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : undefined,
        partiesPrenantes: partiesPrenantes !== undefined ? JSON.stringify(partiesPrenantes) : undefined,
        kpis: kpis !== undefined ? JSON.stringify(kpis) : undefined,
        objectifsStrategiques: objectifsStrategiques !== undefined ? JSON.stringify(objectifsStrategiques) : undefined,
        objectifsOperationnels: objectifsOperationnels !== undefined ? JSON.stringify(objectifsOperationnels) : undefined,
      },
      include: {
        entites: { include: { entite: { select: { id: true, nom: true, code: true } } } },
        sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
        equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
  }

  async delete(id: string) {
    return prisma.projet.delete({ where: { id } });
  }
}
