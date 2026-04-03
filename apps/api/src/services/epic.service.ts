import { prisma } from '../utils/prisma';

const epicInclude = {
  projet: { select: { id: true, nom: true } },
  entite: { select: { id: true, nom: true } },
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
      entite: { select: { id: true, nom: true } },
    },
  },
  taches: {
    select: { id: true, nom: true, statut: true, projetId: true },
    orderBy: { createdAt: 'desc' as const },
  },
};

export class EpicService {
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

  async createEpic(data: {
    nom: string;
    description?: string | null;
    projetId: string;
    entiteId?: string | null;
    createdById?: string | null;
    documentIds?: string[];
    userStoryIdsToAttach?: string[];
  }) {
    const { documentIds = [], userStoryIdsToAttach = [], ...rest } = data;
    const epic = await prisma.epic.create({
      data: {
        nom: rest.nom.trim(),
        description: rest.description?.trim() || null,
        projetId: rest.projetId,
        entiteId: rest.entiteId || null,
        createdById: rest.createdById || null,
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

}
