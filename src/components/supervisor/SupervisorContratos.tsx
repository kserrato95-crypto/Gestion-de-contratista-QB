import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate, formatDateDMY } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { Contract } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { ContractFormModal } from './ContractFormModal.js';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Calendar,
  DollarSign,
  UserCheck,
  ShieldAlert,
  CheckCircle,
  Landmark,
  Edit3,
} from 'lucide-react';
import { calculateDetailedDuration, calculateTotalDays } from '../../utils/contractDuration.js';

interface SupervisorContratosProps {
  onOpenNewContract: () => void;
  isNewModalOpen: boolean;
  onCloseNewModal: () => void;
}

export const SupervisorContratos: React.FC<SupervisorContratosProps> = ({
  onOpenNewContract,
  isNewModalOpen,
  onCloseNewModal,
}) => {
  const { user } = useAuth();
  const canManageContracts = user?.rol === 'supervisor' || user?.rol === 'admin';

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected contract for view & edit
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ contracts: Contract[] }>('/api/contracts');
      setContracts(res.contracts);
    } catch (err) {
      console.error('Error loading contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const handleContractSaved = (saved: Contract) => {
    setContracts((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      if (exists) {
        return prev.map((item) => (item.id === saved.id ? saved : item));
      }
      return [saved, ...prev];
    });
    if (selectedContract && selectedContract.id === saved.id) {
      setSelectedContract(saved);
    }
  };

  const filtered = contracts.filter((c) => {
    const matchesStatus =
      statusFilter === 'todos' || c.estado.toLowerCase() === statusFilter.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      c.numeroContrato.toLowerCase().includes(q) ||
      c.contratistaNombre.toLowerCase().includes(q) ||
      c.contratistaDocumento.includes(q) ||
      c.objeto.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-900" />
            Administración de Contratos de Prestación de Servicios
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Registro, asignación, seguimiento de obligaciones y honorarios contractuales.
          </p>
        </div>

        <button
          onClick={onOpenNewContract}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          Registrar Nuevo Contrato
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número de contrato, contratista o cédula..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['todos', 'activo', 'en trámite', 'finalizado'].map((st) => (
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

      {/* Contracts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">No. Contrato</th>
                <th className="px-5 py-3.5">Contratista</th>
                <th className="px-5 py-3.5">Vigencia</th>
                <th className="px-5 py-3.5 text-right">Valor Total</th>
                <th className="px-5 py-3.5 text-right">Honorario Mes</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
                <th className="px-5 py-3.5 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    {search || statusFilter !== 'todos'
                      ? 'No hay contratos que coincidan con los filtros aplicados.'
                      : 'No hay contratos registrados. Haga clic en "Registrar Nuevo Contrato" para vincular el primero.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-900">
                      {c.numeroContrato}
                      {(c.cdpNumero || c.crpNumero) && (
                        <span className="block text-[10px] font-medium text-emerald-800 mt-0.5">
                          {c.cdpNumero ? `CDP ${c.cdpNumero}` : ''}
                          {c.cdpNumero && c.crpNumero ? ' • ' : ''}
                          {c.crpNumero ? `CRP ${c.crpNumero}` : ''}
                        </span>
                      )}
                      {c.codigoSecop && (
                        <span className="block text-[10px] font-normal text-slate-400 font-sans">
                          SECOP: {c.codigoSecop}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{c.contratistaNombre}</div>
                      <div className="text-[11px] text-slate-500">CC {c.contratistaDocumento}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-900">
                        <span>{formatDate(c.fechaInicio)}</span>
                        <span>al</span>
                        <span>{formatDate(c.fechaFin)}</span>
                      </div>
                      <div className="text-[10px] text-blue-900 font-semibold mt-0.5">
                        {c.duracionTexto || calculateDetailedDuration(c.fechaInicio, c.fechaFin).texto}
                        <span className="text-slate-400 font-normal ml-1">
                          ({c.vigenciaDias || calculateTotalDays(c.fechaInicio, c.fechaFin)} días)
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900">
                      {formatCOP(c.valorTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-emerald-800">
                      {formatCOP(c.honorariosMensuales)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge status={c.estado} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedContract(c)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        {canManageContracts && (
                          <button
                            onClick={() => setEditingContract(c)}
                            className="px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors inline-flex items-center gap-1"
                            title="Editar contrato e información presupuestal"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Detail View Modal */}
      {selectedContract && (
        <Modal
          isOpen={Boolean(selectedContract)}
          onClose={() => setSelectedContract(null)}
          title={`Detalle Oficial del Contrato ${selectedContract.numeroContrato}`}
          subtitle={`Contratista: ${selectedContract.contratistaNombre} (CC ${selectedContract.contratistaDocumento})`}
          maxWidth="3xl"
        >
          <div className="space-y-4 text-xs sm:text-sm">
            {/* Header info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Supervisor Responsable:</span>
                <span className="font-semibold text-slate-900">{selectedContract.supervisorResponsable}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Estado del Contrato:</span>
                <Badge status={selectedContract.estado} size="sm" />
              </div>
              <div>
                <span className="text-slate-500 block">Fecha de Inicio:</span>
                <span className="font-semibold text-slate-900">{formatDate(selectedContract.fechaInicio)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fecha de Terminación:</span>
                <span className="font-semibold text-slate-900">{formatDate(selectedContract.fechaFin)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Valor Total:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatCOP(selectedContract.valorTotal)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Honorarios Mensuales:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {formatCOP(selectedContract.honorariosMensuales)}
                </span>
              </div>
            </div>

            {/* Información Presupuestal del Contrato */}
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2.5 text-xs">
              <h4 className="font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-700" />
                Información Presupuestal del Contrato
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Certificado de Disponibilidad Presupuestal (CDP)
                  </span>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      CDP #: {selectedContract.cdpNumero ? selectedContract.cdpNumero : 'No registrado'}
                    </span>
                    <span className="text-slate-600 font-medium">
                      Fecha: {selectedContract.cdpFecha ? formatDateDMY(selectedContract.cdpFecha) : '—'}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Certificado de Registro Presupuestal (CRP)
                  </span>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      CRP #: {selectedContract.crpNumero ? selectedContract.crpNumero : 'No registrado'}
                    </span>
                    <span className="text-slate-600 font-medium">
                      Fecha: {selectedContract.crpFecha ? formatDateDMY(selectedContract.crpFecha) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Objeto */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">
                Objeto Contractual
              </h4>
              <p className="p-3 bg-white border border-slate-200 rounded-lg text-slate-700 leading-relaxed text-xs">
                {selectedContract.objeto}
              </p>
            </div>

            {/* Obligaciones contractuales */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Obligaciones Específicas ({selectedContract.obligacionesContractuales.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedContract.obligacionesContractuales.map((ob, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs text-slate-800"
                  >
                    {ob}
                  </div>
                ))}
              </div>
            </div>

            {/* Condiciones de pago */}
            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 text-xs">
              <span className="font-semibold text-blue-950 block mb-1">
                Periodicidad y Condiciones de Pago:
              </span>
              <p className="text-blue-900">
                <span className="font-bold">{selectedContract.periodicidadPago}:</span>{' '}
                {selectedContract.condicionesPago}
              </p>
            </div>

            {canManageContracts && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    const target = selectedContract;
                    setSelectedContract(null);
                    setEditingContract(target);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Contrato / Información Presupuestal
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Contract Form Modal (New or Edit Contract) */}
      <ContractFormModal
        isOpen={isNewModalOpen || Boolean(editingContract)}
        onClose={() => {
          if (isNewModalOpen) onCloseNewModal();
          setEditingContract(null);
        }}
        onSuccess={handleContractSaved}
        contractToEdit={editingContract}
      />
    </div>
  );
};
