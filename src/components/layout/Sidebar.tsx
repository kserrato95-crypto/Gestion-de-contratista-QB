import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  Users,
  FileText,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  BarChart3,
  Settings,
  UserCheck,
  Briefcase,
  FileSpreadsheet,
  FolderLock,
  Wallet,
  UserCircle,
  X,
  Activity,
  Shield,
  CalendarClock,
} from 'lucide-react';

interface SidebarProps {
  currentSection: string;
  onSelectSection: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  if (!user) return null;

  const isSupervisor = user.rol === 'supervisor';
  const isAdmin = user.rol === 'admin';

  const adminMenu = [
    { id: 'inicio', label: '1. Inicio (Control General)', icon: LayoutDashboard },
    { id: 'supervisores', label: '2. Supervisores', icon: UserCheck },
    { id: 'contratistas', label: '3. Contratistas', icon: Users },
    { id: 'contratos', label: '4. Contratos', icon: FileText },
    { id: 'actas-pendientes', label: '5. Actas de supervisión', icon: FileCheck2 },
    { id: 'informes', label: '6. Informes de actividades', icon: FileSpreadsheet },
    { id: 'pagos', label: '7. Pagos y periodos', icon: CreditCard },
    { id: 'auditoria', label: '8. Auditoría y Trazabilidad', icon: Activity },
    { id: 'configuracion', label: '9. Configuración y Seguridad', icon: Settings },
  ];

  const supervisorMenu = [
    { id: 'inicio', label: '1. Inicio', icon: LayoutDashboard },
    { id: 'seguimiento-contratistas', label: '2. Seguimiento de contratistas', icon: CalendarClock },
    { id: 'actas-pendientes', label: '3. Actas de supervisión', icon: FileCheck2 },
    { id: 'contratistas', label: '4. Contratistas', icon: Users },
    { id: 'contratos', label: '5. Contratos', icon: FileText },
    { id: 'informes', label: '6. Informes de actividades', icon: FileSpreadsheet },
    { id: 'seguridad-social', label: '7. Seguridad social', icon: ShieldCheck },
    { id: 'revision', label: '8. Revisión y aprobación', icon: CheckCircle2 },
    { id: 'pagos', label: '9. Pagos', icon: CreditCard },
    { id: 'reportes', label: '10. Reportes', icon: BarChart3 },
    { id: 'configuracion', label: '11. Configuración', icon: Settings },
  ];

  const contratistaMenu = [
    { id: 'inicio', label: '1. Inicio', icon: LayoutDashboard },
    { id: 'seguimiento-contrato', label: '2. Seguimiento de mi contrato', icon: CalendarClock },
    { id: 'mi-informacion', label: '3. Mi información', icon: UserCheck },
    { id: 'mi-contrato', label: '4. Mi contrato', icon: Briefcase },
    { id: 'mis-informes', label: '5. Mis informes', icon: FileSpreadsheet },
    { id: 'seguridad-social-docs', label: '6. Seguridad social y documentos', icon: FolderLock },
    { id: 'mis-pagos', label: '7. Mis pagos', icon: Wallet },
    { id: 'mi-perfil', label: '8. Mi perfil', icon: UserCircle },
  ];

  const menuItems = isAdmin ? adminMenu : isSupervisor ? supervisorMenu : contratistaMenu;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Role badge banner */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Módulo institucional
            </span>
            <p className="text-xs font-semibold text-white mt-0.5">
              {isAdmin
                ? 'Panel del Administrador'
                : isSupervisor
                ? 'Panel del Supervisor'
                : 'Panel del Contratista'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-amber-300' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
          <p className="font-medium text-slate-300">V.1.0 • Estándar Institucional</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Control y Gestión Contractual</p>
        </div>
      </aside>
    </>
  );
};
