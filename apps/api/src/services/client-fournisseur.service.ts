import { prisma } from '../utils/prisma';

function parseRepresentantDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const iso = s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function assertRepresentantBelongsToClient(repId: string, clientFournisseurId: string) {
  const rep = await prisma.representantLegal.findFirst({
    where: { id: repId, clientFournisseurId },
    select: { id: true },
  });
  if (!rep) throw new Error('Représentant introuvable pour cette fiche');
}

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

async function attachContratsLies<T extends { id: string }>(clients: T[]) {
  if (clients.length === 0) return clients as (T & { contratsLies: { id: string; nom: string; statut: string }[] })[];
  const ids = clients.map((c) => c.id);
  const liens = await prisma.contratPartiePrenante.findMany({
    where: { clientFournisseurId: { in: ids } },
    include: { contrat: { select: { id: true, nom: true, statut: true } } },
  });
  const map = new Map<string, { id: string; nom: string; statut: string }[]>();
  for (const l of liens) {
    const cfId = l.clientFournisseurId;
    if (!cfId || !l.contrat) continue;
    const arr = map.get(cfId) ?? [];
    arr.push({ id: l.contrat.id, nom: l.contrat.nom, statut: l.contrat.statut });
    map.set(cfId, arr);
  }
  return clients.map((c) => ({
    ...c,
    contratsLies: map.get(c.id) ?? [],
  })) as (T & { contratsLies: { id: string; nom: string; statut: string }[] })[];
}

export const clientFournisseurService = {
  async findAll(type?: string, search?: string) {
    const rows = await prisma.clientFournisseur.findMany({
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
    return attachContratsLies(rows);
  },
  async findOne(id: string) {
    const row = await prisma.clientFournisseur.findUnique({
      where: { id },
      include: {
        typeSociete: true,
        representants: { orderBy: { createdAt: 'asc' } },
        projets: { include: { projet: { select: { id: true, nom: true, codeProjet: true } } } },
      },
    });
    if (!row) return null;
    const [withContrats] = await attachContratsLies([row]);
    return withContrats;
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
        dateDebut: parseRepresentantDate(raw?.dateDebut),
        dateFin: parseRepresentantDate(raw?.dateFin),
      },
    });
  },
  async updateRepresentant(clientFournisseurId: string, repId: string, raw: any) {
    await assertRepresentantBelongsToClient(repId, clientFournisseurId);

    const data: {
      nom?: string;
      prenom?: string;
      fonction?: string | null;
      statut?: string;
      dateDebut?: Date | null;
      dateFin?: Date | null;
    } = {};

    if (raw.nom !== undefined) data.nom = String(raw.nom).trim();
    if (raw.prenom !== undefined) data.prenom = String(raw.prenom).trim();
    if (raw.fonction !== undefined) {
      const f = String(raw.fonction ?? '').trim();
      data.fonction = f === '' ? null : f;
    }
    if (raw.statut !== undefined) {
      data.statut = raw.statut === 'fin_exercice' ? 'fin_exercice' : 'en_exercice';
    }
    if (raw.dateDebut !== undefined) data.dateDebut = parseRepresentantDate(raw.dateDebut);
    if (raw.dateFin !== undefined) data.dateFin = parseRepresentantDate(raw.dateFin);

    if (
      (data.nom !== undefined && data.nom === '') ||
      (data.prenom !== undefined && data.prenom === '')
    ) {
      throw new Error('Le nom et le prénom ne peuvent pas être vides');
    }

    return prisma.representantLegal.update({ where: { id: repId }, data });
  },
  async deleteRepresentant(clientFournisseurId: string, repId: string) {
    await assertRepresentantBelongsToClient(repId, clientFournisseurId);
    return prisma.representantLegal.delete({ where: { id: repId } });
  },

  async linkContrat(clientFournisseurId: string, contratId: string) {
    const cf = await prisma.clientFournisseur.findUnique({ where: { id: clientFournisseurId } });
    if (!cf) throw new Error('Client / fournisseur introuvable');
    const existing = await prisma.contratPartiePrenante.findFirst({
      where: { contratId, clientFournisseurId },
    });
    if (existing) return existing;
    return prisma.contratPartiePrenante.create({
      data: {
        contratId,
        nom: cf.nom,
        clientFournisseurId,
      },
    });
  },
  async unlinkContrat(clientFournisseurId: string, contratId: string) {
    await prisma.contratPartiePrenante.deleteMany({
      where: { contratId, clientFournisseurId },
    });
  },
};
