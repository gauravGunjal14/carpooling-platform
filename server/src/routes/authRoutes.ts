import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    getProfileController,
    loginController,
    logoutController,
    refreshController,
    registerController,
    updateProfileController,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';

const router = Router();
const credentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please try again later.',
        },
    },
});
const refreshLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many session refreshes. Please try again shortly.',
        },
    },
});

router.post('/register', credentialsLimiter, registerController);
router.post('/login', credentialsLimiter, loginController);
router.post('/refresh', requireTrustedOrigin, refreshLimiter, refreshController);
router.post('/logout', requireTrustedOrigin, logoutController);
router.get('/me', authenticate, getProfileController);
router.patch('/me', authenticate, updateProfileController);

export default router;
