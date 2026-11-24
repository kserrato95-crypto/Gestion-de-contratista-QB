import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal.js';
import { apiRequest, formatCOP } from '../../lib/api.js';
import { User, Contract } from '../../types/index.js';
import { Plus, Trash2, AlertCircle, CheckCircle, FileText, Calendar, Clock, BarChart3, Landmark } from 'lucide-react';
import { calculateDetailedDuration, getContractPeriods } from '../../utils/contractDuration.js';

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contract: Contract) => void;
  contractToEdit?: Contract | null;
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contractToEdit,
}) => {
  const [contractors, setContractors] = useState<User[]>([]);
  const [loadingContractors, setLoadingContractors] = useState(false);

  // Form fields
  const [numeroContrato, setNumeroContrato] = useState('');
  const [contratistaId, setContratistaId] = useState('');
  const [supervisorResponsable, setSupervisorResponsable] = useState('');
  const [objeto, setObjeto] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [valorTotal, setValorTotal] = useState<number | ''>('');
  const [honorariosMensuales, setHonorariosMensuales] = useState<number | ''>('');
  const [obligaciones, setObligaciones] = useState<string[]>([
    '1. Prestar los servicios con autonomía técnica y administrativa según los requerimientos de la entidad.',
    '2. Presentar oportunamente los informes mensuales de ejecución con los soportes respectivos.',
    '3. Acreditar el pago oportuno de los aportes al Sistema de Seguridad Social Integral.',
  ]);
  const [newObligacion, setNewObligacion] = useState('');
  const [periodicidadPago, setPeriodicidadPago] = useState('Mensual vencido');
  const [condicionesPago, setCondicionesPago] = useState(
    'Previa radicación y aprobación del informe mensual de actividades por parte de la supervisión, y verificación del pago de aportes a seguridad social (Planilla PILA).'
  );
  const [codigoSecop, setCodigoSecop] = useState('');
  // Budgetary Info (CDP & CRP stored strictly as strings to preserve leading zeros)
  const [cdpNumero, setCdpNumero] = useState('');
  const [cdpFecha, setCdpFecha] = useState('');
  const [crpNumero, setCrpNumero] = useState('');
  const [crpFecha, setCrpFecha] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live calculation of exact calendar days and 30-day consecutive periods
  const calculatedDuration = useMemo(() => {
    return calculateDetailedDuration(fechaInicio, fechaFin);
  }, [fechaInicio, fechaFin]);

  const contractPeriods = useMemo(() => {
    return getContractPeriods(fechaInicio, fechaFin);
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    if (isOpen) {
      loadContractors();
      if (contractToEdit) {
        setNumeroContrato(contractToEdit.numeroContrato);
        setContratistaId(contractToEdit.contratistaId);
        setSupervisorResponsable(contractToEdit.supervisorResponsable);
        setObjeto(contractToEdit.objeto);
        setFechaInicio(contractToEdit.fechaInicio);
        setFechaFin(contractToEdit.fechaFin);
        setValorTotal(contractToEdit.valorTotal);
        setHonorariosMensuales(contractToEdit.honorariosMensuales);
        setObligaciones(contractToEdit.obligacionesContractuales || []);
        setPeriodicidadPago(contractToEdit.periodicidadPago);
        setCondicionesPago(contractToEdit.condicionesPago);
        setCodigoSecop(contractToEdit.codigoSecop || '');
        setCdpNumero(contractToEdit.cdpNumero || '');
        setCdpFecha(contractToEdit.cdpFecha || '');
        setCrpNumero(contractToEdit.crpNumero || '');
        setCrpFecha(contractToEdit.crpFecha || '');
      } else {
        // Defaults for new contract
        setNumeroContrato(`CPS-${Math.floor(100 + Math.random() * 900)}-2025`);
        setContratistaId('');
        setSupervisorResponsable('Supervisión Asignada - Dirección Administrativa');
        setObjeto('');
        setFechaInicio(new Date().toISOString().slice(0, 10));
        const fin = new Date();
        fin.setMonth(fin.getMonth() + 6);
        setFechaFin(fin.toISOString().slice(0, 10));
        setValorTotal(30000000);
        setHonorariosMensuales(5000000);
        setCodigoSecop('');
        setCdpNumero('');
        setCdpFecha('');
        setCrpNumero('');
        setCrpFecha('');
      }
      setError(null);
    }
  }, [isOpen, contractToEdit]);

  const loadContractors = async () => {
    try {
      setLoadingContractors(true);
      const res = await apiRequest<{ contractors: User[] }>('/api/contractors');
      setContractors(res.contractors);
    } catch (err: any) {
      console.error('Error fetching contractors for select:', err);
    } finally {
      setLoadingContractors(false);
    }
  };

  const handleAddObligacion = () => {
    if (!newObligacion.trim()) return;
    const num = obligaciones.length + 1;
    setObligaciones([...obligaciones, `${num}. ${newObligacion.trim()}`]);
    setNewObligacion('');
  };

  const handleRemoveObligacion = (index: number) => {
    setObligaciones(obligaciones.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !numeroContrato ||
      !contratistaId ||
      !supervisorResponsable ||
      !objeto ||
      !fechaInicio ||
      !fechaFin ||
      !valorTotal ||
      !honorariosMensuales
    ) {
      setError('Por favor diligencie todos los campos obligatorios del contrato.');
      return;
    }

    if (obligaciones.length === 0) {
      setError('Debe registrar al menos una obligación contractual.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        numeroContrato,
        contratistaId,
        supervisorResponsable,
        objeto,
        fechaInicio,
        fechaFin,
        vigenciaDias: calculatedDuration.totalDias,
        duracionTexto: calculatedDuration.texto,
        valorTotal: Number(valorTotal),
        honorariosMensuales: Number(honorariosMensuales),
        obligacionesContractuales: obligaciones,
        periodicidadPago,
        condicionesPago,
        codigoSecop,
        cdpNumero: cdpNumero.trim(),
        cdpFecha: cdpFecha.trim(),
        crpNumero: crpNumero.trim(),
        crpFecha: crpFecha.trim(),
      };

      if (contractToEdit) {
        const res = await apiRequest<{ contract: Contract; message: string }>(
          `/api/contracts/${contractToEdit.id}`,
          {
            method: 'PUT',
            data: payload,
          }
        );
        onSuccess(res.contract);
      } else {
        const res = await apiRequest<{ contract: Contract; message: string }>(
          '/api/contracts',
          {
            method: 'POST',
            data: payload,
          }
        );
        onSuccess(res.contract);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el contrato.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contractToEdit ? 'Editar Contrato de Prestación de Servicios' : 'Registro de Nuevo Contrato'}
      subtitle="Formulario oficial de vinculación y asignación contractual para entidad pública"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Número del Contrato *
            </label>
            <input
              type="text"
              value={numeroContrato}
              onChange={(e) => setNumeroContrato(e.target.value)}
              placeholder="Ej. CPS-042-2025"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contratista Asignado *
            </label>
            <select
              value={contratistaId}
              onChange={(e) => setContratistaId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden bg-white"
              required
            >
              <option value="">-- Seleccione un contratista registrado --</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombres} {c.apellidos} ({c.tipoDocumento} {c.numeroDocumento})
                </option>
              ))}
            </select>
            {contractors.length === 0 && !loadingContractors && (
              <p className="text-[11px] text-amber-700 mt-1">
                No hay contratistas registrados aún. Registre uno primero en la pantalla de registro.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Supervisor Responsable *
          </label>
          <input
            type="text"
            value={supervisorResponsable}
            onChange={(e) => setSupervisorResponsable(e.target.value)}
            placeholder="Nombre y cargo del supervisor institucional"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Objeto del Contrato *
          </label>
          <textarea
            rows={3}
            value={objeto}
            onChange={(e) => setObjeto(e.target.value)}
            placeholder="Describa de manera precisa el objeto del contrato de prestación de servicios..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden resize-none"
            required
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha de Inicio *
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha de Terminación *
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden"
              required
            />
          </div>
        </div>

        {/* Live Calculation: Exact calendar days, informative duration, and 30-day period preview */}
        {fechaInicio && fechaFin && calculatedDuration.totalDias > 0 && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-900" />
                <span className="text-xs font-bold text-blue-950">
                  Cálculo Contractual por Días Calendario Reales
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-900 text-white font-mono">
                {calculatedDuration.totalDias} días calendario
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-500 block">Duración informativa:</span>
                <span className="font-bold text-slate-900">{calculatedDuration.texto}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-500 block">Días transcurridos:</span>
                <span className="font-bold text-slate-900">{calculatedDuration.diasTranscurridos} días</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-500 block">Días restantes:</span>
                <span className="font-bold text-slate-900">{calculatedDuration.diasRestantes} días</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-500 block">Períodos de 30 días:</span>
                <span className="font-bold text-blue-900">{contractPeriods.length} actas</span>
              </div>
            </div>

            {/* Preview of 30-day periods */}
            <div className="bg-white/80 p-2.5 rounded-lg border border-blue-100">
              <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                Distribución automática de períodos de actas (períodos de 30 días y ajuste final):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                {contractPeriods.map((p) => (
                  <div
                    key={p.numeroActa}
                    className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200"
                  >
                    <span className="font-bold text-slate-800">
                      Acta {p.numeroActa} ({p.diasPeriodo}d):
                    </span>
                    <span className="text-slate-600 font-mono text-[10px]">
                      {p.fechaInicioPeriodo} a {p.fechaFinPeriodo}
                    </span>
                    <span className="font-bold text-blue-900 font-mono">
                      {p.porcentajeAvanceTiempo.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Values */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor Total del Contrato (COP) *
            </label>
            <input
              type="number"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value ? Number(e.target.value) : '')}
              placeholder="36000000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono"
              required
              min={1}
            />
            {valorTotal !== '' && (
              <p className="text-[11px] text-slate-500 mt-1 font-semibold text-blue-800">
                {formatCOP(Number(valorTotal))}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Honorarios Mensuales (COP) *
            </label>
            <input
              type="number"
              value={honorariosMensuales}
              onChange={(e) => setHonorariosMensuales(e.target.value ? Number(e.target.value) : '')}
              placeholder="4500000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono"
              required
              min={1}
            />
            {honorariosMensuales !== '' && (
              <p className="text-[11px] text-slate-500 mt-1 font-semibold text-blue-800">
                {formatCOP(Number(honorariosMensuales))}
              </p>
            )}
          </div>
        </div>

        {/* INFORMACIÓN PRESUPUESTAL DEL CONTRATO (CDP y CRP) */}
        <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-emerald-200/70 pb-2">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-700 shrink-0" />
              INFORMACIÓN PRESUPUESTAL DEL CONTRATO
            </h3>
            <span className="text-[10px] text-emerald-800 font-medium">
              Conserva ceros iniciales (Ej. CDP 01221 • CRP 002588)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Certificado de Disponibilidad Presupuestal (CDP) */}
            <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-2.5">
              <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                1. Certificado de Disponibilidad Presupuestal (CDP)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Número del CDP
                  </label>
                  <input
                    type="text"
                    value={cdpNumero}
                    onChange={(e) => setCdpNumero(e.target.value)}
                    placeholder="Ej. 01221"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Fecha del CDP
                  </label>
                  <input
                    type="date"
                    value={cdpFecha}
                    onChange={(e) => setCdpFecha(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 2. Certificado de Registro Presupuestal (CRP) */}
            <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-2.5">
              <p className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                2. Certificado de Registro Presupuestal (CRP)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Número del CRP
                  </label>
                  <input
                    type="text"
                    value={crpNumero}
                    onChange={(e) => setCrpNumero(e.target.value)}
                    placeholder="Ej. 002588"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Fecha del CRP
                  </label>
                  <input
                    type="date"
                    value={crpFecha}
                    onChange={(e) => setCrpFecha(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Obligations */}
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
          <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
            Obligaciones Contractuales ({obligaciones.length}) *
          </label>
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {obligaciones.map((ob, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 rounded bg-white border border-slate-200 text-xs"
              >
                <span className="text-slate-800 leading-snug">{ob}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveObligacion(idx)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 shrink-0"
                  title="Eliminar obligación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newObligacion}
              onChange={(e) => setNewObligacion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddObligacion();
                }
              }}
              placeholder="Escriba una obligación contractual y presione Agregar..."
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden bg-white"
            />
            <button
              type="button"
              onClick={handleAddObligacion}
              className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-medium hover:bg-blue-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>
        </div>

        {/* Payment conditions & Secop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Periodicidad de Pago
            </label>
            <input
              type="text"
              value={periodicidadPago}
              onChange={(e) => setPeriodicidadPago(e.target.value)}
              placeholder="Mensual vencido"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Código SECOP / Referencia Presupuestal (Opcional)
            </label>
            <input
              type="text"
              value={codigoSecop}
              onChange={(e) => setCodigoSecop(e.target.value)}
              placeholder="Ej. CO1.PCCNTR.4892104"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Condiciones de Pago *
          </label>
          <textarea
            rows={2}
            value={condicionesPago}
            onChange={(e) => setCondicionesPago(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden resize-none"
            required
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Guardando en base de datos...' : 'Guardar y Vincular Contrato'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
