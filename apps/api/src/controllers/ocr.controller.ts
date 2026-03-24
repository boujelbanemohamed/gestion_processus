import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const UPLOADS_DIR = '/app/uploads';
const OCR_DIR = '/app/uploads/ocr';

// Créer les dossiers si inexistants
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(OCR_DIR)) fs.mkdirSync(OCR_DIR, { recursive: true });

interface AuthRequest extends Request {
  user?: any;
}

// Convertir PDF en images puis OCR
function ocrPdf(filePath: string, docId: string): string {
  try {
    const outDir = path.join(OCR_DIR, docId);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    // Convertir PDF en images avec pdftoppm
    execSync(`pdftoppm -r 200 "${filePath}" "${outDir}/page"`, { timeout: 60000 });
    // OCR sur chaque image
    const images = fs.readdirSync(outDir).filter(f => f.endsWith('.ppm') || f.endsWith('.png') || f.endsWith('.jpg'));
    let fullText = '';
    for (const img of images.sort()) {
      const imgPath = path.join(outDir, img);
      try {
        const text = execSync(`tesseract "${imgPath}" stdout -l fra+eng+ara`, { timeout: 30000 }).toString();
        fullText += text + '\n';
      } catch (e) { /* continuer si une page échoue */ }
    }
    return fullText.trim();
  } catch (e: any) {
    throw new Error(`Erreur OCR PDF: ${e.message}`);
  }
}

// OCR sur image directe
function ocrImage(filePath: string): string {
  try {
    const text = execSync(`tesseract "${filePath}" stdout -l fra+eng+ara`, { timeout: 30000 }).toString();
    return text.trim();
  } catch (e: any) {
    throw new Error(`Erreur OCR image: ${e.message}`);
  }
}

// OCR sur DOCX via mammoth
async function ocrDocx(filePath: string): Promise<string> {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch (e: any) {
    throw new Error(`Erreur extraction DOCX: ${e.message}`);
  }
}

// GET /api/v1/ocr/documents - Liste tous les documents avec statut OCR
export const getDocumentsOcr = async (req: AuthRequest, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      where: { deletedAt: null },
      select: {
        id: true, nom: true, fichierUrl: true, fichierType: true,
        fichierTaille: true, typeDocument: true, ocrTraite: true,
        ocrDate: true, texteOcr: true, createdAt: true, estConfidentiel: true,
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
        permissionsUtilisateurs: {
          include: { user: { select: { id: true, nom: true, prenom: true } } }
        },
        contrats: {
          include: {
            contrat: {
              select: {
                id: true, nom: true,
                permissions: {
                  include: { user: { select: { id: true, nom: true, prenom: true } } }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/v1/ocr/scan/:id - Scanner un document spécifique
export const scanDocument = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document non trouvé' });

    const filePath = path.join(UPLOADS_DIR, doc.fichierUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé sur le serveur' });

    let texte = '';
    const mime = doc.fichierType || '';
    const ext = path.extname(doc.fichierUrl).toLowerCase();

    if (mime === 'application/pdf' || ext === '.pdf') {
      texte = ocrPdf(filePath, doc.id);
    } else if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(ext)) {
      texte = ocrImage(filePath);
    } else if (mime.includes('word') || ext === '.docx' || ext === '.doc') {
      texte = await ocrDocx(filePath);
    } else {
      return res.status(400).json({ error: `Type de fichier non supporté: ${mime}` });
    }

    // Sauvegarder en BDD
    const updated = await prisma.document.update({
      where: { id },
      data: { texteOcr: texte, ocrTraite: true, ocrDate: new Date() }
    });

    // Sauvegarder en fichier .txt
    const txtPath = path.join(OCR_DIR, `${doc.id}.txt`);
    fs.writeFileSync(txtPath, texte, 'utf8');

    res.json({ success: true, documentId: id, longueurTexte: texte.length, apercu: texte.substring(0, 300) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/v1/ocr/scan-all - Scanner tous les documents non traités
export const scanAll = async (req: AuthRequest, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      where: { deletedAt: null, ocrTraite: false }
    });
    res.json({ message: `${documents.length} documents en attente de traitement`, ids: documents.map(d => d.id) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/v1/ocr/search?q= - Recherche full-text dans les textes OCR
export const searchOcr = async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ error: 'Terme de recherche trop court (min 2 caractères)' });
  }
  try {
    const documents = await prisma.document.findMany({
      where: {
        deletedAt: null,
        ocrTraite: true,
        texteOcr: { contains: q, mode: 'insensitive' }
      },
      select: {
        id: true, nom: true, fichierUrl: true, fichierType: true,
        typeDocument: true, ocrDate: true, texteOcr: true, createdAt: true,
        uploadedBy: { select: { nom: true, prenom: true } }
      },
      orderBy: { ocrDate: 'desc' }
    });

    // Extraire les extraits pertinents
    const results = documents.map(doc => {
      const texte = doc.texteOcr || '';
      const idx = texte.toLowerCase().indexOf(q.toLowerCase());
      const extrait = idx >= 0
        ? '...' + texte.substring(Math.max(0, idx - 100), idx + 200) + '...'
        : texte.substring(0, 200) + '...';
      return { ...doc, texteOcr: undefined, extrait, occurrences: (texte.toLowerCase().match(new RegExp(q.toLowerCase(), 'g')) || []).length };
    });

    res.json({ query: q, total: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
