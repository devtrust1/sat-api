import { Router } from 'express';
import userModuleRoutes from '../modules/user/user.routes';

const router = Router();

// Use the new modular user routes (includes all new endpoints)
router.use('/', userModuleRoutes);

export default router;
