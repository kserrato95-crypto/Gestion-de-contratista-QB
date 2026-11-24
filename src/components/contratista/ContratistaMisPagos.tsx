import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { PaymentRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Wallet, CheckCircle, Clock } from 'lucide-react';

export const ContratistaMisPagos: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const res = await apiRequest<{ payments: PaymentRecord[] }>('/api/payments').catch(() => ({ payments: [] }));
        setPayments(Array.isArray(res?.payments) ? res.payments : []);
      } catch (err) {
        console.error('Error fetching contractor payments:', err);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const totalRecibido = payments
    .filter((p) => p.estado === 'Pagado')
    .reduce((acc, p) => acc + p.valor, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-900" />
            Mis Trámites y Certificaciones de Pago
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Estado de las certificaciones de cumplimiento expedidas por el supervisor para el desembolso de honorarios.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200">
          Total Pagado:{' '}
          <span className="font-bold font-mono text-emerald-700">{formatCOP(totalRecibido)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Período de Honorarios</th>
                <th className="px-5 py-3.5">No. Contrato</th>
                <th className="px-5 py-3.5 text-right">Valor Honorarios</th>
                <th className="px-5 py-3.5">Certificación / Radicado</th>
                <th className="px-5 py-3.5">Fecha Certificación</th>
                <th className="px-5 py-3.5 text-center">Estado del Trámite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-500">
                    Aún no tienes certificaciones de pago expedidas. Cuando tu supervisor apruebe tu informe de actividades, se generará la certificación de pago.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{p.periodo}</td>
                    <td className="px-5 py-3.5 font-mono text-blue-900 font-medium">
                      {p.numeroContrato}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                      {formatCOP(p.valor)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-xs">
                      {p.referenciaPago || 'CERT-EN-TRÁMITE'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {formatDate(p.fechaCertificacion)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge status={p.estado} size="sm" />
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
