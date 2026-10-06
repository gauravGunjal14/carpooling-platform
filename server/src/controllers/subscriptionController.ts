import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
    cancelProSubscription,
    getUserProSubscription,
    upgradeToProSubscription,
} from '../services/subscriptionService.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const upgradeSchema = z
    .object({
        billingPeriod: z.enum(['monthly', 'annual']).default('monthly'),
    })
    .strict();

function requireAuth(user: SafeUser | undefined): SafeUser {
    if (!user) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }
    return user;
}

export const getMySubscriptionController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const subscription = await getUserProSubscription(user);
        response.json({ subscription });
    },
);

export const upgradeSubscriptionController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const input = parseBody(upgradeSchema, request.body ?? {});
        const subscription = await upgradeToProSubscription(user, input);
        response.status(201).json({ subscription });
    },
);

export const cancelSubscriptionController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const subscription = await cancelProSubscription(user);
        response.json({ subscription });
    },
);
