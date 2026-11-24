import React, { useState, useEffect } from 'react';
import { apiRequest, formatDate } from '../../lib/api.js';
import { User, Contract, ActivityReport, SocialSecurityRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import {
  Users,
  Search,
  Phone,
  Mail,
  Building,
  CreditCard,
  Briefcase,
  ExternalLink,
  Shield,
  FileText,
  Plus,
  KeyRound,
  Power,
  CheckCircle,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

export const SupervisorContratistas: React.FC = () => {
  const [contractors, setContractors] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected contractor for details
  const [selectedContractor, setSelectedContractor] = useState<{
    contractor: User;
    contracts: Contract[];
    reports: ActivityReport[];
    socialSecurity: SocialSecurityRecord[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create Contractor Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tipoDoc, setTipoDoc] = useState('CC');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [profesion, setProfesion] = useState('');
  const [direccion, setDireccion] = useState('Quimbaya, Quindío');
  const [password, setPassword] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset Password Modal state
  const [resetContractor, setResetContractor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Global success alert
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  const loadContractors = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ contractors: User[] }>('/api/contractors');
      setContractors(res.contractors);
    } catch (err) {
      console.error('Error loading contractors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContractors();
  }, []);

  const handleOpenDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await apiRequest<{
        contractor: User;
        contracts: Contract[];
        reports: ActivityReport[];
        socialSecurity: SocialSecurityRecord[];
      }>(`/api/contractors/${id}`);
      setSelectedContractor(res);
    } catch (err) {
      console.error('Error fetching contractor detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

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
      const res = await apiRequest<{ message: string; contractor: User }>('/api/contractors', {
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

      setContractors((prev) => [res.contractor, ...prev]);
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
      setCreateError(err.message || 'Error al registrar el contratista.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggleStatus = async (contractor: User) => {
    const nextStatus = contractor.estado === 'activo' ? 'inactivo' : 'activo';
    const confirmMsg =
      nextStatus === 'inactivo'
        ? `¿Seguro que desea inactivar al contratista ${contractor.nombres} ${contractor.apellidos}? No podrá ingresar a radicar informes.`
        : `¿Desea activar nuevamente al contratista ${contractor.nombres} ${contractor.apellidos}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await apiRequest<{ message: string; contractor: User }>(
        `/api/contractors/${contractor.id}/status`,
        {
          method: 'PATCH',
          data: { estado: nextStatus },
        }
      );

      setContractors((prev) =>
        prev.map((c) => (c.id === contractor.id ? { ...c, estado: nextStatus } : c))
      );
      setGlobalSuccess(res.message);
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado del contratista.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetContractor) return;
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
        `/api/contractors/${resetContractor.id}/reset-password`,
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

  const filtered = contractors.filter((c) => {
    const q = search.toLowerCase();
    const fullName = `${c.nombres} ${c.apellidos}`.toLowerCase();
    return (
      fullName.includes(q) ||
      c.numeroDocumento.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.profesion && c.profesion.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-900" />
            Directorio Oficial de Contratistas
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Creación de perfiles, datos de contacto, contratos asignados e historial de cumplimiento.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          Registrar Nuevo Contratista
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

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cédula de ciudadanía, NIT, nombres o perfil..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-50/50"
          />
        </div>

        <div className="text-xs font-semibold text-slate-600">
          Contratistas registrados: <span className="font-bold text-blue-900">{contractors.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Identificación</th>
                <th className="px-5 py-3.5">Contratista</th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5">Profesión / Perfil</th>
                <th className="px-5 py-3.5 text-center">Contratos</th>
                <th className="px-5 py-3.5 text-center">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    {search
                      ? 'No se encontraron contratistas que coincidan con la búsqueda.'
                      : 'No hay contratistas registrados en el sistema.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-medium text-slate-900">
                      <span className="text-slate-500 text-xs mr-1">{c.tipoDocumento}</span>
                      {c.numeroDocumento}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">
                        {c.nombres} {c.apellidos}
                      </div>
                      <div className="text-[11px] text-slate-500">{c.direccion || 'Sin dirección registrada'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[180px]">{c.email}</span>
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.telefono || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {c.profesion || <span className="text-slate-400 italic">No especificada</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                        {c.contratosActivos || 0} activo(s)
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          c.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.estado.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(c.id)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                        >
                          Expediente
                        </button>
                        <button
                          onClick={() => {
                            setResetContractor(c);
                            setNewPassword('');
                            setResetMsg(null);
                          }}
                          title="Restablecer clave"
                          className="p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(c)}
                          title={c.estado === 'activo' ? 'Inactivar acceso' : 'Activar acceso'}
                          className={`p-1 rounded-md transition-colors ${
                            c.estado === 'activo'
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

      {/* CREATE CONTRACTOR MODAL */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Crear Perfil de Contratista"
          subtitle="Registra los datos de la persona natural o jurídica para vincular sus contratos"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                >
                  <option value="CC">Cédula de Ciudadanía (CC)</option>
                  <option value="NIT">NIT / Persona Jurídica</option>
                  <option value="CE">Cédula de Extranjería (CE)</option>
                  <option value="PAS">Pasaporte (PAS)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Identificación o NIT *
                </label>
                <input
                  type="text"
                  required
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(e.target.value)}
                  placeholder="Ej: 1094900123 ó 900687199-1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombres o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Ej: Seven Soluciones"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Apellidos o Representante *
                </label>
                <input
                  type="text"
                  required
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Ej: Informáticas S.A.S"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contratista@empresa.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 3243018787"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profesión / Perfil Técnico
                </label>
                <input
                  type="text"
                  value={profesion}
                  onChange={(e) => setProfesion(e.target.value)}
                  placeholder="Ej: Soluciones Tecnológicas e Informáticas"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>
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
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                El contratista utilizará esta contraseña junto con su número de identificación para acceder al sistema.
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
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                {createSubmitting ? 'Registrando...' : 'Crear Perfil de Contratista'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetContractor && (
        <Modal
          isOpen={Boolean(resetContractor)}
          onClose={() => setResetContractor(null)}
          title="Restablecer Contraseña del Contratista"
          subtitle={`${resetContractor.nombres} ${resetContractor.apellidos} • ${resetContractor.tipoDocumento} ${resetContractor.numeroDocumento}`}
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
              Asigne una nueva clave temporal para que el contratista pueda ingresar y radicar sus informes. Esta operación quedará registrada en la bitácora de auditoría.
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetContractor(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={resetSubmitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs disabled:opacity-50"
              >
                {resetSubmitting ? 'Guardando...' : 'Restablecer Clave'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Contractor Details Modal */}
      {selectedContractor && (
        <Modal
          isOpen={Boolean(selectedContractor)}
          onClose={() => setSelectedContractor(null)}
          title={`Expediente: ${selectedContractor.contractor.nombres} ${selectedContractor.contractor.apellidos}`}
          subtitle={`${selectedContractor.contractor.tipoDocumento} ${selectedContractor.contractor.numeroDocumento} • Rol: Contratista`}
          maxWidth="3xl"
        >
          <div className="space-y-5 text-xs sm:text-sm">
            {/* Personal info grid */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-blue-900" />
                Datos Generales y Bancarios
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Identificación:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedContractor.contractor.tipoDocumento}{' '}
                    {selectedContractor.contractor.numeroDocumento}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Correo electrónico:</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {selectedContractor.contractor.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Teléfono:</span>
                  <span className="font-medium text-slate-800">
                    {selectedContractor.contractor.telefono || 'No registrado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Profesión / Perfil:</span>
                  <span className="font-medium text-slate-800">
                    {selectedContractor.contractor.profesion || 'No especificada'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cuenta Bancaria:</span>
                  <span className="font-medium text-slate-800">
                    {selectedContractor.contractor.banco
                      ? `${selectedContractor.contractor.banco} (${selectedContractor.contractor.tipoCuenta} No. ${selectedContractor.contractor.numeroCuenta})`
                      : 'Pendiente de registrar'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Seguridad Social:</span>
                  <span className="font-medium text-slate-800">
                    EPS: {selectedContractor.contractor.eps || '—'} • ARL: {selectedContractor.contractor.arl || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contracts list */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-900" />
                Contratos Asignados ({selectedContractor.contracts.length})
              </h4>
              {selectedContractor.contracts.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                  Este contratista no tiene contratos asociados actualmente.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedContractor.contracts.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-900 text-xs">
                            {c.numeroContrato}
                          </span>
                          <Badge status={c.estado} size="sm" />
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{c.objeto}</p>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <span className="font-mono font-bold text-emerald-700">
                          ${c.valorTotal.toLocaleString('es-CO')}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          Vigencia: {formatDate(c.fechaInicio)} al {formatDate(c.fechaFin)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reports list */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-900" />
                Informes de Actividades Radicados ({selectedContractor.reports.length})
              </h4>
              {selectedContractor.reports.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                  No ha presentado informes de actividades todavía.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedContractor.reports.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{r.periodo}</span>
                        <span className="text-slate-500 block text-[11px]">
                          Contrato: {r.numeroContrato} • Radicado: {formatDate(r.fechaRadicacion)}
                        </span>
                      </div>
                      <Badge status={r.estado} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
