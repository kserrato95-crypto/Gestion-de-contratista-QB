import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate } from '../../lib/api.js';
import { User } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import {
  UserCheck,
  Search,
  Plus,
  Edit2,
  KeyRound,
  ShieldAlert,
  Power,
  Phone,
  Mail,
  Building,
  CheckCircle,
  AlertCircle,
  Briefcase,
} from 'lucide-react';

export const AdminSupervisores: React.FC = () => {
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tipoDoc, setTipoDoc] = useState('CC');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [profesion, setProfesion] = useState('');
  const [direccion, setDireccion] = useState('Palacio Municipal de Quimbaya, Quindío');
  const [password, setPassword] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal state
  const [editingSup, setEditingSup] = useState<User | null>(null);
  const [editNombres, setEditNombres] = useState('');
  const [editApellidos, setEditApellidos] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editProfesion, setEditProfesion] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Password Modal state
  const [resetSup, setResetSup] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Success message banner
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  const loadSupervisors = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ supervisors: User[] }>('/api/admin/supervisors');
      setSupervisors(res.supervisors);
    } catch (err) {
      console.error('Error loading supervisors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupervisors();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!numeroDoc.trim() || !nombres.trim() || !apellidos.trim() || !email.trim() || !password) {
      setCreateError('Todos los campos marcados con (*) son obligatorios.');
      return;
    }

    if (password.length < 8) {
      setCreateError('La contraseña inicial debe tener mínimo 8 caracteres.');
      return;
    }

    try {
      setCreateSubmitting(true);
      const res = await apiRequest<{ message: string; supervisor: User }>('/api/admin/supervisors', {
        method: 'POST',
        data: {
          tipoDocumento: tipoDoc,
          numeroDocumento: numeroDoc.trim(),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim(),
          profesion: profesion.trim(),
          direccion: direccion.trim(),
          password,
        },
      });

      setSupervisors((prev) => [res.supervisor, ...prev]);
      setIsCreateOpen(false);
      setGlobalSuccess(res.message);
      // Reset form
      setNumeroDoc('');
      setNombres('');
      setApellidos('');
      setEmail('');
      setTelefono('');
      setProfesion('');
      setPassword('');
    } catch (err: any) {
      setCreateError(err.message || 'Error al registrar el supervisor.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEdit = (sup: User) => {
    setEditingSup(sup);
    setEditNombres(sup.nombres);
    setEditApellidos(sup.apellidos);
    setEditEmail(sup.email);
    setEditTelefono(sup.telefono || '');
    setEditProfesion(sup.profesion || '');
    setEditDireccion(sup.direccion || '');
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSup) return;
    setEditError(null);

    try {
      setEditSubmitting(true);
      const res = await apiRequest<{ message: string; supervisor: User }>(
        `/api/admin/supervisors/${editingSup.id}`,
        {
          method: 'PUT',
          data: {
            nombres: editNombres.trim(),
            apellidos: editApellidos.trim(),
            email: editEmail.trim().toLowerCase(),
            telefono: editTelefono.trim(),
            profesion: editProfesion.trim(),
            direccion: editDireccion.trim(),
          },
        }
      );

      setSupervisors((prev) =>
        prev.map((s) => (s.id === editingSup.id ? { ...s, ...res.supervisor } : s))
      );
      setEditingSup(null);
      setGlobalSuccess(res.message);
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar el perfil.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleStatus = async (sup: User) => {
    const nextStatus = sup.estado === 'activo' ? 'inactivo' : 'activo';
    const confirmMsg =
      nextStatus === 'inactivo'
        ? `¿Seguro que desea inactivar al supervisor ${sup.nombres} ${sup.apellidos}? No podrá iniciar sesión ni suscribir actas.`
        : `¿Desea activar nuevamente al supervisor ${sup.nombres} ${sup.apellidos}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await apiRequest<{ message: string; supervisor: User }>(
        `/api/admin/supervisors/${sup.id}/status`,
        {
          method: 'PATCH',
          data: { estado: nextStatus },
        }
      );

      setSupervisors((prev) =>
        prev.map((s) => (s.id === sup.id ? { ...s, estado: nextStatus } : s))
      );
      setGlobalSuccess(res.message);
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetSup) return;
    setResetMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setResetMsg({
        type: 'error',
        text: 'La nueva contraseña debe tener mínimo 8 caracteres.',
      });
      return;
    }

    try {
      setResetSubmitting(true);
      const res = await apiRequest<{ message: string }>(
        `/api/admin/users/${resetSup.id}/reset-password`,
        {
          method: 'POST',
          data: { newPassword },
        }
      );
      setResetMsg({ type: 'success', text: res.message });
      setNewPassword('');
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Error al restablecer la contraseña.' });
    } finally {
      setResetSubmitting(false);
    }
  };

  const filtered = supervisors.filter((s) => {
    const q = search.toLowerCase();
    const fullName = `${s.nombres} ${s.apellidos}`.toLowerCase();
    return (
      fullName.includes(q) ||
      s.numeroDocumento.includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.profesion && s.profesion.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-900" />
            Administración de Supervisores Institucionales
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Registro, activación, asignación y auditoría de credenciales para servidores públicos supervisores.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-900 text-white rounded-lg text-xs font-semibold hover:bg-purple-800 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          Registrar Nuevo Supervisor
        </button>
      </div>

      {/* Global Success Notification */}
      {globalSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{globalSuccess}</span>
          </div>
          <button
            onClick={() => setGlobalSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cédula, nombre, cargo institucional o correo..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-purple-600 outline-hidden bg-slate-50/50"
          />
        </div>

        <div className="text-xs font-semibold text-slate-600">
          Supervisores registrados: <span className="text-purple-900 font-bold">{supervisors.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Identificación</th>
                <th className="px-5 py-3.5">Supervisor</th>
                <th className="px-5 py-3.5">Cargo / Dependencia</th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5 text-center">Contratos</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    No se encontraron supervisores registrados con ese criterio.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-medium text-slate-900">
                      <span className="text-slate-500 text-xs mr-1">{s.tipoDocumento}</span>
                      {s.numeroDocumento}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">
                        {s.nombres} {s.apellidos}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{s.id}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 max-w-xs truncate">
                      {s.profesion || 'Servidor Público Asignado'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{s.email}</span>
                      </div>
                      {s.telefono && (
                        <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{s.telefono}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs bg-purple-50 text-purple-900 border border-purple-200">
                        {s.totalContratosSupervisados || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          s.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.estado.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Editar información"
                          className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setResetSup(s);
                            setNewPassword('');
                            setResetMsg(null);
                          }}
                          title="Restablecer contraseña"
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          title={s.estado === 'activo' ? 'Inactivar acceso' : 'Activar acceso'}
                          className={`p-1.5 rounded-md transition-colors ${
                            s.estado === 'activo'
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SUPERVISOR MODAL */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Crear Perfil de Supervisor Institucional"
          subtitle="Habilita el rol administrativo para gestionar contratistas y suscribir actas oficiales"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreate} className="space-y-4 text-xs sm:text-sm">
            {createError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo Documento *
                </label>
                <select
                  value={tipoDoc}
                  onChange={(e) => setTipoDoc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
                >
                  <option value="CC">Cédula de Ciudadanía (CC)</option>
                  <option value="CE">Cédula de Extranjería (CE)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Identificación *
                </label>
                <input
                  type="text"
                  required
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(e.target.value)}
                  placeholder="Ej: 18470223"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                <input
                  type="text"
                  required
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Ej: Carlos Alberto"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                <input
                  type="text"
                  required
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Ej: Correa Mejía"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo Institucional *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supervisor@quimbaya.gov.co"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 3175519367"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cargo Institucional / Dependencia *
              </label>
              <input
                type="text"
                required
                value={profesion}
                onChange={(e) => setProfesion(e.target.value)}
                placeholder="Ej: Subsecretario Tecnologías de las Comunicaciones y la Información"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Oficial de Despacho
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contraseña Inicial Asignada *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres seguros"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                El supervisor podrá ingresar inmediatamente con esta contraseña y su número de identificación.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-purple-900 hover:bg-purple-800 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                {createSubmitting ? 'Registrando...' : 'Crear y Habilitar Supervisor'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT SUPERVISOR MODAL */}
      {editingSup && (
        <Modal
          isOpen={Boolean(editingSup)}
          onClose={() => setEditingSup(null)}
          title={`Editar Supervisor: ${editingSup.nombres} ${editingSup.apellidos}`}
          subtitle={`C.C. ${editingSup.numeroDocumento}`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdate} className="space-y-4 text-xs sm:text-sm">
            {editError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres</label>
                <input
                  type="text"
                  required
                  value={editNombres}
                  onChange={(e) => setEditNombres(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos</label>
                <input
                  type="text"
                  required
                  value={editApellidos}
                  onChange={(e) => setEditApellidos(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Correo</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo / Dependencia</label>
              <input
                type="text"
                value={editProfesion}
                onChange={(e) => setEditProfesion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección</label>
              <input
                type="text"
                value={editDireccion}
                onChange={(e) => setEditDireccion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSup(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-900 hover:bg-purple-800 rounded-lg disabled:opacity-50"
              >
                {editSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetSup && (
        <Modal
          isOpen={Boolean(resetSup)}
          onClose={() => setResetSup(null)}
          title="Restablecer Contraseña Administrativamente"
          subtitle={`Supervisor: ${resetSup.nombres} ${resetSup.apellidos} • ${resetSup.numeroDocumento}`}
          maxWidth="md"
        >
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs sm:text-sm">
            {resetMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  resetMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {resetMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{resetMsg.text}</span>
              </div>
            )}

            <p className="text-slate-600 text-xs leading-relaxed">
              Como Administrador del sistema, puede asignar una nueva clave temporal para restablecer el acceso del supervisor. Esta acción quedará registrada en la bitácora de auditoría.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nueva Contraseña *
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetSup(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={resetSubmitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs disabled:opacity-50"
              >
                {resetSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
