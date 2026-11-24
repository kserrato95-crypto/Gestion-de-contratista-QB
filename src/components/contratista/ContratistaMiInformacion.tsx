import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { UserCheck, Building, CreditCard, Shield, CheckCircle, AlertCircle, Save } from 'lucide-react';

export const ContratistaMiInformacion: React.FC = () => {
  const { user, updateProfile } = useAuth();

  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [profesion, setProfesion] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [eps, setEps] = useState('');
  const [afp, setAfp] = useState('');
  const [arl, setArl] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setTelefono(user.telefono || '');
      setDireccion(user.direccion || '');
      setProfesion(user.profesion || '');
      setBanco(user.banco || '');
      setTipoCuenta(user.tipoCuenta || 'Ahorros');
      setNumeroCuenta(user.numeroCuenta || '');
      setEps(user.eps || '');
      setAfp(user.afp || '');
      setArl(user.arl || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    try {
      setSaving(true);
      await updateProfile({
        telefono,
        direccion,
        profesion,
        banco,
        tipoCuenta,
        numeroCuenta,
        eps,
        afp,
        arl,
      });
      setMsg({ type: 'success', text: 'Datos personales y bancarios actualizados correctamente.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error al actualizar información.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-900" />
          Mi Información Personal y Datos Autorizados
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Mantén actualizada tu información de contacto, cuentas bancarias para consignación de honorarios y afiliaciones de seguridad social.
        </p>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-start gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity (Read-only for security) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-900" />
            1. Datos de Identificación (No modificables por seguridad)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block mb-1">Tipo y Número de Documento:</span>
              <div className="px-3 py-2 bg-slate-100 rounded-lg font-mono font-bold text-slate-800 border border-slate-200">
                {user?.tipoDocumento} {user?.numeroDocumento}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Nombres y Apellidos:</span>
              <div className="px-3 py-2 bg-slate-100 rounded-lg font-semibold text-slate-800 border border-slate-200">
                {user?.nombres} {user?.apellidos}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Correo Electrónico Registrado:</span>
              <div className="px-3 py-2 bg-slate-100 rounded-lg font-medium text-slate-800 border border-slate-200 truncate">
                {user?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Contact and address (Editable) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-900" />
            2. Datos de Contacto y Correspondencia
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono / Celular *
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. 315 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección de Correspondencia *
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej. Carrera 15 # 85-30, Bogotá"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Profesión / Perfil Ocupacional
              </label>
              <input
                type="text"
                value={profesion}
                onChange={(e) => setProfesion(e.target.value)}
                placeholder="Ej. Contador Público, Ingeniero, Asesor..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Banking data (Editable) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-900" />
            3. Cuenta Bancaria para Pago de Honorarios
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Entidad Bancaria *
              </label>
              <input
                type="text"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ej. Bancolombia, Davivienda, Banco de Bogotá..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Cuenta *
              </label>
              <select
                value={tipoCuenta}
                onChange={(e) => setTipoCuenta(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden bg-white"
              >
                <option value="Ahorros">Cuenta de Ahorros</option>
                <option value="Corriente">Cuenta Corriente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Cuenta *
              </label>
              <input
                type="text"
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value)}
                placeholder="Ej. 12345678901"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 outline-hidden"
                required
              />
            </div>
          </div>
        </div>

        {/* Social Security affiliations (Editable) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-900" />
            4. Afiliaciones al Sistema de Seguridad Social Integral
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                EPS (Entidad Promotora de Salud)
              </label>
              <input
                type="text"
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                placeholder="Ej. Sanitas, Sura, Compensar, Nueva EPS..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fondo de Pensiones (AFP)
              </label>
              <input
                type="text"
                value={afp}
                onChange={(e) => setAfp(e.target.value)}
                placeholder="Ej. Porvenir, Protección, Colfondos, Colpensiones..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ARL (Riesgos Laborales)
              </label>
              <input
                type="text"
                value={arl}
                onChange={(e) => setArl(e.target.value)}
                placeholder="Ej. Positiva, Sura, Bolívar, Colpatria..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando cambios...' : 'Guardar Datos Actualizados'}
          </button>
        </div>
      </form>
    </div>
  );
};
