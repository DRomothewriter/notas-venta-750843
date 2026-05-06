import { Router } from 'express';
import * as controller from './controller';

const router = Router();

router.post('/', controller.createSale);
router.get('/download/:id', controller.downloadSale);
router.get('/:id', controller.getSale);

export default router;
