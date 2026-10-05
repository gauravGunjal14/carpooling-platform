import { Router } from 'express';
import {
    getRideRatingsController,
    getUserRatingsController,
    submitRatingController,
} from '../controllers/ratingController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

router.use(requireTrustedOrigin);
router.use(authenticate);

router.post('/', submitRatingController);
router.get('/user/:userId', getUserRatingsController);
router.get('/ride/:rideId', getRideRatingsController);

export default router;
