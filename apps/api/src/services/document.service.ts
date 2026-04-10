import { prisma } from '../utils/prisma';
import { DocType, DocStatut, RefType } from '@prisma/client';
import { canEditLicenceContent, canReadLicence } from './licence.service';
import { ProcessusService } from './processus.service';
import { ProjetService } from './projet.service';
import { promises as fs } from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const processusService = new ProcessusService();
const projetService = new ProjetService();

/** Filtre documents par rattachement métier (query linkType + linkId). */
function buildDocumentLinkClause(linkType: string, linkId: string): Record<string, unknown> | null {
  if (!linkType?.trim() || !linkId?.trim()) return null;
  switch (linkType) {
    case 'processus':
    case 'projet':
    case 'entite':
    case 'clientFournisseur':
      return { referenceType: linkType as RefType, referenceId: linkId };
    case 'uploadedBy':
      return { uploadedById: linkId };
    case 'contrat':
      return { contrats: { some: { contratId: linkId } } };
    case 'tache':
      return {
        tacheDocuments: { some: { tacheId: linkId, tache: { deletedAt: null } } },
      };
    case 'epic':
      return {
        epicDocuments: { some: { epicId: linkId, epic: { deletedAt: null } } },
      };
    case 'userStory':
      return {
        OR: [
          { tacheDocuments: { some: { tache: { userStoryId: linkId, deletedAt: null } } } },
          {
            epicDocuments: {
              some: {
                epic: {
                  deletedAt: null,
                  userStories: { some: { id: linkId, deletedAt: null } },
                },
              },
            },
          },
        ],
      };
    case 'licence':
      return {
        OR: [
          { AND: [{ referenceType: 'licence' as RefType }, { referenceId: linkId }] },
          { licenceDocuments: { some: { licenceId: linkId } } },
        ],
      };
    case 'pvReunion':
      return {
        OR: [
          { AND: [{ referenceType: 'pvReunion' as RefType }, { referenceId: linkId }] },
          { pvReunionsPrincipal: { some: { id: linkId, deletedAt: null } } },
          { pvReunionCommentPieces: { some: { pvReunionId: linkId } } },
        ],
      };
    default:
      return null;
  }
}

export class DocumentService {
  async ensureUploadDir() {
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  async findAll(filters?: {
    typeDocument?: DocType;
    referenceType?: RefType;
    referenceId?: string;
    linkType?: string;
    linkId?: string;
    statut?: DocStatut;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = { deletedAt: null };
    if (filters?.typeDocument) where.typeDocument = filters.typeDocument;
    if (filters?.statut) where.statut = filters.statut;

    const andParts: any[] = [];
    if (filters?.search) {
      andParts.push({
        OR: [
          { nom: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    let linkClause: Record<string, unknown> | null = null;
    if (filters?.linkType && filters?.linkId) {
      linkClause = buildDocumentLinkClause(filters.linkType, filters.linkId);
    } else if (filters?.referenceType && filters?.referenceId) {
      linkClause = buildDocumentLinkClause(String(filters.referenceType), filters.referenceId);
    }
    if (linkClause) andParts.push(linkClause);
    if (andParts.length > 0) where.AND = andParts;

    // Définir l'ordre de tri
    let orderBy: any = { createdAt: 'desc' }; // Par défaut, tri par date de création décroissante
    
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'asc';
      
      switch (filters.sortBy) {
        case 'nom':
          orderBy = { nom: sortOrder };
          break;
        case 'typeDocument':
          orderBy = { typeDocument: sortOrder };
          break;
        case 'statut':
          orderBy = { statut: sortOrder };
          break;
        case 'createdAt':
          orderBy = { createdAt: sortOrder };
          break;
        case 'updatedAt':
          orderBy = { updatedAt: sortOrder };
          break;
        case 'uploadedBy':
          // Pour uploadedBy, on trie par nom de l'utilisateur (via relation)
          orderBy = { uploadedBy: { nom: sortOrder } };
          break;
        default:
          orderBy = { createdAt: 'desc' };
      }
    }

    // Pièces liées à une licence : toujours confidentielles (rattrapage + cohérence métier)
    await prisma.document.updateMany({
      where: {
        deletedAt: null,
        estConfidentiel: false,
        OR: [{ typeDocument: 'licence' }, { referenceType: 'licence' }],
      },
      data: { estConfidentiel: true },
    });

    const documents = await prisma.document.findMany({
      where,
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
        tacheDocuments: {
          include: {
            tache: { select: { id: true, nom: true } },
          },
        },
        epicDocuments: {
          include: {
            epic: { select: { id: true, nom: true } },
          },
        },
        _count: { select: { versions: true } },
      },
      orderBy,
    });

    // Enrichir avec les informations du processus et les statistiques
    const licenceCache = new Map<
      string,
      {
        id: string;
        nom: string;
        reference: string;
        createdBy: { id: string; prenom: string; nom: string; email: string } | null;
        permissions: { niveau: string; user: { id: string; prenom: string; nom: string; email: string } }[];
      } | null
    >();
    const documentsWithProcessus = await Promise.all(
      documents.map(async (doc) => {
        let processus = null;
        if (doc.referenceType === 'processus' && doc.referenceId) {
          processus = await prisma.processus.findUnique({
            where: { id: doc.referenceId },
            select: { id: true, nom: true, codeProcessus: true },
          });
        }
        let projet = null;
        if (doc.referenceType === 'projet' && doc.referenceId) {
          projet = await prisma.projet.findUnique({
            where: { id: doc.referenceId },
            select: { id: true, nom: true, codeProjet: true },
          });
        }
        let licence = null;
        const licenceRefId =
          doc.referenceId && (doc.referenceType === 'licence' || doc.typeDocument === 'licence')
            ? doc.referenceId
            : null;
        if (licenceRefId) {
          if (!licenceCache.has(licenceRefId)) {
            licenceCache.set(
              licenceRefId,
              await prisma.licence.findUnique({
                where: { id: licenceRefId },
                select: {
                  id: true,
                  nom: true,
                  reference: true,
                  createdBy: { select: { id: true, prenom: true, nom: true, email: true } },
                  permissions: {
                    include: { user: { select: { id: true, prenom: true, nom: true, email: true } } },
                  },
                },
              }),
            );
          }
          licence = licenceCache.get(licenceRefId) ?? null;
        }
        // Récupérer les contrats liés
        const contrats = await prisma.contratDocument.findMany({
          where: { documentId: doc.id },
          include: { contrat: { select: { id: true, nom: true, statut: true } } },
        });
        
        // Compter les téléchargements et visualisations
        const [telechargements, visualisations] = await Promise.all([
          prisma.journalAcces.count({
            where: {
              ressourceType: 'document',
              ressourceId: doc.id,
              action: 'telechargement',
            },
          }),
          prisma.journalAcces.count({
            where: {
              ressourceType: 'document',
              ressourceId: doc.id,
              action: 'lecture',
            },
          }),
        ]);
        
        return {
          ...doc,
          processus: processus || null,
          projet: projet || null,
          licence: licence || null,
          contrats: contrats || [],
          nombreTelechargements: telechargements,
          nombreVisualisations: visualisations,
        };
      })
    );

    return documentsWithProcessus;
  }

  async findOne(id: string) {
    const document = await prisma.document.findFirst({
      where: { 
        id,
        deletedAt: null, // Exclure les documents supprimés
      },
      include: {
        uploadedBy: true,
        valideBy: true,
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

    if (!document) {
      return null;
    }

    // Compter les téléchargements et visualisations
    const [telechargements, visualisations] = await Promise.all([
      prisma.journalAcces.count({
        where: {
          ressourceType: 'document',
          ressourceId: id,
          action: 'telechargement',
        },
      }),
      prisma.journalAcces.count({
        where: {
          ressourceType: 'document',
          ressourceId: id,
          action: 'lecture',
        },
      }),
    ]);

    return {
      ...document,
      nombreTelechargements: telechargements,
      nombreVisualisations: visualisations,
    };
  }

  async canUserAccessDocument(documentId: string, userId: string, role?: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        permissionsUtilisateurs: true,
        uploadedBy: { select: { id: true } },
      },
    });

    if (!document) return false;

    if (role === 'admin') return true;

    // Document rattaché à un processus : il faut d'abord pouvoir accéder au détail du processus
    if (document.referenceType === 'processus' && document.referenceId) {
      const procAccess = await processusService.canAccess(
        document.referenceId,
        userId,
        role || 'lecteur'
      );
      if (!procAccess.canAccess) {
        return false;
      }
    }

    if (document.referenceType === 'projet' && document.referenceId) {
      const projAccess = await projetService.canAccess(
        document.referenceId,
        userId,
        role || 'lecteur'
      );
      if (!projAccess.canAccess) {
        return false;
      }
    }

    // Si le document n'est pas confidentiel, l'accès ressource parente (ci-dessus) suffit
    if (!document.estConfidentiel) return true;

    // L'utilisateur qui a uploadé peut toujours accéder
    if (document.uploadedById === userId) return true;

    if (document.referenceType === 'licence' && document.referenceId) {
      const licence = await prisma.licence.findUnique({
        where: { id: document.referenceId },
        include: { permissions: true },
      });
      if (licence && !licence.deletedAt && canReadLicence(userId, role || 'lecteur', licence)) {
        return true;
      }
    }

    // Vérifier si le document est lié à un processus et si l'utilisateur est propriétaire ou créateur
    if (document.referenceType === 'processus' && document.referenceId) {
      const processus = await prisma.processus.findUnique({
        where: { id: document.referenceId },
        select: { proprietaireId: true, createdById: true },
      });
      if (processus && (processus.proprietaireId === userId || processus.createdById === userId)) {
        return true;
      }
    }
    // Vérifier si le document est lié à un projet et si l'utilisateur fait partie de la gouvernance
    if (document.referenceType === 'projet' && document.referenceId) {
      const projet = await prisma.projet.findUnique({
        where: { id: document.referenceId },
        include: {
          sponsors: true,
          chefsProjet: true,
          techLeads: true,
          equipe: true,
        },
      });
      if (projet) {
        if (projet.createdById === userId) return true;
        if (projet.responsableId === userId) return true;
        if (projet.gestionnaireId === userId) return true;
        const gouvernanceIds = [
          ...projet.sponsors.map((s: any) => s.userId),
          ...projet.chefsProjet.map((s: any) => s.userId),
          ...projet.techLeads.map((s: any) => s.userId),
          ...projet.equipe.map((s: any) => s.userId),
        ];
        if (gouvernanceIds.includes(userId)) return true;
      }
    }

    // Vérifier si l'utilisateur est dans la liste des permissions
    const hasPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId,
        userId,
      },
    });

    return !!hasPermission;
  }

  /** Métadonnées d'un document confidentiel : licence = droit de modification sur la fiche licence ; sinon = accès lecture du document. */
  async canUserModifyConfidentialDocument(documentId: string, userId: string, role?: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { estConfidentiel: true, referenceType: true, referenceId: true },
    });
    if (!document) return false;
    if (!document.estConfidentiel) return true;
    if (role === 'admin') return true;
    if (document.referenceType === 'licence' && document.referenceId) {
      const licence = await prisma.licence.findUnique({
        where: { id: document.referenceId },
        include: { permissions: true },
      });
      return !!(licence && !licence.deletedAt && canEditLicenceContent(userId, role || 'lecteur', licence));
    }
    return this.canUserAccessDocument(documentId, userId, role);
  }

  async canUserDeleteOrAddVersion(documentId: string, userId: string, role?: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        permissionsUtilisateurs: true,
        uploadedBy: { select: { id: true } },
      },
    });

    if (!document) return false;

    if (role === 'admin') return true;

    const canVoir = await this.canUserAccessDocument(documentId, userId, role);
    if (!canVoir) return false;

    // Si le document n'est pas confidentiel, l'accès lecture (incl. droit sur projet/processus) suffit pour la suite
    if (!document.estConfidentiel) return true;

    // L'utilisateur qui a uploadé peut toujours supprimer/ajouter version
    if (document.uploadedById === userId) return true;

    // Pièce licence : seuls modification/suppression sur la licence (pas le simple droit DocumentPermission « lecture »)
    if (document.referenceType === 'licence' && document.referenceId) {
      const licence = await prisma.licence.findUnique({
        where: { id: document.referenceId },
        include: { permissions: true },
      });
      if (!licence || licence.deletedAt) return false;
      return canEditLicenceContent(userId, role || 'lecteur', licence);
    }

    // Pour les documents confidentiels, seuls les utilisateurs explicitement dans la liste des permissions peuvent supprimer/ajouter version
    // (le propriétaire/créateur du processus n'a pas automatiquement ce droit, sauf s'il est dans la liste)
    const hasPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId,
        userId,
      },
    });

    return !!hasPermission;
  }

  async create(data: {
    nom: string;
    typeDocument: DocType;
    referenceType?: RefType;
    referenceId?: string;
    fichierUrl: string;
    fichierNomOriginal: string;
    fichierTaille: number;
    fichierType: string;
    description?: string;
    uploadedById: string;
    versionMajeure?: number;
    versionMineure?: number;
    versionPatch?: number;
    tags?: any;
    estConfidentiel?: boolean;
    permissionUserIds?: string[];
  }) {
    const version = `${data.versionMajeure || 1}.${data.versionMineure || 0}.${data.versionPatch || 0}`;
    
    // Extraire versionPatch et permissionUserIds car ils n'existent pas dans le schéma Prisma directement
    const { versionPatch, permissionUserIds, ...documentData } = data;
    
    const document = await prisma.document.create({
      data: {
        ...documentData,
        version,
        statut: 'brouillon',
      },
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
      },
    });

    // Créer les permissions si le document est confidentiel et qu'il y a des utilisateurs sélectionnés
    if (data.estConfidentiel && permissionUserIds && permissionUserIds.length > 0) {
      await prisma.documentPermission.createMany({
        data: permissionUserIds.map(userId => ({
          documentId: document.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }
    
    return document;
  }

  async createVersion(documentId: string, data: {
    fichierUrl: string;
    commentaireVersion?: string;
    uploadedById: string;
  }) {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error('Document non trouvé');

    const versionParts = (document.version || '1.0.0').split('.');
    const newMinor = parseInt(versionParts[1] || '0') + 1;
    const newVersion = `${versionParts[0]}.${newMinor}.0`;

    await prisma.versionDocument.create({
      data: {
        documentId,
        version: newVersion,
        ...data,
      },
    });

    return prisma.document.update({
      where: { id: documentId },
      data: {
        version: newVersion,
        versionMineure: newMinor,
      },
    });
  }

  async update(id: string, data: {
    nom?: string;
    description?: string;
    statut?: DocStatut;
    estConfidentiel?: boolean;
    tags?: any;
    valideById?: string;
    permissionUserIds?: string[];
  }) {
    const { permissionUserIds, ...rest } = data;
    const updateData: typeof rest & { dateValidation?: Date } = { ...rest };
    if (data.statut === 'valide' && data.valideById) {
      updateData.dateValidation = new Date();
    }

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
      },
    });

    // Gérer les permissions si le document est confidentiel
    if (data.estConfidentiel !== undefined) {
      // Supprimer toutes les permissions existantes
      await prisma.documentPermission.deleteMany({
        where: { documentId: id },
      });

      // Créer les nouvelles permissions si le document est confidentiel
      if (data.estConfidentiel && permissionUserIds && permissionUserIds.length > 0) {
        await prisma.documentPermission.createMany({
          data: permissionUserIds.map(userId => ({
            documentId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    } else if (permissionUserIds !== undefined) {
      // Si on met à jour seulement les permissions sans changer estConfidentiel
      // Supprimer toutes les permissions existantes
      await prisma.documentPermission.deleteMany({
        where: { documentId: id },
      });

      // Créer les nouvelles permissions
      if (permissionUserIds.length > 0) {
        await prisma.documentPermission.createMany({
          data: permissionUserIds.map(userId => ({
            documentId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return document;
  }

  async delete(id: string) {
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) throw new Error('Document non trouvé');

    // Supprimer le fichier physique
    try {
      const filePath = path.join(UPLOAD_DIR, document.fichierUrl);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignorer si le fichier n'existe pas
      console.warn(`Fichier non trouvé: ${document.fichierUrl}`);
    }

    // Soft delete : marquer comme supprimé au lieu de supprimer réellement
    // Les fichiers physiques seront supprimés lors d'une suppression définitive depuis la corbeille
    return prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}