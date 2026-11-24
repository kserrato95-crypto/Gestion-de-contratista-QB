import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  tipoDocumento: string; // 'CC' | 'CE' | 'NIT' | 'PAS'
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  profesion?: string;
  rol: 'admin' | 'supervisor' | 'contratista';
  passwordHash: string;
  salt: string;
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
}

export interface AuditLog {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: 'admin' | 'supervisor' | 'contratista';
  accion: string;
  modulo: string;
  detalles: string;
  fecha: string;
  ip?: string;
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
  tipoContrato?: string; // 'CONTRATO DE PRESTACIÓN DE SERVICIOS'
  entidadContratante: string; // 'MUNICIPIO DE QUIMBAYA, QUINDÍO'
  nitEntidad: string; // '890.000.613-4'
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

export interface StoredEvidenceFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedByNombre: string;
  contratistaId: string;
  contratoId?: string;
  periodo?: string;
  obligacionId?: string;
  actividadId?: string;
  tipo: 'fotografia' | 'soporte' | 'seguridad_social';
  descripcion?: string;
  createdAt: string;
}

export interface ReportActivityEvidence {
  id: string;
  url: string; // URL reference e.g. /api/uploads/:id or file id
  fileId?: string;
  descripcion: string;
  fecha?: string;
  size?: number;
  mimeType?: string;
  nombreOriginal?: string;
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
  periodo: string; // ej. "25/04/2026 - 24/08/2026"
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  numeroActa: number;
  lugarFechaActa: string;
  actividades: ReportActivityItem[];
  logros?: string;
  dificultades?: string;
  estado: 'Borrador' | 'Radicado' | 'En revisión' | 'Devuelto' | 'Aprobado';
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
  // Financial breakdown for the official acta
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
  // Supervisor verification checklists
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
  soporteNombre?: string;
  saludEntidad?: string;
  saludValor?: number;
  pensionEntidad?: string;
  pensionValor?: number;
  arlEntidad?: string;
  arlValor?: number;
  cajaEntidad?: string;
  cajaValor?: number;
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

interface DatabaseSchema {
  users: User[];
  contracts: Contract[];
  reports: ActivityReport[];
  socialSecurity: SocialSecurityRecord[];
  payments: PaymentRecord[];
  auditLogs: AuditLog[];
  evidenceFiles: StoredEvidenceFile[];
  radicacionCounter: number;
}

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const ACTAS_DIR = path.join(DATA_DIR, 'actas');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = hashPassword(password, salt);
  return result.hash === hash;
}

function getInitialData(): DatabaseSchema {
  const adminPass = hashPassword('Admin2025!*');
  const supPass = hashPassword('Supervisor2025!');
  const contPass = hashPassword('Contratista2025!');

  const admin: User = {
    id: 'user-admin-01',
    tipoDocumento: 'CC',
    numeroDocumento: '10000001',
    nombres: 'Administrador',
    apellidos: 'General del Sistema',
    email: 'admin@quimbaya.gov.co',
    telefono: '3100000000',
    profesion: 'Oficina de Control Interno y Sistemas',
    rol: 'admin',
    passwordHash: adminPass.hash,
    salt: adminPass.salt,
    direccion: 'Palacio Municipal de Quimbaya, Quindío',
    estado: 'activo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const supervisor: User = {
    id: 'user-supervisor-01',
    tipoDocumento: 'CC',
    numeroDocumento: '18470223',
    nombres: 'Carlos Alberto',
    apellidos: 'Correa Mejía',
    email: 'supervisor@entidad.gov.co',
    telefono: '3175519367',
    profesion: 'Subsecretario Tecnologías de las Comunicaciones y la Información',
    rol: 'supervisor',
    passwordHash: supPass.hash,
    salt: supPass.salt,
    direccion: 'Carrera 6 Calle 12 Esquina, Quimbaya, Quindío',
    estado: 'activo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const contratista: User = {
    id: 'user-contratista-01',
    tipoDocumento: 'NIT',
    numeroDocumento: '900687199-1',
    nombres: 'Seven Soluciones',
    apellidos: 'Informáticas S.A.S',
    email: 'carlos.mendoza@contratista.gov.co',
    telefono: '3243018787',
    profesion: 'Soluciones Tecnológicas e Informáticas',
    rol: 'contratista',
    passwordHash: contPass.hash,
    salt: contPass.salt,
    direccion: 'Carrera 6 Calle 12 Esquina, Quimbaya',
    banco: 'Bancolombia',
    tipoCuenta: 'Ahorros',
    numeroCuenta: '86517884351',
    eps: 'Nueva EPS',
    afp: 'Colfondos',
    arl: 'Positiva Compañía de Seguros S.A.',
    estado: 'activo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const contrato: Contract = {
    id: 'contract-001',
    numeroContrato: 'No 230 DEL 2026',
    tipoContrato: 'CONTRATO DE PRESTACIÓN DE SERVICIOS',
    entidadContratante: 'MUNICIPIO DE QUIMBAYA, QUINDÍO',
    nitEntidad: '890.000.613-4',
    contratistaId: contratista.id,
    contratistaNombre: `${contratista.nombres} ${contratista.apellidos}`,
    contratistaDocumento: contratista.numeroDocumento,
    supervisorResponsable: `${supervisor.nombres} ${supervisor.apellidos}`,
    supervisorCargo: 'SUBSECRETARIO TECNOLOGÍAS DE LAS COMUNICACIONES Y LA INFORMACIÓN',
    supervisorDocumento: supervisor.numeroDocumento,
    lugarEjecucion: 'QUIMBAYA, QUINDÍO',
    objeto: '“PRESTACION DE SERVICIOS DE SOPORTE, ACTUALIZACION Y MANTENIMIENTO PARA EL SISTEMA DE INFORMACION INTRAWEB VENTANILLA UNICA EN LA ALCALDIA MUNICIPAL DE QUIMBAYA.”',
    fechaInicio: '2026-01-22',
    fechaFin: '2026-12-31',
    valorTotal: 13785393.30,
    honorariosMensuales: 4595131,
    obligacionesContractuales: [
      '1. Realizar la actualización del sistema de información, Intraweb Ventanilla Única en la Alcaldía de Quimbaya conforme a la normatividad vigente.',
      '2. Proveer y mantener un sistema integrado de atención al ciudadano que facilite a la comunidad la adecuada gestión de peticiones, quejas, reclamos y denuncias (PQRD), mediante un sistema de información que permita el registro, seguimiento y control en línea de los requerimientos.',
      '3. Implementar una unidad de correspondencia digital que ofrezca un marco de trabajo flexible orientado a la estrategia cero papel, mediante la inclusión de procesos electrónicos reflejados en la creación, gestión y almacenamiento de documentos en soportes digitales.',
      '4. Adecuar y migrar los sistemas web Intraweb de la Alcaldía Municipal de Quimbaya desde el servidor local a un esquema de infraestructura en la nube, brindando servicios de hosting y alojamiento que garanticen el acceso a la Ventanilla Única desde cualquier lugar con conexión a internet, y que permitan ampliar la interacción y el acceso de los ciudadanos al aplicativo.',
      '5. Prestar el servicio de mesa de ayuda virtual, que permita la ejecución de actividades de mantenimiento, soporte técnico y actualización de los programas informáticos de manera remota, mediante el uso de protocolos seguros de internet, garantizando adecuado funcionamiento de la plataforma web y de los servicios en la nube de la Entidad.',
      '6. Brindar un total de ocho (8) horas de acompañamiento y capacitación mensual distribuidas en cuatro (4) horas de acompañamiento y/o capacitación presencial y cuatro (4) horas de acompañamiento virtual.',
    ],
    periodicidadPago: 'Cuatro (4) pagos periódicos',
    condicionesPago: 'Previa presentación y aprobación del informe mensual de actividades, acta de supervisión y constancia de pago de aportes a la seguridad social.',
    codigoSecop: 'CO1.PCCNTR.789124',
    cdpNumero: '000020',
    cdpFecha: '2026-01-05',
    crpNumero: '000304',
    crpFecha: '2026-01-22',
    vigenciaDias: 344,
    polizas: {
      aplica: false,
      amparos: 'N/A',
    },
    modificaciones: [],
    historialActas: [
      {
        nroActa: 1,
        periodo: '22/01/2026 al 24/04/2026',
        valorTotal: 13785393.30,
        valorEjecutado: 4595131,
        saldo: 9190262.30,
        fecha: '2026-04-28',
      },
    ],
    estado: 'Activo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const defaultVerif = {
    resultado: 'Cumple' as const,
    observaciones: '',
  };

  const informe: ActivityReport = {
    id: 'report-002',
    contratoId: contrato.id,
    numeroContrato: contrato.numeroContrato,
    contratistaId: contratista.id,
    contratistaNombre: contrato.contratistaNombre,
    periodo: '25/04/2026 - 24/08/2026',
    fechaInicioPeriodo: '2026-04-25',
    fechaFinPeriodo: '2026-08-24',
    numeroActa: 2,
    lugarFechaActa: 'QUIMBAYA, QUINDÍO, 9 DE OCTUBRE DE 2026',
    actividades: [
      {
        id: 'act-1',
        obligacion: '1. Realizar la actualización del sistema de información, Intraweb Ventanilla Única en la Alcaldía de Quimbaya conforme a la normatividad vigente.',
        actividadRealizada: 'Se realizó un acta de seguimiento ya que en el Informe No 1, se presentó la actualización del Sistema Intraweb Ventanilla Única De La Alcaldía De Quimbaya.',
        productos: 'Acta de seguimiento de actualización Intraweb Ventanilla Única.',
        fechas: 'Mayo - Junio 2026',
        fotografias: [
          {
            id: 'photo-1',
            url: '',
            descripcion: 'Interfaz principal actualizada del Sistema Intraweb Ventanilla Única',
          },
        ],
        soportes: [{ id: 'doc-1', nombre: 'Acta_Actualizacion_Intraweb_2026.pdf' }],
      },
      {
        id: 'act-2',
        obligacion: '2. Proveer y mantener un sistema integrado de atención al ciudadano que facilite a la comunidad la adecuada gestión de peticiones, quejas, reclamos y denuncias (PQRD), mediante un sistema de información que permita el registro, seguimiento y control en línea de los requerimientos.',
        actividadRealizada: 'Se llevan a cabo asesorías sobre la implementación del sistema funcional y accesible por la comunidad del municipio a través de un servicio de alojamiento web y la disposición del dominio www.ventanillaunicaquimbaya.gov.co Asimismo, se actualiza vigencias el cual integra servicios de correspondencia externa recibida y enviada con el módulo de PQRSD.',
        productos: 'Módulo de PQRSD y correspondencia en línea operativo 24/7.',
        fechas: 'Junio - Julio 2026',
        fotografias: [],
        soportes: [{ id: 'doc-2', nombre: 'Certificacion_Disponibilidad_PQRSD.pdf' }],
      },
      {
        id: 'act-3',
        obligacion: '3. Implementar una unidad de correspondencia digital que ofrezca un marco de trabajo flexible orientado a la estrategia cero papel, mediante la inclusión de procesos electrónicos reflejados en la creación, gestión y almacenamiento de documentos en soportes digitales.',
        actividadRealizada: 'En cumplimiento de la obligación de Correspondencia Digital opera bajo la estrategia "cero papel" mediante procesos electrónicos para la creación, gestión y almacenamiento de documentos.',
        productos: 'Estrategia cero papel aplicada a correspondencia oficial radicada.',
        fechas: 'Julio 2026',
        fotografias: [],
        soportes: [],
      },
      {
        id: 'act-4',
        obligacion: '4. Adecuar y migrar los sistemas web Intraweb de la Alcaldía Municipal de Quimbaya desde el servidor local a un esquema de infraestructura en la nube, brindando servicios de hosting y alojamiento que garanticen el acceso a la Ventanilla Única desde cualquier lugar con conexión a internet, y que permitan ampliar la interacción y el acceso de los ciudadanos al aplicativo.',
        actividadRealizada: 'El sistema de Intraweb se encuentra disponible, vigente y estable brindando una infraestructura en la nube que garantiza el servicio oportuno a la ciudadanía de Quimbaya a través de dominio https://www.ventanillaunicavirtualquimbaya.gov.co/',
        productos: 'Infraestructura cloud activa y monitoreada.',
        fechas: 'Julio - Agosto 2026',
        fotografias: [],
        soportes: [],
      },
      {
        id: 'act-5',
        obligacion: '5. Prestar el servicio de mesa de ayuda virtual, que permita la ejecución de actividades de mantenimiento, soporte técnico y actualización de los programas informáticos de manera remota, mediante el uso de protocolos seguros de internet, garantizando adecuado funcionamiento de la plataforma web y de los servicios en la nube de la Entidad.',
        actividadRealizada: 'Se brindó por parte del proveedor Seven Soluciones Informáticas S.A.S mesa de ayuda a través de la línea atención No 3243018787, y la página web www.seven.com.co garantizando una respuesta eficiente y continua a los usuarios.',
        productos: 'Mesa de ayuda y tickets de soporte atendidos oportunamente.',
        fechas: 'Agosto 2026',
        fotografias: [],
        soportes: [],
      },
      {
        id: 'act-6',
        obligacion: '6. Brindar un total de ocho (8) horas de acompañamiento y capacitación mensual distribuidas en cuatro (4) horas de acompañamiento y/o capacitación presencial y cuatro (4) horas de acompañamiento virtual.',
        actividadRealizada: 'La entidad no requirió el acompañamiento; sin embargo, ya tenemos definido fechas y un plan de trabajo para su ejecución en el próximo periodo.',
        productos: 'La entidad no hizo uso de las horas de acompañamiento presencial.',
        fechas: 'Agosto 2026',
        fotografias: [],
        soportes: [],
      },
    ],
    logros: 'Continuidad operativa y alta disponibilidad del portal de Ventanilla Única.',
    dificultades: 'Ninguna novedad presentada durante el período evaluado.',
    estado: 'En revisión',
    observacionesSupervisor: 'Actividades ejecutadas a entera satisfacción. Se verifica correspondencia entre obligaciones, productos y aportes a seguridad social.',
    historialEstados: [
      {
        estado: 'Borrador',
        fecha: '2026-09-28T10:00:00Z',
        usuario: 'Seven Soluciones Informáticas S.A.S',
        observaciones: 'Inicio de diligenciamiento del informe.',
      },
      {
        estado: 'Radicado',
        fecha: '2026-10-02T14:30:00Z',
        usuario: 'Seven Soluciones Informáticas S.A.S',
        observaciones: 'Radicación formal del informe y soportes para supervisión.',
      },
      {
        estado: 'En revisión',
        fecha: '2026-10-04T09:00:00Z',
        usuario: 'Carlos Alberto Correa Mejía',
        observaciones: 'Apertura de acta de supervisión para validación técnica.',
      },
    ],
    fechaRadicacion: '2026-10-02T14:30:00Z',
    fechaRevision: '2026-10-04T09:00:00Z',
    revisadoPor: `${supervisor.nombres} ${supervisor.apellidos}`,
    financiero: {
      valorInicial: 13785393.30,
      valoresAdicionales: 0,
      valorPagadoALaFecha: 4595131,
      valorPresentePago: 4595131,
      saldoPorPagar: 9190262.30,
      saldoPorEjecutar: 9190262.30,
      valorTotalFinal: 13785393.30,
      porcentajeAvanceTiempoPeriodo: 33.33,
      porcentajeAvanceFinancieroPeriodo: 33.33,
      porcentajeAvanceTiempoAcumulado: 66.66,
      porcentajeAvanceFinancieroAcumulado: 66.66,
    },
    verificacionIntegral: {
      tecnico: { ...defaultVerif },
      administrativo: { ...defaultVerif },
      financiero: { ...defaultVerif },
      contable: { ...defaultVerif },
      juridico: { ...defaultVerif },
      bienesRecibidos: { ...defaultVerif },
      bienesPendientes: { ...defaultVerif },
      informesPresentados: { ...defaultVerif },
    },
    controlNovedades: {
      retrasos: { ...defaultVerif },
      requerimientos: { ...defaultVerif },
      incumplimiento: { ...defaultVerif },
      ajusteCronograma: { ...defaultVerif },
      suspensionProrroga: { ...defaultVerif },
      riesgos: { ...defaultVerif },
    },
    controlPrincipios: {
      cumplimientoObligaciones: { ...defaultVerif },
      correspondenciaActividades: { ...defaultVerif },
      soportesSuficientes: { ...defaultVerif },
      observanciaPrincipios: { ...defaultVerif },
      situacionesRequerimiento: { ...defaultVerif },
    },
    analisisPago: {
      relacionObligaciones: { verificacion: 'SI', observaciones: '' },
      productosRevisados: { verificacion: 'SI', observaciones: '' },
      soportesSuficientes: { verificacion: 'SI', observaciones: '' },
      seguridadSocialVerificada: { verificacion: 'SI', observaciones: '' },
      procedeReconocimiento: { verificacion: 'SI', observaciones: '' },
    },
    conceptoGeneral: 'Satisfactorio',
    conclusionSeguimiento:
      'Una vez revisadas las obligaciones contractuales, las actividades ejecutadas, los productos entregados y los soportes documentales, se deja constancia de que la ejecución del contrato durante el periodo comprendido entre el 24 de julio y el 22 de agosto de 2026 fue SATISFACTORIA y procede el trámite del pago correspondiente. No se presentaron observaciones adicionales ni novedades que afectaran la ejecución contractual.',
    cumplimientoObjeto:
      'Se cumplió satisfactoriamente el objeto contractual durante el periodo informado.',
    recursosUtilizados:
      'Los recursos suministrados por la Alcaldía de Quimbaya.',
    evidenciasEjecucion:
      'Informe de actividades, productos y evidencias publicadas en la plataforma SECOP II.',
    historialActasConcepto: [
      {
        nroActa: 1,
        valorTotal: 13785393.30,
        valorEjecutado: 4595131,
        saldo: 9190262.30,
      },
      {
        nroActa: 2,
        valorTotal: 13785393.30,
        valorEjecutado: 9190262,
        saldo: 4595131.30,
      },
    ],
    aportesSeguridadSocial: [
      {
        comprobanteNo: '6018142066',
        entidad: 'SOI',
        planillaNo: '9845217430',
        valorAporte: 10769300,
        periodoCotizacion: 'Mayo',
        salud: { entidad: 'Nueva EPS', valor: 1732200 },
        pension: { entidad: 'Colfondos', valor: 7078400 },
        riesgosLaborales: { entidad: 'Positiva Compañía de Seguros S.A.', valor: 226500 },
        cajaCompensacion: { entidad: 'Comfenalco', valor: 1732200 },
      },
      {
        comprobanteNo: '6025389247',
        entidad: 'SOI',
        planillaNo: '9845217431',
        valorAporte: 11117300,
        periodoCotizacion: 'Junio',
        salud: { entidad: 'Nueva EPS', valor: 1789000 },
        pension: { entidad: 'Colfondos', valor: 7305500 },
        riesgosLaborales: { entidad: 'Positiva Compañía de Seguros S.A.', valor: 233900 },
        cajaCompensacion: { entidad: 'Comfenalco', valor: 1788900 },
      },
      {
        comprobanteNo: '6028786409',
        entidad: 'SOI',
        planillaNo: '9845217432',
        valorAporte: 11099600,
        periodoCotizacion: 'Julio',
        salud: { entidad: 'Nueva EPS', valor: 1786200 },
        pension: { entidad: 'Colfondos', valor: 7294400 },
        riesgosLaborales: { entidad: 'Positiva Compañía de Seguros S.A.', valor: 233500 },
        cajaCompensacion: { entidad: 'Comfenalco', valor: 1786200 },
      },
      {
        comprobanteNo: '6033573006',
        entidad: 'SOI',
        planillaNo: '9845217433',
        valorAporte: 10815400,
        periodoCotizacion: 'Agosto',
        salud: { entidad: 'Nueva EPS', valor: 1740900 },
        pension: { entidad: 'Colfondos', valor: 7112900 },
        riesgosLaborales: { entidad: 'Positiva Compañía de Seguros S.A.', valor: 220900 },
        cajaCompensacion: { entidad: 'Comfenalco', valor: 1740800 },
      },
    ],
    createdAt: '2026-09-28T10:00:00Z',
    updatedAt: '2026-10-04T09:00:00Z',
  };

  const seguridadSocial: SocialSecurityRecord = {
    id: 'ss-001',
    contratistaId: contratista.id,
    contratistaNombre: contrato.contratistaNombre,
    contratoId: contrato.id,
    periodo: 'Mayo - Agosto 2026',
    numeroPlanilla: '9845217430',
    operadorPila: 'SOI',
    valorPagado: 10769300,
    fechaPago: '2026-08-20',
    saludEntidad: 'Nueva EPS',
    saludValor: 1732200,
    pensionEntidad: 'Colfondos',
    pensionValor: 7078400,
    arlEntidad: 'Positiva Compañía de Seguros S.A.',
    arlValor: 226500,
    cajaEntidad: 'Comfenalco',
    cajaValor: 1732200,
    soporteNombre: 'Planilla_PILA_Periodo2_2026.pdf',
    estado: 'Al día',
    observaciones: 'Aportes integrales validados en el operador SOI.',
    createdAt: '2026-08-20T09:15:00Z',
  };

  const pago: PaymentRecord = {
    id: 'pay-002',
    contratoId: contrato.id,
    numeroContrato: contrato.numeroContrato,
    contratistaId: contratista.id,
    contratistaNombre: contrato.contratistaNombre,
    periodo: '25/04/2026 - 24/08/2026',
    valor: 4595131,
    informeId: informe.id,
    estado: 'Pendiente certificación',
    fechaCertificacion: '',
    referenciaPago: 'ACTA-SUP-02-2026',
    createdAt: '2026-10-02T14:30:00Z',
  };

  const initialAudit: AuditLog = {
    id: 'audit-001',
    usuarioId: admin.id,
    usuarioNombre: `${admin.nombres} ${admin.apellidos}`,
    usuarioRol: 'admin',
    accion: 'INICIALIZACION_SISTEMA',
    modulo: 'sistema',
    detalles: 'Inicialización de la plataforma institucional de Gestión de Contratistas.',
    fecha: new Date().toISOString(),
  };

  return {
    users: [admin, supervisor, contratista],
    contracts: [contrato],
    reports: [informe],
    socialSecurity: [seguridadSocial],
    payments: [pago],
    auditLogs: [initialAudit],
    evidenceFiles: [],
    radicacionCounter: 100,
  };
}

function normalizeDoc(doc: string): string {
  return String(doc || '')
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, '');
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      if (!fs.existsSync(ACTAS_DIR)) {
        fs.mkdirSync(ACTAS_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        const initial = getInitialData();
        const tmpFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(initial, null, 2), 'utf-8');
        fs.renameSync(tmpFile, DB_FILE);
        return initial;
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      let mutated = false;

      // Never wipe existing database arrays; only ensure missing collections are initialized safely
      if (!Array.isArray(parsed.users)) {
        parsed.users = [];
        mutated = true;
      }
      if (!Array.isArray(parsed.contracts)) {
        parsed.contracts = [];
        mutated = true;
      }
      if (!Array.isArray(parsed.reports)) {
        parsed.reports = [];
        mutated = true;
      }
      if (!Array.isArray(parsed.socialSecurity)) {
        parsed.socialSecurity = [];
        mutated = true;
      }
      if (!Array.isArray(parsed.payments)) {
        parsed.payments = [];
        mutated = true;
      }

      // Ensure evidenceFiles exists
      if (!Array.isArray(parsed.evidenceFiles)) {
        parsed.evidenceFiles = [];
        mutated = true;
      }

      // Ensure radicacionCounter exists
      if (typeof parsed.radicacionCounter !== 'number') {
        parsed.radicacionCounter = 100;
        mutated = true;
      }

      // Ensure auditLogs exists
      if (!Array.isArray(parsed.auditLogs)) {
        parsed.auditLogs = [];
        mutated = true;
      }

      // Ensure at least one admin exists without touching other users
      if (!parsed.users.some((u: any) => u.rol === 'admin')) {
        const adminPass = hashPassword('Admin2025!*');
        const adminUser: User = {
          id: 'user-admin-01',
          tipoDocumento: 'CC',
          numeroDocumento: '10000001',
          nombres: 'Administrador',
          apellidos: 'General del Sistema',
          email: 'admin@quimbaya.gov.co',
          telefono: '3100000000',
          profesion: 'Oficina de Control Interno y Sistemas',
          rol: 'admin',
          passwordHash: adminPass.hash,
          salt: adminPass.salt,
          direccion: 'Palacio Municipal de Quimbaya, Quindío',
          estado: 'activo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        parsed.users.unshift(adminUser);
        mutated = true;
      }

      if (mutated) {
        const tmpFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(parsed, null, 2), 'utf-8');
        fs.renameSync(tmpFile, DB_FILE);
      }

      return parsed;
    } catch (e) {
      console.error('Error loading database file, initializing fallback:', e);
      return getInitialData();
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (e) {
      console.error('Error saving database:', e);
    }
  }

  // Users
  getUsers(): User[] {
    return this.data.users;
  }

  getSupervisors(): User[] {
    return this.data.users.filter((u) => u.rol === 'supervisor');
  }

  getContractors(): User[] {
    return this.data.users.filter((u) => u.rol === 'contratista');
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  findUserByDocument(numeroDocumento: string): User | undefined {
    const cleanDoc = normalizeDoc(numeroDocumento);
    if (!cleanDoc) return undefined;
    return this.data.users.find((u) => normalizeDoc(u.numeroDocumento) === cleanDoc);
  }

  getUserByIdentificationOrEmail(identifier: string): User | undefined {
    const clean = identifier.trim().toLowerCase();
    const cleanDoc = normalizeDoc(identifier);
    return this.data.users.find(
      (u) =>
        u.email.trim().toLowerCase() === clean ||
        u.numeroDocumento.trim().toLowerCase() === clean ||
        (cleanDoc.length > 0 && normalizeDoc(u.numeroDocumento) === cleanDoc)
    );
  }

  addUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.users[idx];
  }

  deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // Audit Logs
  getAuditLogs(): AuditLog[] {
    return this.data.auditLogs || [];
  }

  addAuditLog(entry: {
    usuarioId: string;
    usuarioNombre: string;
    usuarioRol: 'admin' | 'supervisor' | 'contratista';
    accion: string;
    modulo: string;
    detalles: string;
    ip?: string;
  }): AuditLog {
    if (!this.data.auditLogs) {
      this.data.auditLogs = [];
    }
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...entry,
      fecha: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    // Limit to 2000 entries
    if (this.data.auditLogs.length > 2000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 2000);
    }
    this.save();
    return log;
  }

  // Contracts
  getContracts(): Contract[] {
    return this.data.contracts;
  }

  getContractsByContractor(contractorId: string): Contract[] {
    return this.data.contracts.filter((c) => c.contratistaId === contractorId);
  }

  getContractById(id: string): Contract | undefined {
    return this.data.contracts.find((c) => c.id === id);
  }

  addContract(contract: Contract): Contract {
    this.data.contracts.push(contract);
    this.save();
    return contract;
  }

  updateContract(id: string, updates: Partial<Contract>): Contract | null {
    const idx = this.data.contracts.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.data.contracts[idx] = {
      ...this.data.contracts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.contracts[idx];
  }

  // Reports
  getReports(): ActivityReport[] {
    return this.data.reports;
  }

  getReportsByContractor(contractorId: string): ActivityReport[] {
    return this.data.reports.filter((r) => r.contratistaId === contractorId);
  }

  getReportById(id: string): ActivityReport | undefined {
    return this.data.reports.find((r) => r.id === id);
  }

  addReport(report: ActivityReport): ActivityReport {
    this.data.reports.push(report);
    this.save();
    return report;
  }

  updateReport(id: string, updates: Partial<ActivityReport>): ActivityReport | null {
    const idx = this.data.reports.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.reports[idx] = {
      ...this.data.reports[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.reports[idx];
  }

  // Social Security
  getSocialSecurity(): SocialSecurityRecord[] {
    return this.data.socialSecurity;
  }

  getSocialSecurityByContractor(contractorId: string): SocialSecurityRecord[] {
    return this.data.socialSecurity.filter((s) => s.contratistaId === contractorId);
  }

  addSocialSecurity(record: SocialSecurityRecord): SocialSecurityRecord {
    this.data.socialSecurity.push(record);
    this.save();
    return record;
  }

  // Payments
  getPayments(): PaymentRecord[] {
    return this.data.payments;
  }

  getPaymentsByContractor(contractorId: string): PaymentRecord[] {
    return this.data.payments.filter((p) => p.contratistaId === contractorId);
  }

  addPayment(record: PaymentRecord): PaymentRecord {
    this.data.payments.push(record);
    this.save();
    return record;
  }

  updatePayment(id: string, updates: Partial<PaymentRecord>): PaymentRecord | null {
    const idx = this.data.payments.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.payments[idx] = {
      ...this.data.payments[idx],
      ...updates,
    };
    this.save();
    return this.data.payments[idx];
  }

  // Evidence Files (Photos, Documents, Social Security Planillas)
  getEvidenceFiles(): StoredEvidenceFile[] {
    return this.data.evidenceFiles || [];
  }

  getEvidenceFileById(id: string): StoredEvidenceFile | undefined {
    return (this.data.evidenceFiles || []).find((f) => f.id === id);
  }

  getEvidenceFilesByContractor(contractorId: string): StoredEvidenceFile[] {
    return (this.data.evidenceFiles || []).filter((f) => f.contratistaId === contractorId);
  }

  addEvidenceFile(file: StoredEvidenceFile): StoredEvidenceFile {
    if (!this.data.evidenceFiles) {
      this.data.evidenceFiles = [];
    }
    this.data.evidenceFiles.push(file);
    this.save();
    return file;
  }

  deleteEvidenceFile(id: string): boolean {
    if (!this.data.evidenceFiles) return false;
    const idx = this.data.evidenceFiles.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    const [removed] = this.data.evidenceFiles.splice(idx, 1);
    if (removed && removed.filePath && fs.existsSync(removed.filePath)) {
      try {
        fs.unlinkSync(removed.filePath);
      } catch (err) {
        console.warn('Error removing evidence file from disk:', err);
      }
    }
    this.save();
    return true;
  }

  // Institutional sequential radicación rule
  getNextRadicacionNumber(contractNumero?: string): string {
    const currentYear = new Date().getFullYear();
    this.data.radicacionCounter = (this.data.radicacionCounter || 100) + 1;
    this.save();
    return `RAD-${currentYear}-${String(this.data.radicacionCounter).padStart(5, '0')}`;
  }
}

export const db = new Database();
