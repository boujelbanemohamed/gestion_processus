import { randomBytes } from 'crypto';
import { prisma } from '../utils/prisma';
import { PermissionType } from '../generated/prisma/enums';
import { fetchProjetAdminExcludedByProjetIds, fetchProjetAdminExcludedForUser } from '../utils/resourceAdminSansAcces';

const TACHE_TERMINEES = ['termine', 'archive'] as const;

/** Champs scalaires autorisés pour `projet.update` (ignore tout le reste du body client). */
const PROJET_UPDATABLE_SCALAR_KEYS = new Set([
  'nom',
  'codeProjet',
  'description',
  'tags',
  'type',
  'nomClient',
  'statut',
  'priorite',
  'dateFinReelle',
  'budgetPrevu',
  'budgetConsomme',
  'deviseId',
  'responsableId',
  'gestionnaireId',
  'contexte',
  'mission',
  'vision',
  'scopeInclus',
  'scopeExclus',
]);

function pickProjetScalarUpdateData(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PROJET_UPDATABLE_SCALAR_KEYS) {
    if (key in raw && raw[key] !== undefined) {
      out[key] = raw[key];
    }
  }
  return out;
}

/** Montant budget : chaîne vide / invalide → null ; sinon valeur numérique pour Prisma Decimal. */
function parseBudgetDecimalInput(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return s;
}

async function sanitizeProjetScalarUpdateData(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out = { ...payload };
  if ('budgetPrevu' in out) {
    out.budgetPrevu = parseBudgetDecimalInput(out.budgetPrevu);
  }
  if ('budgetConsomme' in out) {
    out.budgetConsomme = parseBudgetDecimalInput(out.budgetConsomme);
  }
  if ('deviseId' in out) {
    const v = out.deviseId;
    if (v === null || v === '') {
      out.deviseId = null;
    } else {
      const id = String(v).trim();
      const d = await prisma.devise.findUnique({ where: { id }, select: { id: true } });
      if (!d) throw new Error('Devise introuvable');
      out.deviseId = id;
    }
  }
  return out;
}

const projetListInclude = {
  entites: {
    include: { entite: { select: { id: true, nom: true, code: true } } },
  },
  sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
  clientsFournisseurs: { include: { clientFournisseur: { include: { typeSociete: true, representants: true } } } },
  devise: { select: { id: true, code: true, libelle: true } },
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
    sponsors?: { userId: string }[] | null;
    chefsProjet?: { userId: string }[] | null;
    techLeads?: { userId: string }[] | null;
    equipe?: { userId: string }[] | null;
  },
  userId: string
) {
  if (p.responsableId === userId || p.gestionnaireId === userId) return true;
  const sponsors = p.sponsors ?? [];
  const chefsProjet = p.chefsProjet ?? [];
  const techLeads = p.techLeads ?? [];
  const equipe = p.equipe ?? [];
  return (
    sponsors.some((s) => s.userId === userId) ||
    chefsProjet.some((c) => c.userId === userId) ||
    techLeads.some((t) => t.userId === userId) ||
    equipe.some((e) => e.userId === userId)
  );
}

function canViewProjet(
  row: { id: string; createdById: string | null },
  auth: ProjetAuth,
  permTypes: PermissionType[],
  gov: boolean,
  adminImplicitRefused: boolean
) {
  if (isAdminRole(auth.role)) {
    if (row.createdById === auth.userId) return true;
    if (gov) return true;
    if (adminImplicitRefused && (permTypes ?? []).length === 0) return false;
    return true;
  }
  if (row.createdById == null) return true;
  if (row.createdById === auth.userId) return true;
  if (gov) return true;
  return (permTypes ?? []).length > 0;
}

function canModifyProjet(
  row: { createdById: string | null; responsableId: string | null; gestionnaireId: string | null },
  auth: ProjetAuth,
  permTypes: PermissionType[],
  gov: boolean,
  adminImplicitRefused: boolean
) {
  if (isAdminRole(auth.role)) {
    if (row.createdById === auth.userId) return true;
    if (row.responsableId === auth.userId || row.gestionnaireId === auth.userId) return true;
    if (gov) return true;
    if (adminImplicitRefused) {
      return (permTypes ?? []).some((t) => ['modification', 'suppression', 'gestion'].includes(t));
    }
    return true;
  }
  if (row.createdById === auth.userId) return true;
  if (row.responsableId === auth.userId || row.gestionnaireId === auth.userId) return true;
  if (gov) return true;
  const perms = permTypes ?? [];
  return perms.some((t) => ['modification', 'suppression', 'gestion'].includes(t));
}

function canSoftDeleteProjet(
  row: { createdById: string | null },
  auth: ProjetAuth,
  permTypes: PermissionType[],
  adminImplicitRefused: boolean
) {
  if (isAdminRole(auth.role)) {
    if (row.createdById === auth.userId) return true;
    if (adminImplicitRefused) {
      return (permTypes ?? []).some((t) => ['suppression', 'gestion'].includes(t));
    }
    return true;
  }
  if (row.createdById === auth.userId) return true;
  const perms = permTypes ?? [];
  return perms.some((t) => ['suppression', 'gestion'].includes(t));
}

/** Utilisateur de référence pour les droits d’accès (créateur enregistré, sinon responsable, sinon gestionnaire). */
function projetAccesOwnerUserId(row: {
  createdById: string | null;
  responsableId?: string | null;
  gestionnaireId?: string | null;
}): string | null {
  if (row.createdById) return row.createdById;
  return row.responsableId ?? row.gestionnaireId ?? null;
}

/** Propriétaire métier des accès ou délégation « gestion » (admin implicite ne gère pas les accès — aligné contrat). */
function canManageProjetPermissions(
  row: { createdById: string | null; responsableId?: string | null; gestionnaireId?: string | null },
  auth: ProjetAuth,
  permTypes: PermissionType[]
) {
  const ownerId = projetAccesOwnerUserId(row);
  if (ownerId === auth.userId) return true;
  return (permTypes ?? []).includes('gestion');
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
  gov: boolean,
  adminImplicitRefused: boolean
) {
  const view = canViewProjet(row, auth, permTypes, gov, adminImplicitRefused);
  return {
    canView: view,
    canModify: view && canModifyProjet(row, auth, permTypes, gov, adminImplicitRefused),
    canDelete: view && canSoftDeleteProjet(row, auth, permTypes, adminImplicitRefused),
    canManagePermissions: view && canManageProjetPermissions(row, auth, permTypes),
  };
}

async function maybeExcludeAdminAfterProjetPermissionRemoved(
  projetId: string,
  projetAccesOwnerId: string | null,
  targetUserId: string
) {
  if (projetAccesOwnerId && targetUserId === projetAccesOwnerId) return;
  const u = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (u?.role !== 'admin') return;
  const remaining = await prisma.permission.count({
    where: { ressourceType: 'projet', ressourceId: projetId, userId: targetUserId },
  });
  if (remaining > 0) return;
  try {
    await prisma.projetAdminSansAcces.upsert({
      where: { projetId_userId: { projetId, userId: targetUserId } },
      create: { projetId, userId: targetUserId },
      update: {},
    });
  } catch {
    /* table absente */
  }
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
  adminImplicitRefused: boolean,
  adminSansAccesUserIds: string[],
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
    gov,
    adminImplicitRefused
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
    adminSansAccesUserIds,
    partiesPrenantes: p.partiesPrenantes ? JSON.parse(p.partiesPrenantes) : [],
    kpis: p.kpis ? JSON.parse(p.kpis) : [],
    objectifsStrategiques: p.objectifsStrategiques ? JSON.parse(p.objectifsStrategiques) : [],
    objectifsOperationnels: p.objectifsOperationnels ? JSON.parse(p.objectifsOperationnels) : [],
    sponsorsData: (p.sponsors ?? []).map((s: any) => s.user),
    chefsProjetData: (p.chefsProjet ?? []).map((c: any) => c.user),
    techLeadsData: (p.techLeads ?? []).map((t: any) => t.user),
    equipeData: (p.equipe ?? []).map((e: any) => e.user),
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
  private async collectDerivedProjetIntervenantUserIds(
    tx: typeof prisma,
    projetId: string
  ): Promise<string[]> {
    const rows = await tx.tache.findMany({
      where: {
        deletedAt: null,
        OR: [
          { projetId },
          { userStory: { is: { epic: { is: { projetId, deletedAt: null } }, deletedAt: null } } },
        ],
      },
      select: {
        assignesUtilisateurs: { select: { userId: true } },
      },
    });
    const ids = new Set<string>();
    for (const t of rows) {
      for (const au of t.assignesUtilisateurs || []) {
        if (au.userId) ids.add(au.userId);
      }
    }
    return [...ids];
  }

  private async syncDerivedGovernanceAndEntites(tx: typeof prisma, projetId: string): Promise<void> {
    const projet = await tx.projet.findUnique({
      where: { id: projetId },
      select: {
        id: true,
        sponsors: { select: { userId: true } },
        chefsProjet: { select: { userId: true } },
        techLeads: { select: { userId: true } },
        equipe: { select: { userId: true } },
      },
    });
    if (!projet) return;

    // 1) Intervenants auto depuis les tâches du projet (directes ou via userStory->epic)
    const derivedTaskUsers = await this.collectDerivedProjetIntervenantUserIds(tx, projetId);
    if (derivedTaskUsers.length > 0) {
      const existingEquipe = new Set((projet.equipe || []).map((e) => e.userId));
      const toAddEquipe = derivedTaskUsers.filter((uid) => !existingEquipe.has(uid));
      if (toAddEquipe.length > 0) {
        await tx.projetEquipe.createMany({
          data: toAddEquipe.map((userId) => ({ projetId, userId })),
          skipDuplicates: true,
        });
      }
    }

    // 2) Déduire les entités depuis tous les utilisateurs de gouvernance/intervenants
    const allGovUserIds = new Set<string>([
      ...(projet.sponsors || []).map((x) => x.userId),
      ...(projet.chefsProjet || []).map((x) => x.userId),
      ...(projet.techLeads || []).map((x) => x.userId),
      ...(projet.equipe || []).map((x) => x.userId),
      ...derivedTaskUsers,
    ]);
    const govIds = [...allGovUserIds];
    if (govIds.length === 0) return;

    const userEntites = await tx.userEntite.findMany({
      where: { userId: { in: govIds } },
      select: { entiteId: true },
    });
    const entiteIds = [...new Set(userEntites.map((x) => x.entiteId).filter(Boolean))];
    if (entiteIds.length === 0) return;

    await tx.projetEntite.createMany({
      data: entiteIds.map((entiteId) => ({ projetId, entiteId })),
      skipDuplicates: true,
    });
  }

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
    const adminExcludedForViewer = await fetchProjetAdminExcludedForUser(
      auth.userId,
      projetList.map((p) => p.id)
    );
    const visible = projetList.filter((p) => {
      const perms = permMap.get(p.id) ?? [];
      const permTypes = perms.map((x: any) => x.permission as PermissionType);
      const gov = isGovernanceMember(p, auth.userId);
      return canViewProjet(
        { id: p.id, createdById: p.createdById },
        auth,
        permTypes,
        gov,
        adminExcludedForViewer.has(p.id)
      );
    });

    const enrich = await enrichTachesEtDocuments(visible.map((p) => p.id));
    const adminExclAll = await fetchProjetAdminExcludedByProjetIds(visible.map((p) => p.id));

    return visible.map((p) => {
      const perms = permMap.get(p.id) ?? [];
      const permTypes = perms.map((x: any) => x.permission as PermissionType);
      return mapProjetListItem(
        p,
        auth,
        permTypes,
        perms,
        adminExcludedForViewer.has(p.id),
        adminExclAll.get(p.id) ?? [],
        enrich
      );
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
    const adminExcl = await fetchProjetAdminExcludedForUser(userId, [projet.id]);
    const ok = canViewProjet(
      { id: projet.id, createdById: projet.createdById },
      { userId, role: userRole },
      permTypes,
      gov,
      adminExcl.has(projet.id)
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
    const adminExclViewer = await fetchProjetAdminExcludedForUser(auth.userId, [id]);
    const adminImplicitRefused = adminExclViewer.has(id);
    if (!canViewProjet({ id: projet.id, createdById: projet.createdById }, auth, permTypes, gov, adminImplicitRefused)) {
      return null;
    }

    const enrich = await enrichTachesEtDocuments([id]);
    const adminExclAll = await fetchProjetAdminExcludedByProjetIds([id]);
    return mapProjetListItem(
      projet,
      auth,
      permTypes,
      perms,
      adminImplicitRefused,
      adminExclAll.get(id) ?? [],
      enrich
    );
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
    const adminExclViewer = await fetchProjetAdminExcludedForUser(auth.userId, [projetId]);
    if (!canViewProjet({ id: p.id, createdById: p.createdById }, auth, permTypes, gov, adminExclViewer.has(projetId))) {
      throw new Error('FORBIDDEN');
    }

    const admins = await prisma.user.findMany({
      where: { role: 'admin', statut: 'actif' },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    const ownerId = projetAccesOwnerUserId(p);
    const creator = ownerId
      ? await prisma.user.findUnique({
          where: { id: ownerId },
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

    let adminSansAccesUserIds: string[] = [];
    try {
      adminSansAccesUserIds = (
        await prisma.projetAdminSansAcces.findMany({
          where: { projetId },
          select: { userId: true },
        })
      ).map((x) => x.userId);
    } catch {
      /* table absente */
    }

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
      canManagePermissions: canManageProjetPermissions(
        { createdById: p.createdById, responsableId: p.responsableId, gestionnaireId: p.gestionnaireId },
        auth,
        permTypes
      ),
      adminSansAccesUserIds,
    };
  }

  async addPermission(projetId: string, targetUserId: string, permission: PermissionType, auth: ProjetAuth) {
    const p = await prisma.projet.findFirst({
      where: { id: projetId, deletedAt: null },
      select: { createdById: true, responsableId: true, gestionnaireId: true },
    });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    if (!canManageProjetPermissions(p, auth, permTypes)) throw new Error('FORBIDDEN');

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    const ownerId = projetAccesOwnerUserId(p);
    if (ownerId === targetUserId) throw new Error('Le créateur du projet a déjà tous les droits');

    try {
      await prisma.projetAdminSansAcces.deleteMany({ where: { projetId, userId: targetUserId } });
    } catch {
      /* table absente */
    }

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
    const p = await prisma.projet.findFirst({
      where: { id: projetId, deletedAt: null },
      select: { createdById: true, responsableId: true, gestionnaireId: true },
    });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    if (!canManageProjetPermissions(p, auth, permTypes)) throw new Error('FORBIDDEN');

    const perm = await prisma.permission.findFirst({
      where: { id: permissionId, ressourceType: 'projet', ressourceId: projetId },
    });
    if (!perm) throw new Error('NOT_FOUND');
    const targetUserId = perm.userId;
    await prisma.permission.delete({ where: { id: permissionId } });
    await maybeExcludeAdminAfterProjetPermissionRemoved(projetId, projetAccesOwnerUserId(p), targetUserId);
  }

  async blockAdminImplicitAccess(projetId: string, targetUserId: string, auth: ProjetAuth) {
    const p = await prisma.projet.findFirst({
      where: { id: projetId, deletedAt: null },
      select: { createdById: true, responsableId: true, gestionnaireId: true },
    });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    if (!canManageProjetPermissions(p, auth, permTypes)) throw new Error('FORBIDDEN');
    const ownerId = projetAccesOwnerUserId(p);
    if (ownerId === targetUserId) throw new Error('Le créateur du projet ne peut pas être exclu');
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    if (target.role !== 'admin') {
      throw new Error("Seuls les comptes administrateur peuvent être privés de l'accès implicite au projet");
    }
    await prisma.permission.deleteMany({
      where: { ressourceType: 'projet', ressourceId: projetId, userId: targetUserId },
    });
    try {
      await prisma.projetAdminSansAcces.upsert({
        where: { projetId_userId: { projetId, userId: targetUserId } },
        create: { projetId, userId: targetUserId },
        update: {},
      });
    } catch {
      throw new Error(
        "Impossible d'enregistrer l'exclusion admin : table absente. Exécutez « prisma migrate deploy » sur l'API."
      );
    }
  }

  async restoreAdminImplicitAccess(projetId: string, targetUserId: string, auth: ProjetAuth) {
    const p = await prisma.projet.findFirst({
      where: { id: projetId, deletedAt: null },
      select: { createdById: true, responsableId: true, gestionnaireId: true },
    });
    if (!p) throw new Error('NOT_FOUND');
    const permTypes = await myPermTypesForProjet(projetId, auth.userId);
    if (!canManageProjetPermissions(p, auth, permTypes)) throw new Error('FORBIDDEN');
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    try {
      await prisma.projetAdminSansAcces.deleteMany({ where: { projetId, userId: targetUserId } });
    } catch {
      throw new Error(
        "Impossible de restaurer l'accès : table absente. Exécutez « prisma migrate deploy » sur l'API."
      );
    }
  }

  async softDelete(id: string, auth: ProjetAuth) {
    const existing = await prisma.projet.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Projet non trouvé');
    const permTypes = await myPermTypesForProjet(id, auth.userId);
    const adminExcl = await fetchProjetAdminExcludedForUser(auth.userId, [id]);
    if (!canSoftDeleteProjet({ createdById: existing.createdById }, auth, permTypes, adminExcl.has(id))) {
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
    try {
      await prisma.projetAdminSansAcces.deleteMany({ where: { projetId: id } });
    } catch {
      /* table absente */
    }
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
      budgetPrevu?: string | number | null;
      budgetConsomme?: string | number | null;
      deviseId?: string | null;
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
      budgetPrevu,
      budgetConsomme,
      deviseId,
      ...projetData
    } = data;

    const codeProjet = await this.ensureCodeProjet(rawCodeProjet);

    let resolvedDeviseId: string | null | undefined;
    if (deviseId === undefined) {
      resolvedDeviseId = undefined;
    } else if (deviseId === null || deviseId === '') {
      resolvedDeviseId = null;
    } else {
      const id = String(deviseId).trim();
      const d = await prisma.devise.findUnique({ where: { id }, select: { id: true } });
      if (!d) throw new Error('Devise introuvable');
      resolvedDeviseId = id;
    }

    const budgetPrevuVal =
      budgetPrevu === undefined ? undefined : parseBudgetDecimalInput(budgetPrevu);
    const budgetConsommeVal =
      budgetConsomme === undefined ? undefined : parseBudgetDecimalInput(budgetConsomme);

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
          ...(budgetPrevuVal !== undefined ? { budgetPrevu: budgetPrevuVal } : {}),
          ...(budgetConsommeVal !== undefined ? { budgetConsomme: budgetConsommeVal } : {}),
          ...(resolvedDeviseId !== undefined ? { deviseId: resolvedDeviseId } : {}),
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

      await this.syncDerivedGovernanceAndEntites(tx, projet.id);

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
      budgetPrevu?: string | number | null;
      budgetConsomme?: string | number | null;
      deviseId?: string | null;
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
    const existing = await prisma.projet.findFirst({
      where: { id, deletedAt: null },
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
    if (!existing) throw new Error('Projet non trouvé');
    const permTypes = await myPermTypesForProjet(id, auth.userId);
    const gov = isGovernanceMember(existing as any, auth.userId);
    const adminExcl = await fetchProjetAdminExcludedForUser(auth.userId, [id]);
    if (!canModifyProjet(existing as any, auth, permTypes, gov, adminExcl.has(id))) {
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

    const scalarPayload = await sanitizeProjetScalarUpdateData(
      pickProjetScalarUpdateData(updateData as Record<string, unknown>)
    );

    return prisma.$transaction(async (tx) => {
      const updated = await tx.projet.update({
        where: { id },
        data: {
          ...scalarPayload,
          dateDebut: dateDebut ? new Date(dateDebut) : undefined,
          dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : undefined,
          partiesPrenantes: partiesPrenantes !== undefined ? JSON.stringify(partiesPrenantes) : undefined,
          kpis: kpis !== undefined ? JSON.stringify(kpis) : undefined,
          objectifsStrategiques: objectifsStrategiques !== undefined ? JSON.stringify(objectifsStrategiques) : undefined,
          objectifsOperationnels: objectifsOperationnels !== undefined ? JSON.stringify(objectifsOperationnels) : undefined,
        },
      });
      await this.syncDerivedGovernanceAndEntites(tx, id);
      return tx.projet.findUniqueOrThrow({ where: { id: updated.id }, include: projetListInclude });
    });
  }

  /** @deprecated Utiliser softDelete — conservé pour compat éventuelle */
  async delete(id: string) {
    return prisma.projet.delete({ where: { id } });
  }
}
