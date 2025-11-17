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
        // Si l'utilisateur n'a pas d'entités, retourner des résultats vides
        whereClause = { id: { in: [] } }; // Condition qui ne retournera rien
      }
    }

    // Pour les entités, on doit aussi filtrer pour les lecteurs/contributeurs
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
        entitesWhereClause = { id: { in: [] } }; // Condition qui ne retournera rien
      }
    }

    const [processusTotal, processusParStatut, projetsActifs, documentsRecents, utilisateursActifs, entitesTotal, entitesAvecMembres] = await Promise.all([
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
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
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
    ]);

    const parStatut: Record<string, number> = {};
    processusParStatut.forEach((item) => {
      parStatut[item.statut] = item._count;
    });

    return {
      processus: {
        total: processusTotal,
        parStatut,
      },
      projets: {
        actifs: projetsActifs,
      },
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
    };
  }
}
