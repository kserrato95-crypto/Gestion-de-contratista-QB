import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/layout/Navbar.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { AuthPage } from './components/auth/AuthPage.js';

// Admin components
import { AdminInicio } from './components/admin/AdminInicio.js';
import { AdminSupervisores } from './components/admin/AdminSupervisores.js';
import { AdminAuditoria } from './components/admin/AdminAuditoria.js';
import { AdminActasSupervision } from './components/admin/AdminActasSupervision.js';

// Supervisor components
import { SupervisorInicio } from './components/supervisor/SupervisorInicio.js';
import { SupervisorActasPendientes } from './components/supervisor/SupervisorActasPendientes.js';
import { SupervisorContratistas } from './components/supervisor/SupervisorContratistas.js';
import { SupervisorContratos } from './components/supervisor/SupervisorContratos.js';
import { SupervisorInformes } from './components/supervisor/SupervisorInformes.js';
import { SupervisorSeguridadSocial } from './components/supervisor/SupervisorSeguridadSocial.js';
import { SupervisorRevision } from './components/supervisor/SupervisorRevision.js';
import { SupervisorPagos } from './components/supervisor/SupervisorPagos.js';
import { SupervisorReportes } from './components/supervisor/SupervisorReportes.js';
import { SupervisorConfiguracion } from './components/supervisor/SupervisorConfiguracion.js';
import { SupervisorSeguimientoContratistas } from './components/supervisor/SupervisorSeguimientoContratistas.js';

// Contratista components
import { ContratistaInicio } from './components/contratista/ContratistaInicio.js';
import { ContratistaSeguimientoContrato } from './components/contratista/ContratistaSeguimientoContrato.js';
import { ContratistaMiInformacion } from './components/contratista/ContratistaMiInformacion.js';
import { ContratistaMiContrato } from './components/contratista/ContratistaMiContrato.js';
import { ContratistaMisInformes } from './components/contratista/ContratistaMisInformes.js';
import { ContratistaSeguridadSocial } from './components/contratista/ContratistaSeguridadSocial.js';
import { ContratistaMisPagos } from './components/contratista/ContratistaMisPagos.js';
import { ContratistaPerfil } from './components/contratista/ContratistaPerfil.js';

import { Building2 } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentSection, setCurrentSection] = useState('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Contract modal controls
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);

  // Contratista modal controls
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);

  // Reset section when role changes or user logs in
  useEffect(() => {
    setCurrentSection('inicio');
  }, [user?.rol]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-blue-900 text-amber-300 flex items-center justify-center shadow-md mb-4 animate-pulse">
          <Building2 className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Cargando Gestión de Contratistas...</p>
        <p className="text-xs text-slate-500 mt-1">Verificando sesión segura institucional</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const isAdmin = user.rol === 'admin';
  const isSupervisor = user.rol === 'supervisor';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <div className="flex-1 flex">
        <Sidebar
          currentSection={currentSection}
          onSelectSection={(sec) => setCurrentSection(sec)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 lg:pl-64 flex flex-col">
          <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {isAdmin ? (
              <>
                {currentSection === 'inicio' && (
                  <AdminInicio onNavigate={(sec) => setCurrentSection(sec)} />
                )}
                {currentSection === 'supervisores' && <AdminSupervisores />}
                {currentSection === 'contratistas' && <SupervisorContratistas />}
                {currentSection === 'contratos' && (
                  <SupervisorContratos
                    onOpenNewContract={() => setIsNewContractModalOpen(true)}
                    isNewModalOpen={isNewContractModalOpen}
                    onCloseNewModal={() => setIsNewContractModalOpen(false)}
                  />
                )}
                {currentSection === 'actas-pendientes' && <AdminActasSupervision />}
                {currentSection === 'informes' && <SupervisorInformes />}
                {currentSection === 'pagos' && <SupervisorPagos />}
                {currentSection === 'auditoria' && <AdminAuditoria />}
                {currentSection === 'configuracion' && <SupervisorConfiguracion />}
              </>
            ) : isSupervisor ? (
              <>
                {currentSection === 'inicio' && (
                  <SupervisorInicio
                    onNavigate={(sec) => setCurrentSection(sec)}
                    onOpenNewContract={() => setIsNewContractModalOpen(true)}
                  />
                )}
                {currentSection === 'seguimiento-contratistas' && <SupervisorSeguimientoContratistas />}
                {currentSection === 'actas-pendientes' && <SupervisorActasPendientes />}
                {currentSection === 'contratistas' && <SupervisorContratistas />}
                {currentSection === 'contratos' && (
                  <SupervisorContratos
                    onOpenNewContract={() => setIsNewContractModalOpen(true)}
                    isNewModalOpen={isNewContractModalOpen}
                    onCloseNewModal={() => setIsNewContractModalOpen(false)}
                  />
                )}
                {currentSection === 'informes' && <SupervisorInformes />}
                {currentSection === 'seguridad-social' && <SupervisorSeguridadSocial />}
                {currentSection === 'revision' && <SupervisorRevision />}
                {currentSection === 'pagos' && <SupervisorPagos />}
                {currentSection === 'reportes' && <SupervisorReportes />}
                {currentSection === 'configuracion' && <SupervisorConfiguracion />}
              </>
            ) : (
              <>
                {currentSection === 'inicio' && (
                  <ContratistaInicio
                    onNavigate={(sec) => setCurrentSection(sec)}
                    onOpenNewReport={() => setIsNewReportModalOpen(true)}
                  />
                )}
                {currentSection === 'seguimiento-contrato' && (
                  <ContratistaSeguimientoContrato
                    onNavigate={(sec) => setCurrentSection(sec)}
                    onOpenNewReport={() => setIsNewReportModalOpen(true)}
                  />
                )}
                {currentSection === 'mi-informacion' && <ContratistaMiInformacion />}
                {currentSection === 'mi-contrato' && <ContratistaMiContrato />}
                {currentSection === 'mis-informes' && (
                  <ContratistaMisInformes
                    isNewModalOpen={isNewReportModalOpen}
                    onOpenNewModal={() => setIsNewReportModalOpen(true)}
                    onCloseNewModal={() => setIsNewReportModalOpen(false)}
                  />
                )}
                {currentSection === 'seguridad-social-docs' && <ContratistaSeguridadSocial />}
                {currentSection === 'mis-pagos' && <ContratistaMisPagos />}
                {currentSection === 'mi-perfil' && <ContratistaPerfil />}
              </>
            )}
          </div>

          {/* Institutional footer */}
          <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
            <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-2">
              <span className="font-medium text-slate-700">
                Gestión de Contratistas • Entidad Pública
              </span>
              <span>
                Alcaldía Municipal de Quimbaya, Quindío • Control de Supervisión Contractual
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
