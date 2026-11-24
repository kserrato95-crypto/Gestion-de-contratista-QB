import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP } from '../../lib/api.js';
import { SupervisorStats } from '../../types/index.js';
import { BarChart3, TrendingUp, CheckCircle, PieChart, Building2, Shield } from 'lucide-react';

export const SupervisorReportes: React.FC = () => {
  const [stats, setStats] = useState<SupervisorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiRequest<SupervisorStats>('/api/stats/supervisor');
        setStats(res);
      } catch (e) {
        console.error('Error fetching reports stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const saldoPorEjecutar = stats
    ? Math.max(0, stats.valorTotalContratado - stats.valorTotalPagado)
    : 0;

  const porcentajeEjecutado =
    stats && stats.valorTotalContratado > 0
      ? Math.round((stats.valorTotalPagado / stats.valorTotalContratado) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-900" />
          Reportes y Consolidado de Supervisión
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Informe consolidado de ejecución presupuestal y cumplimiento de la gestión contractual institucional.
        </p>
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Compromiso Presupuestal Total
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatCOP(stats ? stats.valorTotalContratado : 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Basado en {stats ? stats.totalContratos : 0} contratos registrados
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Girado / Pagado
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            {formatCOP(stats ? stats.valorTotalPagado : 0)}
          </p>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full"
              style={{ width: `${Math.min(porcentajeEjecutado, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {porcentajeEjecutado}% de ejecución presupuestal efectiva
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Saldo por Ejecutar
          </span>
          <p className="text-2xl font-bold font-mono text-blue-900 mt-2">
            {formatCOP(saldoPorEjecutar)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Pendiente por certificar en períodos venideros
          </p>
        </div>
      </div>

      {/* Breakdown by reports status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Distribución del Flujo de Informes de Actividades
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-blue-900 font-semibold block uppercase tracking-wider text-[11px]">
              Aprobados a Satisfacción
            </span>
            <span className="text-3xl font-bold text-blue-950 mt-1 block">
              {stats ? stats.informesAprobados : 0}
            </span>
            <span className="text-slate-600 mt-1 block">Con pago debidamente certificado</span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-900 font-semibold block uppercase tracking-wider text-[11px]">
              Pendientes en Supervisión
            </span>
            <span className="text-3xl font-bold text-amber-950 mt-1 block">
              {stats ? stats.informesPendientesRevision : 0}
            </span>
            <span className="text-slate-600 mt-1 block">Requieren evaluación de evidencias</span>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-rose-900 font-semibold block uppercase tracking-wider text-[11px]">
              Con Observaciones
            </span>
            <span className="text-3xl font-bold text-rose-950 mt-1 block">
              {stats ? stats.informesConObservaciones : 0}
            </span>
            <span className="text-slate-600 mt-1 block">Devueltos al contratista para ajuste</span>
          </div>
        </div>
      </div>
    </div>
  );
};
