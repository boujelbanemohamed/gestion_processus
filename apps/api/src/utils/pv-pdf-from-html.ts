/**
 * Génération PDF côté serveur pour un PV rédigé en HTML (secours si aucun fichier n’est fourni).
 * Représentation professionnelle : en-tête, méta, corps texte (balises HTML retirées), pagination simple.
 */
import PDFDocument from 'pdfkit';

const MAX_HTML_CHARS = 600_000;

function stripHtmlToText(html: string): string {
  const s = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return s;
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!w) continue;
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export type PvPdfMeta = {
  titre: string;
  statutLabel: string;
  dateReunionLabel: string;
  participantsUsers: string;
  participantsClients: string;
  liensProjets: string;
  liensTaches: string;
  liensUserStories: string;
  liensEpics: string;
  bodyHtml: string;
  generatedAt: Date;
};

export async function generatePvPdfBuffer(meta: PvPdfMeta): Promise<Buffer> {
  const html = meta.bodyHtml || '';
  if (html.length > MAX_HTML_CHARS) {
    throw new Error('Contenu HTML trop volumineux');
  }
  const body = stripHtmlToText(html);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const pageWidth = doc.page.width;
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    const footerY = doc.page.height - 40;

    const drawFooter = (pageIndex: number, totalPages: number) => {
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(
          `Généré le ${meta.generatedAt.toLocaleString('fr-FR')} — page ${pageIndex}/${totalPages}`,
          margin,
          footerY,
          { width: contentWidth, align: 'center' }
        );
    };

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > footerY - 12) doc.addPage();
    };

    doc.font('Helvetica').fillColor('#1f2937').fontSize(9).text('PMO Hub — Procès-verbal de réunion', margin, margin, {
      width: contentWidth,
    });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(meta.titre, { width: contentWidth });
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    doc.text(`Statut : ${meta.statutLabel}`);
    doc.text(`Date de la réunion : ${meta.dateReunionLabel}`);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Participants (utilisateurs)');
    doc.font('Helvetica').text(meta.participantsUsers || '—', { width: contentWidth });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Participants (clients / fournisseurs)');
    doc.font('Helvetica').text(meta.participantsClients || '—', { width: contentWidth });
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Rattachements');
    doc.font('Helvetica');
    doc.text(`Projets : ${meta.liensProjets || '—'}`, { width: contentWidth });
    doc.text(`Tâches : ${meta.liensTaches || '—'}`, { width: contentWidth });
    doc.text(`User stories : ${meta.liensUserStories || '—'}`, { width: contentWidth });
    doc.text(`Epics : ${meta.liensEpics || '—'}`, { width: contentWidth });
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').text('Contenu du PV');
    doc.moveDown(0.2);
    doc.font('Helvetica').fillColor('#111827');

    const maxChars = 95;
    const lines = body ? wrapLines(body, maxChars) : ['(Contenu vide)'];
    const lineHeight = 13;
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      doc.text(line, { width: contentWidth, lineGap: 2 });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(i + 1, range.count);
    }

    doc.end();
  });
}
