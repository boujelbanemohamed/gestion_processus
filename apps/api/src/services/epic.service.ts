import { prisma } from '../utils/prisma';
import { ResourceType } from '../generated/prisma/enums';
import { NotificationService } from './notification.service';

const epicInclude = {
  projet: { select: { id: true, nom: true } },
  assignesEntites: {
    include: { entite: { select: { id: true, nom: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  assignesClientsFournisseurs: {
    include: { clientFournisseur: { select: { id: true, nom: true, type: true } } },
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
          referenceType: true,
          referenceId: true,
          uploadedById: true,
          uploadedBy: { select: { id: true, nom: true, prenom: true } },
          permissionsUtilisateurs: {
            include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
          },
          adminSansAcces: { select: { userId: true } },
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
      where: { userStoryId: { in: userStoryIds }, deletedAt: null },
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
    const where: any = { deletedAt: null };
    if (filters.projetId) where.projetId = filters.projetId;
    return prisma.epic.findMany({
      where,
      include: epicInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getEpic(id: string) {
    return prisma.epic.findFirst({
      where: { id, deletedAt: null },
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
      assignesClientFournisseurIds?: string[];
    }
  ) {
    const ep = await prisma.epic.findFirst({ where: { id, deletedAt: null } });
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
      if (data.assignesClientFournisseurIds !== undefined) {
        await tx.epicClientFournisseur.deleteMany({ where: { epicId: id } });
        const uniqueCf = [...new Set(data.assignesClientFournisseurIds.map((c) => c.trim()).filter(Boolean))];
        if (uniqueCf.length > 0) {
          await tx.epicClientFournisseur.createMany({
            data: uniqueCf.map((clientFournisseurId) => ({ epicId: id, clientFournisseurId })),
            skipDuplicates: true,
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
    assignesClientFournisseurIds?: string[];
  }) {
    const {
      documentIds = [],
      userStoryIdsToAttach = [],
      entiteIds = [],
      entiteId,
      assignesClientFournisseurIds = [],
      ...rest
    } = data;
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
        ...(assignesClientFournisseurIds.length > 0
          ? {
              assignesClientsFournisseurs: {
                create: [...new Set(assignesClientFournisseurIds.map((c) => c.trim()).filter(Boolean))].map(
                  (clientFournisseurId) => ({ clientFournisseurId })
                ),
              },
            }
          : {}),
      },
      include: epicInclude,
    });

    if (userStoryIdsToAttach.length > 0) {
      await prisma.userStory.updateMany({
        where: { id: { in: userStoryIdsToAttach }, deletedAt: null },
        data: { epicId: epic.id },
      });
    }

    return this.getEpic(epic.id);
  }

  async lierDocumentEpic(epicId: string, documentId: string) {
    const ep = await prisma.epic.findFirst({ where: { id: epicId, deletedAt: null } });
    if (!ep) throw new Error('Epic introuvable');
    return prisma.epicDocument.upsert({
      where: { epicId_documentId: { epicId, documentId } },
      create: { epicId, documentId },
      update: {},
    });
  }

  async delierDocumentEpic(epicId: string, documentId: string) {
    const ep = await prisma.epic.findFirst({ where: { id: epicId, deletedAt: null } });
    if (!ep) throw new Error('Epic introuvable');
    await prisma.epicDocument.deleteMany({ where: { epicId, documentId } });
  }

  async uploadDocumentEpic(
    epicId: string,
    userId: string,
    fichier: Express.Multer.File,
    nom: string,
    description?: string,
    permissionUserIds?: string[]
  ) {
    const ep = await prisma.epic.findFirst({ where: { id: epicId, deletedAt: null } });
    if (!ep) throw new Error('Epic introuvable');
    const permSet = new Set<string>();
    for (const id of permissionUserIds || []) {
      if (id?.trim()) permSet.add(id.trim());
    }
    const explicitPerms = [...permSet].filter((uid) => uid !== userId);
    const document = await prisma.document.create({
      data: {
        nom: nom || fichier.originalname,
        typeDocument: 'epic',
        referenceType: 'epic',
        referenceId: epicId,
        fichierUrl: fichier.path,
        fichierNomOriginal: fichier.originalname,
        fichierTaille: fichier.size,
        fichierType: fichier.mimetype,
        description: description || null,
        statut: 'valide',
        uploadedById: userId,
        estConfidentiel: true,
        ...(explicitPerms.length > 0
          ? {
              permissionsUtilisateurs: {
                create: explicitPerms.map((uid) => ({ userId: uid })),
              },
            }
          : {}),
      },
    });
    await prisma.epicDocument.create({
      data: { epicId, documentId: document.id },
    });
    return document;
  }

  async uploadDocumentUserStory(
    userStoryId: string,
    userId: string,
    fichier: Express.Multer.File,
    nom: string,
    description?: string,
    permissionUserIds?: string[]
  ) {
    const us = await prisma.userStory.findFirst({ where: { id: userStoryId, deletedAt: null } });
    if (!us) throw new Error('User story introuvable');
    const permSet = new Set<string>();
    for (const id of permissionUserIds || []) {
      if (id?.trim()) permSet.add(id.trim());
    }
    const explicitPerms = [...permSet].filter((uid) => uid !== userId);
    return prisma.document.create({
      data: {
        nom: nom || fichier.originalname,
        typeDocument: 'user_story',
        referenceType: 'userStory',
        referenceId: userStoryId,
        fichierUrl: fichier.path,
        fichierNomOriginal: fichier.originalname,
        fichierTaille: fichier.size,
        fichierType: fichier.mimetype,
        description: description || null,
        statut: 'valide',
        uploadedById: userId,
        estConfidentiel: true,
        ...(explicitPerms.length > 0
          ? {
              permissionsUtilisateurs: {
                create: explicitPerms.map((uid) => ({ userId: uid })),
              },
            }
          : {}),
      },
    });
  }

  async listUserStories(filters: { epicId?: string; projetId?: string; orphelines?: boolean }) {
    const parts: object[] = [
      { deletedAt: null },
      { OR: [{ epicId: null }, { epic: { deletedAt: null } }] },
    ];
    if (filters.epicId) parts.push({ epicId: filters.epicId });
    if (filters.orphelines) parts.push({ epicId: null });
    if (filters.projetId) {
      parts.push({
        OR: [
          { epic: { projetId: filters.projetId, deletedAt: null } },
          {
            AND: [
              { epicId: null },
              { taches: { some: { projetId: filters.projetId, deletedAt: null } } },
            ],
          },
        ],
      });
    }
    const where = parts.length === 1 ? parts[0] : { AND: parts };
    const rows = await prisma.userStory.findMany({
      where,
      include: userStoryInclude,
      orderBy: { updatedAt: 'desc' },
    });
    if (rows.length === 0) return rows;
    const usIds = rows.map((r) => r.id);
    const natifs = await prisma.document.findMany({
      where: { deletedAt: null, referenceType: 'userStory', referenceId: { in: usIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nom: true,
        typeDocument: true,
        fichierType: true,
        statut: true,
        estConfidentiel: true,
        referenceType: true,
        referenceId: true,
        uploadedById: true,
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
        permissionsUtilisateurs: {
          include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
        },
        adminSansAcces: { select: { userId: true } },
      },
    });
    const byUs = new Map<string, typeof natifs>();
    for (const d of natifs) {
      const rid = d.referenceId;
      if (!rid) continue;
      const arr = byUs.get(rid) ?? [];
      arr.push(d);
      byUs.set(rid, arr);
    }
    return rows.map((r) => ({ ...r, documentsNatifs: byUs.get(r.id) ?? [] }));
  }

  async getUserStory(id: string) {
    const us = await prisma.userStory.findFirst({
      where: { id, deletedAt: null },
      include: userStoryInclude,
    });
    if (!us) return null;
    const documentsNatifs = await prisma.document.findMany({
      where: { deletedAt: null, referenceType: 'userStory', referenceId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nom: true,
        typeDocument: true,
        fichierType: true,
        statut: true,
        estConfidentiel: true,
        referenceType: true,
        referenceId: true,
        uploadedById: true,
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
        permissionsUtilisateurs: {
          include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
        },
        adminSansAcces: { select: { userId: true } },
      },
    });
    return { ...us, documentsNatifs };
  }

  async createUserStory(data: {
    description: string;
    epicId: string;
    tacheIds?: string[];
  }) {
    const epic = await prisma.epic.findFirst({
      where: { id: data.epicId, deletedAt: null },
    });
    if (!epic) throw new Error('Epic introuvable ou supprimé');

    const tacheIds = data.tacheIds || [];
    const us = await prisma.userStory.create({
      data: {
        description: data.description.trim(),
        epicId: data.epicId,
      },
    });
    if (tacheIds.length > 0) {
      await prisma.tache.updateMany({
        where: { id: { in: tacheIds }, deletedAt: null },
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
    const existing = await prisma.userStory.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new Error('User story introuvable');

    if (data.epicId !== undefined && data.epicId !== null) {
      const ep = await prisma.epic.findFirst({
        where: { id: data.epicId, deletedAt: null },
      });
      if (!ep) throw new Error('Epic introuvable ou supprimé');
    }

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
      await prisma.tache.updateMany({
        where: { userStoryId: id, deletedAt: null },
        data: { userStoryId: null },
      });
      if (data.tacheIds.length > 0) {
        await prisma.tache.updateMany({
          where: { id: { in: data.tacheIds }, deletedAt: null },
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
    const ep = await prisma.epic.findFirst({
      where: { id: epicId, deletedAt: null },
      select: { nom: true },
    });
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
    const usRow = await prisma.userStory.findFirst({
      where: { id: userStoryId, deletedAt: null },
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

  // ── Corbeille (soft delete / restauration) ─────────────────────────────────
  async softDeleteEpic(id: string, _userId: string, role: string) {
    const ep = await prisma.epic.findFirst({ where: { id, deletedAt: null } });
    if (!ep) throw new Error('Epic introuvable');
    if (role === 'lecteur') throw new Error('Accès refusé');
    if (role !== 'admin' && role !== 'contributeur') throw new Error('Accès refusé');
    await prisma.epic.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreEpic(id: string, userId: string, role: string) {
    const ep = await prisma.epic.findUnique({ where: { id } });
    if (!ep || !ep.deletedAt) throw new Error('Epic introuvable dans la corbeille');
    if (role !== 'admin' && ep.createdById !== userId) throw new Error('Accès refusé');
    await prisma.epic.update({ where: { id }, data: { deletedAt: null } });
    return this.getEpic(id);
  }

  async listEpicsCorbeille(userId: string, role: string) {
    if (role === 'lecteur') return [];
    const where: Record<string, unknown> = { deletedAt: { not: null } };
    if (role === 'contributeur') (where as any).createdById = userId;
    return prisma.epic.findMany({
      where,
      include: {
        projet: { select: { id: true, nom: true } },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async deleteEpicPermanent(id: string) {
    const ep = await prisma.epic.findUnique({ where: { id } });
    if (!ep || !ep.deletedAt) throw new Error('Epic introuvable ou non en corbeille');
    await prisma.epic.delete({ where: { id } });
  }

  async softDeleteUserStory(id: string, _userId: string, role: string) {
    const us = await prisma.userStory.findFirst({ where: { id, deletedAt: null } });
    if (!us) throw new Error('User story introuvable');
    if (role === 'lecteur') throw new Error('Accès refusé');
    if (role !== 'admin' && role !== 'contributeur') throw new Error('Accès refusé');
    await prisma.userStory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async userStoryRestoreAllowed(userId: string, role: string, usId: string) {
    if (role === 'admin') return true;
    if (role !== 'contributeur') return false;
    const us = await prisma.userStory.findUnique({
      where: { id: usId },
      include: {
        epic: { select: { createdById: true, deletedAt: true } },
        taches: {
          where: { deletedAt: null },
          select: {
            createurId: true,
            assignesUtilisateurs: { select: { userId: true } },
          },
        },
      },
    });
    if (!us) return false;
    if (us.epic && !us.epic.deletedAt && us.epic.createdById === userId) return true;
    return us.taches.some(
      (t) =>
        t.createurId === userId || t.assignesUtilisateurs.some((a) => a.userId === userId)
    );
  }

  async restoreUserStory(id: string, userId: string, role: string) {
    const us = await prisma.userStory.findUnique({ where: { id } });
    if (!us || !us.deletedAt) throw new Error('User story introuvable dans la corbeille');
    if (!(await this.userStoryRestoreAllowed(userId, role, id))) throw new Error('Accès refusé');
    await prisma.userStory.update({ where: { id }, data: { deletedAt: null } });
    return this.getUserStory(id);
  }

  async listUserStoriesCorbeille(userId: string, role: string) {
    if (role === 'lecteur') return [];
    if (role === 'admin') {
      return prisma.userStory.findMany({
        where: { deletedAt: { not: null } },
        include: {
          epic: { select: { id: true, nom: true, projetId: true, projet: { select: { nom: true } } } },
        },
        orderBy: { deletedAt: 'desc' },
      });
    }
    return prisma.userStory.findMany({
      where: {
        deletedAt: { not: null },
        OR: [
          { epic: { is: { createdById: userId, deletedAt: null } } },
          {
            taches: {
              some: {
                deletedAt: null,
                OR: [
                  { createurId: userId },
                  { assignesUtilisateurs: { some: { userId } } },
                ],
              },
            },
          },
        ],
      },
      include: {
        epic: { select: { id: true, nom: true, projetId: true, projet: { select: { nom: true } } } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async deleteUserStoryPermanent(id: string) {
    const us = await prisma.userStory.findUnique({ where: { id } });
    if (!us || !us.deletedAt) throw new Error('User story introuvable ou non en corbeille');
    await prisma.userStory.delete({ where: { id } });
  }

  async getEpicJournalHistory(epicId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = {
      OR: [
        { ressourceType: ResourceType.epic, ressourceId: epicId },
        {
          ressourceType: ResourceType.projet,
          ressourceId: epicId,
          details: { path: ['type'], equals: 'epic' },
        },
      ],
    };
    const [total, data] = await Promise.all([
      prisma.journalAcces.count({ where }),
      prisma.journalAcces.findMany({
        where,
        include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getUserStoryJournalHistory(userStoryId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = {
      OR: [
        { ressourceType: ResourceType.userStory, ressourceId: userStoryId },
        {
          ressourceType: ResourceType.projet,
          ressourceId: userStoryId,
          details: { path: ['type'], equals: 'user_story' },
        },
      ],
    };
    const [total, data] = await Promise.all([
      prisma.journalAcces.count({ where }),
      prisma.journalAcces.findMany({
        where,
        include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }
}
