import { NotificationService } from './notification.service';
import { prisma } from '../utils/prisma';

const TACHE_INCLUDE = {
  createur: { select: { id: true, nom: true, prenom: true } },
  projet: {
    select: {
      id: true,
      nom: true,
      equipe: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      chefsProjet: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      sponsors: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      techLeads: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
    }
  },
  assignesUtilisateurs: {
    include: { user: { select: { id: true, nom: true, prenom: true } } },
  },
  assignesEntites: {
    include: {
      entite: {
        select: {
          id: true,
          nom: true,
          membres: {
            include: { user: { select: { id: true, nom: true, prenom: true } } }
          }
        }
      }
    },
  },
  liaisons: {
    include: {
      tacheLiee: { select: { id: true, nom: true, statut: true } },
    },
  },
  documents: {
    include: {
      document: {
        include: {
          uploadedBy: { select: { id: true, nom: true, prenom: true } },
          permissionsUtilisateurs: {
            include: { user: { select: { id: true, nom: true, prenom: true } } }
          },
        }
      }
    }
  },
  userStory: {
    include: {
      epic: {
        select: {
          id: true,
          nom: true,
          description: true,
          projetId: true,
          projet: { select: { id: true, nom: true } },
          entite: { select: { id: true, nom: true } },
        },
      },
    },
  },
};

function formatTache(t: any) {
  return {
    ...t,
    assignesUtilisateurs: t.assignesUtilisateurs?.map((tu: any) => tu.user) || [],
    assignesEntites: t.assignesEntites?.map((te: any) => ({
      ...te.entite,
      membres: te.entite?.membres || [],
    })) || [],
    documents: t.documents?.map((td: any) => td.document) || [],
  };
}

export class TacheService {
  private notificationService = new NotificationService();
  async findAll(filters: { statut?: string; projetId?: string; createurId?: string } = {}) {
    const where: any = {};
    if (filters.statut) where.statut = filters.statut;
    if (filters.projetId) where.projetId = filters.projetId;
    if (filters.createurId) where.createurId = filters.createurId;

    const taches = await (prisma as any).tache.findMany({
      where,
      include: TACHE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return taches.map(formatTache);
  }

  async findOne(id: string) {
    const t = await (prisma as any).tache.findUnique({
      where: { id },
      include: TACHE_INCLUDE,
    });
    if (!t) return null;
    return formatTache(t);
  }

  async create(data: any, createurId: string) {
    const {
      nom, statut, dateDebut, dateFinApprox,
      description, scenarioExecution, critereAcceptation,
      projetId,
      userStoryId,
      assignesUtilisateurIds = [],
      assignesEntiteIds = [],
      liaisons = [],
    } = data;

    const tache = await (prisma as any).tache.create({
      data: {
        nom,
        statut: statut || 'cree',
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFinApprox: dateFinApprox ? new Date(dateFinApprox) : null,
        description: description || null,
        scenarioExecution: scenarioExecution || null,
        critereAcceptation: critereAcceptation || null,
        projetId: projetId || null,
        userStoryId: userStoryId || null,
        createurId,
        assignesUtilisateurs: {
          create: assignesUtilisateurIds.map((userId: string) => ({ userId })),
        },
        assignesEntites: {
          create: assignesEntiteIds.map((entiteId: string) => ({ entiteId })),
        },
        liaisons: {
          create: liaisons
            .filter((l: any) => l.tacheLieeId)
            .map((l: any) => ({ tacheLieeId: l.tacheLieeId, type: l.type || 'simple' })),
        },
      },
      include: TACHE_INCLUDE,
    });
    // Notifier les utilisateurs assignés
    const tacheFormatted = formatTache(tache);
    const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';
    if (assignesUtilisateurIds?.length > 0) {
      const auteur = await prisma.user.findUnique({ where: { id: createurId }, select: { nom: true, prenom: true } });
      const auteurNom = auteur ? `${auteur.prenom} ${auteur.nom}` : 'Un utilisateur';
      const assignes = await prisma.user.findMany({ where: { id: { in: assignesUtilisateurIds } }, select: { id: true, email: true, nom: true, prenom: true } });
      for (const u of assignes) {
        this.notificationService.notifierAssignation({
          tacheId: tache.id, tacheNom: nom,
          assigneEmail: u.email, assigneNom: `${u.prenom} ${u.nom}`,
          auteurNom, appUrl,
        }).catch(() => {});
      }
    }
    // Notifier membres du projet si tâche liée
    if (projetId) {
      const projet = await prisma.projet.findUnique({
        where: { id: projetId },
        select: { nom: true, equipe: { include: { user: { select: { id: true, email: true, nom: true, prenom: true } } } }, chefsProjet: { include: { user: { select: { id: true, email: true, nom: true, prenom: true } } } } },
      });
      if (projet) {
        const auteur = await prisma.user.findUnique({ where: { id: createurId }, select: { nom: true, prenom: true } });
        const auteurNom = auteur ? `${auteur.prenom} ${auteur.nom}` : 'Un utilisateur';
        const membres = [
          ...(projet.equipe || []).map((m: any) => m.user),
          ...(projet.chefsProjet || []).map((m: any) => m.user),
        ].filter((u: any) => u && u.id !== createurId);
        if (membres.length > 0) {
          this.notificationService.notifierNouvelleTacheProjet({
            tacheId: tache.id, tacheNom: nom, projetNom: projet.nom,
            membres, createurNom: auteurNom, appUrl,
          }).catch(() => {});
        }
      }
    }
    return tacheFormatted;
  }

  async update(id: string, data: any) {
    const {
      nom, statut, dateDebut, dateFinApprox,
      description, scenarioExecution, critereAcceptation,
      projetId,
      userStoryId,
      assignesUtilisateurIds,
      assignesEntiteIds,
      liaisons,
    } = data;

    // Mise à jour du champ de base
    await (prisma as any).tache.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(statut !== undefined && { statut }),
        ...(dateDebut !== undefined && { dateDebut: dateDebut ? new Date(dateDebut) : null }),
        ...(dateFinApprox !== undefined && { dateFinApprox: dateFinApprox ? new Date(dateFinApprox) : null }),
        ...(description !== undefined && { description }),
        ...(scenarioExecution !== undefined && { scenarioExecution }),
        ...(critereAcceptation !== undefined && { critereAcceptation }),
        ...(projetId !== undefined && { projetId: projetId || null }),
        ...(userStoryId !== undefined && { userStoryId: userStoryId || null }),
      },
    });

    // Sync utilisateurs assignés
    if (assignesUtilisateurIds !== undefined) {
      await (prisma as any).tacheUser.deleteMany({ where: { tacheId: id } });
      if (assignesUtilisateurIds.length > 0) {
        await (prisma as any).tacheUser.createMany({
          data: assignesUtilisateurIds.map((userId: string) => ({ tacheId: id, userId })),
          skipDuplicates: true,
        });
      }
    }

    // Sync entités assignées
    if (assignesEntiteIds !== undefined) {
      await (prisma as any).tacheEntite.deleteMany({ where: { tacheId: id } });
      if (assignesEntiteIds.length > 0) {
        await (prisma as any).tacheEntite.createMany({
          data: assignesEntiteIds.map((entiteId: string) => ({ tacheId: id, entiteId })),
          skipDuplicates: true,
        });
      }
    }

    // Sync liaisons
    if (liaisons !== undefined) {
      await (prisma as any).tacheLiaison.deleteMany({ where: { tacheId: id } });
      const validLiaisons = liaisons.filter((l: any) => l.tacheLieeId && l.tacheLieeId !== id);
      if (validLiaisons.length > 0) {
        await (prisma as any).tacheLiaison.createMany({
          data: validLiaisons.map((l: any) => ({
            tacheId: id,
            tacheLieeId: l.tacheLieeId,
            type: l.type || 'simple',
          })),
          skipDuplicates: true,
        });
      }
    }

    const tacheUpdated = await this.findOne(id);
    const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';

    // Notification changement de statut
    if (data.statut && tacheUpdated) {
      const ancienneStatut = (tacheUpdated as any)._ancienStatut;
      if (ancienneStatut && ancienneStatut !== data.statut) {
        const destinataires: any[] = [];
        if (tacheUpdated.createur) {
          const u = await prisma.user.findUnique({ where: { id: tacheUpdated.createur.id }, select: { id: true, email: true, nom: true, prenom: true } });
          if (u) destinataires.push({ id: u.id, email: u.email, nom: `${u.prenom} ${u.nom}` });
        }
        (tacheUpdated.assignesUtilisateurs || []).forEach(async (u: any) => {
          const user = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, email: true, nom: true, prenom: true } });
          if (user) destinataires.push({ id: user.id, email: user.email, nom: `${user.prenom} ${user.nom}` });
        });
        if (destinataires.length > 0) {
          this.notificationService.notifierChangementStatut({
            tacheId: id, tacheNom: tacheUpdated.nom,
            ancienStatut: ancienneStatut, nouveauStatut: data.statut,
            destinataires, auteurNom: 'Un utilisateur', appUrl,
          }).catch(() => {});
        }
      }
    }

    // Notification nouvelles assignations
    if (assignesUtilisateurIds && tacheUpdated) {
      const ancienIds = (tacheUpdated.assignesUtilisateurs || []).map((u: any) => u.id);
      const nouveauxIds = assignesUtilisateurIds.filter((uid: string) => !ancienIds.includes(uid));
      if (nouveauxIds.length > 0) {
        const assignes = await prisma.user.findMany({ where: { id: { in: nouveauxIds } }, select: { id: true, email: true, nom: true, prenom: true } });
        for (const u of assignes) {
          this.notificationService.notifierAssignation({
            tacheId: id, tacheNom: tacheUpdated.nom,
            assigneEmail: u.email, assigneNom: `${u.prenom} ${u.nom}`,
            auteurNom: 'Un utilisateur', appUrl,
          }).catch(() => {});
        }
      }
    }

    return tacheUpdated;
  }

  async delete(id: string) {
    await (prisma as any).tache.delete({ where: { id } });
  }

  // ── Commentaires ──────────────────────────────────────────────────
  async getCommentaires(tacheId: string) {
    return (prisma as any).tacheCommentaire.findMany({
      where: { tacheId },
      include: { user: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { createdAt: 'asc' },
    }).then((list: any[]) =>
      list.map(c => ({ ...c, auteur: c.user }))
    );
  }

  async addCommentaire(tacheId: string, userId: string, contenu: string, fichier?: Express.Multer.File) {
    // Créer le commentaire
    const commentaire = await (prisma as any).tacheCommentaire.create({
      data: {
        tacheId,
        userId,
        contenu,
        pieceJointeNom: fichier?.originalname || null,
        pieceJointePath: fichier?.path || null,
        pieceJointeType: fichier?.mimetype || null,
      },
      include: { user: { select: { id: true, nom: true, prenom: true } } },
    });

    // Charger la tâche pour mentions et notifications
    const tache = await (prisma as any).tache.findUnique({
      where: { id: tacheId },
      select: {
        nom: true, createurId: true,
        assignesUtilisateurs: { include: { user: { select: { id: true, email: true, nom: true, prenom: true } } } },
      },
    });
    const auteur = commentaire.user;
    const auteurNom = `${auteur.prenom} ${auteur.nom}`;
    const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';

    // Non-bloquant - mentions
    this.notificationService.traiterMentions({
      contenu,
      auteurId: userId,
      auteurNom,
      tacheId,
      tacheNom: tache?.nom || 'Tâche',
      appUrl,
    }).catch((err: any) => console.error('[MENTIONS] Erreur:', err));
    if (tache) {
      const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';
      const auteurUser = await prisma.user.findUnique({ where: { id: userId }, select: { nom: true, prenom: true } });
      const auteurNom = auteurUser ? `${auteurUser.prenom} ${auteurUser.nom}` : 'Un utilisateur';
      const destinataires: any[] = [];
      if (tache.createurId && tache.createurId !== userId) {
        const u = await prisma.user.findUnique({ where: { id: tache.createurId }, select: { id: true, email: true, nom: true, prenom: true } });
        if (u) destinataires.push({ id: u.id, email: u.email, nom: `${u.prenom} ${u.nom}` });
      }
      (tache.assignesUtilisateurs || []).forEach((tu: any) => {
        if (tu.user && tu.user.id !== userId && !destinataires.find((d: any) => d.id === tu.user.id)) {
          destinataires.push({ id: tu.user.id, email: tu.user.email, nom: `${tu.user.prenom} ${tu.user.nom}` });
        }
      });
      if (destinataires.length > 0) {
        this.notificationService.notifierCommentaire({
          tacheId, tacheNom: tache.nom, commentaire: contenu,
          destinataires, auteurNom, appUrl,
        }).catch(() => {});
      }
    }
    return { ...commentaire, auteur: commentaire.user };
  }

  async getCommentaireFichier(commentaireId: string) {
    return (prisma as any).tacheCommentaire.findUnique({
      where: { id: commentaireId },
      select: { pieceJointePath: true, pieceJointeNom: true, pieceJointeType: true },
    });
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  async uploadDocument(tacheId: string, userId: string, fichier: Express.Multer.File, nom: string, description?: string) {
    const tache = await (prisma as any).tache.findUnique({
      where: { id: tacheId },
      select: { nom: true }
    });

    // Créer le document via le service document existant
    const document = await prisma.document.create({
      data: {
        nom: nom || fichier.originalname,
        typeDocument: 'autre' as any,
        fichierUrl: fichier.path,
        fichierNomOriginal: fichier.originalname,
        fichierTaille: fichier.size,
        fichierType: fichier.mimetype,
        description: description || null,
        statut: 'valide',
        uploadedById: userId,
      },
    });

    // Lier le document à la tâche
    await (prisma as any).tacheDocument.create({
      data: { tacheId, documentId: document.id },
    });

    // Notifier les membres
    const tacheInfo = await (prisma as any).tache.findUnique({
      where: { id: tacheId },
      select: {
        nom: true, createurId: true,
        assignesUtilisateurs: { include: { user: { select: { id: true, email: true, nom: true, prenom: true } } } },
      },
    });
    if (tacheInfo) {
      const appUrl = process.env.FRONTEND_URL || 'http://172.17.5.198:5173';
      const auteurUser = await prisma.user.findUnique({ where: { id: userId }, select: { nom: true, prenom: true } });
      const auteurNom = auteurUser ? `${auteurUser.prenom} ${auteurUser.nom}` : 'Un utilisateur';
      const destinataires: any[] = [];
      if (tacheInfo.createurId && tacheInfo.createurId !== userId) {
        const u = await prisma.user.findUnique({ where: { id: tacheInfo.createurId }, select: { id: true, email: true, nom: true, prenom: true } });
        if (u) destinataires.push({ id: u.id, email: u.email, nom: `${u.prenom} ${u.nom}` });
      }
      (tacheInfo.assignesUtilisateurs || []).forEach((tu: any) => {
        if (tu.user && tu.user.id !== userId && !destinataires.find((d: any) => d.id === tu.user.id)) {
          destinataires.push({ id: tu.user.id, email: tu.user.email, nom: `${tu.user.prenom} ${tu.user.nom}` });
        }
      });
      if (destinataires.length > 0) {
        this.notificationService.notifierDocumentUploade({
          tacheId, tacheNom: tacheInfo.nom, documentNom: nom || fichier.originalname,
          destinataires, auteurNom, appUrl,
        }).catch(() => {});
      }
    }

    return document;
  }

  async lierDocument(tacheId: string, documentId: string) {
    return (prisma as any).tacheDocument.upsert({
      where: { tacheId_documentId: { tacheId, documentId } },
      create: { tacheId, documentId },
      update: {},
    });
  }

  async delierDocument(tacheId: string, documentId: string) {
    return (prisma as any).tacheDocument.deleteMany({
      where: { tacheId, documentId },
    });
  }

  async getDocumentsLiables(search?: string) {
    return prisma.document.findMany({
      where: {
        deletedAt: null,
        typeDocument: { in: ['projet', 'processus', 'contrat'] as any },
        ...(search ? { nom: { contains: search, mode: 'insensitive' as any } } : {}),
      },
      select: {
        id: true,
        nom: true,
        typeDocument: true,
        fichierType: true,
        statut: true,
        estConfidentiel: true,
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
        permissionsUtilisateurs: {
          include: { user: { select: { id: true, nom: true, prenom: true } } }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
