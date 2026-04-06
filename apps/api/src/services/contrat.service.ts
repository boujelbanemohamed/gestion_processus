import { prisma } from '../utils/prisma';

const contratInclude = {
  createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
  partiesPrenantes: true,
  projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
  documents: { include: { document: { select: { id: true, nom: true, fichierUrl: true, estConfidentiel: true } } } },
  permissions: { include: { user: { select: { id: true, nom: true, prenom: true, email: true, role: true } } } },
} as const;

type ContratAcl = {
  id: string;
  createdById: string;
  permissions: { userId: string; niveau: string }[];
};

function canViewContrat(c: ContratAcl, userId: string, userRole: string) {
  if (userRole === 'admin') return true;
  if (c.createdById === userId) return true;
  return c.permissions.some((p) => p.userId === userId);
}

export function capabilitiesContrat(c: ContratAcl, userId: string, userRole: string) {
  const isAdmin = userRole === 'admin';
  const isCreator = c.createdById === userId;
  const perm = c.permissions.find((p) => p.userId === userId);

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

  if (isAdmin) {
    return {
      canView: true,
      canModify: true,
      canDelete: true,
      canManagePermissions: false,
    };
  }

  return { canView: false, canModify: false, canDelete: false, canManagePermissions: false };
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
    };
  },

  async getHistorique(contratId: string, userId: string, userRole: string) {
    const contrat = await prisma.contrat.findFirst({
      where: { id: contratId, deletedAt: null },
      select: { id: true, createdById: true, permissions: { select: { userId: true } } },
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
