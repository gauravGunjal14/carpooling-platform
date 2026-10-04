import type { RequestHandler } from 'express';
import { z } from 'zod';
import { searchPlaces } from '../services/locationSearchService.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const locationSearchController: RequestHandler = asyncHandler(
    async (request, response) => {
        const query = z.string().trim().min(3).max(100).safeParse(request.query.q);
        if (!query.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Enter at least three characters to search public places.',
            );
        }
        response.json({ locations: await searchPlaces(query.data) });
    },
);
