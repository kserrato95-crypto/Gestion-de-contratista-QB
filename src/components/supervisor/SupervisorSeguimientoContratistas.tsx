import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate, formatDateDMY } from '../../lib/api.js';
import { Contract, ActivityReport } from '../../types/index.js';
import {
  ContractProgressTracker,
  getContractProgressTracker,
} from '../../utils/contractDuration.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { GoogleSheetsExportModal } from '../common/GoogleSheetsExportModal.js';
import {
  Users,
  Clock,
  Calendar,
  AlertTriangle,
  FileCheck2,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Search,
  Eye,
  CheckCircle2,
  CalendarClock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Landmark,
} from 'lucide-react';

interface SupervisorSeguimientoItem {
  contract: Contract;
  tracking: ContractProgressTracker;
}

export const SupervisorSeguimientoContratistas: React.FC = () => {
  const [items, setItems] = useState<SupervisorSeguimientoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'vencidos' | 'al_dia'>('todos');
  const [selectedItem, setSelectedItem] = useState<SupervisorSeguimientoItem | null>(null);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);
  const [allReports, setAllReports] = useState<ActivityReport[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ trackings: SupervisorSeguimientoItem[] }>(
        '/api/reports/seguimiento-todos'
      );
      setItems(res?.trackings || []);

      const repsRes = await apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] }));
      setAllReports(repsRes?.reports || []);
    } catch (err) {
      console.error('Error fetching supervisor trackings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = items.filter(({ contract, tracking }) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (contract.contratistaNombre || '').toLowerCase().includes(q) ||
      (contract.contratistaDocumento || '').includes(q) ||
      (contract.numeroContrato || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'vencidos') {
      return Boolean(tracking.proximaEntrega?.estaVencida);
    }
    if (statusFilter === 'al_dia') {
      return !tracking.proximaEntrega?.estaVencida;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-900">
            <Users className="w-4 h-4 text-amber-500" />
            Panel de Supervisión • Control Contractual por Días Calendario
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Seguimiento de Contratistas
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Monitoreo en tiempo real de días calendario, períodos de 30 días, avances y vencimientos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setSheetsModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            Sincronizar todo con Google Sheets
          </button>
        </div>
      </div>

      {/* KPI Global Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Contratos</span>
            <Users className="w-4 h-4 text-blue-900" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 font-mono">
            {items.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Bajo supervisión directa</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Al Día</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700 font-mono">
            {items.filter((i) => !i.tracking.proximaEntrega?.estaVencida).length}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">Sin retrasos contractuales</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Alertas de Vencimiento</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-700 font-mono">
            {items.filter((i) => i.tracking.proximaEntrega?.estaVencida).length}
          </div>
          <p className="text-[11px] text-rose-600 mt-1">Actas con corte superado</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Actas Pendientes</span>
            <CalendarClock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-700 font-mono">
            {items.reduce((acc, i) => acc + i.tracking.actasStats.pendientes, 0)}
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Por radicar en el sistema</p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por contratista, cédula o número de contrato..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'todos'
                ? 'bg-blue-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('al_dia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'al_dia'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Al día
          </button>
          <button
            onClick={() => setStatusFilter('vencidos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'vencidos'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Con alertas de retraso
          </button>
        </div>
      </div>

      {/* Main Contractors Tracking Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Contratista</th>
                <th className="px-4 py-3.5">No. Contrato</th>
                <th className="px-4 py-3.5">Duración (Días)</th>
                <th className="px-4 py-3.5">Transcurridos / Restantes</th>
                <th className="px-4 py-3.5 text-center">Avance Tiempo</th>
                <th className="px-4 py-3.5 text-center">Avance Financiero</th>
                <th className="px-4 py-3.5">Próxima Entrega</th>
                <th className="px-4 py-3.5 text-center">Actas (P / R / A)</th>
                <th className="px-4 py-3.5 text-right">Historial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-slate-500">
                    No se encontraron contratistas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredItems.map(({ contract, tracking }) => {
                  const isOverdue = tracking.proximaEntrega?.estaVencida;

                  return (
                    <tr
                      key={contract.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isOverdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Contratista */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">
                          {contract.contratistaNombre}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          CC {contract.contratistaDocumento}
                        </div>
                      </td>

                      {/* No. Contrato */}
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-900">
                        {contract.numeroContrato}
                        <div className="mt-1 block w-fit">
                          <Badge status={contract.estado} size="sm" />
                        </div>
                      </td>

                      {/* Duración */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-900">
                          {tracking.totalDias} días
                        </div>
                        <div className="text-[10px] text-blue-900 font-medium">
                          {tracking.duracionTexto}
                        </div>
                      </td>

                      {/* Transcurridos / Restantes */}
                      <td className="px-4 py-3.5">
                        <div className="text-slate-800">
                          <strong>{tracking.diasTranscurridos}d</strong> transcurridos
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          <strong>{tracking.diasRestantes}d</strong> restantes
                        </div>
                      </td>

                      {/* Avance Tiempo */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="font-mono font-bold text-blue-900">
                          {tracking.porcentajeAvanceTiempoAprobado.toFixed(1)}%
                        </div>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mt-1 overflow-hidden">
                          <div
                            style={{ width: `${tracking.porcentajeAvanceTiempoAprobado}%` }}
                            className="h-full bg-blue-600 rounded-full"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Prog: {tracking.porcentajeAvanceTiempoProgramado.toFixed(1)}%
                        </span>
                      </td>

                      {/* Avance Financiero */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="font-mono font-bold text-emerald-800">
                          {tracking.porcentajeAvanceFinancieroAprobado.toFixed(1)}%
                        </div>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mt-1 overflow-hidden">
                          <div
                            style={{ width: `${tracking.porcentajeAvanceFinancieroAprobado}%` }}
                            className="h-full bg-emerald-600 rounded-full"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {formatCOP(tracking.valorPagadoALaFecha)}
                        </span>
                      </td>

                      {/* Próxima Entrega */}
                      <td className="px-4 py-3.5">
                        {tracking.proximaEntrega ? (
                          isOverdue ? (
                            <div className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Acta {tracking.proximaEntrega.numeroActa} (Vencida {tracking.proximaEntrega.diasRestantesParaCorte}d)</span>
                            </div>
                          ) : (
                            <div className="text-[11px]">
                              <span className="font-semibold text-slate-800 block">
                                Acta {tracking.proximaEntrega.numeroActa}
                              </span>
                              <span className="text-slate-500">
                                {tracking.proximaEntrega.fechaCorteFormato} ({tracking.proximaEntrega.diasRestantesParaCorte}d)
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-medium">Al día</span>
                        )}
                      </td>

                      {/* Actas P / R / A */}
                      <td className="px-4 py-3.5 text-center font-mono text-[11px]">
                        <span className="text-slate-600" title="Programadas">
                          {tracking.actasStats.totalProgramadas}
                        </span>{' '}
                        /{' '}
                        <span className="text-blue-800 font-bold" title="Presentadas">
                          {tracking.actasStats.presentadas}
                        </span>{' '}
                        /{' '}
                        <span className="text-emerald-700 font-bold" title="Aprobadas">
                          {tracking.actasStats.aprobadas}
                        </span>
                      </td>

                      {/* Acción */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedItem({ contract, tracking })}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Consultar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL: FULL PERIOD SCHEDULE AND ACTAS HISTORY */}
      {selectedItem && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title={`Seguimiento Contractual • ${selectedItem.contract.numeroContrato}`}
          subtitle={`Contratista: ${selectedItem.contract.contratistaNombre} (CC ${selectedItem.contract.contratistaDocumento})`}
          maxWidth="4xl"
        >
          <div className="space-y-5 text-xs">
            {/* Top Cards in Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Duración Total:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {selectedItem.tracking.totalDias} días
                </span>
                <span className="block text-[10px] text-blue-900 font-medium">
                  {selectedItem.tracking.duracionTexto}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Vigencia:</span>
                <span className="font-semibold text-slate-900 block">
                  {formatDate(selectedItem.contract.fechaInicio)} al {formatDate(selectedItem.contract.fechaFin)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Días Transcurridos:</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedItem.tracking.diasTranscurridos}d ({selectedItem.tracking.porcentajeAvanceTiempoProgramado.toFixed(1)}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Días Restantes:</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedItem.tracking.diasRestantes}d
                </span>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <div>
                <span className="text-emerald-900 block text-[10px]">Valor Total:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCOP(selectedItem.tracking.valorTotalContrato)}
                </span>
              </div>
              <div>
                <span className="text-emerald-900 block text-[10px]">Honorarios Mensuales:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCOP(selectedItem.contract.honorariosMensuales)}
                </span>
              </div>
              <div>
                <span className="text-emerald-900 block text-[10px]">Valor Pagado / Certificado:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {formatCOP(selectedItem.tracking.valorPagadoALaFecha)} ({selectedItem.tracking.porcentajeAvanceFinancieroAprobado.toFixed(1)}%)
                </span>
              </div>
              <div>
                <span className="text-emerald-900 block text-[10px]">Saldo por Pagar:</span>
                <span className="font-mono font-bold text-amber-800">
                  {formatCOP(selectedItem.tracking.saldoPorPagar)}
                </span>
              </div>
            </div>

            {/* Budgetary Information (CDP / CRP) */}
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/80">
              <h4 className="font-bold text-blue-950 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-800" />
                Información Presupuestal del Contrato
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px]">CDP #:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedItem.contract.cdpNumero || 'No registrado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Fecha CDP:</span>
                  <span className="font-medium text-slate-900">
                    {selectedItem.contract.cdpFecha ? formatDateDMY(selectedItem.contract.cdpFecha) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CRP #:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedItem.contract.crpNumero || 'No registrado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Fecha CRP:</span>
                  <span className="font-medium text-slate-900">
                    {selectedItem.contract.crpFecha ? formatDateDMY(selectedItem.contract.crpFecha) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Schedule of 30-day periods */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-900" />
                Cronograma de Períodos de 30 Días e Historial de Actas
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Acta</th>
                      <th className="px-3 py-2">Rango Días</th>
                      <th className="px-3 py-2">Fechas Período</th>
                      <th className="px-3 py-2 text-center">Días</th>
                      <th className="px-3 py-2 text-right">% Período</th>
                      <th className="px-3 py-2 text-right">% Acumulado</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                      <th className="px-3 py-2 text-right">Radicación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedItem.tracking.periodos.map((p) => (
                      <tr key={p.numeroActa} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-blue-900">
                          Acta {p.numeroActa}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          Días {p.diaInicio} al {p.diaFin}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                          {p.fechaInicioPeriodo} a {p.fechaFinPeriodo}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {p.diasPeriodo}d
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-900">
                          {p.porcentajeAvanceTiempo.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">
                          {p.porcentajeAvanceTiempoAcumulado.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-center">
                          {p.estadoActa === 'Aprobado' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Aprobada
                            </span>
                          )}
                          {(p.estadoActa === 'Radicado' || p.estadoActa === 'En revisión') && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              En revisión
                            </span>
                          )}
                          {p.estadoActa === 'Devuelto' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              Devuelta
                            </span>
                          )}
                          {p.estadoActa === 'Vencido' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900">
                              Vencida
                            </span>
                          )}
                          {p.estadoActa === 'Pendiente' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {p.numeroRadicacion || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Google Sheets export modal */}
      <GoogleSheetsExportModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        reports={allReports}
        contracts={items.map((i) => i.contract)}
      />
    </div>
  );
};
