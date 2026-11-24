import React, { useState, useEffect } from 'react';
import {
  apiRequest,
  formatDate,
  formatCOP,
  uploadEvidenceFile,
  deleteUploadedFile,
  getStoredToken,
} from '../../lib/api.js';
import {
  ActivityReport,
  Contract,
  ReportActivityItem,
  User,
} from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { OfficialActaViewer } from '../acta/OfficialActaViewer.js';
import { GoogleSheetsExportModal } from '../common/GoogleSheetsExportModal.js';
import {
  FileSpreadsheet,
  Plus,
  Eye,
  CheckCircle,
  AlertCircle,
  Save,
  Camera,
  Paperclip,
  Trash2,
  Calendar,
  FileCheck,
  Download,
  AlertTriangle,
  Loader2,
  UploadCloud,
  FileText,
  RotateCw,
} from 'lucide-react';
import { getContractPeriods } from '../../utils/contractDuration.js';

interface ContratistaMisInformesProps {
  isNewModalOpen: boolean;
  onCloseNewModal: () => void;
  onOpenNewModal: () => void;
}

export const ContratistaMisInformes: React.FC<ContratistaMisInformesProps> = ({
  isNewModalOpen,
  onCloseNewModal,
  onOpenNewModal,
}) => {
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractorUser, setContractorUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected report for 8-page official preview
  const [viewingActaReport, setViewingActaReport] = useState<ActivityReport | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  // Editor form state
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [periodo, setPeriodo] = useState('25/04/2026 - 24/08/2026');
  const [fechaInicioPeriodo, setFechaInicioPeriodo] = useState('2026-04-25');
  const [fechaFinPeriodo, setFechaFinPeriodo] = useState('2026-08-24');
  const [activitiesState, setActivitiesState] = useState<ReportActivityItem[]>([]);
  const [logros, setLogros] = useState('');
  const [dificultades, setDificultades] = useState('');
  const [formSupervisorNotes, setFormSupervisorNotes] = useState<string | null>(null);

  // Uploading state indicators per obligation to avoid HTTP 413
  const [uploadingPhotoIdx, setUploadingPhotoIdx] = useState<number | null>(null);
  const [uploadingDocIdx, setUploadingDocIdx] = useState<number | null>(null);
  const [uploadingPila, setUploadingPila] = useState(false);
  const [pilaUploadedFileName, setPilaUploadedFileName] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Social security section in form
  const [pilaPlanillaNo, setPilaPlanillaNo] = useState('9845217430');
  const [pilaOperador, setPilaOperador] = useState('SOI');
  const [pilaPeriodoCotizado, setPilaPeriodoCotizado] = useState('Mayo - Agosto 2026');
  const [pilaValorTotal, setPilaValorTotal] = useState<number>(10769300);
  const [pilaSaludEntidad, setPilaSaludEntidad] = useState('Nueva EPS');
  const [pilaSaludValor, setPilaSaludValor] = useState<number>(1732200);
  const [pilaPensionEntidad, setPilaPensionEntidad] = useState('Colfondos');
  const [pilaPensionValor, setPilaPensionValor] = useState<number>(7078400);
  const [pilaArlEntidad, setPilaArlEntidad] = useState('Positiva Compañía de Seguros S.A.');
  const [pilaArlValor, setPilaArlValor] = useState<number>(226500);
  const [pilaCajaEntidad, setPilaCajaEntidad] = useState('Comfenalco');
  const [pilaCajaValor, setPilaCajaValor] = useState<number>(1732200);

  // Active step in editor modal: 'obligaciones' | 'seguridad' | 'datos'
  const [editorTab, setEditorTab] = useState<'obligaciones' | 'seguridad' | 'datos'>('obligaciones');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);

  // Automatic contractual metrics calculation
  const [previewMetrics, setPreviewMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const formatPct = (val?: number) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0,00 %';
    return `${Number(val).toFixed(2).replace('.', ',')} %`;
  };

  useEffect(() => {
    if (!selectedContractId || !fechaInicioPeriodo || !fechaFinPeriodo) return;
    let cancelled = false;
    const fetchPreview = async () => {
      try {
        setLoadingMetrics(true);
        const q = new URLSearchParams({
          contratoId: selectedContractId,
          fechaInicioPeriodo,
          fechaFinPeriodo,
          ...(editingReportId ? { reportId: editingReportId } : {}),
        });
        const res = await apiRequest<any>(`/api/reports/preview-metricas?${q.toString()}`);
        if (!cancelled && res?.success) {
          setPreviewMetrics(res);
        }
      } catch (e) {
        console.error('Error fetching preview metrics:', e);
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    };
    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedContractId, fechaInicioPeriodo, fechaFinPeriodo, editingReportId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsRes, contractsRes, meRes] = await Promise.all([
        apiRequest<{ reports: ActivityReport[] }>('/api/reports').catch(() => ({ reports: [] })),
        apiRequest<{ contracts: Contract[] }>('/api/contracts').catch(() => ({ contracts: [] })),
        apiRequest<{ user: User }>('/api/auth/me').catch(() => ({ user: null as any })),
      ]);
      const safeReports = Array.isArray(reportsRes?.reports) ? reportsRes.reports : [];
      const safeContracts = Array.isArray(contractsRes?.contracts) ? contractsRes.contracts : [];
      setReports(safeReports);
      setContracts(safeContracts);
      setContractorUser(meRes?.user || null);

      if (safeContracts.length > 0 && !selectedContractId) {
        const c = safeContracts[0];
        setSelectedContractId(c.id);
        if (activitiesState.length === 0) {
          initActivitiesForContract(c);
        }
      }
    } catch (err) {
      console.error('Error loading reports or contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const initActivitiesForContract = (contract: Contract) => {
    const items: ReportActivityItem[] = contract.obligacionesContractuales.map((ob, idx) => ({
      id: `act-${idx + 1}`,
      obligacion: ob,
      actividadRealizada: '',
      productos: '',
      fechas: '',
      fotografias: [],
      soportes: [],
    }));
    setActivitiesState(items);
  };

  const handleContractChange = (contractId: string) => {
    setSelectedContractId(contractId);
    const c = contracts.find((ct) => ct.id === contractId);
    if (c) {
      initActivitiesForContract(c);
    }
  };

  const handleActivityChange = (index: number, field: keyof ReportActivityItem, val: any) => {
    const updated = [...activitiesState];
    updated[index] = { ...updated[index], [field]: val };
    setActivitiesState(updated);
  };

  // UPLOAD SINGLE PHOTO INDEPENDENTLY (Eliminates HTTP 413 Base64 overload)
  const handleAddPhoto = async (activityIndex: number, file: File) => {
    try {
      setUploadingPhotoIdx(activityIndex);
      setFormError(null);

      const targetObligacion = activitiesState[activityIndex];
      const res = await uploadEvidenceFile(file, {
        contratoId: selectedContractId,
        obligacionId: targetObligacion.id || `act-${activityIndex + 1}`,
        tipo: 'fotografia',
        descripcion: file.name.replace(/\.[^/.]+$/, ''),
      });

      const updated = [...activitiesState];
      const photos = updated[activityIndex].fotografias || [];
      photos.push({
        id: res.file.id,
        fileId: res.file.id,
        url: res.file.url,
        descripcion: res.file.descripcion || file.name.replace(/\.[^/.]+$/, ''),
        fecha: new Date().toISOString().slice(0, 10),
        size: res.file.size,
        mimeType: res.file.mimeType,
      });
      updated[activityIndex].fotografias = photos;
      setActivitiesState(updated);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setFormError(`Error al subir fotografía "${file.name}": ${err.message || 'Error de red'}`);
    } finally {
      setUploadingPhotoIdx(null);
    }
  };

  const handleRemovePhoto = async (activityIndex: number, photoId: string) => {
    const updated = [...activitiesState];
    updated[activityIndex].fotografias = (updated[activityIndex].fotografias || []).filter(
      (p) => p.id !== photoId
    );
    setActivitiesState(updated);
    try {
      await deleteUploadedFile(photoId);
    } catch {
      // Best effort deletion from server
    }
  };

  // UPLOAD SUPPORTING DOCUMENT (PDF, Word, Excel)
  const handleAddDocumentFile = async (activityIndex: number, file: File) => {
    try {
      setUploadingDocIdx(activityIndex);
      setFormError(null);

      const targetObligacion = activitiesState[activityIndex];
      const res = await uploadEvidenceFile(file, {
        contratoId: selectedContractId,
        obligacionId: targetObligacion.id || `act-${activityIndex + 1}`,
        tipo: 'soporte',
        descripcion: file.name,
      });

      const updated = [...activitiesState];
      const docs = updated[activityIndex].soportes || [];
      docs.push({
        id: res.file.id,
        fileId: res.file.id,
        nombre: res.file.originalName,
        url: res.file.url,
        size: res.file.size,
        tipo: file.name.endsWith('.pdf') ? 'PDF' : 'DOC',
        fecha: new Date().toISOString().slice(0, 10),
      });
      updated[activityIndex].soportes = docs;
      setActivitiesState(updated);
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setFormError(`Error al subir soporte "${file.name}": ${err.message || 'Error de red'}`);
    } finally {
      setUploadingDocIdx(null);
    }
  };

  const handleRemoveDocument = async (activityIndex: number, docId: string) => {
    const updated = [...activitiesState];
    updated[activityIndex].soportes = (updated[activityIndex].soportes || []).filter(
      (d) => d.id !== docId
    );
    setActivitiesState(updated);
    try {
      await deleteUploadedFile(docId);
    } catch {
      // Best effort
    }
  };

  // UPLOAD PILA SOCIAL SECURITY DOCUMENT
  const handleUploadPilaFile = async (file: File) => {
    try {
      setUploadingPila(true);
      setFormError(null);
      const res = await uploadEvidenceFile(file, {
        contratoId: selectedContractId,
        tipo: 'seguridad_social',
        descripcion: `Planilla PILA No. ${pilaPlanillaNo || file.name}`,
      });
      setPilaUploadedFileName(res.file.originalName);
    } catch (err: any) {
      console.error('Error uploading PILA file:', err);
      setFormError(`Error al subir soporte de seguridad social: ${err.message || 'Error de carga'}`);
    } finally {
      setUploadingPila(false);
    }
  };

  // Open existing report to edit or adjust
  const handleEditExistingReport = (rep: ActivityReport) => {
    setEditingReportId(rep.id);
    setSelectedContractId(rep.contratoId);
    setPeriodo(rep.periodo);
    setFechaInicioPeriodo(rep.fechaInicioPeriodo);
    setFechaFinPeriodo(rep.fechaFinPeriodo);
    setActivitiesState(rep.actividades || []);
    setLogros(rep.logros || '');
    setDificultades(rep.dificultades || '');
    setFormSupervisorNotes(rep.observacionesSupervisor || null);

    if (rep.aportesSeguridadSocial && rep.aportesSeguridadSocial.length > 0) {
      const ap = rep.aportesSeguridadSocial[0];
      setPilaPlanillaNo(ap.planillaNo || '');
      setPilaOperador(ap.entidad || 'SOI');
      setPilaPeriodoCotizado(ap.periodoCotizacion || '');
      setPilaValorTotal(ap.valorAporte || 0);
      setPilaSaludEntidad(ap.salud?.entidad || 'Nueva EPS');
      setPilaSaludValor(ap.salud?.valor || 0);
      setPilaPensionEntidad(ap.pension?.entidad || 'Colfondos');
      setPilaPensionValor(ap.pension?.valor || 0);
      setPilaArlEntidad(ap.riesgosLaborales?.entidad || 'Positiva');
      setPilaArlValor(ap.riesgosLaborales?.valor || 0);
      setPilaCajaEntidad(ap.cajaCompensacion?.entidad || 'Comfenalco');
      setPilaCajaValor(ap.cajaCompensacion?.valor || 0);
    }

    setEditorTab('obligaciones');
    onOpenNewModal();
  };

  // SUBMIT OR SAVE REPORT WITH RESILIENT RADICACIÓN
  const handleSaveReport = async (radicar: boolean) => {
    setFormError(null);

    if (!selectedContractId || !periodo || !fechaInicioPeriodo || !fechaFinPeriodo) {
      setFormError('Por favor indique el contrato, el período y las fechas correspondientes.');
      return;
    }

    if (radicar) {
      const emptyIdx = activitiesState.findIndex((a) => !a.actividadRealizada || !a.actividadRealizada.trim());
      if (emptyIdx !== -1) {
        setFormError(
          `Para radicar formalmente ante la supervisión, debe describir las actividades desarrolladas en la obligación ${emptyIdx + 1}.`
        );
        return;
      }
    }

    // Lightweight payload referencing uploaded files (NO giant Base64 strings)
    const payload = {
      contratoId: selectedContractId,
      periodo,
      fechaInicioPeriodo,
      fechaFinPeriodo,
      actividades: activitiesState,
      logros,
      dificultades,
      radicar,
      aportesSeguridadSocial: [
        {
          comprobanteNo: pilaPlanillaNo || '6018142066',
          entidad: pilaOperador,
          planillaNo: pilaPlanillaNo,
          valorAporte: pilaValorTotal,
          periodoCotizacion: pilaPeriodoCotizado,
          salud: { entidad: pilaSaludEntidad, valor: pilaSaludValor },
          pension: { entidad: pilaPensionEntidad, valor: pilaPensionValor },
          riesgosLaborales: { entidad: pilaArlEntidad, valor: pilaArlValor },
          cajaCompensacion: { entidad: pilaCajaEntidad, valor: pilaCajaValor },
        },
      ],
    };

    try {
      setSubmitting(true);
      let resReport: ActivityReport;

      if (editingReportId) {
        const res = await apiRequest<{ report: ActivityReport; message: string; numeroRadicacion?: string }>(
          `/api/reports/${editingReportId}`,
          {
            method: 'PUT',
            data: payload,
          }
        );
        resReport = res.report;
        setReports(reports.map((r) => (r.id === resReport.id ? resReport : r)));
        alert(res.message);
      } else {
        const res = await apiRequest<{ report: ActivityReport; message: string; numeroRadicacion?: string }>(
          '/api/reports',
          {
            method: 'POST',
            data: payload,
          }
        );
        resReport = res.report;
        setReports([resReport, ...reports.filter((r) => r.id !== resReport.id)]);
        alert(res.message);
      }

      onCloseNewModal();
      setEditingReportId(null);
      await loadData();
    } catch (err: any) {
      console.error('Error saving or filing report:', err);
      // Requirement 3: Preserve user inputs without clearing, show explicit cause and allow retry
      setFormError(
        err.message ||
          'Inconveniente al generar el acta oficial. Toda la información y fotografías fueron conservadas para reintentar.'
      );
      // Reload reports to reflect draft status on dashboard
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // ONE-CLICK RETRY RADICACIÓN FROM LIST
  const handleRetryRadicacion = async (reportId: string) => {
    try {
      setRetryingId(reportId);
      const res = await apiRequest<{ report: ActivityReport; message: string; numeroRadicacion?: string }>(
        `/api/reports/${reportId}/radicar`,
        { method: 'POST', data: {} }
      );
      alert(res.message);
      await loadData();
    } catch (err: any) {
      alert(`Error al radicar: ${err.message}`);
      await loadData();
    } finally {
      setRetryingId(null);
    }
  };

  // Open 8-page full viewer for inspection
  const handleOpenViewer = (rep: ActivityReport) => {
    const c = contracts.find((ct) => ct.id === rep.contratoId) || contracts[0];
    setViewingContract(c);
    setViewingActaReport(rep);
  };

  if (viewingActaReport && viewingContract && contractorUser) {
    return (
      <div className="space-y-4">
        <OfficialActaViewer
          report={viewingActaReport}
          contract={viewingContract}
          contractor={contractorUser}
          isSupervisor={false}
          onClose={() => {
            setViewingActaReport(null);
            setViewingContract(null);
          }}
        />
      </div>
    );
  }

  const token = getStoredToken();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-900" />
            Mis Informes Mensuales de Actividades
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Diligenciamiento de actividades por obligación, registro de evidencias y generación oficial del Acta de Supervisión (8 Páginas) con radicación segura.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSheetsModalOpen(true)}
            disabled={reports.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Sincronizar y guardar las actas en Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Exportar a Google Sheets
          </button>

          <button
            onClick={() => {
              setEditingReportId(null);
              if (contracts.length > 0) {
                const targetContract = contracts.find((c) => c.id === selectedContractId) || contracts[0];
                initActivitiesForContract(targetContract);
                const periods = getContractPeriods(targetContract.fechaInicio, targetContract.fechaFin);
                const existingActas = new Set(reports.filter((r) => r.contratoId === targetContract.id).map((r) => r.numeroActa));
                const nextPeriod = periods.find((p) => !existingActas.has(p.numeroActa)) || periods[0];
                if (nextPeriod) {
                  setFechaInicioPeriodo(nextPeriod.fechaInicioPeriodo);
                  setFechaFinPeriodo(nextPeriod.fechaFinPeriodo);
                  setPeriodo(nextPeriod.periodoTexto);
                }
              }
              setFormSupervisorNotes(null);
              setEditorTab('obligaciones');
              setFormError(null);
              onOpenNewModal();
            }}
            disabled={contracts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            Nuevo Informe de Actividades
          </button>
        </div>
      </div>

      {contracts.length === 0 && (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Podrás redactar y radicar informes una vez la supervisión formalice tu contrato en el sistema.
          </span>
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Acta N.º</th>
                <th className="px-4 py-3.5">Consecutivo Radicación</th>
                <th className="px-4 py-3.5">Período Informado</th>
                <th className="px-4 py-3.5">No. Contrato</th>
                <th className="px-4 py-3.5">Fecha Radicación</th>
                <th className="px-4 py-3.5">Obligaciones</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-xs text-slate-500">
                    Aún no has registrado informes de actividades. Haz clic en "Nuevo Informe de Actividades".
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const isReturned = r.estado === 'Devuelto' || r.estado === 'Con observaciones';
                  const hasError = Boolean(r.estadoError);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isReturned ? 'bg-amber-50/40' : hasError ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-900">
                        Acta N.º {r.numeroActa || 2}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.numeroRadicacion ? (
                          <span className="font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-xs border border-blue-200">
                            {r.numeroRadicacion}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Borrador / Sin radicar</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">{r.periodo}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-700 text-xs">
                        {r.numeroContrato}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatDate(r.fechaRadicacion)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {r.actividades.length} obligaciones
                        {r.actividades.some((a) => a.fotografias && a.fotografias.length > 0) && (
                          <span className="ml-1 text-[10px] text-blue-700" title="Contiene fotos de evidencia">
                            📷
                          </span>
                        )}
                        {r.actividades.some((a) => a.soportes && a.soportes.length > 0) && (
                          <span className="ml-1 text-[10px] text-indigo-700" title="Contiene archivos de soporte">
                            📎
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge status={r.estado} size="sm" />
                        {hasError && (
                          <div
                            className="mt-1 text-[10px] text-red-700 font-semibold bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-1 justify-center max-w-[140px] truncate"
                            title={r.estadoError}
                          >
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            <span>Error al generar acta</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {/* Download real Word (.DOCX) and PDF if radicada or generated */}
                        {(r.estado === 'Radicado' || r.estado === 'Aprobado' || r.estado === 'En revisión') && (
                          <>
                            <a
                              href={`/api/reports/${r.id}/docx${token ? `?token=${token}` : ''}`}
                              download
                              className="px-2.5 py-1 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-300 transition-colors inline-flex items-center gap-1"
                              title="Descargar documento completo editable en Word (.DOCX)"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-700" />
                              Word
                            </a>
                            <a
                              href={`/api/reports/${r.id}/pdf${token ? `?token=${token}` : ''}`}
                              download
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-300 transition-colors inline-flex items-center gap-1"
                              title="Descargar documento completo en PDF"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-700" />
                              PDF
                            </a>
                          </>
                        )}

                        <button
                          onClick={() => handleOpenViewer(r)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Acta
                        </button>

                        {/* If error, allow quick retry */}
                        {hasError && (
                          <button
                            onClick={() => handleRetryRadicacion(r.id)}
                            disabled={retryingId === r.id}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Reintentar generación y radicación"
                          >
                            {retryingId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="w-3.5 h-3.5" />
                            )}
                            Reintentar
                          </button>
                        )}

                        {r.estado !== 'Aprobado' && (
                          <button
                            onClick={() => handleEditExistingReport(r)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                              isReturned
                                ? 'bg-amber-600 hover:bg-amber-700 text-white border-transparent'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            {isReturned ? 'Ajustar Informe' : 'Editar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE REPORT EDITOR MODAL */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={onCloseNewModal}
        title={
          editingReportId
            ? 'Diligenciar y Ajustar Informe de Actividades'
            : 'Nuevo Informe Mensual de Actividades y Acta de Supervisión'
        }
        subtitle="Complete cada obligación con sus evidencias para generar el formato oficial de 8 páginas"
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs sm:text-sm">
          {formSupervisorNotes && (
            <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Observaciones devueltas por el Supervisor:</span>
                <p className="mt-0.5 italic">"{formSupervisorNotes}"</p>
                <span className="text-[11px] text-amber-800 block mt-1">
                  Por favor realice los ajustes indicados en las obligaciones o seguridad social y vuelva a radicar.
                </span>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Aviso importante:</span>
                <span>{formError}</span>
              </div>
            </div>
          )}

          {/* Sub-tabs inside modal */}
          <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setEditorTab('obligaciones')}
              className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                editorTab === 'obligaciones'
                  ? 'border-blue-700 text-blue-900 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              1. Obligaciones y Evidencias
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('seguridad')}
              className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                editorTab === 'seguridad'
                  ? 'border-blue-700 text-blue-900 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              2. Planilla PILA y Seguridad Social
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('datos')}
              className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                editorTab === 'datos'
                  ? 'border-blue-700 text-blue-900 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              3. Período y Fechas
            </button>
          </div>

          {/* TAB 1: OBLIGACIONES Y ACTIVIDADES CON EVIDENCIAS INDEPENDIENTES */}
          {editorTab === 'obligaciones' && (
            <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
              <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200 text-[11px] text-blue-900">
                Detalle las actividades realizadas, los productos obtenidos y adjunte fotografías o archivos de soporte por cada compromiso contractual. Cada fotografía se almacena de forma independiente para garantizar la generación fluida del documento oficial sin sobrecarga de datos.
              </div>

              {activitiesState.map((act, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                >
                  <div className="font-bold text-blue-950 text-xs flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="leading-snug">{act.obligacion}</span>
                  </div>

                  {/* Actividad realizada */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Actividades desarrolladas (descripción clara y pormenorizada) *
                    </label>
                    <textarea
                      rows={3}
                      value={act.actividadRealizada}
                      onChange={(e) =>
                        handleActivityChange(index, 'actividadRealizada', e.target.value)
                      }
                      placeholder="Describa de manera puntual las tareas realizadas para el cumplimiento de esta obligación..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none bg-white resize-none"
                      required
                    />
                  </div>

                  {/* Productos y fechas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Productos o resultados obtenidos
                      </label>
                      <input
                        type="text"
                        value={act.productos || ''}
                        onChange={(e) => handleActivityChange(index, 'productos', e.target.value)}
                        placeholder="Ej. Acta de entrega, módulo publicado, informe..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Fechas de ejecución de la actividad
                      </label>
                      <input
                        type="text"
                        value={act.fechas || ''}
                        onChange={(e) => handleActivityChange(index, 'fechas', e.target.value)}
                        placeholder="Ej. 1 al 15 del mes reportado"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Evidencias fotográficas */}
                  <div className="pt-1 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Fotografías de evidencia ({act.fotografias?.length || 0})
                      </label>
                      {uploadingPhotoIdx === index && (
                        <span className="text-[10px] text-blue-700 flex items-center gap-1 font-semibold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Guardando foto en almacenamiento seguro...
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-xs">
                        <Camera className="w-3.5 h-3.5 text-blue-700" />
                        <span>Cargar fotografía</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPhotoIdx === index}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAddPhoto(index, e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-slate-500">
                        Las fotos se incorporarán automáticamente al Anexo Oficial del Acta.
                      </span>
                    </div>

                    {act.fotografias && act.fotografias.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {act.fotografias.map((f) => (
                          <div
                            key={f.id}
                            className="relative border border-slate-200 rounded p-1.5 bg-white text-[10px] shadow-xs"
                          >
                            <img
                              src={`${f.url}${token ? `?token=${token}` : ''}`}
                              alt={f.descripcion}
                              className="w-full h-20 object-cover rounded bg-slate-100 mb-1"
                              onError={(e) => {
                                // If token not yet present or error, keep background
                                (e.target as HTMLElement).style.opacity = '0.7';
                              }}
                            />
                            <input
                              type="text"
                              value={f.descripcion}
                              onChange={(e) => {
                                const photos = [...(act.fotografias || [])];
                                const pIdx = photos.findIndex((p) => p.id === f.id);
                                if (pIdx !== -1) {
                                  photos[pIdx].descripcion = e.target.value;
                                  handleActivityChange(index, 'fotografias', photos);
                                }
                              }}
                              placeholder="Pie de foto..."
                              className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[10px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(index, f.id)}
                              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 cursor-pointer shadow-xs"
                              title="Eliminar foto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Soportes documentales (Informes, anexos, actas) */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Archivos y Soportes Documentales ({act.soportes?.length || 0})
                      </label>
                      {uploadingDocIdx === index && (
                        <span className="text-[10px] text-blue-700 flex items-center gap-1 font-semibold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Subiendo soporte...
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-xs">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Adjuntar documento (PDF, Word, Excel)</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          className="hidden"
                          disabled={uploadingDocIdx === index}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAddDocumentFile(index, e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>

                    {act.soportes && act.soportes.length > 0 && (
                      <div className="space-y-1.5">
                        {act.soportes.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                              <span className="font-medium text-slate-800 truncate">
                                {doc.nombre}
                              </span>
                              {doc.size ? (
                                <span className="text-[10px] text-slate-400">
                                  ({Math.round(doc.size / 1024)} KB)
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.url && (
                                <a
                                  href={`${doc.url}${token ? `?token=${token}` : ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-semibold text-blue-700 hover:underline"
                                >
                                  Ver
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument(index, doc.id)}
                                className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                                title="Eliminar documento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: SEGURIDAD SOCIAL */}
          {editorTab === 'seguridad' && (
            <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-950">
                <span className="font-bold block">Aportes al Sistema de Seguridad Social Integral:</span>
                Adjunte la planilla PILA cancelada del período. Los valores aportados serán revisados y cotejados por la supervisión institucional antes de emitir la certificación de pago.
              </div>

              {/* Upload PILA Planilla support */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Archivo o Certificado de la Planilla PILA (PDF / Imagen)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shadow-xs">
                    <UploadCloud className="w-4 h-4 text-blue-700" />
                    <span>{uploadingPila ? 'Cargando archivo...' : 'Seleccionar planilla PILA'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      disabled={uploadingPila}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadPilaFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                  {pilaUploadedFileName && (
                    <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {pilaUploadedFileName} (Cargada)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Nota: El cargue del archivo deja los campos disponibles para revisión. La validación oficial corresponde a la supervisión.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número de Planilla / Comprobante PILA *
                  </label>
                  <input
                    type="text"
                    value={pilaPlanillaNo}
                    onChange={(e) => setPilaPlanillaNo(e.target.value)}
                    placeholder="Ej. 9845217430"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operador PILA *
                  </label>
                  <select
                    value={pilaOperador}
                    onChange={(e) => setPilaOperador(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                  >
                    <option value="SOI">SOI (Servicio Operativo de Información)</option>
                    <option value="Aportes en Línea">Aportes en Línea</option>
                    <option value="MiPlanilla">MiPlanilla (Compensar)</option>
                    <option value="Simple S.A.">Simple S.A.</option>
                    <option value="Asopagos">Asopagos</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Período de Cotización *
                  </label>
                  <input
                    type="text"
                    value={pilaPeriodoCotizado}
                    onChange={(e) => setPilaPeriodoCotizado(e.target.value)}
                    placeholder="Ej. Mayo - Agosto 2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor Total Aportado (COP) *
                  </label>
                  <input
                    type="number"
                    value={pilaValorTotal}
                    onChange={(e) => setPilaValorTotal(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                  <span className="text-[11px] text-blue-800 font-semibold mt-0.5 block">
                    {formatCOP(pilaValorTotal)}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-3">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-800 block">
                  Desglose de Aportes para el Formato Oficial del Acta (Sección XIII)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">Salud (Entidad):</label>
                    <input
                      type="text"
                      value={pilaSaludEntidad}
                      onChange={(e) => setPilaSaludEntidad(e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">Salud (Valor COP):</label>
                    <input
                      type="number"
                      value={pilaSaludValor}
                      onChange={(e) => setPilaSaludValor(Number(e.target.value))}
                      className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">Pensión (Entidad):</label>
                    <input
                      type="text"
                      value={pilaPensionEntidad}
                      onChange={(e) => setPilaPensionEntidad(e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">Pensión (Valor COP):</label>
                    <input
                      type="number"
                      value={pilaPensionValor}
                      onChange={(e) => setPilaPensionValor(Number(e.target.value))}
                      className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">ARL (Entidad):</label>
                    <input
                      type="text"
                      value={pilaArlEntidad}
                      onChange={(e) => setPilaArlEntidad(e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">ARL (Valor COP):</label>
                    <input
                      type="number"
                      value={pilaArlValor}
                      onChange={(e) => setPilaArlValor(Number(e.target.value))}
                      className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PERIODO Y FECHAS */}
          {editorTab === 'datos' && (
            <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contrato de Prestación de Servicios *
                </label>
                <select
                  value={selectedContractId}
                  onChange={(e) => handleContractChange(e.target.value)}
                  disabled={Boolean(editingReportId)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                >
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numeroContrato} - {c.objeto.slice(0, 70)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Texto del Período Informado (Ej. 25/04/2026 - 24/08/2026) *
                </label>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none font-semibold"
                  required
                />
              </div>

              {/* Quick Period Selector based on 30-day consecutive calendar periods */}
              {selectedContractId && (() => {
                const ct = contracts.find((c) => c.id === selectedContractId);
                if (!ct) return null;
                const ctPeriods = getContractPeriods(ct.fechaInicio, ct.fechaFin);
                if (ctPeriods.length === 0) return null;
                return (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                      Seleccionar Período Contractual de 30 Días:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ctPeriods.map((p) => {
                        const isSelected = fechaInicioPeriodo === p.fechaInicioPeriodo && fechaFinPeriodo === p.fechaFinPeriodo;
                        return (
                          <button
                            key={p.numeroActa}
                            type="button"
                            onClick={() => {
                              setFechaInicioPeriodo(p.fechaInicioPeriodo);
                              setFechaFinPeriodo(p.fechaFinPeriodo);
                              setPeriodo(p.periodoTexto);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-blue-900 text-white border-blue-900 font-bold'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Acta {p.numeroActa} (Días {p.diaInicio}-{p.diaFin}: {p.diasPeriodo}d)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha Inicio del Período *
                  </label>
                  <input
                    type="date"
                    value={fechaInicioPeriodo}
                    onChange={(e) => setFechaInicioPeriodo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha Fin del Período *
                  </label>
                  <input
                    type="date"
                    value={fechaFinPeriodo}
                    onChange={(e) => setFechaFinPeriodo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                    required
                  />
                </div>
              </div>

              {/* LIVE CONTRACTUAL METRICS & PROGRESS CALCULATION */}
              <div className="p-3.5 bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-blue-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-bold text-xs uppercase tracking-wide text-blue-200">
                      Cálculo Automático por Días Calendario y Valores Económicos
                    </span>
                  </div>
                  {loadingMetrics ? (
                    <span className="text-[11px] text-blue-300 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Calculando...
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                      Acta N.º {previewMetrics?.actaNumero || 1} • {previewMetrics?.diasPeriodo || 30}d período • {previewMetrics?.durationInfo?.contractTotalDays || 0}d contrato
                    </span>
                  )}
                </div>

                {/* 4 Porcentajes automáticos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white/10 rounded-lg p-2 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Tiempo Período</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {formatPct(previewMetrics?.financiero?.porcentajeAvanceTiempoPeriodo)}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Financiero Período</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {formatPct(previewMetrics?.financiero?.porcentajeAvanceFinancieroPeriodo)}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Tiempo Acumulado</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {formatPct(previewMetrics?.financiero?.porcentajeAvanceTiempoAcumulado)}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 border border-white/10">
                    <span className="text-[10px] text-blue-200 block">Financiero Total</span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">
                      {formatPct(previewMetrics?.financiero?.porcentajeAvanceFinancieroAcumulado)}
                    </span>
                  </div>
                </div>

                {/* Resumen económico */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-blue-800/60 text-[11px]">
                  <div>
                    <span className="text-blue-300 block text-[10px]">Valor Pagado Previo:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      $ {formatCOP(previewMetrics?.financiero?.valorPagadoALaFecha || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-300 block text-[10px] font-bold">Presente Pago:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      $ {formatCOP(previewMetrics?.financiero?.valorPresentePago || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-amber-200 block text-[10px]">Saldo por Pagar:</span>
                    <span className="font-mono font-semibold text-amber-200">
                      $ {formatCOP(previewMetrics?.financiero?.saldoPorPagar || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Logros Destacados (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={logros}
                    onChange={(e) => setLogros(e.target.value)}
                    placeholder="Principales metas o hitos alcanzados..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dificultades / Retos Presentados (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={dificultades}
                    onChange={(e) => setDificultades(e.target.value)}
                    placeholder="Novedades o retos técnicos..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCloseNewModal}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
            >
              Cerrar
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSaveReport(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Avance (Borrador)
              </button>

              {/* GENERATE ACTA OFICIAL BUTTON (MANDATORY REQUIREMENT) */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSaveReport(true)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    Generando Acta y Radicando...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 text-amber-300" />
                    Generar Acta Oficial y Radicar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Google Sheets Export Modal */}
      <GoogleSheetsExportModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        reports={reports}
        contracts={contracts}
        defaultTitle={`Mis Actas de Supervisión - Contratista (${new Date().toLocaleDateString('es-CO')})`}
      />
    </div>
  );
};
