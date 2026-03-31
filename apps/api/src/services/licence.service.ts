import { prisma } from '../utils/prisma';
import { Prisma } from '../generated/prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const licenceInclude = {
  createdBy: { select: { id: true, nom: true, prenom: true, email: true } },
  contrat: { select: { id: true, nom: true } },
  processus: { select: { id: true, nom: true } },
  clientFournisseur: { select: { id: true, nom: true } },
  permissions: {
    include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
  },
  documents: {
    include: {
      document: {
        include: {
          uploadedBy: { select: { id: true, nom: true, prenom: true } },
        },
      },
    },
  },
  commentaires: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      user: { select: { id: true, nom: true, prenom: true } },
      assigneUser: { select: { id: true, nom: true, prenom: true } },
    },
  },
  notifications: { orderBy: { createdAt: 'desc' as const } },
  _count: { select: { commentaires: true } },
};

export function canReadLicence(userId: string, role: string, licence: { createdById: string | null; permissions?: { userId: string }[] }) {
  if (role === 'admin') return true;
  if (licence.createdById === userId) return true;
  return !!licence.permissions?.some((p) => p.userId === userId);
}

export function canEditLicenceContent(userId: string, role: string, licence: { createdById: string | null; permissions?: { userId: string; niveau: string }[] }) {
  if (role === 'admin' || licence.createdById === userId) return true;
  return !!licence.permissions?.some(
    (p) => p.userId === userId && ['modification', 'suppression'].includes(p.niveau),
  );
}

export function canSoftDeleteLicence(userId: string, role: string, licence: { createdById: string | null; permissions?: { userId: string; niveau: string }[] }) {
  if (role === 'admin' || licence.createdById === userId) return true;
  return !!licence.permissions?.some((p) => p.userId === userId && p.niveau === 'suppression');
}

export function canManagePermissions(userId: string, role: string, licence: { createdById: string | null }) {
  return role === 'admin' || licence.createdById === userId;
}

async function enrichNotifications(notifications: { id: string; joursAvant: number; active: boolean; destinataireIds: string[]; createdAt: Date }[]) {
  const allIds = [...new Set(notifications.flatMap((n) => n.destinataireIds || []))];
  if (allIds.length === 0) {
    return notifications.map((n) => ({ ...n, destinataires: [] as { id: string; nom: string; prenom: string; email: string }[] }));
  }
  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, nom: true, prenom: true, email: true },
  });
  const map = new Map(users.map((u) => [u.id, u]));
  return notifications.map((n) => ({
    ...n,
    destinataires: (n.destinataireIds || []).map((id) => map.get(id)).filter(Boolean) as { id: string; nom: string; prenom: string; email: string }[],
  }));
}

function formatLicenceRow(l: any) {
  return {
    ...l,
    permissions: (l.permissions || []).map((p: any) => ({
      id: p.id,
      userId: p.userId,
      niveau: p.niveau,
      user: p.user,
    })),
  };
}

export async function formatLicenceFull(l: any) {
  const notifs = await enrichNotifications(l.notifications || []);
  return {
    ...formatLicenceRow(l),
    notifications: notifs,
  };
}

export class LicenceService {
  private visibilityWhere(userId: string, role: string) {
    if (role === 'admin') return {};
    return {
      OR: [
        { createdById: userId },
        { permissions: { some: { userId: userId } } },
      ],
    };
  }

  async findAllActive(userId: string, role: string) {
    const list = await prisma.licence.findMany({
      where: { deletedAt: null, ...this.visibilityWhere(userId, role) },
      include: licenceInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return Promise.all(list.map((l) => formatLicenceFull(l)));
  }

  async findAllDeleted(userId: string, role: string) {
    const where: any = { deletedAt: { not: null } };
    if (role !== 'admin') {
      where.createdById = userId;
    }
    const list = await prisma.licence.findMany({
      where,
      include: licenceInclude,
      orderBy: { deletedAt: 'desc' },
    });
    return Promise.all(list.map((l) => formatLicenceFull(l)));
  }

  async findOne(id: string, userId: string, role: string) {
    const l = await prisma.licence.findUnique({
      where: { id },
      include: licenceInclude,
    });
    if (!l) return null;
    const vis = this.visibilityWhere(userId, role);
    const canSee =
      role === 'admin' ||
      l.createdById === userId ||
      l.permissions.some((p) => p.userId === userId);
    if (!canSee) return null;
    if (l.deletedAt) {
      if (role !== 'admin' && l.createdById !== userId) return null;
    }
    return formatLicenceFull(l);
  }

  async create(data: any, createdById: string) {
    const {
      nom,
      reference,
      typeLicence,
      statut,
      cout,
      devise,
      nombreSieges,
      dateDebut,
      dateFin,
      description,
      contratId,
      processusId,
      clientFournisseurId,
    } = data;

    const l = await prisma.licence.create({
      data: {
        nom,
        reference,
        typeLicence,
        statut: statut || 'active',
        cout: cout != null && cout !== '' ? new Prisma.Decimal(String(cout)) : null,
        devise: devise || null,
        nombreSieges: nombreSieges != null ? parseInt(String(nombreSieges), 10) : null,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        description: description || null,
        contratId: contratId || null,
        processusId: processusId || null,
        clientFournisseurId: clientFournisseurId || null,
        createdById,
      },
      include: licenceInclude,
    });
    return formatLicenceFull(l);
  }

  async update(id: string, data: any, userId: string, role: string) {
    const existing = await prisma.licence.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!existing || existing.deletedAt) throw new Error('Licence non trouvée');
    if (!canEditLicenceContent(userId, role, existing)) throw new Error('Accès refusé');

    const {
      nom,
      reference,
      typeLicence,
      statut,
      cout,
      devise,
      nombreSieges,
      dateDebut,
      dateFin,
      description,
      contratId,
      processusId,
      clientFournisseurId,
    } = data;

    const l = await prisma.licence.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(reference !== undefined && { reference }),
        ...(typeLicence !== undefined && { typeLicence }),
        ...(statut !== undefined && { statut }),
        ...(cout !== undefined && { cout: cout != null && cout !== '' ? new Prisma.Decimal(String(cout)) : null }),
        ...(devise !== undefined && { devise: devise || null }),
        ...(nombreSieges !== undefined && {
          nombreSieges: nombreSieges != null && nombreSieges !== '' ? parseInt(String(nombreSieges), 10) : null,
        }),
        ...(dateDebut !== undefined && { dateDebut: dateDebut ? new Date(dateDebut) : null }),
        ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
        ...(description !== undefined && { description: description || null }),
        ...(contratId !== undefined && { contratId: contratId || null }),
        ...(processusId !== undefined && { processusId: processusId || null }),
        ...(clientFournisseurId !== undefined && { clientFournisseurId: clientFournisseurId || null }),
      },
      include: licenceInclude,
    });
    return formatLicenceFull(l);
  }

  async softDelete(id: string, userId: string, role: string) {
    const existing = await prisma.licence.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!existing || existing.deletedAt) throw new Error('Licence non trouvée');
    if (!canSoftDeleteLicence(userId, role, existing)) throw new Error('Accès refusé');
    return prisma.licence.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: licenceInclude,
    });
  }

  async restore(id: string, userId: string, role: string) {
    const existing = await prisma.licence.findUnique({ where: { id } });
    if (!existing || !existing.deletedAt) throw new Error('Licence non trouvée dans la corbeille');
    if (role !== 'admin' && existing.createdById !== userId) throw new Error('Accès refusé');
    const l = await prisma.licence.update({
      where: { id },
      data: { deletedAt: null },
      include: licenceInclude,
    });
    return formatLicenceFull(l);
  }

  async deletePermanent(id: string) {
    const existing = await prisma.licence.findUnique({
      where: { id },
      include: { documents: { include: { document: true } } },
    });
    if (!existing) throw new Error('Licence non trouvée');

    for (const ld of existing.documents) {
      const doc = ld.document;
      try {
        const fp = path.join(UPLOAD_DIR, doc.fichierUrl);
        await fs.unlink(fp);
      } catch {
        /* ignore */
      }
      await prisma.licenceDocument.deleteMany({ where: { documentId: doc.id } });
      await prisma.document.delete({ where: { id: doc.id } }).catch(() => {});
    }

    await prisma.licence.delete({ where: { id } });
  }

  async addPermission(licenceId: string, userId: string, niveau: string, actorId: string, role: string) {
    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence || licence.deletedAt) throw new Error('Licence non trouvée');
    if (!canManagePermissions(actorId, role, licence)) throw new Error('Accès refusé');
    await prisma.licencePermission.upsert({
      where: { licenceId_userId: { licenceId, userId } },
      create: { licenceId, userId, niveau },
      update: { niveau },
    });
    await this.syncDocumentsPermissionsFromLicence(licenceId);
    return this.findOne(licenceId, actorId, role);
  }

  async removePermission(licenceId: string, targetUserId: string, actorId: string, role: string) {
    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence || licence.deletedAt) throw new Error('Licence non trouvée');
    if (!canManagePermissions(actorId, role, licence)) throw new Error('Accès refusé');
    await prisma.licencePermission.deleteMany({ where: { licenceId, userId: targetUserId } });
    await this.syncDocumentsPermissionsFromLicence(licenceId);
    return this.findOne(licenceId, actorId, role);
  }

  async addCommentaire(licenceId: string, auteurId: string, role: string, contenu: string, assigneA: string | null) {
    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence || licence.deletedAt) throw new Error('Licence non trouvée');
    if (!canReadLicence(auteurId, role, licence)) throw new Error('Accès refusé');
    await prisma.licenceCommentaire.create({
      data: {
        licenceId,
        userId: auteurId,
        contenu,
        assigneAId: assigneA || null,
      },
    });
    return this.findOne(licenceId, auteurId, role);
  }

  async setNotification(licenceId: string, actorId: string, role: string, body: { joursAvant: number; destinataires: string[] }) {
    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence || licence.deletedAt) throw new Error('Licence non trouvée');
    if (!canEditLicenceContent(actorId, role, licence)) throw new Error('Accès refusé');
    await prisma.licenceNotification.create({
      data: {
        licenceId,
        joursAvant: body.joursAvant,
        active: true,
        destinataireIds: body.destinataires || [],
      },
    });
    return this.findOne(licenceId, actorId, role);
  }

  /** Aligne DocumentPermission de tous les documents liés sur créateur + utilisateurs autorisés sur la licence. */
  async syncDocumentsPermissionsFromLicence(licenceId: string) {
    await prisma.document.updateMany({
      where: { referenceType: 'licence', referenceId: licenceId, deletedAt: null },
      data: { estConfidentiel: true },
    });

    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence || licence.deletedAt) return;
    const userIds = new Set<string>();
    if (licence.createdById) userIds.add(licence.createdById);
    for (const p of licence.permissions) userIds.add(p.userId);
    const ids = [...userIds];
    const docs = await prisma.document.findMany({
      where: { referenceType: 'licence', referenceId: licenceId, deletedAt: null },
      select: { id: true },
    });
    for (const d of docs) {
      await prisma.documentPermission.deleteMany({ where: { documentId: d.id } });
      if (ids.length > 0) {
        await prisma.documentPermission.createMany({
          data: ids.map((userId) => ({ documentId: d.id, userId })),
          skipDuplicates: true,
        });
      }
    }
  }

  async attachUploadedFile(
    licenceId: string,
    actorId: string,
    role: string,
    file: Express.Multer.File,
    nom: string,
  ) {
    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence || licence.deletedAt) throw new Error('Licence non trouvée');
    if (!canEditLicenceContent(actorId, role, licence)) throw new Error('Accès refusé');

    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }

    const doc = await prisma.document.create({
      data: {
        nom: nom || file.originalname,
        typeDocument: 'licence',
        referenceType: 'licence',
        referenceId: licenceId,
        fichierUrl: file.filename,
        fichierNomOriginal: file.originalname,
        fichierTaille: file.size,
        fichierType: file.mimetype,
        uploadedById: actorId,
        statut: 'valide',
        estConfidentiel: true,
        version: '1.0.0',
        versionMajeure: 1,
        versionMineure: 0,
      },
    });

    await prisma.licenceDocument.create({
      data: { licenceId, documentId: doc.id },
    });

    await this.syncDocumentsPermissionsFromLicence(licenceId);

    return this.findOne(licenceId, actorId, role);
  }

  async getHistory(licenceId: string, userId: string, role: string) {
    const licence = await prisma.licence.findUnique({
      where: { id: licenceId },
      include: { permissions: true },
    });
    if (!licence) return null;
    if (!canReadLicence(userId, role, licence)) return null;
    if (licence.deletedAt && role !== 'admin' && licence.createdById !== userId) return null;

    const entries = await prisma.journalAcces.findMany({
      where: { ressourceType: 'licence', ressourceId: licenceId },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    return entries;
  }

  /** Pour la corbeille admin : toutes les licences supprimées */
  async findAllDeletedAdmin() {
    const list = await prisma.licence.findMany({
      where: { deletedAt: { not: null } },
      include: licenceInclude,
      orderBy: { deletedAt: 'desc' },
    });
    return Promise.all(list.map((l) => formatLicenceFull(l)));
  }
}
