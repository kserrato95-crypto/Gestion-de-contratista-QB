import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../lib/api.js';
import {
  Building2,
  Lock,
  User,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal.js';

export const AuthPage: React.FC = () => {
  const { login } = useAuth();

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery modal state
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Por favor ingrese su número de documento o correo, y su contraseña.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(loginIdentifier.trim(), loginPassword);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryIdentifier.trim()) {
      setRecoveryMsg({ type: 'error', text: 'Por favor ingrese su número de documento o correo.' });
      return;
    }

    try {
      setRecoverySubmitting(true);
      setRecoveryMsg(null);
      const res = await apiRequest<{ message: string }>('/api/auth/recover-password', {
        method: 'POST',
        data: { identifier: recoveryIdentifier.trim() },
      });
      setRecoveryMsg({ type: 'success', text: res.message });
      setRecoveryIdentifier('');
    } catch (err: any) {
      setRecoveryMsg({ type: 'error', text: err.message || 'Error al enviar la solicitud.' });
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      {/* Colombian institutional header accent */}
      <div className="fixed top-0 left-0 right-0 h-1.5 flex">
        <div className="h-full w-1/2 bg-yellow-400"></div>
        <div className="h-full w-1/4 bg-blue-700"></div>
        <div className="h-full w-1/4 bg-red-600"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Institutional seal emblem */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-900 text-amber-300 shadow-md mb-3 border border-blue-800">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Gestión de Contratistas
        </h1>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mt-0.5">
          Alcaldía Municipal de Quimbaya • Quindío
        </p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
          Plataforma oficial de seguimiento contractual, actas de supervisión e interventoría de servicios públicos.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-sm rounded-xl border border-slate-200">
          <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-900" />
              Iniciar Sesión
            </h2>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Acceso Seguro
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Usuario o Número de Identificación *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="identifier"
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Número de cédula, NIT o correo institucional"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Contraseña *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryModalOpen(true);
                    setRecoveryMsg(null);
                  }}
                  className="text-[11px] text-blue-800 hover:text-blue-950 font-semibold hover:underline"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="password"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Ingrese su contraseña institucional"
                  className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando credenciales...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Security note: No public self-registration */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">Aviso institucional:</span> Por motivos de seguridad y control interno, no existe registro público. Todos los perfiles de usuario son creados y autorizados por la administración o su supervisor designado.
            </p>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {recoveryModalOpen && (
        <Modal
          isOpen={recoveryModalOpen}
          onClose={() => setRecoveryModalOpen(false)}
          title="Restablecimiento Seguro de Contraseña"
          subtitle="Procedimiento oficial de asistencia técnica y seguridad institucional"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs sm:text-sm">
            {recoveryMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  recoveryMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {recoveryMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{recoveryMsg.text}</span>
              </div>
            )}

            <p className="text-slate-600 leading-relaxed text-xs">
              De acuerdo con la política de seguridad de la entidad pública, las contraseñas no se envían sin verificación. Ingrese su número de identificación o correo institucional para registrar la solicitud en la bitácora de auditoría. El Administrador o su Supervisor validará su identidad y emitirá una clave temporal.
            </p>

            <form onSubmit={handleRecoverPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Documento o Correo Registrado *
                </label>
                <input
                  type="text"
                  required
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  placeholder="Ej: 18470223 o correo institucional"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRecoveryModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={recoverySubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {recoverySubmitting ? 'Enviando...' : 'Radicar Solicitud de Restablecimiento'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-[11px] text-slate-500">
        <p>Alcaldía Municipal de Quimbaya • NIT 890.000.613-4 • República de Colombia</p>
        <p className="mt-0.5">Control de Supervisión Contractual e Interventoría</p>
      </footer>
    </div>
  );
};
