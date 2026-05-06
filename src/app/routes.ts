import { Router } from 'express';
import salesRoutes from './ventas/routes';

const router = Router();

router.use('/sales', salesRoutes);

export default router;
