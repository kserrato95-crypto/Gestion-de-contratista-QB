import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../lib/api.js';
import { Settings, Shield, Building2, Lock, CheckCircle, AlertCircle } from 'lucide-react';

export const SupervisorConfiguracion: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.length < 8) {
      setFeedback({ type: 'error', text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Las nuevas contraseñas no coinciden.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        data: { currentPassword, newPassword },
      });
      setFeedback({ type: 'success', text: res.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al cambiar contraseña.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-900" />
          Configuración Institucional del Sistema
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Parámetros de la entidad pública, perfil de supervisión y seguridad de acceso.
        </p>
      </div>

      {/* Entity Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-900" />
          Información de la Entidad Pública
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Entidad Contratante:</span>
            <span className="font-semibold text-slate-900">Alcaldía Mayor / Entidad Nacional</span>
          </div>
          <div>
            <span className="text-slate-500 block">NIT Institucional:</span>
            <span className="font-semibold text-slate-900 font-mono">899.999.061-9</span>
          </div>
          <div>
            <span className="text-slate-500 block">Régimen de Contratación:</span>
            <span className="font-semibold text-slate-900">Estatuto General de Contratación de la Administración Pública (Ley 80/1993, Ley 1150/2007)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Modalidad Principal:</span>
            <span className="font-semibold text-slate-900">Contratos de Prestación de Servicios Profesionales y de Apoyo a la Gestión</span>
          </div>
        </div>
      </div>

      {/* Supervisor profile */}
      {user && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-900" />
            Perfil del Supervisor Activo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Nombres y Apellidos:</span>
              <span className="font-semibold text-slate-900">{user.nombres} {user.apellidos}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Identificación:</span>
              <span className="font-semibold text-slate-900 font-mono">{user.tipoDocumento} {user.numeroDocumento}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Correo Institucional:</span>
              <span className="font-semibold text-slate-900">{user.email}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Cargo / Especialidad:</span>
              <span className="font-semibold text-slate-900">{user.profesion || 'Supervisora de Contratación'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Rol en Plataforma:</span>
              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-900">
                Supervisor Administrativo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Password change */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-900" />
          Seguridad y Cambio de Contraseña
        </h3>

        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-3 max-w-md text-xs sm:text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contraseña Actual *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nueva Contraseña * (Mínimo 8 caracteres)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirmar Nueva Contraseña *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};
