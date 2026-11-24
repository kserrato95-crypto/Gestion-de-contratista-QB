import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ActivityReport, Contract } from '../types/index.js';
import { formatDateDMY } from './api.js';
import {
  calculateTotalDays,
  calculateDetailedDuration,
  getContractPeriods,
  parseYMD,
} from '../utils/contractDuration.js';

// The Google Workspace scopes configured for this application
export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Initialize Firebase App and Auth once
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory token caching (MANDATORY: NEVER stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso para Google Sheets.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface ExportSheetsResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  rowCount: number;
}

/**
 * Creates or updates a Google Spreadsheet with official contract supervision actas and 30-day tracking periods,
 * strictly including all 12 required fields, with complete deduplication.
 */
export async function exportActasToGoogleSheets(
  reports: ActivityReport[],
  contracts: Contract[],
  spreadsheetTitle?: string,
  existingSpreadsheetId?: string
): Promise<ExportSheetsResult> {
  let token = await getAccessToken();

  if (!token) {
    const loginResult = await googleSignIn();
    if (!loginResult) {
      throw new Error('Debe iniciar sesión con Google para sincronizar con Google Sheets.');
    }
    token = loginResult.accessToken;
  }

  let spreadsheetId = existingSpreadsheetId;
  const title =
    spreadsheetTitle ||
    `Gestión de Contratistas - Seguimiento y Actas (${new Date().toLocaleDateString('es-CO')})`;

  // 1. Create Spreadsheet if not already provided
  if (!spreadsheetId) {
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
        sheets: [
          {
            properties: {
              title: 'Seguimiento de Actas y Períodos',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createResponse.ok) {
      const errData = await createResponse.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'Error al crear la hoja de cálculo en Google Sheets.');
    }

    const spreadsheet = await createResponse.json();
    spreadsheetId = spreadsheet.spreadsheetId;
  }

  // 2. Official Headers (all 12 required fields and metadata)
  const headers = [
    'ID Contrato',
    'N.º Contrato',
    'Contratista',
    'Cédula Contratista',
    'Fecha Inicio Contrato',
    'Fecha Fin Contrato',
    'Duración Total (Días Calendario)',
    'Duración Informativa (Meses y Días)',
    'N.º Período / Acta',
    'Rango de Días Contractuales',
    'Fecha Inicio Período',
    'Fecha Fin Período',
    'Días del Período',
    '% Avance Tiempo Período',
    '% Avance Tiempo Acumulado',
    '% Avance Financiero Período',
    '% Avance Financiero Acumulado',
    'Valor Total Contrato (COP)',
    'Pagos Anteriores / Certificados (COP)',
    'Valor del Presente Pago (COP)',
    'Saldo Pendiente (COP)',
    'Estado de Presentación y Aprobación',
    'N.º Radicación Institucional',
    'Fecha Radicación',
    'Concepto de Supervisión',
    'N.º CDP',
    'Fecha CDP',
    'N.º CRP',
    'Fecha CRP',
  ];

  // 3. Build deduplicated rows using Contract ID + Period Number
  const contractMap = new Map(contracts.map((c) => [c.id, c]));
  const reportsByContractAndActa = new Map<string, ActivityReport>();

  reports.forEach((r) => {
    const key = `${r.contratoId}_${r.numeroActa || 1}`;
    // Keep most recent or approved report if duplicates exist
    const existing = reportsByContractAndActa.get(key);
    if (!existing || r.estado === 'Aprobado') {
      reportsByContractAndActa.set(key, r);
    }
  });

  const rowMap = new Map<string, (string | number)[]>();

  // For every contract, include all scheduled 30-day periods with actual report data if submitted
  for (const c of contracts) {
    const totalDias = calculateTotalDays(c.fechaInicio, c.fechaFin);
    const detailed = calculateDetailedDuration(c.fechaInicio, c.fechaFin);
    const periods = getContractPeriods(c.fechaInicio, c.fechaFin);

    for (const p of periods) {
      const key = `${c.id}_${p.numeroActa}`;
      const rep = reportsByContractAndActa.get(key);
      const fin = rep?.financiero;

      const pDays = p.diasPeriodo;
      const pctTiempo = fin?.porcentajeAvanceTiempoPeriodo ?? p.porcentajeAvanceTiempo;
      const pctTiempoAcum = fin?.porcentajeAvanceTiempoAcumulado ?? p.porcentajeAvanceTiempoAcumulado;

      const valorTotal = fin?.valorTotalFinal || Number(c.valorTotal) || 0;
      const valorPagado = fin?.valorPagadoALaFecha ?? 0;
      const valorPago = fin?.valorPresentePago ?? (pDays === 30 ? (c.honorariosMensuales || 0) : Math.round((pDays / 30) * (c.honorariosMensuales || 0) * 100) / 100);
      const saldo = fin?.saldoPorPagar ?? Math.max(0, valorTotal - (valorPagado + valorPago));

      const pctFinanciero = fin?.porcentajeAvanceFinancieroPeriodo ?? (valorTotal > 0 ? Math.round((valorPago / valorTotal) * 10000) / 100 : 0);
      const pctFinancieroAcum = fin?.porcentajeAvanceFinancieroAcumulado ?? (valorTotal > 0 ? Math.round(((valorPagado + valorPago) / valorTotal) * 10000) / 100 : 0);

      const estado = rep?.estado || 'Pendiente de radicación';

      rowMap.set(key, [
        c.id,
        c.numeroContrato,
        c.contratistaNombre,
        c.contratistaDocumento,
        c.fechaInicio,
        c.fechaFin,
        totalDias,
        c.duracionTexto || detailed.texto,
        `Acta ${p.numeroActa}`,
        `Días ${p.diaInicio} al ${p.diaFin}`,
        rep?.fechaInicioPeriodo || p.fechaInicioPeriodo,
        rep?.fechaFinPeriodo || p.fechaFinPeriodo,
        pDays,
        `${Number(pctTiempo).toFixed(2)}%`,
        `${Number(pctTiempoAcum).toFixed(2)}%`,
        `${Number(pctFinanciero).toFixed(2)}%`,
        `${Number(pctFinancieroAcum).toFixed(2)}%`,
        valorTotal,
        valorPagado,
        valorPago,
        saldo,
        estado,
        rep?.numeroRadicacion || 'Sin radicar',
        rep?.fechaRadicacion ? new Date(rep.fechaRadicacion).toLocaleString('es-CO') : '',
        rep?.conceptoGeneral || 'Satisfactorio',
        c.cdpNumero ? `'${c.cdpNumero}` : '',
        c.cdpFecha ? formatDateDMY(c.cdpFecha) : '',
        c.crpNumero ? `'${c.crpNumero}` : '',
        c.crpFecha ? formatDateDMY(c.crpFecha) : '',
      ]);
    }
  }

  // Also include any standalone reports that might not map to a contract period
  for (const r of reports) {
    const key = `${r.contratoId}_${r.numeroActa || 1}`;
    if (!rowMap.has(key)) {
      const c = contractMap.get(r.contratoId);
      const fin = r.financiero || ({} as any);
      const totalDias = calculateTotalDays(c?.fechaInicio, c?.fechaFin);
      const detailed = calculateDetailedDuration(c?.fechaInicio, c?.fechaFin);

      rowMap.set(key, [
        r.contratoId,
        r.numeroContrato || c?.numeroContrato || 'N/A',
        r.contratistaNombre || c?.contratistaNombre || 'N/A',
        c?.contratistaDocumento || 'N/A',
        c?.fechaInicio || '',
        c?.fechaFin || '',
        totalDias,
        c?.duracionTexto || detailed.texto,
        `Acta ${r.numeroActa || 1}`,
        r.periodo || '',
        r.fechaInicioPeriodo || '',
        r.fechaFinPeriodo || '',
        30,
        `${Number(fin.porcentajeAvanceTiempoPeriodo || 0).toFixed(2)}%`,
        `${Number(fin.porcentajeAvanceTiempoAcumulado || 0).toFixed(2)}%`,
        `${Number(fin.porcentajeAvanceFinancieroPeriodo || 0).toFixed(2)}%`,
        `${Number(fin.porcentajeAvanceFinancieroAcumulado || 0).toFixed(2)}%`,
        fin.valorTotalFinal || c?.valorTotal || 0,
        fin.valorPagadoALaFecha || 0,
        fin.valorPresentePago || c?.honorariosMensuales || 0,
        fin.saldoPorPagar || 0,
        r.estado || 'Borrador',
        r.numeroRadicacion || 'Sin radicar',
        r.fechaRadicacion ? new Date(r.fechaRadicacion).toLocaleString('es-CO') : '',
        r.conceptoGeneral || 'Satisfactorio',
        c?.cdpNumero ? `'${c.cdpNumero}` : '',
        c?.cdpFecha ? formatDateDMY(c.cdpFecha) : '',
        c?.crpNumero ? `'${c.crpNumero}` : '',
        c?.crpFecha ? formatDateDMY(c.crpFecha) : '',
      ]);
    }
  }

  const rows = Array.from(rowMap.values());
  const values = [headers, ...rows];

  // 4. Clear and write values to avoid stale duplicate rows
  const sheetName = 'Seguimiento de Actas y Períodos';
  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:AC${values.length + 50}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  ).catch(() => null);

  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:AC${values.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${sheetName}!A1:AC${values.length}`,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!writeResponse.ok) {
    const errData = await writeResponse.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Error al escribir los registros en Google Sheets.');
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    spreadsheetId: spreadsheetId!,
    spreadsheetUrl,
    title,
    rowCount: rows.length,
  };
}
