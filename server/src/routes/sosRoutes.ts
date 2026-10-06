import { Router } from 'express';
import {
    acknowledgeSosController,
    getAllSosController,
    getRideSosController,
    resolveSosController,
    triggerSosController,
} from '../controllers/sosController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

router.use(requireTrustedOrigin);
router.use(authenticate);

// Participant endpoint to trigger SOS
router.post('/trigger', triggerSosController);

// Active SOS check for a specific ride
router.get('/ride/:rideId', getRideSosController);

// Admin incident management
router.get('/', authorize('Admin'), getAllSosController);
router.patch('/:id/acknowledge', authorize('Admin'), acknowledgeSosController);
router.patch('/:id/resolve', authorize('Admin'), resolveSosController);

export default router;
