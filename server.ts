import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import authRoutes from './server/routes/authRoutes.js';
import contractRoutes from './server/routes/contractRoutes.js';
import contractorRoutes from './server/routes/contractorRoutes.js';
import reportRoutes from './server/routes/reportRoutes.js';
import socialSecurityRoutes from './server/routes/socialSecurityRoutes.js';
import paymentRoutes from './server/routes/paymentRoutes.js';
import statsRoutes from './server/routes/statsRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import uploadRoutes from './server/routes/uploadRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Safe limits to prevent payload issues while files are uploaded separately via /api/uploads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/contractors', contractorRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/social-security', socialSecurityRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/stats', statsRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Gestión de Contratistas - Entidad Pública',
      timestamp: new Date().toISOString(),
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite middleware in development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor] Gestión de Contratistas activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Error al iniciar servidor]:', err);
  process.exit(1);
});
