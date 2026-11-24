import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, User } from './db.js';

const JWT_SECRET = process.env.SESSION_SECRET || 'entidad-publica-colombia-gestion-contratistas-secret-2025';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    email: user.email,
    rol: user.rol,
    doc: user.numeroDocumento,
    timestamp: Date.now(),
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
  return `${str}.${signature}`;
}

export function verifyToken(token: string): { userId: string; rol: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadStr, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
    // Expiration after 7 days
    if (Date.now() - payload.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sanitizeUser(user: User): Omit<User, 'passwordHash' | 'salt'> {
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Acceso no autorizado. Debe iniciar sesión.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesión expirada o inválida. Por favor ingrese nuevamente.' });
    return;
  }

  const user = db.getUserById(payload.userId);
  if (!user || user.estado !== 'activo') {
    res.status(401).json({ error: 'Usuario no encontrado o inactivo.' });
    return;
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: ('admin' | 'supervisor' | 'contratista')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Acceso no autorizado. Debe iniciar sesión.' });
      return;
    }

    if (!allowedRoles.includes(req.user.rol)) {
      res.status(403).json({
        error: `Acceso denegado. Se requiere uno de los siguientes roles autorizados: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole(['admin']);
export const requireSupervisorOrAdmin = requireRole(['admin', 'supervisor']);

export function requireSupervisor(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  if (req.user.rol !== 'supervisor' && req.user.rol !== 'admin') {
    res.status(403).json({
      error: 'Acceso denegado. Se requieren permisos de supervisión o administración institucional.',
    });
    return;
  }

  next();
}
