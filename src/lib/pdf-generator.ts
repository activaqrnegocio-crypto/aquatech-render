import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatToEcuador, ECUADOR_TIMEZONE } from './date-utils';

// Global constants for branding parity
const AQUATECH_BLUE: [number, number, number] = [0, 112, 192];
const AQUATECH_LOGO_B64 = 'data:image/jpeg;base64,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';

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
  if (isNaN(n) || n === undefined || n === null) return 'CERO, 00/100 DOLARES';
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
  action?: 'save' | 'preview' | 'blob' | 'instance';
  sellerName?: string;
  optionalSection?: {
    title: string;
    description: string;
    imageBase64: string;
    image2Base64?: string;
  };
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

  // --- 6. OPTIONAL SECTION ---
  if (config.optionalSection && (config.optionalSection.title || config.optionalSection.imageBase64)) {
    let optY = sigY + 25;
    
    if (optY + 60 > pageHeight - 10) {
      doc.addPage();
      addAquatechHeader(doc, `${config.docType} Nº: ${config.docId}`, 'CASTILLO CASTILLO PABLO JOSE');
      optY = 65;
    }

    if (config.optionalSection.title) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(AQUATECH_BLUE[0], AQUATECH_BLUE[1], AQUATECH_BLUE[2]);
      doc.text(config.optionalSection.title.toUpperCase(), 105, optY, { align: 'center' });
      doc.setTextColor(0);
      optY += 6;
    }
    
    if (config.optionalSection.description) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const splitDesc = doc.splitTextToSize(config.optionalSection.description, 160);
      doc.text(splitDesc, 105, optY, { align: 'center' });
      optY += (splitDesc.length * 4.5);
    }

    if (config.optionalSection.imageBase64 || config.optionalSection.image2Base64) {
      try {
        const hasBoth = config.optionalSection.imageBase64 && config.optionalSection.image2Base64;
        const imgWidth = hasBoth ? 88 : 120;
        const imgHeight = hasBoth ? 55 : 75;
        
        if (hasBoth) {
           // Render side by side
           doc.addImage(config.optionalSection.imageBase64, 'JPEG', 15, optY + 2, imgWidth, imgHeight);
           doc.addImage(config.optionalSection.image2Base64!, 'JPEG', 107, optY + 2, imgWidth, imgHeight);
        } else {
           // Render single centered large
           const imgX = (210 - imgWidth) / 2;
           const targetImg = config.optionalSection.imageBase64 || config.optionalSection.image2Base64;
           if (targetImg) doc.addImage(targetImg, 'JPEG', imgX, optY + 2, imgWidth, imgHeight);
        }
      } catch (e) {
        console.error("Error adding optional images to PDF", e);
      }
    }
  }

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
    return blobUrl;
  } else if (config.action === 'blob') {
    return doc.output('blob');
  } else if (config.action === 'instance') {
    return doc;
  } else {
    doc.save(fileName);
  }
}

/**
 * Generates a professional Project Report PDF (Chat + Expenses)
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

  // 3. Chat de Campo Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(AQUATECH_BLUE[0], AQUATECH_BLUE[1], AQUATECH_BLUE[2]);
  doc.text('CHAT DE CAMPO', 15, 82);

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
