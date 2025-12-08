import { prisma } from '../utils/prisma';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const COMMENTS_DIR = path.join(UPLOAD_DIR, 'comments');

export class DocumentCommentService {
  async ensureCommentsDir() {
    try {
      await fs.access(COMMENTS_DIR);
    } catch {
      await fs.mkdir(COMMENTS_DIR, { recursive: true });
    }
  }

  async list(documentId: string) {
    return prisma.documentComment.findMany({
      where: { documentId },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(
    documentId: string,
    userId: string,
    contenu: string,
    file?: Express.Multer.File
  ) {
    if (!contenu || !contenu.trim()) {
      throw new Error('Le contenu du commentaire est requis');
    }

    let pieceJointeNom: string | undefined;
    let pieceJointePath: string | undefined;
    let pieceJointeType: string | undefined;
    let pieceJointeTaille: number | undefined;

    // Gérer l'upload du fichier si présent
    if (file) {
      await this.ensureCommentsDir();
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(COMMENTS_DIR, fileName);

      await fs.writeFile(filePath, file.buffer);

      pieceJointeNom = file.originalname;
      pieceJointePath = `comments/${fileName}`;
      pieceJointeType = file.mimetype;
      pieceJointeTaille = file.size;
    }

    return prisma.documentComment.create({
      data: {
        documentId,
        userId,
        contenu: contenu.trim(),
        pieceJointeNom,
        pieceJointePath,
        pieceJointeType,
        pieceJointeTaille,
      },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
    });
  }

  async downloadAttachment(commentId: string) {
    const comment = await prisma.documentComment.findUnique({
      where: { id: commentId },
      select: { pieceJointePath: true, pieceJointeNom: true, pieceJointeType: true },
    });

    if (!comment || !comment.pieceJointePath) {
      throw new Error('Pièce jointe non trouvée');
    }

    const filePath = path.join(UPLOAD_DIR, comment.pieceJointePath);
    const fileBuffer = await fs.readFile(filePath);

    return {
      buffer: fileBuffer,
      originalName: comment.pieceJointeNom || 'attachment',
      mimeType: comment.pieceJointeType || 'application/octet-stream',
    };
  }
}

    });
  }

  async add(
    documentId: string,
    userId: string,
    contenu: string,
    file?: Express.Multer.File
  ) {
    if (!contenu || !contenu.trim()) {
      throw new Error('Le contenu du commentaire est requis');
    }

    let pieceJointeNom: string | undefined;
    let pieceJointePath: string | undefined;
    let pieceJointeType: string | undefined;
    let pieceJointeTaille: number | undefined;

    // Gérer l'upload du fichier si présent
    if (file) {
      await this.ensureCommentsDir();
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(COMMENTS_DIR, fileName);

      await fs.writeFile(filePath, file.buffer);

      pieceJointeNom = file.originalname;
      pieceJointePath = `comments/${fileName}`;
      pieceJointeType = file.mimetype;
      pieceJointeTaille = file.size;
    }

    return prisma.documentComment.create({
      data: {
        documentId,
        userId,
        contenu: contenu.trim(),
        pieceJointeNom,
        pieceJointePath,
        pieceJointeType,
        pieceJointeTaille,
      },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
    });
  }

  async downloadAttachment(commentId: string) {
    const comment = await prisma.documentComment.findUnique({
      where: { id: commentId },
      select: { pieceJointePath: true, pieceJointeNom: true, pieceJointeType: true },
    });

    if (!comment || !comment.pieceJointePath) {
      throw new Error('Pièce jointe non trouvée');
    }
    const filePath = path.join(UPLOAD_DIR, comment.pieceJointePath);
    const fileBuffer = await fs.readFile(filePath);

    return {
      buffer: fileBuffer,
      originalName: comment.pieceJointeNom || 'attachment',
      mimeType: comment.pieceJointeType || 'application/octet-stream',
    };
  }
}
