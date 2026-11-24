import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.js';
import {
  exportActasToGoogleSheets,
  googleSignIn,
  googleLogout,
  getAccessToken,
  initAuth,
  ExportSheetsResult,
} from '../../lib/googleSheets.js';
import { ActivityReport, Contract } from '../../types/index.js';
import { FileSpreadsheet, CheckCircle, ExternalLink, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: ActivityReport[];
  contracts: Contract[];
  defaultTitle?: string;
}

export const GoogleSheetsExportModal: React.FC<GoogleSheetsExportModalProps> = ({
  isOpen,
  onClose,
  reports,
  contracts,
  defaultTitle,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportSheetsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetTitle, setSheetTitle] = useState(defaultTitle || '');

  useEffect(() => {
    if (defaultTitle && !sheetTitle) {
      setSheetTitle(defaultTitle);
    }
  }, [defaultTitle]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, tok) => {
        setFirebaseUser(user);
        setToken(tok);
      },
      () => {
        setFirebaseUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setFirebaseUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión con Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const exportRes = await exportActasToGoogleSheets(
        reports,
        contracts,
        sheetTitle.trim() || undefined
      );
      setResult(exportRes);
    } catch (err: any) {
      console.error('Error exporting to Google Sheets:', err);
      setError(err?.message || 'Error al sincronizar con Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSignOut = async () => {
    await googleLogout();
    setFirebaseUser(null);
    setToken(null);
    setResult(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronización con Google Sheets"
      subtitle="Guarde y consulte las actas de supervisión y valores contractuales en hojas de cálculo de Google"
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs sm:text-sm">
        {error && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Aviso:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {result ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                ¡Hoja de cálculo creada y sincronizada exitosamente!
              </h3>
              <p className="text-xs text-emerald-800 mt-1">
                Se guardaron {result.rowCount} actas con sus respectivos porcentajes de avance en tiempo, financiero y valores económicos actualizados.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={result.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en Google Sheets
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account connection status */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Cuenta de Google:</span>
                  <span className="text-[11px] text-slate-500">
                    {firebaseUser ? firebaseUser.email : 'No conectado'}
                  </span>
                </div>
              </div>

              {firebaseUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-2.5 py-1 text-[11px] text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 rounded flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  Cambiar cuenta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded-lg shadow-2xs text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>Conectar Google</span>
                </button>
              )}
            </div>

            {/* Details to export */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5 text-xs text-blue-950">
              <span className="font-bold block">Resumen de sincronización:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-blue-900">
                <li>Total de actas a exportar: <strong>{reports.length}</strong></li>
                <li>Incluye columnas con: Porcentajes de avance en tiempo del periodo y acumulado</li>
                <li>Incluye avances financieros, saldos por pagar, saldos por ejecutar y valores totales</li>
                <li>Estructura formateada y congelada para auditoría institucional</li>
              </ul>
            </div>

            {/* Title field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la hoja de cálculo en Google Drive:
              </label>
              <input
                type="text"
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
                placeholder="Ej. Gestión Contratistas - Actas de Supervisión 2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>

          {!result && (
            <button
              type="button"
              disabled={isExporting || isLoggingIn || reports.length === 0}
              onClick={handleExport}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exportando a Google Sheets...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Confirmar y Guardar en Google Sheets
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
