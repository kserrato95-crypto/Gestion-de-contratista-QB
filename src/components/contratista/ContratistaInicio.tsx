import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { ContractorStats, Contract, ActivityReport } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import {
  Briefcase,
  Clock,
  FileCheck2,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Plus,
  ArrowRight,
  Info,
  CalendarClock,
} from 'lucide-react';
import { calculateDetailedDuration, getContractProgressTracker } from '../../utils/contractDuration.js';

interface ContratistaInicioProps {
  onNavigate: (section: string) => void;
  onOpenNewReport: () => void;
}

export const ContratistaInicio: React.FC<ContratistaInicioProps> = ({
  onNavigate,
  onOpenNewReport,
}) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ContractorStats | null>(null);
  const [recentReports, setRecentReports] = useState<ActivityReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, reportsRes] = await Promise.all([
        apiRequest<ContractorStats>('/api/stats/contractor').catch((err) => {
          console.error('Error fetching contractor stats:', err);
          return null;
        }),
        apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch((err) => {
          console.error('Error fetching reports:', err);
          return { reports: [] };
        }),
      ]);
      setStats(statsRes || null);
      const safeReports = Array.isArray(reportsRes?.reports)
        ? reportsRes.reports
        : Array.isArray(reportsRes)
        ? (reportsRes as unknown as ActivityReport[])
        : [];
      setRecentReports(safeReports);
    } catch (err) {
      console.error('Error loading contractor dashboard data:', err);
      setRecentReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasContract = stats ? stats.tieneContrato : false;
  const activeContract = stats ? stats.contratoActivo : null;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Bienvenido(a), {user?.nombres} {user?.apellidos}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Portal Institucional de Gestión y Seguimiento para Contratistas de Prestación de Servicios.
        </p>
      </div>

      {/* IF CONTRACTOR HAS NO CONTRACT ASSIGNED - EXPLICIT REQUIREMENT IN BRIEF */}
      {!hasContract && !loading && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <Info className="w-7 h-7 text-amber-700" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-lg font-bold text-amber-950">
              Esperando Asignación de Contrato
            </h2>
            <p className="text-sm text-amber-900 leading-relaxed font-medium">
              Actualmente no tienes un contrato asignado en el sistema. Por favor espera a que la supervisión de la entidad registre y vincule tu contrato de prestación de servicios.
            </p>
            <p className="text-xs text-amber-700 pt-1">
              Tu cuenta de contratista (CC {user?.numeroDocumento}) está activa. Tan pronto el supervisor responsable formalice el registro, podrás consultar las obligaciones contractuales, radicar tus informes mensuales de actividades y subir tus planillas de seguridad social (PILA).
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('mi-informacion')}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Completar mi información personal y bancaria &rarr;
            </button>
          </div>
        </div>
      )}

      {/* IF CONTRACTOR HAS AN ASSIGNED CONTRACT */}
      {hasContract && activeContract && (
        <>
          {/* Active Contract Hero Card */}
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Contrato de Prestación de Servicios Vigente
                </span>
                <h2 className="text-xl font-bold font-mono text-white mt-0.5">
                  {activeContract.numeroContrato}
                </h2>
              </div>
              <Badge status={activeContract.estado} />
            </div>

            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">
              {activeContract.objeto}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
              <div>
                <span className="text-slate-400 block">Vigencia y Días:</span>
                <span className="font-medium text-slate-200">
                  {formatDate(activeContract.fechaInicio)} al {formatDate(activeContract.fechaFin)}
                </span>
                <span className="text-[11px] text-amber-400 font-semibold block mt-0.5">
                  {activeContract.duracionTexto || calculateDetailedDuration(activeContract.fechaInicio, activeContract.fechaFin).texto} ({activeContract.vigenciaDias || calculateDetailedDuration(activeContract.fechaInicio, activeContract.fechaFin).totalDias} días)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Honorarios Mes:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatCOP(activeContract.honorariosMensuales)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Valor Total:</span>
                <span className="font-mono font-medium text-slate-200">
                  {formatCOP(activeContract.valorTotal)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Supervisor:</span>
                <span className="font-medium text-slate-200 truncate block">
                  {activeContract.supervisorResponsable}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => onNavigate('seguimiento-contrato')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-xs"
              >
                <CalendarClock className="w-4 h-4 text-slate-950" />
                Seguimiento de mi contrato (Días y Actas)
              </button>
              <button
                onClick={onOpenNewReport}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                Radicar Informe Mensual
              </button>
              <button
                onClick={() => onNavigate('seguridad-social-docs')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Registrar Planilla PILA
              </button>
              <button
                onClick={() => onNavigate('mi-contrato')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors ml-auto"
              >
                Ver contrato completo &rarr;
              </button>
            </div>
          </div>

          {/* KPI Mini Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => onNavigate('mis-informes')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Informes Radicados
                </span>
                <FileCheck2 className="w-4 h-4 text-blue-700" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {stats ? stats.informesRadicados : 0}
              </div>
              <p className="text-xs text-blue-700 mt-1 font-medium group-hover:underline">
                En revisión por supervisión &rarr;
              </p>
            </div>

            <div
              onClick={() => onNavigate('mis-informes')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Informes Aprobados
                </span>
                <FileCheck2 className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {stats ? stats.informesAprobados : 0}
              </div>
              <p className="text-xs text-emerald-700 mt-1 font-medium group-hover:underline">
                Cumplimiento certificado &rarr;
              </p>
            </div>

            <div
              onClick={() => onNavigate('seguridad-social-docs')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Planillas PILA
                </span>
                <ShieldCheck className="w-4 h-4 text-amber-700" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {stats ? stats.planillasPresentadas : 0}
              </div>
              <p className="text-xs text-amber-700 mt-1 font-medium group-hover:underline">
                Aportes a seguridad social &rarr;
              </p>
            </div>
          </div>

          {/* Recent Reports List */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-900" />
                Mis Informes de Actividades Recientes
              </h3>
              <button
                onClick={() => onNavigate('mis-informes')}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
              >
                Ver todos
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {!recentReports || recentReports.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Aún no has registrado informes de actividades para este contrato.
                </p>
              ) : (
                recentReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{r.periodo}</span>
                      <span className="text-slate-500 text-[11px]">
                        {(r.actividades || []).length} obligaciones reportadas • Radicado:{' '}
                        {r.fechaRadicacion ? formatDate(r.fechaRadicacion) : 'Pendiente'}
                      </span>
                    </div>
                    <Badge status={r.estado} size="sm" />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
