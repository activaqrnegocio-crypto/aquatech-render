import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatToEcuador, ECUADOR_TIMEZONE } from './date-utils';

// Global constants for branding parity
const AQUATECH_BLUE: [number, number, number] = [0, 112, 192];
const AQUATECH_LOGO_B64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAA7ARUDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6ZJIsKF3YIijJZjgAetPr5x/b6+Mx+Df7N/iCa1uPJ1vXANG0/acMGlBEjj/djDnPrirhF1JKK6kVJqnFyfQ8r1j/grR8LtL1S/s4/DviS/S1nkhW5gih2TBWI3rmTODjIz2NfY3gfxhp3xA8H6L4l0iXz9L1a0jvbeTvsdQwB9CM4I9Qa/nNUbcKOwr9Zf+CUPxj/4Sz4R6t4BvZ92oeF7jybVWOSbOYllA9lkDj6MtexjMFCjTU6fTc8bB42Vao4T+R901U1TVrPRrCa9vrmKztIV3STzMFRB6kmrLMFUkkADkk18C/tFfGi6+Jnim40+zuGTw1YSmOCFThZ3Xgyt689PQfWjKcrqZrX9nF2itW+3/BODiPiCjw/hfbTXNOWkY93/AJLqe8eKv2zPCGi3TwaTZXuvlTjzogIoj9C3JH4Vjad+3Fo8swW+8MX1tETzJBOkhH4HFeFfC34C+J/iwjXWnRxWOlo2xtQvCQhYdQgHLEe3HvXa+J/2NPF2i6fJdabf2OuPGNxtYg0UrY/u7uD9M19tPLeHsNP6tWqe/wCr/TRH5VTzzjLG0/ruHpfu90lFaryv7z+R9W/D74reGfiZZNNoWpJcyxjMtq42TRf7yHnHuOK68HdX5daRrGreC9fivbCefTNWspCN3KujA8qw9OxBr9CPgr8ToPir4HtdXVFhvUPkXlup4jmA5x7Hgj2NfNZ3kTyy1ak+am/w/rufc8K8WrPHLC4mPJWj06NdbdmuqPE/j1/wUL8Efs+/E3UPBOt6Brt/qNnDDM89ikRiIkQOoG5weAeeK9A/Zj/am8O/tSaNrupeHdM1LTIdJuUtZl1JUDOzJuBXax4x61+Yf/BTP/k8DxN/14WH/pOtfT//AAR7/wClf/Ef/sLW3/og15VXC044VVVvofX08TUlinRe2p9TftLftMaB+zB4V0vX/EOm6hqVrf3v2GOPTVQur7GfJ3MBjCmvLPgr/wAFHPAnxy+J2jeCdH8Pa/ZajqZkEU94kIiXZGzndtcnop7Vwf8AwV5/5In4O/7GAf8ApPLXxd/wTx/5O/8AAP8Av3X/AKTS06OFpzwzqvfUVbFVIYlUo7Ox+4Nec/H345aB+zv8OLvxl4jS4nsoJY7eO1tApmnkdsKiBiBnGTyeimvRe1fld/Vv/Wk4xMvMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfMfM9/9k=';

// Adds the professional Aquatech header to any jsPDF instance
export function addAquatechHeader(doc: jsPDF, title: string, subtitle: string) {
  // 1. Logo
  try {
    doc.addImage(AQUATECH_LOGO_B64, 'JPEG', 15, 19, 80, 18);
  } catch (e) {
    doc.setTextColor(AQUATECH_BLUE[0], AQUATECH_BLUE[1], AQUATECH_BLUE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('AQUATECH', 15, 20);
  }

  // 2. Fiscal Info (Top Right Rounded Box)
  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  doc.roundedRect(100, 10, 95, 36, 3, 3); // box for 6 lines
  
  // -- Line 1: RUC --
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RUC:', 102, 16);
  doc.text('1105048852001', 132, 16);
  
  // -- Line 2: COTIZACION Nº --
  doc.text('COTIZACION Nº:', 102, 21);
  doc.setTextColor(AQUATECH_BLUE[0], AQUATECH_BLUE[1], AQUATECH_BLUE[2]);
  doc.text(title.split(/[:№Nº]/).pop()?.trim() || '', 140, 21);
  
  // -- Line 3: Owner Name (Centered/Bold Large) --
  doc.setTextColor(0);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CASTILLO CASTILLO PABLO JOSE', 147.5, 26, { align: 'center' });
  
  // -- Line 4: Address (Centered/Normal) --
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('18 DE NOVIEMBRE ENTRE CELICA Y GONZANAMA', 147.5, 30.5, { align: 'center' });

  // -- Line 5: Teléfono --
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Teléfono:', 102, 36);
  doc.text('0992873735', 125, 36);

  // -- Line 6: correo --
  doc.text('correo:', 102, 41);
  doc.text('aquariegoloja@yahoo.com', 125, 41);

  // 3. NO Separator (removed by user request - "una linea de mas")
}

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
  sellerName?: string;
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
  const accentColor = AQUATECH_BLUE;
  
  // --- 1. HEADER & LOGO ---
  addAquatechHeader(
    doc, 
    `${config.docType} Nº: ${config.docId}`, 
    'CASTILLO CASTILLO PABLO JOSE'
  );

  // --- 2. CLIENT DATA BLOCK (Rounded Box) ---


  // (Header drawn by addAquatechHeader called below)

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
  doc.text(formatToEcuador(client.date || new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' }), 45, 68);

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
    head = [['Cantidad', 'Nombre Producto', 'P.Unit.', 'Desc%', 'Total.']];
    body = pdfItems.map((item) => [
      item.quantity === 'GLOBAL' ? 'GLOBAL' : Number(item.quantity).toFixed(2),
      item.description.toUpperCase(),
      Number(item.unitPrice).toFixed(4),
      Number(0).toFixed(3),
      Number(item.total).toFixed(4)
    ]);
    columnStyles = {
      0: { halign: 'center' as const, cellWidth: 20 },
      1: { halign: 'left' as const },
      2: { halign: 'right' as const, cellWidth: 25 },
      3: { halign: 'right' as const, cellWidth: 20 },
      4: { halign: 'right' as const, cellWidth: 25 },
    };
  }

  autoTable(doc, {
    startY: 75,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 9, textColor: 0, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', halign: 'center', lineWidth: 0.2 },
    columnStyles: columnStyles,
    margin: { left: 15, right: 15, top: 60, bottom: 25 }, // Margen inferior de seguridad
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addAquatechHeader(
          doc, 
          `${config.docType} Nº: ${config.docId}`, 
          'CASTILLO CASTILLO PABLO JOSE'
        );
      }
    }
  });
  
  const pageHeight = doc.internal.pageSize.getHeight();
  let finalY = (doc as any).lastAutoTable.finalY + 5;
  const totalsBlockHeight = 65; // Espacio necesario para Observaciones + Cuadro Totales + Letras + Firmas

  // --- Verificación de Espacio para el Bloque de Cierre ---
  if (finalY + totalsBlockHeight > pageHeight - 10) {
    doc.addPage();
    addAquatechHeader(
      doc, 
      `${config.docType} Nº: ${config.docId}`, 
      'CASTILLO CASTILLO PABLO JOSE'
    );
    finalY = 65; // Empieza después del logo en la nueva hoja
  }

  // --- 4. WORDS & TOTALS ---
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  
  const notesStr = 'Observaciones: ' + (config.notes || 'NINGUNA');
  const splitNotes = doc.splitTextToSize(notesStr, 110);
  doc.text(splitNotes, 15, finalY);
  
  const wordsText = 'SON: ' + numberToSpanishWords(Number(finalTotals.totalAmount));
  const nextY = finalY + (splitNotes.length * 3.5) + 2;
  const splitWords = doc.splitTextToSize(wordsText, 105);
  
  doc.setFont('helvetica', 'bold');
  doc.text(splitWords, 15, nextY);
  
  const endOfTextY = nextY + (splitWords.length * 3.5);

  // --- Totals Box (Rounded) ---
  const totalsX = 132;
  let currentY = finalY;
  
  doc.setDrawColor(0);
  doc.roundedRect(totalsX, finalY - 3, 63, 35, 3, 3); 
  
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
    doc.setFontSize(isTotal ? 10 : 9);
    doc.text(label.toString(), totalsX + 3, currentY + 2);
    
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.roundedRect(173, currentY - 2, 21, 5, 1, 1);
    
    doc.text(Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 193, currentY + 1.5, { align: 'right' });
    currentY += 5.5;
  });

  // Branding below totals
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('VisualFAC 11 - NSIM CIA LTDA', totalsX + 5, currentY + 1);
  
  // --- 5. FOOTER SIGNATURES ---
  let sigY = Math.max(currentY + 18, endOfTextY + 12);
  
  // Verificación final para firmas (por si notas son excepcionalmente largas)
  if (sigY + 20 > pageHeight - 10) {
    doc.addPage();
    addAquatechHeader(doc, `${config.docType} Nº: ${config.docId}`, 'CASTILLO CASTILLO PABLO JOSE');
    sigY = 65;
  }
  
  doc.setFontSize(7);
  doc.setDrawColor(0);
  doc.line(40, sigY, 90, sigY);
  doc.line(125, sigY, 175, sigY);
  doc.text('Firma Cliente', 65, sigY + 4, { align: 'center' });
  doc.text('Firma Autorizada', 150, sigY + 4, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.text('**Gracias por preferirnos**', 105, sigY + 14, { align: 'center' });

  // --- 6. FILENAME LOGIC ---
  const sanitize = (text: string) => text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
  
  const rawClientName = client.name || '';
  const isCF = !rawClientName || 
               rawClientName.toUpperCase().includes('CONSUMIDOR FINAL') || 
               rawClientName.toUpperCase().includes('CLIENTE PARTICULAR');
               
  const clientPrefix = isCF ? 'CF' : sanitize(rawClientName);
  const sellerSuffix = sanitize(config.sellerName || 'AQUATECH');
  
  const fileName = `${clientPrefix}_${sellerSuffix}.pdf`;

  if (config.action === 'preview') {
    const blobUrl = doc.output('bloburl');
    // Returning the blobUrl allows the UI to show it in an iframe.
    return blobUrl;
  } else {
    doc.save(fileName);
  }
}

/**
 * Generates a professional Project Report PDF (Bitácora + Expenses)
 * Used by field operators for offline/online parity.
 */
export function generateProjectReportPDF(data: {
  project: any;
  clientName: string;
  address: string;
  chat: any[];
  expenses: any[];
}) {
  const { project, clientName, address, chat, expenses } = data;
  const doc = new jsPDF();
  
  // 1. Header with custom project title
  addAquatechHeader(doc, 'REPORTE DE OBRA', `PROYECTO: ${project.title}`);
  
  // 2. Project Summary Box
  doc.setDrawColor(200);
  doc.roundedRect(15, 45, 180, 25, 2, 2);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Información del Proyecto:', 20, 52);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clientName || 'N/A'}`, 20, 58);
  doc.text(`Dirección: ${address || 'N/A'}`, 20, 64);
  doc.text(`Fecha Reporte: ${formatToEcuador(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 130, 58);
  doc.text(`ID: #${project.id}`, 130, 64);

  // 3. Bitácora de Campo Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(AQUATECH_BLUE[0], AQUATECH_BLUE[1], AQUATECH_BLUE[2]);
  doc.text('BITÁCORA DE CAMPO', 15, 82);

  const chatBody = chat.map(msg => [
    formatToEcuador(msg.createdAt, { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    }),
    msg.userName || 'Sistema',
    msg.content || (msg.media?.length ? '[MULTIMEDIA]' : '-'),
    msg.isPending ? 'OFFLINE' : 'SINC.'
  ]);

  autoTable(doc, {
    startY: 87,
    head: [['Fecha/Hora', 'Usuario', 'Descripción', 'Estado']],
    body: chatBody,
    theme: 'grid',
    headStyles: { fillColor: AQUATECH_BLUE, textColor: 255 },
    styles: { fontSize: 8 },
    margin: { left: 15, right: 15, top: 60, bottom: 25 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addAquatechHeader(doc, 'REPORTE DE OBRA', `PROYECTO: ${project.title}`);
      }
    }
  });

  // 4. Gastos Table
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GASTOS Y EGRESOS', 15, finalY);

  let totalExpenses = 0;
  const expensesBody = expenses.map(exp => {
    totalExpenses += Number(exp.amount);
    return [
      formatToEcuador(exp.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      exp.description,
      `$ ${Number(exp.amount).toFixed(2)}`,
      exp.isPending ? 'PEND.' : 'SINC.'
    ];
  });

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Fecha', 'Descripción', 'Monto', 'Estado']],
    body: expensesBody,
    theme: 'grid',
    headStyles: { fillColor: [100, 100, 100], textColor: 255 },
    styles: { fontSize: 8 },
    foot: [['', 'TOTAL ACUMULADO:', `$ ${totalExpenses.toFixed(2)}`, '']],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    margin: { left: 15, right: 15, top: 60, bottom: 25 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addAquatechHeader(doc, 'REPORTE DE OBRA', `PROYECTO: ${project.title}`);
      }
    }
  });

  doc.save(`Reporte_Obra_${project.id}_${new Date().getTime()}.pdf`);
}
