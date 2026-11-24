import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../auth.js';

const router = Router();

// GET supervisor statistics (strict real DB figures, 0 if empty)
router.get('/supervisor', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.rol !== 'supervisor') {
      res.status(403).json({ error: 'Acceso denegado a métricas de supervisión.' });
      return;
    }

    const contractors = db.getUsers().filter((u) => u.rol === 'contratista');
    const contracts = db.getContracts();
    const reports = db.getReports();
    const payments = db.getPayments();

    const totalContratistas = contractors.length;
    const contratosActivos = contracts.filter((c) => c.estado === 'Activo').length;
    const informesPendientesRevision = reports.filter((r) => r.estado === 'Radicado' || r.estado === 'En revisión').length;
    const informesAprobados = reports.filter((r) => r.estado === 'Aprobado').length;
    const informesConObservaciones = reports.filter((r) => r.estado === 'Devuelto').length;

    const valorTotalContratado = contracts.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
    const valorTotalPagado = payments
      .filter((p) => p.estado === 'Pagado')
      .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

    res.json({
      totalContratistas,
      contratosActivos,
      informesPendientesRevision,
      informesAprobados,
      informesConObservaciones,
      valorTotalContratado,
      valorTotalPagado,
      totalContratos: contracts.length,
      totalInformes: reports.length,
    });
  } catch (error) {
    console.error('Stats supervisor error:', error);
    res.status(500).json({ error: 'Error al consultar métricas.' });
  }
});

// GET contractor individual statistics
router.get('/contractor', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const contracts = db.getContractsByContractor(req.user.id);
    const reports = db.getReportsByContractor(req.user.id);
    const payments = db.getPaymentsByContractor(req.user.id);
    const socialSecurity = db.getSocialSecurityByContractor(req.user.id);

    const activeContract = contracts.find((c) => c.estado === 'Activo') || contracts[0] || null;

    res.json({
      tieneContrato: contracts.length > 0,
      totalContratos: contracts.length,
      contratoActivo: activeContract,
      informesPendientes: reports.filter((r) => r.estado === 'Borrador' || r.estado === 'Devuelto').length,
      informesRadicados: reports.filter((r) => r.estado === 'Radicado').length,
      informesAprobados: reports.filter((r) => r.estado === 'Aprobado').length,
      planillasPresentadas: socialSecurity.length,
      pagosCertificados: payments.filter((p) => p.estado !== 'Pendiente certificación').length,
    });
  } catch (error) {
    console.error('Stats contractor error:', error);
    res.status(500).json({ error: 'Error al consultar métricas de contratista.' });
  }
});

export default router;
