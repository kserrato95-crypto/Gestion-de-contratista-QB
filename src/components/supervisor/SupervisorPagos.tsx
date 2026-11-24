import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { PaymentRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { CreditCard, Search, Check, RefreshCw } from 'lucide-react';

export const SupervisorPagos: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ payments: PaymentRecord[] }>('/api/payments');
      setPayments(res.payments);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleUpdateStatus = async (
    id: string,
    estado: 'Certificado por supervisión' | 'Ordenado para pago' | 'Pagado'
  ) => {
    try {
      const res = await apiRequest<{ payment: PaymentRecord; message: string }>(
        `/api/payments/${id}`,
        {
          method: 'PUT',
          data: { estado },
        }
      );
      setPayments((prev) => prev.map((p) => (p.id === id ? res.payment : p)));
    } catch (err) {
      console.error('Error updating payment status:', err);
    }
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.contratistaNombre.toLowerCase().includes(q) ||
      p.numeroContrato.toLowerCase().includes(q) ||
      p.periodo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-900" />
            Certificación y Trámite de Pagos
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Seguimiento de certificados de cumplimiento expedidos por supervisión y órdenes de giro a tesorería.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
          Total Trámites: <span className="font-bold text-blue-900">{payments.length}</span>
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
            placeholder="Buscar por contratista, contrato o período de pago..."
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
                <th className="px-5 py-3.5">Contrato</th>
                <th className="px-5 py-3.5">Contratista</th>
                <th className="px-5 py-3.5">Período</th>
                <th className="px-5 py-3.5 text-right">Valor Certificado</th>
                <th className="px-5 py-3.5">Referencia</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
                <th className="px-5 py-3.5 text-right">Cambiar Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    No hay pagos registrados aún en la base de datos.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-900">
                      {p.numeroContrato}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {p.contratistaNombre}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{p.periodo}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                      {formatCOP(p.valor)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-xs">
                      {p.referenciaPago || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge status={p.estado} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.estado === 'Certificado por supervisión' && (
                        <button
                          onClick={() => handleUpdateStatus(p.id, 'Ordenado para pago')}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        >
                          Ordenar giro
                        </button>
                      )}
                      {p.estado === 'Ordenado para pago' && (
                        <button
                          onClick={() => handleUpdateStatus(p.id, 'Pagado')}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                        >
                          Marcar Pagado
                        </button>
                      )}
                      {p.estado === 'Pagado' && (
                        <span className="text-emerald-700 font-semibold text-xs flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> Pagado
                        </span>
                      )}
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
