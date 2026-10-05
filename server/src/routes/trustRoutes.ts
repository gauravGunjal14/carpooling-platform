import { Router } from 'express';
import {
    getMyTrustController,
    getUserTrustController,
} from '../controllers/trustController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

router.use(requireTrustedOrigin);
router.use(authenticate);

router.get('/me', getMyTrustController);
router.get('/user/:userId', getUserTrustController);

export default router;
