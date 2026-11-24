import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth, requireSupervisor } from '../auth.js';

const router = Router();

// GET payments
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user.rol === 'supervisor') {
      const payments = db.getPayments();
      res.json({ payments });
    } else {
      const payments = db.getPaymentsByContractor(req.user.id);
      res.json({ payments });
    }
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Error al consultar pagos.' });
  }
});

// UPDATE payment status (SUPERVISOR ONLY)
router.put('/:id', requireAuth, requireSupervisor, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { estado, referenciaPago } = req.body;
    const payment = db.updatePayment(req.params.id, {
      ...(estado ? { estado } : {}),
      ...(referenciaPago ? { referenciaPago } : {}),
    });

    if (!payment) {
      res.status(404).json({ error: 'Registro de pago no encontrado.' });
      return;
    }

    res.json({ message: 'Estado del pago actualizado con éxito.', payment });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ error: 'Error al actualizar el pago.' });
  }
});

export default router;
