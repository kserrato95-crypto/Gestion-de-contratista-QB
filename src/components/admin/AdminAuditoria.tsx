import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate } from '../../lib/api.js';
import { AuditLog } from '../../types/index.js';
import {
  Activity,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  User,
  Clock,
  RefreshCw,
} from 'lucide-react';

export const AdminAuditoria: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('todos');

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ auditLogs: AuditLog[] }>('/api/admin/audit-logs');
      setLogs(res.auditLogs);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const matchesModule = moduleFilter === 'todos' || l.modulo === moduleFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      l.accion.toLowerCase().includes(q) ||
      l.detalles.toLowerCase().includes(q) ||
      l.usuarioNombre.toLowerCase().includes(q);
    return matchesModule && matchesSearch;
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREACION') || action.includes('APROBACION')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (action.includes('DEVOLUCION') || action.includes('INACTIV') || action.includes('RESTABLECER')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (action.includes('INICIO_SESION')) {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    return 'bg-purple-50 text-purple-800 border-purple-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-900" />
            Bitácora Oficial de Auditoría y Trazabilidad
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Registro cronológico inmutable de todas las acciones operativas, cambios de rol, aprobaciones y seguridad.
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Registros
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por acción, usuario o detalles..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-purple-600 outline-hidden bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['todos', 'usuarios', 'contratos', 'informes', 'seguridad', 'sistema'].map((mod) => (
            <button
              key={mod}
              onClick={() => setModuleFilter(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                moduleFilter === mod
                  ? 'bg-purple-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Fecha y Hora</th>
                <th className="px-5 py-3.5">Módulo</th>
                <th className="px-5 py-3.5">Acción</th>
                <th className="px-5 py-3.5">Usuario Responsable</th>
                <th className="px-5 py-3.5">Detalles del Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-500">
                    No se encontraron registros de auditoría con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {formatDate(log.fecha)} {new Date(log.fecha).toLocaleTimeString('es-CO')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-xs text-slate-700 capitalize">
                        {log.modulo}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${getActionBadgeColor(
                          log.accion
                        )}`}
                      >
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{log.usuarioNombre}</div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                        {log.usuarioRol}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 leading-relaxed max-w-md">
                      {log.detalles}
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
