import jsPDF from 'jspdf';
import { autoTable, type UserOptions } from 'jspdf-autotable';
import { buildQuotationModel, quoteMoney, type CiConditionEntry, type CiRiderSchedule, type QuotationOptions, type QuoteTable } from './quotationModel';

const INK = '#193b37';
const MUTED = '#64736f';
const ACCENT = '#708c46';
const PAPER = '#f3f6ef';
const ZEBRA = '#fafbf8';
const LINE = '#dce4da';
const LEFT = 16;
const WIDTH = 178;
const BOTTOM = 272;
// Rider condition appendix geometry. Widths are measured against the longest
// existing condition name, so every entry keeps one line and the full list of a
// rider stays on a single A4 page.
const CI_INDEX_X = LEFT + 1.5;
const CI_ENGLISH = { x: LEFT + 7, width: 92, size: 8 };
const CI_BENGALI = { x: LEFT + 104, width: 72, size: 7.4, scale: 3, lineHeight: 1.5 };
const CI_ROW_PAD = 0.7;

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
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: Object.fromEntries(block.columns.map((_, index) => [index, { halign: index === 0 ? 'left' : 'right' }])),
      willDrawPage: () => { if (pdf.getCurrentPageInfo().pageNumber > 1) header(); },
    };
    autoTable(pdf, settings);
    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    if (block.note) paragraph(block.note, 7.8);
  }

  // Helvetica remains selectable for all report content. Bengali text - customer
  // details and rider condition names - uses browser shaping with a bundled OFL
  // font (no remote font service required).
  const personalDetails = [model.input.name || 'Valued customer', model.input.phone, model.input.email].filter(Boolean) as string[];
  const needsShapedText = personalDetails.some(value => /[^\x20-\x7e]/.test(value)) || Boolean(model.ciSchedule);
  if (needsShapedText) {
    // Fetch bytes through the same-origin app cache. Font URL requests can carry
    // different Origin/Vary headers and miss a precached response when offline.
    const fontResponse = await fetch('/fonts/NotoSansBengali.ttf');
    if (!fontResponse.ok) throw new Error('The customer-name font could not be loaded. Please retry.');
    const font = new FontFace('QuotationBengali', await fontResponse.arrayBuffer());
    await font.load();
    document.fonts.add(font);
  }
  const shapedFont = (size: number, bold: boolean) => `${bold ? 700 : 400} ${size * 96 / 72}px QuotationBengali, sans-serif`;
  const shapedHeight = (size: number, lineHeight: number) => size * 96 / 72 * lineHeight * 25.4 / 96;
  let shapedMeasurer: CanvasRenderingContext2D | null = null;
  /** Grapheme-safe wrapping: Bengali conjuncts and user-entered characters are never split. */
  function shapedLines(value: string, widthMm: number, size: number, bold = false): string[] {
    if (!shapedMeasurer) shapedMeasurer = document.createElement('canvas').getContext('2d');
    if (!shapedMeasurer) throw new Error('Unable to measure the Bengali text in this quotation.');
    shapedMeasurer.font = shapedFont(size, bold);
    const maxWidth = widthMm * 96 / 25.4;
    const lines: string[] = [];
    let line = '';
    const segments = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment)
      : Array.from(value);
    for (const segment of segments) {
      if (line && shapedMeasurer.measureText(line + segment).width > maxWidth) { lines.push(line); line = ''; }
      line += segment;
    }
    if (line) lines.push(line);
    return lines;
  }
  /** Rasterize one browser-shaped line at a fixed position; returns its height in mm. */
  function shapedLine(line: string, x: number, widthMm: number, size: number, top: number, bold = false, scale = 4, lineHeight = 1.7): number {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to render the Bengali text in this quotation.');
    const pixelHeight = size * 96 / 72 * lineHeight;
    canvas.width = Math.ceil(widthMm * 96 / 25.4 * scale);
    canvas.height = Math.ceil(pixelHeight * scale);
    context.scale(scale, scale);
    context.font = shapedFont(size, bold);
    context.fillStyle = INK;
    context.textBaseline = 'middle';
    context.fillText(line, 0, pixelHeight / 2);
    const mmHeight = pixelHeight * 25.4 / 96;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, top, widthMm, mmHeight);
    return mmHeight;
  }
  function personalText(value: string, size: number, bold = false) {
    if (!/[^\x20-\x7e]/.test(value)) { paragraph(value, size, INK, bold); return; }
    for (const line of shapedLines(value, WIDTH, size, bold)) {
      const mmHeight = shapedHeight(size, 1.7);
      room(mmHeight);
      shapedLine(line, LEFT, WIDTH, size, y - size * 0.35, bold);
      y += mmHeight;
    }
    y += 2;
  }
  /** One condition per row: selectable Latin name plus the shaped Bengali name. */
  function ciRow(entry: CiConditionEntry, zebra: boolean) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(CI_ENGLISH.size);
    const englishLines = pdf.splitTextToSize(entry.english, CI_ENGLISH.width) as string[];
    const bengaliLines = shapedLines(entry.bengali, CI_BENGALI.width, CI_BENGALI.size);
    const englishHeight = englishLines.length * CI_ENGLISH.size * 0.43;
    const bengaliHeight = bengaliLines.length * shapedHeight(CI_BENGALI.size, CI_BENGALI.lineHeight);
    const rowHeight = Math.max(englishHeight, bengaliHeight) + CI_ROW_PAD * 2;
    room(rowHeight);
    if (zebra) { pdf.setFillColor(ZEBRA); pdf.rect(LEFT, y, WIDTH, rowHeight, 'F'); }
    const englishTop = y + (rowHeight - englishHeight) / 2 + CI_ENGLISH.size * 0.36;
    text(String(entry.index), CI_INDEX_X, englishTop, 7.4, MUTED);
    englishLines.forEach((line, index) => text(line, CI_ENGLISH.x, englishTop + index * CI_ENGLISH.size * 0.43, CI_ENGLISH.size, INK));
    const bengaliTop = y + (rowHeight - bengaliHeight) / 2;
    bengaliLines.forEach((line, index) => shapedLine(
      line, CI_BENGALI.x, CI_BENGALI.width, CI_BENGALI.size,
      bengaliTop + index * shapedHeight(CI_BENGALI.size, CI_BENGALI.lineHeight),
      false, CI_BENGALI.scale, CI_BENGALI.lineHeight,
    ));
    pdf.setDrawColor(LINE);
    pdf.line(LEFT, y + rowHeight, LEFT + WIDTH, y + rowHeight);
    y += rowHeight;
  }
  function ciColumnHeadings() {
    room(6);
    pdf.setFillColor(PAPER);
    pdf.rect(LEFT, y, WIDTH, 5, 'F');
    text('#', CI_INDEX_X, y + 3.4, 7, INK, true);
    text('COVERED CONDITION', CI_ENGLISH.x, y + 3.4, 7, INK, true);
    text('BENGALI NAME', CI_BENGALI.x, y + 3.4, 7, INK, true);
    y += 5.2;
  }
  /** Final appendix page: only the disease list of the rider the customer selected. */
  function ciAppendixPage(schedule: CiRiderSchedule) {
    activePolicy = 'CRITICAL ILLNESS RIDER  /  COVERED CONDITIONS';
    newPage();
    paragraph(schedule.riderName, 18, INK, true);
    paragraph(schedule.intro, 8.5);
    const classic = schedule.rider === 'classic';
    paragraph(`Covered disease list | ${classic ? '19 conditions' : '10 minor + 15 major conditions'}`, 9, MUTED, true);
    room(24);
    pdf.setFillColor(PAPER);
    pdf.roundedRect(LEFT, y, WIDTH, 17, 2, 2, 'F');
    text('RIDER COVERAGE', LEFT + 5, y + 6, 7, MUTED, true);
    text(schedule.coverage === undefined ? 'Not applicable' : quoteMoney(schedule.coverage), LEFT + 5, y + 13, 12.5, INK, true);
    text('CONDITIONS LISTED', 112, y + 6, 7, MUTED, true);
    text(String(schedule.groups.reduce((total, group) => total + group.entries.length, 0)), 112, y + 13, 12.5, INK, true);
    y += 20;
    if (schedule.coverageNote) paragraph(schedule.coverageNote, 8);
    schedule.groups.forEach((group, groupIndex) => {
      const patchHeading = classic ? '' : (groupIndex === 0 ? 'Minor critical illness | 10 conditions' : 'Major critical illness | 15 conditions');
      heading(patchHeading ? `${group.heading} | ${patchHeading}` : group.heading);
      const coverageLine = `CI coverage: ${schedule.coverage === undefined ? 'Not applicable' : quoteMoney(schedule.coverage)}.`;
      paragraph(classic ? group.benefit : `${coverageLine} ${group.benefit}`, 8);
      ciColumnHeadings();
      group.entries.forEach((entry, index) => ciRow(entry, index % 2 === 1));
    });
    y += 3;
    paragraph(schedule.note, 7.8);
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
  // The rider condition list is an appendix: its own page, at the very end, only when selected.
  if (model.ciSchedule) ciAppendixPage(model.ciSchedule);
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
