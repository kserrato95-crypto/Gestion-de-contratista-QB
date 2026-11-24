import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate, formatCOP } from '../../lib/api.js';
import { ActivityReport, Contract, User } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { OfficialActaViewer } from '../acta/OfficialActaViewer.js';
import { GoogleSheetsExportModal } from '../common/GoogleSheetsExportModal.js';
import {
  FileCheck,
  Search,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  Download,
  Filter,
  User as UserIcon,
  Building,
  RefreshCw,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

export const SupervisorActasPendientes: React.FC = () => {
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('pendientes');
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);

  // Selected report for 8-page full review
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<{
    report: ActivityReport;
    contract: Contract;
    contractor: User;
  } | null>(null);
  const [loadingActa, setLoadingActa] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [reportsRes, contractsRes, contractorsRes] = await Promise.all([
        apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] })),
        apiRequest<{ contracts: Contract[] }>('/api/contracts').catch(() => ({ contracts: [] })),
        apiRequest<{ contractors: User[] }>('/api/contractors').catch(() => ({ contractors: [] })),
      ]);
      setReports(Array.isArray(reportsRes?.reports) ? reportsRes.reports : []);
      setContracts(Array.isArray(contractsRes?.contracts) ? contractsRes.contracts : []);
      setUsers(Array.isArray(contractorsRes?.contractors) ? contractorsRes.contractors : []);
    } catch (err) {
      console.error('Error loading supervisor actas:', err);
      setReports([]);
      setContracts([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleOpenActa = async (reportId: string) => {
    try {
      setLoadingActa(true);
      const res = await apiRequest<{
        report: ActivityReport;
        contract: Contract;
        contractor: User;
      }>(`/api/reports/${reportId}`);
      setSelectedReportData(res);
      setSelectedReportId(reportId);
    } catch (err: any) {
      alert(err.message || 'Error al cargar el acta oficial.');
    } finally {
      setLoadingActa(false);
    }
  };

  const handleApprove = async (reportId: string, updates?: Partial<ActivityReport>) => {
    try {
      const res = await apiRequest<{ report: ActivityReport; message: string }>(
        `/api/reports/${reportId}/review`,
        {
          method: 'POST',
          data: {
            decision: 'Aprobado',
            ...updates,
          },
        }
      );
      alert(res.message);
      // Reload and update
      await loadAllData();
      if (selectedReportId === reportId && selectedReportData) {
        setSelectedReportData({
          ...selectedReportData,
          report: res.report,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Error al aprobar el acta.');
    }
  };

  const handleReturn = async (reportId: string, observaciones: string) => {
    try {
      const res = await apiRequest<{ report: ActivityReport; message: string }>(
        `/api/reports/${reportId}/review`,
        {
          method: 'POST',
          data: {
            decision: 'Devuelto',
            observaciones,
          },
        }
      );
      alert(res.message);
      await loadAllData();
      if (selectedReportId === reportId && selectedReportData) {
        setSelectedReportData({
          ...selectedReportData,
          report: res.report,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Error al devolver el acta.');
    }
  };

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      (r.numeroContrato || '').toLowerCase().includes(q) ||
      (r.contratistaNombre || '').toLowerCase().includes(q) ||
      (r.periodo || '').toLowerCase().includes(q) ||
      (r.numeroRadicacion || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (stateFilter === 'pendientes') {
      return r.estado === 'Radicado' || r.estado === 'En revisión';
    } else if (stateFilter === 'devueltos') {
      return r.estado === 'Devuelto' || r.estado === 'Con observaciones';
    } else if (stateFilter === 'aprobados') {
      return r.estado === 'Aprobado';
    } else if (stateFilter === 'borradores') {
      return r.estado === 'Borrador';
    }
    return true; // 'todos'
  });

  // If viewing an official 8-page Acta
  if (selectedReportData) {
    return (
      <div className="space-y-4">
        <OfficialActaViewer
          report={selectedReportData.report}
          contract={selectedReportData.contract}
          contractor={selectedReportData.contractor}
          isSupervisor={true}
          onApprove={handleApprove}
          onReturn={handleReturn}
          onClose={() => {
            setSelectedReportData(null);
            setSelectedReportId(null);
          }}
        />
      </div>
    );
  }

  const handleDownloadDirect = async (reportId: string, contractNum: string, actaNum: number) => {
    try {
      const token = localStorage.getItem('gestion_contratistas_token');
      const response = await fetch(`/api/reports/${reportId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Error al generar el PDF del acta oficial.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (contractNum || 'Contrato').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Acta_Supervision_No_${actaNum || 2}_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Error al descargar el PDF.');
    }
  };

  const handleDownloadDocxDirect = async (reportId: string, contractNum: string, actaNum: number) => {
    try {
      const token = localStorage.getItem('gestion_contratistas_token');
      const response = await fetch(`/api/reports/${reportId}/docx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Error al generar el documento Word (.DOCX).');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (contractNum || 'Contrato').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Acta_Supervision_No_${actaNum || 1}_${safeName}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Error al descargar el documento Word.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-900">
            <Building className="w-4 h-4 text-amber-500" />
            Supervisión Contractual Oficial • Quimbaya
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-blue-900" />
            Actas de supervisión
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Consulta y validación técnica de las actas de supervisión de sus contratos asignados, revisión de obligaciones, evidencias y aprobación oficial para pago.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setSheetsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
            title="Sincronizar y guardar las actas en Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Exportar a Google Sheets
          </button>
          <button
            onClick={loadAllData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filter tabs and search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por contratista, contrato, radicado..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-none bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
          {[
            { id: 'pendientes', label: 'Pendientes por Revisar' },
            { id: 'devueltos', label: 'Devueltos' },
            { id: 'aprobados', label: 'Aprobadas' },
            { id: 'borradores', label: 'Borradores' },
            { id: 'todos', label: 'Todas las Actas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                stateFilter === tab.id
                  ? 'bg-blue-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List / Cards of Actas */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No se encontraron actas con el filtro seleccionado
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {stateFilter === 'pendientes'
              ? 'No hay actas radicadas en espera de revisión técnica en este momento.'
              : 'Pruebe seleccionando otra pestaña de estado o limpiando el texto de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const hasPhotos = (r.actividades || []).some(
              (a) => a.fotografias && a.fotografias.length > 0
            );
            return (
              <div
                key={r.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                      Acta N.º {r.numeroActa || 2}
                    </span>
                    <Badge status={r.estado} size="sm" />
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-2 leading-tight">
                    {r.contratistaNombre}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Contrato: <span className="font-semibold text-slate-700">{r.numeroContrato}</span>
                  </p>
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    Período: <span className="font-semibold text-blue-900">{r.periodo}</span>
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span>Radicación:</span>
                    <span className="font-medium text-slate-700">
                      {r.fechaRadicacion ? formatDate(r.fechaRadicacion) : 'En trámite'}
                    </span>
                    {r.numeroRadicacion && (
                      <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                        {r.numeroRadicacion}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Obligaciones reportadas:</span>
                    <span className="font-bold text-slate-800">{(r.actividades || []).length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Honorario del período:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {formatCOP(r.financiero?.valorPresentePago || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Avance en tiempo (Acum.):</span>
                    <span className="font-semibold text-blue-900">
                      {typeof r.financiero?.porcentajeAvanceTiempoAcumulado === 'number'
                        ? `${r.financiero.porcentajeAvanceTiempoAcumulado.toFixed(1).replace('.', ',')} %`
                        : '0,0 %'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Soporte fotográfico:</span>
                    <span className="font-semibold text-slate-800">
                      {hasPhotos ? '📷 Fotos adjuntas' : 'Sin fotos'}
                    </span>
                  </div>
                  {r.observacionesSupervisor && (r.estado === 'Devuelto' || r.estado === 'Con observaciones') && (
                    <div className="pt-1 text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                      ⚠️ Observación: "{r.observacionesSupervisor}"
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenActa(r.id)}
                    className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-amber-300" />
                    Ver acta
                  </button>
                  <button
                    onClick={() => handleDownloadDocxDirect(r.id, r.numeroContrato, r.numeroActa)}
                    className="py-2 px-2.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-300 flex items-center justify-center gap-1 transition-colors"
                    title="Descargar documento completo editable en Word (.DOCX)"
                  >
                    <FileText className="w-4 h-4 text-blue-700" />
                    Word
                  </button>
                  <button
                    onClick={() => handleDownloadDirect(r.id, r.numeroContrato, r.numeroActa)}
                    className="py-2 px-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 flex items-center justify-center gap-1 transition-colors"
                    title="Descargar documento completo en PDF"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                    PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Google Sheets Export Modal */}
      <GoogleSheetsExportModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        reports={filtered}
        contracts={contracts}
        defaultTitle={`Actas de Supervisión - Contratos Asignados (${new Date().toLocaleDateString('es-CO')})`}
      />
    </div>
  );
};
