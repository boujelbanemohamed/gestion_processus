import { prisma } from '../utils/prisma';
import { NotificationService } from './notification.service';

const epicInclude = {
  projet: { select: { id: true, nom: true } },
  assignesEntites: {
    include: { entite: { select: { id: true, nom: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  createdBy: { select: { id: true, nom: true, prenom: true } },
  documents: {
    include: {
      document: {
        select: {
          id: true,
          nom: true,
          typeDocument: true,
          fichierType: true,
          statut: true,
          estConfidentiel: true,
          uploadedBy: { select: { id: true, nom: true, prenom: true } },
        },
      },
    },
  },
  userStories: {
    include: {
      taches: { select: { id: true, nom: true, statut: true, projetId: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

const userStoryInclude = {
  epic: {
    include: {
      projet: { select: { id: true, nom: true } },
      assignesEntites: {
        include: { entite: { select: { id: true, nom: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
  taches: {
    select: { id: true, nom: true, statut: true, projetId: true },
    orderBy: { createdAt: 'desc' as const },
  },
};

export class EpicService {
  private notificationService = new NotificationService();

  private async collectUserIdsPourTachesUserStories(userStoryIds: string[], authorId: string) {
    if (userStoryIds.length === 0) return new Set<string>();
    const taches = await prisma.tache.findMany({
      where: { userStoryId: { in: userStoryIds } },
      select: {
        createurId: true,
        assignesUtilisateurs: { include: { user: { select: { id: true } } } },
      },
    });
    const ids = new Set<string>();
    for (const t of taches) {
      if (t.createurId && t.createurId !== authorId) ids.add(t.createurId);
      for (const tu of t.assignesUtilisateurs) {
        if (tu.user.id !== authorId) ids.add(tu.user.id);
      }
    }
    return ids;
  }

  private async destinatairesCommentaireEpic(epicId: string, authorId: string) {
    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      select: { nom: true, createdById: true },
    });
    if (!epic) throw new Error('Epic introuvable');
    const uss = await prisma.userStory.findMany({
      where: { epicId },
      select: { id: true },
    });
    const usIds = uss.map((u) => u.id);
    const userIds = await this.collectUserIdsPourTachesUserStories(usIds, authorId);
    if (epic.createdById && epic.createdById !== authorId) userIds.add(epic.createdById);
    if (userIds.size === 0) return { destinataires: [] as { id: string; email: string; nom: string }[], cibleNom: epic.nom };
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, email: true, nom: true, prenom: true },
    });
    return {
      cibleNom: epic.nom,
      destinataires: users.map((u) => ({ id: u.id, email: u.email, nom: `${u.prenom} ${u.nom}` })),
    };
  }

  private async destinatairesCommentaireUserStory(userStoryId: string, authorId: string) {
    const us = await prisma.userStory.findUnique({
      where: { id: userStoryId },
      select: { description: true },
    });
    if (!us) throw new Error('User story introuvable');
    const titre =
      us.description.length > 120 ? `${us.description.slice(0, 117)}…` : us.description;
    const userIds = await this.collectUserIdsPourTachesUserStories([userStoryId], authorId);
    if (userIds.size === 0) return { destinataires: [] as { id: string; email: string; nom: string }[], cibleNom: titre };
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, email: true, nom: true, prenom: true },
    });
    return {
      cibleNom: titre,
      destinataires: users.map((u) => ({ id: u.id, email: u.email, nom: `${u.prenom} ${u.nom}` })),
    };
  }

  async listEpics(filters: { projetId?: string }) {
    const where: any = {};
    if (filters.projetId) where.projetId = filters.projetId;
    return prisma.epic.findMany({
      where,
      include: epicInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getEpic(id: string) {
    return prisma.epic.findUnique({
      where: { id },
      include: epicInclude,
    });
  }

  async updateEpic(
    id: string,
    data: {
      nom?: string;
      description?: string | null;
      projetId?: string;
      entiteIds?: string[];
    }
  ) {
    const ep = await prisma.epic.findUnique({ where: { id } });
    if (!ep) throw new Error('Epic introuvable');

    const dataEpic: { nom?: string; description?: string | null; projetId?: string } = {};
    if (data.nom !== undefined) dataEpic.nom = data.nom.trim();
    if (data.description !== undefined) dataEpic.description = data.description?.trim() || null;
    if (data.projetId !== undefined) dataEpic.projetId = data.projetId;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(dataEpic).length > 0) {
        await tx.epic.update({ where: { id }, data: dataEpic });
      }
      if (data.entiteIds !== undefined) {
        await tx.epicEntite.deleteMany({ where: { epicId: id } });
        const unique = [...new Set(data.entiteIds.map((e) => e.trim()).filter(Boolean))];
        if (unique.length > 0) {
          await tx.epicEntite.createMany({
            data: unique.map((entiteId) => ({ epicId: id, entiteId })),
          });
        }
      }
    });

    return this.getEpic(id);
  }

  async createEpic(data: {
    nom: string;
    description?: string | null;
    projetId: string;
    entiteIds?: string[];
    entiteId?: string | null;
    createdById?: string | null;
    documentIds?: string[];
    userStoryIdsToAttach?: string[];
  }) {
    const { documentIds = [], userStoryIdsToAttach = [], entiteIds = [], entiteId, ...rest } = data;
    const entiteIdSet = new Set<string>();
    for (const id of entiteIds) {
      if (id?.trim()) entiteIdSet.add(id.trim());
    }
    if (entiteId?.trim()) entiteIdSet.add(entiteId.trim());

    const epic = await prisma.epic.create({
      data: {
        nom: rest.nom.trim(),
        description: rest.description?.trim() || null,
        projetId: rest.projetId,
        createdById: rest.createdById || null,
        ...(entiteIdSet.size > 0
          ? {
              assignesEntites: {
                create: [...entiteIdSet].map((eid) => ({ entiteId: eid })),
              },
            }
          : {}),
        ...(documentIds.length > 0
          ? {
              documents: {
                create: documentIds.map((documentId) => ({ documentId })),
              },
            }
          : {}),
      },
      include: epicInclude,
    });

    if (userStoryIdsToAttach.length > 0) {
      await prisma.userStory.updateMany({
        where: { id: { in: userStoryIdsToAttach } },
        data: { epicId: epic.id },
      });
    }

    return this.getEpic(epic.id);
  }

  async lierDocumentEpic(epicId: string, documentId: string) {
    return prisma.epicDocument.upsert({
      where: { epicId_documentId: { epicId, documentId } },
      create: { epicId, documentId },
      update: {},
    });
  }

  async uploadDocumentEpic(
    epicId: string,
    userId: string,
    fichier: Express.Multer.File,
    nom: string,
    description?: string
  ) {
    const ep = await prisma.epic.findUnique({ where: { id: epicId } });
    if (!ep) throw new Error('Epic introuvable');
    const document = await prisma.document.create({
      data: {
        nom: nom || fichier.originalname,
        typeDocument: 'autre',
        fichierUrl: fichier.path,
        fichierNomOriginal: fichier.originalname,
        fichierTaille: fichier.size,
        fichierType: fichier.mimetype,
        description: description || null,
        statut: 'valide',
        uploadedById: userId,
      },
    });
    await prisma.epicDocument.create({
      data: { epicId, documentId: document.id },
    });
    return document;
  }

  async listUserStories(filters: { epicId?: string; projetId?: string; orphelines?: boolean }) {
    const parts: object[] = [];
    if (filters.epicId) parts.push({ epicId: filters.epicId });
    if (filters.orphelines) parts.push({ epicId: null });
    if (filters.projetId) {
      parts.push({
        OR: [
          { epic: { projetId: filters.projetId } },
          { AND: [{ epicId: null }, { taches: { some: { projetId: filters.projetId } } }] },
        ],
      });
    }
    const where = parts.length === 0 ? {} : parts.length === 1 ? parts[0] : { AND: parts };
    return prisma.userStory.findMany({
      where,
      include: userStoryInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getUserStory(id: string) {
    return prisma.userStory.findUnique({
      where: { id },
      include: userStoryInclude,
    });
  }

  async createUserStory(data: {
    description: string;
    epicId: string;
    tacheIds?: string[];
  }) {
    const tacheIds = data.tacheIds || [];
    const us = await prisma.userStory.create({
      data: {
        description: data.description.trim(),
        epicId: data.epicId,
      },
    });
    if (tacheIds.length > 0) {
      await prisma.tache.updateMany({
        where: { id: { in: tacheIds } },
        data: { userStoryId: us.id },
      });
    }
    return this.getUserStory(us.id);
  }

  async updateUserStory(
    id: string,
    data: {
      description?: string;
      epicId?: string | null;
      tacheIds?: string[];
    }
  ) {
    if (data.description !== undefined || data.epicId !== undefined) {
      await prisma.userStory.update({
        where: { id },
        data: {
          ...(data.description !== undefined && { description: data.description.trim() }),
          ...(data.epicId !== undefined && { epicId: data.epicId }),
        },
      });
    }
    if (data.tacheIds !== undefined) {
      await prisma.tache.updateMany({ where: { userStoryId: id }, data: { userStoryId: null } });
      if (data.tacheIds.length > 0) {
        await prisma.tache.updateMany({
          where: { id: { in: data.tacheIds } },
          data: { userStoryId: id },
        });
      }
    }
    return this.getUserStory(id);
  }

  // ── Commentaires epic ───────────────────────────────────────────────────────
  async getCommentairesEpic(epicId: string) {
    return prisma.epicCommentaire
      .findMany({
        where: { epicId },
        include: { user: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { createdAt: 'asc' },
      })
      .then((list) => list.map((c) => ({ ...c, auteur: c.user })));
  }

  async addCommentaireEpic(epicId: string, userId: string, contenu: string, fichier?: Express.Multer.File) {
    const ep = await prisma.epic.findUnique({ where: { id: epicId }, select: { nom: true } });
    if (!ep) throw new Error('Epic introuvable');

    const commentaire = await prisma.epicCommentaire.create({
      data: {
        epicId,
        userId,
        contenu,
        pieceJointeNom: fichier?.originalname || null,
        pieceJointePath: fichier?.path || null,
        pieceJointeType: fichier?.mimetype || null,
      },
      include: { user: { select: { id: true, nom: true, prenom: true } } },
    });

    const auteurNom = `${commentaire.user.prenom} ${commentaire.user.nom}`;
    const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';

    this.notificationService
      .traiterMentions({
        contenu,
        auteurId: userId,
        auteurNom,
        appUrl,
        context: { type: 'epic', id: epicId, titre: ep.nom },
      })
      .catch((err: unknown) => console.error('[MENTIONS epic]', err));

    const { destinataires, cibleNom } = await this.destinatairesCommentaireEpic(epicId, userId);
    if (destinataires.length > 0) {
      const auteurUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { nom: true, prenom: true },
      });
      const nomAuteur = auteurUser ? `${auteurUser.prenom} ${auteurUser.nom}` : 'Un utilisateur';
      this.notificationService
        .notifierCommentaireSurCible({
          cibleType: 'epic',
          cibleId: epicId,
          cibleNom,
          commentaire: contenu,
          destinataires,
          auteurNom: nomAuteur,
          appUrl,
        })
        .catch(() => {});
    }

    return { ...commentaire, auteur: commentaire.user };
  }

  async getEpicCommentaireFichier(commentaireId: string) {
    return prisma.epicCommentaire.findUnique({
      where: { id: commentaireId },
      select: { pieceJointePath: true, pieceJointeNom: true, pieceJointeType: true },
    });
  }

  // ── Commentaires user story ────────────────────────────────────────────────
  async getCommentairesUserStory(userStoryId: string) {
    return prisma.userStoryCommentaire
      .findMany({
        where: { userStoryId },
        include: { user: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { createdAt: 'asc' },
      })
      .then((list) => list.map((c) => ({ ...c, auteur: c.user })));
  }

  async addCommentaireUserStory(
    userStoryId: string,
    userId: string,
    contenu: string,
    fichier?: Express.Multer.File
  ) {
    const usRow = await prisma.userStory.findUnique({
      where: { id: userStoryId },
      select: { description: true },
    });
    if (!usRow) throw new Error('User story introuvable');
    const titreCourt =
      usRow.description.length > 120
        ? `${usRow.description.slice(0, 117)}…`
        : usRow.description;

    const commentaire = await prisma.userStoryCommentaire.create({
      data: {
        userStoryId,
        userId,
        contenu,
        pieceJointeNom: fichier?.originalname || null,
        pieceJointePath: fichier?.path || null,
        pieceJointeType: fichier?.mimetype || null,
      },
      include: { user: { select: { id: true, nom: true, prenom: true } } },
    });

    const auteurNom = `${commentaire.user.prenom} ${commentaire.user.nom}`;
    const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';

    this.notificationService
      .traiterMentions({
        contenu,
        auteurId: userId,
        auteurNom,
        appUrl,
        context: { type: 'userStory', id: userStoryId, titre: titreCourt },
      })
      .catch((err: unknown) => console.error('[MENTIONS user story]', err));

    const { destinataires, cibleNom } = await this.destinatairesCommentaireUserStory(userStoryId, userId);
    if (destinataires.length > 0) {
      const auteurUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { nom: true, prenom: true },
      });
      const nomAuteur = auteurUser ? `${auteurUser.prenom} ${auteurUser.nom}` : 'Un utilisateur';
      this.notificationService
        .notifierCommentaireSurCible({
          cibleType: 'userStory',
          cibleId: userStoryId,
          cibleNom,
          commentaire: contenu,
          destinataires,
          auteurNom: nomAuteur,
          appUrl,
        })
        .catch(() => {});
    }

    return { ...commentaire, auteur: commentaire.user };
  }

  async getUserStoryCommentaireFichier(commentaireId: string) {
    return prisma.userStoryCommentaire.findUnique({
      where: { id: commentaireId },
      select: { pieceJointePath: true, pieceJointeNom: true, pieceJointeType: true },
    });
  }
}
