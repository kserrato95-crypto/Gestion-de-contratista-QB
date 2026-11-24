import { Router, Response } from 'express';
import crypto from 'crypto';
import { db, SocialSecurityRecord } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../auth.js';

const router = Router();

// GET social security records
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user.rol === 'supervisor') {
      const records = db.getSocialSecurity();
      res.json({ records });
    } else {
      const records = db.getSocialSecurityByContractor(req.user.id);
      res.json({ records });
    }
  } catch (error) {
    console.error('Get social security error:', error);
    res.status(500).json({ error: 'Error al consultar registros de seguridad social.' });
  }
});

// POST register PILA planilla
router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const {
      contratoId,
      periodo,
      numeroPlanilla,
      operadorPila,
      valorPagado,
      fechaPago,
      soporteNombre,
      observaciones,
    } = req.body;

    if (!contratoId || !periodo || !numeroPlanilla || !operadorPila || !valorPagado || !fechaPago) {
      res.status(400).json({ error: 'Todos los datos de la planilla PILA son obligatorios.' });
      return;
    }

    const contract = db.getContractById(contratoId);
    if (!contract) {
      res.status(404).json({ error: 'Contrato no encontrado.' });
      return;
    }

    const newRecord: SocialSecurityRecord = {
      id: `ss-${crypto.randomUUID()}`,
      contratistaId: req.user.rol === 'supervisor' ? contract.contratistaId : req.user.id,
      contratistaNombre: contract.contratistaNombre,
      contratoId: contract.id,
      periodo: String(periodo).trim(),
      numeroPlanilla: String(numeroPlanilla).trim(),
      operadorPila: String(operadorPila).trim(),
      valorPagado: Number(valorPagado),
      fechaPago: String(fechaPago).trim(),
      soporteNombre: soporteNombre ? String(soporteNombre).trim() : 'Planilla_PILA_Certificada.pdf',
      estado: 'Al día',
      observaciones: observaciones ? String(observaciones).trim() : 'Planilla PILA registrada en plataforma.',
      createdAt: new Date().toISOString(),
    };

    db.addSocialSecurity(newRecord);

    res.status(201).json({
      message: 'Planilla de seguridad social registrada correctamente.',
      record: newRecord,
    });
  } catch (error) {
    console.error('Register social security error:', error);
    res.status(500).json({ error: 'Error al registrar la planilla de seguridad social.' });
  }
});

export default router;
