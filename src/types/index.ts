export type UserRole = 'admin' | 'supervisor' | 'contratista';

export interface AuditLog {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: UserRole;
  accion: string;
  modulo: string;
  detalles: string;
  fecha: string;
  ip?: string;
}

export interface User {
  id: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  profesion?: string;
  rol: UserRole;
  direccion?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  eps?: string;
  afp?: string;
  arl?: string;
  estado: 'activo' | 'inactivo';
  createdAt: string;
  updatedAt: string;
  totalContratos?: number;
  contratosActivos?: number;
  totalContratosSupervisados?: number;
  contratosActivosSupervisados?: number;
}

export interface ContractPoliza {
  aplica: boolean;
  tipoGarantia?: string;
  nombreGarante?: string;
  numeroGarantia?: string;
  contratistaTomador?: string;
  beneficiario?: string;
  companiaAseguradora?: string;
  amparos?: string;
  cumplimientoHasta?: string;
  calidadHasta?: string;
  salariosHasta?: string;
}

export interface ContractModificacion {
  modificacionNro: string;
  fecha: string;
  objeto: string;
  valorAdicional: number;
}

export interface Contract {
  id: string;
  numeroContrato: string;
  tipoContrato?: string;
  entidadContratante: string;
  nitEntidad: string;
  contratistaId: string;
  contratistaNombre: string;
  contratistaDocumento: string;
  supervisorResponsable: string;
  supervisorCargo?: string;
  supervisorDocumento?: string;
  lugarEjecucion?: string;
  objeto: string;
  fechaInicio: string;
  fechaFin: string;
  valorTotal: number;
  honorariosMensuales: number;
  obligacionesContractuales: string[];
  periodicidadPago: string;
  condicionesPago: string;
  codigoSecop?: string;
  cdpNumero?: string;
  cdpFecha?: string;
  crpNumero?: string;
  crpFecha?: string;
  vigenciaDias?: number;
  duracionTexto?: string;
  polizas?: ContractPoliza;
  modificaciones?: ContractModificacion[];
  historialActas?: Array<{
    nroActa: number;
    periodo: string;
    valorTotal: number;
    valorEjecutado: number;
    saldo: number;
    fecha: string;
  }>;
  estado: 'Activo' | 'En trámite' | 'Finalizado' | 'Suspendido';
  createdAt: string;
  updatedAt: string;
}

export interface ReportActivityEvidence {
  id: string;
  url: string;
  fileId?: string;
  descripcion: string;
  fecha?: string;
  size?: number;
  mimeType?: string;
}

export interface ReportActivityDocument {
  id: string;
  nombre: string;
  url?: string;
  fileId?: string;
  tipo?: string;
  size?: number;
  fecha?: string;
}

export interface ReportActivityItem {
  id?: string;
  obligacion: string;
  actividadRealizada: string;
  productos?: string;
  fechas?: string;
  fotografias?: ReportActivityEvidence[];
  soportes?: ReportActivityDocument[];
  soporte?: string;
}

export interface CheckItemState {
  resultado: 'Cumple' | 'Parcial' | 'No cumple';
  observaciones: string;
}

export interface CheckSiNoItem {
  verificacion: 'SI' | 'NO' | 'N/A';
  observaciones: string;
}

export interface AporteSeguridadSocialItem {
  comprobanteNo: string;
  entidad: string;
  planillaNo: string;
  valorAporte: number;
  periodoCotizacion: string;
  salud: { entidad: string; valor: number };
  pension: { entidad: string; valor: number };
  riesgosLaborales: { entidad: string; valor: number };
  cajaCompensacion: { entidad: string; valor: number };
}

export interface ActivityReport {
  id: string;
  contratoId: string;
  numeroContrato: string;
  contratistaId: string;
  contratistaNombre: string;
  periodo: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  numeroActa: number;
  lugarFechaActa: string;
  actividades: ReportActivityItem[];
  logros?: string;
  dificultades?: string;
  estado: 'Borrador' | 'Radicado' | 'En revisión' | 'Devuelto' | 'Aprobado' | 'Con observaciones';
  observacionesSupervisor?: string;
  historialEstados?: Array<{
    estado: string;
    fecha: string;
    usuario: string;
    observaciones?: string;
  }>;
  fechaRadicacion?: string;
  numeroRadicacion?: string;
  estadoError?: string;
  archivoPdfPath?: string;
  fechaRevision?: string;
  revisadoPor?: string;
  financiero: {
    valorInicial: number;
    valoresAdicionales: number;
    valorPagadoALaFecha: number;
    valorPresentePago: number;
    saldoPorPagar: number;
    saldoPorEjecutar: number;
    valorTotalFinal: number;
    porcentajeAvanceTiempoPeriodo: number;
    porcentajeAvanceFinancieroPeriodo: number;
    porcentajeAvanceTiempoAcumulado: number;
    porcentajeAvanceFinancieroAcumulado: number;
  };
  verificacionIntegral?: {
    tecnico: CheckItemState;
    administrativo: CheckItemState;
    financiero: CheckItemState;
    contable: CheckItemState;
    juridico: CheckItemState;
    bienesRecibidos: CheckItemState;
    bienesPendientes: CheckItemState;
    informesPresentados: CheckItemState;
  };
  controlNovedades?: {
    retrasos: CheckItemState;
    requerimientos: CheckItemState;
    incumplimiento: CheckItemState;
    ajusteCronograma: CheckItemState;
    suspensionProrroga: CheckItemState;
    riesgos: CheckItemState;
  };
  controlPrincipios?: {
    cumplimientoObligaciones: CheckItemState;
    correspondenciaActividades: CheckItemState;
    soportesSuficientes: CheckItemState;
    observanciaPrincipios: CheckItemState;
    situacionesRequerimiento: CheckItemState;
  };
  analisisPago?: {
    relacionObligaciones: CheckSiNoItem;
    productosRevisados: CheckSiNoItem;
    soportesSuficientes: CheckSiNoItem;
    seguridadSocialVerificada: CheckSiNoItem;
    procedeReconocimiento: CheckSiNoItem;
  };
  conceptoGeneral: 'Satisfactorio' | 'Satisfactorio con observaciones' | 'No Satisfactorio';
  conclusionSeguimiento: string;
  cumplimientoObjeto: string;
  recursosUtilizados: string;
  evidenciasEjecucion: string;
  historialActasConcepto?: Array<{
    nroActa: number;
    valorTotal: number;
    valorEjecutado: number;
    saldo: number;
  }>;
  aportesSeguridadSocial?: AporteSeguridadSocialItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialSecurityRecord {
  id: string;
  contratistaId: string;
  contratistaNombre: string;
  contratoId: string;
  periodo: string;
  numeroPlanilla: string;
  operadorPila: string;
  valorPagado: number;
  fechaPago: string;
  saludEntidad?: string;
  saludValor?: number;
  pensionEntidad?: string;
  pensionValor?: number;
  arlEntidad?: string;
  arlValor?: number;
  cajaEntidad?: string;
  cajaValor?: number;
  soporteNombre?: string;
  estado: 'Al día' | 'Pendiente' | 'En mora';
  observaciones?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  contratoId: string;
  numeroContrato: string;
  contratistaId: string;
  contratistaNombre: string;
  periodo: string;
  valor: number;
  informeId?: string;
  estado: 'Pendiente certificación' | 'Certificado por supervisión' | 'Ordenado para pago' | 'Pagado';
  fechaCertificacion?: string;
  referenciaPago?: string;
  createdAt: string;
}

export interface SupervisorStats {
  totalContratistas: number;
  contratosActivos: number;
  informesPendientesRevision: number;
  informesAprobados: number;
  informesConObservaciones: number;
  valorTotalContratado: number;
  valorTotalPagado: number;
  totalContratos: number;
  totalInformes: number;
}

export interface ContractorStats {
  tieneContrato: boolean;
  totalContratos: number;
  contratoActivo: Contract | null;
  informesPendientes: number;
  informesRadicados: number;
  informesAprobados: number;
  planillasPresentadas: number;
  pagosCertificados: number;
}

export interface AdminStats {
  totalUsuarios: number;
  totalSupervisores: number;
  supervisoresActivos: number;
  totalContratistas: number;
  contratistasActivos: number;
  totalContratos: number;
  contratosActivos: number;
  totalInformes: number;
  informesPendientes: number;
  informesAprobados: number;
  totalEventosAuditoria: number;
}
