import { prisma } from '../utils/prisma';

export class FavorisService {
  // Récupérer tous les favoris d'un utilisateur (processus et documents)
  async getFavorisByUser(userId: string) {
    const [favorisProcessus, favorisDocuments] = await Promise.all([
      prisma.favorisProcessus.findMany({
        where: { userId },
        include: {
          processus: {
            include: {
              proprietaire: { select: { id: true, nom: true, prenom: true } },
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
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favorisDocument.findMany({
        where: { userId },
        include: {
          document: {
            include: {
              uploadedBy: { select: { id: true, nom: true, prenom: true, email: true } },
              valideBy: { select: { id: true, nom: true, prenom: true } },
              versions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Enrichir les documents avec les informations du processus
    const documentsWithProcessus = await Promise.all(
      favorisDocuments.map(async (fav) => {
        let processus = null;
        if (fav.document.referenceType === 'processus' && fav.document.referenceId) {
          processus = await prisma.processus.findUnique({
            where: { id: fav.document.referenceId },
            select: { id: true, nom: true, codeProcessus: true },
          });
        }
        return {
          ...fav,
          document: {
            ...fav.document,
            processus: processus || null,
          },
        };
      })
    );

    return {
      processus: favorisProcessus.map((fav) => fav.processus),
      documents: documentsWithProcessus.map((fav) => fav.document),
    };
  }

  // Ajouter un processus aux favoris
  async ajouterProcessusFavori(userId: string, processusId: string) {
    // Vérifier si le processus existe et n'est pas supprimé
    const processus = await prisma.processus.findFirst({
      where: {
        id: processusId,
        deletedAt: null,
      },
    });

    if (!processus) {
      throw new Error('Processus non trouvé ou supprimé');
    }

    // Vérifier si déjà en favoris
    const existe = await prisma.favorisProcessus.findUnique({
      where: {
        userId_processusId: {
          userId,
          processusId,
        },
      },
    });

    if (existe) {
      throw new Error('Ce processus est déjà dans vos favoris');
    }

    return prisma.favorisProcessus.create({
      data: {
        userId,
        processusId,
      },
      include: {
        processus: {
          include: {
            proprietaire: { select: { id: true, nom: true, prenom: true } },
            createdBy: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });
  }

  // Retirer un processus des favoris
  async retirerProcessusFavori(userId: string, processusId: string) {
    return prisma.favorisProcessus.delete({
      where: {
        userId_processusId: {
          userId,
          processusId,
        },
      },
    });
  }

  // Ajouter un document aux favoris
  async ajouterDocumentFavori(userId: string, documentId: string) {
    // Vérifier si le document existe et n'est pas supprimé
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new Error('Document non trouvé ou supprimé');
    }

    // Vérifier si déjà en favoris
    const existe = await prisma.favorisDocument.findUnique({
      where: {
        userId_documentId: {
          userId,
          documentId,
        },
      },
    });

    if (existe) {
      throw new Error('Ce document est déjà dans vos favoris');
    }

    return prisma.favorisDocument.create({
      data: {
        userId,
        documentId,
      },
      include: {
        document: {
          include: {
            uploadedBy: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });
  }

  // Retirer un document des favoris
  async retirerDocumentFavori(userId: string, documentId: string) {
    return prisma.favorisDocument.delete({
      where: {
        userId_documentId: {
          userId,
          documentId,
        },
      },
    });
  }

  // Vérifier si un processus est en favoris
  async estProcessusFavori(userId: string, processusId: string): Promise<boolean> {
    const favori = await prisma.favorisProcessus.findUnique({
      where: {
        userId_processusId: {
          userId,
          processusId,
        },
      },
    });
    return !!favori;
  }

  // Vérifier si un document est en favoris
  async estDocumentFavori(userId: string, documentId: string): Promise<boolean> {
    const favori = await prisma.favorisDocument.findUnique({
      where: {
        userId_documentId: {
          userId,
          documentId,
        },
      },
    });
    return !!favori;
  }
}

