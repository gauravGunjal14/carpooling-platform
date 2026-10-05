import type { RequestHandler } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { calculateUserTrust } from '../services/trustService.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMyTrustController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        const role = request.authUser.role === 'Driver' ? 'Driver' : 'Passenger';
        const profile = await calculateUserTrust(request.authUser.id, role);
        response.json({ profile });
    },
);

export const getUserTrustController: RequestHandler = asyncHandler(
    async (request, response) => {
        const userId = parseId(request.params.userId);
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');

        const role = user.role === 'Driver' ? 'Driver' : 'Passenger';
        const profile = await calculateUserTrust(user._id, role);

        // Public trust profile: safe and privacy-compliant
        response.json({
            trust: {
                score: profile.score,
                isVerified: profile.isVerified,
                completedRides: profile.completedRides,
                rating: profile.rating,
                ratingCount: profile.ratingCount,
            },
        });
    },
);

function parseId(value: string | string[] | undefined): string {
    const result = z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .safeParse(value);
    if (!result.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid identifier.');
    }
    return result.data;
}
