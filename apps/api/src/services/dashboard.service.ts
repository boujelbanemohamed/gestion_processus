import { prisma } from '../utils/prisma';

const JOURS_ACTIVITE_PROJET = 30;

export class DashboardService {
  /** Top projets : sur 30 jours, actions journal (projet) + tches mises  jour ; complt par `updatedAt` si besoin. */
  private async getProjetsPlusActifs(projetWhere: any) {
    const depuis = new Date(Date.now() - JOURS_ACTIVITE_PROJET * 24 * 60 * 60 * 1000);
    const visibles = await prisma.projet.findMany({
      where: projetWhere,
      select: { id: true },
    });
    const ids = visibles.map((p) => p.id);
    if (ids.length === 0) return [];

    const [journalParProjet, tachesParProjet] = await Promise.all([
      prisma.journalAcces.groupBy({
        by: ['ressourceId'],
        where: {
          ressourceType: 'projet',
          ressourceId: { in: ids },
          timestamp: { gte: depuis },
        },
        _count: { id: true },
      }),
      prisma.tache.groupBy({
        by: ['projetId'],
        where: {
          projetId: { in: ids },
          updatedAt: { gte: depuis },
        },
        _count: { id: true },
      }),
    ]);

    const scoreMap = new Map<string, { j: number; t: number }>();
    for (const row of journalParProjet) {
      const rid = row.ressourceId;
      if (!rid) continue;
      scoreMap.set(rid, { j: row._count.id, t: scoreMap.get(rid)?.t ?? 0 });
    }
    for (const row of tachesParProjet) {
      const pid = row.projetId;
      if (!pid) continue;
      const cur = scoreMap.get(pid) ?? { j: 0, t: 0 };
      scoreMap.set(pid, { j: cur.j, t: row._count.id });
    }

    const scored = [...scoreMap.entries()]
      .map(([id, { j, t }]) => ({ id, score: j + t }))
      .sort((a, b) => b.score - a.score);

    let topIds = scored.filter((s) => s.score > 0).slice(0, 5).map((s) => s.id);

    if (topIds.length < 5) {
      const complement = await prisma.projet.findMany({
        where: {
          ...projetWhere,
          ...(topIds.length ? { id: { notIn: topIds } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 5 - topIds.length,
        select: { id: true },
      });
      topIds = [...topIds, ...complement.map((p) => p.id)];
    }

    const projets = await prisma.projet.findMany({
      where: { id: { in: topIds } },
      select: { id: true, nom: true, codeProjet: true, statut: true },
    });
    const byId = new Map(projets.map((p) => [p.id, p]));

    return topIds
      .map((id) => {
        const p = byId.get(id);
        if (!p) return null;
        const s = scoreMap.get(id) ?? { j: 0, t: 0 };
        return {
          id: p.id,
          nom: p.nom,
          codeProjet: p.codeProjet,
          statut: p.statut,
          scoreActivite: s.j + s.t,
          consultationsJournal: s.j,
          tachesMisesAJour: s.t,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        nom: string;
        codeProjet: string;
        statut: string;
        scoreActivite: number;
        consultationsJournal: number;
        tachesMisesAJour: number;
      }>;
  }

  async getKPIs(userId?: string, userRole?: string) {
    let whereClause: any = {};
    let entitesWhereClause: any = {};
    let projetWhereClause: any = {};

    if (userRole === 'lecteur' || userRole === 'contributeur') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          entitesMembres: {
            select: { entiteId: true },
          },
        },
      });
      if (user?.entitesMembres && user.entitesMembres.length > 0) {
        const entiteIds = user.entitesMembres.map((ue) => ue.entiteId);
        whereClause = {
          entites: {
            some: {
              entite: {
                id: { in: entiteIds },
              },
            },
          },
        };
        entitesWhereClause = { id: { in: entiteIds } };
        projetWhereClause = {
          entites: { some: { entiteId: { in: entiteIds } } },
        };
      } else {
        whereClause = { id: { in: [] } };
        entitesWhereClause = { id: { in: [] } };
        projetWhereClause = { id: { in: [] } };
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
      prisma.projet.groupBy({
        by: ['statut'],
        _count: true,
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
    const projetsParStatutMap: Record<string, number> = {};
    projetsActifs.forEach((item: any) => {
      projetsParStatutMap[item.statut] = item._count;
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

    const projetsPlusActifs = await this.getProjetsPlusActifs(projetWhereClause);

    return {
      processus: { total: processusTotal, parStatut },
      projets: { actifs: Object.values(projetsParStatutMap).reduce((a, b) => a + b, 0), parStatut: projetsParStatutMap },
      projetsPlusActifs,
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