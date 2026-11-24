import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { db, UPLOADS_DIR, StoredEvidenceFile } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../auth.js';

const router = Router();

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    cb(null, `${uniqueId}_${safeBaseName}${ext}`);
  },
});

// File filter: accept images, PDF, Word, Excel documents
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos oficiales (PDF, DOCX, XLSX).'
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB maximum per file
  },
});

// POST /api/uploads - Upload single evidence file
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado.' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No se envió ningún archivo para almacenar.' });
        return;
      }

      const {
        contratoId,
        periodo,
        obligacionId,
        actividadId,
        tipo = 'fotografia',
        descripcion = '',
      } = req.body;

      let contratistaId = req.user.id;
      if (req.user.rol !== 'contratista' && req.body.contratistaId) {
        contratistaId = req.body.contratistaId;
      }

      const fileId = `file-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      const newFile: StoredEvidenceFile = {
        id: fileId,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
        uploadedByNombre: `${req.user.nombres} ${req.user.apellidos}`,
        contratistaId,
        contratoId: contratoId ? String(contratoId).trim() : undefined,
        periodo: periodo ? String(periodo).trim() : undefined,
        obligacionId: obligacionId ? String(obligacionId).trim() : undefined,
        actividadId: actividadId ? String(actividadId).trim() : undefined,
        tipo: (['fotografia', 'soporte', 'seguridad_social'].includes(tipo)
          ? tipo
          : 'fotografia') as any,
        descripcion: descripcion ? String(descripcion).trim() : req.file.originalname,
        createdAt: now,
      };

      db.addEvidenceFile(newFile);

      res.status(201).json({
        success: true,
        message: 'Archivo de evidencia cargado y almacenado correctamente.',
        file: {
          id: newFile.id,
          url: `/api/uploads/${newFile.id}`,
          downloadUrl: `/api/uploads/${newFile.id}/download`,
          originalName: newFile.originalName,
          mimeType: newFile.mimeType,
          size: newFile.size,
          tipo: newFile.tipo,
          obligacionId: newFile.obligacionId,
          descripcion: newFile.descripcion,
          createdAt: newFile.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Error handling upload:', error);
      res.status(500).json({
        error: error.message || 'Error al procesar el archivo en el almacenamiento seguro.',
      });
    }
  }
);

// GET /api/uploads/:id - View/stream evidence file with access control and robust fallback
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const file =
      db.getEvidenceFileById(req.params.id) ||
      db.getEvidenceFiles().find((f) => f.fileName === req.params.id || f.id === req.params.id);

    if (!file) {
      // Check if it's a file directly stored in UPLOADS_DIR
      const directCandidate = path.join(UPLOADS_DIR, req.params.id);
      if (fs.existsSync(directCandidate)) {
        const ext = path.extname(req.params.id).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.pdf': 'application/pdf',
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(req.params.id)}"`);
        fs.createReadStream(directCandidate).pipe(res);
        return;
      }
      res.status(404).json({ error: 'Archivo no encontrado en el sistema.' });
      return;
    }

    let physicalPath = file.filePath;
    if (!fs.existsSync(physicalPath)) {
      const candidate = path.join(UPLOADS_DIR, file.fileName);
      if (fs.existsSync(candidate)) {
        physicalPath = candidate;
      } else {
        res.status(404).json({ error: 'El archivo físico no se encuentra en el disco.' });
        return;
      }
    }

    const stat = fs.statSync(physicalPath);
    res.setHeader('Content-Type', file.mimeType || 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(physicalPath);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Error streaming evidence file:', error);
    res.status(500).json({ error: 'Error al servir el archivo de evidencia.' });
  }
});

// GET /api/uploads/:id/download - Download evidence file
router.get('/:id/download', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const file =
      db.getEvidenceFileById(req.params.id) ||
      db.getEvidenceFiles().find((f) => f.fileName === req.params.id || f.id === req.params.id);

    if (!file) {
      res.status(404).json({ error: 'Archivo no encontrado.' });
      return;
    }

    let physicalPath = file.filePath;
    if (!fs.existsSync(physicalPath)) {
      const candidate = path.join(UPLOADS_DIR, file.fileName);
      if (fs.existsSync(candidate)) {
        physicalPath = candidate;
      } else {
        res.status(404).json({ error: 'El archivo físico no existe.' });
        return;
      }
    }

    const stat = fs.statSync(physicalPath);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`
    );
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(physicalPath);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Error downloading evidence file:', error);
    res.status(500).json({ error: 'Error al descargar archivo.' });
  }
});

// DELETE /api/uploads/:id - Delete evidence file
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    const file = db.getEvidenceFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'Archivo no encontrado.' });
      return;
    }

    if (req.user.rol === 'contratista' && file.contratistaId !== req.user.id && file.uploadedBy !== req.user.id) {
      res.status(403).json({ error: 'No tiene permiso para eliminar este archivo.' });
      return;
    }

    db.deleteEvidenceFile(file.id);

    res.json({
      success: true,
      message: 'Archivo eliminado correctamente.',
    });
  } catch (error: any) {
    console.error('Error deleting evidence file:', error);
    res.status(500).json({ error: 'Error al eliminar el archivo.' });
  }
});

export default router;
