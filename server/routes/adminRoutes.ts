import { Router, Response } from 'express';
import crypto from 'crypto';
import { db, hashPassword, User } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireAdmin, sanitizeUser } from '../auth.js';

const router = Router();

// Apply auth and admin check to all routes in this router
router.use(requireAuth, requireAdmin);

// GET admin dashboard stats
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = db.getUsers();
    const contracts = db.getContracts();
    const reports = db.getReports();
    const auditLogs = db.getAuditLogs();

    const supervisors = users.filter((u) => u.rol === 'supervisor');
    const contractors = users.filter((u) => u.rol === 'contratista');

    res.json({
      totalUsuarios: users.length,
      totalSupervisores: supervisors.length,
      supervisoresActivos: supervisors.filter((s) => s.estado === 'activo').length,
      totalContratistas: contractors.length,
      contratistasActivos: contractors.filter((c) => c.estado === 'activo').length,
      totalContratos: contracts.length,
      contratosActivos: contracts.filter((c) => c.estado === 'Activo').length,
      totalInformes: reports.length,
      informesPendientes: reports.filter((r) => r.estado === 'Radicado' || r.estado === 'En revisión').length,
      informesAprobados: reports.filter((r) => r.estado === 'Aprobado').length,
      totalEventosAuditoria: auditLogs.length,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Error al consultar las métricas administrativas.' });
  }
});

// GET all supervisors
router.get('/supervisors', (req: AuthenticatedRequest, res: Response) => {
  try {
    const supervisors = db.getSupervisors().map(sanitizeUser);
    const contracts = db.getContracts();

    const enriched = supervisors.map((s) => {
      // Find contracts supervised by this user (by name or document)
      const assignedContracts = contracts.filter(
        (c) =>
          (c.supervisorDocumento && c.supervisorDocumento === s.numeroDocumento) ||
          c.supervisorResponsable.toLowerCase().includes(s.nombres.toLowerCase())
      );
      return {
        ...s,
        totalContratosSupervisados: assignedContracts.length,
        contratosActivosSupervisados: assignedContracts.filter((c) => c.estado === 'Activo').length,
      };
    });

    res.json({ supervisors: enriched });
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({ error: 'Error al obtener los supervisores.' });
  }
});

// POST create supervisor profile (ADMIN ONLY)
router.post('/supervisors', (req: AuthenticatedRequest, res: Response) => {
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
      password,
    } = req.body;

    if (!tipoDocumento || !numeroDocumento || !nombres || !apellidos || !email || !password) {
      res.status(400).json({ error: 'Todos los campos obligatorios (*) deben ser diligenciados.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres.' });
      return;
    }

    const cleanDoc = String(numeroDocumento).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    const existingUsers = db.getUsers();
    if (db.findUserByDocument(cleanDoc)) {
      res.status(400).json({
        error: `Ya existe un usuario registrado con el documento ${cleanDoc}.`,
      });
      return;
    }

    if (existingUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(400).json({
        error: `El correo electrónico ${cleanEmail} ya se encuentra registrado.`,
      });
      return;
    }

    const { hash, salt } = hashPassword(password);

    const newSupervisor: User = {
      id: `user-supervisor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipoDocumento: String(tipoDocumento).toUpperCase(),
      numeroDocumento: cleanDoc,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      email: cleanEmail,
      telefono: String(telefono || '').trim(),
      profesion: String(profesion || '').trim(),
      rol: 'supervisor', // STRICT: Admin explicitly assigns supervisor
      passwordHash: hash,
      salt: salt,
      direccion: String(direccion || '').trim(),
      estado: 'activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addUser(newSupervisor);

    // Audit log
    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'CREACION_SUPERVISOR',
      modulo: 'usuarios',
      detalles: `Creación del perfil de supervisor institucional ${newSupervisor.nombres} ${newSupervisor.apellidos} (${newSupervisor.tipoDocumento} ${newSupervisor.numeroDocumento}, cargo: ${newSupervisor.profesion || 'Sin especificar'}) por el Administrador.`,
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Perfil de supervisor creado exitosamente.',
      supervisor: sanitizeUser(newSupervisor),
    });
  } catch (error) {
    console.error('Create supervisor error:', error);
    res.status(500).json({ error: 'Error al registrar el supervisor.' });
  }
});

// PUT update supervisor profile
router.put('/supervisors/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nombres, apellidos, telefono, profesion, direccion, email } = req.body;

    const supervisor = db.getUserById(id);
    if (!supervisor || supervisor.rol !== 'supervisor') {
      res.status(404).json({ error: 'Supervisor no encontrado.' });
      return;
    }

    const updated = db.updateUser(id, {
      nombres: nombres !== undefined ? String(nombres).trim() : supervisor.nombres,
      apellidos: apellidos !== undefined ? String(apellidos).trim() : supervisor.apellidos,
      telefono: telefono !== undefined ? String(telefono).trim() : supervisor.telefono,
      profesion: profesion !== undefined ? String(profesion).trim() : supervisor.profesion,
      direccion: direccion !== undefined ? String(direccion).trim() : supervisor.direccion,
      email: email !== undefined ? String(email).trim().toLowerCase() : supervisor.email,
    });

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'ACTUALIZACION_SUPERVISOR',
      modulo: 'usuarios',
      detalles: `Actualización de datos del supervisor ${supervisor.nombres} ${supervisor.apellidos} (${supervisor.numeroDocumento}) por el Administrador.`,
      ip: req.ip,
    });

    res.json({
      message: 'Perfil de supervisor actualizado exitosamente.',
      supervisor: sanitizeUser(updated!),
    });
  } catch (error) {
    console.error('Update supervisor error:', error);
    res.status(500).json({ error: 'Error al actualizar el supervisor.' });
  }
});

// PATCH activate/deactivate supervisor
router.patch('/supervisors/:id/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (estado !== 'activo' && estado !== 'inactivo') {
      res.status(400).json({ error: 'El estado debe ser "activo" o "inactivo".' });
      return;
    }

    const supervisor = db.getUserById(id);
    if (!supervisor || supervisor.rol !== 'supervisor') {
      res.status(404).json({ error: 'Supervisor no encontrado.' });
      return;
    }

    const updated = db.updateUser(id, { estado });

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'CAMBIO_ESTADO_SUPERVISOR',
      modulo: 'usuarios',
      detalles: `Supervisor ${supervisor.nombres} ${supervisor.apellidos} cambiado a estado "${estado}" por el Administrador.`,
      ip: req.ip,
    });

    res.json({
      message: `Supervisor marcado como ${estado} exitosamente.`,
      supervisor: sanitizeUser(updated!),
    });
  } catch (error) {
    console.error('Change supervisor status error:', error);
    res.status(500).json({ error: 'Error al cambiar estado del supervisor.' });
  }
});

// POST reset any user's password securely (ADMIN ONLY)
router.post('/users/:id/reset-password', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    const targetUser = db.getUserById(id);
    if (!targetUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    db.updateUser(id, { passwordHash: hash, salt });

    db.addAuditLog({
      usuarioId: req.user!.id,
      usuarioNombre: `${req.user!.nombres} ${req.user!.apellidos}`,
      usuarioRol: req.user!.rol,
      accion: 'RESTABLECER_CONTRASENA_USUARIO',
      modulo: 'seguridad',
      detalles: `Restablecimiento administrativo de credenciales para el usuario ${targetUser.rol} ${targetUser.nombres} ${targetUser.apellidos} (${targetUser.numeroDocumento}).`,
      ip: req.ip,
    });

    res.json({
      message: `Contraseña de ${targetUser.nombres} ${targetUser.apellidos} restablecida exitosamente.`,
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña del usuario.' });
  }
});

// GET all audit logs
router.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = db.getAuditLogs();
    const { modulo, usuarioId, search } = req.query;

    let filtered = logs;

    if (modulo && modulo !== 'todos') {
      filtered = filtered.filter((l) => l.modulo === String(modulo));
    }

    if (usuarioId) {
      filtered = filtered.filter((l) => l.usuarioId === String(usuarioId));
    }

    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.accion.toLowerCase().includes(q) ||
          l.detalles.toLowerCase().includes(q) ||
          l.usuarioNombre.toLowerCase().includes(q)
      );
    }

    res.json({ auditLogs: filtered });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Error al consultar los registros de auditoría.' });
  }
});

// GET all users (ADMIN ONLY)
router.get('/all-users', (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = db.getUsers().map(sanitizeUser);
    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Error al consultar todos los usuarios.' });
  }
});

export default router;
