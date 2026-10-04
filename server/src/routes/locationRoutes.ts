import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { locationSearchController } from '../controllers/locationController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';

const router = Router();
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

router.get(
    '/search',
    authenticate,
    authorize('Driver', 'Passenger'),
    searchLimiter,
    locationSearchController,
);

export default router;
