import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Aperçu PDF côté client (capture paginée du rendu HTML). */
export async function htmlElementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  const totalPages = pdf.getNumberOfPages();
  pdf.setFontSize(9);
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.text(`Page ${i}/${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
  }

  return pdf.output('blob');
}
