import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate, formatCOP } from '../../lib/api.js';
import { ActivityReport, Contract } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Send,
  Eye,
  CheckCircle,
} from 'lucide-react';

export const SupervisorRevision: React.FC = () => {
  const [pendingReports, setPendingReports] = useState<ActivityReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal review
  const [selectedReport, setSelectedReport] = useState<ActivityReport | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPending = async () => {
    try {
      const res = await apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] }));
      const reports = Array.isArray(res?.reports) ? res.reports : [];
      setPendingReports(reports.filter((r) => r.estado === 'Radicado'));
    } catch (err) {
      console.error('Error loading pending reviews:', err);
      setPendingReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleAction = async (decision: 'Aprobado' | 'Con observaciones') => {
    if (!selectedReport) return;
    if (decision === 'Con observaciones' && !observaciones.trim()) {
      setMsg({
        type: 'error',
        text: 'Debe ingresar las observaciones para el contratista.',
      });
      return;
    }

    try {
      setSubmitting(true);
      setMsg(null);
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

      setPendingReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
      setSelectedReport(null);
      setObservaciones('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error al procesar la revisión.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-900" />
            Mesa de Revisión y Aprobación
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Cola de trámites pendientes de validación técnica y certificación de cumplimiento por parte de la supervisión.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          <Clock className="w-4 h-4 text-amber-600" />
          <span>{pendingReports.length} informes en espera</span>
        </div>
      </div>

      {/* Main Queue Cards */}
      {pendingReports.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            ¡Estás al día con las revisiones!
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No hay informes de actividades pendientes de evaluación en este momento. Cuando un contratista radique su informe mensual, aparecerá automáticamente aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingReports.map((r) => (
            <div
              key={r.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {r.numeroContrato}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{r.contratistaNombre}</h3>
                </div>
                <Badge status={r.estado} size="sm" />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Período reportado:</span>
                  <span className="font-semibold text-slate-800">{r.periodo}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Fecha de radicación:</span>
                  <span className="font-medium text-slate-800">{formatDate(r.fechaRadicacion)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Obligaciones reportadas:</span>
                  <span className="font-semibold text-blue-900">
                    {r.actividades.length} actividades
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setSelectedReport(r);
                    setObservaciones('');
                    setMsg(null);
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4 text-amber-300" />
                  Abrir y Calificar Informe
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          title={`Evaluación de Cumplimiento: ${selectedReport.contratistaNombre}`}
          subtitle={`Contrato: ${selectedReport.numeroContrato} • Período: ${selectedReport.periodo}`}
          maxWidth="3xl"
        >
          <div className="space-y-4 text-xs sm:text-sm">
            {msg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  msg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{msg.text}</span>
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Detalle de Actividades Presentadas ({selectedReport.actividades.length})
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {selectedReport.actividades.map((act, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <span className="font-bold text-blue-950 block">{act.obligacion}</span>
                    <p className="text-slate-700 bg-white p-2 rounded border border-slate-100">
                      {act.actividadRealizada}
                    </p>
                    {act.soporte && (
                      <span className="text-[11px] text-slate-500 block italic">
                        Soporte técnico: {act.soporte}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Concepto de Supervisión / Observaciones *
              </label>
              <textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Escriba su concepto de supervisión técnica o las correcciones requeridas..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('Con observaciones')}
                className="px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg disabled:opacity-50"
              >
                Solicitar Ajustes
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('Aprobado')}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar y Expedir Certificación
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
