import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { SupervisorStats, ActivityReport, Contract } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import {
  Users,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  FileCheck2,
  Building,
  CalendarClock,
} from 'lucide-react';

interface SupervisorInicioProps {
  onNavigate: (section: string) => void;
  onOpenNewContract: () => void;
}

export const SupervisorInicio: React.FC<SupervisorInicioProps> = ({
  onNavigate,
  onOpenNewContract,
}) => {
  const [stats, setStats] = useState<SupervisorStats | null>(null);
  const [recentReports, setRecentReports] = useState<ActivityReport[]>([]);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, reportsRes, contractsRes] = await Promise.all([
        apiRequest<SupervisorStats>('/api/stats/supervisor'),
        apiRequest<{ reports: ActivityReport[] }>('/api/reports'),
        apiRequest<{ contracts: Contract[] }>('/api/contracts'),
      ]);
      setStats(statsRes);
      setRecentReports(reportsRes.reports.slice(0, 5));
      setActiveContracts(contractsRes.contracts.slice(0, 5));
    } catch (err) {
      console.error('Error loading supervisor stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Institutional Top Greeting & Action Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-900">
            <Building className="w-4 h-4 text-amber-500" />
            Supervisión Contractual e Interventoría
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Tablero de Control del Supervisor
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Monitoreo en tiempo real de contratistas de prestación de servicios, informes de actividades y pagos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('seguimiento-contratistas')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-xs transition-colors"
          >
            <CalendarClock className="w-4 h-4 text-amber-300" />
            Seguimiento de Contratistas
          </button>
          <button
            onClick={() => onNavigate('actas-pendientes')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 shadow-xs transition-colors"
          >
            <FileCheck2 className="w-4 h-4 text-amber-300" />
            Actas de Supervisión Pendientes
          </button>
          <button
            onClick={onOpenNewContract}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            Registrar Nuevo Contrato
          </button>
        </div>
      </div>

      {/* Required 4 Main Cards: Contratistas, Contratos activos, Informes pendientes, Informes aprobados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Contratistas */}
        <div
          onClick={() => onNavigate('contratistas')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Contratistas
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {stats ? stats.totalContratistas : 0}
            </span>
            <span className="text-xs text-slate-500">registrados</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-blue-700 font-medium group-hover:underline">
            Ver directorio de contratistas &rarr;
          </div>
        </div>

        {/* 2. Contratos Activos */}
        <div
          onClick={() => onNavigate('contratos')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Contratos Activos
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {stats ? stats.contratosActivos : 0}
            </span>
            <span className="text-xs text-slate-500">
              de {stats ? stats.totalContratos : 0} totales
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-700 font-medium group-hover:underline">
            Administrar contratos &rarr;
          </div>
        </div>

        {/* 3. Informes pendientes de revisión */}
        <div
          onClick={() => onNavigate('revision')}
          className={`bg-white p-5 rounded-xl border shadow-xs transition-all cursor-pointer group ${
            stats && stats.informesPendientesRevision > 0
              ? 'border-amber-300 ring-2 ring-amber-100'
              : 'border-slate-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Pendientes de Revisión
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-100 transition-colors">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">
              {stats ? stats.informesPendientesRevision : 0}
            </span>
            <span className="text-xs text-slate-500">por revisar</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-amber-700 font-medium group-hover:underline">
            {stats && stats.informesPendientesRevision > 0 ? '¡Requiere atención inmediata! →' : 'Ir a revisión →'}
          </div>
        </div>

        {/* 4. Informes aprobados */}
        <div
          onClick={() => onNavigate('informes')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Informes Aprobados
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100 transition-colors">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {stats ? stats.informesAprobados : 0}
            </span>
            <span className="text-xs text-slate-500">aprobados a la fecha</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-blue-700 font-medium group-hover:underline">
            Histórico de informes &rarr;
          </div>
        </div>
      </div>

      {/* Budget Summary Banner */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900 text-white p-5 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-800 text-amber-300">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-medium">
                Presupuesto Total Contratado
              </p>
              <p className="text-xl font-bold font-mono text-white">
                {formatCOP(stats.valorTotalContratado)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
            <div className="p-3 rounded-lg bg-emerald-800 text-emerald-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-medium">
                Pagos Certificados y Desembolsados
              </p>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {formatCOP(stats.valorTotalPagado)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Two columns: Pending reports and recent contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending / Recent reports */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-blue-900" />
              Informes Recientes de Actividades
            </h3>
            <button
              onClick={() => onNavigate('informes')}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
            >
              Ver todos
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {recentReports.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No hay informes radicados en la base de datos por el momento.
              </p>
            ) : (
              recentReports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100/70 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{rep.contratistaNombre}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Contrato <span className="font-mono">{rep.numeroContrato}</span> • Período: {rep.periodo}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={rep.estado} size="sm" />
                    <button
                      onClick={() => onNavigate('revision')}
                      className="p-1 text-slate-400 hover:text-blue-700"
                      title="Revisar informe"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active contracts preview */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-900" />
              Contratos en Ejecución
            </h3>
            <button
              onClick={() => onNavigate('contratos')}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
            >
              Ver todos
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {activeContracts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No hay contratos registrados aún en la base de datos.
              </p>
            ) : (
              activeContracts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100/70 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-900">{c.numeroContrato}</span>
                      <Badge status={c.estado} size="sm" />
                    </div>
                    <div className="text-slate-700 font-medium truncate mt-0.5">
                      {c.contratistaNombre}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Vence: {formatDate(c.fechaFin)} • Mensual: {formatCOP(c.honorariosMensuales)}
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('contratos')}
                    className="p-1 text-slate-400 hover:text-blue-700 shrink-0"
                    title="Ver contrato"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
