import { Router } from 'express';
import {
    cancelSubscriptionController,
    getMySubscriptionController,
    upgradeSubscriptionController,
} from '../controllers/subscriptionController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

router.use(requireTrustedOrigin);
router.use(authenticate);

router.get('/me', getMySubscriptionController);
router.post('/upgrade', upgradeSubscriptionController);
router.post('/cancel', cancelSubscriptionController);

export default router;
