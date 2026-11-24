import { Router, Response } from 'express';
import crypto from 'crypto';
import { db, Contract } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireSupervisor } from '../auth.js';
import { calculateDetailedDuration } from '../utils/contractDuration.js';

const router = Router();

// GET all contracts (Supervisor gets all; Contratista gets only own contracts)
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user.rol === 'supervisor' || req.user.rol === 'admin') {
      const contracts = db.getContracts();
      res.json({ contracts });
    } else {
      const contracts = db.getContractsByContractor(req.user.id);
      res.json({ contracts });
    }
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Error al consultar contratos.' });
  }
});

// GET specific contract by ID
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const contract = db.getContractById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: 'Contrato no encontrado.' });
      return;
    }

    // Role check: Contratista can only view their own contract
    if (req.user.rol === 'contratista' && contract.contratistaId !== req.user.id) {
      res.status(403).json({ error: 'No tiene autorización para consultar este contrato.' });
      return;
    }

    res.json({ contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: 'Error al consultar el contrato.' });
  }
});

// CREATE contract (SUPERVISOR ONLY)
router.post('/', requireAuth, requireSupervisor, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      numeroContrato,
      contratistaId,
      supervisorResponsable,
      objeto,
      fechaInicio,
      fechaFin,
      valorTotal,
      honorariosMensuales,
      obligacionesContractuales,
      periodicidadPago,
      condicionesPago,
      codigoSecop,
      cdpNumero,
      cdpFecha,
      crpNumero,
      crpFecha,
    } = req.body;

    // Validate required fields
    if (
      !numeroContrato ||
      !contratistaId ||
      !supervisorResponsable ||
      !objeto ||
      !fechaInicio ||
      !fechaFin ||
      !valorTotal ||
      !honorariosMensuales ||
      !periodicidadPago ||
      !condicionesPago
    ) {
      res.status(400).json({
        error: 'Todos los campos obligatorios del contrato deben ser diligenciados.',
      });
      return;
    }

    // Check duplicate contract number
    const existing = db.getContracts().find(
      (c) => c.numeroContrato.trim().toLowerCase() === String(numeroContrato).trim().toLowerCase()
    );
    if (existing) {
      res.status(400).json({
        error: `Ya existe un contrato registrado con el número ${numeroContrato}.`,
      });
      return;
    }

    // Verify contractor user exists
    const contractor = db.getUserById(contratistaId);
    if (!contractor) {
      res.status(400).json({
        error: 'El contratista seleccionado no existe en el sistema.',
      });
      return;
    }

    let parsedObligaciones: string[] = [];
    if (Array.isArray(obligacionesContractuales)) {
      parsedObligaciones = obligacionesContractuales
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
    } else if (typeof obligacionesContractuales === 'string') {
      parsedObligaciones = obligacionesContractuales
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (parsedObligaciones.length === 0) {
      res.status(400).json({
        error: 'Debe incluir al menos una obligación contractual específica.',
      });
      return;
    }

    const newContract: Contract = {
      id: `contract-${crypto.randomUUID()}`,
      numeroContrato: String(numeroContrato).trim().toUpperCase(),
      tipoContrato: 'CONTRATO DE PRESTACIÓN DE SERVICIOS',
      entidadContratante: req.body.entidadContratante ? String(req.body.entidadContratante).trim() : 'MUNICIPIO DE QUIMBAYA, QUINDÍO',
      nitEntidad: req.body.nitEntidad ? String(req.body.nitEntidad).trim() : '890.000.613-4',
      contratistaId: contractor.id,
      contratistaNombre: `${contractor.nombres} ${contractor.apellidos}`,
      contratistaDocumento: contractor.numeroDocumento,
      supervisorResponsable: String(supervisorResponsable).trim(),
      supervisorCargo: req.body.supervisorCargo ? String(req.body.supervisorCargo).trim() : 'SUBSECRETARIO (TIC)',
      supervisorDocumento: req.body.supervisorDocumento ? String(req.body.supervisorDocumento).trim() : '18470223',
      lugarEjecucion: req.body.lugarEjecucion ? String(req.body.lugarEjecucion).trim() : 'QUIMBAYA, QUINDÍO',
      objeto: String(objeto).trim(),
      fechaInicio: String(fechaInicio).trim(),
      fechaFin: String(fechaFin).trim(),
      valorTotal: Number(valorTotal),
      honorariosMensuales: Number(honorariosMensuales),
      obligacionesContractuales: parsedObligaciones,
      periodicidadPago: String(periodicidadPago).trim(),
      condicionesPago: String(condicionesPago).trim(),
      codigoSecop: codigoSecop ? String(codigoSecop).trim() : undefined,
      cdpNumero: cdpNumero !== undefined && cdpNumero !== null ? String(cdpNumero).trim() : '',
      cdpFecha: cdpFecha !== undefined && cdpFecha !== null ? String(cdpFecha).trim() : '',
      crpNumero: crpNumero !== undefined && crpNumero !== null ? String(crpNumero).trim() : '',
      crpFecha: crpFecha !== undefined && crpFecha !== null ? String(crpFecha).trim() : '',
      vigenciaDias: calculateDetailedDuration(String(fechaInicio).trim(), String(fechaFin).trim()).totalDias,
      duracionTexto: calculateDetailedDuration(String(fechaInicio).trim(), String(fechaFin).trim()).texto,
      estado: 'Activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addContract(newContract);

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'CREACION_CONTRATO',
      modulo: 'contratos',
      detalles: `Registro y asignación del contrato ${newContract.numeroContrato} (${newContract.duracionTexto}) al contratista ${newContract.contratistaNombre} (${newContract.contratistaDocumento}) por ${req.user!.rol} ${req.user!.nombres} ${req.user!.apellidos}.`,
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Contrato registrado y asignado exitosamente.',
      contract: newContract,
    });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ error: 'Error interno al registrar el contrato.' });
  }
});

// UPDATE contract (SUPERVISOR or ADMIN)
router.put('/:id', requireAuth, requireSupervisor, (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractId = req.params.id;
    const existing = db.getContractById(contractId);
    if (!existing) {
      res.status(404).json({ error: 'Contrato no encontrado.' });
      return;
    }

    const updates: Partial<Contract> = { ...req.body };

    // Explicitly preserve CDP and CRP numbers as exact strings (keeping leading zeros)
    if (req.body.cdpNumero !== undefined) {
      updates.cdpNumero = req.body.cdpNumero !== null ? String(req.body.cdpNumero).trim() : '';
    }
    if (req.body.cdpFecha !== undefined) {
      updates.cdpFecha = req.body.cdpFecha !== null ? String(req.body.cdpFecha).trim() : '';
    }
    if (req.body.crpNumero !== undefined) {
      updates.crpNumero = req.body.crpNumero !== null ? String(req.body.crpNumero).trim() : '';
    }
    if (req.body.crpFecha !== undefined) {
      updates.crpFecha = req.body.crpFecha !== null ? String(req.body.crpFecha).trim() : '';
    }

    // If contractor changed, refresh cached contractor name and document
    if (updates.contratistaId && updates.contratistaId !== existing.contratistaId) {
      const contractor = db.getUserById(updates.contratistaId);
      if (contractor) {
        updates.contratistaNombre = `${contractor.nombres} ${contractor.apellidos}`;
        updates.contratistaDocumento = contractor.numeroDocumento;
      }
    }

    const newStart = updates.fechaInicio || existing.fechaInicio;
    const newEnd = updates.fechaFin || existing.fechaFin;
    if (newStart && newEnd) {
      const dur = calculateDetailedDuration(newStart, newEnd);
      updates.vigenciaDias = dur.totalDias;
      updates.duracionTexto = dur.texto;
    }

    const updated = db.updateContract(contractId, updates);

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'ACTUALIZACION_CONTRATO',
      modulo: 'contratos',
      detalles: `Modificación de términos del contrato ${existing.numeroContrato} por ${req.user!.rol} ${req.user!.nombres} ${req.user!.apellidos}.`,
      ip: req.ip,
    });

    res.json({
      message: 'Contrato actualizado correctamente.',
      contract: updated,
    });
  } catch (error) {
    console.error('Update contract error:', error);
    res.status(500).json({ error: 'Error al actualizar el contrato.' });
  }
});

export default router;
