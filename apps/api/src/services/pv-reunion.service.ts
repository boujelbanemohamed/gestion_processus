import { prisma } from '../utils/prisma';
import { DocType, RefType, Role } from '../generated/prisma/enums';
import { NotificationService } from './notification.service';

export type LiensExplicites = {
  projetIds: string[];
  tacheIds: string[];
  userStoryIds: string[];
  epicIds: string[];
  contratIds: string[];
  processusIds: string[];
};

const emptyLiens: LiensExplicites = {
  projetIds: [],
  tacheIds: [],
  userStoryIds: [],
  epicIds: [],
  contratIds: [],
  processusIds: [],
};

function uniq(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function parseLiensExplicites(raw: unknown): LiensExplicites {
  if (!raw || typeof raw !== 'object') return { ...emptyLiens };
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? uniq(v.filter((x): x is string => typeof x === 'string')) : [];
  return {
    projetIds: arr(o.projetIds),
    tacheIds: arr(o.tacheIds),
    userStoryIds: arr(o.userStoryIds),
    epicIds: arr(o.epicIds),
    contratIds: arr(o.contratIds),
    processusIds: arr(o.processusIds),
  };
}

export function parseIdArrayFromBody(val: unknown): string[] {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) return uniq(val.filter((x): x is string => typeof x === 'string'));
  if (typeof val === 'string') {
    try {
      const j = JSON.parse(val);
      return Array.isArray(j) ? uniq(j.filter((x: unknown) => typeof x === 'string')) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const pvIncludeDetail = {
  document: {
    select: {
      id: true,
      nom: true,
      fichierUrl: true,
      fichierNomOriginal: true,
      fichierTaille: true,
      fichierType: true,
      typeDocument: true,
    },
  },
  createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
  presentsUser: { include: { user: { select: { id: true, nom: true, prenom: true, email: true } } } },
  presentsClientFournisseur: {
    include: { clientFournisseur: { select: { id: true, raisonSociale: true, type: true } } },
  },
  modificationDelegues: {
    include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
  },
  projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
  taches: { include: { tache: { select: { id: true, nom: true, statut: true } } } },
  userStories: { include: { userStory: { select: { id: true, description: true } } } },
  epics: { include: { epic: { select: { id: true, nom: true } } } },
  contrats: { include: { contrat: { select: { id: true, nom: true } } } },
  processus: { include: { processus: { select: { id: true, nom: true } } } },
  commentaires: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: { select: { id: true, nom: true, prenom: true } },
      assigneUser: { select: { id: true, nom: true, prenom: true } },
      pieceJointe: {
        select: {
          id: true,
          nom: true,
          fichierNomOriginal: true,
          fichierTaille: true,
          fichierType: true,
        },
      },
    },
  },
} as const;

export function canModifyPv(
  pv: { createdById: string; modificationDelegues?: { userId: string }[] },
  userId: string,
  role: string
): boolean {
  if (role === Role.admin) return true;
  if (pv.createdById === userId) return true;
  return !!pv.modificationDelegues?.some((d) => d.userId === userId);
}

async function expandLiens(liens: LiensExplicites): Promise<LiensExplicites> {
  const tacheIds = new Set(liens.tacheIds);
  const userStoryIds = new Set(liens.userStoryIds);

  if (userStoryIds.size > 0) {
    const tus = await prisma.tache.findMany({
      where: { userStoryId: { in: [...userStoryIds] }, deletedAt: null },
      select: { id: true },
    });
    tus.forEach((t) => tacheIds.add(t.id));
  }

  const epicIds = new Set(liens.epicIds);
  if (epicIds.size > 0) {
    const stories = await prisma.userStory.findMany({
      where: { epicId: { in: [...epicIds] }, deletedAt: null },
      select: { id: true },
    });
    for (const s of stories) userStoryIds.add(s.id);
    if (stories.length > 0) {
      const tus2 = await prisma.tache.findMany({
        where: { userStoryId: { in: stories.map((s) => s.id) }, deletedAt: null },
        select: { id: true },
      });
      tus2.forEach((t) => tacheIds.add(t.id));
    }
  }

  return {
    projetIds: uniq(liens.projetIds),
    tacheIds: [...tacheIds],
    userStoryIds: [...userStoryIds],
    epicIds: uniq(liens.epicIds),
    contratIds: uniq(liens.contratIds),
    processusIds: uniq(liens.processusIds),
  };
}

async function replaceLiens(pvReunionId: string, expanded: LiensExplicites) {
  await prisma.$transaction([
    prisma.pvReunionProjet.deleteMany({ where: { pvReunionId } }),
    prisma.pvReunionTache.deleteMany({ where: { pvReunionId } }),
    prisma.pvReunionUserStory.deleteMany({ where: { pvReunionId } }),
    prisma.pvReunionEpic.deleteMany({ where: { pvReunionId } }),
    prisma.pvReunionContrat.deleteMany({ where: { pvReunionId } }),
    prisma.pvReunionProcessus.deleteMany({ where: { pvReunionId } }),
  ]);

  if (expanded.projetIds.length) {
    await prisma.pvReunionProjet.createMany({
      data: expanded.projetIds.map((projetId) => ({ pvReunionId, projetId })),
      skipDuplicates: true,
    });
  }
  if (expanded.tacheIds.length) {
    await prisma.pvReunionTache.createMany({
      data: expanded.tacheIds.map((tacheId) => ({ pvReunionId, tacheId })),
      skipDuplicates: true,
    });
  }
  if (expanded.userStoryIds.length) {
    await prisma.pvReunionUserStory.createMany({
      data: expanded.userStoryIds.map((userStoryId) => ({ pvReunionId, userStoryId })),
      skipDuplicates: true,
    });
  }
  if (expanded.epicIds.length) {
    await prisma.pvReunionEpic.createMany({
      data: expanded.epicIds.map((epicId) => ({ pvReunionId, epicId })),
      skipDuplicates: true,
    });
  }
  if (expanded.contratIds.length) {
    await prisma.pvReunionContrat.createMany({
      data: expanded.contratIds.map((contratId) => ({ pvReunionId, contratId })),
      skipDuplicates: true,
    });
  }
  if (expanded.processusIds.length) {
    await prisma.pvReunionProcessus.createMany({
      data: expanded.processusIds.map((processusId) => ({ pvReunionId, processusId })),
      skipDuplicates: true,
    });
  }
}

function mapCapabilities(pv: any, userId: string, role: string) {
  const delegues = (pv.modificationDelegues || []).map((d: any) => ({ userId: d.userId }));
  return {
    canView: true,
    canModify: canModifyPv({ createdById: pv.createdById, modificationDelegues: delegues }, userId, role),
  };
}

export class PvReunionService {
  private notificationService = new NotificationService();

  async findAll(userId: string, role: string) {
    const list = await prisma.pvReunion.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        document: {
          select: { id: true, nom: true, fichierNomOriginal: true },
        },
        createdBy: { select: { id: true, nom: true, prenom: true } },
        modificationDelegues: { select: { userId: true } },
      },
    });
    return list.map((pv) => ({
      ...pv,
      liensExplicites: parseLiensExplicites(pv.liensExplicites),
      capabilities: mapCapabilities(pv, userId, role),
    }));
  }

  async findOne(id: string, userId: string, role: string) {
    const pv = await prisma.pvReunion.findFirst({
      where: { id, deletedAt: null },
      include: pvIncludeDetail,
    });
    if (!pv) return null;
    return {
      ...pv,
      liensExplicites: parseLiensExplicites(pv.liensExplicites),
      capabilities: mapCapabilities(pv, userId, role),
    };
  }

  async create(
    userId: string,
    role: string,
    data: {
      titre: string;
      dateReunion?: Date | null;
      presentUserIds: string[];
      presentClientFournisseurIds: string[];
      liens: LiensExplicites;
      modificationDelegueIds: string[];
      fichier: Express.Multer.File;
    }
  ) {
    const expanded = await expandLiens(data.liens);
    const liensExplicitesStored = data.liens as object;

    const doc = await prisma.document.create({
      data: {
        nom: data.fichier.originalname,
        typeDocument: DocType.pv_reunion,
        fichierUrl: data.fichier.filename,
        fichierNomOriginal: data.fichier.originalname,
        fichierTaille: data.fichier.size,
        fichierType: data.fichier.mimetype,
        uploadedById: userId,
        estConfidentiel: false,
      },
    });

    const pv = await prisma.pvReunion.create({
      data: {
        titre: data.titre.trim(),
        documentId: doc.id,
        dateReunion: data.dateReunion ?? null,
        createdById: userId,
        liensExplicites: liensExplicitesStored as any,
        presentsUser: {
          create: uniq(data.presentUserIds).map((uid) => ({ userId: uid })),
        },
        presentsClientFournisseur: {
          create: uniq(data.presentClientFournisseurIds).map((clientFournisseurId) => ({
            clientFournisseurId,
          })),
        },
        modificationDelegues: {
          create: uniq(data.modificationDelegueIds)
            .filter((id) => id !== userId)
            .map((uid) => ({ userId: uid })),
        },
      },
      include: { modificationDelegues: { select: { userId: true } } },
    });

    await prisma.document.update({
      where: { id: doc.id },
      data: { referenceType: RefType.pvReunion, referenceId: pv.id },
    });

    await replaceLiens(pv.id, expanded);

    return this.findOne(pv.id, userId, role);
  }

  async update(
    id: string,
    userId: string,
    role: string,
    data: {
      titre?: string;
      dateReunion?: Date | null;
      presentUserIds?: string[];
      presentClientFournisseurIds?: string[];
      liens?: LiensExplicites;
      modificationDelegueIds?: string[];
    }
  ) {
    const existing = await prisma.pvReunion.findFirst({
      where: { id, deletedAt: null },
      include: { modificationDelegues: true },
    });
    if (!existing) throw new Error('NOT_FOUND');
    if (!canModifyPv(existing, userId, role)) throw new Error('FORBIDDEN');

    const liensExplicites = data.liens
      ? (data.liens as object)
      : (existing.liensExplicites as object);
    const expanded = data.liens ? await expandLiens(data.liens) : null;

    await prisma.pvReunion.update({
      where: { id },
      data: {
        ...(data.titre != null ? { titre: data.titre.trim() } : {}),
        ...(data.dateReunion !== undefined ? { dateReunion: data.dateReunion } : {}),
        ...(data.liens ? { liensExplicites: liensExplicites as any } : {}),
      },
    });

    if (data.presentUserIds) {
      await prisma.pvReunionPresentUser.deleteMany({ where: { pvReunionId: id } });
      await prisma.pvReunionPresentUser.createMany({
        data: uniq(data.presentUserIds).map((uid) => ({ pvReunionId: id, userId: uid })),
        skipDuplicates: true,
      });
    }

    if (data.presentClientFournisseurIds) {
      await prisma.pvReunionPresentClientFournisseur.deleteMany({ where: { pvReunionId: id } });
      await prisma.pvReunionPresentClientFournisseur.createMany({
        data: uniq(data.presentClientFournisseurIds).map((clientFournisseurId) => ({
          pvReunionId: id,
          clientFournisseurId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.modificationDelegueIds) {
      await prisma.pvReunionModificationDelegue.deleteMany({ where: { pvReunionId: id } });
      await prisma.pvReunionModificationDelegue.createMany({
        data: uniq(data.modificationDelegueIds)
          .filter((uid) => uid !== existing.createdById)
          .map((uid) => ({ pvReunionId: id, userId: uid })),
        skipDuplicates: true,
      });
    }

    if (expanded) await replaceLiens(id, expanded);

    return this.findOne(id, userId, role);
  }

  async softDelete(id: string, userId: string, role: string) {
    const existing = await prisma.pvReunion.findFirst({
      where: { id, deletedAt: null },
      include: { modificationDelegues: true },
    });
    if (!existing) throw new Error('NOT_FOUND');
    if (!canModifyPv(existing, userId, role)) throw new Error('FORBIDDEN');
    await prisma.pvReunion.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addCommentaire(
    pvId: string,
    auteurId: string,
    role: string,
    contenu: string,
    assigneAId: string | null,
    fichier?: Express.Multer.File
  ) {
    const pv = await prisma.pvReunion.findFirst({
      where: { id: pvId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
        modificationDelegues: { include: { user: { select: { id: true, email: true, nom: true, prenom: true } } } },
      },
    });
    if (!pv) throw new Error('NOT_FOUND');

    let documentId: string | null = null;
    if (fichier) {
      const doc = await prisma.document.create({
        data: {
          nom: fichier.originalname,
          typeDocument: DocType.autre,
          fichierUrl: fichier.filename,
          fichierNomOriginal: fichier.originalname,
          fichierTaille: fichier.size,
          fichierType: fichier.mimetype,
          uploadedById: auteurId,
          estConfidentiel: false,
        },
      });
      documentId = doc.id;
    }

    const c = await prisma.pvReunionCommentaire.create({
      data: {
        pvReunionId: pvId,
        userId: auteurId,
        contenu: contenu.trim(),
        assigneAId: assigneAId || null,
        documentId,
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true } },
        assigneUser: { select: { id: true, nom: true, prenom: true } },
        pieceJointe: {
          select: {
            id: true,
            nom: true,
            fichierNomOriginal: true,
            fichierTaille: true,
            fichierType: true,
          },
        },
      },
    });

    const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const auteurUser = await prisma.user.findUnique({
      where: { id: auteurId },
      select: { nom: true, prenom: true },
    });
    const auteurNom = auteurUser ? `${auteurUser.prenom} ${auteurUser.nom}` : 'Un utilisateur';

    const destinataires: { id: string; email: string; nom: string }[] = [];
    if (assigneAId && assigneAId !== auteurId) {
      const u = await prisma.user.findUnique({
        where: { id: assigneAId },
        select: { id: true, email: true, nom: true, prenom: true },
      });
      if (u) destinataires.push({ id: u.id, email: u.email, nom: `${u.prenom} ${u.nom}` });
    } else {
      if (pv.createdById && pv.createdById !== auteurId) {
        destinataires.push({
          id: pv.createdBy.id,
          email: pv.createdBy.email,
          nom: `${pv.createdBy.prenom} ${pv.createdBy.nom}`,
        });
      }
      for (const d of pv.modificationDelegues) {
        if (d.userId === auteurId) continue;
        if (destinataires.some((x) => x.id === d.userId)) continue;
        destinataires.push({
          id: d.user.id,
          email: d.user.email,
          nom: `${d.user.prenom} ${d.user.nom}`,
        });
      }
    }

    if (destinataires.length > 0) {
      this.notificationService
        .notifierCommentairePvReunion({
          pvId,
          pvTitre: pv.titre,
          commentaire: contenu,
          destinataires,
          auteurNom,
          appUrl,
          pieceJointeNom: fichier?.originalname,
        })
        .catch(() => {});
    }

    return c;
  }

  async getCommentairePieceDocument(commentaireId: string) {
    const com = await prisma.pvReunionCommentaire.findUnique({
      where: { id: commentaireId },
      include: {
        pvReunion: {
          include: { modificationDelegues: { select: { userId: true } } },
        },
        pieceJointe: true,
      },
    });
    if (!com?.pieceJointe || com.pvReunion.deletedAt) return null;
    return com.pieceJointe;
  }
}

export const pvReunionService = new PvReunionService();
