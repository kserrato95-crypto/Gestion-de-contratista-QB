import { Contract, ActivityReport } from '../db.js';

/**
 * Parses YYYY-MM-DD string into a safe UTC Date object (prevents timezone offset bugs)
 */
export function parseYMD(dStr?: string): Date {
  if (!dStr) return new Date();
  const clean = dStr.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats a Date object to DD/MM/YYYY
 */
export function formatSlashDMY(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Adds or subtracts days in UTC
 */
export function addDays(d: Date, days: number): Date {
  const res = new Date(d.getTime());
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

/**
 * Calculates total inclusive calendar days between two dates.
 * Both start and end dates are included (e.g., April 1 to April 30 = 30 days).
 */
export function calculateTotalDays(startStr?: string, endStr?: string): number {
  if (!startStr || !endStr) return 0;
  const start = parseYMD(startStr);
  const end = parseYMD(endStr);
  if (end.getTime() < start.getTime()) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export interface DetailedDuration {
  totalDias: number;
  meses: number;
  dias: number;
  texto: string;
  diasTranscurridos: number;
  diasRestantes: number;
  fechaInicio: string;
  fechaFin: string;
}

/**
 * Calculates contract duration strictly in real calendar days,
 * and formats an informative display text in months and days.
 * Includes both start date and end date.
 * Examples:
 * - 95 days: "3 meses y 5 días" (95 días)
 * - 30 days: "1 mes completo" (30 días)
 * - 45 days: "1 mes y 15 días" (45 días)
 */
export function calculateDetailedDuration(
  startStr?: string,
  endStr?: string,
  referenceDate: Date = new Date()
): DetailedDuration {
  if (!startStr || !endStr) {
    return {
      totalDias: 0,
      meses: 0,
      dias: 0,
      texto: '0 días',
      diasTranscurridos: 0,
      diasRestantes: 0,
      fechaInicio: '',
      fechaFin: '',
    };
  }

  const start = parseYMD(startStr);
  const end = parseYMD(endStr);
  if (end.getTime() < start.getTime()) {
    return {
      totalDias: 0,
      meses: 0,
      dias: 0,
      texto: '0 días',
      diasTranscurridos: 0,
      diasRestantes: 0,
      fechaInicio: startStr,
      fechaFin: endStr,
    };
  }

  const totalDias = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  // Informative calculation in months (approx 30 days per month) and remaining days
  const meses = Math.floor(totalDias / 30);
  const dias = totalDias % 30;

  let texto = '';
  if (meses > 0 && dias > 0) {
    const mesesLabel = meses === 1 ? '1 mes' : `${meses} meses`;
    const diasLabel = dias === 1 ? '1 día' : `${dias} días`;
    texto = `${mesesLabel} y ${diasLabel}`;
  } else if (meses > 0 && dias === 0) {
    texto = meses === 1 ? '1 mes completo' : `${meses} meses completos`;
  } else {
    texto = dias === 1 ? '1 día' : `${dias} días`;
  }

  // Elapsed and remaining days
  const nowUtc = new Date(
    Date.UTC(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    )
  );

  let diasTranscurridos = 0;
  let diasRestantes = totalDias;

  if (nowUtc.getTime() < start.getTime()) {
    diasTranscurridos = 0;
    diasRestantes = totalDias;
  } else if (nowUtc.getTime() > end.getTime()) {
    diasTranscurridos = totalDias;
    diasRestantes = 0;
  } else {
    diasTranscurridos = Math.min(
      totalDias,
      Math.max(1, Math.round((nowUtc.getTime() - start.getTime()) / 86400000) + 1)
    );
    diasRestantes = Math.max(0, Math.round((end.getTime() - nowUtc.getTime()) / 86400000));
  }

  return {
    totalDias,
    meses,
    dias,
    texto,
    diasTranscurridos,
    diasRestantes,
    fechaInicio: startStr,
    fechaFin: endStr,
  };
}

export interface ContractPeriod {
  numeroActa: number;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  periodoTexto: string;
  diasPeriodo: number;
  diaInicio: number;
  diaFin: number;
  porcentajeAvanceTiempo: number;
  porcentajeAvanceTiempoAcumulado: number;
  esUltimoPeriodo: boolean;
}

/**
 * REGLA FUNDAMENTAL:
 * Generates consecutive 30 calendar-day periods from contract start date.
 * Each period spans exactly 30 calendar days (inclusive), and the final period
 * adjusts automatically to the remaining days of the contract.
 *
 * Example (95 days):
 * - Acta 1: days 1 to 30 (30d) -> 31.58% (Acum: 31.58%)
 * - Acta 2: days 31 to 60 (30d) -> 31.58% (Acum: 63.16%)
 * - Acta 3: days 61 to 90 (30d) -> 31.58% (Acum: 94.74%)
 * - Acta 4: days 91 to 95 (5d) -> 5.26% (Acum: 100.00%)
 */
export function getContractPeriods(startStr: string, endStr: string): ContractPeriod[] {
  if (!startStr || !endStr) return [];
  const start = parseYMD(startStr);
  const end = parseYMD(endStr);
  if (end.getTime() < start.getTime()) return [];

  const totalDias = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const periods: ContractPeriod[] = [];
  let curr = new Date(start.getTime());
  let actaNo = 1;
  let dayOffset = 1;
  let prevPctAccum = 0;

  while (curr.getTime() <= end.getTime()) {
    // 30 calendar days inclusive = start + 29 days
    const tentativeEnd = addDays(curr, 29);
    const isLast = tentativeEnd.getTime() >= end.getTime();
    const pEnd = isLast ? new Date(end.getTime()) : tentativeEnd;
    const pDays = Math.max(1, Math.round((pEnd.getTime() - curr.getTime()) / 86400000) + 1);
    const dayEnd = dayOffset + pDays - 1;

    let pct: number;
    let pctAccum: number;

    if (isLast) {
      pct = Math.max(0, Math.round((100 - prevPctAccum) * 100) / 100);
      pctAccum = 100.0;
    } else {
      pct = Math.round((pDays / totalDias) * 10000) / 100;
      pctAccum = Math.min(100, Math.round((prevPctAccum + pct) * 100) / 100);
    }
    prevPctAccum = pctAccum;

    periods.push({
      numeroActa: actaNo,
      fechaInicioPeriodo: formatYMD(curr),
      fechaFinPeriodo: formatYMD(pEnd),
      periodoTexto: `${formatSlashDMY(curr)} - ${formatSlashDMY(pEnd)}`,
      diasPeriodo: pDays,
      diaInicio: dayOffset,
      diaFin: dayEnd,
      porcentajeAvanceTiempo: pct,
      porcentajeAvanceTiempoAcumulado: pctAccum,
      esUltimoPeriodo: isLast,
    });

    if (isLast) break;
    dayOffset += pDays;
    curr = addDays(pEnd, 1);
    actaNo++;
  }

  return periods;
}

export interface EnrichedPeriod extends ContractPeriod {
  reporteId?: string;
  estadoActa: 'Aprobado' | 'Radicado' | 'En revisión' | 'Devuelto' | 'Con observaciones' | 'Borrador' | 'Pendiente' | 'Vencido';
  numeroRadicacion?: string;
  fechaRadicacion?: string;
  valorPagoPeriodo?: number;
  estaVencido: boolean;
  diasDiferenciaCorte: number;
}

export interface ContractProgressTracker {
  fechaInicio: string;
  fechaFin: string;
  duracionTexto: string;
  totalDias: number;
  diasTranscurridos: number;
  diasRestantes: number;
  estadoContrato: 'Por iniciar' | 'En ejecución' | 'Finalizado';

  // Distinct Time Progress metrics
  porcentajeAvanceTiempoProgramado: number;
  porcentajeAvanceTiempoPresentado: number;
  porcentajeAvanceTiempoAprobado: number;

  // Distinct Financial Progress metrics
  valorTotalContrato: number;
  valorPagadoALaFecha: number;
  valorPresentadoEnRevision: number;
  saldoPorPagar: number;
  porcentajeAvanceFinancieroAprobado: number;
  porcentajeAvanceFinancieroPresentado: number;

  proximaEntrega: {
    numeroActa: number;
    fechaCorte: string;
    fechaCorteFormato: string;
    periodoTexto: string;
    diasPeriodo: number;
    diasRestantesParaCorte: number;
    estaVencida: boolean;
  } | null;

  estadoActaActual: {
    mensaje: string;
    tipo: 'pendiente' | 'borrador' | 'en_revision' | 'aprobado' | 'devuelto' | 'al_dia';
    numeroActa: number;
    estadoBadge: string;
  };

  actasStats: {
    totalProgramadas: number;
    presentadas: number;
    aprobadas: number;
    devueltas: number;
    borradores: number;
    pendientes: number;
  };

  periodos: EnrichedPeriod[];
}

export function getContractProgressTracker(
  contract: Contract,
  reports: ActivityReport[] = [],
  referenceDate: Date = new Date()
): ContractProgressTracker {
  const duration = calculateDetailedDuration(
    contract.fechaInicio,
    contract.fechaFin,
    referenceDate
  );

  const { totalDias, diasTranscurridos, diasRestantes, texto: duracionTexto } = duration;
  const cStart = parseYMD(contract.fechaInicio);
  const cEnd = parseYMD(contract.fechaFin);

  const nowUtc = new Date(
    Date.UTC(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    )
  );

  let estadoContrato: 'Por iniciar' | 'En ejecución' | 'Finalizado' = 'En ejecución';
  if (nowUtc.getTime() < cStart.getTime()) {
    estadoContrato = 'Por iniciar';
  } else if (nowUtc.getTime() > cEnd.getTime()) {
    estadoContrato = 'Finalizado';
  }

  const porcentajeAvanceTiempoProgramado =
    totalDias > 0 ? Math.min(100, Math.round((diasTranscurridos / totalDias) * 10000) / 100) : 0;

  const basePeriods = getContractPeriods(contract.fechaInicio, contract.fechaFin);
  const contractReports = reports.filter((r) => r.contratoId === contract.id);

  const reportsByActa = new Map<number, ActivityReport>();
  contractReports.forEach((r) => {
    if (r.numeroActa) {
      reportsByActa.set(r.numeroActa, r);
    }
  });

  let diasAprobados = 0;
  let diasPresentados = 0;
  let valorPagado = 0;
  let valorPresentado = 0;

  const enrichedPeriods: EnrichedPeriod[] = basePeriods.map((p) => {
    const rep = reportsByActa.get(p.numeroActa);
    const pEndDate = parseYMD(p.fechaFinPeriodo);
    const diasDiferenciaCorte = Math.round((pEndDate.getTime() - nowUtc.getTime()) / 86400000);
    const estaVencido = diasDiferenciaCorte < 0 && (!rep || rep.estado === 'Borrador' || rep.estado === 'Devuelto');

    let estadoActa: EnrichedPeriod['estadoActa'] = 'Pendiente';
    if (rep) {
      if (rep.estado === 'Aprobado') estadoActa = 'Aprobado';
      else if (rep.estado === 'Radicado' || rep.estado === 'En revisión') estadoActa = rep.estado;
      else if (rep.estado === 'Devuelto' || (rep.estado as string) === 'Con observaciones') estadoActa = 'Devuelto';
      else if (rep.estado === 'Borrador') estadoActa = 'Borrador';
    } else if (estaVencido) {
      estadoActa = 'Vencido';
    }

    if (rep?.estado === 'Aprobado') {
      diasAprobados += p.diasPeriodo;
      diasPresentados += p.diasPeriodo;
      valorPagado += Number(rep.financiero?.valorPresentePago || contract.honorariosMensuales || 0);
    } else if (rep?.estado === 'Radicado' || rep?.estado === 'En revisión') {
      diasPresentados += p.diasPeriodo;
      valorPresentado += Number(rep.financiero?.valorPresentePago || contract.honorariosMensuales || 0);
    }

    return {
      ...p,
      reporteId: rep?.id,
      estadoActa,
      numeroRadicacion: rep?.numeroRadicacion,
      fechaRadicacion: rep?.fechaRadicacion,
      valorPagoPeriodo: rep?.financiero?.valorPresentePago || (p.diasPeriodo === 30 ? contract.honorariosMensuales : undefined),
      estaVencido,
      diasDiferenciaCorte,
    };
  });

  const porcentajeAvanceTiempoAprobado =
    totalDias > 0 ? Math.min(100, Math.round((diasAprobados / totalDias) * 10000) / 100) : 0;
  const porcentajeAvanceTiempoPresentado =
    totalDias > 0 ? Math.min(100, Math.round((diasPresentados / totalDias) * 10000) / 100) : 0;

  const adicionales = (contract.modificaciones || []).reduce(
    (acc, m) => acc + (Number(m.valorAdicional) || 0),
    0
  );
  const valorTotalContrato = Math.round(((Number(contract.valorTotal) || 0) + adicionales) * 100) / 100;
  const saldoPorPagar = Math.max(0, Math.round((valorTotalContrato - valorPagado) * 100) / 100);

  const porcentajeAvanceFinancieroAprobado =
    valorTotalContrato > 0
      ? Math.min(100, Math.round((valorPagado / valorTotalContrato) * 10000) / 100)
      : 0;
  const porcentajeAvanceFinancieroPresentado =
    valorTotalContrato > 0
      ? Math.min(100, Math.round(((valorPagado + valorPresentado) / valorTotalContrato) * 10000) / 100)
      : 0;

  const totalProgramadas = enrichedPeriods.length;
  let aprobadas = 0;
  let presentadas = 0;
  let devueltas = 0;
  let borradores = 0;

  enrichedPeriods.forEach((p) => {
    if (p.estadoActa === 'Aprobado') aprobadas++;
    else if (p.estadoActa === 'Radicado' || p.estadoActa === 'En revisión') presentadas++;
    else if (p.estadoActa === 'Devuelto') devueltas++;
    else if (p.estadoActa === 'Borrador') borradores++;
  });

  const pendientes = Math.max(0, totalProgramadas - (aprobadas + presentadas + devueltas + borradores));

  let proximaEntrega = null;
  const nextPendingPeriod = enrichedPeriods.find(
    (p) => p.estadoActa !== 'Aprobado' && p.estadoActa !== 'Radicado' && p.estadoActa !== 'En revisión'
  ) || enrichedPeriods[enrichedPeriods.length - 1];

  if (nextPendingPeriod) {
    const pEndDate = parseYMD(nextPendingPeriod.fechaFinPeriodo);
    const diasRestantesParaCorte = Math.round((pEndDate.getTime() - nowUtc.getTime()) / 86400000);
    proximaEntrega = {
      numeroActa: nextPendingPeriod.numeroActa,
      fechaCorte: nextPendingPeriod.fechaFinPeriodo,
      fechaCorteFormato: formatSlashDMY(pEndDate),
      periodoTexto: nextPendingPeriod.periodoTexto,
      diasPeriodo: nextPendingPeriod.diasPeriodo,
      diasRestantesParaCorte: Math.abs(diasRestantesParaCorte),
      estaVencida: diasRestantesParaCorte < 0,
    };
  }

  let estadoActaActual = {
    mensaje: proximaEntrega
      ? `Acta N.º ${proximaEntrega.numeroActa} (${proximaEntrega.diasPeriodo} días) pendiente de radicación`
      : 'Todas las actas han sido programadas',
    tipo: 'pendiente' as 'pendiente' | 'borrador' | 'en_revision' | 'aprobado' | 'devuelto' | 'al_dia',
    numeroActa: proximaEntrega ? proximaEntrega.numeroActa : totalProgramadas,
    estadoBadge: 'Pendiente',
  };

  if (aprobadas === totalProgramadas && totalProgramadas > 0) {
    estadoActaActual = {
      mensaje: 'Todas las actas del contrato han sido aprobadas satisfactoriamente',
      tipo: 'al_dia',
      numeroActa: totalProgramadas,
      estadoBadge: 'Al día',
    };
  } else if (proximaEntrega) {
    const rep = reportsByActa.get(proximaEntrega.numeroActa);
    if (rep?.estado === 'Devuelto' || (rep?.estado as string) === 'Con observaciones') {
      estadoActaActual = {
        mensaje: `Acta N.º ${proximaEntrega.numeroActa} devuelta por supervisión para correcciones`,
        tipo: 'devuelto',
        numeroActa: proximaEntrega.numeroActa,
        estadoBadge: 'Devuelta',
      };
    } else if (rep?.estado === 'Radicado' || rep?.estado === 'En revisión') {
      estadoActaActual = {
        mensaje: `Acta N.º ${proximaEntrega.numeroActa} radicada formalmente, en revisión por supervisión`,
        tipo: 'en_revision',
        numeroActa: proximaEntrega.numeroActa,
        estadoBadge: rep.estado,
      };
    } else if (rep?.estado === 'Borrador') {
      estadoActaActual = {
        mensaje: `Acta N.º ${proximaEntrega.numeroActa} guardada como borrador, lista para radicar`,
        tipo: 'borrador',
        numeroActa: proximaEntrega.numeroActa,
        estadoBadge: 'Borrador',
      };
    } else if (proximaEntrega.estaVencida) {
      estadoActaActual = {
        mensaje: `Acta N.º ${proximaEntrega.numeroActa} presenta retraso de entrega contractual`,
        tipo: 'pendiente',
        numeroActa: proximaEntrega.numeroActa,
        estadoBadge: 'Vencida',
      };
    }
  }

  return {
    fechaInicio: contract.fechaInicio,
    fechaFin: contract.fechaFin,
    duracionTexto,
    totalDias,
    diasTranscurridos,
    diasRestantes,
    estadoContrato,
    porcentajeAvanceTiempoProgramado,
    porcentajeAvanceTiempoPresentado,
    porcentajeAvanceTiempoAprobado,
    valorTotalContrato,
    valorPagadoALaFecha: Math.round(valorPagado * 100) / 100,
    valorPresentadoEnRevision: Math.round(valorPresentado * 100) / 100,
    saldoPorPagar,
    porcentajeAvanceFinancieroAprobado,
    porcentajeAvanceFinancieroPresentado,
    proximaEntrega,
    estadoActaActual,
    actasStats: {
      totalProgramadas,
      presentadas,
      aprobadas,
      devueltas,
      borradores,
      pendientes,
    },
    periodos: enrichedPeriods,
  };
}
