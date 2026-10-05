import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
    getRideRatings,
    getUserRatings,
    submitRating,
} from '../services/ratingService.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const submitRatingSchema = z
    .object({
        rideId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ride ID'),
        bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
        toUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid target user ID'),
        targetRole: z.enum(['Driver', 'Passenger']),
        rating: z.number().int().min(1).max(5),
        review: z.string().trim().max(500).optional(),
    })
    .strict();

export const submitRatingController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        const input = parseBody(submitRatingSchema, request.body);
        const result = await submitRating(request.authUser, input);
        response.status(201).json({ rating: result });
    },
);

export const getUserRatingsController: RequestHandler = asyncHandler(
    async (request, response) => {
        const userId = parseId(request.params.userId);
        const ratings = await getUserRatings(userId);
        response.json({ ratings });
    },
);

export const getRideRatingsController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        const rideId = parseId(request.params.rideId);
        const ratings = await getRideRatings(rideId, request.authUser.id);
        response.json({ ratings });
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
