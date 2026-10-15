import jsPDF from 'jspdf';
import { autoTable, type UserOptions } from 'jspdf-autotable';
import { buildQuotationModel, quoteMoney, type QuotationOptions, type QuoteTable } from './quotationModel';

const INK = '#193b37';
const MUTED = '#64736f';
const ACCENT = '#708c46';
const PAPER = '#f3f6ef';
const LINE = '#dce4da';
const LEFT = 16;
const WIDTH = 178;
const BOTTOM = 272;

/** Purpose-built A4 report: real text and row-aware pagination, never a screenshot of the UI. */
export async function createQuotationPdf(options: QuotationOptions, generatedAt = new Date()): Promise<jsPDF> {
  const model = buildQuotationModel(options);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.setProperties({ title: 'Personalized insurance quotation | PremiumPulse', subject: model.policies.map(policy => policy.title).join(' + '), author: 'PremiumPulse', creator: 'PremiumPulse quotation engine' });
  const issueDate = model.input.issueDate || model.input.purchaseDate || generatedAt.toISOString().slice(0, 10);
  const reference = `PP-${generatedAt.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const logoResponse = await fetch('/shanta-life-logo.png');
  if (!logoResponse.ok) throw new Error('The quotation logo could not be loaded. Please retry when the app is fully loaded.');
  const logo = new Uint8Array(await logoResponse.arrayBuffer());
  let y = 43;
  let activePolicy = '';
  const headedPages = new Set<number>();

  function text(value: string, x: number, top: number, size = 9, color = INK, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    pdf.text(value, x, top);
  }
  function header() {
    const pageNumber = pdf.getCurrentPageInfo().pageNumber;
    if (headedPages.has(pageNumber)) return;
    headedPages.add(pageNumber);
    pdf.setFillColor(ACCENT);
    pdf.rect(0, 0, 210, 2, 'F');
    const image = pdf.getImageProperties(logo);
    pdf.addImage(logo, 'PNG', LEFT, 12, 33, 33 * image.height / image.width, 'shanta-logo');
    text('PREMIUMPULSE  /  PERSONALIZED ILLUSTRATION', 91, 16, 7.4, MUTED, true);
    text('UNOFFICIAL SAMPLE - NOT A CONTRACT', 91, 22, 7.3, INK, true);
    text(`Issue date: ${issueDate}   |   ${reference}`, 91, 28, 7, MUTED);
    pdf.setDrawColor(LINE);
    pdf.line(LEFT, 35, 194, 35);
    if (activePolicy) text(activePolicy, LEFT, 41, 7.2, MUTED);
  }
  function newPage() { pdf.addPage(); header(); y = 49; }
  function room(height: number) { if (y + height > BOTTOM) newPage(); }
  function paragraph(value: string, size = 8.5, color = MUTED, bold = false, width = WIDTH) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value, width) as string[];
    const leading = size * 0.43;
    for (const line of lines) { room(leading); text(line, LEFT, y, size, color, bold); y += leading; }
    y += 1.3;
  }
  function heading(value: string) { room(20); y += 3; text(value, LEFT, y, 10, INK, true); y += 5; }
  function table(block: QuoteTable) {
    heading(block.title);
    const settings: UserOptions = {
      startY: y, margin: { top: 49, right: LEFT, bottom: 25, left: LEFT }, tableWidth: WIDTH,
      head: [block.columns], body: block.rows,
      theme: 'plain', showHead: 'everyPage', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.15 }, overflow: 'linebreak' },
      headStyles: { fillColor: PAPER, textColor: INK, fontStyle: 'bold', fontSize: 7.6 },
      alternateRowStyles: { fillColor: '#fafbf8' },
      columnStyles: Object.fromEntries(block.columns.map((_, index) => [index, { halign: index === 0 ? 'left' : 'right' }])),
      willDrawPage: () => { if (pdf.getCurrentPageInfo().pageNumber > 1) header(); },
    };
    autoTable(pdf, settings);
    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    if (block.note) paragraph(block.note, 7.8);
  }

  // Helvetica remains selectable for all report content. Bengali personal details
  // use browser shaping with a bundled OFL font (no remote font service required).
  const personalDetails = [model.input.name || 'Valued customer', model.input.phone, model.input.email].filter(Boolean) as string[];
  if (personalDetails.some(value => /[^\x20-\x7e]/.test(value))) {
    // Fetch bytes through the same-origin app cache. Font URL requests can carry
    // different Origin/Vary headers and miss a precached response when offline.
    const fontResponse = await fetch('/fonts/NotoSansBengali.ttf');
    if (!fontResponse.ok) throw new Error('The customer-name font could not be loaded. Please retry.');
    const font = new FontFace('QuotationBengali', await fontResponse.arrayBuffer());
    await font.load();
    document.fonts.add(font);
  }
  function personalText(value: string, size: number, bold = false) {
    if (!/[^\x20-\x7e]/.test(value)) { paragraph(value, size, INK, bold); return; }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to render the customer details.');
    const scale = 4;
    const pixelSize = size * 96 / 72;
    const maxWidth = WIDTH * 96 / 25.4;
    const fontSpec = `${bold ? 700 : 400} ${pixelSize}px QuotationBengali, sans-serif`;
    context.font = fontSpec;
    const lines: string[] = [];
    let line = '';
    // Segment by grapheme so Bengali conjuncts and other user-entered characters stay intact.
    const segments = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment)
      : Array.from(value);
    for (const segment of segments) {
      if (line && context.measureText(line + segment).width > maxWidth) { lines.push(line); line = ''; }
      line += segment;
    }
    if (line) lines.push(line);
    for (const line of lines) {
      const height = pixelSize * 1.7;
      canvas.width = Math.ceil(maxWidth * scale);
      canvas.height = Math.ceil(height * scale);
      context.scale(scale, scale);
      context.font = fontSpec;
      context.fillStyle = INK;
      context.textBaseline = 'middle';
      context.fillText(line, 0, height / 2);
      const mmHeight = height * 25.4 / 96;
      room(mmHeight);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', LEFT, y - size * 0.35, WIDTH, mmHeight);
      y += mmHeight;
    }
    y += 2;
  }

  model.policies.forEach((policy, index) => {
    activePolicy = model.policies.length > 1 ? `POLICY ${index + 1} OF ${model.policies.length}  /  SEPARATE POLICY OBLIGATION` : 'YOUR PERSONALIZED PLAN';
    if (index === 0) { header(); y = 48; } else newPage();
    paragraph(policy.title, 18, INK, true);
    y += 1;
    text('PREPARED FOR', LEFT, y, 7, MUTED, true); y += 6;
    personalText(model.input.name?.trim() || 'Valued customer', 12, true);
    if (index === 0) {
      const contact = [model.input.phone && `Phone: ${model.input.phone}`, model.input.email && `Email: ${model.input.email}`].filter(Boolean).join('    |    ');
      if (contact) personalText(contact, 8);
    }
    const dob = model.input.dob || 'Not provided';
    paragraph(`Age: ${model.input.age} years    |    ${model.input.gender}    |    Date of birth: ${dob}`, 8);
    paragraph(`Policy term: ${model.input.term} years    |    Payment mode: ${policy.mode}${model.input.childAge !== undefined && policy.title.includes('Child') ? `    |    Child age: ${model.input.childAge} years` : ''}`, 8);
    room(26);
    pdf.setFillColor(PAPER); pdf.roundedRect(LEFT, y, WIDTH, 22, 2, 2, 'F');
    text(`${policy.mode.toUpperCase()} PAYMENT`, LEFT + 5, y + 6, 7, MUTED, true);
    text(quoteMoney(policy.premium), LEFT + 5, y + 15, 16, INK, true);
    text('TOTAL PREMIUMS OVER TERM', 112, y + 6, 7, MUTED, true);
    text(quoteMoney(policy.totalPaid), 112, y + 15, 13, INK, true);
    y += 28;
    policy.summary.forEach(table);
    if (policy.schedules.length) {
      newPage();
      paragraph('Your policy, year by year', 18, INK, true);
      paragraph('All amounts in Bangladesh Taka (BDT). Projections are indicative, not a promise of returns.', 8.5);
      policy.schedules.forEach(table);
    }
  });
  heading('Important information & next steps');
  model.notes.forEach((note, index) => paragraph(`${index + 1}. ${note}`, 8));
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(LINE); pdf.line(LEFT, 279, 194, 279);
    text('PremiumPulse  |  Unofficial sample illustration  |  Not a contract', LEFT, 284, 7, MUTED);
    text(`${page} / ${pages}`, 183, 284, 7, MUTED);
    text(`Generated ${generatedAt.toISOString().slice(0, 10)}  |  Verify with Shanta Life before purchase`, LEFT, 289, 6.5, MUTED);
  }
  return pdf;
}

export function quotationFilename(options: QuotationOptions, now = new Date()): string {
  const product = (options.selectedProduct?.productName || 'Plan').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${product}${options.isComboEnabled ? '_Combo' : ''}_Quotation_${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}.pdf`;
}
