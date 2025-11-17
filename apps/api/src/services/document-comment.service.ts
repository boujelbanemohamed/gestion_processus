import { prisma } from '../utils/prisma';

export class DocumentCommentService {
  async list(documentId: string) {
    return prisma.documentComment.findMany({
      where: { documentId },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(documentId: string, userId: string, contenu: string) {
    if (!contenu || !contenu.trim()) {
      throw new Error('Le contenu du commentaire est requis');
    }
    return prisma.documentComment.create({
      data: { documentId, userId, contenu: contenu.trim() },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
    });
  }
}
