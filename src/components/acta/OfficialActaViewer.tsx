import React, { useState, useEffect } from 'react';
import { ActivityReport, Contract, User } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { formatCOP, formatDate, formatDateDMY } from '../../lib/api.js';
import { calculateTotalDays, calculateDetailedDuration } from '../../utils/contractDuration.js';
import {
  Download,
  FileText,
  Printer,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface OfficialActaViewerProps {
  report: ActivityReport;
  contract?: Contract | null;
  contractor?: User | null;
  supervisorEmail?: string;
  isSupervisor?: boolean;
  onApprove?: (reportId: string, updates?: Partial<ActivityReport>) => Promise<void>;
  onReturn?: (reportId: string, observaciones: string) => Promise<void>;
  onSaveProgress?: (reportId: string, updates: Partial<ActivityReport>) => Promise<void>;
  onClose?: () => void;
}

export const OfficialActaViewer: React.FC<OfficialActaViewerProps> = ({
  report,
  contract,
  contractor,
  supervisorEmail: supervisorEmailProp,
  isSupervisor = false,
  onApprove,
  onReturn,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [resolvedSupervisorEmail, setResolvedSupervisorEmail] = useState(supervisorEmailProp || '');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [devolverObservaciones, setDevolverObservaciones] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);

  useEffect(() => {
    if (supervisorEmailProp) {
      setResolvedSupervisorEmail(supervisorEmailProp);
      return;
    }
    if (!report?.id) return;
    let cancelled = false;
    const token = localStorage.getItem('gestion_contratistas_token');
    fetch(`/api/reports/${report.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.supervisorEmail) {
          setResolvedSupervisorEmail(data.supervisorEmail);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [report?.id, supervisorEmailProp]);

  const [concepto] = useState(report?.conceptoGeneral || 'Satisfactorio');
  const [observacionesSup] = useState(report?.observacionesSupervisor || '');
  const [conclusion] = useState(report?.conclusionSeguimiento || '');

  const formatPercent = (val?: number) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0,00';
    return Number(val).toFixed(2).replace('.', ',');
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '$ 0,00';
    return `$ ${new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val))}`;
  };

  const formatFechaLarga = (dStr?: string) => {
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    let d = new Date();
    if (dStr) {
      const clean = dStr.trim().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, day] = clean.split('-').map(Number);
        d = new Date(y, m - 1, day);
      } else {
        const parsed = new Date(dStr);
        if (!isNaN(parsed.getTime())) d = parsed;
      }
    }
    return {
      dia: d.getDate(),
      mes: meses[d.getMonth()],
      anio: d.getFullYear(),
      texto: `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`,
    };
  };

  const contractNumber = contract?.numeroContrato || report?.numeroContrato || '';
  const tipoContrato = contract?.tipoContrato || 'CONTRATO DE PRESTACIÓN DE SERVICIOS';
  const entidadContratante = contract?.entidadContratante || 'MUNICIPIO DE QUIMBAYA, QUINDÍO';
  const objetoContrato = contract?.objeto || '';
  const supervisorResp = contract?.supervisorResponsable || '';
  const supervisorCargo = contract?.supervisorCargo || '';
  const supervisorDoc = contract?.supervisorDocumento || '';
  const cdpNum = contract?.cdpNumero?.trim() || '';
  const cdpFec = contract?.cdpFecha?.trim() ? formatDateDMY(contract.cdpFecha) : '';
  const crpNum = contract?.crpNumero?.trim() || '';
  const crpFec = contract?.crpFecha?.trim() ? formatDateDMY(contract.crpFecha) : '';
  const fecInicio = contract?.fechaInicio || '';
  const fecFin = contract?.fechaFin || '';
  const vigencia =
    contract?.vigenciaDias ||
    (fecInicio && fecFin ? calculateTotalDays(fecInicio, fecFin) : 0);
  const duracionTexto =
    contract?.duracionTexto ||
    (fecInicio && fecFin ? calculateDetailedDuration(fecInicio, fecFin).texto : '');
  const valorTotalContrato = contract?.valorTotal ?? report?.financiero?.valorTotalFinal ?? 0;
  const lugarEjecucion = contract?.lugarEjecucion || 'Quimbaya, Quindío';

  const contractorName = contractor
    ? `${contractor.nombres} ${contractor.apellidos}`.trim()
    : report?.contratistaNombre || contract?.contratistaNombre || '';
  const contractorDoc = contractor?.numeroDocumento || contract?.contratistaDocumento || '';

  const bancoParts: string[] = [];
  if (contractor?.banco) bancoParts.push(contractor.banco.toUpperCase());
  if (contractor?.tipoCuenta) bancoParts.push(`CUENTA DE ${contractor.tipoCuenta.toUpperCase()}`);
  if (contractor?.numeroCuenta) bancoParts.push(`N.º ${contractor.numeroCuenta}`);
  const bancoInfo = bancoParts.length > 0 ? bancoParts.join(', ') : 'Pendiente por registrar';

  const getMediaUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const token = localStorage.getItem('gestion_contratistas_token');
    if (token && url.startsWith('/api/uploads/')) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}token=${encodeURIComponent(token)}`;
    }
    return url;
  };

  const handleDownloadPdf = async () => {
    if (!report?.id) return;
    try {
      setActionError(null);
      setDownloading(true);
      const token = localStorage.getItem('gestion_contratistas_token');
      const response = await fetch(`/api/reports/${report.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al generar el PDF del acta oficial.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeContractName = (contractNumber || 'Contrato').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Acta_Supervision_No_${report.numeroActa || 1}_${safeContractName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setActionError(err.message || 'Error al descargar el PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!report?.id) return;
    try {
      setActionError(null);
      setDownloadingDocx(true);
      const token = localStorage.getItem('gestion_contratistas_token');
      const response = await fetch(`/api/reports/${report.id}/docx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al generar el documento Word (.DOCX).');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeContractName = (contractNumber || 'Contrato').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Acta_Supervision_No_${report.numeroActa || 1}_${safeContractName}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setActionError(err.message || 'Error al descargar el documento Word.');
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmApprove = async () => {
    if (!onApprove) return;
    try {
      setActionError(null);
      setSavingAction(true);
      await onApprove(report.id, {
        conceptoGeneral: concepto,
        observacionesSupervisor: observacionesSup,
        conclusionSeguimiento: conclusion,
      });
      setConfirmApproveOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Error al aprobar el acta.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onReturn) return;
    if (!devolverObservaciones.trim()) {
      setActionError('Debe indicar las observaciones y ajustes requeridos al contratista.');
      return;
    }
    try {
      setActionError(null);
      setSavingAction(true);
      await onReturn(report.id, devolverObservaciones.trim());
      setReturnModalOpen(false);
      setDevolverObservaciones('');
    } catch (err: any) {
      setActionError(err.message || 'Error al devolver el acta.');
    } finally {
      setSavingAction(false);
    }
  };

  // Official Institutional Header (MODALIDAD DE SELECCIÓN FINAL)
  const InstitutionalHeader = () => (
    <div className="border-2 border-black mb-4 text-[11px] font-sans bg-white">
      <div className="grid grid-cols-12 divide-x-2 divide-black">
        <div className="col-span-3 p-2 flex items-center justify-center bg-white">
          <img
            src="/assets/alcaldia_quimbaya_logo.png"
            alt="Alcaldía de Quimbaya"
            className="max-h-14 w-auto object-contain"
          />
        </div>
        <div className="col-span-6 divide-y-2 divide-black text-center bg-white flex flex-col justify-center">
          <div className="p-2">
            <div className="font-bold text-[11px] uppercase tracking-wide text-black">
              MUNICIPIO DE QUIMBAYA
            </div>
            <div className="font-bold text-[10px] text-black">QUINDIO</div>
            <div className="font-bold text-[10px] text-black">NIT: 890.000.613-4</div>
          </div>
          <div className="p-2">
            <div className="font-bold text-[10.5px] text-black uppercase">
              OFICINA ASESORA JURIDICA
            </div>
            <div className="font-extrabold text-[11.5px] text-black uppercase tracking-wider">
              ACTA DE SUPERVISIÓN
            </div>
          </div>
        </div>
        <div className="col-span-3 divide-y-2 divide-black text-center text-[10px] bg-white flex flex-col justify-between">
          <div className="p-1.5 font-bold">FORMATO OFICIAL</div>
          <div className="p-1.5 font-bold">
            CÓDIGO: {contract?.codigoSecop ? contract.codigoSecop : ''}
          </div>
          <div className="p-1.5 font-bold">VERSIÓN: 1</div>
        </div>
      </div>
    </div>
  );

  // Official Institutional Footer (MODALIDAD DE SELECCIÓN FINAL)
  const InstitutionalFooter = () => (
    <div className="mt-6 pt-3 text-[8.5px] text-black font-sans leading-tight">
      <div className="border border-black divide-y divide-black mb-1.5">
        <div className="grid grid-cols-12 divide-x divide-black">
          <div className="col-span-2 p-1 font-semibold">Elaborado por:</div>
          <div className="col-span-6 p-1">P. U de Planificación y Modernización–S.P</div>
          <div className="col-span-1 p-1 font-semibold">Fecha:</div>
          <div className="col-span-3 p-1">Enero 21/2026</div>
        </div>
        <div className="grid grid-cols-12 divide-x divide-black">
          <div className="col-span-2 p-1 font-semibold">Revisado por:</div>
          <div className="col-span-6 p-1">Secretaria de Planeación</div>
          <div className="col-span-1 p-1 font-semibold">Fecha:</div>
          <div className="col-span-3 p-1">Enero 21/2026</div>
        </div>
        <div className="grid grid-cols-12 divide-x divide-black">
          <div className="col-span-2 p-1 font-semibold">Aprobado por:</div>
          <div className="col-span-6 p-1">Comité Institucional de Gestión y Desempeño</div>
          <div className="col-span-1 p-1 font-semibold">Fecha:</div>
          <div className="col-span-3 p-1">Enero 22/2026</div>
        </div>
      </div>
      <p className="text-[7.5px] text-center text-slate-700 leading-snug">
        Correo electrónico: ventanillaunica@quimbaya-quindio.gov.co - www.quimbaya-quindio.gov.co Dirección: Carrera 6 Calle 12 Esquina - Quimbaya Quindío - Teléfono de contacto +57 3175519367 Horario de atención: Lunes a Jueves de 08:00 am a 12:00 – 02:00 pm a 06:30 pm - Viernes de 08:00 am a 12:00 – 02:00 pm a 04:00 pm Código postal urbano 634020, código postal rural 634027
      </p>
    </div>
  );

  if (!report) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-xl p-8 text-center space-y-3 max-w-xl mx-auto my-6 shadow-xs">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="text-base font-bold text-red-950">Informe o Acta no encontrada</h3>
        <p className="text-xs text-red-800">
          No se suministraron los datos requeridos para visualizar el acta oficial de supervisión.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Volver a la lista
          </button>
        )}
      </div>
    );
  }

  const fin = report.financiero || {
    valorInicial: contract?.valorTotal || 0,
    valoresAdicionales: 0,
    valorPagadoALaFecha: 0,
    valorPresentePago: contract?.honorariosMensuales || 0,
    saldoPorPagar: contract?.valorTotal || 0,
    saldoPorEjecutar: contract?.valorTotal || 0,
    valorTotalFinal: contract?.valorTotal || 0,
    porcentajeAvanceTiempoPeriodo: 0,
    porcentajeAvanceFinancieroPeriodo: 0,
    porcentajeAvanceTiempoAcumulado: 0,
    porcentajeAvanceFinancieroAcumulado: 0,
  };

  const mods = contract?.modificaciones || [];
  const lastMod = mods.length > 0 ? mods[mods.length - 1] : null;
  const pol = contract?.polizas;
  const polAplica = Boolean(pol?.aplica);
  const ver = report.verificacionIntegral;
  const nov = report.controlNovedades;
  const pri = report.controlPrincipios;
  const pag = report.analisisPago;
  const fechaDada = formatFechaLarga(report.fechaRevision || report.fechaRadicacion || report.updatedAt);

  const histActas =
    report.historialActasConcepto && report.historialActasConcepto.length > 0
      ? report.historialActasConcepto
      : [
          {
            nroActa: report.numeroActa || 1,
            valorTotal: fin.valorTotalFinal,
            valorEjecutado: fin.valorPagadoALaFecha + fin.valorPresentePago,
            saldo: fin.saldoPorPagar,
          },
        ];

  const allActivities = report.actividades || [];
  const hasPhotosOrDocs = allActivities.some(
    (a) => (a.fotografias && a.fotografias.length > 0) || (a.soportes && a.soportes.length > 0)
  );

  return (
    <div className="space-y-4">
      {!contract && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-2.5 print:hidden">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Expediente Contractual no vinculado</span>
            <span>
              El contrato asociado (ID: {report.contratoId || 'N/A'}) no se encuentra registrado en el sistema.
            </span>
          </div>
        </div>
      )}

      {actionError && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-900 flex items-center justify-between gap-2 print:hidden">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Top sticky action bar */}
      <div className="sticky top-16 z-30 bg-slate-900 text-white p-3.5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Volver"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                Acta de Supervisión N° {report.numeroActa || 1}
              </span>
              <Badge status={report.estado} size="sm" />
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Contrato: {contractNumber || '—'} • {contractorName || '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Historial</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Imprimir</span>
          </button>

          <button
            onClick={handleDownloadDocx}
            disabled={downloadingDocx}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>{downloadingDocx ? 'Generando Word...' : 'Descargar en Word (.DOCX)'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>{downloading ? 'Generando PDF...' : 'Descargar en PDF'}</span>
          </button>

          {isSupervisor && report.estado !== 'Aprobado' && (
            <>
              <button
                onClick={() => setReturnModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Devolver
              </button>
              <button
                onClick={() => setConfirmApproveOpen(true)}
                disabled={savingAction}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                <CheckCircle className="w-3.5 h-3.5 text-amber-300" />
                Aprobar Acta
              </button>
            </>
          )}
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs print:hidden">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-900" />
            Trazabilidad e Historial de Estados del Acta
          </h4>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {(report.historialEstados || []).map((h, i) => (
              <div key={i} className="py-2 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge status={h.estado} size="sm" />
                    <span className="font-semibold text-slate-800">{h.usuario}</span>
                  </div>
                  {h.observaciones && (
                    <p className="text-slate-600 mt-1 italic pl-1 border-l-2 border-slate-300">
                      "{h.observaciones}"
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{formatDate(h.fecha)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONFIRM APPROVE MODAL */}
      {confirmApproveOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white max-w-md w-full rounded-xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Confirmar Aprobación de Acta
            </h3>
            <p className="text-xs text-slate-600">
              ¿Está seguro de aprobar formalmente esta Acta de Supervisión y certificar el cumplimiento para pago?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmApproveOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={handleConfirmApprove}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {savingAction ? 'Aprobando...' : 'Aprobar Formalmente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white max-w-lg w-full rounded-xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Devolver Acta al Contratista para Ajustes
            </h3>
            <p className="text-xs text-slate-600">
              Describa las observaciones, inconsistencias o soportes requeridos. El contratista recibirá esta notificación y podrá ajustar su informe.
            </p>
            <form onSubmit={handleReturnSubmit} className="space-y-3">
              <textarea
                rows={4}
                value={devolverObservaciones}
                onChange={(e) => setDevolverObservaciones(e.target.value)}
                placeholder="Indique puntualmente los cambios o documentos que deben corregirse..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                >
                  Confirmar Devolución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSTITUTIONAL DOCUMENT PAPER (MODALIDAD DE SELECCIÓN FINAL — 14 SECTIONS) */}
      <div className="max-w-[850px] mx-auto bg-white p-6 sm:p-10 shadow-xl border border-slate-300 text-black space-y-5 print:shadow-none print:border-none print:p-0">
        <InstitutionalHeader />

        <div className="text-center space-y-0.5">
          <h2 className="font-extrabold text-[13px] tracking-wide uppercase">
            ACTA DE SUPERVISIÓN N° {report.numeroActa || 1}
          </h2>
        </div>

        {/* I. DATOS GENERALES */}
        <div className="border border-black text-[9.5px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase tracking-wide">
            I. DATOS GENERALES
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Contrato Número:</div>
            <div className="col-span-8 p-1.5 font-semibold">{contractNumber}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Tipo de Contrato</div>
            <div className="col-span-8 p-1.5">{tipoContrato}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Entidad Contratante</div>
            <div className="col-span-8 p-1.5 font-semibold">{entidadContratante}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Lugar y Fecha del acta:</div>
            <div className="col-span-8 p-1.5">
              {report.lugarFechaActa || `${lugarEjecucion}, ${formatFechaLarga(report.fechaRadicacion || report.createdAt).texto}`}
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Contratista</div>
            <div className="col-span-4 p-1.5 font-bold uppercase">{contractorName}</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">C.C o NIT</div>
            <div className="col-span-2 p-1.5 font-mono font-bold text-center">{contractorDoc}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Objeto del Contrato</div>
            <div className="col-span-8 p-1.5 leading-snug whitespace-pre-wrap">{objetoContrato}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Supervisor</div>
            <div className="col-span-4 p-1.5 font-bold uppercase">
              {supervisorResp || 'Pendiente por asignar'}
              {supervisorCargo && (
                <div className="text-[8px] font-normal text-slate-700">{supervisorCargo}</div>
              )}
            </div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">C.C o NIT</div>
            <div className="col-span-2 p-1.5 font-mono font-bold text-center">{supervisorDoc}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Número de Cuenta bancaria</div>
            <div className="col-span-4 p-1.5 font-mono text-[9px]">{bancoInfo}</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Periodo Informado</div>
            <div className="col-span-2 p-1.5 font-semibold text-center text-[9px]">
              {report.fechaInicioPeriodo && report.fechaFinPeriodo
                ? `Del ${formatDateDMY(report.fechaInicioPeriodo)} al ${formatDateDMY(report.fechaFinPeriodo)}`
                : report.periodo}
            </div>
          </div>
        </div>

        {/* II. PROCESO INICIAL */}
        <div className="border border-black text-[9.5px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase tracking-wide">
            II. PROCESO INICIAL
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Valor del Contrato</div>
            <div className="col-span-8 p-1.5 font-semibold">{formatCOP(valorTotalContrato)}</div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50 flex flex-col justify-center">
              <span>Fecha de Inicio Contrato</span>
              {fecInicio && <span className="font-mono text-[9px] text-slate-800">{formatDateDMY(fecInicio)}</span>}
            </div>
            <div className="col-span-8 grid grid-cols-4 divide-x divide-y divide-black text-[9px]">
              <div className="p-1.5 font-bold bg-slate-50">CDP #:</div>
              <div className="p-1.5 font-mono font-bold">{cdpNum || '—'}</div>
              <div className="p-1.5 font-bold bg-slate-50">CRP #:</div>
              <div className="p-1.5 font-mono font-bold">{crpNum || '—'}</div>
              <div className="p-1.5 font-bold bg-slate-50">Fecha:</div>
              <div className="p-1.5">{cdpFec || '—'}</div>
              <div className="p-1.5 font-bold bg-slate-50">Fecha:</div>
              <div className="p-1.5">{crpFec || '—'}</div>
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Plazo de Ejecución del Contrato</div>
            <div className="col-span-4 p-1.5 text-[9px]">
              {fecInicio && fecFin
                ? `Del ${formatDateDMY(fecInicio)} al ${formatDateDMY(fecFin)}${duracionTexto ? ` (${duracionTexto})` : ''}`
                : '—'}
            </div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Vigencia</div>
            <div className="col-span-2 p-1.5 font-bold text-center text-[9px]">
              {vigencia > 0 ? `${vigencia} días calendario` : '—'}
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Fecha Contractual de Terminación Contrato
            </div>
            <div className="col-span-8 p-1.5 font-semibold">
              {fecFin ? formatDateDMY(fecFin) : '—'}
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Fecha de Inicio de adición
              {lastMod?.fecha && (
                <div className="font-normal text-[9px]">{formatDateDMY(lastMod.fecha)}</div>
              )}
            </div>
            <div className="col-span-8 grid grid-cols-4 divide-x divide-y divide-black text-[9px]">
              <div className="p-1.5 font-bold bg-slate-50">CDP #:</div>
              <div className="p-1.5">{lastMod ? '' : 'No aplica'}</div>
              <div className="p-1.5 font-bold bg-slate-50">CRP #:</div>
              <div className="p-1.5">{lastMod ? '' : 'No aplica'}</div>
              <div className="p-1.5 font-bold bg-slate-50">Fecha:</div>
              <div className="p-1.5"></div>
              <div className="p-1.5 font-bold bg-slate-50">Fecha:</div>
              <div className="p-1.5"></div>
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">Plazo de Ejecucion Adición</div>
            <div className="col-span-4 p-1.5 text-[9px]">
              {lastMod ? lastMod.objeto : 'No aplica'}
            </div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Vigencia</div>
            <div className="col-span-2 p-1.5 text-center text-[9px]">
              {lastMod ? '' : 'No aplica'}
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Fecha Contractual de Terminación de la adición
            </div>
            <div className="col-span-8 p-1.5">{lastMod ? '' : 'No aplica'}</div>
          </div>
        </div>

        {/* III. RESUMEN POLIZAS */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase tracking-wide text-[9.5px]">
            III. RESUMEN POLIZAS
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-4 p-1 font-bold bg-slate-50">Garantías y/o Pólizas del contrato</div>
            <div className="col-span-1 p-1 text-center font-bold bg-slate-50">Si Aplica</div>
            <div className="col-span-1 p-1 text-center font-bold bg-slate-50">No Aplica</div>
            <div className="col-span-2 p-1 font-bold bg-slate-50 text-center">No. de Póliza</div>
            <div className="col-span-2 p-1 font-bold bg-slate-50 text-center">Detalle</div>
            <div className="col-span-2 p-1 font-bold bg-slate-50 text-center">Vigencia</div>

            {[
              { label: 'Tipo de Garantía', nro: polAplica ? pol?.numeroGarantia : '', det: polAplica ? pol?.tipoGarantia : '' },
              { label: 'Nombre del Garante', nro: '', det: polAplica ? pol?.nombreGarante : '' },
              { label: 'Número de la Garantía', nro: polAplica ? pol?.numeroGarantia : '', det: '' },
              { label: 'Contratista Tomador', nro: '', det: polAplica ? pol?.contratistaTomador || contractorName : '' },
              { label: 'Beneficiario', nro: '', det: polAplica ? pol?.beneficiario || entidadContratante : '' },
              { label: 'Compañía /Aseguradora', nro: '', det: polAplica ? pol?.companiaAseguradora : '' },
            ].map((item, idx) => (
              <React.Fragment key={idx}>
                <div className="col-span-4 p-1 font-medium bg-slate-50/40">{item.label}</div>
                <div className="col-span-1 p-1 text-center font-bold">{polAplica ? 'X' : ''}</div>
                <div className="col-span-1 p-1 text-center font-bold">{!polAplica ? 'X' : ''}</div>
                <div className="col-span-2 p-1 text-center">{item.nro || ''}</div>
                <div className="col-span-2 p-1">{item.det || ''}</div>
                <div className="col-span-2 p-1 text-center">
                  {idx === 0 && polAplica && pol?.cumplimientoHasta ? formatDateDMY(pol.cumplimientoHasta) : ''}
                </div>
              </React.Fragment>
            ))}

            <div className="col-span-4 p-1.5 font-semibold bg-slate-50">
              Amparos: incluir líneas según número de amparos tales como cumplimiento, calidad del servicio)
            </div>
            <div className="col-span-8 p-1.5">
              {polAplica ? pol?.amparos || 'Cumplimiento, calidad y prestaciones según contrato.' : 'No aplica'}
            </div>

            <div className="col-span-4 p-1 font-bold bg-slate-50">Amparo</div>
            <div className="col-span-3 p-1 font-bold bg-slate-50 text-center">Desde</div>
            <div className="col-span-3 p-1 font-bold bg-slate-50 text-center">Hasta</div>
            <div className="col-span-2 p-1 font-bold bg-slate-50 text-center">Valor</div>

            {[
              { label: 'Cumplimiento', hasta: pol?.cumplimientoHasta },
              { label: 'Calidad:', hasta: pol?.calidadHasta },
              { label: 'Pago de salarios, Prestaciones Sociales e Indemnizaciones', hasta: pol?.salariosHasta },
            ].map((amp, i) => (
              <React.Fragment key={i}>
                <div className="col-span-4 p-1 font-semibold">{amp.label}</div>
                <div className="col-span-3 p-1 text-center">
                  {polAplica && fecInicio ? formatDateDMY(fecInicio) : ''}
                </div>
                <div className="col-span-3 p-1 text-center">
                  {polAplica && amp.hasta ? formatDateDMY(amp.hasta) : 'N/A'}
                </div>
                <div className="col-span-2 p-1 text-center">
                  {polAplica ? 'Según póliza' : 'N/A'}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* IV. MODIFICACIONES CONTRACTUALES */}
        <div className="border border-black text-[9.5px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase tracking-wide">
            IV. MODIFICACIONES CONTRACTUALES
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black text-[9px]">
            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Modificación Nro.</div>
            <div className="col-span-7 p-1.5">
              {mods.length > 0 ? mods.map((m) => m.modificacionNro).join(', ') : 'No aplica'}
            </div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Fecha</div>
            <div className="col-span-7 p-1.5">
              {mods.length > 0 ? mods.map((m) => formatDateDMY(m.fecha)).join(', ') : 'No aplica'}
            </div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Objeto de la Modificación</div>
            <div className="col-span-7 p-1.5 whitespace-pre-wrap">
              {mods.length > 0 ? mods.map((m) => `${m.modificacionNro}: ${m.objeto}`).join('\n') : 'No aplica'}
            </div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Valor Inicial del Contrato</div>
            <div className="col-span-7 p-1.5 font-mono font-bold text-right">{formatMoney(fin.valorInicial)}</div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Valores Adicionales</div>
            <div className="col-span-7 p-1.5 font-mono text-right">{formatMoney(fin.valoresAdicionales)}</div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Valor Pagado a la Fecha</div>
            <div className="col-span-7 p-1.5 font-mono font-bold text-right text-blue-900">
              {formatMoney(fin.valorPagadoALaFecha)}
            </div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Valor del Presente Pago</div>
            <div className="col-span-7 p-1.5 font-mono font-bold text-right text-emerald-800">
              {formatMoney(fin.valorPresentePago)}
            </div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Saldo del Contrato por Pagar</div>
            <div className="col-span-7 p-1.5 font-mono font-bold text-right">{formatMoney(fin.saldoPorPagar)}</div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Saldo del Contrato por Ejecutar</div>
            <div className="col-span-7 p-1.5 font-mono font-bold text-right">{formatMoney(fin.saldoPorEjecutar)}</div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-100">Valor Total Final</div>
            <div className="col-span-7 p-1.5 font-mono font-black text-right bg-slate-100">
              {formatMoney(fin.valorTotalFinal)}
            </div>
          </div>
        </div>

        {/* V. ACTIVIDADES REALIZADAS POR EL CONTRATISTA (TODAS, SIN LÍMITE FIJO) */}
        <div className="border border-black text-[9.5px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase tracking-wide">
            V. ACTIVIDADES REALIZADAS POR EL CONTRATISTA
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black text-[9px]">
            <div className="col-span-1 p-1.5 font-bold text-center bg-slate-50">N°</div>
            <div className="col-span-4 p-1.5 font-bold text-center bg-slate-50">Compromisos Contractuales</div>
            <div className="col-span-4 p-1.5 font-bold text-center bg-slate-50">Actividades Realizadas</div>
            <div className="col-span-3 p-1.5 font-bold text-center bg-slate-50">Productos</div>

            {allActivities.length === 0 ? (
              <>
                <div className="col-span-1 p-2 text-center font-bold">1</div>
                <div className="col-span-11 p-2 text-slate-500">Sin actividades registradas en este informe.</div>
              </>
            ) : (
              allActivities.map((act, idx) => (
                <React.Fragment key={idx}>
                  <div className="col-span-1 p-2 text-center font-bold">{idx + 1}</div>
                  <div className="col-span-4 p-2 text-slate-800 leading-snug whitespace-pre-wrap">
                    {act.obligacion}
                  </div>
                  <div className="col-span-4 p-2 text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {act.actividadRealizada}
                  </div>
                  <div className="col-span-3 p-2 text-slate-800 leading-snug whitespace-pre-wrap">
                    {act.productos || ''}
                    {act.fotografias && act.fotografias.length > 0 && (
                      <div className="mt-1 text-[8px] text-slate-600">
                        ({act.fotografias.length} evidencia(s) fotográfica(s) en Anexo)
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        {/* VI. VERIFICACIÓN INTEGRAL DEL CUMPLIMIENTO CONTRACTUAL */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase tracking-wide text-[9.5px]">
            VI. VERIFICACIÓN INTEGRAL DEL CUMPLIMIENTO CONTRACTUAL
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Porcentaje de Avance en Tiempo período informado (%) (mes)
            </div>
            <div className="col-span-2 p-1.5 font-bold text-center flex items-center justify-center">
              {formatPercent(fin.porcentajeAvanceTiempoPeriodo)} %
            </div>
            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Avance Financiero del Período Informado (%) (mes)
            </div>
            <div className="col-span-2 p-1.5 font-bold text-center flex items-center justify-center">
              {formatPercent(fin.porcentajeAvanceFinancieroPeriodo)} %
            </div>

            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Avance total en tiempo del contrato en % (acumulado):
            </div>
            <div className="col-span-2 p-1.5 font-bold text-center flex items-center justify-center">
              {formatPercent(fin.porcentajeAvanceTiempoAcumulado)} %
            </div>
            <div className="col-span-4 p-1.5 font-bold bg-slate-50">
              Avance Financiero Total del contrato en % (acumulado):
            </div>
            <div className="col-span-2 p-1.5 font-bold text-center flex items-center justify-center">
              {formatPercent(fin.porcentajeAvanceFinancieroAcumulado)} %
            </div>
          </div>

          {/* Checklist de Componentes */}
          <div className="grid grid-cols-12 divide-x divide-y divide-black border-t border-black">
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Componente</div>
            <div className="col-span-5 p-1.5 font-bold bg-slate-50 text-center">Aspecto Verificado</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Cumple</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Parcial</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">No cumple</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Observaciones</div>

            {[
              {
                key: 'tecnico' as const,
                nombre: 'Técnico',
                desc: 'Cumplimiento de las especificaciones técnicas, planos, calidades, licencias, autorizaciones, personal técnico, cumplimiento de los plazos, cronogramas, cumplimiento de los amparos del contrato y actividades y productos frente al objeto contractual, entre otros aspectos determinados en el componente técnico que se requiera',
              },
              {
                key: 'administrativo' as const,
                nombre: 'Administrativo',
                desc: 'Entrega oportuna de informes, soportes y evidencias contractuales; las garantías se encuentran vigentes y su cobertura de acuerdo a los términos determinados en el contrato; novedades existentes en la ejecución y terminación del contrato; la existencia de los respectivos informes generados desde el contratista respecto al cumplimiento del objeto contractual, entre otros aspectos determinados en el componente administrativo que se requiera',
              },
              {
                key: 'financiero' as const,
                nombre: 'Financiero',
                desc: 'Correspondencia entre actividades ejecutadas y valor a reconocer en el periodo respectivo, determinando los documentos para el pago; existencia de las apropiaciones presupuestales; las actas de recibidos a satisfacción de los bienes entregados o ejecutados conforme a lo estipulado en el contrato; las cuentas de cobro cumplen con los requisitos presupuestarios en la entidad; determinar el balance presupuestario para los pagos, la entrega de los anticipos, y si hay actividades adicionales, entre otros aspectos determinados en el componente financiero que se requiera',
              },
              {
                key: 'contable' as const,
                nombre: 'Contable',
                desc: 'revisión de cuenta de cobro que incluya los registros presupuestarios; soportes de pago y el recibo a satisfacción de los bienes o servicios objeto del contrato; cuentas bancarias determinadas para el pago; entre otros aspectos determinados en el componente contable que se requiera',
              },
              {
                key: 'juridico' as const,
                nombre: 'Jurídico',
                desc: 'verificación del cumplimiento de obligaciones contractuales y ausencia de novedades que afecten la ejecución; la existencia del acta de inicio, y actas de adición o prorroga con las respectivas pólizas determinar el cumplimiento de las disposiciones del sistema de seguridad social y salud en el trabajo; relacionar hechos o circunstancias que puedan constituir actos de corrupción entre otros aspectos determinados en el componente jurídico que se requiera',
              },
            ].map((comp) => {
              const st = ver?.[comp.key];
              return (
                <React.Fragment key={comp.key}>
                  <div className="col-span-2 p-2 font-bold bg-slate-50 flex items-center justify-center text-center">
                    {comp.nombre}
                  </div>
                  <div className="col-span-5 p-2 text-[8.5px] leading-snug">{comp.desc}</div>
                  <div className="col-span-1 p-2 text-center font-bold">{st?.resultado === 'Cumple' ? 'X' : ''}</div>
                  <div className="col-span-1 p-2 text-center font-bold">{st?.resultado === 'Parcial' ? 'X' : ''}</div>
                  <div className="col-span-1 p-2 text-center font-bold">{st?.resultado === 'No cumple' ? 'X' : ''}</div>
                  <div className="col-span-2 p-2 text-[8px]">{st?.observaciones || ''}</div>
                </React.Fragment>
              );
            })}

            <div className="col-span-7 p-1.5 font-bold bg-slate-50">Aspectos para Realizar Seguimiento</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Cumple</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Parcial</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">No Cumple</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Observaciones</div>

            {[
              { key: 'bienesRecibidos' as const, label: 'Bienes y/o Servicios Recibidos a la Fecha' },
              { key: 'bienesPendientes' as const, label: 'Bienes y/o Servicios Pendientes por Recibir' },
              { key: 'informesPresentados' as const, label: 'Informes de Supervisión Presentados a la Fecha' },
            ].map((it) => {
              const st = ver?.[it.key];
              return (
                <React.Fragment key={it.key}>
                  <div className="col-span-7 p-1.5 font-semibold">{it.label}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'Cumple' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'Parcial' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'No cumple' ? 'X' : ''}</div>
                  <div className="col-span-2 p-1.5 text-[8px]">{st?.observaciones || ''}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* VII. CONTROL DE NOVEDADES CONTRACTUALES */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            VII. CONTROL DE NOVEDADES CONTRACTUALES
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-7 p-1.5 font-bold bg-slate-50 text-center">Item</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Cumple</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Parcial</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">No Cumple</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Observaciones</div>

            {[
              { key: 'retrasos' as const, q: '¿Se presentaron retrasos en el cumplimiento de actividades durante el periodo evaluado?' },
              { key: 'requerimientos' as const, q: '¿Se presentaron requerimientos al contratista?' },
              { key: 'incumplimiento' as const, q: '¿Se evidenció incumplimiento parcial o total de alguna obligación?' },
              { key: 'ajusteCronograma' as const, q: '¿Se requirió ajustar cronograma, forma de ejecución o productos?' },
              { key: 'suspensionProrroga' as const, q: '¿Se presentó suspensión, prórroga, adición, modificación u otra novedad contractual?' },
              { key: 'riesgos' as const, q: '¿Se identificaron riesgos que puedan afectar la ejecución del contrato?' },
            ].map((item) => {
              const st = nov?.[item.key];
              return (
                <React.Fragment key={item.key}>
                  <div className="col-span-7 p-1.5 font-semibold">{item.q}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'Cumple' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'Parcial' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'No cumple' ? 'X' : ''}</div>
                  <div className="col-span-2 p-1.5 text-[8px]">{st?.observaciones || ''}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* VIII. CONTROL DE PRINCIPIOS Y CUMPLIMIENTO JURÍDICO */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            VIII. CONTROL DE PRINCIPIOS Y CUMPLIMIENTO JURÍDICO
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-7 p-1.5 font-bold bg-slate-50 text-center">Aspecto Jurídico a Verificar</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Cumple</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">Parcial</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">No Cumple</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Observaciones del Supervisor</div>

            {[
              { key: 'cumplimientoObligaciones' as const, q: '¿Cumplimiento de las obligaciones pactadas en el contrato?' },
              { key: 'correspondenciaActividades' as const, q: '¿Correspondencia entre actividades realizadas y objeto contractual?' },
              { key: 'soportesSuficientes' as const, q: '¿Soportes suficientes para acreditar la ejecución del periodo?' },
              { key: 'observanciaPrincipios' as const, q: '¿Observancia de los principios de eficacia, economía, responsabilidad y transparencia?' },
              { key: 'situacionesRequerimiento' as const, q: '¿Existencia de situaciones que ameriten requerimiento o advertencia?' },
            ].map((item) => {
              const st = pri?.[item.key];
              return (
                <React.Fragment key={item.key}>
                  <div className="col-span-7 p-1.5 font-semibold">{item.q}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'Cumple' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'Parcial' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.resultado === 'No cumple' ? 'X' : ''}</div>
                  <div className="col-span-2 p-1.5 text-[8px]">{st?.observaciones || ''}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* IX. ANÁLISIS DEL SUPERVISOR SOBRE PROCEDENCIA DEL PAGO */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            IX. ANÁLISIS DEL SUPERVISOR SOBRE PROCEDENCIA DEL PAGO
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-7 p-1.5 font-bold bg-slate-50 text-center">Criterio</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">SI</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">NO</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">N/A</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Observaciones</div>

            {[
              { key: 'relacionObligaciones' as const, q: '¿Las actividades del periodo guardan relación con las obligaciones contractuales?' },
              { key: 'productosRevisados' as const, q: '¿Los productos o entregables fueron revisados por la supervisión?' },
              { key: 'soportesSuficientes' as const, q: '¿Los soportes del periodo son suficientes para tramitar pago' },
              { key: 'seguridadSocialVerificada' as const, q: '¿Se verificó el pago de seguridad social del contratista?' },
              { key: 'procedeReconocimiento' as const, q: '¿Procede el reconocimiento económico del periodo evaluado?' },
            ].map((item) => {
              const st = pag?.[item.key];
              return (
                <React.Fragment key={item.key}>
                  <div className="col-span-7 p-1.5 font-semibold">{item.q}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.verificacion === 'SI' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.verificacion === 'NO' ? 'X' : ''}</div>
                  <div className="col-span-1 p-1.5 text-center font-bold">{st?.verificacion === 'N/A' ? 'X' : ''}</div>
                  <div className="col-span-2 p-1.5 text-[8px]">{st?.observaciones || ''}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* X. CONCEPTO GENERAL DEL SUPERVISOR */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            X. CONCEPTO GENERAL DEL SUPERVISOR
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-7 p-1.5 font-bold bg-slate-50"></div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">SI</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">NO</div>
            <div className="col-span-1 p-1.5 font-bold bg-slate-50 text-center">N/A</div>
            <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Observaciones</div>

            {(['Satisfactorio', 'Satisfactorio con observaciones', 'No Satisfactorio'] as const).map((opt) => (
              <React.Fragment key={opt}>
                <div className="col-span-7 p-1.5">{opt}</div>
                <div className="col-span-1 p-1.5 text-center font-bold">
                  {report.conceptoGeneral === opt ? 'X' : ''}
                </div>
                <div className="col-span-1 p-1.5 text-center"></div>
                <div className="col-span-1 p-1.5 text-center"></div>
                <div className="col-span-2 p-1.5 text-[8px]">
                  {report.conceptoGeneral === opt ? (report.observacionesSupervisor || '') : ''}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* XI. CONCLUSIÓN DEL SEGUIMIENTO INTEGRAL DEL PERIODO */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            XI. CONCLUSIÓN DEL SEGUIMIENTO INTEGRAL DEL PERIODO
          </div>
          <div className="p-2.5 border-b border-black space-y-2 leading-relaxed">
            <p className="whitespace-pre-wrap">
              {report.conclusionSeguimiento ||
                'Una vez revisadas las obligaciones contractuales, las actividades ejecutadas, los productos entregados, los soportes documentales y los aspectos técnicos, administrativos, financieros, contables y jurídicos, se deja constancia de que la ejecución del contrato durante el periodo evaluado fue:'}
            </p>
            <p className="whitespace-pre-wrap">
              <span className="font-bold">Observaciones adicionales:</span>{' '}
              {report.observacionesSupervisor || 'Sin observaciones adicionales.'}
            </p>
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black">
            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Cumplimiento del objeto contractual</div>
            <div className="col-span-7 p-1.5">{report.cumplimientoObjeto || ''}</div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Recursos Utilizados</div>
            <div className="col-span-7 p-1.5">{report.recursosUtilizados || ''}</div>

            <div className="col-span-5 p-1.5 font-bold bg-slate-50">Evidencias de la Ejecución del Contrato:</div>
            <div className="col-span-7 p-1.5">{report.evidenciasEjecucion || ''}</div>
          </div>
        </div>

        {/* XII. CONCEPTO DE LA SUPERVISIÓN */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            XII. CONCEPTO DE LA SUPERVISIÓN: {(report.conceptoGeneral || 'PENDIENTE').toUpperCase()}.
          </div>
          <div className="grid grid-cols-12 divide-x divide-y divide-black text-center">
            <div className="col-span-3 p-1.5 font-bold bg-slate-50">Número del acta</div>
            <div className="col-span-3 p-1.5 font-bold bg-slate-50">Valor Total</div>
            <div className="col-span-3 p-1.5 font-bold bg-slate-50">Valor Ejecutado</div>
            <div className="col-span-3 p-1.5 font-bold bg-slate-50">Saldo</div>

            {histActas.map((h, i) => (
              <React.Fragment key={i}>
                <div className="col-span-3 p-1.5 font-bold">{h.nroActa}</div>
                <div className="col-span-3 p-1.5 font-mono text-right">{formatMoney(h.valorTotal)}</div>
                <div className="col-span-3 p-1.5 font-mono font-bold text-right">{formatMoney(h.valorEjecutado)}</div>
                <div className="col-span-3 p-1.5 font-mono text-right">{formatMoney(h.saldo)}</div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* XIII. APORTES AL SISTEMA DE SEGURIDAD SOCIAL */}
        <div className="border border-black text-[9px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase text-[9.5px]">
            XIII. APORTES AL SISTEMA DE SEGURIDAD SOCIAL
          </div>
          {!report.aportesSeguridadSocial || report.aportesSeguridadSocial.length === 0 ? (
            <div className="p-3 text-center text-slate-500">
              Pendiente de registro de planilla / aportes para este período.
            </div>
          ) : (
            <div className="divide-y-2 divide-black">
              {report.aportesSeguridadSocial.map((ap, i) => (
                <div key={i} className="grid grid-cols-12 divide-x divide-y divide-black">
                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Comprobante N°</div>
                  <div className="col-span-2 p-1.5 font-mono">{ap.comprobanteNo}</div>
                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Entidad:</div>
                  <div className="col-span-4 p-1.5">{ap.entidad}</div>
                  <div className="col-span-2 p-1.5 font-bold bg-slate-50 text-center">Valor</div>

                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Planilla N°</div>
                  <div className="col-span-2 p-1.5 font-mono">{ap.planillaNo}</div>
                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Salud:</div>
                  <div className="col-span-4 p-1.5">{ap.salud?.entidad}</div>
                  <div className="col-span-2 p-1.5 font-mono text-right">{formatMoney(ap.salud?.valor)}</div>

                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Valor del Aporte:</div>
                  <div className="col-span-2 p-1.5 font-mono font-bold text-right">{formatMoney(ap.valorAporte)}</div>
                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Pensión:</div>
                  <div className="col-span-4 p-1.5">{ap.pension?.entidad}</div>
                  <div className="col-span-2 p-1.5 font-mono text-right">{formatMoney(ap.pension?.valor)}</div>

                  <div className="col-span-2 p-1.5 font-bold bg-slate-50 row-span-2 flex items-center">
                    Periodo de Cotización:
                  </div>
                  <div className="col-span-2 p-1.5 font-bold text-center row-span-2 flex items-center justify-center">
                    {ap.periodoCotizacion}
                  </div>
                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">Riesgos Laborales:</div>
                  <div className="col-span-4 p-1.5">{ap.riesgosLaborales?.entidad}</div>
                  <div className="col-span-2 p-1.5 font-mono text-right">{formatMoney(ap.riesgosLaborales?.valor)}</div>

                  <div className="col-span-2 p-1.5 font-bold bg-slate-50">
                    Caja de compensación (si hace aportes):
                  </div>
                  <div className="col-span-4 p-1.5">{ap.cajaCompensacion?.entidad}</div>
                  <div className="col-span-2 p-1.5 font-mono text-right">{formatMoney(ap.cajaCompensacion?.valor)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* XIV. FIRMAS */}
        <div className="border border-black text-[9.5px]">
          <div className="bg-slate-100 border-b border-black text-center font-bold p-1 uppercase">
            XIV. FIRMAS
          </div>
          <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
            <div className="p-4 pt-12 space-y-0.5">
              <div className="border-t border-black w-56 pt-1 font-bold uppercase text-[9px]">
                SUPERVISOR (A)
              </div>
              <div className="font-bold uppercase">{supervisorResp || 'Pendiente'}</div>
              <div className="text-[8.5px]">{supervisorCargo || 'Supervisor Designado'}</div>
              {supervisorDoc && <div className="text-[8px] font-mono">C.C. {supervisorDoc}</div>}
              <div className="text-[8.5px] uppercase font-semibold">{entidadContratante}</div>
            </div>
            <div className="p-4 pt-12 space-y-0.5">
              <div className="border-t border-black w-56 pt-1 font-bold uppercase text-[9px]">
                CONTRATISTA
              </div>
              <div className="font-bold uppercase">{contractorName || 'Pendiente'}</div>
              {contractorDoc && <div className="text-[8px] font-mono">C.C / NIT: {contractorDoc}</div>}
              <div className="text-[8.5px]">Ejecutor Contractual</div>
            </div>
          </div>
          <div className="p-3 text-[8.5px] space-y-2 leading-relaxed">
            <p>
              <strong>Nota 1:</strong> Se deja constancia de que la presente supervisión no se limita a la relación de actividades reportadas por el contratista, sino que comprende la verificación material del cumplimiento de las obligaciones contractuales, la revisión de soportes, el análisis de novedades y la evaluación integral del contrato en sus componentes técnico, administrativo, financiero, contable y jurídico.
            </p>
            <p>
              <strong>Nota 2:</strong> Conforme Decreto 1273 del 23 de julio de 2018, expedida por el Ministerio de Salud y Protección Social el Contratista debe efectuar el pago de la Seguridad Social mes vencido hasta el segundo (02) día hábil de cada mes.
            </p>
          </div>
        </div>

        <p className="text-[9.5px] text-slate-800">
          Dada en {lugarEjecucion}, a los {fechaDada.dia} días del mes de {fechaDada.mes} de {fechaDada.anio}.
        </p>

        {/* ANEXOS FOTOGRÁFICOS Y SOPORTES */}
        {hasPhotosOrDocs && (
          <div className="border border-black text-[9.5px] mt-4">
            <div className="bg-slate-100 border-b border-black text-center font-bold p-1.5 uppercase">
              ANEXO DE EVIDENCIAS Y REGISTRO FOTOGRÁFICO DE EJECUCIÓN
            </div>
            <div className="p-3 space-y-4">
              {allActivities.map((act, i) => {
                const hasItems =
                  (act.fotografias && act.fotografias.length > 0) ||
                  (act.soportes && act.soportes.length > 0);
                if (!hasItems) return null;
                return (
                  <div key={i} className="border border-slate-300 p-3 rounded space-y-2">
                    <div className="font-bold text-slate-900 text-[9.5px] bg-slate-50 p-1.5 border border-slate-200">
                      Obligación {i + 1}: {act.obligacion}
                    </div>
                    {act.fotografias && act.fotografias.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {act.fotografias.map((f, fi) => (
                          <div key={fi} className="border border-slate-200 p-2 rounded bg-slate-50">
                            {f.url ? (
                              <img
                                src={getMediaUrl(f.url)}
                                alt={f.descripcion}
                                className="w-full h-40 object-contain bg-white rounded mb-1 border border-slate-200"
                              />
                            ) : (
                              <div className="w-full h-24 bg-slate-200 rounded flex items-center justify-center text-[10px] text-slate-500 mb-1">
                                [Registro Fotográfico]
                              </div>
                            )}
                            <p className="text-[8.5px] font-semibold text-slate-800">{f.descripcion}</p>
                            {f.fecha && (
                              <p className="text-[8px] text-slate-500">Fecha: {formatDateDMY(f.fecha)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {act.soportes && act.soportes.length > 0 && (
                      <div className="text-[8.5px] text-slate-700 pt-1">
                        <span className="font-bold">Soportes adjuntos:</span>{' '}
                        {act.soportes.map((s) => s.nombre).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <InstitutionalFooter />

        {/* =================================================================
            INFORME DE ACTIVIDADES (Anexo final inmediato al terminar el Acta)
            ================================================================= */}
        {(() => {
          const firstAp =
            report.aportesSeguridadSocial && report.aportesSeguridadSocial.length > 0
              ? report.aportesSeguridadSocial[0]
              : undefined;
          const infSalud = firstAp?.salud?.valor !== undefined ? formatMoney(firstAp.salud.valor) : 'Pendiente';
          const infPension = firstAp?.pension?.valor !== undefined ? formatMoney(firstAp.pension.valor) : 'Pendiente';
          const infArl = firstAp?.riesgosLaborales?.valor !== undefined ? formatMoney(firstAp.riesgosLaborales.valor) : 'Pendiente';
          const infPerCot = firstAp?.periodoCotizacion || 'Pendiente';
          const infComp = firstAp?.comprobanteNo || 'Pendiente';
          const infPlan = firstAp?.planillaNo || 'Pendiente';
          const perIniLarga = report.fechaInicioPeriodo
            ? formatFechaLarga(report.fechaInicioPeriodo).texto.toUpperCase()
            : '';
          const perFinLarga = report.fechaFinPeriodo
            ? formatFechaLarga(report.fechaFinPeriodo).texto.toUpperCase()
            : '';
          const infPerTexto =
            perIniLarga && perFinLarga
              ? `DEL ${perIniLarga} AL ${perFinLarga}`
              : (report.periodo || '').toUpperCase();
          const claseContrato = [
            tipoContrato,
            contractNumber ? `N° ${contractNumber}` : '',
            fecInicio ? `DE FECHA ${formatDateDMY(fecInicio)}` : '',
          ]
            .filter(Boolean)
            .join(' ');
          const actaNumPad = String(report.numeroActa || 1).padStart(2, '0');

          return (
            <div className="border-t-4 border-dashed border-slate-300 pt-8 mt-10 space-y-5 print:border-none print:mt-0 print:pt-0 print:break-before-page">
              {/* Centered bordered title box */}
              <div className="flex justify-center">
                <div className="border-2 border-black px-10 py-2.5 text-center font-bold text-[13px] leading-snug">
                  <div>Informe de Actividades</div>
                  <div>Número {actaNumPad}</div>
                </div>
              </div>

              {/* Main Informe de Actividades table */}
              <div className="border border-black text-[9.5px]">
                <div className="grid grid-cols-12 divide-x divide-y divide-black">
                  <div className="col-span-5 p-2 font-bold">
                    <span className="block">NOMBRE DEL CONTRATISTA:</span>
                    <span className="uppercase">{contractorName}</span>
                  </div>
                  <div className="col-span-3 p-2 font-bold">
                    <span>CÉDULA: {contractorDoc}</span>
                    {contractor?.direccion && (
                      <span className="block font-semibold mt-0.5">{contractor.direccion}</span>
                    )}
                  </div>
                  <div className="col-span-4 p-2 font-bold break-all">
                    <span className="block">CORREO DEL CONTRATISTA:</span>
                    <span className="font-normal text-blue-900 underline">{contractor?.email || ''}</span>
                  </div>

                  <div className="col-span-8 p-2 font-bold">
                    <span className="block">SUPERVISOR:</span>
                    <span className="uppercase">{supervisorResp}</span>
                  </div>
                  <div className="col-span-4 p-2 font-bold break-all">
                    <span className="block">CORREO DEL SUPERVISOR:</span>
                    <span className="font-normal text-blue-900 underline">{resolvedSupervisorEmail || ''}</span>
                  </div>

                  <div className="col-span-12 p-2 font-bold">
                    <span className="block">Periodo informado:</span>
                    <span>{infPerTexto}</span>
                  </div>

                  <div className="col-span-8 p-2 font-bold flex items-center">
                    <span>CLASE DE CONTRATO, NÚMERO Y FECHA: {claseContrato}</span>
                  </div>
                  <div className="col-span-4 p-2 font-bold">
                    <span className="block">TELÉFONO DEL CONTRATISTA:</span>
                    <span className="font-normal">{contractor?.telefono || ''}</span>
                  </div>

                  <div className="col-span-12 p-2 space-y-1">
                    <span className="font-bold block">OBJETO DEL CONTRATO:</span>
                    <p>{objetoContrato ? `“${objetoContrato}”` : ''}</p>
                  </div>

                  <div className="col-span-12 p-2 font-bold space-y-0.5 leading-relaxed">
                    <div>
                      VALOR PAGADO SISTEMA DE SEGURIDAD: SALUD: {infSalud} &nbsp;&nbsp; PENSIÓN: {infPension}
                    </div>
                    <div>
                      ARL: {infArl} &nbsp;&nbsp; PERIODO DE COTIZACION: {infPerCot}
                    </div>
                    <div>COMPROBANTE No. {infComp}</div>
                    <div>PLANILLA No. {infPlan}</div>
                  </div>

                  <div className="col-span-12 p-2 font-bold">
                    SITIO DE EJECUCIÓN: <span className="font-normal">{lugarEjecucion || 'Municipio de Quimbaya (Q).'}</span>
                  </div>
                </div>

                {/* Activities Sub-table */}
                <div className="border-t border-black divide-y divide-black">
                  <div className="grid grid-cols-12 divide-x divide-black font-bold italic text-center bg-slate-50">
                    <div className="col-span-1 p-2"></div>
                    <div className="col-span-4 p-2">ACTIVIDADES CONTRACTUALES</div>
                    <div className="col-span-4 p-2">ACTIVIDADES REALIZADAS</div>
                    <div className="col-span-3 p-2">PRODUCTOS</div>
                  </div>

                  {allActivities.length === 0 ? (
                    <div className="grid grid-cols-12 divide-x divide-black">
                      <div className="col-span-1 p-2 text-center font-bold">1</div>
                      <div className="col-span-4 p-2 text-slate-500">Sin obligaciones registradas.</div>
                      <div className="col-span-4 p-2"></div>
                      <div className="col-span-3 p-2"></div>
                    </div>
                  ) : (
                    allActivities.map((act, idx) => (
                      <div key={idx} className="grid grid-cols-12 divide-x divide-black">
                        <div className="col-span-1 p-2 text-center font-bold">{idx + 1}</div>
                        <div className="col-span-4 p-2 whitespace-pre-wrap">{act.obligacion}</div>
                        <div className="col-span-4 p-2 whitespace-pre-wrap">{act.actividadRealizada}</div>
                        <div className="col-span-3 p-2 whitespace-pre-wrap">{act.productos}</div>
                      </div>
                    ))
                  )}

                  <div className="grid grid-cols-12 divide-x divide-black">
                    <div className="col-span-1 p-2"></div>
                    <div className="col-span-4 p-2">ANEXOS: CUENTA DE COBRO, PAGO DE SEGURIDAD SOCIAL</div>
                    <div className="col-span-4 p-2 flex items-center">Se presentan los respectivos anexos.</div>
                    <div className="col-span-3 p-2">-Carpeta del contratista en el archivo de la oficina asesora jurídica</div>
                  </div>
                </div>
              </div>

              {/* Contractor Signature Block */}
              <div className="pt-12 text-[10px] font-bold space-y-0.5">
                <div className="border-t border-black w-64 pt-1 uppercase">
                  {contractorName || 'CONTRATISTA'}
                </div>
                <div>
                  {contractor?.tipoDocumento === 'NIT' ? 'NIT' : 'C.C. N°'} {contractorDoc}
                </div>
                <div>Contratista.</div>
                <div>{lugarEjecucion || 'Oficina. Alcaldía Municipal de Quimbaya (Q).'}</div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
