import { Router, Response } from 'express';
import crypto from 'crypto';
import { db, hashPassword, verifyPassword, User } from '../db.js';
import { AuthenticatedRequest, generateToken, requireAuth, sanitizeUser } from '../auth.js';

const router = Router();

// Public registration is disabled per institutional security requirements
router.post('/register', (_req, res: Response) => {
  res.status(403).json({
    error: 'El registro público de usuarios ha sido deshabilitado institucionalmente. Todos los perfiles deben ser creados por un Administrador o Supervisor autorizado según la jerarquía del sistema.',
  });
});

// Password recovery request (audited)
router.post('/recover-password', (req, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ error: 'Por favor ingrese su número de documento o correo electrónico.' });
      return;
    }

    const clean = String(identifier).trim();
    const user = db.getUserByIdentificationOrEmail(clean);

    if (user) {
      db.addAuditLog({
        usuarioId: user.id,
        usuarioNombre: `${user.nombres} ${user.apellidos}`,
        usuarioRol: user.rol,
        accion: 'SOLICITUD_RESTABLECIMIENTO_ACCESO',
        modulo: 'seguridad',
        detalles: `Solicitud de restablecimiento de contraseña para ${user.tipoDocumento} ${user.numeroDocumento} (${user.email}).`,
        ip: req.ip,
      });
    }

    res.json({
      message: 'Si el usuario se encuentra registrado en el sistema, la solicitud de restablecimiento ha sido registrada en el módulo de auditoría institucional. Comuníquese con su supervisor o con el Administrador para la emisión de una clave temporal segura.',
    });
  } catch (error) {
    console.error('Recover password error:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
  }
});

// Login by Document number OR Email/Username
router.post('/login', (req, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({
        error: 'Debe ingresar su número de documento o correo electrónico, y su contraseña.',
      });
      return;
    }

    const user = db.getUserByIdentificationOrEmail(String(identifier));
    if (!user) {
      res.status(401).json({
        error: 'Credenciales inválidas. Verifique el número de documento o correo ingresado.',
      });
      return;
    }

    if (user.estado !== 'activo') {
      res.status(403).json({
        error: 'Su cuenta se encuentra inactiva. Por favor contacte a la administración de la entidad.',
      });
      return;
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      res.status(401).json({
        error: 'Credenciales inválidas. Contraseña incorrecta.',
      });
      return;
    }

    // Audit log
    db.addAuditLog({
      usuarioId: user.id,
      usuarioNombre: `${user.nombres} ${user.apellidos}`,
      usuarioRol: user.rol,
      accion: 'INICIO_SESION',
      modulo: 'seguridad',
      detalles: `Inicio de sesión exitoso como ${user.rol}.`,
      ip: req.ip,
    });

    const token = generateToken(user);
    res.json({
      message: 'Inicio de sesión exitoso.',
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno en el servidor.' });
  }
});

// Get current logged-in user profile
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  res.json({ user: sanitizeUser(req.user) });
});

// Update personal information (Contratista updates own authorized info)
router.put('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const {
      telefono,
      direccion,
      profesion,
      banco,
      tipoCuenta,
      numeroCuenta,
      eps,
      afp,
      arl,
    } = req.body;

    // Notice: rol and numeroDocumento are NOT changeable here by contractor!
    const updated = db.updateUser(req.user.id, {
      telefono: telefono !== undefined ? String(telefono).trim() : req.user.telefono,
      direccion: direccion !== undefined ? String(direccion).trim() : req.user.direccion,
      profesion: profesion !== undefined ? String(profesion).trim() : req.user.profesion,
      banco: banco !== undefined ? String(banco).trim() : req.user.banco,
      tipoCuenta: tipoCuenta !== undefined ? String(tipoCuenta).trim() : req.user.tipoCuenta,
      numeroCuenta: numeroCuenta !== undefined ? String(numeroCuenta).trim() : req.user.numeroCuenta,
      eps: eps !== undefined ? String(eps).trim() : req.user.eps,
      afp: afp !== undefined ? String(afp).trim() : req.user.afp,
      arl: arl !== undefined ? String(arl).trim() : req.user.arl,
    });

    if (!updated) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    res.json({
      message: 'Datos personales actualizados correctamente.',
      user: sanitizeUser(updated),
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

// Change password
router.post('/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva contraseña.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres.' });
      return;
    }

    const isValid = verifyPassword(currentPassword, req.user.passwordHash, req.user.salt);
    if (!isValid) {
      res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    db.updateUser(req.user.id, {
      passwordHash: hash,
      salt: salt,
    });

    res.json({ message: 'Contraseña actualizada con éxito.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Error al cambiar la contraseña.' });
  }
});

export default router;
