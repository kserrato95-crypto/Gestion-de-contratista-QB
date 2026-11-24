import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate, formatDateDMY } from '../../lib/api.js';
import { Contract } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Briefcase, Calendar, DollarSign, Shield, FileText, Info, Landmark } from 'lucide-react';

export const ContratistaMiContrato: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true);
        const res = await apiRequest<{ contracts: Contract[] }>('/api/contracts').catch(() => ({ contracts: [] }));
        setContracts(Array.isArray(res?.contracts) ? res.contracts : []);
      } catch (err) {
        console.error('Error fetching contractor contracts:', err);
        setContracts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchContracts();
  }, []);

  const contract = contracts.find((c) => c.estado === 'Activo') || contracts[0] || null;

  if (!contract && !loading) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <Info className="w-7 h-7 text-amber-700" />
        </div>
        <h2 className="text-lg font-bold text-amber-950">
          Sin Contrato Asignado
        </h2>
        <p className="text-sm text-amber-900 leading-relaxed font-medium">
          Actualmente no tienes un contrato asignado en el sistema. Por favor espera a que la supervisión de la entidad registre y vincule tu contrato de prestación de servicios.
        </p>
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-900">
            <Briefcase className="w-4 h-4 text-amber-500" />
            Contrato de Prestación de Servicios
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1">
            {contract.numeroContrato}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SECOP: {contract.codigoSecop || 'Registro Institucional Interno'}
          </p>
        </div>

        <Badge status={contract.estado} />
      </div>

      {/* Main contract sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs sm:text-sm">
        {/* Supervisor and Dates */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Supervisor Institucional:</span>
            <span className="font-semibold text-slate-900 text-sm">{contract.supervisorResponsable}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Vigencia Contractual:</span>
            <span className="font-semibold text-slate-900 text-sm">
              {formatDate(contract.fechaInicio)} al {formatDate(contract.fechaFin)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Valor Total del Contrato:</span>
            <span className="font-mono font-bold text-slate-900 text-base">
              {formatCOP(contract.valorTotal)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Honorarios Mensuales Pactados:</span>
            <span className="font-mono font-bold text-emerald-700 text-base">
              {formatCOP(contract.honorariosMensuales)}
            </span>
          </div>
        </div>

        {/* Información Presupuestal del Contrato */}
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2.5 text-xs">
          <h3 className="font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-700" />
            Información Presupuestal del Contrato
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Certificado de Disponibilidad Presupuestal (CDP)
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  CDP #: {contract.cdpNumero ? contract.cdpNumero : 'No registrado'}
                </span>
                <span className="text-slate-600 font-medium">
                  Fecha: {contract.cdpFecha ? formatDateDMY(contract.cdpFecha) : '—'}
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Certificado de Registro Presupuestal (CRP)
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  CRP #: {contract.crpNumero ? contract.crpNumero : 'No registrado'}
                </span>
                <span className="text-slate-600 font-medium">
                  Fecha: {contract.crpFecha ? formatDateDMY(contract.crpFecha) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Objeto */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-900" />
            Objeto del Contrato
          </h3>
          <p className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 leading-relaxed text-xs sm:text-sm">
            {contract.objeto}
          </p>
        </div>

        {/* Obligaciones contractuales */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-900" />
            Obligaciones Específicas del Contratista ({(contract.obligacionesContractuales || []).length})
          </h3>
          <div className="space-y-2">
            {(contract.obligacionesContractuales || []).map((ob, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs leading-snug"
              >
                {ob}
              </div>
            ))}
          </div>
        </div>

        {/* Condiciones de pago */}
        <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 text-xs space-y-1">
          <span className="font-bold text-blue-950 block">
            Periodicidad y Condiciones de Pago:
          </span>
          <p className="text-blue-900">
            <span className="font-semibold">{contract.periodicidadPago}:</span> {contract.condicionesPago}
          </p>
        </div>
      </div>
    </div>
  );
};
