import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Building2, LogOut, Menu, Shield, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Colombian institutional tricolor bar */}
      <div className="h-1 w-full flex">
        <div className="h-full w-2/4 bg-amber-400" />
        <div className="h-full w-1/4 bg-blue-700" />
        <div className="h-full w-1/4 bg-red-600" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs">
                <Building2 className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-base tracking-tight leading-tight">
                    Gestión de Contratistas
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                    Entidad Pública
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  República de Colombia • Sistema Integral de Supervisión
                </p>
              </div>
            </div>
          </div>

          {/* Right user & logout */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-800 leading-tight">
                  {user.nombres} {user.apellidos}
                </span>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      user.rol === 'admin'
                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                        : user.rol === 'supervisor'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {user.rol === 'admin' ? (
                      <>
                        <Shield className="w-3 h-3 text-purple-700" />
                        Administrador General
                      </>
                    ) : user.rol === 'supervisor' ? (
                      <>
                        <Shield className="w-3 h-3 text-blue-700" />
                        Supervisor Administrativo
                      </>
                    ) : (
                      <>
                        <UserIcon className="w-3 h-3 text-emerald-700" />
                        Contratista (CC {user.numeroDocumento})
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 hidden sm:block" />

              <button
                onClick={logout}
                title="Cerrar sesión"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
