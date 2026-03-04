import { prisma } from '../utils/prisma';

export class DashboardService {
  async getKPIs(userId?: string, userRole?: string) {
    // Si lecteur ou contributeur, filtrer par leurs entités
    let whereClause: any = {};
    if (userRole === 'lecteur' || userRole === 'contributeur') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          entitesMembres: {
            select: {
              entiteId: true,
            },
          },
        },
      });
      if (user?.entitesMembres && user.entitesMembres.length > 0) {
        const entiteIds = user.entitesMembres.map((ue) => ue.entiteId);
        whereClause = {
          entites: {
            some: {
              entite: {
                id: {
                  in: entiteIds,
                },
              },
            },
          },
        };
      } else {
        whereClause = { id: { in: [] } };
      }
    }

    // Pour les entités, filtrer aussi pour les lecteurs/contributeurs
    let entitesWhereClause: any = {};
    if (userRole === 'lecteur' || userRole === 'contributeur') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          entitesMembres: {
            select: {
              entiteId: true,
            },
          },
        },
      });
      if (user?.entitesMembres && user.entitesMembres.length > 0) {
        const entiteIds = user.entitesMembres.map((ue) => ue.entiteId);
        entitesWhereClause = {
          id: {
            in: entiteIds,
          },
        };
      } else {
        entitesWhereClause = { id: { in: [] } };
      }
    }

    const [
      processusTotal, 
      processusParStatut, 
      projetsActifs, 
      documentsRecents, 
      utilisateursActifs, 
      entitesTotal, 
      entitesAvecMembres, 
      documentsPlusVisualises, 
      documentsPlusTelecharges
    ] = await Promise.all([
      prisma.processus.count({ where: whereClause }),
      prisma.processus.groupBy({
        by: ['statut'],
        where: whereClause,
        _count: true,
      }),
      prisma.processus.count({
        where: { 
          ...whereClause,
          statut: 'actif',
        },
      }),
      prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { nom: true, prenom: true } },
        },
      }),
      prisma.user.count({
        where: {
          statut: 'actif',
          derniereConnexion: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.entite.count({ where: entitesWhereClause }),
      prisma.entite.findMany({
        where: entitesWhereClause,
        select: {
          id: true,
          nom: true,
          code: true,
          _count: { select: { membres: true } },
        },
      }),
      prisma.journalAcces.groupBy({
        by: ['ressourceId'],
        where: { ressourceType: 'document', action: 'lecture' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.journalAcces.groupBy({
        by: ['ressourceId'],
        where: { ressourceType: 'document', action: 'telechargement' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const parStatut: Record<string, number> = {};
    processusParStatut.forEach((item) => {
      parStatut[item.statut] = item._count;
    });

    const documentsVisualisesIds = documentsPlusVisualises.map((item) => item.ressourceId).filter(Boolean) as string[];
    const documentsVisualisesDetails = documentsVisualisesIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: documentsVisualisesIds } },
          select: {
            id: true,
            nom: true,
            typeDocument: true,
            uploadedBy: { select: { nom: true, prenom: true } },
          },
        })
      : [];

    const visualisationsMap = new Map(documentsPlusVisualises.map((item) => [item.ressourceId, item._count.id]));

    const documentsTelechargesIds = documentsPlusTelecharges.map((item) => item.ressourceId).filter(Boolean) as string[];
    const documentsTelechargesDetails = documentsTelechargesIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: documentsTelechargesIds } },
          select: {
            id: true,
            nom: true,
            typeDocument: true,
            uploadedBy: { select: { nom: true, prenom: true } },
          },
        })
      : [];

    const telechargementsMap = new Map(documentsPlusTelecharges.map((item) => [item.ressourceId, item._count.id]));

    const documentsVisualisesTries = documentsVisualisesDetails
      .map((doc) => ({
        ...doc,
        nombreVisualisations: visualisationsMap.get(doc.id) || 0,
      }))
      .sort((a, b) => b.nombreVisualisations - a.nombreVisualisations);

    const documentsTelechargesTries = documentsTelechargesDetails
      .map((doc) => ({
        ...doc,
        nombreTelechargements: telechargementsMap.get(doc.id) || 0,
      }))
      .sort((a, b) => b.nombreTelechargements - a.nombreTelechargements);

    return {
      processus: { total: processusTotal, parStatut },
      projets: { actifs: projetsActifs },
      documentsRecents: documentsRecents.map((d) => ({
        id: d.id,
        nom: d.nom,
        typeDocument: d.typeDocument,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt,
      })),
      utilisateursActifs,
      entitesTotal,
      entitesMembres: entitesAvecMembres,
      documentsPlusVisualises: documentsVisualisesTries,
      documentsPlusTelecharges: documentsTelechargesTries,
    };
  }
}