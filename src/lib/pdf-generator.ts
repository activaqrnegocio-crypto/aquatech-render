import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to convert numbers to Spanish words for "SON: ..."
export function numberToSpanishWords(n: number): string {
  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const cents = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (n === 0) return 'CERO';
  if (n === 100) return 'CIEN';

  let words = '';
  
  const getHundreds = (num: number) => {
    let w = '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (h > 0) {
        if (h === 1 && t === 0 && u === 0) w += 'CIEN ';
        else w += cents[h] + ' ';
    }
    if (t === 1 && u < 10 && u >= 0) {
      if (u === 0) w += 'DIEZ';
      else w += teens[u];
    } else {
      if (t > 0) {
        w += tens[t];
        if (u > 0) w += ' Y ';
      }
      if (u > 0) w += units[u];
    }
    return w.trim();
  };

  const thousands = Math.floor(n / 1000);
  const remainder = Math.floor(n % 1000);
  const centavos = Math.round((n % 1) * 100);

  if (thousands > 0) {
    if (thousands === 1) words += 'MIL ';
    else words += getHundreds(thousands) + ' MIL ';
  }
  
  words += getHundreds(remainder);
  
  return `${words.trim()}, ${centavos.toString().padStart(2, '0')}/100 DOLARES`.toUpperCase();
}

export interface PDFClientInfo {
  name: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  date?: Date;
}

export interface PDFItem {
  quantity: string | number;
  code?: string;
  description: string;
  unitPrice: number;
  discountPct?: number;
  total: number;
}

export interface PDFTotals {
  subtotal: number;
  subtotal0: number;
  subtotal15: number;
  discountTotal: number;
  ivaAmount: number;
  totalAmount: number;
}

export interface PDFConfig {
  docType: 'COTIZACIÓN' | 'PRESUPUESTO';
  docId: string | number;
  notes?: string;
  action?: 'save' | 'preview';
}

export function generateProfessionalPDF(
  client: PDFClientInfo,
  items: any[],
  totals: PDFTotals | number,
  config: PDFConfig
) {
  // Normalize totals
  let finalTotals: PDFTotals;
  if (typeof totals === 'number') {
    const subtotal = totals;
    const ivaRate = 0.15; // Standard IVA in Ecuador
    const ivaAmount = subtotal * ivaRate;
    const totalAmount = subtotal + ivaAmount;

    finalTotals = {
      subtotal: subtotal,
      subtotal0: 0,
      subtotal15: subtotal,
      discountTotal: 0,
      ivaAmount: ivaAmount,
      totalAmount: totalAmount
    };
  } else {
    finalTotals = totals;
  }

  // Normalize items for the table
  const pdfItems = items.map(item => ({
    quantity: item.quantity,
    code: item.code || 'S/C',
    description: item.description || item.name || '',
    unitPrice: item.unitPrice || item.estimatedCost || 0,
    total: item.total || (Number(item.quantity === 'GLOBAL' ? 1 : item.quantity) * (item.unitPrice || item.estimatedCost || 0))
  }));

  const doc = new jsPDF();
  const accentColor: [number, number, number] = [0, 112, 192]; // Aquatech Blue
  
  // --- 1. HEADER & LOGO ---
  const logoImg = '/cotizacion.jpg';
  try {
    doc.addImage(logoImg, 'JPEG', 22, 18.5, 65, 18);
  } catch (e) {
    doc.setTextColor(0, 112, 192);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('AQUATECH', 15, 25);
  }

  // Fiscal Box (Top Right) - Rounded
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.roundedRect(100, 10, 95, 35, 3, 3); 
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RUC: 1105048852001', 105, 16);
  
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setFontSize(10);
  doc.text(`${config.docType} Nº:`, 105, 22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${config.docId}`, 145, 22);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text('CASTILLO CASTILLO PABLO JOSE', 105, 28);
  doc.setFont('helvetica', 'normal');
  doc.text('18 DE NOVIEMBRE ENTRE CELICA Y GONZANAMA', 105, 32);
  doc.setFont('helvetica', 'bold');
  doc.text('Teléfono:', 105, 36);
  doc.setFont('helvetica', 'normal');
  doc.text('0992873735', 120, 36);
  doc.setFont('helvetica', 'bold');
  doc.text('correo:', 105, 40);
  doc.setFont('helvetica', 'normal');
  doc.text('aquariegoloja@yahoo.com', 118, 40);

  // --- 2. CLIENT DATA BLOCK (Rounded Box) ---
  doc.setDrawColor(0);
  doc.roundedRect(15, 50, 180, 22, 3, 3); 
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 18, 56);
  doc.text('Dirección:', 18, 62);
  doc.text('Fecha de Emisión:', 18, 68);
  
  doc.setFont('helvetica', 'normal');
  doc.text((client.name || '').toUpperCase(), 35, 56);
  doc.text((client.address || 'SN').toUpperCase(), 35, 62);
  doc.text(new Date(client.date || new Date()).toLocaleDateString(), 45, 68);

  // Right columns of Client Box
  doc.setFont('helvetica', 'bold');
  doc.text('R.U.C:', 140, 56);
  doc.text('TELEF:', 140, 62);
  
  doc.setFont('helvetica', 'normal');
  doc.text(client.ruc || '0000000000001', 155, 56);
  doc.text(client.phone || 'S/N', 155, 62);

  // --- 3. PRODUCTS TABLE ---
  let head, body, columnStyles;

  if (config.docType === 'PRESUPUESTO') {
    head = [['ITEM', 'DESCRIPCION', 'CANTIDAD', 'P/UNITARIO', 'TOTAL']];
    body = pdfItems.map((item, idx) => [
      idx + 1,
      item.description.toUpperCase(),
      item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity).toFixed(2),
      Number(item.unitPrice).toFixed(2),
      Number(item.total).toFixed(2)
    ]);
    columnStyles = {
      0: { halign: 'center' as const, cellWidth: 15 },
      1: { halign: 'left' as const },
      2: { halign: 'center' as const, cellWidth: 25 },
      3: { halign: 'right' as const, cellWidth: 25 },
      4: { halign: 'right' as const, cellWidth: 25 },
    };
  } else {
    head = [['Cantidad', 'Código', 'Nombre Producto', 'P. Unit', 'Descto.', 'Total']];
    body = pdfItems.map((item) => [
      item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity).toFixed(2),
      item.code || 'S/C',
      item.description.toUpperCase(),
      Number(item.unitPrice).toFixed(4),
      Number(0).toFixed(3),
      Number(item.total).toFixed(4)
    ]);
    columnStyles = {
      0: { halign: 'center' as const, cellWidth: 15 },
      1: { halign: 'center' as const, cellWidth: 15 },
      2: { halign: 'left' as const },
      3: { halign: 'right' as const, cellWidth: 20 },
      4: { halign: 'right' as const, cellWidth: 15 },
      5: { halign: 'right' as const, cellWidth: 20 },
    };
  }

  autoTable(doc, {
    startY: 75,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 7, textColor: 0, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', halign: 'center', lineWidth: 0.2 },
    columnStyles: columnStyles,
    margin: { left: 15, right: 15 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 5;

  // --- 4. WORDS & TOTALS ---
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  
  const notesStr = 'Observaciones: ' + (config.notes || 'NINGUNA');
  // Text wrapping para evitar el desborde (120 de ancho máximo)
  const splitNotes = doc.splitTextToSize(notesStr, 120);
  doc.text(splitNotes, 15, finalY);
  
  const wordsText = 'SON: ' + numberToSpanishWords(Number(finalTotals.totalAmount));
  const nextY = finalY + (splitNotes.length * 3.5) + 2;
  const splitWords = doc.splitTextToSize(wordsText, 120);
  
  doc.setFont('helvetica', 'bold');
  doc.text(splitWords, 15, nextY);
  
  const endOfTextY = nextY + (splitWords.length * 3.5);

  // --- Totals Box (Rounded) ---
  const totalsX = 145;
  let currentY = finalY;
  
  doc.setDrawColor(0);
  doc.roundedRect(142, finalY - 3, 53, 35, 3, 3); 
  
  const totalLines = [
    ['Subtotal:', finalTotals.subtotal],
    ['Descuentos:', finalTotals.discountTotal],
    ['Subtotal TARIFA 0%:', finalTotals.subtotal0],
    ['Subtotal TARIFA 15%:', finalTotals.subtotal15],
    ['15% IVA:', finalTotals.ivaAmount],
    ['TOTAL A PAGAR $:', finalTotals.totalAmount]
  ];

  totalLines.forEach(([label, value], idx) => {
    const isTotal = idx === totalLines.length - 1;
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setFontSize(isTotal ? 8 : 7);
    doc.text(label.toString(), 145, currentY + 2);
    
    // Draw rounded box for the value
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.roundedRect(173, currentY - 2, 20, 5, 1, 1);
    
    doc.text(Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 191, currentY + 1.5, { align: 'right' });
    currentY += 5.5;
  });
 
  // --- 5. FOOTER SIGNATURES ---
  // Ensure the signature line doesn't collide with extremely long notes
  const sigY = Math.max(currentY + 25, endOfTextY + 20);
  
  doc.setFontSize(7);
  doc.line(40, sigY, 90, sigY);
  doc.line(125, sigY, 175, sigY);
  doc.text('Firma Cliente', 65, sigY + 4, { align: 'center' });
  doc.text('Firma Autorizada', 150, sigY + 4, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.text('"Gracias por preferirnos"', 105, sigY + 14, { align: 'center' });

  const fileName = `${config.docType}_Aquatech_${config.docId}.pdf`;

  if (config.action === 'preview') {
    const blobUrl = doc.output('bloburl');
    // Returning the blobUrl allows the UI to show it in an iframe.
    return blobUrl;
  } else {
    doc.save(fileName);
  }
}
