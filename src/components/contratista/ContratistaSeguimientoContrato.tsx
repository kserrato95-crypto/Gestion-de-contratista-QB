import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { Contract, ActivityReport } from '../../types/index.js';
import {
  ContractProgressTracker,
  getContractProgressTracker,
  calculateDetailedDuration,
} from '../../utils/contractDuration.js';
import { Badge } from '../common/Badge.js';
import { GoogleSheetsExportModal } from '../common/GoogleSheetsExportModal.js';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileCheck2,
  DollarSign,
  TrendingUp,
  Briefcase,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CalendarClock,
  Shield,
} from 'lucide-react';

interface ContratistaSeguimientoContratoProps {
  onNavigate?: (section: string) => void;
  onOpenNewReport?: () => void;
}

export const ContratistaSeguimientoContrato: React.FC<ContratistaSeguimientoContratoProps> = ({
  onNavigate,
  onOpenNewReport,
}) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contractsRes, reportsRes] = await Promise.all([
          apiRequest<{ contracts: Contract[] }>('/api/contracts').catch(() => ({ contracts: [] })),
          apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] })),
        ]);

        const contractList = contractsRes?.contracts || [];
        const active = contractList.find((c) => c.estado === 'Activo') || contractList[0] || null;
        setContract(active);
        setReports(reportsRes?.reports || []);
      } catch (err) {
        console.error('Error fetching contractor contract tracking:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
        <Clock className="w-8 h-8 text-blue-900 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-800">Cargando seguimiento contractual...</p>
        <p className="text-xs text-slate-400 mt-1">Calculando días calendario y cronograma de 30 días...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-amber-700" />
        </div>
        <h2 className="text-lg font-bold text-amber-950">Sin Contrato Asignado</h2>
        <p className="text-sm text-amber-900 leading-relaxed font-medium">
          Actualmente no tienes un contrato activo para realizar seguimiento. Tan pronto la supervisión registre tu contrato podrás consultar tu cronograma por días calendario.
        </p>
      </div>
    );
  }

  const tracking: ContractProgressTracker = getContractProgressTracker(contract, reports);
  const detailed = calculateDetailedDuration(contract.fechaInicio, contract.fechaFin);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-900">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            Seguimiento de mi Contrato • Control por Días Calendario
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1">
            {contract.numeroContrato}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Supervisor institucional: <strong className="text-slate-800">{contract.supervisorResponsable}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge status={contract.estado} />
          <button
            onClick={() => setSheetsModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            Sincronizar con Google Sheets
          </button>
        </div>
      </div>

      {/* 1. DURATION & DAYS COUNTER HERO CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Duración total</span>
            <Clock className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono">
            {tracking.totalDias} <span className="text-xs font-sans text-slate-500">días</span>
          </div>
          <p className="text-[11px] text-blue-900 font-semibold mt-1 truncate">
            {tracking.duracionTexto}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Días transcurridos</span>
            <Calendar className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono">
            {tracking.diasTranscurridos} <span className="text-xs font-sans text-slate-500">días</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Desde {formatDate(tracking.fechaInicio)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Días restantes</span>
            <CalendarClock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono">
            {tracking.diasRestantes} <span className="text-xs font-sans text-slate-500">días</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Hasta {formatDate(tracking.fechaFin)}
          </p>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${
          tracking.proximaEntrega?.estaVencida
            ? 'bg-rose-50 border-rose-200'
            : 'bg-blue-50/60 border-blue-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={tracking.proximaEntrega?.estaVencida ? 'text-rose-800' : 'text-blue-900'}>
              Próxima entrega
            </span>
            {tracking.proximaEntrega?.estaVencida ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <FileCheck2 className="w-4 h-4 text-blue-700" />
            )}
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-slate-900">
            {tracking.proximaEntrega ? `Acta N.º ${tracking.proximaEntrega.numeroActa}` : 'Al día'}
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {tracking.proximaEntrega
              ? tracking.proximaEntrega.estaVencida
                ? `Vencida hace ${tracking.proximaEntrega.diasRestantesParaCorte} días (${tracking.proximaEntrega.fechaCorteFormato})`
                : `Corte: ${tracking.proximaEntrega.fechaCorteFormato} (${tracking.proximaEntrega.diasRestantesParaCorte}d restantes)`
              : 'Todas las actas entregadas'}
          </p>
        </div>
      </div>

      {/* 2. PROGRESS BARS: TIME vs FINANCIAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Avance en tiempo (3 capas: Programado, Presentado, Aprobado) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-900" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Avance en Tiempo Contractual
              </h3>
            </div>
            <span className="text-xs font-bold text-blue-900 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {tracking.porcentajeAvanceTiempoProgramado.toFixed(2)}% transcurrido
            </span>
          </div>

          {/* Visual progress bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${tracking.porcentajeAvanceTiempoAprobado}%` }}
                className="bg-emerald-600 transition-all duration-500"
                title={`Aprobado: ${tracking.porcentajeAvanceTiempoAprobado.toFixed(2)}%`}
              />
              <div
                style={{
                  width: `${Math.max(
                    0,
                    tracking.porcentajeAvanceTiempoPresentado - tracking.porcentajeAvanceTiempoAprobado
                  )}%`,
                }}
                className="bg-blue-500 transition-all duration-500"
                title={`En revisión / radicado: ${(
                  tracking.porcentajeAvanceTiempoPresentado - tracking.porcentajeAvanceTiempoAprobado
                ).toFixed(2)}%`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>Aprobado: <strong className="text-slate-800">{tracking.porcentajeAvanceTiempoAprobado.toFixed(2)}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                <span>Presentado: <strong className="text-slate-800">{tracking.porcentajeAvanceTiempoPresentado.toFixed(2)}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                <span>Programado: <strong className="text-slate-800">{tracking.porcentajeAvanceTiempoProgramado.toFixed(2)}%</strong></span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
            Fórmula institucional: Avance = (días calendario cubiertos / {tracking.totalDias} días totales) × 100.
          </p>
        </div>

        {/* Avance financiero independiente */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Avance Financiero Independiente
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-800 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {tracking.porcentajeAvanceFinancieroAprobado.toFixed(2)}% certificado
            </span>
          </div>

          {/* Visual progress bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${tracking.porcentajeAvanceFinancieroAprobado}%` }}
                className="bg-emerald-600 transition-all duration-500"
                title={`Certificado: ${tracking.porcentajeAvanceFinancieroAprobado.toFixed(2)}%`}
              />
              <div
                style={{
                  width: `${Math.max(
                    0,
                    tracking.porcentajeAvanceFinancieroPresentado - tracking.porcentajeAvanceFinancieroAprobado
                  )}%`,
                }}
                className="bg-amber-400 transition-all duration-500"
                title={`En trámite: ${(
                  tracking.porcentajeAvanceFinancieroPresentado - tracking.porcentajeAvanceFinancieroAprobado
                ).toFixed(2)}%`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">Valor Pagado:</span>
                <span className="font-mono font-bold text-slate-900">{formatCOP(tracking.valorPagadoALaFecha)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">En Revisión:</span>
                <span className="font-mono font-semibold text-blue-900">{formatCOP(tracking.valorPresentadoEnRevision)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Saldo por Pagar:</span>
                <span className="font-mono font-bold text-amber-700">{formatCOP(tracking.saldoPorPagar)}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
            Valor total actualizado: <strong className="text-slate-800 font-mono">{formatCOP(tracking.valorTotalContrato)}</strong>
          </p>
        </div>
      </div>

      {/* 3. ACTAS STATUS BADGES COUNTERS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Resumen de Actas de Supervisión Contractual
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="text-[11px] text-slate-500 block">Programadas</span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {tracking.actasStats.totalProgramadas}
            </span>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
            <span className="text-[11px] text-blue-800 block">Presentadas</span>
            <span className="text-xl font-bold font-mono text-blue-900">
              {tracking.actasStats.presentadas}
            </span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
            <span className="text-[11px] text-emerald-800 block">Aprobadas</span>
            <span className="text-xl font-bold font-mono text-emerald-900">
              {tracking.actasStats.aprobadas}
            </span>
          </div>

          <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-center">
            <span className="text-[11px] text-rose-800 block">Devueltas</span>
            <span className="text-xl font-bold font-mono text-rose-900">
              {tracking.actasStats.devueltas}
            </span>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
            <span className="text-[11px] text-amber-800 block">Pendientes</span>
            <span className="text-xl font-bold font-mono text-amber-900">
              {tracking.actasStats.pendientes}
            </span>
          </div>
        </div>
      </div>

      {/* 4. CRONOGRAMA INTERACTIVO DE PERÍODOS DE 30 DÍAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-900" />
              Cronograma de Períodos de 30 Días Calendario
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cada período cuenta 30 días calendario consecutivos desde el inicio; el último período se ajusta a los días restantes.
            </p>
          </div>

          {onOpenNewReport && (
            <button
              onClick={onOpenNewReport}
              className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
            >
              Radicar Informe del Período
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Acta</th>
                <th className="px-4 py-3">Días Contractuales</th>
                <th className="px-4 py-3">Fechas del Período</th>
                <th className="px-4 py-3 text-center">Duración</th>
                <th className="px-4 py-3 text-right">% Período</th>
                <th className="px-4 py-3 text-right">% Acumulado</th>
                <th className="px-4 py-3 text-right">Valor Asignado</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Radicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tracking.periodos.map((p) => {
                const isApproved = p.estadoActa === 'Aprobado';
                const isOverdue = p.estaVencido;

                return (
                  <tr
                    key={p.numeroActa}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isOverdue ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-900">
                      Acta {p.numeroActa}
                      {p.esUltimoPeriodo && (
                        <span className="block text-[10px] font-sans font-medium text-amber-700">
                          (Último período)
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-800">
                      Días {p.diaInicio} al {p.diaFin}
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                      {p.fechaInicioPeriodo} al {p.fechaFinPeriodo}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-800">
                        {p.diasPeriodo} días
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-900">
                      {p.porcentajeAvanceTiempo.toFixed(2)}%
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                      {p.porcentajeAvanceTiempoAcumulado.toFixed(2)}%
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-emerald-800 font-medium">
                      {p.valorPagoPeriodo ? formatCOP(p.valorPagoPeriodo) : 'Por calcular'}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {p.estadoActa === 'Aprobado' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Aprobada
                        </span>
                      )}
                      {(p.estadoActa === 'Radicado' || p.estadoActa === 'En revisión') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          <Clock className="w-3 h-3" /> En revisión
                        </span>
                      )}
                      {p.estadoActa === 'Devuelto' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          <AlertTriangle className="w-3 h-3" /> Devuelta
                        </span>
                      )}
                      {p.estadoActa === 'Borrador' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          Borrador
                        </span>
                      )}
                      {p.estadoActa === 'Vencido' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900">
                          <AlertTriangle className="w-3 h-3" /> Vencida
                        </span>
                      )}
                      {p.estadoActa === 'Pendiente' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Pendiente
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                      {p.numeroRadicacion ? (
                        <span className="font-semibold text-slate-900">{p.numeroRadicacion}</span>
                      ) : (
                        <span className="text-slate-400">Sin radicar</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200 text-[11px]">
              <tr>
                <td colSpan={3} className="px-4 py-3 uppercase tracking-wider">
                  Total días y cierre acumulado
                </td>
                <td className="px-4 py-3 text-center font-mono text-blue-900">
                  {tracking.totalDias} días
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue-900">
                  100.00%
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-800">
                  100.00%
                </td>
                <td colSpan={3} className="px-4 py-3 text-right text-slate-500 font-normal">
                  Cálculo estricto en días calendario
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Google Sheets export modal */}
      <GoogleSheetsExportModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        reports={reports}
        contracts={contract ? [contract] : []}
      />
    </div>
  );
};
