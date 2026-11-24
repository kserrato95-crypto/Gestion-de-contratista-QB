import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { SocialSecurityRecord, Contract } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { ShieldCheck, Plus, CheckCircle, AlertCircle, FileText, UploadCloud } from 'lucide-react';

export const ContratistaSeguridadSocial: React.FC = () => {
  const [records, setRecords] = useState<SocialSecurityRecord[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // New PILA modal
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [periodo, setPeriodo] = useState('Octubre 2025');
  const [numeroPlanilla, setNumeroPlanilla] = useState('');
  const [operadorPila, setOperadorPila] = useState('Aportes en Línea');
  const [valorPagado, setValorPagado] = useState<number | ''>(512400);
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [soporteNombre, setSoporteNombre] = useState('Planilla_PILA_Octubre_2025.pdf');
  const [observaciones, setObservaciones] = useState('Aportes integrales a salud, pensión y ARL riesgo I.');

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [secRes, conRes] = await Promise.all([
        apiRequest<{ records: SocialSecurityRecord[] }>('/api/social-security').catch(() => ({ records: [] })),
        apiRequest<{ contracts: Contract[] }>('/api/contracts').catch(() => ({ contracts: [] })),
      ]);
      const safeRecords = Array.isArray(secRes?.records) ? secRes.records : [];
      const safeContracts = Array.isArray(conRes?.contracts) ? conRes.contracts : [];
      setRecords(safeRecords);
      setContracts(safeContracts);
      if (safeContracts.length > 0) {
        setSelectedContractId(safeContracts[0].id);
      }
    } catch (err) {
      console.error('Error loading social security:', err);
      setRecords([]);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!selectedContractId || !periodo || !numeroPlanilla || !valorPagado || !fechaPago) {
      setMsg({ type: 'error', text: 'Por favor complete todos los campos obligatorios de la planilla.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest<{ record: SocialSecurityRecord; message: string }>(
        '/api/social-security',
        {
          method: 'POST',
          data: {
            contratoId: selectedContractId,
            periodo,
            numeroPlanilla,
            operadorPila,
            valorPagado: Number(valorPagado),
            fechaPago,
            soporteNombre,
            observaciones,
          },
        }
      );
      setRecords([res.record, ...records]);
      setIsOpenModal(false);
      setNumeroPlanilla('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error al registrar la planilla.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-900" />
            Seguridad Social y Documentos de Soporte
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Registro de comprobantes de pago de la planilla integrada de liquidación de aportes (PILA).
          </p>
        </div>

        <button
          onClick={() => setIsOpenModal(true)}
          disabled={contracts.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-xs transition-colors disabled:opacity-40 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          Registrar Planilla PILA
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Período Cotizado</th>
                <th className="px-5 py-3.5">No. Planilla PILA</th>
                <th className="px-5 py-3.5">Operador</th>
                <th className="px-5 py-3.5 text-right">Valor Pagado</th>
                <th className="px-5 py-3.5">Fecha de Pago</th>
                <th className="px-5 py-3.5">Constancia</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    No has registrado comprobantes de seguridad social todavía.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{r.periodo}</td>
                    <td className="px-5 py-3.5 font-mono text-blue-900 font-semibold">
                      {r.numeroPlanilla}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{r.operadorPila}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-900">
                      {formatCOP(r.valorPagado)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(r.fechaPago)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {r.soporteNombre || 'Constancia digital'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge status={r.estado} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal to register PILA */}
      <Modal
        isOpen={isOpenModal}
        onClose={() => setIsOpenModal(false)}
        title="Registrar Planilla de Seguridad Social (PILA)"
        subtitle="Aporte obligatorio correspondiente a salud (12.5%), pensión (16%) y ARL"
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contrato Relacionado *
            </label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden bg-white"
              required
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numeroContrato} - {c.objeto.slice(0, 45)}...
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Período Cotizado *
              </label>
              <input
                type="text"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="Ej. Octubre 2025"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Planilla PILA *
              </label>
              <input
                type="text"
                value={numeroPlanilla}
                onChange={(e) => setNumeroPlanilla(e.target.value)}
                placeholder="Ej. 9845217430"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operador de Información PILA *
              </label>
              <select
                value={operadorPila}
                onChange={(e) => setOperadorPila(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden bg-white"
              >
                <option value="Aportes en Línea">Aportes en Línea</option>
                <option value="SOI (Servicio Operativo de Información)">SOI</option>
                <option value="MiPlanilla (Compensar)">MiPlanilla</option>
                <option value="Simple S.A.">Simple S.A.</option>
                <option value="Asopagos">Asopagos</option>
                <option value="Arus (Enlace Operativo)">Arus</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Total Pagado (COP) *
              </label>
              <input
                type="number"
                value={valorPagado}
                onChange={(e) => setValorPagado(e.target.value ? Number(e.target.value) : '')}
                placeholder="512400"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
              {valorPagado !== '' && (
                <span className="text-[11px] text-blue-800 font-semibold mt-1 block">
                  {formatCOP(Number(valorPagado))}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha Efectiva de Pago *
              </label>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Archivo Soporte (PDF)
              </label>
              <input
                type="text"
                value={soporteNombre}
                onChange={(e) => setSoporteNombre(e.target.value)}
                placeholder="Planilla_PILA_Octubre_2025.pdf"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones adicionales
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej. Aportes cancelados oportunamente conforme al IBC del 40%."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpenModal(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Registrando...' : 'Registrar Comprobante PILA'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
