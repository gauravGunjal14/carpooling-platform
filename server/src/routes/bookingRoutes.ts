import { Router } from 'express';
import {
    acceptBookingController,
    cancelBookingController,
    createBookingController,
    getBookingController,
    getDriverRequestsController,
    getMyBookingsController,
    rejectBookingController,
} from '../controllers/bookingController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

router.use(requireTrustedOrigin);
router.use(authenticate);

// User bookings endpoint
router.get('/mine', getMyBookingsController);
router.post('/', authorize('Passenger'), createBookingController);
router.patch('/:id/cancel', authorize('Passenger'), cancelBookingController);

// Driver endpoints
router.get('/driver/requests', authorize('Driver'), getDriverRequestsController);
router.patch('/:id/accept', authorize('Driver'), acceptBookingController);
router.patch('/:id/reject', authorize('Driver'), rejectBookingController);

// Shared/detail endpoint
router.get('/:id', getBookingController);

export default router;
