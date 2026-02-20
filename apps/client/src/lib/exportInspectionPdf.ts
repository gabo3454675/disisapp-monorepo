import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { DiagramPin, UsedPart } from '@/types/inspection';

export interface ExportInspectionPdfOptions {
  /** Elemento del DOM que contiene el diagrama con pins (se captura como imagen) */
  diagramElement: HTMLElement | null;
  pins: DiagramPin[];
  usedParts: UsedPart[];
  vehicleInfo?: string;
  notes?: string;
  /** Ej: "Inspección 18/02/2025" */
  title?: string;
  /** Nombre de la empresa (ej. Davean) para la cabecera del reporte. Módulo exclusivo Davean. */
  companyName: string;
  /** Logo en data URL (base64) para incluir en la cabecera. Opcional. */
  logoDataUrl?: string | null;
}

export async function exportInspectionPdf(options: ExportInspectionPdfOptions): Promise<void> {
  const {
    diagramElement,
    pins,
    usedParts,
    vehicleInfo,
    notes,
    title = 'Reporte de inspección',
    companyName,
    logoDataUrl,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Cabecera: logo (si existe) + nombre de la empresa + título — módulo exclusivo Davean
  const headerLeft = margin;
  const logoSize = 12;
  let textStartX = headerLeft;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', headerLeft, y - 2, logoSize, logoSize);
      textStartX = headerLeft + logoSize + 4;
    } catch {
      textStartX = headerLeft;
    }
  }
  const displayName = (companyName.trim() || 'Davean').slice(0, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(displayName, textStartX, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const titleShort = String(title).slice(0, 60);
  doc.text(titleShort, textStartX, y + 9);
  doc.setTextColor(0, 0, 0);
  y += 2;

  if (vehicleInfo) {
    doc.setFontSize(11);
    doc.text(`Vehículo: ${vehicleInfo}`, margin, y);
    y += 8;
  }

  if (diagramElement) {
    try {
      const canvas = await html2canvas(diagramElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
      });
      const imgData = canvas.toDataURL('image/png');
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * imgW;
      doc.addImage(imgData, 'PNG', margin, y, imgW, Math.min(imgH, 80));
      y += Math.min(imgH, 80) + 10;
    } catch {
      doc.setFontSize(10);
      doc.text('(Diagrama no disponible)', margin, y);
      y += 8;
    }
  }

  doc.setFontSize(12);
  doc.text('Leyenda de pins', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text('• Rojo: Dañado', margin, y);
  y += 5;
  doc.setTextColor(22, 163, 74);
  doc.text('• Verde: Reparado', margin, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  if (usedParts.length > 0) {
    doc.setFontSize(12);
    doc.text('Repuestos / servicios aplicados', margin, y);
    y += 8;
    doc.setFontSize(10);
    usedParts.forEach((p) => {
      const line = `${p.productName ?? `Producto #${p.productId}`} — Cantidad: ${p.quantity}`;
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 6;
    });
    y += 6;
  }

  if (notes) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text('Notas', margin, y);
    y += 6;
    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(notes, pageW - margin * 2);
    splitNotes.forEach((line: string) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    });
  }

  const slug = (companyName || 'inspeccion').replace(/\s+/g, '-').toLowerCase().slice(0, 20);
  doc.save(`inspeccion-${slug}-${Date.now()}.pdf`);
}
