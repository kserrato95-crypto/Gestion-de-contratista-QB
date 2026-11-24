import { Router, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, ActivityReport, Contract, User, ACTAS_DIR } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireSupervisor, sanitizeUser } from '../auth.js';
import { generateActaSupervisionPdf, findSupervisorEmail } from '../pdfGenerator.js';
import { generateActaYInformeDocx } from '../docxGenerator.js';
import {
  calculateDetailedDuration,
  getContractPeriods,
  calculateTotalDays,
  getContractProgressTracker,
} from '../utils/contractDuration.js';

const router = Router();

// Ensure actas cache dir exists
if (!fs.existsSync(ACTAS_DIR)) {
  fs.mkdirSync(ACTAS_DIR, { recursive: true });
}

// Parse YYYY-MM-DD or ISO date string safely into UTC Date
function parseYMD(dStr?: string): Date {
  if (!dStr) return new Date();
  const clean = dStr.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Determine total contract duration in calendar days and periods
export function getContractDurationInfo(contract: Contract) {
  const contractTotalDays = calculateTotalDays(contract.fechaInicio, contract.fechaFin);
  const periods = getContractPeriods(contract.fechaInicio, contract.fechaFin);
  const detailed = calculateDetailedDuration(contract.fechaInicio, contract.fechaFin);

  return {
    contractTotalDays,
    totalExpectedActas: Math.max(1, periods.length),
    duracionTexto: detailed.texto,
    totalDias: contractTotalDays,
    mesesInformaticos: detailed.meses,
    diasInformaticos: detailed.dias,
    periods,
  };
}

// Calculate financial figures and percentages for official Acta strictly using calendar days
export function calculateActaFinancieroYAvance(
  contract: Contract,
  fechaInicioPeriodo: string,
  fechaFinPeriodo: string,
  currentActaNumber: number,
  reportId?: string
) {
  // 1. Economic base
  const valorInicial = Number(contract.valorTotal) || 0;
  const adicionales = (contract.modificaciones || []).reduce(
    (acc, m) => acc + (Number(m.valorAdicional) || 0),
    0
  );
  const valorTotalFinal = Math.round((valorInicial + adicionales) * 100) / 100;

  // 2. Previous reports for this contract (strictly previous actas: numeroActa < currentActaNumber)
  const allContractReports = db
    .getReports()
    .filter((r) => r.contratoId === contract.id && r.id !== reportId)
    .sort((a, b) => (a.numeroActa || 0) - (b.numeroActa || 0));

  const previousReports = allContractReports.filter(
    (r) => (r.numeroActa || 0) < currentActaNumber
  );

  // Previous payments certified or paid
  const previousPaidFromReports = previousReports.reduce(
    (acc, r) => acc + (Number(r.financiero?.valorPresentePago) || 0),
    0
  );
  const allPayments = db.getPayments().filter((p) => p.contratoId === contract.id);
  const previousPayments = allPayments.filter(
    (p) =>
      p.informeId !== reportId &&
      (p.estado === 'Pagado' || p.estado === 'Certificado por supervisión')
  );
  const previousPaidFromPayments = previousPayments.reduce(
    (acc, p) => acc + Number(p.valor || 0),
    0
  );

  const valorPagadoALaFecha =
    Math.round(Math.max(previousPaidFromReports, previousPaidFromPayments) * 100) / 100;

  // 3. Exact days of this period and total contract days
  const contractTotalDays = calculateTotalDays(contract.fechaInicio, contract.fechaFin);
  const pStart = parseYMD(fechaInicioPeriodo);
  const pEnd = parseYMD(fechaFinPeriodo);
  const diasPeriodo = Math.max(1, Math.round((pEnd.getTime() - pStart.getTime()) / 86400000) + 1);

  const periods = getContractPeriods(contract.fechaInicio, contract.fechaFin);
  const totalExpectedActas = Math.max(1, periods.length);
  const cEnd = parseYMD(contract.fechaFin);

  const isFinalActa =
    currentActaNumber >= totalExpectedActas ||
    pEnd.getTime() >= cEnd.getTime() ||
    valorPagadoALaFecha + (contract.honorariosMensuales || 0) >= valorTotalFinal;

  // 4. Time percentage calculation strictly per real calendar days formula:
  // Avance del período = (días del período / días totales del contrato) × 100
  // Avance acumulado = (días únicos cubiertos / días totales del contrato) × 100
  const previousPctTiempoAcum = previousReports.reduce((acc, r) => {
    return acc + (Number(r.financiero?.porcentajeAvanceTiempoPeriodo) || 0);
  }, 0);

  let porcentajeAvanceTiempoPeriodo: number;
  let porcentajeAvanceTiempoAcumulado: number;

  if (isFinalActa) {
    porcentajeAvanceTiempoPeriodo = Math.max(
      0,
      Math.round((100 - previousPctTiempoAcum) * 100) / 100
    );
    porcentajeAvanceTiempoAcumulado = 100.0;
  } else {
    porcentajeAvanceTiempoPeriodo =
      contractTotalDays > 0 ? Math.round((diasPeriodo / contractTotalDays) * 10000) / 100 : 0;
    porcentajeAvanceTiempoAcumulado = Math.min(
      100,
      Math.round((previousPctTiempoAcum + porcentajeAvanceTiempoPeriodo) * 100) / 100
    );
  }

  // 5. Independent Financial calculation:
  // Honorarios correspondientes al período de 30 días o fracción proporcional si es menor
  let valorPresentePago: number;
  if (isFinalActa) {
    valorPresentePago = Math.max(
      0,
      Math.round((valorTotalFinal - valorPagadoALaFecha) * 100) / 100
    );
  } else {
    let standardPayment = contract.honorariosMensuales || 0;
    if (diasPeriodo === 30 && standardPayment > 0) {
      standardPayment = contract.honorariosMensuales || 0;
    } else if (standardPayment > 0 && diasPeriodo < 30) {
      standardPayment = Math.round((diasPeriodo / 30) * standardPayment * 100) / 100;
    } else if (contractTotalDays > 0) {
      standardPayment = Math.round(valorTotalFinal * (diasPeriodo / contractTotalDays) * 100) / 100;
    }
    valorPresentePago = Math.min(
      valorTotalFinal - valorPagadoALaFecha,
      standardPayment
    );
    valorPresentePago = Math.round(valorPresentePago * 100) / 100;
  }

  const saldoPorPagar = Math.max(
    0,
    Math.round((valorTotalFinal - (valorPagadoALaFecha + valorPresentePago)) * 100) / 100
  );
  const saldoPorEjecutar = saldoPorPagar;

  // 6. Financial percentage calculation independent of time
  const previousPctFinancieroAcum = previousReports.reduce((acc, r) => {
    return acc + (Number(r.financiero?.porcentajeAvanceFinancieroPeriodo) || 0);
  }, 0);

  let porcentajeAvanceFinancieroPeriodo: number;
  let porcentajeAvanceFinancieroAcumulado: number;

  if (isFinalActa || saldoPorPagar === 0) {
    porcentajeAvanceFinancieroPeriodo = Math.max(
      0,
      Math.round((100 - previousPctFinancieroAcum) * 100) / 100
    );
    porcentajeAvanceFinancieroAcumulado = 100.0;
  } else {
    porcentajeAvanceFinancieroPeriodo =
      valorTotalFinal > 0 ? Math.round((valorPresentePago / valorTotalFinal) * 10000) / 100 : 0;
    porcentajeAvanceFinancieroAcumulado = Math.min(
      100,
      Math.round(
        ((valorPagadoALaFecha + valorPresentePago) / valorTotalFinal) * 10000
      ) / 100
    );
  }

  // 7. Concept history table (Section XII on Page 7)
  const historialActasConcepto: Array<{
    nroActa: number;
    valorTotal: number;
    valorEjecutado: number;
    saldo: number;
  }> = [];

  let runningPaid = 0;
  for (const prev of previousReports) {
    const pay = Number(prev.financiero?.valorPresentePago) || 0;
    runningPaid += pay;
    historialActasConcepto.push({
      nroActa: prev.numeroActa,
      valorTotal: valorTotalFinal,
      valorEjecutado: Math.round(runningPaid * 100) / 100,
      saldo: Math.max(0, Math.round((valorTotalFinal - runningPaid) * 100) / 100),
    });
  }

  historialActasConcepto.push({
    nroActa: currentActaNumber,
    valorTotal: valorTotalFinal,
    valorEjecutado: Math.round((valorPagadoALaFecha + valorPresentePago) * 100) / 100,
    saldo: saldoPorPagar,
  });

  return {
    financiero: {
      valorInicial,
      valoresAdicionales: adicionales,
      valorPagadoALaFecha,
      valorPresentePago,
      saldoPorPagar,
      saldoPorEjecutar,
      valorTotalFinal,
      porcentajeAvanceTiempoPeriodo,
      porcentajeAvanceFinancieroPeriodo,
      porcentajeAvanceTiempoAcumulado,
      porcentajeAvanceFinancieroAcumulado,
    },
    historialActasConcepto,
  };
}

// Helper: Safely generate official 8-page PDF, verify structure, allocate sequential Radicación number, and save
async function executeRadicacionWorkflow(
  report: ActivityReport,
  contract: Contract,
  contractor: User,
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const now = new Date().toISOString();

  // Validate that all contractual obligations have described activities
  const incompleteOb = report.actividades.find(
    (a) => !a.actividadRealizada || !a.actividadRealizada.trim()
  );
  if (incompleteOb) {
    res.status(400).json({
      error: `Para generar el acta y radicar formalmente, debe registrar las actividades desarrolladas en la obligación: "${incompleteOb.obligacion.slice(0, 60)}...".`,
      report,
    });
    return;
  }

  // Ensure that financial metrics, progress percentages and concept history are freshly calculated and frozen
  const calcResult = calculateActaFinancieroYAvance(
    contract,
    report.fechaInicioPeriodo,
    report.fechaFinPeriodo,
    report.numeroActa || 1,
    report.id
  );
  report.financiero = calcResult.financiero;
  report.historialActasConcepto = calcResult.historialActasConcepto;

  // Attempt official 8-page PDF generation FIRST before assigning radicación
  try {
    const pdfBytes = await generateActaSupervisionPdf(report, contract, contractor);

    if (!pdfBytes || pdfBytes.length < 4000) {
      throw new Error('El PDF generado no cumple con la estructura institucional requerida.');
    }

    // Allocate persistent, sequential institutional radicación number ONLY once PDF is verified!
    // Prevents consuming sequence numbers on failure
    if (!report.numeroRadicacion) {
      report.numeroRadicacion = db.getNextRadicacionNumber(contract.numeroContrato);
    }

    report.estado = 'Radicado';
    report.estadoError = undefined;
    report.fechaRadicacion = now;

    // Cache the verified official PDF file
    const safeRad = report.numeroRadicacion.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cachedPdfPath = path.join(ACTAS_DIR, `Acta_${safeRad}.pdf`);
    fs.writeFileSync(cachedPdfPath, Buffer.from(pdfBytes));
    report.archivoPdfPath = cachedPdfPath;

    // Record status history
    report.historialEstados = report.historialEstados || [];
    report.historialEstados.push({
      estado: 'Radicado',
      fecha: now,
      usuario: `${req.user!.nombres} ${req.user!.apellidos}`,
      observaciones: `Acta de supervisión oficial generada exitosamente y radicada ante la supervisión bajo el consecutivo institucional ${report.numeroRadicacion}.`,
    });

    const finalReport = db.updateReport(report.id, report);

    // Audit log
    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'RADICACION_ACTA_SUPERVISION',
      modulo: 'informes',
      detalles: `El contratista ${req.user!.nombres} ${req.user!.apellidos} radicó formalmente el informe y generó el Acta Oficial de Supervisión No. ${report.numeroActa} con radicado No. ${report.numeroRadicacion}.`,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Acta de supervisión oficial generada y radicada exitosamente ante la supervisión. Número institucional de radicación: ${report.numeroRadicacion}`,
      report: finalReport,
      numeroRadicacion: report.numeroRadicacion,
    });
  } catch (pdfError: any) {
    console.error('Error during Acta PDF generation:', pdfError);

    // Conservar informe como borrador con error explícito sin perder datos ni asignar radicación definitiva
    report.estado = 'Borrador';
    report.estadoError = `Error al generar acta: ${pdfError.message || 'Error técnico al compilar el PDF oficial'}`;
    const preservedReport = db.updateReport(report.id, report);

    res.status(500).json({
      success: false,
      error: `Error al generar el acta oficial: ${pdfError.message || 'Inconveniente técnico con las evidencias o plantilla'}. Toda la información diligenciada fue conservada intacta para que pueda reintentar.`,
      report: preservedReport,
    });
  }
}

// GET all reports (filtered by user role)
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    let reports: ActivityReport[] = [];
    if (req.user.rol === 'admin') {
      reports = db.getReports();
    } else if (req.user.rol === 'supervisor') {
      const supDoc = (req.user.numeroDocumento || '').trim();
      const supNombres = (req.user.nombres || '').trim().toLowerCase();
      const supApellidos = (req.user.apellidos || '').trim().toLowerCase();

      // Find contracts supervised by this supervisor
      const assignedContracts = db.getContracts().filter((c) => {
        const docMatches = Boolean(c.supervisorDocumento && c.supervisorDocumento.trim() === supDoc);
        const nameMatches = Boolean(
          (c.supervisorResponsable && c.supervisorResponsable.toLowerCase().includes(supApellidos)) ||
          (c.supervisorResponsable && c.supervisorResponsable.toLowerCase().includes(supNombres))
        );
        return docMatches || nameMatches;
      });

      const assignedContractIds = new Set(assignedContracts.map((c) => c.id));
      reports = db.getReports().filter((r) => assignedContractIds.has(r.contratoId));
    } else {
      reports = db.getReportsByContractor(req.user.id);
    }

    // Sort descending by date/creation
    const sorted = [...reports].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.fechaRadicacion || 0).getTime();
      const timeB = new Date(b.createdAt || b.fechaRadicacion || 0).getTime();
      return timeB - timeA;
    });

    res.json({ reports: sorted });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Error al consultar informes de actividades.' });
  }
});

// GET preview metrics for real-time automatic calculation strictly in calendar days
router.get('/preview-metricas', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contratoId, fechaInicioPeriodo, fechaFinPeriodo, numeroActa, reportId } = req.query;
    if (!contratoId) {
      res.status(400).json({ error: 'Debe especificar el contratoId.' });
      return;
    }
    const contract = db.getContractById(String(contratoId));
    if (!contract) {
      res.status(404).json({ error: 'Contrato no encontrado.' });
      return;
    }

    const existingReports = db
      .getReportsByContractor(contract.contratistaId)
      .filter((r) => r.contratoId === contract.id);
    const nextActaNo = numeroActa ? Number(numeroActa) : existingReports.length + 1;

    const pStart = fechaInicioPeriodo ? String(fechaInicioPeriodo) : contract.fechaInicio;
    const pEnd = fechaFinPeriodo ? String(fechaFinPeriodo) : contract.fechaFin;

    const pStartDate = parseYMD(pStart);
    const pEndDate = parseYMD(pEnd);
    const diasPeriodo = Math.max(1, Math.round((pEndDate.getTime() - pStartDate.getTime()) / 86400000) + 1);

    const durationInfo = getContractDurationInfo(contract);
    const calc = calculateActaFinancieroYAvance(
      contract,
      pStart,
      pEnd,
      nextActaNo,
      reportId ? String(reportId) : undefined
    );

    res.json({
      success: true,
      durationInfo,
      diasPeriodo,
      actaNumero: nextActaNo,
      financiero: calc.financiero,
      historialActasConcepto: calc.historialActasConcepto,
    });
  } catch (err: any) {
    console.error('Error in /preview-metricas:', err);
    res.status(500).json({ error: err.message || 'Error al calcular métricas en tiempo real.' });
  }
});

// GET complete tracking metrics for a specific contract or contractor
router.get('/seguimiento-contrato', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contratoId } = req.query;
    let contract: Contract | undefined;

    if (contratoId) {
      contract = db.getContractById(String(contratoId));
    } else if (req.user?.rol === 'contratista') {
      const contractorContracts = db.getContractsByContractor(req.user.id);
      contract = contractorContracts.find((c) => c.estado === 'Activo') || contractorContracts[0];
    }

    if (!contract) {
      res.status(404).json({ error: 'Contrato no encontrado.' });
      return;
    }

    const reports = db.getReports().filter((r) => r.contratoId === contract!.id);
    const tracking = getContractProgressTracker(contract, reports);

    res.json({ success: true, contract, tracking });
  } catch (err: any) {
    console.error('Error in /seguimiento-contrato:', err);
    res.status(500).json({ error: 'Error al consultar seguimiento contractual.' });
  }
});

// GET tracking for all contracts assigned to supervisor or admin
router.get('/seguimiento-todos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    let contracts: Contract[] = [];
    if (req.user?.rol === 'supervisor') {
      const supervisorName = `${req.user.nombres} ${req.user.apellidos}`.toLowerCase();
      contracts = db.getContracts().filter((c) => {
        const matchesName = (c.supervisorResponsable || '').toLowerCase().includes(supervisorName);
        const matchesDoc = c.supervisorDocumento === req.user?.numeroDocumento;
        return matchesName || matchesDoc;
      });
    } else {
      contracts = db.getContracts();
    }

    const allReports = db.getReports();
    const trackings = contracts.map((c) => {
      const contractReports = allReports.filter((r) => r.contratoId === c.id);
      return {
        contract: c,
        tracking: getContractProgressTracker(c, contractReports),
      };
    });

    res.json({ success: true, trackings });
  } catch (err: any) {
    console.error('Error in /seguimiento-todos:', err);
    res.status(500).json({ error: 'Error al consultar seguimiento de contratistas.' });
  }
});

// GET specific report by ID
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const report = db.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado.' });
      return;
    }

    if (req.user.rol === 'contratista' && report.contratistaId !== req.user.id) {
      res.status(403).json({ error: 'No tiene autorización para consultar este informe.' });
      return;
    }

    const contract = db.getContractById(report.contratoId) || null;

    if (req.user.rol === 'supervisor' && contract) {
      const supDoc = (req.user.numeroDocumento || '').trim();
      const supNombres = (req.user.nombres || '').trim().toLowerCase();
      const supApellidos = (req.user.apellidos || '').trim().toLowerCase();
      const docMatches = Boolean(contract.supervisorDocumento && contract.supervisorDocumento.trim() === supDoc);
      const nameMatches = Boolean(
        (contract.supervisorResponsable && contract.supervisorResponsable.toLowerCase().includes(supApellidos)) ||
        (contract.supervisorResponsable && contract.supervisorResponsable.toLowerCase().includes(supNombres))
      );
      if (!docMatches && !nameMatches) {
        res.status(403).json({ error: 'No tiene autorización para supervisar este contrato.' });
        return;
      }
    }

    const rawContractor = db.getUserById(report.contratistaId);
    const contractor = rawContractor ? sanitizeUser(rawContractor) : null;

    res.json({
      report,
      contract,
      contractor,
      supervisorEmail: contract ? findSupervisorEmail(contract) : '',
    });
  } catch (error) {
    console.error('Get report by ID error:', error);
    res.status(500).json({ error: 'Error al consultar el informe.' });
  }
});

// DOWNLOAD OFFICIAL PDF
router.get('/:id/pdf', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const report = db.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado.' });
      return;
    }

    if (req.user.rol === 'contratista' && report.contratistaId !== req.user.id) {
      res.status(403).json({ error: 'No tiene autorización para descargar este documento.' });
      return;
    }

    const contract = db.getContractById(report.contratoId);
    const contractor = db.getUserById(report.contratistaId);

    if (!contract || !contractor) {
      res.status(404).json({ error: 'No se encontraron los datos del contrato o contratista asociado.' });
      return;
    }

    const safeName = report.numeroRadicacion
      ? report.numeroRadicacion.replace(/[^a-zA-Z0-9_-]/g, '_')
      : contract.numeroContrato.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Acta_Supervision_No_${report.numeroActa || 1}_${safeName}.pdf`;

    // Conservar documentos anteriores ya generados y almacenados antes del cambio de plantilla
    const isLegacyReport = Boolean(report.createdAt && report.createdAt < '2026-11-17T00:00:00Z');
    if (isLegacyReport && report.archivoPdfPath && fs.existsSync(report.archivoPdfPath)) {
      const legacyPdf = fs.readFileSync(report.archivoPdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', legacyPdf.length);
      res.send(legacyPdf);
      return;
    }

    const pdfBytes = await generateActaSupervisionPdf(report, contract, contractor);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: error.message || 'Error al generar el archivo PDF oficial.' });
  }
});

// DOWNLOAD EDITABLE WORD (.DOCX) - ACTA DE SUPERVISIÓN + INFORME DE ACTIVIDADES
router.get('/:id/docx', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const report = db.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado.' });
      return;
    }

    if (req.user.rol === 'contratista' && report.contratistaId !== req.user.id) {
      res.status(403).json({ error: 'No tiene autorización para descargar este documento.' });
      return;
    }

    const contract = db.getContractById(report.contratoId);
    const contractor = db.getUserById(report.contratistaId);

    if (!contract || !contractor) {
      res.status(404).json({ error: 'No se encontraron los datos del contrato o contratista asociado.' });
      return;
    }

    const safeName = report.numeroRadicacion
      ? report.numeroRadicacion.replace(/[^a-zA-Z0-9_-]/g, '_')
      : contract.numeroContrato.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Acta_Supervision_No_${report.numeroActa || 1}_${safeName}.docx`;

    const docxBuffer = await generateActaYInformeDocx(report, contract, contractor);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.send(docxBuffer);
  } catch (error: any) {
    console.error('Generate DOCX error:', error);
    res.status(500).json({ error: error.message || 'Error al generar el documento Word oficial.' });
  }
});

// CREATE or DRAFT REPORT
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const {
      contratoId,
      periodo,
      fechaInicioPeriodo,
      fechaFinPeriodo,
      actividades,
      logros,
      dificultades,
      radicar,
      aportesSeguridadSocial,
    } = req.body;

    if (!contratoId || !periodo || !fechaInicioPeriodo || !fechaFinPeriodo) {
      res.status(400).json({ error: 'Debe especificar el contrato, el período y las fechas de ejecución.' });
      return;
    }

    const contract = db.getContractById(contratoId);
    if (!contract) {
      res.status(404).json({ error: 'El contrato especificado no existe.' });
      return;
    }

    if (req.user.rol === 'contratista' && contract.contratistaId !== req.user.id) {
      res.status(403).json({ error: 'No puede radicar informes para contratos que no le pertenecen.' });
      return;
    }

    const now = new Date().toISOString();
    const isRadicado = Boolean(radicar);

    // Calculate Acta number based on existing reports for this contract
    const existingReports = db.getReportsByContractor(contract.contratistaId).filter((r) => r.contratoId === contract.id);
    const nextActaNo = existingReports.length + 1;

    // Financial calculations and automatic duration-based progress percentages
    const { financiero, historialActasConcepto } = calculateActaFinancieroYAvance(
      contract,
      String(fechaInicioPeriodo).trim(),
      String(fechaFinPeriodo).trim(),
      nextActaNo
    );

    const defaultCheck = { resultado: 'Cumple' as const, observaciones: '' };

    const newReport: ActivityReport = {
      id: `report-${crypto.randomUUID()}`,
      contratoId: contract.id,
      numeroContrato: contract.numeroContrato,
      contratistaId: contract.contratistaId,
      contratistaNombre: contract.contratistaNombre,
      periodo: String(periodo).trim(),
      fechaInicioPeriodo: String(fechaInicioPeriodo).trim(),
      fechaFinPeriodo: String(fechaFinPeriodo).trim(),
      numeroActa: nextActaNo,
      lugarFechaActa: `${contract.lugarEjecucion || 'QUIMBAYA, QUINDÍO'}, ${new Date().toLocaleDateString('es-CO')}`.toUpperCase(),
      actividades: Array.isArray(actividades) ? actividades : [],
      logros: logros ? String(logros).trim() : '',
      dificultades: dificultades ? String(dificultades).trim() : '',
      estado: isRadicado ? 'Radicado' : 'Borrador',
      fechaRadicacion: isRadicado ? now : undefined,
      historialEstados: [
        {
          estado: isRadicado ? 'Radicado' : 'Borrador',
          fecha: now,
          usuario: `${req.user.nombres} ${req.user.apellidos}`,
          observaciones: isRadicado ? 'Radicación de informe mensual y solicitud de supervisión.' : 'Creación de borrador.',
        },
      ],
      financiero,
      verificacionIntegral: {
        tecnico: { ...defaultCheck },
        administrativo: { ...defaultCheck },
        financiero: { ...defaultCheck },
        contable: { ...defaultCheck },
        juridico: { ...defaultCheck },
        bienesRecibidos: { ...defaultCheck },
        bienesPendientes: { ...defaultCheck },
        informesPresentados: { ...defaultCheck },
      },
      controlNovedades: {
        retrasos: { ...defaultCheck },
        requerimientos: { ...defaultCheck },
        incumplimiento: { ...defaultCheck },
        ajusteCronograma: { ...defaultCheck },
        suspensionProrroga: { ...defaultCheck },
        riesgos: { ...defaultCheck },
      },
      controlPrincipios: {
        cumplimientoObligaciones: { ...defaultCheck },
        correspondenciaActividades: { ...defaultCheck },
        soportesSuficientes: { ...defaultCheck },
        observanciaPrincipios: { ...defaultCheck },
        situacionesRequerimiento: { ...defaultCheck },
      },
      analisisPago: {
        relacionObligaciones: { verificacion: 'SI', observaciones: '' },
        productosRevisados: { verificacion: 'SI', observaciones: '' },
        soportesSuficientes: { verificacion: 'SI', observaciones: '' },
        seguridadSocialVerificada: { verificacion: 'SI', observaciones: '' },
        procedeReconocimiento: { verificacion: 'SI', observaciones: '' },
      },
      conceptoGeneral: 'Satisfactorio',
      conclusionSeguimiento: `Una vez revisadas las obligaciones contractuales, las actividades ejecutadas, los productos entregados y los soportes documentales, se deja constancia de que la ejecución del contrato durante el periodo comprendido entre el ${fechaInicioPeriodo} y el ${fechaFinPeriodo} fue SATISFACTORIA y procede el trámite del pago correspondiente. No se presentaron observaciones adicionales ni novedades que afectaran la ejecución contractual.`,
      cumplimientoObjeto: 'Se cumplió satisfactoriamente el objeto contractual durante el periodo informado.',
      recursosUtilizados: `Los recursos suministrados por la ${contract.entidadContratante || 'Alcaldía Municipal'}.`,
      evidenciasEjecucion: 'Informe de actividades, productos y evidencias publicadas en la plataforma SECOP II.',
      historialActasConcepto,
      aportesSeguridadSocial: Array.isArray(aportesSeguridadSocial) ? aportesSeguridadSocial : [],
      createdAt: now,
      updatedAt: now,
    };

    db.addReport(newReport);

    if (isRadicado) {
      const contractor = db.getUserById(newReport.contratistaId) || req.user;
      await executeRadicacionWorkflow(newReport, contract, contractor, req, res);
      return;
    }

    res.status(201).json({
      message: 'Borrador guardado exitosamente. Puede continuar diligenciándolo después.',
      report: newReport,
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Error al registrar el informe.' });
  }
});

// UPDATE or SAVE DRAFT
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const report = db.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado.' });
      return;
    }

    if (req.user.rol === 'contratista') {
      if (report.contratistaId !== req.user.id) {
        res.status(403).json({ error: 'No autorizado para modificar este informe.' });
        return;
      }
      if (report.estado === 'Aprobado') {
        res.status(400).json({ error: 'No es posible modificar un acta que ya fue aprobada por la supervisión.' });
        return;
      }
    }

    const updates = { ...req.body };
    const shouldRadicar = Boolean(updates.radicar);
    delete updates.radicar; // Handled by workflow

    const contract = db.getContractById(report.contratoId);
    if (contract) {
      const pStart = updates.fechaInicioPeriodo || report.fechaInicioPeriodo;
      const pEnd = updates.fechaFinPeriodo || report.fechaFinPeriodo;
      const calcResult = calculateActaFinancieroYAvance(
        contract,
        pStart,
        pEnd,
        report.numeroActa || 1,
        report.id
      );
      updates.financiero = calcResult.financiero;
      updates.historialActasConcepto = calcResult.historialActasConcepto;
    }

    const updated = db.updateReport(report.id, updates);
    if (!updated) {
      res.status(500).json({ error: 'Error al actualizar el informe.' });
      return;
    }

    if (shouldRadicar) {
      if (!contract) {
        res.status(404).json({ error: 'Contrato no encontrado para radicar.' });
        return;
      }
      const contractor = db.getUserById(updated.contratistaId) || req.user;
      await executeRadicacionWorkflow(updated, contract, contractor, req, res);
      return;
    }

    res.json({
      message: 'Cambios guardados con éxito.',
      report: updated,
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Error al actualizar el informe.' });
  }
});

// DEDICATED RADICAR ENDPOINT (Generates official 8-page PDF, verifies, and assigns radicación sequence)
router.post('/:id/radicar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    const report = db.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado.' });
      return;
    }

    if (req.user.rol === 'contratista' && report.contratistaId !== req.user.id) {
      res.status(403).json({ error: 'No tiene autorización para radicar este informe.' });
      return;
    }

    const contract = db.getContractById(report.contratoId);
    const contractor = db.getUserById(report.contratistaId);

    if (!contract || !contractor) {
      res.status(404).json({ error: 'No se encontraron los datos del contrato o contratista asociado.' });
      return;
    }

    // If client sent updated draft fields with the radication request, apply them first
    if (req.body && Object.keys(req.body).length > 0) {
      const { radicar, ...otherUpdates } = req.body;
      if (Object.keys(otherUpdates).length > 0) {
        db.updateReport(report.id, otherUpdates);
      }
    }

    const freshReport = db.getReportById(req.params.id)!;
    await executeRadicacionWorkflow(freshReport, contract, contractor, req, res);
  } catch (error: any) {
    console.error('Error on /:id/radicar:', error);
    res.status(500).json({ error: error.message || 'Error al procesar la radicación del acta.' });
  }
});

// SUPERVISOR REVIEW & APPROVAL (SUPERVISOR ONLY)
router.post('/:id/review', requireAuth, requireSupervisor, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const report = db.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado.' });
      return;
    }

    const {
      decision, // 'Aprobado' | 'Devuelto' | 'En revisión'
      observaciones,
      verificacionIntegral,
      controlNovedades,
      controlPrincipios,
      analisisPago,
      conceptoGeneral,
      conclusionSeguimiento,
    } = req.body;

    if (!decision || (decision !== 'Aprobado' && decision !== 'Devuelto' && decision !== 'En revisión')) {
      res.status(400).json({ error: 'La decisión debe ser "Aprobado", "Devuelto" o "En revisión".' });
      return;
    }

    const now = new Date().toISOString();
    const history = report.historialEstados || [];
    history.push({
      estado: decision,
      fecha: now,
      usuario: `${req.user.nombres} ${req.user.apellidos}`,
      observaciones: observaciones ? String(observaciones).trim() : '',
    });

    const reportUpdates: Partial<ActivityReport> = {
      estado: decision,
      observacionesSupervisor: observaciones ? String(observaciones).trim() : report.observacionesSupervisor,
      fechaRevision: now,
      revisadoPor: `${req.user.nombres} ${req.user.apellidos}`,
      historialEstados: history,
      ...(verificacionIntegral ? { verificacionIntegral } : {}),
      ...(controlNovedades ? { controlNovedades } : {}),
      ...(controlPrincipios ? { controlPrincipios } : {}),
      ...(analisisPago ? { analisisPago } : {}),
      ...(conceptoGeneral ? { conceptoGeneral } : {}),
      ...(conclusionSeguimiento ? { conclusionSeguimiento } : {}),
    };

    const updated = db.updateReport(report.id, reportUpdates);

    // If approved, create or update payment certification
    if (decision === 'Aprobado') {
      const contract = db.getContractById(report.contratoId);
      if (contract) {
        const existingPay = db.getPayments().find((p) => p.informeId === report.id);
        if (!existingPay) {
          db.addPayment({
            id: `pay-${crypto.randomUUID()}`,
            contratoId: contract.id,
            numeroContrato: contract.numeroContrato,
            contratistaId: contract.contratistaId,
            contratistaNombre: contract.contratistaNombre,
            periodo: report.periodo,
            valor: contract.honorariosMensuales,
            informeId: report.id,
            estado: 'Certificado por supervisión',
            fechaCertificacion: now.slice(0, 10),
            referenciaPago: `ACTA-SUP-${report.numeroActa || 2}-${contract.numeroContrato.replace(/[^a-zA-Z0-9]/g, '')}`,
            createdAt: now,
          });
        } else {
          db.updatePayment(existingPay.id, {
            estado: 'Certificado por supervisión',
            fechaCertificacion: now.slice(0, 10),
          });
        }
      }
    }

    db.addAuditLog({
      usuarioId: req.user.id,
      usuarioNombre: `${req.user.nombres} ${req.user.apellidos}`,
      usuarioRol: req.user.rol,
      accion:
        decision === 'Aprobado'
          ? 'APROBACION_ACTA_SUPERVISION'
          : decision === 'Devuelto'
          ? 'DEVOLUCION_ACTA_SUPERVISION'
          : 'REVISION_ACTA_SUPERVISION',
      modulo: 'informes',
      detalles: `El ${req.user.rol} ${req.user.nombres} ${req.user.apellidos} emitió decisión "${decision}" para el informe/acta ${report.numeroContrato} (Período: ${report.periodo}). Observaciones: ${observaciones || 'Sin observaciones adicionales'}.`,
      ip: req.ip,
    });

    res.json({
      message:
        decision === 'Aprobado'
          ? 'Acta de supervisión aprobada formalmente y certificada para desembolso de pago.'
          : decision === 'Devuelto'
          ? 'Acta devuelta al contratista con las observaciones para que realice los ajustes.'
          : 'Acta guardada en estado de revisión técnica.',
      report: updated,
    });
  } catch (error) {
    console.error('Review report error:', error);
    res.status(500).json({ error: 'Error al procesar la revisión del informe.' });
  }
});

export default router;
