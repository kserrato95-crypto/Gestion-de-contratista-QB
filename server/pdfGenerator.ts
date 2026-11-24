import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, RGB, StandardFonts } from 'pdf-lib';
import {
  ActivityReport,
  AporteSeguridadSocialItem,
  Contract,
  User,
  db,
  UPLOADS_DIR,
} from './db.js';
import { numeroALetrasCOP } from './utils/numeroALetras.js';
import { calculateTotalDays, calculateDetailedDuration } from './utils/contractDuration.js';

const LOGO_PATH = path.resolve(process.cwd(), 'public/assets/alcaldia_quimbaya_logo.png');

// Page geometry: US Letter (612 x 792 pt) matching MODALIDAD DE SELECCIÓN FINAL
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 46;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 520 pt

// Header sits at y = 764 down to 694 (70 pt tall)
const HEADER_TOP = 764;
const HEADER_H = 70;
const Y_TOP = 682; // Body content starts below header + 12pt gap

// Footer sits at y = 22 up to y = 92
const Y_BOTTOM = 104; // Safe bottom limit above footer + 12pt gap
const MAX_BODY_H = Y_TOP - Y_BOTTOM; // 578 pt

const BLACK = rgb(0.05, 0.05, 0.05);
const BORDER_COLOR = rgb(0.15, 0.15, 0.15);
const SECTION_BG = rgb(0.92, 0.94, 0.96);
const SUBHEADER_BG = rgb(0.96, 0.97, 0.98);
const MUTED_TEXT = rgb(0.35, 0.38, 0.42);
const BLUE_ACCENT = rgb(0.08, 0.22, 0.45);

interface TableCell {
  text: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  fontSize?: number;
  bg?: RGB;
  textColor?: RGB;
  padX?: number;
  padY?: number;
  lineHeightFactor?: number;
  vAlign?: 'top' | 'middle';
}

function formatCOPNumber(val: number): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '0,00';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val));
}

function formatSlashDMY(d?: string): string {
  if (!d) return '';
  const clean = String(d).trim().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, day] = clean.split('-');
    return `${day}/${m}/${y}`;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) {
    const [y, m, day] = clean.split('/');
    return `${day}/${m}/${y}`;
  }
  return clean;
}

function formatPct(val?: number): string {
  return `${formatCOPNumber(Number(val || 0))} %`;
}

function formatFechaLarga(dStr?: string): { dia: number; mes: string; anio: number; texto: string } {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  let date = new Date();
  if (dStr) {
    const clean = dStr.trim().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, day] = clean.split('-').map(Number);
      date = new Date(y, m - 1, day);
    } else {
      const parsed = new Date(dStr);
      if (!isNaN(parsed.getTime())) date = parsed;
    }
  }
  const dia = date.getDate();
  const mes = meses[date.getMonth()];
  const anio = date.getFullYear();
  return { dia, mes, anio, texto: `${dia} de ${mes} de ${anio}` };
}

/**
 * Sanitizes text so pdf-lib StandardFonts (WinAnsi) never throws an encoding error.
 */
function sanitizeWinAnsi(raw: unknown, font: PDFFont): string {
  if (raw === undefined || raw === null) return '';
  let s = String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[\u2010\u2011\u2012\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');

  // Filter any character not encodable by StandardFonts WinAnsi
  let out = '';
  for (const ch of s) {
    if (ch === '\n') {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += ' ';
    }
  }
  return out;
}

/**
 * Wraps text strictly inside maxWidth using actual font glyph metrics.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const clean = sanitizeWinAnsi(text, font);
  if (!clean) return [''];
  const safeMax = Math.max(12, maxWidth);
  const paragraphs = clean.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= safeMax) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // If single token exceeds safeMax, break character by character
        if (font.widthOfTextAtSize(word, fontSize) > safeMax) {
          let chunk = '';
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, fontSize) <= safeMax) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

class ActaPdfBuilder {
  public doc: PDFDocument;
  public font: PDFFont;
  public fontBold: PDFFont;
  public logoImg: PDFImage | null;
  public currentPage: PDFPage;
  public cursorY: number;
  public bodyTopY: number = Y_TOP;
  public bodyBottomY: number = Y_BOTTOM;

  constructor(doc: PDFDocument, font: PDFFont, fontBold: PDFFont, logoImg: PDFImage | null) {
    this.doc = doc;
    this.font = font;
    this.fontBold = fontBold;
    this.logoImg = logoImg;
    this.currentPage = this.doc.addPage([PAGE_W, PAGE_H]);
    this.cursorY = this.bodyTopY;
  }

  public maxBodyH(): number {
    return this.bodyTopY - this.bodyBottomY;
  }

  public newPage(): PDFPage {
    this.currentPage = this.doc.addPage([PAGE_W, PAGE_H]);
    this.cursorY = this.bodyTopY;
    return this.currentPage;
  }

  public remainingHeight(): number {
    return this.cursorY - this.bodyBottomY;
  }

  public ensureSpace(neededHeight: number, onNewPage?: () => void): void {
    if (this.cursorY - neededHeight < this.bodyBottomY) {
      this.newPage();
      if (onNewPage) onNewPage();
    }
  }

  public advanceY(pts: number): void {
    this.cursorY -= pts;
  }

  public drawCenteredTitle(text: string, size: number = 10.5, bold: boolean = true): void {
    const f = bold ? this.fontBold : this.font;
    const clean = sanitizeWinAnsi(text, f);
    const w = f.widthOfTextAtSize(clean, size);
    const lineH = size * 1.3;
    this.ensureSpace(lineH + 4);
    this.currentPage.drawText(clean, {
      x: MARGIN_X + (CONTENT_W - w) / 2,
      y: this.cursorY - size,
      size,
      font: f,
      color: BLACK,
    });
    this.cursorY -= lineH + 2;
  }

  public drawSectionBanner(title: string): void {
    this.drawTableRow(
      [
        {
          text: title,
          width: CONTENT_W,
          align: 'center',
          bold: true,
          fontSize: 8.5,
          bg: SECTION_BG,
          padY: 4,
          vAlign: 'middle',
        },
      ],
      18
    );
  }

  /**
   * Draws a single table row with auto-measured cell heights and clean borders.
   * Handles automatic page break + optional repeated header row, and splits oversized rows if needed.
   */
  public drawTableRow(
    cells: TableCell[],
    minHeight: number = 15,
    repeatHeaderRows?: TableCell[][]
  ): void {
    const wrappedCells = cells.map((cell) => {
      const f = cell.bold ? this.fontBold : this.font;
      const fontSize = cell.fontSize ?? 8;
      const padX = cell.padX ?? 5;
      const padY = cell.padY ?? 4;
      const lineH = fontSize * (cell.lineHeightFactor ?? 1.25);
      const lines = wrapText(cell.text, f, fontSize, cell.width - padX * 2);
      const reqH = lines.length * lineH + padY * 2;
      return { cell, f, fontSize, padX, padY, lineH, lines, reqH };
    });

    const totalH = Math.max(minHeight, ...wrappedCells.map((c) => c.reqH));

    // Normal case: fits on a page
    if (totalH <= this.maxBodyH()) {
      if (this.cursorY - totalH < this.bodyBottomY) {
        this.newPage();
        if (repeatHeaderRows) {
          for (const hRow of repeatHeaderRows) {
            this.drawTableRow(hRow, 16);
          }
        }
      }
      this.renderRowSlice(wrappedCells, totalH);
      return;
    }

    // Oversized row case (> full page height): split lines cleanly across pages
    let maxLines = Math.max(...wrappedCells.map((w) => w.lines.length));
    let lineCursor = 0;

    while (lineCursor < maxLines) {
      if (this.remainingHeight() < 36) {
        this.newPage();
        if (repeatHeaderRows) {
          for (const hRow of repeatHeaderRows) {
            this.drawTableRow(hRow, 16);
          }
        }
      }

      const avail = this.remainingHeight();
      // Compute how many lines fit in avail
      const maxLineH = Math.max(...wrappedCells.map((w) => w.lineH));
      const maxPadY = Math.max(...wrappedCells.map((w) => w.padY));
      const linesFit = Math.max(1, Math.floor((avail - maxPadY * 2) / maxLineH));
      const sliceEnd = Math.min(maxLines, lineCursor + linesFit);

      const sliceWrapped = wrappedCells.map((w) => {
        const subLines = w.lines.slice(lineCursor, sliceEnd);
        const displayLines = subLines.length > 0 ? subLines : [''];
        const reqH = displayLines.length * w.lineH + w.padY * 2;
        return { ...w, lines: displayLines, reqH };
      });

      const sliceH = Math.max(minHeight, ...sliceWrapped.map((w) => w.reqH));
      this.renderRowSlice(sliceWrapped, sliceH);
      lineCursor = sliceEnd;
    }
  }

  private renderRowSlice(
    wrappedCells: Array<{
      cell: TableCell;
      f: PDFFont;
      fontSize: number;
      padX: number;
      padY: number;
      lineH: number;
      lines: string[];
      reqH: number;
    }>,
    rowH: number
  ): void {
    const rowTop = this.cursorY;
    const rowBottom = rowTop - rowH;
    let x = MARGIN_X;

    for (const item of wrappedCells) {
      const { cell, f, fontSize, padX, padY, lineH, lines } = item;

      // Background fill ONLY if explicitly set
      if (cell.bg) {
        this.currentPage.drawRectangle({
          x,
          y: rowBottom,
          width: cell.width,
          height: rowH,
          color: cell.bg,
        });
      }

      // Crisp black cell border
      this.currentPage.drawRectangle({
        x,
        y: rowBottom,
        width: cell.width,
        height: rowH,
        borderColor: BORDER_COLOR,
        borderWidth: 0.6,
      });

      // Vertical alignment inside cell
      const textBlockH = lines.length * lineH;
      let startBaselineY: number;
      if (cell.vAlign === 'middle') {
        const extra = Math.max(0, rowH - textBlockH);
        startBaselineY = rowTop - extra / 2 - fontSize * 0.85;
      } else {
        startBaselineY = rowTop - padY - fontSize * 0.85;
      }

      const align = cell.align ?? 'left';
      const color = cell.textColor ?? BLACK;

      lines.forEach((line, idx) => {
        if (!line) return;
        const textW = f.widthOfTextAtSize(line, fontSize);
        let drawX = x + padX;
        if (align === 'center') {
          drawX = x + Math.max(padX, (cell.width - textW) / 2);
        } else if (align === 'right') {
          drawX = x + Math.max(padX, cell.width - padX - textW);
        }
        const drawY = startBaselineY - idx * lineH;
        if (drawY >= rowBottom + 1.5) {
          this.currentPage.drawText(line, {
            x: drawX,
            y: drawY,
            size: fontSize,
            font: f,
            color,
          });
        }
      });

      x += cell.width;
    }

    this.cursorY = rowBottom;
  }

  /**
   * Draws a raw bordered box (used for merged cells in Section II, XIII, XIV).
   */
  public drawRawBox(
    x: number,
    yBottom: number,
    width: number,
    height: number,
    text: string,
    opts: {
      bold?: boolean;
      fontSize?: number;
      align?: 'left' | 'center' | 'right';
      vAlign?: 'top' | 'middle';
      bg?: RGB;
      padX?: number;
      padY?: number;
      textColor?: RGB;
    } = {}
  ): void {
    if (opts.bg) {
      this.currentPage.drawRectangle({
        x,
        y: yBottom,
        width,
        height,
        color: opts.bg,
      });
    }
    this.currentPage.drawRectangle({
      x,
      y: yBottom,
      width,
      height,
      borderColor: BORDER_COLOR,
      borderWidth: 0.6,
    });

    if (!text) return;
    const f = opts.bold ? this.fontBold : this.font;
    const fontSize = opts.fontSize ?? 8;
    const padX = opts.padX ?? 5;
    const padY = opts.padY ?? 4;
    const lineH = fontSize * 1.25;
    const lines = wrapText(text, f, fontSize, width - padX * 2);
    const textBlockH = lines.length * lineH;
    const topY = yBottom + height;

    let startY: number;
    if (opts.vAlign === 'middle') {
      const extra = Math.max(0, height - textBlockH);
      startY = topY - extra / 2 - fontSize * 0.85;
    } else {
      startY = topY - padY - fontSize * 0.85;
    }

    const align = opts.align ?? 'left';
    const color = opts.textColor ?? BLACK;

    lines.forEach((line, idx) => {
      if (!line) return;
      const textW = f.widthOfTextAtSize(line, fontSize);
      let drawX = x + padX;
      if (align === 'center') {
        drawX = x + Math.max(padX, (width - textW) / 2);
      } else if (align === 'right') {
        drawX = x + Math.max(padX, width - padX - textW);
      }
      const drawY = startY - idx * lineH;
      if (drawY >= yBottom + 1.5) {
        this.currentPage.drawText(line, {
          x: drawX,
          y: drawY,
          size: fontSize,
          font: f,
          color,
        });
      }
    });
  }

  /**
   * Stamps institutional Header and Footer on Acta de Supervisión pages with true "PÁGINA X de Y".
   */
  public applyInstitutionalChrome(codigoDocumento: string = '', actaPageCount?: number): void {
    const allPages = this.doc.getPages();
    const actaCount = actaPageCount !== undefined ? Math.min(actaPageCount, allPages.length) : allPages.length;
    const pages = allPages.slice(0, actaCount);
    const total = pages.length;

    pages.forEach((page, idx) => {
      const pageNum = idx + 1;
      const prevPage = this.currentPage;
      this.currentPage = page;

      // === HEADER BOX (top: 764, bottom: 694, height: 70) ===
      const hTop = HEADER_TOP;
      const hBottom = HEADER_TOP - HEADER_H;
      const col1W = 135;
      const col2W = 255;
      const col3W = CONTENT_W - col1W - col2W; // 130

      // Col 1: Logo container
      page.drawRectangle({
        x: MARGIN_X,
        y: hBottom,
        width: col1W,
        height: HEADER_H,
        borderColor: BORDER_COLOR,
        borderWidth: 0.75,
      });

      if (this.logoImg) {
        const dims = this.logoImg.scaleToFit(col1W - 14, HEADER_H - 14);
        page.drawImage(this.logoImg, {
          x: MARGIN_X + (col1W - dims.width) / 2,
          y: hBottom + (HEADER_H - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      } else {
        this.drawRawBox(MARGIN_X, hBottom, col1W, HEADER_H, 'ALCALDÍA DE\nQUIMBAYA', {
          bold: true,
          fontSize: 9,
          align: 'center',
          vAlign: 'middle',
        });
      }

      // Col 2: Entity & Title (2 stacked boxes)
      const col2X = MARGIN_X + col1W;
      const topSubH = 38;
      const botSubH = HEADER_H - topSubH; // 32
      this.drawRawBox(
        col2X,
        hBottom + botSubH,
        col2W,
        topSubH,
        'MUNICIPIO DE QUIMBAYA\nQUINDIO\nNIT: 890.000.613-4',
        { bold: true, fontSize: 8.5, align: 'center', vAlign: 'middle', padY: 3 }
      );
      this.drawRawBox(
        col2X,
        hBottom,
        col2W,
        botSubH,
        'OFICINA ASESORA JURIDICA\nACTA DE SUPERVISIÓN',
        { bold: true, fontSize: 8.5, align: 'center', vAlign: 'middle', padY: 3 }
      );

      // Col 3: Página / Código / Versión (3 stacked boxes)
      const col3X = col2X + col2W;
      const r1H = 26;
      const r2H = 22;
      const r3H = HEADER_H - r1H - r2H; // 22
      this.drawRawBox(col3X, hTop - r1H, col3W, r1H, `PÁGINA ${pageNum} de ${total}`, {
        bold: true,
        fontSize: 8.5,
        align: 'center',
        vAlign: 'middle',
      });
      this.drawRawBox(
        col3X,
        hTop - r1H - r2H,
        col3W,
        r2H,
        codigoDocumento ? `CÓDIGO: ${codigoDocumento}` : 'CÓDIGO:',
        { bold: true, fontSize: 8.5, align: 'center', vAlign: 'middle' }
      );
      this.drawRawBox(col3X, hBottom, col3W, r3H, 'VERSIÓN: 1', {
        bold: true,
        fontSize: 8.5,
        align: 'center',
        vAlign: 'middle',
      });

      // === FOOTER CONTROL TABLE (y: 54..93) ===
      const fRowH = 13;
      const fTop = 93;
      const fw = [85, 250, 55, 130]; // sum = 520
      const footerRows = [
        ['Elaborado por:', 'P. U de Planificación y Modernización-S.P', 'Fecha:', 'Enero 21/2026'],
        ['Revisado por:', 'Secretaria de Planeación', 'Fecha:', 'Enero 21/2026'],
        ['Aprobado por:', 'Comité Institucional de Gestión y Desempeño', 'Fecha:', 'Enero 22/2026'],
      ];

      footerRows.forEach((r, rIdx) => {
        const yBot = fTop - (rIdx + 1) * fRowH;
        let fx = MARGIN_X;
        r.forEach((txt, cIdx) => {
          this.drawRawBox(fx, yBot, fw[cIdx], fRowH, txt, {
            bold: false,
            fontSize: 7,
            align: 'left',
            vAlign: 'middle',
            padX: 4,
            padY: 2,
          });
          fx += fw[cIdx];
        });
      });

      // === FOOTER CONTACT INFO (y: 22..50) ===
      const footerLines = [
        'Correo electrónico: ventanillaunica@quimbaya-quindio.gov.co - www.quimbaya-quindio.gov.co Dirección: Carrera 6 Calle 12 Esquina -',
        'Quimbaya Quindío - Teléfono de contacto +57 3175519367 Horario de atención: Lunes a Jueves de 08:00 am a 12:00 - 02:00 pm a 06:30 pm -',
        'Viernes de 08:00 am a 12:00 - 02:00 pm a 04:00 pm Código postal urbano 634020, código postal rural 634027',
      ];
      footerLines.forEach((line, lIdx) => {
        const clean = sanitizeWinAnsi(line, this.font);
        const tw = this.font.widthOfTextAtSize(clean, 6.5);
        page.drawText(clean, {
          x: MARGIN_X + (CONTENT_W - tw) / 2,
          y: 44 - lIdx * 8.5,
          size: 6.5,
          font: this.font,
          color: MUTED_TEXT,
        });
      });

      this.currentPage = prevPage;
    });
  }
}

/**
 * Resolves the supervisor's email from registered users without inventing data.
 */
export function findSupervisorEmail(contract: Contract): string {
  const users = db.getUsers();
  const doc = (contract.supervisorDocumento || '').trim();
  if (doc) {
    const byDoc = users.find((u) => (u.numeroDocumento || '').trim() === doc);
    if (byDoc?.email) return byDoc.email;
  }
  const supName = (contract.supervisorResponsable || '').trim().toLowerCase();
  if (supName) {
    const byName = users.find(
      (u) => `${u.nombres || ''} ${u.apellidos || ''}`.trim().toLowerCase() === supName
    );
    if (byName?.email) return byName.email;
  }
  return '';
}

/**
 * Generates the official Acta de Supervisión PDF strictly following
 * the institutional template "MODALIDAD DE SELECCIÓN FINAL" (Sections I - XIV + Evidence Annexes)
 * followed immediately by the official "INFORME DE ACTIVIDADES".
 */
export async function generateActaSupervisionPdf(
  report: ActivityReport,
  contract: Contract,
  contractor: User
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImg: PDFImage | null = null;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      const logoBytes = fs.readFileSync(LOGO_PATH);
      logoImg = await pdfDoc.embedPng(logoBytes);
    } catch (e) {
      console.warn('Could not embed institutional logo PNG:', e);
    }
  }

  const b = new ActaPdfBuilder(pdfDoc, font, fontBold, logoImg);

  // Derived safe contract & contractor fields (never invent missing data)
  const contNombre = contractor
    ? `${contractor.nombres || ''} ${contractor.apellidos || ''}`.trim().toUpperCase()
    : (report.contratistaNombre || contract.contratistaNombre || '').toUpperCase();
  const contDoc = contractor?.numeroDocumento || contract.contratistaDocumento || '';

  const supNombre = (contract.supervisorResponsable || '').toUpperCase();
  const supCargo = (contract.supervisorCargo || '').toUpperCase();
  const supLine = [supNombre, supCargo].filter(Boolean).join(' - ');
  const supDoc = contract.supervisorDocumento || '';

  const bancoParts: string[] = [];
  if (contractor?.banco) bancoParts.push(contractor.banco.toUpperCase());
  if (contractor?.tipoCuenta) bancoParts.push(`CUENTA DE ${contractor.tipoCuenta.toUpperCase()}`);
  if (contractor?.numeroCuenta) bancoParts.push(`N.º ${contractor.numeroCuenta}`);
  const bancoInfo = bancoParts.length > 0 ? bancoParts.join(', ') : 'Pendiente por registrar';

  const periodoInfo =
    report.fechaInicioPeriodo && report.fechaFinPeriodo
      ? `Del ${formatSlashDMY(report.fechaInicioPeriodo)} al ${formatSlashDMY(report.fechaFinPeriodo)}`
      : report.periodo || '';

  const totalDias =
    contract.vigenciaDias ||
    calculateTotalDays(contract.fechaInicio, contract.fechaFin) ||
    0;
  const detailedDuration =
    contract.duracionTexto ||
    (contract.fechaInicio && contract.fechaFin
      ? calculateDetailedDuration(contract.fechaInicio, contract.fechaFin).texto
      : '');

  const fechaActaInfo =
    report.lugarFechaActa ||
    `${contract.lugarEjecucion || 'Quimbaya, Quindío'}, ${formatFechaLarga(report.fechaRadicacion || report.createdAt).texto}`;

  const fin = report.financiero || {
    valorInicial: Number(contract.valorTotal) || 0,
    valoresAdicionales: 0,
    valorPagadoALaFecha: 0,
    valorPresentePago: Number(contract.honorariosMensuales) || 0,
    saldoPorPagar: Number(contract.valorTotal) || 0,
    saldoPorEjecutar: Number(contract.valorTotal) || 0,
    valorTotalFinal: Number(contract.valorTotal) || 0,
    porcentajeAvanceTiempoPeriodo: 0,
    porcentajeAvanceFinancieroPeriodo: 0,
    porcentajeAvanceTiempoAcumulado: 0,
    porcentajeAvanceFinancieroAcumulado: 0,
  };

  // =========================================================================
  // TITLE
  // =========================================================================
  b.drawCenteredTitle(`ACTA DE SUPERVISIÓN N° ${report.numeroActa || 1}`, 11, true);
  b.advanceY(4);

  // =========================================================================
  // I. DATOS GENERALES
  // =========================================================================
  b.drawSectionBanner('I. DATOS GENERALES');
  const wLabel1 = 145;
  const wValFull = CONTENT_W - wLabel1; // 375
  const wValMid = 195;
  const wCCLabel = 75;
  const wCCVal = CONTENT_W - wLabel1 - wValMid - wCCLabel; // 105

  b.drawTableRow([
    { text: 'Contrato Número:', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: contract.numeroContrato || '', width: wValFull, bold: true },
  ]);
  b.drawTableRow([
    { text: 'Tipo de Contrato', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: contract.tipoContrato || 'CONTRATO DE PRESTACIÓN DE SERVICIOS', width: wValFull },
  ]);
  b.drawTableRow([
    { text: 'Entidad Contratante', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: contract.entidadContratante || 'MUNICIPIO DE QUIMBAYA, QUINDÍO', width: wValFull, bold: true },
  ]);
  b.drawTableRow([
    { text: 'Lugar y Fecha del acta:', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: fechaActaInfo, width: wValFull },
  ]);
  b.drawTableRow([
    { text: 'Contratista', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: contNombre, width: wValMid, bold: true },
    { text: 'C.C o NIT', width: wCCLabel, bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: contDoc, width: wCCVal, bold: true, align: 'center' },
  ]);
  b.drawTableRow([
    { text: 'Objeto del Contrato', width: wLabel1, bold: true, bg: SUBHEADER_BG, vAlign: 'middle' },
    { text: contract.objeto || '', width: wValFull, fontSize: 7.8 },
  ]);
  b.drawTableRow([
    { text: 'Supervisor', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: supLine || 'Pendiente por asignar', width: wValMid, bold: true },
    { text: 'C.C o NIT', width: wCCLabel, bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: supDoc || '', width: wCCVal, align: 'center' },
  ]);
  b.drawTableRow([
    { text: 'Número de Cuenta bancaria', width: wLabel1, bold: true, bg: SUBHEADER_BG, vAlign: 'middle' },
    { text: bancoInfo, width: wValMid, fontSize: 7.8 },
    { text: 'Periodo Informado', width: wCCLabel, bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    { text: periodoInfo, width: wCCVal, align: 'center', fontSize: 7.5, vAlign: 'middle' },
  ]);

  b.advanceY(8);

  // =========================================================================
  // II. PROCESO INICIAL
  // =========================================================================
  b.drawSectionBanner('II. PROCESO INICIAL');
  const valLetras = numeroALetrasCOP(Number(contract.valorTotal) || 0);
  b.drawTableRow([
    { text: 'Valor del Contrato', width: wLabel1, bold: true, bg: SUBHEADER_BG, vAlign: 'middle' },
    {
      text: `${valLetras} ($ ${formatCOPNumber(Number(contract.valorTotal) || 0)})`,
      width: wValFull,
      bold: true,
      fontSize: 7.8,
    },
  ]);

  // 2-row merged sub-block: Fecha de Inicio Contrato + CDP # / CRP #
  const drawPresupuestalSubBlock = (
    leftTitle: string,
    leftValue: string,
    cdpNum: string,
    cdpFec: string,
    crpNum: string,
    crpFec: string
  ) => {
    const subRowH = 16;
    const blockH = subRowH * 2;
    b.ensureSpace(blockH);
    const yTopBlock = b.cursorY;
    const yMidBlock = yTopBlock - subRowH;
    const yBotBlock = yTopBlock - blockH;

    // Col widths summing to CONTENT_W (520): 145 + 55 + 132 + 55 + 133
    const c1 = wLabel1; // 145
    const c2 = 55;
    const c3 = 132;
    const c4 = 55;
    const c5 = CONTENT_W - c1 - c2 - c3 - c4; // 133

    const leftText = leftValue ? `${leftTitle}\n${leftValue}` : leftTitle;
    b.drawRawBox(MARGIN_X, yBotBlock, c1, blockH, leftText, {
      bold: true,
      fontSize: 7.8,
      bg: SUBHEADER_BG,
      vAlign: 'middle',
    });

    // Top row: CDP # | val | CRP # | val
    b.drawRawBox(MARGIN_X + c1, yMidBlock, c2, subRowH, 'CDP #:', {
      bold: true,
      fontSize: 7.8,
      bg: SUBHEADER_BG,
      vAlign: 'middle',
    });
    b.drawRawBox(MARGIN_X + c1 + c2, yMidBlock, c3, subRowH, cdpNum, {
      bold: true,
      fontSize: 8,
      vAlign: 'middle',
    });
    b.drawRawBox(MARGIN_X + c1 + c2 + c3, yMidBlock, c4, subRowH, 'CRP #:', {
      bold: true,
      fontSize: 7.8,
      bg: SUBHEADER_BG,
      vAlign: 'middle',
    });
    b.drawRawBox(MARGIN_X + c1 + c2 + c3 + c4, yMidBlock, c5, subRowH, crpNum, {
      bold: true,
      fontSize: 8,
      vAlign: 'middle',
    });

    // Bottom row: Fecha | val | Fecha | val
    b.drawRawBox(MARGIN_X + c1, yBotBlock, c2, subRowH, 'Fecha:', {
      bold: true,
      fontSize: 7.8,
      bg: SUBHEADER_BG,
      vAlign: 'middle',
    });
    b.drawRawBox(MARGIN_X + c1 + c2, yBotBlock, c3, subRowH, cdpFec, {
      fontSize: 8,
      vAlign: 'middle',
    });
    b.drawRawBox(MARGIN_X + c1 + c2 + c3, yBotBlock, c4, subRowH, 'Fecha:', {
      bold: true,
      fontSize: 7.8,
      bg: SUBHEADER_BG,
      vAlign: 'middle',
    });
    b.drawRawBox(MARGIN_X + c1 + c2 + c3 + c4, yBotBlock, c5, subRowH, crpFec, {
      fontSize: 8,
      vAlign: 'middle',
    });

    b.cursorY = yBotBlock;
  };

  drawPresupuestalSubBlock(
    'Fecha de Inicio Contrato',
    formatSlashDMY(contract.fechaInicio),
    contract.cdpNumero || '',
    formatSlashDMY(contract.cdpFecha),
    contract.crpNumero || '',
    formatSlashDMY(contract.crpFecha)
  );

  const plazoTexto = contract.fechaInicio && contract.fechaFin
    ? `Del ${formatSlashDMY(contract.fechaInicio)} al ${formatSlashDMY(contract.fechaFin)}${detailedDuration ? ` (${detailedDuration})` : ''}`
    : '';
  b.drawTableRow([
    { text: 'Plazo de Ejecución del Contrato', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: plazoTexto, width: 187 },
    { text: 'Vigencia', width: 55, bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    {
      text: totalDias > 0 ? `${totalDias} días calendario` : '',
      width: CONTENT_W - wLabel1 - 187 - 55,
      bold: true,
      align: 'center',
      vAlign: 'middle',
    },
  ]);

  b.drawTableRow([
    { text: 'Fecha Contractual de Terminación Contrato', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: formatSlashDMY(contract.fechaFin), width: wValFull, bold: true },
  ]);

  // Adición rows (if any addition/prorroga exists in contract.modificaciones)
  const mods = contract.modificaciones || [];
  const lastMod = mods.length > 0 ? mods[mods.length - 1] : null;
  drawPresupuestalSubBlock(
    'Fecha de Inicio de adición',
    lastMod?.fecha ? formatSlashDMY(lastMod.fecha) : 'No aplica',
    '',
    '',
    '',
    ''
  );
  b.drawTableRow([
    { text: 'Plazo de Ejecucion Adición', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: lastMod ? lastMod.objeto || '' : 'No aplica', width: 187 },
    { text: 'Vigencia', width: 55, bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    { text: lastMod ? '' : 'No aplica', width: CONTENT_W - wLabel1 - 187 - 55, align: 'center', vAlign: 'middle' },
  ]);
  b.drawTableRow([
    { text: 'Fecha Contractual de Terminación de la adición', width: wLabel1, bold: true, bg: SUBHEADER_BG },
    { text: lastMod ? '' : 'No aplica', width: wValFull },
  ]);

  b.advanceY(8);

  // =========================================================================
  // III. RESUMEN POLIZAS
  // =========================================================================
  b.drawSectionBanner('III. RESUMEN POLIZAS');
  const pol = contract.polizas;
  const polAplica = Boolean(pol?.aplica);
  const pCols = [145, 42, 42, 85, 110, CONTENT_W - 145 - 42 - 42 - 85 - 110]; // last = 96

  const polizaHeader: TableCell[] = [
    { text: 'Garantías y/o Pólizas del contrato', width: pCols[0], bold: true, bg: SUBHEADER_BG },
    { text: 'Si\nAplica', width: pCols[1], bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    { text: 'No\nAplica', width: pCols[2], bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    { text: 'No. de Póliza', width: pCols[3], bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    { text: 'Detalle', width: pCols[4], bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
    { text: 'Vigencia', width: pCols[5], bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' },
  ];
  b.drawTableRow(polizaHeader, 24);

  const polizaVigenciaResumen = polAplica
    ? [
        pol?.cumplimientoHasta ? `Cump: ${formatSlashDMY(pol.cumplimientoHasta)}` : '',
        pol?.calidadHasta ? `Cal: ${formatSlashDMY(pol.calidadHasta)}` : '',
        pol?.salariosHasta ? `Sal: ${formatSlashDMY(pol.salariosHasta)}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
    : '';

  const polizaRows: Array<[string, string, string, string]> = [
    [
      'Tipo de Garantía',
      polAplica ? pol?.numeroGarantia || '' : '',
      polAplica ? pol?.tipoGarantia || 'Póliza de Cumplimiento' : '',
      polizaVigenciaResumen,
    ],
    ['Nombre del Garante', '', polAplica ? pol?.nombreGarante || '' : '', ''],
    ['Número de la Garantía', polAplica ? pol?.numeroGarantia || '' : '', '', ''],
    ['Contratista Tomador', '', polAplica ? pol?.contratistaTomador || contNombre : '', ''],
    ['Beneficiario', '', polAplica ? pol?.beneficiario || (contract.entidadContratante || 'MUNICIPIO DE QUIMBAYA') : '', ''],
    ['Compañía /Aseguradora', '', polAplica ? pol?.companiaAseguradora || '' : '', ''],
  ];

  polizaRows.forEach(([label, nroPol, detalle, vig]) => {
    b.drawTableRow(
      [
        { text: label, width: pCols[0], bold: true, bg: SUBHEADER_BG },
        { text: polAplica ? 'X' : '', width: pCols[1], bold: true, align: 'center', vAlign: 'middle' },
        { text: !polAplica ? 'X' : '', width: pCols[2], bold: true, align: 'center', vAlign: 'middle' },
        { text: nroPol, width: pCols[3], align: 'center', fontSize: 7.5 },
        { text: detalle, width: pCols[4], fontSize: 7.5 },
        { text: vig, width: pCols[5], align: 'center', fontSize: 7.2 },
      ],
      16,
      [polizaHeader]
    );
  });

  // Amparos sub-table
  const ampCols = [165, 118, 118, CONTENT_W - 165 - 118 - 118]; // last = 119
  b.drawTableRow([
    {
      text: 'Amparos: incluir líneas según número de amparos tales como cumplimiento, calidad del servicio)',
      width: ampCols[0],
      bold: true,
      bg: SUBHEADER_BG,
      fontSize: 7.5,
    },
    {
      text: polAplica ? pol?.amparos || 'Cumplimiento, calidad y prestaciones según contrato.' : 'No aplica',
      width: CONTENT_W - ampCols[0],
      fontSize: 7.8,
      vAlign: 'middle',
    },
  ]);

  const amparoHeader: TableCell[] = [
    { text: 'Cumplimiento', width: ampCols[0], bold: true, bg: SUBHEADER_BG },
    { text: 'Desde', width: ampCols[1], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Hasta', width: ampCols[2], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Valor', width: ampCols[3], bold: true, bg: SUBHEADER_BG, align: 'center' },
  ];
  // Wait: in template, Cumplimiento IS row 1 with Desde | Hasta | Valor as header row, and Calidad / Salarios below!
  // Let's draw header row ("Amparo | Desde | Hasta | Valor") OR exact template row ("Cumplimiento | Desde | Hasta | Valor")
  // Looking closely at Page 2 screenshot: row has col1="Cumplimiento" (actually Cumplimiento value row is merged or header! Let's include header + 3 amparo rows clearly so Cumplimiento also displays its dates!).
  b.drawTableRow([
    { text: 'Amparo', width: ampCols[0], bold: true, bg: SUBHEADER_BG },
    { text: 'Desde', width: ampCols[1], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Hasta', width: ampCols[2], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Valor', width: ampCols[3], bold: true, bg: SUBHEADER_BG, align: 'center' },
  ]);
  const fecInicioFmt = polAplica ? formatSlashDMY(contract.fechaInicio) : '';
  b.drawTableRow([
    { text: 'Cumplimiento', width: ampCols[0], bold: true },
    { text: fecInicioFmt, width: ampCols[1], align: 'center' },
    { text: polAplica ? formatSlashDMY(pol?.cumplimientoHasta) : 'N/A', width: ampCols[2], align: 'center' },
    { text: polAplica ? 'Según póliza' : 'N/A', width: ampCols[3], align: 'center' },
  ]);
  b.drawTableRow([
    { text: 'Calidad:', width: ampCols[0], bold: true },
    { text: fecInicioFmt, width: ampCols[1], align: 'center' },
    { text: polAplica ? formatSlashDMY(pol?.calidadHasta) : 'N/A', width: ampCols[2], align: 'center' },
    { text: polAplica ? 'Según póliza' : 'N/A', width: ampCols[3], align: 'center' },
  ]);
  b.drawTableRow([
    { text: 'Pago de salarios, Prestaciones Sociales e Indemnizaciones', width: ampCols[0], bold: true, fontSize: 7.5 },
    { text: fecInicioFmt, width: ampCols[1], align: 'center', vAlign: 'middle' },
    { text: polAplica ? formatSlashDMY(pol?.salariosHasta) : 'N/A', width: ampCols[2], align: 'center', vAlign: 'middle' },
    { text: polAplica ? 'Según póliza' : 'N/A', width: ampCols[3], align: 'center', vAlign: 'middle' },
  ]);

  b.advanceY(8);

  // =========================================================================
  // IV. MODIFICACIONES CONTRACTUALES
  // =========================================================================
  b.ensureSpace(64);
  b.drawSectionBanner('IV. MODIFICACIONES CONTRACTUALES');
  const modW1 = 210;
  const modW2 = CONTENT_W - modW1; // 310

  const modNroText = mods.length > 0 ? mods.map((m) => m.modificacionNro).join(', ') : 'No aplica';
  const modFechaText = mods.length > 0 ? mods.map((m) => formatSlashDMY(m.fecha)).join(', ') : 'No aplica';
  const modObjText = mods.length > 0 ? mods.map((m) => `${m.modificacionNro}: ${m.objeto}`).join('\n') : 'No aplica';

  const modRows: Array<[string, string, boolean?]> = [
    ['Modificación Nro.', modNroText],
    ['Fecha', modFechaText],
    ['Objeto de la Modificación', modObjText],
    ['Valor Inicial del Contrato', `$ ${formatCOPNumber(fin.valorInicial)}`, true],
    ['Valores Adicionales', `$ ${formatCOPNumber(fin.valoresAdicionales)}`],
    ['Valor Pagado a la Fecha', `$ ${formatCOPNumber(fin.valorPagadoALaFecha)}`, true],
    ['Valor del Presente Pago', `$ ${formatCOPNumber(fin.valorPresentePago)}`, true],
    ['Saldo del Contrato por Pagar', `$ ${formatCOPNumber(fin.saldoPorPagar)}`, true],
    ['Saldo del Contrato por Ejecutar', `$ ${formatCOPNumber(fin.saldoPorEjecutar)}`, true],
    ['Valor Total Final', `$ ${formatCOPNumber(fin.valorTotalFinal)}`, true],
  ];

  modRows.forEach(([lbl, val, isBold], idx) => {
    const isMoney = idx >= 3;
    b.drawTableRow([
      { text: lbl, width: modW1, bold: true, bg: idx === modRows.length - 1 ? SECTION_BG : SUBHEADER_BG },
      {
        text: val,
        width: modW2,
        bold: Boolean(isBold),
        align: isMoney ? 'right' : 'left',
        bg: idx === modRows.length - 1 ? SECTION_BG : undefined,
      },
    ]);
  });

  b.advanceY(8);

  // =========================================================================
  // V. ACTIVIDADES REALIZADAS POR EL CONTRATISTA (Dynamic growth, unlimited rows)
  // =========================================================================
  b.ensureSpace(64);
  b.drawSectionBanner('V. ACTIVIDADES REALIZADAS POR EL CONTRATISTA');
  const actCols = [26, 154, 225, CONTENT_W - 26 - 154 - 225]; // last = 115
  const actColHeader: TableCell[] = [
    { text: 'N°', width: actCols[0], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Compromisos Contractuales', width: actCols[1], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Actividades Realizadas', width: actCols[2], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Productos', width: actCols[3], bold: true, bg: SUBHEADER_BG, align: 'center' },
  ];
  b.drawTableRow(actColHeader, 18);

  const actividades = report.actividades || [];
  if (actividades.length === 0) {
    b.drawTableRow([
      { text: '1', width: actCols[0], align: 'center', bold: true },
      { text: 'Sin compromisos registrados en este informe.', width: actCols[1] },
      { text: '', width: actCols[2] },
      { text: '', width: actCols[3] },
    ]);
  } else {
    actividades.forEach((act, idx) => {
      const photoCount = act.fotografias?.length || 0;
      const sopCount = act.soportes?.length || 0;
      const anexNotes: string[] = [];
      if (photoCount > 0) anexNotes.push(`${photoCount} evidencia(s) fotográfica(s) en Anexo`);
      if (sopCount > 0) anexNotes.push(`${sopCount} documento(s) soporte(s)`);

      const productosText = [act.productos || '', anexNotes.length > 0 ? `(${anexNotes.join('; ')})` : '']
        .filter(Boolean)
        .join('\n');

      b.drawTableRow(
        [
          { text: String(idx + 1), width: actCols[0], align: 'center', bold: true, fontSize: 8 },
          { text: act.obligacion || '', width: actCols[1], fontSize: 7.5 },
          { text: act.actividadRealizada || '', width: actCols[2], fontSize: 7.5 },
          { text: productosText, width: actCols[3], fontSize: 7.5 },
        ],
        20,
        [actColHeader]
      );
    });
  }

  b.advanceY(8);

  // =========================================================================
  // VI. VERIFICACIÓN INTEGRAL DEL CUMPLIMIENTO CONTRACTUAL
  // =========================================================================
  b.ensureSpace(64);
  b.drawSectionBanner('VI. VERIFICACIÓN INTEGRAL DEL CUMPLIMIENTO CONTRACTUAL');

  // 4-cell summary percentages table (exact layout from Page 2 bottom + Page 3 top)
  const pctCols = [195, 65, 195, CONTENT_W - 195 - 65 - 195]; // last = 65
  b.drawTableRow([
    {
      text: 'Porcentaje de Avance en Tiempo período informado (%) (mes)',
      width: pctCols[0],
      bold: true,
      bg: SUBHEADER_BG,
      fontSize: 7.8,
      vAlign: 'middle',
    },
    {
      text: formatPct(fin.porcentajeAvanceTiempoPeriodo),
      width: pctCols[1],
      bold: true,
      align: 'center',
      vAlign: 'middle',
    },
    {
      text: 'Avance Financiero del Período Informado (%) (mes)',
      width: pctCols[2],
      bold: true,
      bg: SUBHEADER_BG,
      fontSize: 7.8,
      vAlign: 'middle',
    },
    {
      text: formatPct(fin.porcentajeAvanceFinancieroPeriodo),
      width: pctCols[3],
      bold: true,
      align: 'center',
      vAlign: 'middle',
    },
  ]);

  b.drawTableRow([
    {
      text: 'Avance total en tiempo del contrato en % (acumulado):',
      width: pctCols[0],
      bold: true,
      bg: SUBHEADER_BG,
      fontSize: 7.8,
      vAlign: 'middle',
    },
    {
      text: formatPct(fin.porcentajeAvanceTiempoAcumulado),
      width: pctCols[1],
      bold: true,
      align: 'center',
      vAlign: 'middle',
    },
    {
      text: 'Avance Financiero Total del contrato en % (acumulado):',
      width: pctCols[2],
      bold: true,
      bg: SUBHEADER_BG,
      fontSize: 7.8,
      vAlign: 'middle',
    },
    {
      text: formatPct(fin.porcentajeAvanceFinancieroAcumulado),
      width: pctCols[3],
      bold: true,
      align: 'center',
      vAlign: 'middle',
    },
  ]);

  // Checklist table helper for 3-option ("Cumple | Parcial | No cumple") tables
  const chkCols = [75, 213, 42, 42, 42, CONTENT_W - 75 - 213 - 42 - 42 - 42]; // last = 106
  const drawVerificacionHeader = () => {
    const hTopH = 24;
    const hBotH = 20;
    const totH = hTopH + hBotH;
    // Ensure at least header + one substantial row fits on current page so header never orphans
    b.ensureSpace(totH + 56);
    const yT = b.cursorY;
    const yM = yT - hTopH;
    const yB = yT - totH;

    let x = MARGIN_X;
    b.drawRawBox(x, yB, chkCols[0], totH, 'Componente', { bold: true, fontSize: 8, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG });
    x += chkCols[0];
    b.drawRawBox(x, yB, chkCols[1], totH, 'Aspecto Verificado', { bold: true, fontSize: 8, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG });
    x += chkCols[1];

    const resW = chkCols[2] + chkCols[3] + chkCols[4];
    b.drawRawBox(x, yM, resW, hTopH, 'Resultado de la Verificación del Supervisor', {
      bold: true,
      fontSize: 7.2,
      align: 'center',
      vAlign: 'middle',
      bg: SUBHEADER_BG,
      padX: 2,
      padY: 2,
    });
    b.drawRawBox(x, yB, chkCols[2], hBotH, 'Cumple', { bold: true, fontSize: 7.2, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG, padX: 1 });
    b.drawRawBox(x + chkCols[2], yB, chkCols[3], hBotH, 'Parcial', { bold: true, fontSize: 7.2, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG, padX: 1 });
    b.drawRawBox(x + chkCols[2] + chkCols[3], yB, chkCols[4], hBotH, 'No\ncumple', { bold: true, fontSize: 7, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG, padX: 1 });
    x += resW;

    b.drawRawBox(x, yB, chkCols[5], totH, 'Observaciones', { bold: true, fontSize: 8, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG });
    b.cursorY = yB;
  };

  drawVerificacionHeader();

  const ver = report.verificacionIntegral;
  const verRepeatHeader: TableCell[] = [
    { text: 'Componente', width: chkCols[0], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
    { text: 'Aspecto Verificado', width: chkCols[1], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
    { text: 'Cumple', width: chkCols[2], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7 },
    { text: 'Parcial', width: chkCols[3], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7 },
    { text: 'No cumple', width: chkCols[4], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 6.8 },
    { text: 'Observaciones', width: chkCols[5], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
  ];

  const componentesList: Array<{
    key: keyof NonNullable<ActivityReport['verificacionIntegral']>;
    nombre: string;
    descripcion: string;
  }> = [
    {
      key: 'tecnico',
      nombre: 'Técnico',
      descripcion:
        'Cumplimiento de las especificaciones técnicas, planos, calidades, licencias, autorizaciones, personal técnico, cumplimiento de los plazos, cronogramas, cumplimiento de los amparos del contrato y actividades y productos frente al objeto contractual, entre otros aspectos determinados en el componente técnico que se requiera',
    },
    {
      key: 'administrativo',
      nombre: 'Administrativo',
      descripcion:
        'Entrega oportuna de informes, soportes y evidencias contractuales; las garantías se encuentran vigentes y su cobertura de acuerdo a los términos determinados en el contrato; novedades existentes en la ejecución y terminación del contrato; la existencia de los respectivos informes generados desde el contratista respecto al cumplimiento del objeto contractual, entre otros aspectos determinados en el componente administrativo que se requiera',
    },
    {
      key: 'financiero',
      nombre: 'Financiero',
      descripcion:
        'Correspondencia entre actividades ejecutadas y valor a reconocer en el periodo respectivo, determinando los documentos para el pago; existencia de las apropiaciones presupuestales; las actas de recibidos a satisfacción de los bienes entregados o ejecutados conforme a lo estipulado en el contrato; las cuentas de cobro cumplen con los requisitos presupuestarios en la entidad; determinar el balance presupuestario para los pagos, la entrega de los anticipos, y si hay actividades adicionales, entre otros aspectos determinados en el componente financiero que se requiera',
    },
    {
      key: 'contable',
      nombre: 'Contable',
      descripcion:
        'revisión de cuenta de cobro que incluya los registros presupuestarios; soportes de pago y el recibo a satisfacción de los bienes o servicios objeto del contrato; cuentas bancarias determinadas para el pago; entre otros aspectos determinados en el componente contable que se requiera',
    },
    {
      key: 'juridico',
      nombre: 'Jurídico',
      descripcion:
        'verificación del cumplimiento de obligaciones contractuales y ausencia de novedades que afecten la ejecución; la existencia del acta de inicio, y actas de adición o prorroga con las respectivas pólizas determinar el cumplimiento de las disposiciones del sistema de seguridad social y salud en el trabajo; relacionar hechos o circunstancias que puedan constituir actos de corrupción entre otros aspectos determinados en el componente jurídico que se requiera',
    },
  ];

  componentesList.forEach(({ key, nombre, descripcion }) => {
    const state = ver?.[key];
    b.drawTableRow(
      [
        { text: nombre, width: chkCols[0], bold: true, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle', fontSize: 8 },
        { text: descripcion, width: chkCols[1], fontSize: 7.3 },
        { text: state?.resultado === 'Cumple' ? 'X' : '', width: chkCols[2], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'Parcial' ? 'X' : '', width: chkCols[3], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'No cumple' ? 'X' : '', width: chkCols[4], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.observaciones || '', width: chkCols[5], fontSize: 7.3 },
      ],
      24,
      [verRepeatHeader]
    );
  });

  // Sub-table: Aspectos para Realizar Seguimiento
  const segCols = [288, 42, 42, 42, CONTENT_W - 288 - 42 - 42 - 42]; // last = 106
  const segHeader: TableCell[] = [
    { text: 'Aspectos para Realizar Seguimiento', width: segCols[0], bold: true, bg: SUBHEADER_BG, fontSize: 8 },
    { text: 'Cumple', width: segCols[1], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'Parcial', width: segCols[2], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'No\nCumple', width: segCols[3], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7 },
    { text: 'Observaciones', width: segCols[4], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 8 },
  ];
  b.ensureSpace(44);
  b.drawTableRow(segHeader, 20);

  const segItems: Array<{
    key: keyof NonNullable<ActivityReport['verificacionIntegral']>;
    label: string;
  }> = [
    { key: 'bienesRecibidos', label: 'Bienes y/o Servicios Recibidos a la Fecha' },
    { key: 'bienesPendientes', label: 'Bienes y/o Servicios Pendientes por Recibir' },
    { key: 'informesPresentados', label: 'Informes de Supervisión Presentados a la Fecha' },
  ];

  segItems.forEach(({ key, label }) => {
    const state = ver?.[key];
    b.drawTableRow(
      [
        { text: label, width: segCols[0], bold: true, fontSize: 7.8 },
        { text: state?.resultado === 'Cumple' ? 'X' : '', width: segCols[1], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'Parcial' ? 'X' : '', width: segCols[2], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'No cumple' ? 'X' : '', width: segCols[3], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.observaciones || '', width: segCols[4], fontSize: 7.3 },
      ],
      16,
      [segHeader]
    );
  });

  b.advanceY(8);

  // =========================================================================
  // VII. CONTROL DE NOVEDADES CONTRACTUALES
  // =========================================================================
  b.ensureSpace(64);
  b.drawSectionBanner('VII. CONTROL DE NOVEDADES CONTRACTUALES');
  const novHeader: TableCell[] = [
    { text: 'Item', width: segCols[0], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 8 },
    { text: 'Cumple', width: segCols[1], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'Parcial', width: segCols[2], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'No\nCumple', width: segCols[3], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7 },
    { text: 'Observaciones', width: segCols[4], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 8 },
  ];
  b.drawTableRow(novHeader, 20);

  const nov = report.controlNovedades;
  const novedadesList: Array<{
    key: keyof NonNullable<ActivityReport['controlNovedades']>;
    pregunta: string;
  }> = [
    { key: 'retrasos', pregunta: '¿Se presentaron retrasos en el cumplimiento de actividades durante el periodo evaluado?' },
    { key: 'requerimientos', pregunta: '¿Se presentaron requerimientos al contratista?' },
    { key: 'incumplimiento', pregunta: '¿Se evidenció incumplimiento parcial o total de alguna obligación?' },
    { key: 'ajusteCronograma', pregunta: '¿Se requirió ajustar cronograma, forma de ejecución o productos?' },
    { key: 'suspensionProrroga', pregunta: '¿Se presentó suspensión, prórroga, adición, modificación u otra novedad contractual?' },
    { key: 'riesgos', pregunta: '¿Se identificaron riesgos que puedan afectar la ejecución del contrato?' },
  ];

  novedadesList.forEach(({ key, pregunta }) => {
    const state = nov?.[key];
    b.drawTableRow(
      [
        { text: pregunta, width: segCols[0], bold: true, fontSize: 7.6 },
        { text: state?.resultado === 'Cumple' ? 'X' : '', width: segCols[1], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'Parcial' ? 'X' : '', width: segCols[2], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'No cumple' ? 'X' : '', width: segCols[3], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.observaciones || '', width: segCols[4], fontSize: 7.3 },
      ],
      18,
      [novHeader]
    );
  });

  b.advanceY(8);

  // =========================================================================
  // VIII. CONTROL DE PRINCIPIOS Y CUMPLIMIENTO JURÍDICO
  // =========================================================================
  b.ensureSpace(88);
  b.drawSectionBanner('VIII. CONTROL DE PRINCIPIOS Y CUMPLIMIENTO JURÍDICO');
  const drawTwoRowChkHeader = (leftLabel: string, rightLabel: string, colLabels: [string, string, string]) => {
    const h1 = 16;
    const h2 = 18;
    const tot = h1 + h2;
    b.ensureSpace(tot + 32);
    const yT = b.cursorY;
    const yM = yT - h1;
    const yB = yT - tot;

    b.drawRawBox(MARGIN_X, yB, segCols[0], tot, leftLabel, {
      bold: true,
      fontSize: 8,
      align: 'center',
      vAlign: 'middle',
      bg: SUBHEADER_BG,
    });
    const verX = MARGIN_X + segCols[0];
    const verW = segCols[1] + segCols[2] + segCols[3];
    b.drawRawBox(verX, yM, verW, h1, 'Verificación', {
      bold: true,
      fontSize: 7.5,
      align: 'center',
      vAlign: 'middle',
      bg: SUBHEADER_BG,
    });
    b.drawRawBox(verX, yB, segCols[1], h2, colLabels[0], { bold: true, fontSize: 7.2, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG, padX: 1 });
    b.drawRawBox(verX + segCols[1], yB, segCols[2], h2, colLabels[1], { bold: true, fontSize: 7.2, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG, padX: 1 });
    b.drawRawBox(verX + segCols[1] + segCols[2], yB, segCols[3], h2, colLabels[2], { bold: true, fontSize: 7, align: 'center', vAlign: 'middle', bg: SUBHEADER_BG, padX: 1 });

    b.drawRawBox(verX + verW, yB, segCols[4], tot, rightLabel, {
      bold: true,
      fontSize: 7.8,
      align: 'center',
      vAlign: 'middle',
      bg: SUBHEADER_BG,
    });
    b.cursorY = yB;
  };

  drawTwoRowChkHeader('Aspecto Jurídico a Verificar', 'Observaciones del Supervisor', ['Cumple', 'Parcial', 'No\nCumple']);

  const priRepeatHeader: TableCell[] = [
    { text: 'Aspecto Jurídico a Verificar', width: segCols[0], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
    { text: 'Cumple', width: segCols[1], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7 },
    { text: 'Parcial', width: segCols[2], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7 },
    { text: 'No Cumple', width: segCols[3], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 6.8 },
    { text: 'Observaciones del Supervisor', width: segCols[4], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
  ];

  const pri = report.controlPrincipios;
  const principiosList: Array<{
    key: keyof NonNullable<ActivityReport['controlPrincipios']>;
    pregunta: string;
  }> = [
    { key: 'cumplimientoObligaciones', pregunta: '¿Cumplimiento de las obligaciones pactadas en el contrato?' },
    { key: 'correspondenciaActividades', pregunta: '¿Correspondencia entre actividades realizadas y objeto contractual?' },
    { key: 'soportesSuficientes', pregunta: '¿Soportes suficientes para acreditar la ejecución del periodo?' },
    { key: 'observanciaPrincipios', pregunta: '¿Observancia de los principios de eficacia, economía, responsabilidad y transparencia?' },
    { key: 'situacionesRequerimiento', pregunta: '¿Existencia de situaciones que ameriten requerimiento o advertencia?' },
  ];

  principiosList.forEach(({ key, pregunta }) => {
    const state = pri?.[key];
    b.drawTableRow(
      [
        { text: pregunta, width: segCols[0], bold: true, fontSize: 7.6 },
        { text: state?.resultado === 'Cumple' ? 'X' : '', width: segCols[1], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'Parcial' ? 'X' : '', width: segCols[2], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.resultado === 'No cumple' ? 'X' : '', width: segCols[3], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.observaciones || '', width: segCols[4], fontSize: 7.3 },
      ],
      18,
      [priRepeatHeader]
    );
  });

  b.advanceY(8);

  // =========================================================================
  // IX. ANÁLISIS DEL SUPERVISOR SOBRE PROCEDENCIA DEL PAGO
  // =========================================================================
  b.ensureSpace(88);
  b.drawSectionBanner('IX. ANÁLISIS DEL SUPERVISOR SOBRE PROCEDENCIA DEL PAGO');
  drawTwoRowChkHeader('Criterio', 'Observaciones', ['SI', 'NO', 'N/A']);

  const pagoRepeatHeader: TableCell[] = [
    { text: 'Criterio', width: segCols[0], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
    { text: 'SI', width: segCols[1], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'NO', width: segCols[2], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'N/A', width: segCols[3], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.2 },
    { text: 'Observaciones', width: segCols[4], bold: true, bg: SUBHEADER_BG, align: 'center', fontSize: 7.5 },
  ];

  const pag = report.analisisPago;
  const criteriosList: Array<{
    key: keyof NonNullable<ActivityReport['analisisPago']>;
    criterio: string;
  }> = [
    { key: 'relacionObligaciones', criterio: '¿Las actividades del periodo guardan relación con las obligaciones contractuales?' },
    { key: 'productosRevisados', criterio: '¿Los productos o entregables fueron revisados por la supervisión?' },
    { key: 'soportesSuficientes', criterio: '¿Los soportes del periodo son suficientes para tramitar pago' },
    { key: 'seguridadSocialVerificada', criterio: '¿Se verificó el pago de seguridad social del contratista?' },
    { key: 'procedeReconocimiento', criterio: '¿Procede el reconocimiento económico del periodo evaluado?' },
  ];

  criteriosList.forEach(({ key, criterio }) => {
    const state = pag?.[key];
    b.drawTableRow(
      [
        { text: criterio, width: segCols[0], bold: true, fontSize: 7.6 },
        { text: state?.verificacion === 'SI' ? 'X' : '', width: segCols[1], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.verificacion === 'NO' ? 'X' : '', width: segCols[2], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.verificacion === 'N/A' ? 'X' : '', width: segCols[3], bold: true, align: 'center', vAlign: 'middle' },
        { text: state?.observaciones || '', width: segCols[4], fontSize: 7.3 },
      ],
      18,
      [pagoRepeatHeader]
    );
  });

  b.advanceY(8);

  // =========================================================================
  // X. CONCEPTO GENERAL DEL SUPERVISOR
  // =========================================================================
  b.ensureSpace(88);
  b.drawSectionBanner('X. CONCEPTO GENERAL DEL SUPERVISOR');
  drawTwoRowChkHeader('', 'Observaciones', ['SI', 'NO', 'N/A']);

  const conceptoVal = report.conceptoGeneral;
  const conceptoRows: Array<{ label: ActivityReport['conceptoGeneral']; obs: string }> = [
    {
      label: 'Satisfactorio',
      obs: conceptoVal === 'Satisfactorio' ? (report.observacionesSupervisor || '') : '',
    },
    {
      label: 'Satisfactorio con observaciones',
      obs: conceptoVal === 'Satisfactorio con observaciones' ? (report.observacionesSupervisor || '') : '',
    },
    {
      label: 'No Satisfactorio',
      obs: conceptoVal === 'No Satisfactorio' ? (report.observacionesSupervisor || '') : '',
    },
  ];

  conceptoRows.forEach(({ label, obs }) => {
    const isMatch = conceptoVal === label;
    b.drawTableRow([
      { text: label, width: segCols[0], bold: isMatch, fontSize: 8 },
      { text: isMatch ? 'X' : '', width: segCols[1], bold: true, align: 'center', vAlign: 'middle' },
      { text: '', width: segCols[2], align: 'center', vAlign: 'middle' },
      { text: '', width: segCols[3], align: 'center', vAlign: 'middle' },
      { text: obs, width: segCols[4], fontSize: 7.3 },
    ]);
  });

  // =========================================================================
  // XI. CONCLUSIÓN DEL SEGUIMIENTO INTEGRAL DEL PERIODO
  // =========================================================================
  b.ensureSpace(75);
  b.drawSectionBanner('XI. CONCLUSIÓN DEL SEGUIMIENTO INTEGRAL DEL PERIODO');
  const conclusionText =
    report.conclusionSeguimiento ||
    'Una vez revisadas las obligaciones contractuales, las actividades ejecutadas, los productos entregados, los soportes documentales y los aspectos técnicos, administrativos, financieros, contables y jurídicos, se deja constancia de que la ejecución del contrato durante el periodo evaluado fue:';

  b.drawTableRow([
    {
      text: conclusionText,
      width: CONTENT_W,
      fontSize: 7.8,
      padY: 5,
    },
  ]);

  b.drawTableRow([
    {
      text: `Observaciones adicionales: ${report.observacionesSupervisor || 'Sin observaciones adicionales.'}`,
      width: CONTENT_W,
      fontSize: 7.8,
      padY: 5,
    },
  ]);

  const xiW1 = 210;
  const xiW2 = CONTENT_W - xiW1;
  b.drawTableRow([
    { text: 'Cumplimiento del objeto contractual', width: xiW1, bold: true, bg: SUBHEADER_BG },
    { text: report.cumplimientoObjeto || '', width: xiW2, fontSize: 7.8 },
  ]);
  b.drawTableRow([
    { text: 'Recursos Utilizados', width: xiW1, bold: true, bg: SUBHEADER_BG },
    { text: report.recursosUtilizados || '', width: xiW2, fontSize: 7.8 },
  ]);
  b.drawTableRow([
    { text: 'Evidencias de la Ejecución del Contrato:', width: xiW1, bold: true, bg: SUBHEADER_BG },
    { text: report.evidenciasEjecucion || '', width: xiW2, fontSize: 7.8 },
  ]);

  b.advanceY(8);

  // =========================================================================
  // XII. CONCEPTO DE LA SUPERVISIÓN
  // =========================================================================
  b.ensureSpace(64);
  const conceptoHeaderTitle = `XII. CONCEPTO DE LA SUPERVISIÓN: ${(report.conceptoGeneral || 'PENDIENTE').toUpperCase()}.`;
  b.drawSectionBanner(conceptoHeaderTitle);
  const xiiCols = [100, 140, 140, CONTENT_W - 380]; // last = 140
  const xiiHeader: TableCell[] = [
    { text: 'Número del acta', width: xiiCols[0], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Valor Total', width: xiiCols[1], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Valor Ejecutado', width: xiiCols[2], bold: true, bg: SUBHEADER_BG, align: 'center' },
    { text: 'Saldo', width: xiiCols[3], bold: true, bg: SUBHEADER_BG, align: 'center' },
  ];
  b.drawTableRow(xiiHeader, 16);

  const histActas =
    report.historialActasConcepto && report.historialActasConcepto.length > 0
      ? report.historialActasConcepto
      : [
          {
            nroActa: report.numeroActa || 1,
            valorTotal: fin.valorTotalFinal,
            valorEjecutado: fin.valorPagadoALaFecha + fin.valorPresentePago,
            saldo: fin.saldoPorPagar,
          },
        ];

  histActas.forEach((item) => {
    b.drawTableRow(
      [
        { text: String(item.nroActa), width: xiiCols[0], bold: true, align: 'center' },
        { text: `$ ${formatCOPNumber(item.valorTotal)}`, width: xiiCols[1], align: 'right' },
        { text: `$ ${formatCOPNumber(item.valorEjecutado)}`, width: xiiCols[2], align: 'right', bold: true },
        { text: `$ ${formatCOPNumber(item.saldo)}`, width: xiiCols[3], align: 'right' },
      ],
      15,
      [xiiHeader]
    );
  });

  // =========================================================================
  // XIII. APORTES AL SISTEMA DE SEGURIDAD SOCIAL
  // =========================================================================
  b.ensureSpace(128);
  b.drawSectionBanner('XIII. APORTES AL SISTEMA DE SEGURIDAD SOCIAL');

  let aportes: AporteSeguridadSocialItem[] = report.aportesSeguridadSocial || [];
  if (aportes.length === 0) {
    const ssRecords = db
      .getSocialSecurityByContractor(contractor?.id || report.contratistaId)
      .filter((s) => !s.contratoId || s.contratoId === contract.id);

    if (ssRecords.length > 0) {
      aportes = ssRecords.map((s) => ({
        comprobanteNo: s.numeroPlanilla || '',
        entidad: s.operadorPila || '',
        planillaNo: s.numeroPlanilla || '',
        valorAporte: Number(s.valorPagado) || 0,
        periodoCotizacion: s.periodo || '',
        salud: { entidad: s.saludEntidad || contractor?.eps || '', valor: Number(s.saludValor) || 0 },
        pension: { entidad: s.pensionEntidad || contractor?.afp || '', valor: Number(s.pensionValor) || 0 },
        riesgosLaborales: { entidad: s.arlEntidad || contractor?.arl || '', valor: Number(s.arlValor) || 0 },
        cajaCompensacion: { entidad: s.cajaEntidad || '', valor: Number(s.cajaValor) || 0 },
      }));
    }
  }

  const drawSeguridadSocialBlock = (ap?: AporteSeguridadSocialItem) => {
    // 5 columns matching template Page 6 (total 520):
    // [82, 85, 118, 145, 90]
    const sc = [82, 85, 118, 145, CONTENT_W - 82 - 85 - 118 - 145]; // last = 90
    const rowH = 16;
    const lastRowH = 24;
    const totalH = rowH * 4 + lastRowH; // 88 pt

    b.ensureSpace(totalH);
    const y0 = b.cursorY;

    const fmtMoneyOpt = (v?: number) => (v && v > 0 ? `$ ${formatCOPNumber(v)}` : '');

    // Row 1: Comprobante N° | val | Entidad: | val | Valor
    b.drawRawBox(MARGIN_X, y0 - rowH, sc[0], rowH, 'Comprobante N°', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0], y0 - rowH, sc[1], rowH, ap?.comprobanteNo || '', { fontSize: 7.5, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1], y0 - rowH, sc[2], rowH, 'Entidad:', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2], y0 - rowH, sc[3], rowH, ap?.entidad || '', { fontSize: 7.5, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2] + sc[3], y0 - rowH, sc[4], rowH, 'Valor', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, align: 'center', vAlign: 'middle' });

    // Row 2: Planilla N° | val | Salud: | entidad | valor
    const y2 = y0 - rowH * 2;
    b.drawRawBox(MARGIN_X, y2, sc[0], rowH, 'Planilla N°', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0], y2, sc[1], rowH, ap?.planillaNo || '', { fontSize: 7.5, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1], y2, sc[2], rowH, 'Salud:', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2], y2, sc[3], rowH, ap?.salud?.entidad || contractor?.eps || '', { fontSize: 7.5, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2] + sc[3], y2, sc[4], rowH, fmtMoneyOpt(ap?.salud?.valor), { fontSize: 7.5, align: 'right', vAlign: 'middle' });

    // Row 3: Valor del Aporte: | val | Pensión: | entidad | valor
    const y3 = y0 - rowH * 3;
    b.drawRawBox(MARGIN_X, y3, sc[0], rowH, 'Valor del Aporte:', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0], y3, sc[1], rowH, fmtMoneyOpt(ap?.valorAporte), { bold: true, fontSize: 7.5, align: 'right', vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1], y3, sc[2], rowH, 'Pensión:', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2], y3, sc[3], rowH, ap?.pension?.entidad || contractor?.afp || '', { fontSize: 7.5, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2] + sc[3], y3, sc[4], rowH, fmtMoneyOpt(ap?.pension?.valor), { fontSize: 7.5, align: 'right', vAlign: 'middle' });

    // Rows 4-5: Periodo de Cotización (merged vertically across row4 + row5) | Riesgos Laborales & Caja de compensación
    const y4 = y0 - rowH * 4;
    const y5 = y4 - lastRowH;
    const mergedH = rowH + lastRowH;

    b.drawRawBox(MARGIN_X, y5, sc[0], mergedH, 'Periodo de\nCotización:', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0], y5, sc[1], mergedH, ap?.periodoCotizacion || 'Pendiente', { bold: true, fontSize: 7.5, align: 'center', vAlign: 'middle' });

    // Sub-row 4: Riesgos Laborales
    b.drawRawBox(MARGIN_X + sc[0] + sc[1], y4, sc[2], rowH, 'Riesgos Laborales:', { bold: true, fontSize: 7.5, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2], y4, sc[3], rowH, ap?.riesgosLaborales?.entidad || contractor?.arl || '', { fontSize: 7.3, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2] + sc[3], y4, sc[4], rowH, fmtMoneyOpt(ap?.riesgosLaborales?.valor), { fontSize: 7.5, align: 'right', vAlign: 'middle' });

    // Sub-row 5: Caja de compensación (si hace aportes)
    b.drawRawBox(MARGIN_X + sc[0] + sc[1], y5, sc[2], lastRowH, 'Caja de compensación\n(si hace aportes):', { bold: true, fontSize: 7.2, bg: SUBHEADER_BG, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2], y5, sc[3], lastRowH, ap?.cajaCompensacion?.entidad || '', { fontSize: 7.3, vAlign: 'middle' });
    b.drawRawBox(MARGIN_X + sc[0] + sc[1] + sc[2] + sc[3], y5, sc[4], lastRowH, fmtMoneyOpt(ap?.cajaCompensacion?.valor), { fontSize: 7.5, align: 'right', vAlign: 'middle' });

    b.cursorY = y5;
  };

  if (aportes.length === 0) {
    drawSeguridadSocialBlock(undefined);
  } else {
    aportes.forEach((ap, i) => {
      if (i > 0) b.advanceY(4);
      drawSeguridadSocialBlock(ap);
    });
  }

  b.advanceY(10);

  // =========================================================================
  // XIV. FIRMAS (Exact institutional text + Notas 1 & 2 + Fecha)
  // =========================================================================
  b.ensureSpace(155);
  b.drawSectionBanner('XIV. FIRMAS');

  // Signatures area (Supervisor + Contratista cleanly inside bordered cell with vector signature lines)
  const sigTopY = b.cursorY;
  b.drawTableRow(
    [
      {
        text: `\n\n\n\nSUPERVISOR (A)\n${supNombre || 'PENDIENTE'}\n${supCargo || 'Supervisor Designado'}${supDoc ? `\nC.C. ${supDoc}` : ''}\n${(contract.entidadContratante || 'ALCALDÍA DE QUIMBAYA (QUINDÍO)').toUpperCase()}`,
        width: CONTENT_W / 2,
        fontSize: 7.8,
        padY: 6,
      },
      {
        text: `\n\n\n\nCONTRATISTA\n${contNombre || 'PENDIENTE'}\n${contDoc ? `C.C / NIT: ${contDoc}` : ''}\nEjecutor Contractual`,
        width: CONTENT_W / 2,
        fontSize: 7.8,
        padY: 6,
      },
    ],
    116
  );

  // Draw crisp horizontal vector signature lines in both cells
  const sigLineY = sigTopY - 38;
  b.currentPage.drawLine({
    start: { x: MARGIN_X + 12, y: sigLineY },
    end: { x: MARGIN_X + CONTENT_W / 2 - 24, y: sigLineY },
    thickness: 1.0,
    color: BLACK,
  });
  b.currentPage.drawLine({
    start: { x: MARGIN_X + CONTENT_W / 2 + 12, y: sigLineY },
    end: { x: MARGIN_X + CONTENT_W - 24, y: sigLineY },
    thickness: 1.0,
    color: BLACK,
  });

  // Notas 1 & 2 box matching Page 7
  b.drawTableRow([
    {
      text:
        'Nota 1: Se deja constancia de que la presente supervisión no se limita a la relación de actividades reportadas por el contratista, sino que comprende la verificación material del cumplimiento de las obligaciones contractuales, la revisión de soportes, el análisis de novedades y la evaluación integral del contrato en sus componentes técnico, administrativo, financiero, contable y jurídico.\n\n' +
        'Nota 2: Conforme Decreto 1273 del 23 de julio de 2018, expedida por el Ministerio de Salud y Protección Social el Contratista debe efectuar el pago de la Seguridad Social mes vencido hasta el segundo (02) día hábil de cada mes.',
      width: CONTENT_W,
      fontSize: 7.5,
      padY: 6,
    },
  ]);

  b.advanceY(8);
  const fechaDada = formatFechaLarga(report.fechaRevision || report.fechaRadicacion || report.updatedAt);
  const dadaText = `Dada en ${contract.lugarEjecucion || 'Quimbaya, Quindío'} a los ${fechaDada.dia} días del mes de ${fechaDada.mes} de ${fechaDada.anio}.`;
  b.ensureSpace(20);
  b.currentPage.drawText(sanitizeWinAnsi(dadaText, font), {
    x: MARGIN_X,
    y: b.cursorY - 10,
    size: 8.5,
    font,
    color: BLACK,
  });
  b.advanceY(18);

  // =========================================================================
  // ANEXO: REGISTRO FOTOGRÁFICO Y SOPORTES DOCUMENTALES
  // =========================================================================
  interface PhotoItem {
    obligacion: string;
    actividad: string;
    descripcion: string;
    url?: string;
    fileId?: string;
    fecha?: string;
  }

  interface SupportDocItem {
    obligacion: string;
    nombre: string;
    tipo?: string;
    fecha?: string;
  }

  const allPhotos: PhotoItem[] = [];
  const allSupports: SupportDocItem[] = [];

  (report.actividades || []).forEach((act) => {
    if (act.fotografias && act.fotografias.length > 0) {
      act.fotografias.forEach((p) => {
        allPhotos.push({
          obligacion: act.obligacion || '',
          actividad: act.actividadRealizada || '',
          descripcion: p.descripcion || 'Evidencia fotográfica de ejecución',
          url: p.url,
          fileId: p.fileId,
          fecha: p.fecha,
        });
      });
    }
    if (act.soportes && act.soportes.length > 0) {
      act.soportes.forEach((s) => {
        allSupports.push({
          obligacion: act.obligacion || '',
          nombre: s.nombre || 'Documento soporte',
          tipo: s.tipo,
          fecha: s.fecha,
        });
      });
    }
  });

  if (allSupports.length > 0) {
    b.newPage();
    b.drawSectionBanner('ANEXO 1. SOPORTES DOCUMENTALES DE EJECUCIÓN');
    const supCols = [30, 180, 210, CONTENT_W - 420];
    const supHeader: TableCell[] = [
      { text: 'N°', width: supCols[0], bold: true, bg: SUBHEADER_BG, align: 'center' },
      { text: 'Obligación Asociada', width: supCols[1], bold: true, bg: SUBHEADER_BG },
      { text: 'Documento / Soporte Adjunto', width: supCols[2], bold: true, bg: SUBHEADER_BG },
      { text: 'Fecha', width: supCols[3], bold: true, bg: SUBHEADER_BG, align: 'center' },
    ];
    b.drawTableRow(supHeader, 16);
    allSupports.forEach((docItem, idx) => {
      b.drawTableRow(
        [
          { text: String(idx + 1), width: supCols[0], align: 'center', bold: true },
          { text: docItem.obligacion, width: supCols[1], fontSize: 7.5 },
          { text: docItem.nombre, width: supCols[2], fontSize: 7.5 },
          { text: formatSlashDMY(docItem.fecha) || '', width: supCols[3], align: 'center', fontSize: 7.5 },
        ],
        18,
        [supHeader]
      );
    });
  }

  if (allPhotos.length > 0) {
    if (allSupports.length === 0) {
      b.newPage();
    } else {
      b.advanceY(14);
      b.ensureSpace(210);
    }
    b.drawSectionBanner('ANEXO FOTOGRÁFICO DE EVIDENCIAS DE EJECUCIÓN');
    b.advanceY(6);

    for (let i = 0; i < allPhotos.length; i++) {
      const photo = allPhotos[i];
      let imageBytes: Uint8Array | null = null;
      let isPng = false;

      // Resolve image bytes from fileId, /api/uploads/, disk path, or base64
      let fileRecordId = photo.fileId;
      if (!fileRecordId && photo.url && photo.url.startsWith('/api/uploads/')) {
        fileRecordId = photo.url.replace('/api/uploads/', '').split('/')[0].split('?')[0];
      }

      if (fileRecordId) {
        const evFile =
          db.getEvidenceFileById(fileRecordId) ||
          db.getEvidenceFiles().find((f) => f.fileName === fileRecordId || f.id === fileRecordId);
        if (evFile) {
          let fPath = evFile.filePath;
          if (!fs.existsSync(fPath)) {
            const candidate = path.join(UPLOADS_DIR, evFile.fileName);
            if (fs.existsSync(candidate)) fPath = candidate;
          }
          if (fs.existsSync(fPath)) {
            imageBytes = fs.readFileSync(fPath);
            isPng = evFile.mimeType === 'image/png' || evFile.fileName.toLowerCase().endsWith('.png');
          }
        }
      }

      if (!imageBytes && photo.url && photo.url.startsWith('/api/uploads/')) {
        const rawName = photo.url.replace('/api/uploads/', '').split('?')[0];
        const candidate = path.join(UPLOADS_DIR, rawName);
        if (fs.existsSync(candidate)) {
          imageBytes = fs.readFileSync(candidate);
          isPng = candidate.toLowerCase().endsWith('.png');
        }
      }

      if (!imageBytes && photo.url && !photo.url.startsWith('data:') && !photo.url.startsWith('http')) {
        const possiblePath = path.isAbsolute(photo.url) ? photo.url : path.join(process.cwd(), photo.url);
        if (fs.existsSync(possiblePath)) {
          imageBytes = fs.readFileSync(possiblePath);
          isPng = possiblePath.toLowerCase().endsWith('.png');
        }
      }

      if (!imageBytes && photo.url && photo.url.startsWith('data:image/')) {
        isPng = photo.url.includes('image/png');
        const base64Data = photo.url.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        imageBytes = Buffer.from(base64Data, 'base64');
      }

      let embeddedImg: PDFImage | null = null;
      if (imageBytes && imageBytes.length > 0) {
        try {
          if (
            !isPng &&
            imageBytes.length > 4 &&
            imageBytes[0] === 0x89 &&
            imageBytes[1] === 0x50 &&
            imageBytes[2] === 0x4e &&
            imageBytes[3] === 0x47
          ) {
            isPng = true;
          }
          if (isPng) {
            embeddedImg = await pdfDoc.embedPng(imageBytes);
          } else {
            try {
              embeddedImg = await pdfDoc.embedJpg(imageBytes);
            } catch {
              embeddedImg = await pdfDoc.embedPng(imageBytes);
            }
          }
        } catch (imgErr) {
          console.warn('Could not embed photo in PDF annex:', imgErr);
        }
      }

      // Calculate exact card height: caption header + image frame (195 pt max)
      const captionLines = wrapText(
        `Obligación: ${photo.obligacion}\nDescripción: ${photo.descripcion}${photo.fecha ? ` (Fecha: ${formatSlashDMY(photo.fecha)})` : ''}`,
        font,
        7.5,
        CONTENT_W - 14
      );
      const captionH = captionLines.length * (7.5 * 1.25) + 10;
      const imgAreaH = embeddedImg ? 185 : 36;
      const cardH = Math.min(MAX_BODY_H - 10, captionH + imgAreaH + 10);

      b.ensureSpace(cardH + 10, () => {
        b.drawSectionBanner('ANEXO FOTOGRÁFICO DE EVIDENCIAS DE EJECUCIÓN (CONTINUACIÓN)');
        b.advanceY(6);
      });

      const cardTop = b.cursorY;
      const cardBot = cardTop - cardH;

      // Draw card outer border
      b.currentPage.drawRectangle({
        x: MARGIN_X,
        y: cardBot,
        width: CONTENT_W,
        height: cardH,
        borderColor: BORDER_COLOR,
        borderWidth: 0.7,
      });

      // Draw caption header bar
      b.drawRawBox(
        MARGIN_X,
        cardTop - captionH,
        CONTENT_W,
        captionH,
        `Evidencia ${i + 1}: ${photo.descripcion}${photo.fecha ? ` — Fecha: ${formatSlashDMY(photo.fecha)}` : ''}\nObligación: ${photo.obligacion}`,
        { fontSize: 7.4, bg: SUBHEADER_BG, padX: 7, padY: 4 }
      );

      if (embeddedImg) {
        const maxImgW = CONTENT_W - 24;
        const maxImgH = Math.max(40, cardH - captionH - 14);
        const dims = embeddedImg.scaleToFit(maxImgW, maxImgH);
        const imgX = MARGIN_X + (CONTENT_W - dims.width) / 2;
        const imgY = cardBot + (cardH - captionH - dims.height) / 2;
        b.currentPage.drawImage(embeddedImg, {
          x: imgX,
          y: imgY,
          width: dims.width,
          height: dims.height,
        });
      } else {
        b.drawRawBox(
          MARGIN_X + 12,
          cardBot + 6,
          CONTENT_W - 24,
          cardH - captionH - 12,
          '[Imagen adjunta disponible en el expediente digital del informe]',
          { fontSize: 7.5, align: 'center', vAlign: 'middle', textColor: MUTED_TEXT }
        );
      }

      b.cursorY = cardBot - 10;
    }
  }

  // Record exact page count belonging to the Acta de Supervisión (including its annexes)
  const actaPageCount = pdfDoc.getPages().length;

  // =========================================================================
  // INFORME DE ACTIVIDADES (Appended immediately after Acta de Supervisión)
  // Matches exact template: MODELO INFORME DE ACTIVIDADES
  // =========================================================================
  b.bodyTopY = 746;
  b.bodyBottomY = 46;
  b.newPage();

  // Centered bordered title box: "Informe de Actividades / Número XX"
  const infBoxW = 240;
  const infBoxH = 38;
  const infBoxX = MARGIN_X + (CONTENT_W - infBoxW) / 2;
  const infBoxBot = b.cursorY - infBoxH;
  const actaNumPad = String(report.numeroActa || 1).padStart(2, '0');
  b.drawRawBox(
    infBoxX,
    infBoxBot,
    infBoxW,
    infBoxH,
    `Informe de Actividades\nNúmero ${actaNumPad}`,
    { bold: true, fontSize: 11.5, align: 'center', vAlign: 'middle', padY: 4 }
  );
  b.cursorY = infBoxBot - 16;

  const supervisorEmail = findSupervisorEmail(contract);
  const infCol1 = 225;
  const infCol2 = 120;
  const infCol3 = CONTENT_W - infCol1 - infCol2; // 175
  const infLeftSpan = infCol1 + infCol2; // 345

  // Row 1: NOMBRE DEL CONTRATISTA | CÉDULA | CORREO DEL CONTRATISTA
  b.drawTableRow(
    [
      {
        text: `NOMBRE DEL CONTRATISTA:\n${contNombre || ''}`,
        width: infCol1,
        bold: true,
        fontSize: 8,
        padY: 5,
      },
      {
        text: `CÉDULA: ${contDoc || ''}${contractor?.direccion ? `\n${contractor.direccion}` : ''}`,
        width: infCol2,
        bold: true,
        fontSize: 8,
        padY: 5,
      },
      {
        text: `CORREO DEL CONTRATISTA:\n${contractor?.email || ''}`,
        width: infCol3,
        bold: true,
        fontSize: 7.8,
        padY: 5,
      },
    ],
    28
  );

  // Row 2: SUPERVISOR | CORREO DEL SUPERVISOR
  b.drawTableRow(
    [
      {
        text: `SUPERVISOR:\n${supNombre || ''}`,
        width: infLeftSpan,
        bold: true,
        fontSize: 8,
        padY: 5,
      },
      {
        text: `CORREO DEL SUPERVISOR:\n${supervisorEmail || ''}`,
        width: infCol3,
        bold: true,
        fontSize: 7.8,
        padY: 5,
      },
    ],
    26
  );

  // Row 3: Periodo informado (DEL ... AL ...)
  const infPeriodoInicioLarga = report.fechaInicioPeriodo
    ? formatFechaLarga(report.fechaInicioPeriodo).texto.toUpperCase()
    : '';
  const infPeriodoFinLarga = report.fechaFinPeriodo
    ? formatFechaLarga(report.fechaFinPeriodo).texto.toUpperCase()
    : '';
  const infPeriodoTexto =
    infPeriodoInicioLarga && infPeriodoFinLarga
      ? `DEL ${infPeriodoInicioLarga} AL ${infPeriodoFinLarga}`
      : (report.periodo || '').toUpperCase();

  b.drawTableRow(
    [
      {
        text: `Periodo informado:\n${infPeriodoTexto}`,
        width: CONTENT_W,
        bold: true,
        fontSize: 8.2,
        padY: 5,
      },
    ],
    26
  );

  // Row 4: CLASE DE CONTRATO, NÚMERO Y FECHA | TELÉFONO DEL CONTRATISTA
  const claseContratoText = [
    contract.tipoContrato || 'CONTRATO DE PRESTACIÓN DE SERVICIOS',
    contract.numeroContrato ? `N° ${contract.numeroContrato}` : '',
    contract.fechaInicio ? `DE FECHA ${formatSlashDMY(contract.fechaInicio)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  b.drawTableRow(
    [
      {
        text: `CLASE DE CONTRATO, NÚMERO Y FECHA: ${claseContratoText}`,
        width: infLeftSpan,
        bold: true,
        fontSize: 8,
        padY: 5,
        vAlign: 'middle',
      },
      {
        text: `TELÉFONO DEL CONTRATISTA:\n${contractor?.telefono || ''}`,
        width: infCol3,
        bold: true,
        fontSize: 8,
        padY: 5,
      },
    ],
    28
  );

  // Row 5: OBJETO DEL CONTRATO
  b.drawTableRow(
    [
      {
        text: `OBJETO DEL CONTRATO:\n${contract.objeto ? `“${contract.objeto}”` : ''}`,
        width: CONTENT_W,
        fontSize: 8,
        padY: 6,
      },
    ],
    34
  );

  // Row 6: VALOR PAGADO SISTEMA DE SEGURIDAD (reuses resolved aportes from Section XIII)
  const firstAporte = aportes.length > 0 ? aportes[0] : undefined;
  const infSaludStr = firstAporte?.salud?.valor !== undefined ? `$ ${formatCOPNumber(firstAporte.salud.valor)}` : 'Pendiente';
  const infPensionStr = firstAporte?.pension?.valor !== undefined ? `$ ${formatCOPNumber(firstAporte.pension.valor)}` : 'Pendiente';
  const infArlStr = firstAporte?.riesgosLaborales?.valor !== undefined ? `$ ${formatCOPNumber(firstAporte.riesgosLaborales.valor)}` : 'Pendiente';
  const infPeriodoCot = firstAporte?.periodoCotizacion || 'Pendiente';
  const infComprobante = firstAporte?.comprobanteNo || '';
  const infPlanilla = firstAporte?.planillaNo || '';

  b.drawTableRow(
    [
      {
        text:
          `VALOR PAGADO SISTEMA DE SEGURIDAD: SALUD: ${infSaludStr}   PENSIÓN: ${infPensionStr}\n` +
          `ARL: ${infArlStr}   PERIODO DE COTIZACION: ${infPeriodoCot}\n` +
          `COMPROBANTE No. ${infComprobante || 'Pendiente'}\n` +
          `PLANILLA No. ${infPlanilla || 'Pendiente'}`,
        width: CONTENT_W,
        bold: true,
        fontSize: 7.8,
        padY: 6,
        lineHeightFactor: 1.32,
      },
    ],
    44
  );

  // Row 7: SITIO DE EJECUCIÓN
  b.drawTableRow(
    [
      {
        text: `SITIO DE EJECUCIÓN: ${contract.lugarEjecucion || 'Municipio de Quimbaya (Q).'}`,
        width: CONTENT_W,
        bold: true,
        fontSize: 8,
        padY: 6,
      },
    ],
    22
  );

  // Sub-table: ACTIVIDADES CONTRACTUALES | ACTIVIDADES REALIZADAS | PRODUCTOS
  const infActCols = [26, 154, 180, CONTENT_W - 26 - 154 - 180]; // last = 160
  const infActHeader: TableCell[] = [
    { text: '', width: infActCols[0], bold: true, align: 'center', fontSize: 8, vAlign: 'middle' },
    { text: 'ACTIVIDADES\nCONTRACTUALES', width: infActCols[1], bold: true, align: 'center', fontSize: 8, vAlign: 'middle' },
    { text: 'ACTIVIDADES REALIZADAS', width: infActCols[2], bold: true, align: 'center', fontSize: 8, vAlign: 'middle' },
    { text: 'PRODUCTOS', width: infActCols[3], bold: true, align: 'center', fontSize: 8, vAlign: 'middle' },
  ];
  b.ensureSpace(50);
  b.drawTableRow(infActHeader, 28);

  if (actividades.length === 0) {
    b.drawTableRow(
      [
        { text: '1', width: infActCols[0], bold: true, align: 'center', fontSize: 8 },
        { text: 'Sin obligaciones registradas.', width: infActCols[1], fontSize: 7.8 },
        { text: '', width: infActCols[2], fontSize: 7.8 },
        { text: '', width: infActCols[3], fontSize: 7.8 },
      ],
      18,
      [infActHeader]
    );
  } else {
    actividades.forEach((act, idx) => {
      b.drawTableRow(
        [
          { text: String(idx + 1), width: infActCols[0], bold: true, align: 'center', fontSize: 8 },
          { text: act.obligacion || '', width: infActCols[1], fontSize: 7.6 },
          { text: act.actividadRealizada || '', width: infActCols[2], fontSize: 7.6 },
          { text: act.productos || '', width: infActCols[3], fontSize: 7.6 },
        ],
        18,
        [infActHeader]
      );
    });
  }

  // Final ANEXOS row inside the Informe table (matching template)
  b.drawTableRow(
    [
      { text: '', width: infActCols[0], fontSize: 7.8 },
      {
        text: 'ANEXOS: CUENTA DE COBRO, PAGO DE SEGURIDAD SOCIAL',
        width: infActCols[1],
        fontSize: 7.8,
      },
      {
        text: 'Se presentan los respectivos anexos.',
        width: infActCols[2],
        fontSize: 7.8,
        vAlign: 'middle',
      },
      {
        text: '-Carpeta del contratista en el archivo de la oficina asesora jurídica',
        width: infActCols[3],
        fontSize: 7.8,
      },
    ],
    34,
    [infActHeader]
  );

  // Contractor Signature block at the bottom of Informe de Actividades
  b.ensureSpace(95);
  b.advanceY(36);
  b.currentPage.drawLine({
    start: { x: MARGIN_X, y: b.cursorY },
    end: { x: MARGIN_X + 200, y: b.cursorY },
    thickness: 0.9,
    color: BLACK,
  });
  b.advanceY(12);

  const infSignLines = [
    contNombre || 'CONTRATISTA',
    `${contractor?.tipoDocumento === 'NIT' ? 'NIT' : 'C.C. N°'} ${contDoc || ''}`.trim(),
    'Contratista.',
    contract.lugarEjecucion || 'Oficina. Alcaldía Municipal de Quimbaya (Q).',
  ];
  infSignLines.forEach((sLine) => {
    const cleanSign = sanitizeWinAnsi(sLine, fontBold);
    b.currentPage.drawText(cleanSign, {
      x: MARGIN_X,
      y: b.cursorY,
      size: 8.5,
      font: fontBold,
      color: BLACK,
    });
    b.advanceY(12);
  });

  // Stamp institutional Header (with exact PÁGINA X de Y) and Footer strictly on the Acta pages
  b.applyInstitutionalChrome(contract.codigoSecop || '', actaPageCount);

  return await pdfDoc.save();
}
