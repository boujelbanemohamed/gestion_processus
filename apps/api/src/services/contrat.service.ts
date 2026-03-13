import { prisma } from '../utils/prisma';

export const contratService = {
  async findAll(userId: string, userRole: string) {
    const contrats = await prisma.contrat.findMany({
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true } },
        partiesPrenantes: true,
        projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
        documents: { include: { document: { select: { id: true, nom: true, fichierUrl: true } } } },
        permissions: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (userRole === 'admin') return contrats;
    return contrats.filter((c: any) =>
      c.createdById === userId || c.permissions.some((p: any) => p.userId === userId)
    );
  },

  async findOne(id: string, userId: string, userRole: string) {
    const contrat = await prisma.contrat.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true } },
        partiesPrenantes: true,
        projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
        documents: { include: { document: true } },
        permissions: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
    if (!contrat) return null;
    if (userRole === 'admin') return contrat;
    if (contrat.createdById === userId) return contrat;
    if (contrat.permissions.some((p: any) => p.userId === userId)) return contrat;
    return null;
  },

  async create(data: any, userId: string) {
    const { partiesPrenantes, projetIds, tags, ...rest } = data;
    return prisma.contrat.create({
      data: {
        ...rest,
        tags: tags ? JSON.stringify(tags) : null,
        createdBy: { connect: { id: userId } },
        partiesPrenantes: partiesPrenantes?.length ? {
          create: partiesPrenantes.map((p: any) => ({ nom: p.nom, clientFournisseurId: p.clientFournisseurId || null }))
        } : undefined,
        projets: projetIds?.length ? {
          create: projetIds.map((projetId: string) => ({ projetId }))
        } : undefined,
      },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true } },
        partiesPrenantes: true,
        projets: { include: { projet: true } },
        documents: true,
        permissions: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
  },

  async update(id: string, data: any) {
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
          data: partiesPrenantes.map((p: any) => ({ contratId: id, nom: p.nom, clientFournisseurId: p.clientFournisseurId || null })),
        });
      }
    }
    return prisma.contrat.update({
      where: { id },
      data: { ...rest, tags: tags !== undefined ? JSON.stringify(tags) : undefined },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true } },
        partiesPrenantes: true,
        projets: { include: { projet: true } },
        documents: { include: { document: true } },
        permissions: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
  },

  async delete(id: string) {
    return prisma.contrat.delete({ where: { id } });
  },

  async addPermission(contratId: string, userId: string, niveau: string) {
    return prisma.contratPermission.upsert({
      where: { contratId_userId: { contratId, userId } },
      create: { contratId, userId, niveau },
      update: { niveau },
    });
  },

  async removePermission(contratId: string, userId: string) {
    return prisma.contratPermission.deleteMany({ where: { contratId, userId } });
  },

  async addDocument(contratId: string, documentId: string) {
    return prisma.contratDocument.upsert({
      where: { contratId_documentId: { contratId, documentId } },
      create: { contratId, documentId },
      update: {},
    });
  },

  async removeDocument(contratId: string, documentId: string) {
    return prisma.contratDocument.deleteMany({ where: { contratId, documentId } });
  },
};
