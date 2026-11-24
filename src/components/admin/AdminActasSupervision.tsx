import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate, formatCOP } from '../../lib/api.js';
import { ActivityReport, Contract, User, PaymentRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { OfficialActaViewer } from '../acta/OfficialActaViewer.js';
import { GoogleSheetsExportModal } from '../common/GoogleSheetsExportModal.js';
import {
  FileCheck2,
  Search,
  Eye,
  Download,
  Filter,
  Clock,
  History,
  ShieldCheck,
  CreditCard,
  Building,
  RefreshCw,
  AlertCircle,
  X,
  FileSpreadsheet,
  CheckCircle,
  FileText,
} from 'lucide-react';

export const AdminActasSupervision: React.FC = () => {
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractors, setContractors] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('todos');

  // Selected Acta for full 8-page review
  const [selectedReportData, setSelectedReportData] = useState<{
    report: ActivityReport;
    contract: Contract | null;
    contractor: User | null;
  } | null>(null);
  const [loadingActa, setLoadingActa] = useState(false);

  // Selected report for traceability history modal
  const [traceabilityReport, setTraceabilityReport] = useState<ActivityReport | null>(null);

  const loadAllAdminData = async () => {
    try {
      setLoading(true);
      const [reportsRes, contractsRes, contractorsRes, supervisorsRes, paymentsRes] =
        await Promise.all([
          apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] })),
          apiRequest<{ contracts: Contract[] }>('/api/contracts').catch(() => ({ contracts: [] })),
          apiRequest<{ contractors: User[] }>('/api/contractors').catch(() => ({ contractors: [] })),
          apiRequest<{ supervisors: User[] }>('/api/admin/supervisors').catch(() => ({ supervisors: [] })),
          apiRequest<{ payments: PaymentRecord[] }>('/api/payments').catch(() => ({ payments: [] })),
        ]);

      setReports(Array.isArray(reportsRes?.reports) ? reportsRes.reports : []);
      setContracts(Array.isArray(contractsRes?.contracts) ? contractsRes.contracts : []);
      setContractors(Array.isArray(contractorsRes?.contractors) ? contractorsRes.contractors : []);
      setSupervisors(Array.isArray(supervisorsRes?.supervisors) ? supervisorsRes.supervisors : []);
      setPayments(Array.isArray(paymentsRes?.payments) ? paymentsRes.payments : []);
    } catch (err) {
      console.error('Error loading admin actas data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const handleOpenActa = async (reportId: string) => {
    try {
      setLoadingActa(true);
      const res = await apiRequest<{
        report: ActivityReport;
        contract: Contract | null;
        contractor: User | null;
      }>(`/api/reports/${reportId}`);
      setSelectedReportData(res);
    } catch (err: any) {
      alert(err.message || 'Error al cargar los datos del acta.');
    } finally {
      setLoadingActa(false);
    }
  };

  const handleDownloadPdf = async (reportId: string, contractNum?: string, actaNum?: number) => {
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

  const handleDownloadDocx = async (reportId: string, contractNum?: string, actaNum?: number) => {
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

  // Enriched reports matching contracts and supervisors
  const enrichedReports = reports.map((r) => {
    const contract = contracts.find((c) => c.id === r.contratoId);
    const contractor = contractors.find((c) => c.id === r.contratistaId);
    const payment = payments.find((p) => p.informeId === r.id);
    return {
      ...r,
      contractObj: contract,
      contractorObj: contractor,
      paymentObj: payment,
      supervisorNombre: contract?.supervisorResponsable || 'No asignado',
      supervisorDoc: contract?.supervisorDocumento || '',
      contractorDoc: contractor?.numeroDocumento || '',
    };
  });

  const filtered = enrichedReports.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      (r.numeroContrato || '').toLowerCase().includes(q) ||
      (r.contratistaNombre || '').toLowerCase().includes(q) ||
      (r.contractorDoc || '').toLowerCase().includes(q) ||
      (r.supervisorNombre || '').toLowerCase().includes(q) ||
      (r.supervisorDoc || '').toLowerCase().includes(q) ||
      (r.periodo || '').toLowerCase().includes(q) ||
      (r.numeroRadicacion || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (stateFilter === 'todos') return true;
    if (stateFilter === 'borrador') return r.estado === 'Borrador';
    if (stateFilter === 'radicado') return r.estado === 'Radicado';
    if (stateFilter === 'en-revision') return r.estado === 'En revisión';
    if (stateFilter === 'devuelto') return r.estado === 'Devuelto';
    if (stateFilter === 'con-observaciones') return r.estado === 'Con observaciones';
    if (stateFilter === 'aprobado') return r.estado === 'Aprobado';

    return true;
  });

  // If viewing the complete official Acta
  if (selectedReportData) {
    return (
      <div className="space-y-4">
        <OfficialActaViewer
          report={selectedReportData.report}
          contract={selectedReportData.contract}
          contractor={selectedReportData.contractor}
          isSupervisor={false}
          onClose={() => setSelectedReportData(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-900">
            <Building className="w-4 h-4 text-purple-700" />
            Control Institucional General • Despacho de Administración
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-purple-900" />
            Actas de supervisión
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Consulta consolidada de todas las actas de supervisión de la entidad, auditoría de trazabilidad, estados de radicación, verificación de soportes fotográficos y pagos asociados.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setSheetsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
            title="Sincronizar y guardar las actas en Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Exportar a Google Sheets
          </button>
          <button
            onClick={loadAllAdminData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notice on role boundary */}
      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Auditoría y Supervisión Administrativa</span>
          <span>
            El Administrador supervisa y audita la totalidad de actas y expedientes de la entidad. Las decisiones de aprobación técnica y suscripción oficial corresponden al supervisor designado en el contrato.
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por contrato, contratista, supervisor, radicado o cédula..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-purple-600 outline-none bg-slate-50/50"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total encontradas: <span className="font-bold text-slate-800">{filtered.length}</span>
          </div>
        </div>

        {/* State Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-400 font-semibold mr-1 shrink-0">Filtrar estado:</span>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'radicado', label: 'Radicados' },
            { id: 'en-revision', label: 'En revisión' },
            { id: 'devuelto', label: 'Devueltos' },
            { id: 'con-observaciones', label: 'Con observaciones' },
            { id: 'aprobado', label: 'Aprobados' },
            { id: 'borrador', label: 'Borradores' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                stateFilter === tab.id
                  ? 'bg-purple-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actas Table / Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No se encontraron actas con los criterios de búsqueda
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Pruebe modificando el término de búsqueda o seleccionando la pestaña "Todos".
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Acta / Radicación</th>
                  <th className="py-3 px-4">Contrato</th>
                  <th className="py-3 px-4">Contratista</th>
                  <th className="py-3 px-4">Supervisor Asignado</th>
                  <th className="py-3 px-4">Período Informado</th>
                  <th className="py-3 px-4 text-center">Estado Acta</th>
                  <th className="py-3 px-4 text-center">Estado Pago</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filtered.map((r) => {
                  const hasPhotos = (r.actividades || []).some(
                    (a) => a.fotografias && a.fotografias.length > 0
                  );
                  const payState = r.paymentObj?.estado || (r.estado === 'Aprobado' ? 'Certificado por supervisión' : 'Pendiente certificación');

                  return (
                    <tr key={r.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">
                          Acta N.º {r.numeroActa || 2}
                        </div>
                        {r.numeroRadicacion ? (
                          <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 font-bold block w-fit mt-0.5">
                            {r.numeroRadicacion}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sin radicar</span>
                        )}
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {r.fechaRadicacion ? formatDate(r.fechaRadicacion) : 'En borrador'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block font-mono">
                          {r.numeroContrato}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {r.contractObj?.tipoContrato || 'Prestación de Servicios'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">
                          {r.contratistaNombre}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Doc: {r.contractorDoc || r.contractObj?.contratistaDocumento || '900687199-1'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {r.supervisorNombre}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          C.C. {r.supervisorDoc || '18470223'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-purple-950 block">
                          {r.periodo}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          $ {formatCOP(r.financiero?.valorPresentePago || 0)}
                          {typeof r.financiero?.porcentajeAvanceTiempoAcumulado === 'number' && (
                            <span className="text-purple-700 font-semibold ml-1">
                              ({r.financiero.porcentajeAvanceTiempoAcumulado.toFixed(1).replace('.', ',')}%)
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge status={r.estado} size="sm" />
                        {hasPhotos && (
                          <span className="text-[9.5px] text-blue-700 block mt-1 font-medium">
                            📷 Fotos adjuntas
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            payState === 'Pagado'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : payState === 'Certificado por supervisión'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {payState}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenActa(r.id)}
                            className="px-2.5 py-1.5 bg-purple-900 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                            title="Abrir acta oficial completa de 8 páginas"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-300" />
                            Ver acta
                          </button>

                          <button
                            onClick={() => handleDownloadDocx(r.id, r.numeroContrato, r.numeroActa)}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                            title="Descargar en Word (.DOCX)"
                          >
                            <FileText className="w-4 h-4 text-blue-700" />
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(r.id, r.numeroContrato, r.numeroActa)}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                            title="Descargar en PDF"
                          >
                            <Download className="w-4 h-4 text-emerald-700" />
                          </button>

                          <button
                            onClick={() => setTraceabilityReport(r)}
                            className="p-1.5 text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
                            title="Consultar trazabilidad e historial"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Trazabilidad Historial */}
      {traceabilityReport && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-700" />
                <h3 className="font-bold text-base text-slate-900">
                  Trazabilidad Oficial del Documento
                </h3>
              </div>
              <button
                onClick={() => setTraceabilityReport(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Documento:</span>
                <span className="font-bold text-slate-800">
                  Acta No. {traceabilityReport.numeroActa || 2}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Consecutivo Radicado:</span>
                <span className="font-mono font-bold text-purple-900">
                  {traceabilityReport.numeroRadicacion || 'Pendiente de radicación'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contrato:</span>
                <span className="font-semibold text-slate-800">
                  {traceabilityReport.numeroContrato}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contratista:</span>
                <span className="font-semibold text-slate-800">
                  {traceabilityReport.contratistaNombre}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Período:</span>
                <span className="font-semibold text-slate-800">
                  {traceabilityReport.periodo}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Línea de Tiempo y Registro de Auditoría
              </h4>

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                {(traceabilityReport.historialEstados && traceabilityReport.historialEstados.length > 0
                  ? traceabilityReport.historialEstados
                  : [
                      {
                        estado: traceabilityReport.estado,
                        fecha: traceabilityReport.createdAt || new Date().toISOString(),
                        usuario: traceabilityReport.contratistaNombre,
                        observaciones: 'Creación de informe.',
                      },
                    ]
                ).map((h, i) => (
                  <div key={i} className="relative flex items-start gap-3 pl-8 text-xs">
                    <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-purple-700 border-2 border-white ring-1 ring-purple-300" />
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 w-full space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge status={h.estado} size="sm" />
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatDate(h.fecha)}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-800">
                        Responsable: {h.usuario || 'Sistema'}
                      </p>
                      {h.observaciones && (
                        <p className="text-slate-600 italic text-[11px] bg-white p-1.5 rounded border border-slate-100">
                          "{h.observaciones}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setTraceabilityReport(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Cerrar Trazabilidad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Export Modal */}
      <GoogleSheetsExportModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        reports={filtered}
        contracts={contracts}
        defaultTitle={`Actas de Supervisión - Alcaldía de Quimbaya (${new Date().toLocaleDateString('es-CO')})`}
      />
    </div>
  );
};
