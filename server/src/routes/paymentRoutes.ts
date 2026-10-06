import { Router } from 'express';
import {
    getBookingPaymentController,
    getMyPaymentsController,
    paymentWebhookController,
    processMockPaymentController,
} from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

// Webhook endpoint (unauthenticated for gateway callbacks)
router.post('/webhook', paymentWebhookController);

router.use(requireTrustedOrigin);
router.use(authenticate);

// Passenger payment actions
router.post('/mock', authorize('Passenger'), processMockPaymentController);
router.get('/my', authorize('Passenger'), getMyPaymentsController);

// Authenticated booking payment lookup
router.get('/booking/:bookingId', getBookingPaymentController);

export default router;
