import { randomBytes } from 'crypto';
import { prisma } from '../utils/prisma';
import { PermissionType } from '../generated/prisma/enums';

const TACHE_TERMINEES = ['termine', 'archive'] as const;

const projetListInclude = {
  entites: {
    include: { entite: { select: { id: true, nom: true, code: true } } },
  },
  sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  clientsFournisseurs: { include: { clientFournisseur: { include: { typeSociete: true, representants: true } } } },
  responsable: { select: { id: true, nom: true, prenom: true } },
  gestionnaire: { select: { id: true, nom: true, prenom: true } },
  createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
} as const;

export type ProjetAuth = { userId: string; role: string };

function isAdminRole(role: string) {
  return role === 'admin';
}

async function myPermTypesForProjet(projetId: string, userId: string): Promise<PermissionType[]> {
  const rows = await prisma.permission.findMany({
    where: { ressourceType: 'projet', ressourceId: projetId, userId },
    select: { permission: true },
  });
  return rows.map((r) => r.permission);
}

function isGovernanceMember(
  p: {
    responsableId: string | null;
    gestionnaireId: string | null;
    sponsors: { userId: string }[];
    chefsProjet: { userId: string }[];
    techLeads: { userId: string }[];
    equipe: { userId: string }[];
  },
  userId: string
) {
  if (p.responsableId === userId || p.gestionnaireId === userId) return true;
  return (
    p.sponsors.some((s) => s.userId === userId) ||
    p.chefsProjet.some((c) => c.userId === userId) ||
    p.techLeads.some((t) => t.userId === userId) ||
    p.equipe.some((e) => e.userId === userId)
  );
}

function canViewProjet(
  row: { id: string; createdById: string | null },
  auth: ProjetAuth,
  permTypes: PermissionType[],
  gov: boolean
) {
  if (isAdminRole(auth.role)) return true;
  if (row.createdById == null) return true;
  if (row.createdById === auth.userId) return true;
  if (gov) return true;
  return permTypes.length > 0;
}

function canModifyProjet(
  row: { createdById: string | null; responsableId: string | null; gestionnaireId: string | null },
  auth: ProjetAuth,
  permTypes: PermissionType[],
  gov: boolean
) {
  if (isAdminRole(auth.role)) return true;
  if (row.createdById === auth.userId) return true;
  if (row.responsableId === auth.userId || row.gestionnaireId === auth.userId) return true;
  if (gov) return true;
  return permTypes.some((t) => ['modification', 'suppression', 'gestion'].includes(t));
}

function canSoftDeleteProjet(row: { createdById: string | null }, auth: ProjetAuth, permTypes: PermissionType[]) {
  if (isAdminRole(auth.role)) return true;
  if (row.createdById === auth.userId) return true;
  return permTypes.some((t) => ['suppression', 'gestion'].includes(t));
}

function canManageProjetPermissions(row: { createdById: string | null }, auth: ProjetAuth, permTypes: PermissionType[]) {
  if (isAdminRole(auth.role)) return true;
  if (row.createdById === auth.userId) return true;
  return permTypes.includes('gestion');
}

function capabilitiesProjet(
  row: {
    id: string;
    createdById: string | null;
    responsableId: string | null;
    gestionnaireId: string | null;
  },
  auth: ProjetAuth,
  permTypes: PermissionType[],
  gov: boolean
) {
  const view = canViewProjet(row, auth, permTypes, gov);
  return {
    canView: view,
    canModify: view && canModifyProjet(row, auth, permTypes, gov),
    canDelete: view && canSoftDeleteProjet(row, auth, permTypes),
    canManagePermissions: view && canManageProjetPermissions(row, auth, permTypes),
  };
}

async function loadPermissionsForProjets(projetIds: string[]) {
  if (projetIds.length === 0) return new Map<string, any[]>();
  const rows = await prisma.permission.findMany({
    where: { ressourceType: 'projet', ressourceId: { in: projetIds } },
    include: {
      user: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
      grantedBy: { select: { id: true, nom: true, prenom: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const m = new Map<string, any[]>();
  for (const r of rows) {
    const list = m.get(r.ressourceId) ?? [];
    list.push(r);
    m.set(r.ressourceId, list);
  }
  return m;
}

async function enrichTachesEtDocuments(projetIds: string[]) {
  const empty = {
    tacheStats: new Map<string, Record<string, number>>(),
    tachesEnRetard: new Map<string, number>(),
    documentsByProjet: new Map<string, { id: string; nom: string }[]>(),
  };
  if (projetIds.length === 0) return empty;

  const [groupStatut, overdueGroups, docsNested] = await Promise.all([
    prisma.tache.groupBy({
      by: ['projetId', 'statut'],
      where: { projetId: { in: projetIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.tache.groupBy({
      by: ['projetId'],
      where: {
        projetId: { in: projetIds },
        deletedAt: null,
        dateFinApprox: { lt: new Date() },
        statut: { notIn: [...TACHE_TERMINEES] },
      },
      _count: { _all: true },
    }),
    Promise.all(
      projetIds.map((pid) =>
        prisma.document.findMany({
          where: { referenceType: 'projet', referenceId: pid, deletedAt: null },
          select: { id: true, nom: true },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        })
      )
    ),
  ]);

  const tacheStats = new Map<string, Record<string, number>>();
  for (const row of groupStatut) {
    if (!row.projetId) continue;
    const cur = tacheStats.get(row.projetId) ?? {};
    cur[row.statut] = row._count._all;
    tacheStats.set(row.projetId, cur);
  }

  const tachesEnRetard = new Map<string, number>();
  for (const row of overdueGroups) {
    if (row.projetId) tachesEnRetard.set(row.projetId, row._count._all);
  }

  const documentsByProjet = new Map<string, { id: string; nom: string }[]>();
  projetIds.forEach((pid, i) => {
    documentsByProjet.set(pid, docsNested[i].map((d) => ({ id: d.id, nom: d.nom })));
  });

  return { tacheStats, tachesEnRetard, documentsByProjet };
}

function buildAlertesProjet(p: {
  statut: string;
  dateFinPrevue: Date | null;
  tachesEnRetard: number;
}): string[] {
  const alertes: string[] = [];
  const now = Date.now();
  if (p.dateFinPrevue && p.statut !== 'termine') {
    const fin = new Date(p.dateFinPrevue).getTime();
    if (fin < now) {
      alertes.push('Échéance du projet dépassée');
    } else {
      const j = Math.ceil((fin - now) / 86400000);
      if (j <= 14 && j >= 0) {
        alertes.push(`Fin prévue dans ${j} jour${j > 1 ? 's' : ''}`);
      }
    }
  }
  if (p.tachesEnRetard > 0) {
    alertes.push(`${p.tachesEnRetard} tâche${p.tachesEnRetard > 1 ? 's' : ''} en retard`);
  }
  return alertes;
}

function mapProjetListItem(
  p: any,
  auth: ProjetAuth,
  permTypes: PermissionType[],
  perms: any[],
  enrich: {
    tacheStats: Map<string, Record<string, number>>;
    tachesEnRetard: Map<string, number>;
    documentsByProjet: Map<string, { id: string; nom: string }[]>;
  }
) {
  const gov = isGovernanceMember(p, auth.userId);
  const caps = capabilitiesProjet(
    {
      id: p.id,
      createdById: p.createdById,
      responsableId: p.responsableId,
      gestionnaireId: p.gestionnaireId,
    },
    auth,
    permTypes,
    gov
  );

  const stats = enrich.tacheStats.get(p.id) ?? {};
  const totalTaches = Object.values(stats).reduce((a, b) => a + b, 0);
  const terminees = (stats.termine ?? 0) + (stats.archive ?? 0);
  const enRetard = enrich.tachesEnRetard.get(p.id) ?? 0;
  const pctAvancement = totalTaches > 0 ? Math.round((terminees / totalTaches) * 100) : null;

  const alertes = buildAlertesProjet({
    statut: p.statut,
    dateFinPrevue: p.dateFinPrevue,
    tachesEnRetard: enRetard,
  });

  const delegMap = new Map<string, { user: any; permissions: PermissionType[]; permissionEntryIds: string[] }>();
  for (const r of perms) {
    const k = r.userId;
    if (!delegMap.has(k)) {
      delegMap.set(k, { user: r.user, permissions: [], permissionEntryIds: [] });
    }
    const e = delegMap.get(k)!;
    e.permissions.push(r.permission);
    e.permissionEntryIds.push(r.id);
  }
  const accesDelegations = Array.from(delegMap.values());

  return {
    ...p,
    partiesPrenantes: p.partiesPrenantes ? JSON.parse(p.partiesPrenantes) : [],
    kpis: p.kpis ? JSON.parse(p.kpis) : [],
    objectifsStrategiques: p.objectifsStrategiques ? JSON.parse(p.objectifsStrategiques) : [],
    objectifsOperationnels: p.objectifsOperationnels ? JSON.parse(p.objectifsOperationnels) : [],
    sponsorsData: p.sponsors.map((s: any) => s.user),
    chefsProjetData: p.chefsProjet.map((c: any) => c.user),
    techLeadsData: p.techLeads.map((t: any) => t.user),
    equipeData: p.equipe.map((e: any) => e.user),
    permissions: perms,
    capabilities: caps,
    accesApercu: { delegations: accesDelegations },
    tachesResume: {
      total: totalTaches,
      parStatut: stats,
      terminees,
      enRetard,
      avancementPct: pctAvancement,
    },
    documentsListe: enrich.documentsByProjet.get(p.id) ?? [],
    alertesProjet: alertes,
  };
}

export class ProjetService {
  private async ensureCodeProjet(userCode: string | undefined): Promise<string> {
    const trimmed = typeof userCode === 'string' ? userCode.trim() : '';
    if (trimmed) return trimmed;
    for (let i = 0; i < 12; i++) {
      const code = `PRJ-${Date.now()}-${randomBytes(2).toString('hex')}`.toUpperCase();
      const exists = await prisma.projet.findFirst({
        where: { codeProjet: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    return `PRJ-${randomBytes(6).toString('hex')}`.toUpperCase();
  }

  async findAll(
    filters: {
      statut?: string;
      entiteId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      priorite?: string;
      type?: string;
      /** ISO date (yyyy-mm-dd) : début de la période filtre (chevauchement avec la fenêtre projet dateDebut–dateFinPrevue). */
      periodeDebut?: string;
      /** ISO date (yyyy-mm-dd) : fin de la période filtre. */
      periodeFin?: string;
    },
    auth: ProjetAuth
  ) {
    const where: any = { deletedAt: null };
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

    const periodeDebut = filters?.periodeDebut?.trim();
    const periodeFin = filters?.periodeFin?.trim();
    const dateClauses: object[] = [];
    if (periodeDebut) {
      const start = new Date(`${periodeDebut}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) {
        dateClauses.push({
          OR: [{ dateFinPrevue: { gte: start } }, { dateFinPrevue: null }],
        });
      }
    }
    if (periodeFin) {
      const end = new Date(`${periodeFin}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) {
        dateClauses.push({
          OR: [{ dateDebut: { lte: end } }, { dateDebut: null }],
        });
      }
    }
    if (dateClauses.length) {
      where.AND = [...(where.AND ?? []), ...dateClauses];
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
      include: projetListInclude,
      orderBy,
    });

    const permMap = await loadPermissionsForProjets(projetList.map((p) => p.id));
    const visible = projetList.filter((p) => {
      const perms = permMap.get(p.id) ?? [];
      const permTypes = perms.map((x: any) => x.permission as PermissionType);
      const gov = isGovernanceMember(p, auth.userId);
      return canViewProjet({ id: p.id, createdById: p.createdById }, auth, permTypes, gov);
    });

    const enrich = await enrichTachesEtDocuments(visible.map((p) => p.id));

    return visible.map((p) => {
      const perms = permMap.get(p.id) ?? [];
      const permTypes = perms.map((x: any) => x.permission as PermissionType);
      return mapProjetListItem(p, auth, permTypes, perms, enrich);
    });
  }

  async getConsultationCount(id: string): Promise<number> {
    return prisma.journalAcces.count({
      where: { ressourceType: 'projet', ressourceId: id, action: 'lecture' },
    });
  }

  /** Même logique que la visibilité du détail projet (liste / findOne). */
  async canAccess(
    projetId: string,
    userId: string,
    userRole: string
  ): Promise<{ canAccess: boolean; reason?: string }> {
    const projet = await prisma.projet.findFirst({
      where: { id: projetId, deletedAt: null },
      select: {
        id: true,
        createdById: true,
        responsableId: true,
        gestionnaireId: true,
        sponsors: { select: { userId: true } },
        chefsProjet: { select: { userId: true } },
        techLeads: { select: { userId: true } },
        equipe: { select: { userId: true } },
      },
    });
    if (!projet) {
      return { canAccess: false, reason: 'Projet non trouvé' };
    }
    const permTypes = await myPermTypesForProjet(projetId, userId);
    const gov = isGovernanceMember(projet as any, userId);
    const ok = canViewProjet(
      { id: projet.id, createdById: projet.createdById },
      { userId, role: userRole },
      permTypes,
      gov
    );
    if (!ok) {
      return { canAccess: false, reason: 'Accès refusé à ce projet' };
    }
    return { canAccess: true };
  }

  async findOne(id: string, auth: ProjetAuth) {
    const projet = await prisma.projet.findFirst({
      where: { id, deletedAt: null },
      include: projetListInclude,
    });

    if (!projet) return null;

    const perms = (await loadPermissionsForProjets([id])).get(id) ?? [];
    const permTypes = perms.map((x: any) => x.permission as PermissionType);
    const gov = isGovernanceMember(projet, auth.userId);
    if (!canViewProjet({ id: projet.id, createdById: projet.createdById }, auth, permTypes, gov)) {
      return null;
    }

    const enrich = await enrichTachesEtDocuments([id]);
    return mapProjetListItem(projet, auth, permTypes, perms, enrich);
  }

  async getAccesDetail(projetId: string, auth: ProjetAuth) {
    const p = await prisma.projet.findFirst({
      where: { id: projetId, deletedAt: null },
      select: {
        id: true,
        nom: true,
        createdById: true,
        responsableId: true,
        gestionnaireId: true,
        sponsors: { select: { userId: true } },
        chefsProjet: { select: { userId: true } },
        techLeads: { select: { userId: true } },
        equipe: { select: { userId: true } },
      },
    });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    const gov = isGovernanceMember(p as any, auth.userId);
    if (!canViewProjet({ id: p.id, createdById: p.createdById }, auth, permTypes, gov)) throw new Error('FORBIDDEN');
    if (!canManageProjetPermissions({ createdById: p.createdById }, auth, permTypes)) throw new Error('FORBIDDEN');

    const admins = await prisma.user.findMany({
      where: { role: 'admin', statut: 'actif' },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    const creator = p.createdById
      ? await prisma.user.findUnique({
          where: { id: p.createdById },
          select: { id: true, nom: true, prenom: true, email: true, role: true },
        })
      : null;

    const raw = await prisma.permission.findMany({
      where: { ressourceType: 'projet', ressourceId: projetId },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
        grantedBy: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ficheNom: p.nom,
      admins,
      creator,
      delegations: raw.map((r) => ({
        id: r.id,
        permission: r.permission,
        user: r.user,
        grantedBy: r.grantedBy,
        createdAt: r.createdAt,
      })),
      canManagePermissions: true,
    };
  }

  async addPermission(projetId: string, targetUserId: string, permission: PermissionType, auth: ProjetAuth) {
    const p = await prisma.projet.findFirst({ where: { id: projetId, deletedAt: null } });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    if (!canManageProjetPermissions({ createdById: p.createdById }, auth, permTypes)) throw new Error('FORBIDDEN');

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    if (target.role === 'admin') throw new Error('Les administrateurs ont déjà tous les droits');
    if (p.createdById === targetUserId) throw new Error('Le créateur du projet a déjà tous les droits');

    return prisma.permission.create({
      data: {
        userId: targetUserId,
        ressourceType: 'projet',
        ressourceId: projetId,
        permission,
        grantedById: auth.userId,
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
        grantedBy: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async removePermission(projetId: string, permissionId: string, auth: ProjetAuth) {
    const p = await prisma.projet.findFirst({ where: { id: projetId, deletedAt: null } });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    if (!canManageProjetPermissions({ createdById: p.createdById }, auth, permTypes)) throw new Error('FORBIDDEN');

    const perm = await prisma.permission.findFirst({
      where: { id: permissionId, ressourceType: 'projet', ressourceId: projetId },
    });
    if (!perm) throw new Error('NOT_FOUND');
    await prisma.permission.delete({ where: { id: permissionId } });
  }

  async softDelete(id: string, auth: ProjetAuth) {
    const existing = await prisma.projet.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Projet non trouvé');
    const permTypes = await myPermTypesForProjet(id, auth.userId);
    if (!canSoftDeleteProjet({ createdById: existing.createdById }, auth, permTypes)) {
      throw new Error('Accès refusé');
    }
    await prisma.projet.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreFromCorbeille(id: string) {
    const row = await prisma.projet.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!row) throw new Error('Élément introuvable ou non en corbeille');
    return prisma.projet.update({
      where: { id },
      data: { deletedAt: null },
      include: projetListInclude,
    });
  }

  async deletePermanent(id: string) {
    const row = await prisma.projet.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!row) throw new Error('Élément introuvable ou non en corbeille');
    await prisma.permission.deleteMany({ where: { ressourceType: 'projet', ressourceId: id } });
    return prisma.projet.delete({ where: { id } });
  }

  async listDeletedForCorbeille() {
    return prisma.projet.findMany({
      where: { deletedAt: { not: null } },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  /** Corbeille projets : tout pour l’admin, sinon uniquement les projets créés par l’utilisateur (aligné licences). */
  async listDeletedForCorbeilleScoped(auth: ProjetAuth) {
    const where: any = { deletedAt: { not: null } };
    if (!isAdminRole(auth.role)) {
      where.createdById = auth.userId;
    }
    return prisma.projet.findMany({
      where,
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async create(
    data: {
      nom: string;
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
      clientFournisseurId?: string;
    },
    auth: ProjetAuth
  ) {
    const {
      entiteIds,
      sponsorIds,
      chefProjetIds,
      techLeadIds,
      equipeIds,
      partiesPrenantes,
      kpis,
      objectifsStrategiques,
      objectifsOperationnels,
      dateDebut,
      dateFinPrevue,
      codeProjet: rawCodeProjet,
      clientFournisseurId,
      ...projetData
    } = data;

    const codeProjet = await this.ensureCodeProjet(rawCodeProjet);

    let nomClient = projetData.nomClient;
    if (clientFournisseurId) {
      const cf = await prisma.clientFournisseur.findUnique({
        where: { id: clientFournisseurId },
        select: { nom: true },
      });
      if (!cf) {
        throw new Error('Fiche client / fournisseur introuvable.');
      }
      if (!nomClient || !String(nomClient).trim()) {
        nomClient = cf.nom;
      }
    }

    return prisma.$transaction(async (tx) => {
      const projet = await tx.projet.create({
        data: {
          ...projetData,
          nomClient: nomClient ?? undefined,
          codeProjet,
          statut: projetData.statut || 'en_preparation',
          type: projetData.type || 'interne',
          priorite: projetData.priorite || 'moyenne',
          dateDebut: dateDebut ? new Date(dateDebut) : undefined,
          dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : undefined,
          partiesPrenantes: partiesPrenantes ? JSON.stringify(partiesPrenantes) : undefined,
          kpis: kpis ? JSON.stringify(kpis) : undefined,
          objectifsStrategiques: objectifsStrategiques ? JSON.stringify(objectifsStrategiques) : undefined,
          objectifsOperationnels: objectifsOperationnels ? JSON.stringify(objectifsOperationnels) : undefined,
          createdById: auth.userId,
          entites: entiteIds?.length
            ? {
                create: entiteIds.map((entiteId) => ({ entiteId })),
              }
            : undefined,
          sponsors: sponsorIds?.length
            ? {
                create: sponsorIds.map((userId) => ({ userId })),
              }
            : undefined,
          chefsProjet: chefProjetIds?.length
            ? {
                create: chefProjetIds.map((userId) => ({ userId })),
              }
            : undefined,
          techLeads: techLeadIds?.length
            ? {
                create: techLeadIds.map((userId) => ({ userId })),
              }
            : undefined,
          equipe: equipeIds?.length
            ? {
                create: equipeIds.map((userId) => ({ userId })),
              }
            : undefined,
        },
        include: projetListInclude,
      });

      if (clientFournisseurId) {
        await tx.clientFournisseurProjet.create({
          data: { clientFournisseurId, projetId: projet.id },
        });
      }

      return tx.projet.findUniqueOrThrow({
        where: { id: projet.id },
        include: projetListInclude,
      });
    });
  }

  async update(
    id: string,
    data: {
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
    },
    auth: ProjetAuth
  ) {
    const existing = await prisma.projet.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Projet non trouvé');
    const permTypes = await myPermTypesForProjet(id, auth.userId);
    const gov = isGovernanceMember(existing as any, auth.userId);
    if (!canModifyProjet(existing as any, auth, permTypes, gov)) {
      throw new Error('Accès refusé');
    }

    const {
      entiteIds,
      sponsorIds,
      chefProjetIds,
      techLeadIds,
      equipeIds,
      partiesPrenantes,
      kpis,
      objectifsStrategiques,
      objectifsOperationnels,
      dateDebut,
      dateFinPrevue,
      ...updateData
    } = data;

    if (entiteIds !== undefined) {
      await prisma.projetEntite.deleteMany({ where: { projetId: id } });
      if (entiteIds.length > 0) {
        await prisma.projetEntite.createMany({
          data: entiteIds.map((entiteId) => ({ projetId: id, entiteId })),
        });
      }
    }

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
      include: projetListInclude,
    });
  }

  /** @deprecated Utiliser softDelete — conservé pour compat éventuelle */
  async delete(id: string) {
    return prisma.projet.delete({ where: { id } });
  }
}
