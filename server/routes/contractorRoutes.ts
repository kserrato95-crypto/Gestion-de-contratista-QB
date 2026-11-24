import { Router, Response } from 'express';
import crypto from 'crypto';
import { db, hashPassword, User } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireSupervisorOrAdmin, sanitizeUser } from '../auth.js';

const router = Router();

// GET all contractors (SUPERVISOR or ADMIN)
router.get('/', requireAuth, requireSupervisorOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractors = db
      .getUsers()
      .filter((u) => u.rol === 'contratista')
      .map(sanitizeUser);

    const contracts = db.getContracts();
    const enriched = contractors.map((c) => {
      const userContracts = contracts.filter((ct) => ct.contratistaId === c.id);
      return {
        ...c,
        totalContratos: userContracts.length,
        contratosActivos: userContracts.filter((ct) => ct.estado === 'Activo').length,
      };
    });

    res.json({ contractors: enriched });
  } catch (error) {
    console.error('Get contractors error:', error);
    res.status(500).json({ error: 'Error al consultar la lista de contratistas.' });
  }
});

// POST create contractor (SUPERVISOR or ADMIN ONLY)
router.post('/', requireAuth, requireSupervisorOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      tipoDocumento,
      numeroDocumento,
      nombres,
      apellidos,
      email,
      telefono,
      profesion,
      direccion,
      banco,
      tipoCuenta,
      numeroCuenta,
      eps,
      afp,
      arl,
      password,
    } = req.body;

    if (!tipoDocumento || !numeroDocumento || !nombres || !apellidos || !email || !password) {
      res.status(400).json({ error: 'Todos los campos obligatorios (*) deben ser diligenciados.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'La contraseña inicial debe tener mínimo 8 caracteres.' });
      return;
    }

    const cleanDoc = String(numeroDocumento).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    // Check duplicate document or email
    const existing = db.getUsers();
    if (db.findUserByDocument(cleanDoc)) {
      res.status(400).json({
        error: `Ya existe un usuario registrado con el número de documento ${cleanDoc}.`,
      });
      return;
    }

    if (existing.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(400).json({
        error: `El correo electrónico ${cleanEmail} ya se encuentra registrado.`,
      });
      return;
    }

    const { hash, salt } = hashPassword(password);

    const newContractor: User = {
      id: `user-contratista-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipoDocumento: String(tipoDocumento).toUpperCase(),
      numeroDocumento: cleanDoc,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      email: cleanEmail,
      telefono: String(telefono || '').trim(),
      profesion: String(profesion || '').trim(),
      rol: 'contratista', // STRICT: Always contractor
      passwordHash: hash,
      salt: salt,
      direccion: String(direccion || '').trim(),
      banco: String(banco || '').trim(),
      tipoCuenta: String(tipoCuenta || '').trim(),
      numeroCuenta: String(numeroCuenta || '').trim(),
      eps: String(eps || '').trim(),
      afp: String(afp || '').trim(),
      arl: String(arl || '').trim(),
      estado: 'activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addUser(newContractor);

    // Audit log
    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'CREACION_CONTRATISTA',
      modulo: 'usuarios',
      detalles: `Creación del perfil de contratista ${newContractor.nombres} ${newContractor.apellidos} (${newContractor.tipoDocumento} ${newContractor.numeroDocumento}) por ${req.user!.rol} ${req.user!.nombres} ${req.user!.apellidos}.`,
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Perfil de contratista creado exitosamente.',
      contractor: sanitizeUser(newContractor),
    });
  } catch (error) {
    console.error('Create contractor error:', error);
    res.status(500).json({ error: 'Error al registrar el perfil del contratista.' });
  }
});

// PATCH toggle contractor active/inactive status
router.patch('/:id/status', requireAuth, requireSupervisorOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (estado !== 'activo' && estado !== 'inactivo') {
      res.status(400).json({ error: 'Estado inválido. Debe ser "activo" o "inactivo".' });
      return;
    }

    const contractor = db.getUserById(id);
    if (!contractor || contractor.rol !== 'contratista') {
      res.status(404).json({ error: 'Contratista no encontrado.' });
      return;
    }

    const updated = db.updateUser(id, { estado });

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'CAMBIO_ESTADO_CONTRATISTA',
      modulo: 'usuarios',
      detalles: `Cambio de estado del contratista ${contractor.nombres} ${contractor.apellidos} a "${estado}" por ${req.user!.rol} ${req.user!.nombres} ${req.user!.apellidos}.`,
      ip: req.ip,
    });

    res.json({
      message: `Contratista marcado como ${estado} exitosamente.`,
      contractor: sanitizeUser(updated!),
    });
  } catch (error) {
    console.error('Update contractor status error:', error);
    res.status(500).json({ error: 'Error al actualizar el estado del contratista.' });
  }
});

// POST reset contractor password (SUPERVISOR or ADMIN)
router.post('/:id/reset-password', requireAuth, requireSupervisorOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres.' });
      return;
    }

    const contractor = db.getUserById(id);
    if (!contractor || contractor.rol !== 'contratista') {
      res.status(404).json({ error: 'Contratista no encontrado.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    db.updateUser(id, { passwordHash: hash, salt });

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'RESTABLECER_CONTRASENA_CONTRATISTA',
      modulo: 'seguridad',
      detalles: `Restablecimiento seguro de clave para el contratista ${contractor.nombres} ${contractor.apellidos} (${contractor.numeroDocumento}) por ${req.user!.rol} ${req.user!.nombres} ${req.user!.apellidos}.`,
      ip: req.ip,
    });

    res.json({
      message: `Contraseña del contratista ${contractor.nombres} ${contractor.apellidos} restablecida exitosamente.`,
    });
  } catch (error) {
    console.error('Reset contractor password error:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña del contratista.' });
  }
});

// GET specific contractor details
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const contractorId = req.params.id;

    // Permissions: Admin, Supervisor, or Contractor viewing own profile
    if (req.user.rol !== 'admin' && req.user.rol !== 'supervisor' && req.user.id !== contractorId) {
      res.status(403).json({ error: 'No tiene permisos para consultar este contratista.' });
      return;
    }

    const contractor = db.getUserById(contractorId);
    if (!contractor || contractor.rol !== 'contratista') {
      res.status(404).json({ error: 'Contratista no encontrado.' });
      return;
    }

    const contracts = db.getContractsByContractor(contractorId);
    const reports = db.getReportsByContractor(contractorId);
    const socialSecurity = db.getSocialSecurityByContractor(contractorId);

    res.json({
      contractor: sanitizeUser(contractor),
      contracts,
      reports,
      socialSecurity,
    });
  } catch (error) {
    console.error('Get contractor detail error:', error);
    res.status(500).json({ error: 'Error al consultar detalles del contratista.' });
  }
});

export default router;
