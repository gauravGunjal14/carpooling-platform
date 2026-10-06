import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sosEmergencyTypes, sosStatuses } from '../models/SosAlert.js';
import {
    acknowledgeSosAlert,
    getAllSosIncidents,
    getRideActiveSos,
    resolveSosAlert,
    triggerSosAlert,
} from '../services/sosService.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const triggerSosSchema = z
    .object({
        rideId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ride ID'),
        emergencyType: z.enum(sosEmergencyTypes),
        message: z.string().trim().max(500).optional(),
        location: z
            .object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180),
                accuracy: z.number().optional(),
            })
            .optional(),
    })
    .strict();

const resolveSosSchema = z
    .object({
        status: z.enum(['resolved', 'false_alarm']),
        resolutionNotes: z.string().trim().max(500).optional(),
    })
    .strict();

function requireAuth(user: SafeUser | undefined): SafeUser {
    if (!user) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }
    return user;
}

export const triggerSosController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const input = parseBody(triggerSosSchema, request.body);
        const alert = await triggerSosAlert(user, input);
        response.status(201).json({ alert });
    },
);

export const acknowledgeSosController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Admin') {
            throw new AppError(
                403,
                'FORBIDDEN',
                'Only administrators can acknowledge SOS alerts.',
            );
        }

        const alert = await acknowledgeSosAlert(user, String(request.params.id));
        response.json({ alert });
    },
);

export const resolveSosController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Admin') {
            throw new AppError(
                403,
                'FORBIDDEN',
                'Only administrators can resolve SOS alerts.',
            );
        }

        const input = parseBody(resolveSosSchema, request.body);
        const alert = await resolveSosAlert(user, String(request.params.id), input);
        response.json({ alert });
    },
);

export const getRideSosController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const alert = await getRideActiveSos(user, String(request.params.rideId));
        response.json({ alert });
    },
);

export const getAllSosController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Admin') {
            throw new AppError(
                403,
                'FORBIDDEN',
                'Only administrators can view all SOS incidents.',
            );
        }

        const statusParam = request.query.status as string | undefined;
        const validStatus = (sosStatuses as readonly string[]).includes(statusParam ?? '')
            ? (statusParam as any)
            : undefined;

        const alerts = await getAllSosIncidents({
            status: validStatus,
            limit: 50,
        });

        response.json({ alerts });
    },
);
