import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate, getStoredToken } from '../../lib/api.js';
import { ActivityReport } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import {
  FileCheck2,
  Search,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  ShieldAlert,
  Download,
  FileText,
} from 'lucide-react';

export const SupervisorInformes: React.FC = () => {
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected report for review modal
  const [selectedReport, setSelectedReport] = useState<ActivityReport | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] }));
      setReports(Array.isArray(res?.reports) ? res.reports : []);
    } catch (err) {
      console.error('Error loading reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleReview = async (decision: 'Aprobado' | 'Con observaciones') => {
    if (!selectedReport) return;
    if (decision === 'Con observaciones' && !observaciones.trim()) {
      setFeedbackMsg({
        type: 'error',
        text: 'Debe ingresar las observaciones y correcciones requeridas al contratista.',
      });
      return;
    }

    try {
      setProcessing(true);
      setFeedbackMsg(null);
      const res = await apiRequest<{ report: ActivityReport; message: string }>(
        `/api/reports/${selectedReport.id}/review`,
        {
          method: 'POST',
          data: {
            decision,
            observaciones: observaciones.trim(),
          },
        }
      );

      // Update local state
      setReports((prev) =>
        prev.map((r) => (r.id === res.report.id ? res.report : r))
      );
      setSelectedReport(res.report);
      setFeedbackMsg({ type: 'success', text: res.message });
      setObservaciones('');
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error al procesar la revisión.' });
    } finally {
      setProcessing(false);
    }
  };

  const filtered = reports.filter((r) => {
    const matchesStatus =
      statusFilter === 'todos' || r.estado.toLowerCase() === statusFilter.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      r.numeroContrato.toLowerCase().includes(q) ||
      r.contratistaNombre.toLowerCase().includes(q) ||
      r.periodo.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-900" />
            Informes de Actividades de Contratistas
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Revisión, validación de evidencias y aprobación formal para trámites de pago.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
          Radicados pendientes:{' '}
          <span className="font-bold text-amber-600">
            {reports.filter((r) => r.estado === 'Radicado').length}
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por contratista, contrato o período..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['todos', 'radicado', 'aprobado', 'con observaciones', 'borrador'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-blue-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Contrato</th>
                <th className="px-4 py-3.5">Radicación</th>
                <th className="px-4 py-3.5">Contratista</th>
                <th className="px-4 py-3.5">Período</th>
                <th className="px-4 py-3.5">Fecha Radicación</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    No se encontraron informes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const token = getStoredToken();
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-900">
                        {r.numeroContrato}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.numeroRadicacion ? (
                          <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                            {r.numeroRadicacion}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Sin radicar</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{r.contratistaNombre}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">{r.periodo}</td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {formatDate(r.fechaRadicacion)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge status={r.estado} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/api/reports/${r.id}/docx${token ? `?token=${token}` : ''}`}
                          download
                          className="px-2.5 py-1 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-300 transition-colors inline-flex items-center gap-1"
                          title="Descargar documento completo editable en Word (.DOCX)"
                        >
                          <FileText className="w-3 h-3 text-blue-700" />
                          Word
                        </a>
                        <a
                          href={`/api/reports/${r.id}/pdf${token ? `?token=${token}` : ''}`}
                          download
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-300 transition-colors inline-flex items-center gap-1"
                          title="Descargar documento completo en PDF"
                        >
                          <Download className="w-3 h-3 text-emerald-700" />
                          PDF
                        </a>

                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setObservaciones(r.observacionesSupervisor || '');
                            setFeedbackMsg(null);
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                            r.estado === 'Radicado'
                              ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent shadow-xs'
                              : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-200'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {r.estado === 'Radicado' ? 'Revisar' : 'Consultar'}
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

      {/* Review Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          title={`Revisión de Informe: ${selectedReport.periodo}`}
          subtitle={`Contrato: ${selectedReport.numeroContrato} • Contratista: ${selectedReport.contratistaNombre}`}
          maxWidth="3xl"
        >
          <div className="space-y-4 text-xs sm:text-sm">
            {feedbackMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {/* Header metadata */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block">Radicación:</span>
                {selectedReport.numeroRadicacion ? (
                  <span className="font-mono font-bold text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                    {selectedReport.numeroRadicacion}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Borrador</span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Estado actual:</span>
                <Badge status={selectedReport.estado} size="sm" />
              </div>
              <div>
                <span className="text-slate-500 block">Radicado el:</span>
                <span className="font-medium text-slate-800">
                  {formatDate(selectedReport.fechaRadicacion)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Período evaluado:</span>
                <span className="font-medium text-slate-800">{selectedReport.periodo}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Documentos Oficiales:</span>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <a
                    href={`/api/reports/${selectedReport.id}/docx${getStoredToken() ? `?token=${getStoredToken()}` : ''}`}
                    download
                    className="font-bold text-blue-700 hover:text-blue-800 underline inline-flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    Word (.DOCX)
                  </a>
                  <a
                    href={`/api/reports/${selectedReport.id}/pdf${getStoredToken() ? `?token=${getStoredToken()}` : ''}`}
                    download
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </a>
                </div>
              </div>
            </div>

            {/* Report activities list */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Actividades Ejecutadas por Obligación Contractual ({selectedReport.actividades.length})
              </h4>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selectedReport.actividades.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5 text-xs"
                  >
                    <div className="font-bold text-blue-900 leading-snug">{act.obligacion}</div>
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100">
                      {act.actividadRealizada}
                    </p>
                    {act.soporte && (
                      <p className="text-[11px] text-slate-500 italic">
                        Soporte/Evidencia: {act.soporte}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Logros y dificultades */}
            {(selectedReport.logros || selectedReport.dificultades) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {selectedReport.logros && (
                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-emerald-900 block mb-0.5">Logros:</span>
                    <p className="text-emerald-950">{selectedReport.logros}</p>
                  </div>
                )}
                {selectedReport.dificultades && (
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                    <span className="font-semibold text-amber-900 block mb-0.5">Dificultades:</span>
                    <p className="text-amber-950">{selectedReport.dificultades}</p>
                  </div>
                )}
              </div>
            )}

            {/* Supervisor feedback & actions */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones / Concepto de Supervisión
                </label>
                <textarea
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Escriba aquí las observaciones de la supervisión, aprobación de pago o correcciones requeridas..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReview('Con observaciones')}
                  className="px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg disabled:opacity-50"
                >
                  Devolver con Observaciones
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReview('Aprobado')}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprobar Informe y Certificar Pago
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
