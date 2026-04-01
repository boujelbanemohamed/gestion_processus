import { prisma } from '../utils/prisma';
import { LicenceService } from './licence.service';
import { clientFournisseurService, logCfHistory } from './client-fournisseur.service';
import { contratService } from './contrat.service';
import { EntiteService } from './entite.service';

const licenceService = new LicenceService();
const entiteService = new EntiteService();

export class CorbeilleService {
  // Récupérer tous les processus supprimés
  async getProcessusSupprimes() {
    return prisma.processus.findMany({
      where: {
        deletedAt: { not: null },
      },
      include: {
        proprietaire: { select: { id: true, nom: true, prenom: true, email: true } },
        createdBy: { select: { id: true, nom: true, prenom: true } },
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
        categories: {
          include: {
            categorie: { select: { id: true, nom: true, couleur: true } },
          },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  // Récupérer tous les documents supprimés
  async getDocumentsSupprimes() {
    const documents = await prisma.document.findMany({
      where: {
        deletedAt: { not: null },
      },
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true, email: true } },
        valideBy: { select: { id: true, nom: true, prenom: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, nom: true, prenom: true } },
          },
        },
        permissionsUtilisateurs: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });

    // Enrichir avec les informations du processus
    const documentsWithProcessus = await Promise.all(
      documents.map(async (doc) => {
        let processus = null;
        if (doc.referenceType === 'processus' && doc.referenceId) {
          processus = await prisma.processus.findUnique({
            where: { id: doc.referenceId },
            select: { id: true, nom: true, codeProcessus: true },
          });
        }
        return {
          ...doc,
          processus: processus || null,
        };
      })
    );

    return documentsWithProcessus;
  }

  async getLicencesSupprimees() {
    return licenceService.findAllDeletedAdmin();
  }

  async restaurerLicence(id: string, userId: string, role: string) {
    return licenceService.restore(id, userId, role);
  }

  async supprimerDefinitivementLicence(id: string) {
    return licenceService.deletePermanent(id);
  }

  // Restaurer un processus
  async restaurerProcessus(id: string) {
    return prisma.processus.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        proprietaire: { select: { id: true, nom: true, prenom: true } },
        entites: {
          include: {
            entite: { select: { id: true, nom: true, code: true } },
          },
        },
        categories: {
          include: {
            categorie: { select: { id: true, nom: true, couleur: true } },
          },
        },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  // Restaurer un document
  async restaurerDocument(id: string) {
    return prisma.document.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
        valideBy: { select: { id: true, nom: true, prenom: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, nom: true, prenom: true } },
          },
        },
        permissionsUtilisateurs: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
      },
    });
  }

  // Supprimer définitivement un processus (hard delete)
  async supprimerDefinitivementProcessus(id: string) {
    return prisma.processus.delete({ where: { id } });
  }

  // Supprimer définitivement un document (hard delete)
  async supprimerDefinitivementDocument(id: string) {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const UPLOAD_DIR = path.default.join(process.cwd(), 'uploads');

    // Récupérer le document pour supprimer les fichiers
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: true,
      },
    });

    if (!document) {
      throw new Error('Document non trouvé');
    }

    // Supprimer le fichier principal
    try {
      const filePath = path.default.join(UPLOAD_DIR, document.fichierUrl);
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Fichier principal non trouvé: ${document.fichierUrl}`);
    }

    // Supprimer les versions
    for (const version of document.versions) {
      try {
        const versionPath = path.default.join(UPLOAD_DIR, version.fichierUrl);
        await fs.unlink(versionPath);
      } catch (error) {
        console.warn(`Version non trouvée: ${version.fichierUrl}`);
      }
    }

    // Supprimer le document de la base de données
    return prisma.document.delete({ where: { id } });
  }

  async getClientsFournisseursSupprimes() {
    return clientFournisseurService.listDeletedForCorbeille();
  }

  async restaurerClientFournisseur(id: string, userId: string) {
    const row = await clientFournisseurService.restoreFromCorbeille(id);
    await logCfHistory(id, userId, 'restauration', 'Fiche restaurée depuis la corbeille');
    return row;
  }

  async supprimerDefinitivementClientFournisseur(id: string) {
    return clientFournisseurService.deletePermanent(id);
  }

  async getContratsSupprimes() {
    return contratService.listDeletedForCorbeille();
  }

  async restaurerContrat(id: string, userId: string) {
    return contratService.restoreFromCorbeille(id, userId);
  }

  async supprimerDefinitivementContrat(id: string) {
    return contratService.deletePermanent(id);
  }

  async getEntitesSupprimees() {
    return entiteService.listDeletedForCorbeille();
  }

  async restaurerEntite(id: string) {
    return entiteService.restoreFromCorbeille(id);
  }

  async supprimerDefinitivementEntite(id: string) {
    return entiteService.deletePermanent(id);
  }
}
