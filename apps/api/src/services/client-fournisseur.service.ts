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
  async addRepresentant(clientFournisseurId: string, raw: any) {
    const parseDate = (v: unknown): Date | null => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s === '') return null;
      // input type="date" → "YYYY-MM-DD" ; Prisma/PostgreSQL attend un instant valide
      const iso = s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const nom = String(raw?.nom ?? '').trim();
    const prenom = String(raw?.prenom ?? '').trim();
    if (!nom || !prenom) {
      throw new Error('Le nom et le prénom sont obligatoires');
    }

    const statut = raw?.statut === 'fin_exercice' ? 'fin_exercice' : 'en_exercice';
    const fonctionRaw = raw?.fonction;
    const fonction =
      fonctionRaw === null || fonctionRaw === undefined || String(fonctionRaw).trim() === ''
        ? null
        : String(fonctionRaw).trim();

    return prisma.representantLegal.create({
      data: {
        clientFournisseurId,
        nom,
        prenom,
        fonction,
        statut,
        dateDebut: parseDate(raw?.dateDebut),
        dateFin: parseDate(raw?.dateFin),
      },
    });
  },
  async updateRepresentant(id: string, data: any) {
    const patch: any = { ...data };
    if (patch.dateDebut === '') patch.dateDebut = null;
    if (patch.dateFin === '') patch.dateFin = null;
    if (patch.dateDebut !== undefined && patch.dateDebut !== null && typeof patch.dateDebut === 'string') {
      const s = patch.dateDebut.trim();
      if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) patch.dateDebut = new Date(`${s}T12:00:00.000Z`);
    }
    if (patch.dateFin !== undefined && patch.dateFin !== null && typeof patch.dateFin === 'string') {
      const s = patch.dateFin.trim();
      if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) patch.dateFin = new Date(`${s}T12:00:00.000Z`);
    }
    return prisma.representantLegal.update({ where: { id }, data: patch });
  },
  async deleteRepresentant(id: string) {
    return prisma.representantLegal.delete({ where: { id } });
  },
};
