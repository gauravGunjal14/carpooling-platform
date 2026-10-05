import { Router } from 'express';
import {
    getMyNotificationsController,
    getUnreadCountController,
    markAllNotificationsReadController,
    markNotificationReadController,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();

router.use(requireTrustedOrigin);
router.use(authenticate);

router.get('/', getMyNotificationsController);
router.get('/unread-count', getUnreadCountController);
router.patch('/read-all', markAllNotificationsReadController);
router.patch('/:id/read', markNotificationReadController);

export default router;
