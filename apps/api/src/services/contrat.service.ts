import { prisma } from '../utils/prisma';
import { LogAction, ResourceType } from '../generated/prisma/enums';

const contratInclude = {
  createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
  partiesPrenantes: true,
  projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
  documents: { include: { document: { select: { id: true, nom: true, fichierUrl: true, estConfidentiel: true } } } },
  permissions: { include: { user: { select: { id: true, nom: true, prenom: true, email: true, role: true } } } },
  adminSansAcces: { select: { userId: true } },
} as const;

type ContratAcl = {
  id: string;
  createdById: string;
  permissions: { userId: string; niveau: string }[];
  adminSansAcces?: { userId: string }[];
};

function adminImplicitAccessRefused(c: ContratAcl, userId: string): boolean {
  return (c.adminSansAcces || []).some((x) => x.userId === userId);
}

function canViewContrat(c: ContratAcl, userId: string, userRole: string) {
  if (c.createdById === userId) return true;
  const hasPerm = c.permissions.some((p) => p.userId === userId);
  if (userRole === 'admin') {
    if (adminImplicitAccessRefused(c, userId)) return hasPerm;
    return true;
  }
  return hasPerm;
}

export function capabilitiesContrat(c: ContratAcl, userId: string, userRole: string) {
  const isAdmin = userRole === 'admin';
  const isCreator = c.createdById === userId;
  const perm = c.permissions.find((p) => p.userId === userId);
  const adminRefused = isAdmin && adminImplicitAccessRefused(c, userId);

  if (isCreator) {
    return {
      canView: true,
      canModify: true,
      canDelete: true,
      canManagePermissions: true,
    };
  }

  if (perm) {
    const canView = true;
    const canModify = perm.niveau === 'modification' || perm.niveau === 'suppression';
    const canDelete = perm.niveau === 'suppression';
    return { canView, canModify, canDelete, canManagePermissions: false };
  }

  if (isAdmin && !adminRefused) {
    return {
      canView: true,
      canModify: true,
      canDelete: true,
      canManagePermissions: false,
    };
  }

  return { canView: false, canModify: false, canDelete: false, canManagePermissions: false };
}

async function maybeExcludeAdminAfterPermissionRemoved(
  contratId: string,
  contratCreatedById: string,
  targetUserId: string
) {
  if (targetUserId === contratCreatedById) return;
  const u = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (u?.role !== 'admin') return;
  await prisma.contratAdminSansAcces.upsert({
    where: { contratId_userId: { contratId, userId: targetUserId } },
    create: { contratId, userId: targetUserId },
    update: {},
  });
}

export async function logContratHistorique(
  contratId: string,
  userId: string,
  typeEvenement: string,
  libelle?: string | null,
  details?: object
) {
  await prisma.contratHistorique.create({
    data: {
      contratId,
      userId,
      typeEvenement,
      libelle: libelle ?? null,
      details: details === undefined ? undefined : (details as object),
    },
  });
}

function mapWithCapsAndAcces<T extends ContratAcl & Record<string, unknown>>(c: T, userId: string, userRole: string) {
  const caps = capabilitiesContrat(c, userId, userRole);
  return {
    ...c,
    capabilities: caps,
    accesApercu: {
      delegations: (c as any).permissions?.map((p: any) => ({
        id: p.id,
        user: p.user,
        niveau: p.niveau,
      })) ?? [],
    },
  };
}

export const contratService = {
  async findAll(userId: string, userRole: string) {
    const contrats = await prisma.contrat.findMany({
      where: { deletedAt: null },
      include: contratInclude,
      orderBy: { createdAt: 'desc' },
    });
    return contrats
      .filter((c) => canViewContrat(c, userId, userRole))
      .map((c) => mapWithCapsAndAcces(c as any, userId, userRole));
  },

  async findOne(id: string, userId: string, userRole: string) {
    const contrat = await prisma.contrat.findFirst({
      where: { id, deletedAt: null },
      include: contratInclude,
    });
    if (!contrat) return null;
    if (!canViewContrat(contrat, userId, userRole)) return null;
    return mapWithCapsAndAcces(contrat as any, userId, userRole);
  },

  async getAccesDetail(contratId: string, userId: string, userRole: string) {
    const contrat = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      include: contratInclude,
    });
    if (!contrat) throw new Error('NOT_FOUND');
    if (!canViewContrat(contrat, userId, userRole)) throw new Error('FORBIDDEN');

    const admins = await prisma.user.findMany({
      where: { role: 'admin', statut: 'actif' },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    const creator = await prisma.user.findUnique({
      where: { id: contrat.createdById },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
    });
    const delegations = contrat.permissions.map((p) => ({
      id: p.id,
      permission: p.niveau,
      user: p.user,
      grantedBy: null as null,
      createdAt: p.createdAt,
    }));

    return {
      ficheNom: contrat.nom,
      admins,
      creator,
      delegations,
      canManagePermissions: contrat.createdById === userId,
      adminSansAccesUserIds: contrat.adminSansAcces.map((x) => x.userId),
    };
  },

  async getHistorique(contratId: string, userId: string, userRole: string) {
    const contrat = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      select: {
        id: true,
        createdById: true,
        permissions: { select: { userId: true } },
        adminSansAcces: { select: { userId: true } },
      },
    });
    if (!contrat) throw new Error('NOT_FOUND');
    if (!canViewContrat(contrat as any, userId, userRole)) throw new Error('FORBIDDEN');

    return prisma.contratHistorique.findMany({
      where: { contratId },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  },

  async create(data: any, userId: string, userRole: string) {
    const { partiesPrenantes, projetIds, tags, ...rest } = data;
    const row = await prisma.contrat.create({
      data: {
        ...rest,
        tags: tags ? JSON.stringify(tags) : null,
        createdBy: { connect: { id: userId } },
        partiesPrenantes: partiesPrenantes?.length
          ? {
              create: partiesPrenantes.map((p: any) => ({
                nom: p.nom,
                clientFournisseurId: p.clientFournisseurId || null,
              })),
            }
          : undefined,
        projets: projetIds?.length
          ? { create: projetIds.map((projetId: string) => ({ projetId })) }
          : undefined,
      },
      include: contratInclude,
    });
    await logContratHistorique(row.id, userId, 'creation', `Contrat créé : ${row.nom}`);
    return mapWithCapsAndAcces(row as any, userId, userRole);
  },

  async update(id: string, data: any, actorUserId: string, actorRole: string) {
    const existing = await prisma.contrat.findFirst({
      where: { id, deletedAt: null },
      include: { permissions: true },
    });
    if (!existing) throw new Error('NOT_FOUND');
    const caps = capabilitiesContrat(existing, actorUserId, actorRole);
    if (!caps.canModify) throw new Error('FORBIDDEN');

    const { partiesPrenantes, projetIds, tags, ...rest } = data;
    if (projetIds !== undefined) {
      await prisma.contratProjet.deleteMany({ where: { contratId: id } });
      if (projetIds.length > 0) {
        await prisma.contratProjet.createMany({
          data: projetIds.map((projetId: string) => ({ contratId: id, projetId })),
          skipDuplicates: true,
        });
      }
    }
    if (partiesPrenantes !== undefined) {
      await prisma.contratPartiePrenante.deleteMany({ where: { contratId: id } });
      if (partiesPrenantes.length > 0) {
        await prisma.contratPartiePrenante.createMany({
          data: partiesPrenantes.map((p: any) => ({
            contratId: id,
            nom: p.nom,
            clientFournisseurId: p.clientFournisseurId || null,
          })),
        });
      }
    }
    const row = await prisma.contrat.update({
      where: { id },
      data: { ...rest, tags: tags !== undefined ? JSON.stringify(tags) : undefined },
      include: contratInclude,
    });

    const changes: Record<string, { avant: unknown; apres: unknown }> = {};
    const keys = ['nom', 'statut', 'dateSignature', 'dateEnregistrement', 'dateExpiration'] as const;
    for (const k of keys) {
      if (rest[k] !== undefined) {
        const avant = (existing as any)[k];
        const apres = rest[k];
        if (String(avant) !== String(apres)) changes[k] = { avant, apres };
      }
    }
    if (tags !== undefined) {
      const avantTags = existing.tags;
      const apresTags = JSON.stringify(tags);
      if (avantTags !== apresTags) changes.tags = { avant: avantTags, apres: tags };
    }
    if (Object.keys(changes).length > 0) {
      await logContratHistorique(id, actorUserId, 'modification_champs', 'Contrat modifié', { changes });
    }

    return mapWithCapsAndAcces(row as any, actorUserId, actorRole);
  },

  async softDelete(id: string, actorUserId: string, actorRole: string) {
    const existing = await prisma.contrat.findFirst({
      where: { id, deletedAt: null },
      include: { permissions: true },
    });
    if (!existing) throw new Error('NOT_FOUND');
    if (!capabilitiesContrat(existing, actorUserId, actorRole).canDelete) throw new Error('FORBIDDEN');
    await prisma.contrat.update({ where: { id }, data: { deletedAt: new Date() } });
    await logContratHistorique(id, actorUserId, 'soft_delete', `Contrat mis en corbeille : ${existing.nom}`);
  },

  async addPermission(contratId: string, targetUserId: string, niveau: string, actorUserId: string, actorRole: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      include: { permissions: true },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (c.createdById !== actorUserId) throw new Error('FORBIDDEN');
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    if (c.createdById === targetUserId) throw new Error('Le créateur du contrat a déjà tous les droits');

    await prisma.contratAdminSansAcces.deleteMany({ where: { contratId, userId: targetUserId } });

    const row = await prisma.contratPermission.upsert({
      where: { contratId_userId: { contratId, userId: targetUserId } },
      create: { contratId, userId: targetUserId, niveau },
      update: { niveau },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
    });
    await logContratHistorique(contratId, actorUserId, 'droit_ajoute', `Niveau « ${niveau} » pour ${target.prenom} ${target.nom}`, {
      niveau,
      cibleUserId: targetUserId,
    });
    return row;
  },

  async removePermission(contratId: string, targetUserId: string, actorUserId: string, actorRole: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      include: { permissions: { include: { user: true } } },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (c.createdById !== actorUserId) throw new Error('FORBIDDEN');
    const perm = c.permissions.find((p) => p.userId === targetUserId);
    if (!perm) throw new Error('NOT_FOUND');
    await prisma.contratPermission.deleteMany({ where: { contratId, userId: targetUserId } });
    await logContratHistorique(contratId, actorUserId, 'droit_retire', `Accès retiré à ${perm.user.prenom} ${perm.user.nom}`, {
      cibleUserId: targetUserId,
    });
    await maybeExcludeAdminAfterPermissionRemoved(contratId, c.createdById, targetUserId);
  },

  async removePermissionByEntryId(contratId: string, permissionEntryId: string, actorUserId: string, actorRole: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      include: { permissions: true },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (c.createdById !== actorUserId) throw new Error('FORBIDDEN');
    const perm = await prisma.contratPermission.findFirst({
      where: { id: permissionEntryId, contratId },
      include: { user: { select: { nom: true, prenom: true } } },
    });
    if (!perm) throw new Error('NOT_FOUND');
    await prisma.contratPermission.delete({ where: { id: permissionEntryId } });
    await logContratHistorique(contratId, actorUserId, 'droit_retire', `Accès retiré à ${perm.user.prenom} ${perm.user.nom}`, {
      cibleUserId: perm.userId,
    });
    await maybeExcludeAdminAfterPermissionRemoved(contratId, c.createdById, perm.userId);
  },

  async blockAdminImplicitAccess(contratId: string, targetUserId: string, actorUserId: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (c.createdById !== actorUserId) throw new Error('FORBIDDEN');
    if (c.createdById === targetUserId) throw new Error('Le créateur du contrat ne peut pas être exclu');
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    if (target.role !== 'admin') {
      throw new Error("Seuls les comptes administrateur peuvent être privés de l'accès implicite au contrat");
    }
    await prisma.contratPermission.deleteMany({ where: { contratId, userId: targetUserId } });
    await prisma.contratAdminSansAcces.upsert({
      where: { contratId_userId: { contratId, userId: targetUserId } },
      create: { contratId, userId: targetUserId },
      update: {},
    });
    await logContratHistorique(
      contratId,
      actorUserId,
      'admin_acces_bloque',
      `Accès administrateur retiré (aucun droit) : ${target.prenom} ${target.nom}`,
      { cibleUserId: targetUserId }
    );
  },

  async restoreAdminImplicitAccess(contratId: string, targetUserId: string, actorUserId: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (c.createdById !== actorUserId) throw new Error('FORBIDDEN');
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { nom: true, prenom: true },
    });
    if (!target) throw new Error('Utilisateur introuvable');
    await prisma.contratAdminSansAcces.deleteMany({ where: { contratId, userId: targetUserId } });
    await logContratHistorique(
      contratId,
      actorUserId,
      'admin_acces_retabli',
      `Accès administrateur par défaut rétabli : ${target.prenom} ${target.nom}`,
      { cibleUserId: targetUserId }
    );
  },

  async addDocument(contratId: string, documentId: string, actorUserId: string, actorRole: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      include: { permissions: true },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (!capabilitiesContrat(c, actorUserId, actorRole).canModify) throw new Error('FORBIDDEN');
    const row = await prisma.contratDocument.upsert({
      where: { contratId_documentId: { contratId, documentId } },
      create: { contratId, documentId },
      update: {},
    });
    await logContratHistorique(contratId, actorUserId, 'document_lie', 'Document lié', { documentId });
    return row;
  },

  async removeDocument(contratId: string, documentId: string, actorUserId: string, actorRole: string) {
    const c = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      include: { permissions: true },
    });
    if (!c) throw new Error('NOT_FOUND');
    if (!capabilitiesContrat(c, actorUserId, actorRole).canModify) throw new Error('FORBIDDEN');
    await prisma.contratDocument.deleteMany({ where: { contratId, documentId } });
    await logContratHistorique(contratId, actorUserId, 'document_delie', `Document retiré du contrat`, { documentId });
  },

  async listDeletedForCorbeille() {
    return prisma.contrat.findMany({
      where: { deletedAt: { not: null } },
      include: { createdBy: { select: { id: true, nom: true, prenom: true, email: true } } },
      orderBy: { deletedAt: 'desc' },
    });
  },

  /** Corbeille depuis la page Contrats : tout pour l’admin, sinon uniquement les contrats créés par l’utilisateur (aligné projets). */
  async listDeletedForCorbeilleScoped(userId: string, userRole: string) {
    const where: { deletedAt: { not: null }; createdById?: string } = { deletedAt: { not: null } };
    if (userRole !== 'admin') {
      where.createdById = userId;
    }
    return prisma.contrat.findMany({
      where,
      include: { createdBy: { select: { id: true, nom: true, prenom: true, email: true } } },
      orderBy: { deletedAt: 'desc' },
    });
  },

  /**
   * Somme des entrées JournalAcces (action lecture) pour chaque document lié au contrat — agrégée par contrat.
   * Uniquement les contrats visibles par l’utilisateur (même règles que findAll).
   */
  async getVuesPiecesJointesByContratId(userId: string, userRole: string): Promise<Record<string, number>> {
    const contrats = await prisma.contrat.findMany({
      where: { deletedAt: null },
      include: contratInclude,
    });
    const visibleIds = contrats.filter((c) => canViewContrat(c as ContratAcl, userId, userRole)).map((c) => c.id);
    if (visibleIds.length === 0) return {};

    const links = await prisma.contratDocument.findMany({
      where: { contratId: { in: visibleIds } },
      select: { contratId: true, documentId: true },
    });
    const result: Record<string, number> = {};
    for (const id of visibleIds) result[id] = 0;
    if (links.length === 0) return result;

    const docIds = [...new Set(links.map((l) => l.documentId))];
    const groups = await prisma.journalAcces.groupBy({
      by: ['ressourceId'],
      where: {
        ressourceType: ResourceType.document,
        action: LogAction.lecture,
        ressourceId: { in: docIds },
      },
      _count: { _all: true },
    });
    const docToCount = new Map(groups.map((g) => [g.ressourceId, g._count._all]));
    for (const link of links) {
      result[link.contratId] += docToCount.get(link.documentId) ?? 0;
    }
    return result;
  },

  async restoreFromCorbeille(id: string, actorUserId: string) {
    const row = await prisma.contrat.findUnique({ where: { id } });
    if (!row?.deletedAt) throw new Error('Élément introuvable ou non supprimé');
    const updated = await prisma.contrat.update({
      where: { id },
      data: { deletedAt: null },
      include: { createdBy: true },
    });
    await logContratHistorique(id, actorUserId, 'restauration', 'Contrat restauré depuis la corbeille');
    return updated;
  },

  async deletePermanent(id: string) {
    await prisma.contrat.delete({ where: { id } });
  },
};
