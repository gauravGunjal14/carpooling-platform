import { Router } from 'express';
import {
    getRidePassengersController,
    getRideSeatsController,
} from '../controllers/bookingController.js';
import {
    adminRideController,
    adminRidesController,
    cancelRideController,
    completeRideController,
    createRideController,
    myRideController,
    myRidesController,
    passengerRideController,
    searchRidesController,
    startRideController,
    updateRideController,
} from '../controllers/rideController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);
router.post('/', authorize('Driver'), createRideController);
router.get('/mine', authorize('Driver'), myRidesController);
router.get('/mine/:id', authorize('Driver'), myRideController);
router.patch('/mine/:id', authorize('Driver'), updateRideController);
router.patch('/mine/:id/cancel', authorize('Driver'), cancelRideController);
router.patch('/mine/:id/start', authorize('Driver'), startRideController);
router.patch('/mine/:id/complete', authorize('Driver'), completeRideController);
router.get('/:id/passengers', authorize('Driver'), getRidePassengersController);
router.get('/:id/seats', getRideSeatsController);
router.get('/search', authorize('Passenger'), searchRidesController);
router.get('/admin', authorize('Admin'), adminRidesController);
router.get('/admin/:id', authorize('Admin'), adminRideController);
router.get('/:id', authorize('Passenger'), passengerRideController);

export default router;
