import React, { useState, useEffect } from 'react';
import { apiRequest, formatCOP, formatDate } from '../../lib/api.js';
import { AdminStats, AuditLog, User, Contract } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import {
  Shield,
  Users,
  UserCheck,
  FileText,
  FileCheck2,
  Clock,
  Activity,
  Plus,
  ArrowUpRight,
  Building,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface AdminInicioProps {
  onNavigate: (section: string) => void;
  onOpenNewSupervisor?: () => void;
}

export const AdminInicio: React.FC<AdminInicioProps> = ({
  onNavigate,
  onOpenNewSupervisor,
}) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes, supRes] = await Promise.all([
        apiRequest<AdminStats>('/api/admin/stats'),
        apiRequest<{ auditLogs: AuditLog[] }>('/api/admin/audit-logs'),
        apiRequest<{ supervisors: User[] }>('/api/admin/supervisors'),
      ]);
      setStats(statsRes);
      setRecentLogs(logsRes.auditLogs.slice(0, 6));
      setSupervisors(supRes.supervisors);
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-900">
            <Shield className="w-4 h-4 text-purple-700" />
            Despacho de Administración General del Sistema
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Panel de Control del Administrador
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Gestión de roles institucionales, supervisión de procesos, auditoría oficial y seguridad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('actas-pendientes')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-xs transition-colors"
          >
            <FileCheck2 className="w-4 h-4 text-amber-300" />
            Actas de supervisión
          </button>
          <button
            onClick={() => onNavigate('supervisores')}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-900 text-white rounded-lg text-xs font-semibold hover:bg-purple-800 shadow-xs transition-colors"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            Administrar Supervisores
          </button>
          <button
            onClick={() => onNavigate('auditoria')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 shadow-xs transition-colors"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            Bitácora de Auditoría
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Supervisores */}
        <div
          onClick={() => onNavigate('supervisores')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Supervisores
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700 group-hover:bg-purple-100 transition-colors">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {stats ? stats.totalSupervisores : 0}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">
                {stats ? stats.supervisoresActivos : 0} activos
              </span>
              <span>en la entidad</span>
            </div>
          </div>
        </div>

        {/* 2. Contratistas */}
        <div
          onClick={() => onNavigate('contratistas')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Contratistas
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {stats ? stats.totalContratistas : 0}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-blue-600">
                {stats ? stats.contratistasActivos : 0} vinculados
              </span>
              <span>mediante contrato</span>
            </div>
          </div>
        </div>

        {/* 3. Contratos */}
        <div
          onClick={() => onNavigate('contratos')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Contratos
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {stats ? stats.totalContratos : 0}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">
                {stats ? stats.contratosActivos : 0} vigentes
              </span>
              <span>en ejecución</span>
            </div>
          </div>
        </div>

        {/* 4. Auditoría */}
        <div
          onClick={() => onNavigate('auditoria')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Eventos de Auditoría
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-100 transition-colors">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {stats ? stats.totalEventosAuditoria : 0}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-amber-600">100% trazables</span>
              <span>acciones registradas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Supervisors & Audit log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Supervisors Table overview */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-700" />
                Supervisores Institucionales Designados
              </h2>
              <p className="text-xs text-slate-500">
                Servidores públicos facultados para crear contratistas y suscribir actas.
              </p>
            </div>
            <button
              onClick={() => onNavigate('supervisores')}
              className="text-xs font-semibold text-purple-900 hover:text-purple-700 flex items-center gap-1"
            >
              Ver todos ({supervisors.length}) &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {supervisors.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No hay supervisores registrados.</p>
            ) : (
              supervisors.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {s.nombres} {s.apellidos}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          s.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.estado.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">
                      {s.profesion || 'Cargo institucional'} • C.C. {s.numeroDocumento}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{s.email}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-purple-900 block">
                      {s.totalContratosSupervisados || 0} contratos
                    </span>
                    <span className="text-[10px] text-slate-500">asignados</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Recent Audit Activities */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-600" />
                Bitácora Reciente
              </h2>
              <p className="text-xs text-slate-500">Eventos de seguridad y control</p>
            </div>
            <button
              onClick={() => onNavigate('auditoria')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900"
            >
              Auditoría &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No hay registros de auditoría aún.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="text-xs p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded">
                      {log.accion}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(log.fecha)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-snug line-clamp-2">
                    {log.detalles}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Por: <span className="font-medium text-slate-800">{log.usuarioNombre}</span> ({log.usuarioRol})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
