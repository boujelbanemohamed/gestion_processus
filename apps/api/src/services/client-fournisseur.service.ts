import { prisma } from '../utils/prisma';

export const typeSocieteService = {
  async findAll() {
    return prisma.typeSociete.findMany({ orderBy: { nom: 'asc' } });
  },
  async create(data: { nom: string; description?: string }) {
    return prisma.typeSociete.create({ data });
  },
  async update(id: string, data: { nom?: string; description?: string; actif?: boolean }) {
    return prisma.typeSociete.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.typeSociete.delete({ where: { id } });
  },
};

export const clientFournisseurService = {
  async findAll(type?: string, search?: string) {
    return prisma.clientFournisseur.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(search ? { nom: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        typeSociete: true,
        representants: { orderBy: { createdAt: 'asc' } },
        projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
      },
      orderBy: { nom: 'asc' },
    });
  },
  async findOne(id: string) {
    return prisma.clientFournisseur.findUnique({
      where: { id },
      include: {
        typeSociete: true,
        representants: { orderBy: { createdAt: 'asc' } },
        projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
      },
    });
  },
  async create(data: any) {
    const { representants, projetIds, ...rest } = data;
    return prisma.clientFournisseur.create({
      data: {
        ...rest,
        representants: representants?.length ? { create: representants } : undefined,
        projets: projetIds?.length ? { create: projetIds.map((id: string) => ({ projetId: id })) } : undefined,
      },
      include: { typeSociete: true, representants: true, projets: { include: { projet: true } } },
    });
  },
  async update(id: string, data: any) {
    const { representants, projetIds, ...rest } = data;
    // Synchroniser les liaisons projets si projetIds fournis
    if (projetIds !== undefined) {
      await prisma.clientFournisseurProjet.deleteMany({ where: { clientFournisseurId: id } });
      if (projetIds.length > 0) {
        await prisma.clientFournisseurProjet.createMany({
          data: projetIds.map((projetId: string) => ({ clientFournisseurId: id, projetId })),
          skipDuplicates: true,
        });
      }
    }
    return prisma.clientFournisseur.update({
      where: { id },
      data: rest,
      include: { typeSociete: true, representants: true, projets: { include: { projet: true } } },
    });
  },
  async delete(id: string) {
    return prisma.clientFournisseur.delete({ where: { id } });
  },
  async addRepresentant(clientFournisseurId: string, data: any) {
    if (data.dateDebut === "") data.dateDebut = null;
    if (data.dateFin === "") data.dateFin = null;
    return prisma.representantLegal.create({ data: { ...data, clientFournisseurId } });
  },
  async updateRepresentant(id: string, data: any) {
    return prisma.representantLegal.update({ where: { id }, data });
  },
  async deleteRepresentant(id: string) {
    return prisma.representantLegal.delete({ where: { id } });
  },
};
