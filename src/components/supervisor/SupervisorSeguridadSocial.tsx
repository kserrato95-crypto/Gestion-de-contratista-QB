import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { SocialSecurityRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { ShieldCheck, Search, FileText, CheckCircle2 } from 'lucide-react';

export const SupervisorSeguridadSocial: React.FC = () => {
  const [records, setRecords] = useState<SocialSecurityRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ records: SocialSecurityRecord[] }>('/api/social-security');
      setRecords(res.records);
    } catch (err) {
      console.error('Error loading social security records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.contratistaNombre.toLowerCase().includes(q) ||
      r.numeroPlanilla.toLowerCase().includes(q) ||
      r.periodo.toLowerCase().includes(q) ||
      r.operadorPila.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-900" />
            Control y Verificación de Seguridad Social (Planilla PILA)
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Comprobación de aportes a Salud, Pensión y Riesgos Laborales (ARL) para cada período contractual.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
          Planillas verificadas: <span className="font-bold text-blue-900">{records.length}</span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por contratista, número de planilla PILA u operador..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Contratista</th>
                <th className="px-5 py-3.5">Período Cotizado</th>
                <th className="px-5 py-3.5">No. Planilla PILA</th>
                <th className="px-5 py-3.5">Operador</th>
                <th className="px-5 py-3.5 text-right">Valor Pagado</th>
                <th className="px-5 py-3.5">Fecha de Pago</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    No se encontraron registros de seguridad social.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {r.contratistaNombre}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{r.periodo}</td>
                    <td className="px-5 py-3.5 font-mono text-blue-900">{r.numeroPlanilla}</td>
                    <td className="px-5 py-3.5 text-slate-600">{r.operadorPila}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-900">
                      {formatCOP(r.valorPagado)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(r.fechaPago)}</td>
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
    </div>
  );
};
