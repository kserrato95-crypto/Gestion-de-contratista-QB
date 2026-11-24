import fs from 'fs';
import path from 'path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
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
import { findSupervisorEmail } from './pdfGenerator.js';

const LOGO_PATH = path.resolve(process.cwd(), 'public/assets/alcaldia_quimbaya_logo.png');

// US Letter in twips (1 inch = 1440 twips): 8.5 x 11 in -> 12240 x 15840
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN_LR = 920; // ~0.64 in
const CONTENT_DXA = PAGE_WIDTH - MARGIN_LR * 2; // 10400 twips

const BORDER_ALL = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '1F2937' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '1F2937' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '1F2937' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '1F2937' },
};

const BORDER_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const CELL_MARGINS = { top: 65, bottom: 65, left: 95, right: 95 };
const HEADER_SHADING = { type: ShadingType.CLEAR, fill: 'EAEFF5', color: 'auto' };
const SUBHEADER_SHADING = { type: ShadingType.CLEAR, fill: 'F4F6F9', color: 'auto' };

function formatCOPNumber(val: number): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '0,00';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val));
}

function formatMoneyOpt(val?: number): string {
  if (val === undefined || val === null || isNaN(Number(val))) return '';
  return `$ ${formatCOPNumber(val)}`;
}

function formatPct(val?: number): string {
  return `${formatCOPNumber(Number(val || 0))} %`;
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

interface CellOpt {
  text: string;
  width: number;
  bold?: boolean;
  italic?: boolean;
  size?: number; // half-points (e.g. 16 = 8pt)
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  vAlign?: 'top' | 'center' | 'bottom';
  shading?: { type: (typeof ShadingType)[keyof typeof ShadingType]; fill: string; color: string };
  colSpan?: number;
  rowSpan?: number;
  color?: string;
}

function pLines(
  text: string,
  opts: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    color?: string;
    spacingAfter?: number;
  } = {}
): Paragraph[] {
  const raw = (text ?? '').toString().replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  return lines.map(
    (line, idx) =>
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: {
          before: 0,
          after: idx === lines.length - 1 ? (opts.spacingAfter ?? 0) : 30,
          line: 250,
        },
        children: [
          new TextRun({
            text: line,
            font: 'Arial',
            size: opts.size ?? 16,
            bold: opts.bold ?? false,
            italics: opts.italic ?? false,
            color: opts.color ?? '111827',
          }),
        ],
      })
  );
}

function makeCell(opt: CellOpt): TableCell {
  return new TableCell({
    width: { size: opt.width, type: WidthType.DXA },
    borders: BORDER_ALL,
    margins: CELL_MARGINS,
    verticalAlign: opt.vAlign ?? VerticalAlign.TOP,
    shading: opt.shading,
    columnSpan: opt.colSpan,
    rowSpan: opt.rowSpan,
    children: pLines(opt.text, {
      bold: opt.bold,
      italic: opt.italic,
      size: opt.size,
      align: opt.align,
      color: opt.color,
    }),
  });
}

function makeBannerRow(title: string, width: number = CONTENT_DXA): TableRow {
  return new TableRow({
    cantSplit: true,
    children: [
      makeCell({
        text: title,
        width,
        bold: true,
        size: 17,
        align: AlignmentType.CENTER,
        vAlign: VerticalAlign.CENTER,
        shading: HEADER_SHADING,
      }),
    ],
  });
}

function resolveImageInfo(
  bytes: Buffer | Uint8Array,
  hintMime?: string,
  hintName?: string
): { type: 'png' | 'jpg' | 'gif' | 'bmp'; width: number; height: number } | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length < 10) return null;

  // Detect PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf.length >= 24) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { type: 'png', width: w || 400, height: h || 300 };
  }

  // Detect JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return { type: 'jpg', width: w || 400, height: h || 300 };
      }
      const segLen = buf.readUInt16BE(i + 2);
      if (segLen < 2) break;
      i += 2 + segLen;
    }
    return { type: 'jpg', width: 480, height: 320 };
  }

  // Detect GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf.length >= 10) {
    const w = buf.readUInt16LE(6);
    const h = buf.readUInt16LE(8);
    return { type: 'gif', width: w || 400, height: h || 300 };
  }

  // Detect BMP
  if (buf[0] === 0x42 && buf[1] === 0x4d && buf.length >= 26) {
    const w = Math.abs(buf.readInt32LE(18));
    const h = Math.abs(buf.readInt32LE(22));
    return { type: 'bmp', width: w || 400, height: h || 300 };
  }

  const lower = (hintMime || hintName || '').toLowerCase();
  if (lower.includes('png')) return { type: 'png', width: 480, height: 320 };
  if (lower.includes('jpg') || lower.includes('jpeg')) return { type: 'jpg', width: 480, height: 320 };
  return null;
}

/**
 * Generates an editable Microsoft Word (.docx) containing:
 *  - Section 1: Official ACTA DE SUPERVISIÓN (MODALIDAD DE SELECCIÓN FINAL, Sections I–XIV + Evidence Annexes)
 *  - Section 2 (Next Page): Official INFORME DE ACTIVIDADES (MODELO INFORME DE ACTIVIDADES)
 */
export async function generateActaYInformeDocx(
  report: ActivityReport,
  contract: Contract,
  contractor: User
): Promise<Buffer> {
  // Derived fields matching PDF generator (never invent missing data)
  const contNombre = contractor
    ? `${contractor.nombres || ''} ${contractor.apellidos || ''}`.trim().toUpperCase()
    : (report.contratistaNombre || contract.contratistaNombre || '').toUpperCase();
  const contDoc = contractor?.numeroDocumento || contract.contratistaDocumento || '';

  const supNombre = (contract.supervisorResponsable || '').toUpperCase();
  const supCargo = (contract.supervisorCargo || '').toUpperCase();
  const supLine = [supNombre, supCargo].filter(Boolean).join(' - ');
  const supDoc = contract.supervisorDocumento || '';
  const supervisorEmail = findSupervisorEmail(contract);

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
    contract.vigenciaDias || calculateTotalDays(contract.fechaInicio, contract.fechaFin) || 0;
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

  // Resolve official Logo PNG bytes
  let logoBytes: Buffer | null = null;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      logoBytes = fs.readFileSync(LOGO_PATH);
    } catch {
      logoBytes = null;
    }
  }

  // =========================================================================
  // SECTION 1 HEADER & FOOTER (ACTA DE SUPERVISIÓN)
  // =========================================================================
  const hCol1 = 2700;
  const hCol2 = 5100;
  const hCol3 = CONTENT_DXA - hCol1 - hCol2; // 2600

  const logoParagraph = logoBytes
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: 'png',
            data: logoBytes,
            transformation: { width: 130, height: 44 },
          }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'ALCALDÍA DE QUIMBAYA', bold: true, size: 18, font: 'Arial' }),
        ],
      });

  const actaHeaderTable = new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: [hCol1, hCol2, hCol3],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: hCol1, type: WidthType.DXA },
            rowSpan: 3,
            borders: BORDER_ALL,
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
            children: [logoParagraph],
          }),
          new TableCell({
            width: { size: hCol2, type: WidthType.DXA },
            rowSpan: 2,
            borders: BORDER_ALL,
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
            children: pLines('MUNICIPIO DE QUIMBAYA\nQUINDIO\nNIT: 890.000.613-4', {
              bold: true,
              size: 17,
              align: AlignmentType.CENTER,
            }),
          }),
          new TableCell({
            width: { size: hCol3, type: WidthType.DXA },
            borders: BORDER_ALL,
            margins: { top: 45, bottom: 45, left: 60, right: 60 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'PÁGINA ', bold: true, size: 16, font: 'Arial' }),
                  new TextRun({ children: [PageNumber.CURRENT], bold: true, size: 16, font: 'Arial' }),
                  new TextRun({ text: ' de ', bold: true, size: 16, font: 'Arial' }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES_IN_SECTION],
                    bold: true,
                    size: 16,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          makeCell({
            text: contract.codigoSecop ? `CÓDIGO: ${contract.codigoSecop}` : 'CÓDIGO:',
            width: hCol3,
            bold: true,
            size: 16,
            align: AlignmentType.CENTER,
            vAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
      new TableRow({
        children: [
          makeCell({
            text: 'OFICINA ASESORA JURIDICA\nACTA DE SUPERVISIÓN',
            width: hCol2,
            bold: true,
            size: 17,
            align: AlignmentType.CENTER,
            vAlign: VerticalAlign.CENTER,
          }),
          makeCell({
            text: 'VERSIÓN: 1',
            width: hCol3,
            bold: true,
            size: 16,
            align: AlignmentType.CENTER,
            vAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  });

  const fWidths = [1700, 5000, 1100, CONTENT_DXA - 7800]; // 2600
  const actaFooterTable = new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: fWidths,
    rows: [
      ['Elaborado por:', 'P. U de Planificación y Modernización-S.P', 'Fecha:', 'Enero 21/2026'],
      ['Revisado por:', 'Secretaria de Planeación', 'Fecha:', 'Enero 21/2026'],
      ['Aprobado por:', 'Comité Institucional de Gestión y Desempeño', 'Fecha:', 'Enero 22/2026'],
    ].map(
      (r) =>
        new TableRow({
          children: r.map((txt, idx) =>
            new TableCell({
              width: { size: fWidths[idx], type: WidthType.DXA },
              borders: BORDER_ALL,
              margins: { top: 25, bottom: 25, left: 60, right: 60 },
              children: pLines(txt, { size: 14 }),
            })
          ),
        })
    ),
  });

  const actaFooterContact = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 0 },
    children: [
      new TextRun({
        text:
          'Correo electrónico: ventanillaunica@quimbaya-quindio.gov.co - www.quimbaya-quindio.gov.co Dirección: Carrera 6 Calle 12 Esquina - ' +
          'Quimbaya Quindío - Teléfono de contacto +57 3175519367 Horario de atención: Lunes a Jueves de 08:00 am a 12:00 - 02:00 pm a 06:30 pm - ' +
          'Viernes de 08:00 am a 12:00 - 02:00 pm a 04:00 pm Código postal urbano 634020, código postal rural 634027',
        font: 'Arial',
        size: 13,
        color: '4B5563',
      }),
    ],
  });

  // =========================================================================
  // ACTA BODY ELEMENTS (SECTIONS I – XIV + ANEXOS)
  // =========================================================================
  const actaChildren: Array<Paragraph | Table> = [];

  const spacer = (afterPts = 120) =>
    new Paragraph({ spacing: { before: 0, after: afterPts }, children: [] });

  actaChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 120 },
      children: [
        new TextRun({
          text: `ACTA DE SUPERVISIÓN N° ${report.numeroActa || 1}`,
          bold: true,
          font: 'Arial',
          size: 22,
        }),
      ],
    })
  );

  // --- I. DATOS GENERALES ---
  const wL1 = 2900;
  const wM1 = 3900;
  const wCC1 = 1500;
  const wCC2 = CONTENT_DXA - wL1 - wM1 - wCC1; // 2100

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: [wL1, wM1, wCC1, wCC2],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text: 'I. DATOS GENERALES',
              width: CONTENT_DXA,
              colSpan: 4,
              bold: true,
              size: 17,
              align: AlignmentType.CENTER,
              shading: HEADER_SHADING,
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Contrato Número:', width: wL1, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: contract.numeroContrato || '', width: CONTENT_DXA - wL1, colSpan: 3, bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Tipo de Contrato', width: wL1, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: contract.tipoContrato || 'CONTRATO DE PRESTACIÓN DE SERVICIOS', width: CONTENT_DXA - wL1, colSpan: 3 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Entidad Contratante', width: wL1, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: contract.entidadContratante || 'MUNICIPIO DE QUIMBAYA, QUINDÍO', width: CONTENT_DXA - wL1, colSpan: 3, bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Lugar y Fecha del acta:', width: wL1, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: fechaActaInfo, width: CONTENT_DXA - wL1, colSpan: 3 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Contratista', width: wL1, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: contNombre, width: wM1, bold: true }),
            makeCell({ text: 'C.C o NIT', width: wCC1, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: contDoc, width: wCC2, bold: true, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Objeto del Contrato', width: wL1, bold: true, shading: SUBHEADER_SHADING, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: contract.objeto || '', width: CONTENT_DXA - wL1, colSpan: 3 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Supervisor', width: wL1, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: supLine || 'Pendiente por asignar', width: wM1, bold: true }),
            makeCell({ text: 'C.C o NIT', width: wCC1, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: supDoc || '', width: wCC2, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Número de Cuenta bancaria', width: wL1, bold: true, shading: SUBHEADER_SHADING, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: bancoInfo, width: wM1 }),
            makeCell({ text: 'Periodo Informado', width: wCC1, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: periodoInfo, width: wCC2, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- II. PROCESO INICIAL ---
  const iiCols = [2900, 1250, 2500, 1250, CONTENT_DXA - 7900]; // last = 2500
  const valLetras = numeroALetrasCOP(Number(contract.valorTotal) || 0);
  const cdpNum = contract.cdpNumero?.trim() || '';
  const cdpFec = contract.cdpFecha?.trim() ? formatSlashDMY(contract.cdpFecha) : '';
  const crpNum = contract.crpNumero?.trim() || '';
  const crpFec = contract.crpFecha?.trim() ? formatSlashDMY(contract.crpFecha) : '';

  const mods = contract.modificaciones || [];
  const lastMod = mods.length > 0 ? mods[mods.length - 1] : null;
  const tieneAdicion = Boolean(lastMod);
  const plazoText =
    contract.fechaInicio && contract.fechaFin
      ? `Del ${formatSlashDMY(contract.fechaInicio)} al ${formatSlashDMY(contract.fechaFin)}${detailedDuration ? ` (${detailedDuration})` : ''}`
      : '';

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: iiCols,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'II. PROCESO INICIAL', width: CONTENT_DXA, colSpan: 5, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Valor del Contrato', width: iiCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: `${valLetras} ($ ${formatCOPNumber(Number(contract.valorTotal) || 0)})`, width: CONTENT_DXA - iiCols[0], colSpan: 4, bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `Fecha de Inicio Contrato\n${formatSlashDMY(contract.fechaInicio) || 'Pendiente'}`, width: iiCols[0], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'CDP #:', width: iiCols[1], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: cdpNum, width: iiCols[2], bold: true }),
            makeCell({ text: 'CRP #:', width: iiCols[3], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: crpNum, width: iiCols[4], bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Fecha:', width: iiCols[1], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: cdpFec, width: iiCols[2] }),
            makeCell({ text: 'Fecha:', width: iiCols[3], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: crpFec, width: iiCols[4] }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Plazo de Ejecución del Contrato', width: iiCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: plazoText, width: iiCols[1] + iiCols[2], colSpan: 2 }),
            makeCell({ text: 'Vigencia', width: iiCols[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: totalDias > 0 ? `${totalDias} días calendario` : '', width: iiCols[4], bold: true, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Fecha Contractual de Terminación Contrato', width: iiCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: formatSlashDMY(contract.fechaFin), width: CONTENT_DXA - iiCols[0], colSpan: 4, bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `Fecha de Inicio de adición\n${tieneAdicion ? formatSlashDMY(lastMod?.fecha) : 'No aplica'}`, width: iiCols[0], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'CDP #:', width: iiCols[1], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: '', width: iiCols[2] }),
            makeCell({ text: 'CRP #:', width: iiCols[3], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: '', width: iiCols[4] }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Fecha:', width: iiCols[1], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: '', width: iiCols[2] }),
            makeCell({ text: 'Fecha:', width: iiCols[3], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: '', width: iiCols[4] }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Plazo de Ejecucion Adición', width: iiCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: tieneAdicion ? (lastMod?.objeto || 'Según modificación') : 'No aplica', width: iiCols[1] + iiCols[2], colSpan: 2 }),
            makeCell({ text: 'Vigencia', width: iiCols[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'No aplica', width: iiCols[4], align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Fecha Contractual de Terminación de la adición', width: iiCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: tieneAdicion ? formatSlashDMY(contract.fechaFin) : 'No aplica', width: CONTENT_DXA - iiCols[0], colSpan: 4 }),
          ],
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- III. RESUMEN POLIZAS ---
  const pol = contract.polizas;
  const polAplica = Boolean(pol?.aplica);
  const pCols = [2900, 840, 840, 1700, 2200, CONTENT_DXA - 8480]; // 1920
  const polVig = polAplica
    ? [
        pol?.cumplimientoHasta ? `Cump: ${formatSlashDMY(pol.cumplimientoHasta)}` : '',
        pol?.calidadHasta ? `Cal: ${formatSlashDMY(pol.calidadHasta)}` : '',
        pol?.salariosHasta ? `Sal: ${formatSlashDMY(pol.salariosHasta)}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
    : '';

  const polRowsData: Array<[string, string, string, string]> = [
    ['Tipo de Garantía', polAplica ? pol?.numeroGarantia || '' : '', polAplica ? pol?.tipoGarantia || 'Póliza de Cumplimiento' : '', polVig],
    ['Nombre del Garante', '', polAplica ? pol?.nombreGarante || '' : '', ''],
    ['Número de la Garantía', polAplica ? pol?.numeroGarantia || '' : '', '', ''],
    ['Contratista Tomador', '', polAplica ? pol?.contratistaTomador || contNombre : '', ''],
    ['Beneficiario', '', polAplica ? pol?.beneficiario || (contract.entidadContratante || 'MUNICIPIO DE QUIMBAYA') : '', ''],
    ['Compañía /Aseguradora', '', polAplica ? pol?.companiaAseguradora || '' : '', ''],
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: pCols,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'III. RESUMEN POLIZAS', width: CONTENT_DXA, colSpan: 6, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Garantías y/o Pólizas del contrato', width: pCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: 'Si\nAplica', width: pCols[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'No\nAplica', width: pCols[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'No. de Póliza', width: pCols[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Detalle', width: pCols[4], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Vigencia', width: pCols[5], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...polRowsData.map(
          ([lbl, nro, det, vig]) =>
            new TableRow({
              cantSplit: true,
              children: [
                makeCell({ text: lbl, width: pCols[0], bold: true, shading: SUBHEADER_SHADING }),
                makeCell({ text: polAplica ? 'X' : '', width: pCols[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
                makeCell({ text: !polAplica ? 'X' : '', width: pCols[2], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
                makeCell({ text: nro, width: pCols[3], align: AlignmentType.CENTER }),
                makeCell({ text: det, width: pCols[4] }),
                makeCell({ text: vig, width: pCols[5], align: AlignmentType.CENTER }),
              ],
            })
        ),
      ],
    })
  );

  const ampCols = [3300, 2360, 2360, CONTENT_DXA - 8020]; // 2380
  const fecIniAmp = polAplica ? formatSlashDMY(contract.fechaInicio) : '';
  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: ampCols,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Amparos: incluir líneas según número de amparos tales como cumplimiento, calidad del servicio)', width: ampCols[0], bold: true, shading: SUBHEADER_SHADING, size: 15 }),
            makeCell({ text: polAplica ? pol?.amparos || 'Cumplimiento, calidad y prestaciones según contrato.' : 'No aplica', width: CONTENT_DXA - ampCols[0], colSpan: 3, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Amparo', width: ampCols[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: 'Desde', width: ampCols[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Hasta', width: ampCols[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Valor', width: ampCols[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Cumplimiento', width: ampCols[0], bold: true }),
            makeCell({ text: fecIniAmp, width: ampCols[1], align: AlignmentType.CENTER }),
            makeCell({ text: polAplica ? formatSlashDMY(pol?.cumplimientoHasta) : 'N/A', width: ampCols[2], align: AlignmentType.CENTER }),
            makeCell({ text: polAplica ? 'Según póliza' : 'N/A', width: ampCols[3], align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Calidad:', width: ampCols[0], bold: true }),
            makeCell({ text: fecIniAmp, width: ampCols[1], align: AlignmentType.CENTER }),
            makeCell({ text: polAplica ? formatSlashDMY(pol?.calidadHasta) : 'N/A', width: ampCols[2], align: AlignmentType.CENTER }),
            makeCell({ text: polAplica ? 'Según póliza' : 'N/A', width: ampCols[3], align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Pago de salarios, Prestaciones Sociales e Indemnizaciones', width: ampCols[0], bold: true }),
            makeCell({ text: fecIniAmp, width: ampCols[1], align: AlignmentType.CENTER }),
            makeCell({ text: polAplica ? formatSlashDMY(pol?.salariosHasta) : 'N/A', width: ampCols[2], align: AlignmentType.CENTER }),
            makeCell({ text: polAplica ? 'Según póliza' : 'N/A', width: ampCols[3], align: AlignmentType.CENTER }),
          ],
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- IV. MODIFICACIONES CONTRACTUALES ---
  const modW = [4200, CONTENT_DXA - 4200];
  const modRowsData: Array<[string, string, boolean, boolean]> = [
    ['Modificación Nro.', mods.length > 0 ? mods.map((m) => m.modificacionNro).join(', ') : 'No aplica', false, false],
    ['Fecha', mods.length > 0 ? mods.map((m) => formatSlashDMY(m.fecha)).join(', ') : 'No aplica', false, false],
    ['Objeto de la Modificación', mods.length > 0 ? mods.map((m) => m.objeto).join(' | ') : 'No aplica', false, false],
    ['Valor Inicial del Contrato', `$ ${formatCOPNumber(fin.valorInicial)}`, true, true],
    ['Valores Adicionales', `$ ${formatCOPNumber(fin.valoresAdicionales)}`, false, true],
    ['Valor Pagado a la Fecha', `$ ${formatCOPNumber(fin.valorPagadoALaFecha)}`, false, true],
    ['Valor del Presente Pago', `$ ${formatCOPNumber(fin.valorPresentePago)}`, true, true],
    ['Saldo del Contrato por Pagar', `$ ${formatCOPNumber(fin.saldoPorPagar)}`, true, true],
    ['Saldo del Contrato por Ejecutar', `$ ${formatCOPNumber(fin.saldoPorEjecutar)}`, false, true],
    ['Valor Total Final', `$ ${formatCOPNumber(fin.valorTotalFinal)}`, true, true],
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: modW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'IV. MODIFICACIONES CONTRACTUALES', width: CONTENT_DXA, colSpan: 2, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        ...modRowsData.map(
          ([lbl, val, isBold, isMoney], i) =>
            new TableRow({
              cantSplit: true,
              children: [
                makeCell({ text: lbl, width: modW[0], bold: true, shading: i === modRowsData.length - 1 ? HEADER_SHADING : SUBHEADER_SHADING }),
                makeCell({ text: val, width: modW[1], bold: isBold, align: isMoney ? AlignmentType.RIGHT : AlignmentType.LEFT, shading: i === modRowsData.length - 1 ? HEADER_SHADING : undefined }),
              ],
            })
        ),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- V. ACTIVIDADES REALIZADAS POR EL CONTRATISTA ---
  const actW = [520, 3080, 4500, CONTENT_DXA - 8100]; // 2300
  const actividades = report.actividades || [];
  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: actW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'V. ACTIVIDADES REALIZADAS POR EL CONTRATISTA', width: CONTENT_DXA, colSpan: 4, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'N°', width: actW[0], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Compromisos Contractuales', width: actW[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Actividades Realizadas', width: actW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Productos', width: actW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...(actividades.length === 0
          ? [
              new TableRow({
                children: [
                  makeCell({ text: '1', width: actW[0], bold: true, align: AlignmentType.CENTER }),
                  makeCell({ text: 'Sin compromisos registrados en este informe.', width: actW[1] }),
                  makeCell({ text: '', width: actW[2] }),
                  makeCell({ text: '', width: actW[3] }),
                ],
              }),
            ]
          : actividades.map((act, idx) => {
              const pCount = act.fotografias?.length || 0;
              const sCount = act.soportes?.length || 0;
              const notes: string[] = [];
              if (pCount > 0) notes.push(`${pCount} evidencia(s) fotográfica(s) en Anexo`);
              if (sCount > 0) notes.push(`${sCount} documento(s) soporte(s)`);
              const prodText = [act.productos || '', notes.length > 0 ? `(${notes.join('; ')})` : '']
                .filter(Boolean)
                .join('\n');
              return new TableRow({
                cantSplit: true,
                children: [
                  makeCell({ text: String(idx + 1), width: actW[0], bold: true, align: AlignmentType.CENTER }),
                  makeCell({ text: act.obligacion || '', width: actW[1], size: 15 }),
                  makeCell({ text: act.actividadRealizada || '', width: actW[2], size: 15 }),
                  makeCell({ text: prodText, width: actW[3], size: 15 }),
                ],
              });
            })),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- VI. VERIFICACIÓN INTEGRAL DEL CUMPLIMIENTO CONTRACTUAL ---
  const pctW = [3900, 1300, 3900, CONTENT_DXA - 9100]; // 1300
  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: pctW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'VI. VERIFICACIÓN INTEGRAL DEL CUMPLIMIENTO CONTRACTUAL', width: CONTENT_DXA, colSpan: 4, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Porcentaje de Avance en Tiempo período informado (%) (mes)', width: pctW[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: formatPct(fin.porcentajeAvanceTiempoPeriodo), width: pctW[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'Avance Financiero del Período Informado (%) (mes)', width: pctW[2], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: formatPct(fin.porcentajeAvanceFinancieroPeriodo), width: pctW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Avance total en tiempo del contrato en % (acumulado):', width: pctW[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: formatPct(fin.porcentajeAvanceTiempoAcumulado), width: pctW[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'Avance Financiero Total del contrato en % (acumulado):', width: pctW[2], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: formatPct(fin.porcentajeAvanceFinancieroAcumulado), width: pctW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
      ],
    })
  );

  const chkW = [1500, 4260, 840, 840, 840, CONTENT_DXA - 8280]; // 2120
  const ver = report.verificacionIntegral;
  const componentesList: Array<{ key: keyof NonNullable<ActivityReport['verificacionIntegral']>; nombre: string; desc: string }> = [
    { key: 'tecnico', nombre: 'Técnico', desc: 'Cumplimiento de las especificaciones técnicas, planos, calidades, licencias, autorizaciones, personal técnico, cumplimiento de los plazos, cronogramas, cumplimiento de los amparos del contrato y actividades y productos frente al objeto contractual, entre otros aspectos determinados en el componente técnico que se requiera' },
    { key: 'administrativo', nombre: 'Administrativo', desc: 'Entrega oportuna de informes, soportes y evidencias contractuales; las garantías se encuentran vigentes y su cobertura de acuerdo a los términos determinados en el contrato; novedades existentes en la ejecución y terminación del contrato; la existencia de los respectivos informes generados desde el contratista respecto al cumplimiento del objeto contractual, entre otros aspectos determinados en el componente administrativo que se requiera' },
    { key: 'financiero', nombre: 'Financiero', desc: 'Correspondencia entre actividades ejecutadas y valor a reconocer en el periodo respectivo, determinando los documentos para el pago; existencia de las apropiaciones presupuestales; las actas de recibidos a satisfacción de los bienes entregados o ejecutados conforme a lo estipulado en el contrato; las cuentas de cobro cumplen con los requisitos presupuestarios en la entidad; determinar el balance presupuestario para los pagos, la entrega de los anticipos, y si hay actividades adicionales, entre otros aspectos determinados en el componente financiero que se requiera' },
    { key: 'contable', nombre: 'Contable', desc: 'revisión de cuenta de cobro que incluya los registros presupuestarios; soportes de pago y el recibo a satisfacción de los bienes o servicios objeto del contrato; cuentas bancarias determinadas para el pago; entre otros aspectos determinados en el componente contable que se requiera' },
    { key: 'juridico', nombre: 'Jurídico', desc: 'verificación del cumplimiento de obligaciones contractuales y ausencia de novedades que afecten la ejecución; la existencia del acta de inicio, y actas de adición o prorroga con las respectivas pólizas determinar el cumplimiento de las disposiciones del sistema de seguridad social y salud en el trabajo; relacionar hechos o circunstancias que puedan constituir actos de corrupción entre otros aspectos determinados en el componente jurídico que se requiera' },
  ];
  const segItems: Array<{ key: keyof NonNullable<ActivityReport['verificacionIntegral']>; label: string }> = [
    { key: 'bienesRecibidos', label: 'Bienes y/o Servicios Recibidos a la Fecha' },
    { key: 'bienesPendientes', label: 'Bienes y/o Servicios Pendientes por Recibir' },
    { key: 'informesPresentados', label: 'Informes de Supervisión Presentados a la Fecha' },
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: chkW,
      rows: [
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Componente', width: chkW[0], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'Aspecto Verificado', width: chkW[1], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'Resultado de la Verificación del Supervisor', width: chkW[2] + chkW[3] + chkW[4], colSpan: 3, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Observaciones', width: chkW[5], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Cumple', width: chkW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Parcial', width: chkW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'No cumple', width: chkW[4], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 14 }),
          ],
        }),
        ...componentesList.map(({ key, nombre, desc }) => {
          const st = ver?.[key];
          return new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: nombre, width: chkW[0], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: desc, width: chkW[1], size: 15 }),
              makeCell({ text: st?.resultado === 'Cumple' ? 'X' : '', width: chkW[2], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'Parcial' ? 'X' : '', width: chkW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'No cumple' ? 'X' : '', width: chkW[4], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.observaciones || '', width: chkW[5], size: 15 }),
            ],
          });
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Aspectos para Realizar Seguimiento', width: chkW[0] + chkW[1], colSpan: 2, bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: 'Cumple', width: chkW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Parcial', width: chkW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'No Cumple', width: chkW[4], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 14 }),
            makeCell({ text: 'Observaciones', width: chkW[5], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...segItems.map(({ key, label }) => {
          const st = ver?.[key];
          return new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: label, width: chkW[0] + chkW[1], colSpan: 2, bold: true }),
              makeCell({ text: st?.resultado === 'Cumple' ? 'X' : '', width: chkW[2], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'Parcial' ? 'X' : '', width: chkW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'No cumple' ? 'X' : '', width: chkW[4], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.observaciones || '', width: chkW[5], size: 15 }),
            ],
          });
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- VII. CONTROL DE NOVEDADES CONTRACTUALES ---
  const segW = [chkW[0] + chkW[1], chkW[2], chkW[3], chkW[4], chkW[5]];
  const nov = report.controlNovedades;
  const novedadesList: Array<{ key: keyof NonNullable<ActivityReport['controlNovedades']>; q: string }> = [
    { key: 'retrasos', q: '¿Se presentaron retrasos en el cumplimiento de actividades durante el periodo evaluado?' },
    { key: 'requerimientos', q: '¿Se presentaron requerimientos al contratista?' },
    { key: 'incumplimiento', q: '¿Se evidenció incumplimiento parcial o total de alguna obligación?' },
    { key: 'ajusteCronograma', q: '¿Se requirió ajustar cronograma, forma de ejecución o productos?' },
    { key: 'suspensionProrroga', q: '¿Se presentó suspensión, prórroga, adición, modificación u otra novedad contractual?' },
    { key: 'riesgos', q: '¿Se identificaron riesgos que puedan afectar la ejecución del contrato?' },
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: segW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'VII. CONTROL DE NOVEDADES CONTRACTUALES', width: CONTENT_DXA, colSpan: 5, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Item', width: segW[0], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Cumple', width: segW[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Parcial', width: segW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'No Cumple', width: segW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 14 }),
            makeCell({ text: 'Observaciones', width: segW[4], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...novedadesList.map(({ key, q }) => {
          const st = nov?.[key];
          return new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: q, width: segW[0], bold: true, size: 15 }),
              makeCell({ text: st?.resultado === 'Cumple' ? 'X' : '', width: segW[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'Parcial' ? 'X' : '', width: segW[2], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'No cumple' ? 'X' : '', width: segW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.observaciones || '', width: segW[4], size: 15 }),
            ],
          });
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- VIII. CONTROL DE PRINCIPIOS Y CUMPLIMIENTO JURÍDICO ---
  const pri = report.controlPrincipios;
  const principiosList: Array<{ key: keyof NonNullable<ActivityReport['controlPrincipios']>; q: string }> = [
    { key: 'cumplimientoObligaciones', q: '¿Cumplimiento de las obligaciones pactadas en el contrato?' },
    { key: 'correspondenciaActividades', q: '¿Correspondencia entre actividades realizadas y objeto contractual?' },
    { key: 'soportesSuficientes', q: '¿Soportes suficientes para acreditar la ejecución del periodo?' },
    { key: 'observanciaPrincipios', q: '¿Observancia de los principios de eficacia, economía, responsabilidad y transparencia?' },
    { key: 'situacionesRequerimiento', q: '¿Existencia de situaciones que ameriten requerimiento o advertencia?' },
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: segW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'VIII. CONTROL DE PRINCIPIOS Y CUMPLIMIENTO JURÍDICO', width: CONTENT_DXA, colSpan: 5, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Aspecto Jurídico a Verificar', width: segW[0], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'Verificación', width: segW[1] + segW[2] + segW[3], colSpan: 3, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Observaciones del Supervisor', width: segW[4], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Cumple', width: segW[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Parcial', width: segW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'No Cumple', width: segW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 14 }),
          ],
        }),
        ...principiosList.map(({ key, q }) => {
          const st = pri?.[key];
          return new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: q, width: segW[0], bold: true, size: 15 }),
              makeCell({ text: st?.resultado === 'Cumple' ? 'X' : '', width: segW[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'Parcial' ? 'X' : '', width: segW[2], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.resultado === 'No cumple' ? 'X' : '', width: segW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.observaciones || '', width: segW[4], size: 15 }),
            ],
          });
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- IX. ANÁLISIS DEL SUPERVISOR SOBRE PROCEDENCIA DEL PAGO ---
  const pag = report.analisisPago;
  const criteriosList: Array<{ key: keyof NonNullable<ActivityReport['analisisPago']>; c: string }> = [
    { key: 'relacionObligaciones', c: '¿Las actividades del periodo guardan relación con las obligaciones contractuales?' },
    { key: 'productosRevisados', c: '¿Los productos o entregables fueron revisados por la supervisión?' },
    { key: 'soportesSuficientes', c: '¿Los soportes del periodo son suficientes para tramitar pago' },
    { key: 'seguridadSocialVerificada', c: '¿Se verificó el pago de seguridad social del contratista?' },
    { key: 'procedeReconocimiento', c: '¿Procede el reconocimiento económico del periodo evaluado?' },
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: segW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'IX. ANÁLISIS DEL SUPERVISOR SOBRE PROCEDENCIA DEL PAGO', width: CONTENT_DXA, colSpan: 5, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Criterio', width: segW[0], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'Verificación', width: segW[1] + segW[2] + segW[3], colSpan: 3, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Observaciones', width: segW[4], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'SI', width: segW[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'NO', width: segW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'N/A', width: segW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...criteriosList.map(({ key, c }) => {
          const st = pag?.[key];
          return new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: c, width: segW[0], bold: true, size: 15 }),
              makeCell({ text: st?.verificacion === 'SI' ? 'X' : '', width: segW[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.verificacion === 'NO' ? 'X' : '', width: segW[2], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.verificacion === 'N/A' ? 'X' : '', width: segW[3], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: st?.observaciones || '', width: segW[4], size: 15 }),
            ],
          });
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- X. CONCEPTO GENERAL DEL SUPERVISOR ---
  const conceptoVal = report.conceptoGeneral;
  const conceptoOpts: Array<ActivityReport['conceptoGeneral']> = [
    'Satisfactorio',
    'Satisfactorio con observaciones',
    'No Satisfactorio',
  ];

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: segW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'X. CONCEPTO GENERAL DEL SUPERVISOR', width: CONTENT_DXA, colSpan: 5, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: '', width: segW[0], rowSpan: 2, shading: SUBHEADER_SHADING }),
            makeCell({ text: 'Verificación', width: segW[1] + segW[2] + segW[3], colSpan: 3, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, size: 15 }),
            makeCell({ text: 'Observaciones', width: segW[4], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'SI', width: segW[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'NO', width: segW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'N/A', width: segW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...conceptoOpts.map((label) => {
          const isMatch = conceptoVal === label;
          return new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: label || '', width: segW[0], bold: isMatch }),
              makeCell({ text: isMatch ? 'X' : '', width: segW[1], bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: '', width: segW[2], align: AlignmentType.CENTER }),
              makeCell({ text: '', width: segW[3], align: AlignmentType.CENTER }),
              makeCell({ text: isMatch ? (report.observacionesSupervisor || '') : '', width: segW[4], size: 15 }),
            ],
          });
        }),
      ],
    })
  );

  // --- XI. CONCLUSIÓN DEL SEGUIMIENTO INTEGRAL DEL PERIODO ---
  const xiW = [4200, CONTENT_DXA - 4200];
  const conclusionText =
    report.conclusionSeguimiento ||
    'Una vez revisadas las obligaciones contractuales, las actividades ejecutadas, los productos entregados, los soportes documentales y los aspectos técnicos, administrativos, financieros, contables y jurídicos, se deja constancia de que la ejecución del contrato durante el periodo evaluado fue:';

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: xiW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'XI. CONCLUSIÓN DEL SEGUIMIENTO INTEGRAL DEL PERIODO', width: CONTENT_DXA, colSpan: 2, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [makeCell({ text: conclusionText, width: CONTENT_DXA, colSpan: 2 })],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text: `Observaciones adicionales: ${report.observacionesSupervisor || 'Sin observaciones adicionales.'}`,
              width: CONTENT_DXA,
              colSpan: 2,
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Cumplimiento del objeto contractual', width: xiW[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: report.cumplimientoObjeto || '', width: xiW[1] }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Recursos Utilizados', width: xiW[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: report.recursosUtilizados || '', width: xiW[1] }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'Evidencias de la Ejecución del Contrato:', width: xiW[0], bold: true, shading: SUBHEADER_SHADING }),
            makeCell({ text: report.evidenciasEjecucion || '', width: xiW[1] }),
          ],
        }),
      ],
    })
  );

  actaChildren.push(spacer());

  // --- XII. CONCEPTO DE LA SUPERVISIÓN ---
  const xiiW = [2000, 2800, 2800, CONTENT_DXA - 7600];
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

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: xiiW,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text: `XII. CONCEPTO DE LA SUPERVISIÓN: ${(report.conceptoGeneral || 'PENDIENTE').toUpperCase()}.`,
              width: CONTENT_DXA,
              colSpan: 4,
              bold: true,
              size: 17,
              align: AlignmentType.CENTER,
              shading: HEADER_SHADING,
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: 'Número del acta', width: xiiW[0], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Valor Total', width: xiiW[1], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Valor Ejecutado', width: xiiW[2], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            makeCell({ text: 'Saldo', width: xiiW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
          ],
        }),
        ...histActas.map(
          (item) =>
            new TableRow({
              cantSplit: true,
              children: [
                makeCell({ text: String(item.nroActa), width: xiiW[0], bold: true, align: AlignmentType.CENTER }),
                makeCell({ text: `$ ${formatCOPNumber(item.valorTotal)}`, width: xiiW[1], align: AlignmentType.RIGHT }),
                makeCell({ text: `$ ${formatCOPNumber(item.valorEjecutado)}`, width: xiiW[2], bold: true, align: AlignmentType.RIGHT }),
                makeCell({ text: `$ ${formatCOPNumber(item.saldo)}`, width: xiiW[3], align: AlignmentType.RIGHT }),
              ],
            })
        ),
      ],
    })
  );

  // --- XIII. APORTES AL SISTEMA DE SEGURIDAD SOCIAL ---
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

  const scW = [1760, 1760, 2100, 3180, CONTENT_DXA - 8800]; // 1600
  const ssList: Array<AporteSeguridadSocialItem | undefined> = aportes.length > 0 ? aportes : [undefined];

  ssList.forEach((ap, idx) => {
    actaChildren.push(
      new Table({
        width: { size: CONTENT_DXA, type: WidthType.DXA },
        columnWidths: scW,
        rows: [
          ...(idx === 0
            ? [
                new TableRow({
                  cantSplit: true,
                  children: [
                    makeCell({
                      text: 'XIII. APORTES AL SISTEMA DE SEGURIDAD SOCIAL',
                      width: CONTENT_DXA,
                      colSpan: 5,
                      bold: true,
                      size: 17,
                      align: AlignmentType.CENTER,
                      shading: HEADER_SHADING,
                    }),
                  ],
                }),
              ]
            : []),
          new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: 'Comprobante N°', width: scW[0], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: ap?.comprobanteNo || '', width: scW[1], align: AlignmentType.CENTER }),
              makeCell({ text: 'Entidad:', width: scW[2], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: ap?.entidad || '', width: scW[3] }),
              makeCell({ text: 'Valor', width: scW[4], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: 'Planilla N°', width: scW[0], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: ap?.planillaNo || '', width: scW[1], align: AlignmentType.CENTER }),
              makeCell({ text: 'Salud:', width: scW[2], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: ap?.salud?.entidad || contractor?.eps || '', width: scW[3] }),
              makeCell({ text: formatMoneyOpt(ap?.salud?.valor), width: scW[4], align: AlignmentType.RIGHT }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: 'Valor del Aporte:', width: scW[0], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: formatMoneyOpt(ap?.valorAporte), width: scW[1], bold: true, align: AlignmentType.RIGHT }),
              makeCell({ text: 'Pensión:', width: scW[2], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: ap?.pension?.entidad || contractor?.afp || '', width: scW[3] }),
              makeCell({ text: formatMoneyOpt(ap?.pension?.valor), width: scW[4], align: AlignmentType.RIGHT }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: 'Periodo de\nCotización:', width: scW[0], rowSpan: 2, bold: true, shading: SUBHEADER_SHADING, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: ap?.periodoCotizacion || 'Pendiente', width: scW[1], rowSpan: 2, bold: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
              makeCell({ text: 'Riesgos Laborales:', width: scW[2], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: ap?.riesgosLaborales?.entidad || contractor?.arl || '', width: scW[3] }),
              makeCell({ text: formatMoneyOpt(ap?.riesgosLaborales?.valor), width: scW[4], align: AlignmentType.RIGHT }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: 'Caja de compensación\n(si hace aportes):', width: scW[2], bold: true, shading: SUBHEADER_SHADING, size: 15 }),
              makeCell({ text: ap?.cajaCompensacion?.entidad || '', width: scW[3] }),
              makeCell({ text: formatMoneyOpt(ap?.cajaCompensacion?.valor), width: scW[4], align: AlignmentType.RIGHT }),
            ],
          }),
        ],
      })
    );
  });

  actaChildren.push(spacer());

  // --- XIV. FIRMAS ---
  const halfW = CONTENT_DXA / 2;
  const fechaDada = formatFechaLarga(report.fechaRevision || report.fechaRadicacion || report.updatedAt);

  actaChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: [halfW, halfW],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: 'XIV. FIRMAS', width: CONTENT_DXA, colSpan: 2, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text: `\n\n______________________________________\nSUPERVISOR (A)\n${supNombre || 'PENDIENTE'}\n${supCargo || 'Supervisor Designado'}${supDoc ? `\nC.C. ${supDoc}` : ''}\n${(contract.entidadContratante || 'ALCALDÍA DE QUIMBAYA (QUINDÍO)').toUpperCase()}`,
              width: halfW,
              size: 15,
            }),
            makeCell({
              text: `\n\n______________________________________\nCONTRATISTA\n${contNombre || 'PENDIENTE'}\n${contDoc ? `C.C / NIT: ${contDoc}` : ''}\nEjecutor Contractual`,
              width: halfW,
              size: 15,
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text:
                'Nota 1: Se deja constancia de que la presente supervisión no se limita a la relación de actividades reportadas por el contratista, sino que comprende la verificación material del cumplimiento de las obligaciones contractuales, la revisión de soportes, el análisis de novedades y la evaluación integral del contrato en sus componentes técnico, administrativo, financiero, contable y jurídico.\n\n' +
                'Nota 2: Conforme Decreto 1273 del 23 de julio de 2018, expedida por el Ministerio de Salud y Protección Social el Contratista debe efectuar el pago de la Seguridad Social mes vencido hasta el segundo (02) día hábil de cada mes.',
              width: CONTENT_DXA,
              colSpan: 2,
              size: 15,
            }),
          ],
        }),
      ],
    })
  );

  actaChildren.push(
    new Paragraph({
      spacing: { before: 140, after: 120 },
      children: [
        new TextRun({
          text: `Dada en ${contract.lugarEjecucion || 'Quimbaya, Quindío'} a los ${fechaDada.dia} días del mes de ${fechaDada.mes} de ${fechaDada.anio}.`,
          font: 'Arial',
          size: 17,
        }),
      ],
    })
  );

  // --- ANEXOS DEL ACTA (SOPORTES Y REGISTRO FOTOGRÁFICO) ---
  interface PhotoItem {
    obligacion: string;
    descripcion: string;
    url?: string;
    fileId?: string;
    fecha?: string;
  }
  interface SupportItem {
    obligacion: string;
    nombre: string;
    fecha?: string;
  }

  const allPhotos: PhotoItem[] = [];
  const allSupports: SupportItem[] = [];

  actividades.forEach((act) => {
    if (act.fotografias && act.fotografias.length > 0) {
      act.fotografias.forEach((p) => {
        allPhotos.push({
          obligacion: act.obligacion || '',
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
          fecha: s.fecha,
        });
      });
    }
  });

  if (allSupports.length > 0) {
    actaChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        spacing: { before: 0, after: 80 },
        children: [],
      })
    );
    const supW = [600, 3600, 4200, CONTENT_DXA - 8400]; // 2000
    actaChildren.push(
      new Table({
        width: { size: CONTENT_DXA, type: WidthType.DXA },
        columnWidths: supW,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              makeCell({ text: 'ANEXO 1. SOPORTES DOCUMENTALES DE EJECUCIÓN', width: CONTENT_DXA, colSpan: 4, bold: true, size: 17, align: AlignmentType.CENTER, shading: HEADER_SHADING }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            tableHeader: true,
            children: [
              makeCell({ text: 'N°', width: supW[0], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
              makeCell({ text: 'Obligación Asociada', width: supW[1], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: 'Documento / Soporte Adjunto', width: supW[2], bold: true, shading: SUBHEADER_SHADING }),
              makeCell({ text: 'Fecha', width: supW[3], bold: true, shading: SUBHEADER_SHADING, align: AlignmentType.CENTER }),
            ],
          }),
          ...allSupports.map(
            (docItem, idx) =>
              new TableRow({
                cantSplit: true,
                children: [
                  makeCell({ text: String(idx + 1), width: supW[0], bold: true, align: AlignmentType.CENTER }),
                  makeCell({ text: docItem.obligacion, width: supW[1], size: 15 }),
                  makeCell({ text: docItem.nombre, width: supW[2], size: 15 }),
                  makeCell({ text: formatSlashDMY(docItem.fecha) || '', width: supW[3], align: AlignmentType.CENTER, size: 15 }),
                ],
              })
          ),
        ],
      })
    );
  }

  if (allPhotos.length > 0) {
    actaChildren.push(
      new Paragraph({
        pageBreakBefore: allSupports.length === 0,
        spacing: { before: allSupports.length > 0 ? 180 : 0, after: 80 },
        children: [],
      })
    );

    const photoRows: TableRow[] = [
      new TableRow({
        cantSplit: true,
        children: [
          makeCell({
            text: 'ANEXO FOTOGRÁFICO DE EVIDENCIAS DE EJECUCIÓN',
            width: CONTENT_DXA,
            bold: true,
            size: 17,
            align: AlignmentType.CENTER,
            shading: HEADER_SHADING,
          }),
        ],
      }),
    ];

    for (let i = 0; i < allPhotos.length; i++) {
      const photo = allPhotos[i];
      let imageBytes: Buffer | null = null;
      let hintName = '';
      let fileRecordId = photo.fileId;
      if (!fileRecordId && photo.url && photo.url.startsWith('/api/uploads/')) {
        fileRecordId = photo.url.replace('/api/uploads/', '').split('/')[0].split('?')[0];
      }

      if (fileRecordId) {
        const evFile =
          db.getEvidenceFileById(fileRecordId) ||
          db.getEvidenceFiles().find((f) => f.fileName === fileRecordId || f.id === fileRecordId);
        if (evFile) {
          hintName = evFile.mimeType || evFile.fileName;
          let fPath = evFile.filePath;
          if (!fs.existsSync(fPath)) {
            const candidate = path.join(UPLOADS_DIR, evFile.fileName);
            if (fs.existsSync(candidate)) fPath = candidate;
          }
          if (fs.existsSync(fPath)) {
            imageBytes = fs.readFileSync(fPath);
          }
        }
      }

      if (!imageBytes && photo.url && photo.url.startsWith('/api/uploads/')) {
        const rawName = photo.url.replace('/api/uploads/', '').split('?')[0];
        const candidate = path.join(UPLOADS_DIR, rawName);
        if (fs.existsSync(candidate)) {
          imageBytes = fs.readFileSync(candidate);
          hintName = candidate;
        }
      }

      if (!imageBytes && photo.url && !photo.url.startsWith('data:') && !photo.url.startsWith('http')) {
        const rel = photo.url.startsWith('/') ? photo.url.slice(1) : photo.url;
        const candidate = path.isAbsolute(photo.url) && fs.existsSync(photo.url)
          ? photo.url
          : path.join(process.cwd(), rel);
        if (fs.existsSync(candidate)) {
          imageBytes = fs.readFileSync(candidate);
          hintName = candidate;
        }
      }

      if (!imageBytes && photo.url && photo.url.startsWith('data:image/')) {
        const match = photo.url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
        if (match) hintName = match[1];
        const base64Data = photo.url.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        imageBytes = Buffer.from(base64Data, 'base64');
      }

      const imgMeta = imageBytes ? resolveImageInfo(imageBytes, hintName, hintName) : null;
      let imgParagraph: Paragraph;
      if (imageBytes && imgMeta) {
        const maxW = 460;
        const maxH = 260;
        const ratio = Math.min(maxW / imgMeta.width, maxH / imgMeta.height, 1);
        const drawW = Math.max(40, Math.round(imgMeta.width * ratio));
        const drawH = Math.max(40, Math.round(imgMeta.height * ratio));
        imgParagraph = new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [
            new ImageRun({
              type: imgMeta.type,
              data: imageBytes,
              transformation: { width: drawW, height: drawH },
            }),
          ],
        });
      } else {
        imgParagraph = new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: '[Imagen adjunta disponible en el expediente digital del informe]',
              font: 'Arial',
              size: 15,
              color: '6B7280',
            }),
          ],
        });
      }

      photoRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text: `Evidencia ${i + 1}: ${photo.descripcion}${photo.fecha ? ` — Fecha: ${formatSlashDMY(photo.fecha)}` : ''}\nObligación: ${photo.obligacion}`,
              width: CONTENT_DXA,
              shading: SUBHEADER_SHADING,
              size: 15,
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_DXA, type: WidthType.DXA },
              borders: BORDER_ALL,
              margins: CELL_MARGINS,
              children: [imgParagraph],
            }),
          ],
        })
      );
    }

    actaChildren.push(
      new Table({
        width: { size: CONTENT_DXA, type: WidthType.DXA },
        columnWidths: [CONTENT_DXA],
        rows: photoRows,
      })
    );
  }

  // =========================================================================
  // SECTION 2: INFORME DE ACTIVIDADES (MODELO INFORME DE ACTIVIDADES)
  // Begins immediately after Acta de Supervisión on a new page
  // =========================================================================
  const informeChildren: Array<Paragraph | Table> = [];
  const actaNumPad = String(report.numeroActa || 1).padStart(2, '0');

  // Centered bordered title box: "Informe de Actividades / Número XX"
  const titleSideW = 2600;
  const titleCenterW = CONTENT_DXA - titleSideW * 2; // 5200
  informeChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: [titleSideW, titleCenterW, titleSideW],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: titleSideW, type: WidthType.DXA },
              borders: BORDER_NONE,
              children: [new Paragraph({ children: [] })],
            }),
            new TableCell({
              width: { size: titleCenterW, type: WidthType.DXA },
              borders: BORDER_ALL,
              margins: { top: 90, bottom: 90, left: 120, right: 120 },
              verticalAlign: VerticalAlign.CENTER,
              children: pLines(`Informe de Actividades\nNúmero ${actaNumPad}`, {
                bold: true,
                size: 23,
                align: AlignmentType.CENTER,
              }),
            }),
            new TableCell({
              width: { size: titleSideW, type: WidthType.DXA },
              borders: BORDER_NONE,
              children: [new Paragraph({ children: [] })],
            }),
          ],
        }),
      ],
    })
  );

  informeChildren.push(spacer(180));

  // Main Informe Table (matches exact column layout of MODELO INFORME DE ACTIVIDADES)
  const infC1 = 4400;
  const infC2 = 2400;
  const infC3 = CONTENT_DXA - infC1 - infC2; // 3600
  const infLeftSpan = infC1 + infC2; // 6800

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

  const claseContratoText = [
    contract.tipoContrato || 'CONTRATO DE PRESTACIÓN DE SERVICIOS',
    contract.numeroContrato ? `N° ${contract.numeroContrato}` : '',
    contract.fechaInicio ? `DE FECHA ${formatSlashDMY(contract.fechaInicio)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const firstAporte = aportes.length > 0 ? aportes[0] : undefined;
  const infSaludStr = firstAporte?.salud?.valor !== undefined ? `$ ${formatCOPNumber(firstAporte.salud.valor)}` : 'Pendiente';
  const infPensionStr = firstAporte?.pension?.valor !== undefined ? `$ ${formatCOPNumber(firstAporte.pension.valor)}` : 'Pendiente';
  const infArlStr = firstAporte?.riesgosLaborales?.valor !== undefined ? `$ ${formatCOPNumber(firstAporte.riesgosLaborales.valor)}` : 'Pendiente';
  const infPeriodoCot = firstAporte?.periodoCotizacion || 'Pendiente';
  const infComprobante = firstAporte?.comprobanteNo || 'Pendiente';
  const infPlanilla = firstAporte?.planillaNo || 'Pendiente';

  informeChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: [infC1, infC2, infC3],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `NOMBRE DEL CONTRATISTA:\n${contNombre || ''}`, width: infC1, bold: true }),
            makeCell({ text: `CÉDULA: ${contDoc || ''}${contractor?.direccion ? `\n${contractor.direccion}` : ''}`, width: infC2, bold: true }),
            makeCell({ text: `CORREO DEL CONTRATISTA:\n${contractor?.email || ''}`, width: infC3, bold: true, size: 15 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `SUPERVISOR:\n${supNombre || ''}`, width: infLeftSpan, colSpan: 2, bold: true }),
            makeCell({ text: `CORREO DEL SUPERVISOR:\n${supervisorEmail || ''}`, width: infC3, bold: true, size: 15 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `Periodo informado:\n${infPeriodoTexto}`, width: CONTENT_DXA, colSpan: 3, bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `CLASE DE CONTRATO, NÚMERO Y FECHA: ${claseContratoText}`, width: infLeftSpan, colSpan: 2, bold: true, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: `TELÉFONO DEL CONTRATISTA:\n${contractor?.telefono || ''}`, width: infC3, bold: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: `OBJETO DEL CONTRATO:\n${contract.objeto ? `“${contract.objeto}”` : ''}`, width: CONTENT_DXA, colSpan: 3 }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text:
                `VALOR PAGADO SISTEMA DE SEGURIDAD: SALUD: ${infSaludStr}   PENSIÓN: ${infPensionStr}\n` +
                `ARL: ${infArlStr}   PERIODO DE COTIZACION: ${infPeriodoCot}\n` +
                `COMPROBANTE No. ${infComprobante}\n` +
                `PLANILLA No. ${infPlanilla}`,
              width: CONTENT_DXA,
              colSpan: 3,
              bold: true,
              size: 15,
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({
              text: `SITIO DE EJECUCIÓN: ${contract.lugarEjecucion || 'Municipio de Quimbaya (Q).'}`,
              width: CONTENT_DXA,
              colSpan: 3,
              bold: true,
            }),
          ],
        }),
      ],
    })
  );

  // Activities Sub-table of Informe de Actividades (contiguous borders matching template)
  const infActW = [520, 3080, 3600, CONTENT_DXA - 7200]; // 3200
  informeChildren.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: infActW,
      rows: [
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            makeCell({ text: '', width: infActW[0], bold: true, align: AlignmentType.CENTER }),
            makeCell({ text: 'ACTIVIDADES\nCONTRACTUALES', width: infActW[1], bold: true, italic: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'ACTIVIDADES REALIZADAS', width: infActW[2], bold: true, italic: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: 'PRODUCTOS', width: infActW[3], bold: true, italic: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER }),
          ],
        }),
        ...(actividades.length === 0
          ? [
              new TableRow({
                cantSplit: true,
                children: [
                  makeCell({ text: '1', width: infActW[0], bold: true, align: AlignmentType.CENTER }),
                  makeCell({ text: 'Sin obligaciones registradas.', width: infActW[1], size: 15 }),
                  makeCell({ text: '', width: infActW[2], size: 15 }),
                  makeCell({ text: '', width: infActW[3], size: 15 }),
                ],
              }),
            ]
          : actividades.map(
              (act, idx) =>
                new TableRow({
                  cantSplit: true,
                  children: [
                    makeCell({ text: String(idx + 1), width: infActW[0], bold: true, align: AlignmentType.CENTER }),
                    makeCell({ text: act.obligacion || '', width: infActW[1], size: 15 }),
                    makeCell({ text: act.actividadRealizada || '', width: infActW[2], size: 15 }),
                    makeCell({ text: act.productos || '', width: infActW[3], size: 15 }),
                  ],
                })
            )),
        new TableRow({
          cantSplit: true,
          children: [
            makeCell({ text: '', width: infActW[0] }),
            makeCell({ text: 'ANEXOS: CUENTA DE COBRO, PAGO DE SEGURIDAD SOCIAL', width: infActW[1], size: 15 }),
            makeCell({ text: 'Se presentan los respectivos anexos.', width: infActW[2], size: 15, vAlign: VerticalAlign.CENTER }),
            makeCell({ text: '-Carpeta del contratista en el archivo de la oficina asesora jurídica', width: infActW[3], size: 15 }),
          ],
        }),
      ],
    })
  );

  // Contractor Signature block at bottom of Informe de Actividades
  informeChildren.push(
    new Paragraph({
      spacing: { before: 420, after: 40 },
      children: [
        new TextRun({ text: '________________________________________', bold: true, font: 'Arial', size: 17 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [new TextRun({ text: contNombre || 'CONTRATISTA', bold: true, font: 'Arial', size: 17 })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({
          text: `${contractor?.tipoDocumento === 'NIT' ? 'NIT' : 'C.C. N°'} ${contDoc || ''}`.trim(),
          bold: true,
          font: 'Arial',
          size: 17,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [new TextRun({ text: 'Contratista.', bold: true, font: 'Arial', size: 17 })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: contract.lugarEjecucion || 'Oficina. Alcaldía Municipal de Quimbaya (Q).',
          bold: true,
          font: 'Arial',
          size: 17,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: 1750, bottom: 1650, left: MARGIN_LR, right: MARGIN_LR, header: 450, footer: 400 },
          },
        },
        headers: {
          default: new Header({
            children: [actaHeaderTable],
          }),
        },
        footers: {
          default: new Footer({
            children: [actaFooterTable, actaFooterContact],
          }),
        },
        children: actaChildren,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: 920, bottom: 920, left: MARGIN_LR, right: MARGIN_LR },
          },
        },
        headers: {
          default: new Header({ children: [] }),
        },
        footers: {
          default: new Footer({ children: [] }),
        },
        children: informeChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
