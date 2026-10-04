import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Role, SafeUser } from '../types/auth.js';
import {
    cancelMyRide,
    createRide,
    getAdminRide,
    getAdminRides,
    getMyRide,
    getMyRides,
    getPassengerRide,
    searchRides,
    updateMyRide,
    type RideInput,
} from '../services/rideService.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const locationSchema = z
    .object({
        displayName: z.string().trim().min(3).max(200),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
    })
    .strict();

const rideInputSchema = z
    .object({
        pickup: locationSchema,
        destination: locationSchema,
        departureAt: z.string().datetime({ offset: true }),
        availableSeats: z.number().int().min(1).max(6),
        preferences: z
            .object({
                smokingAllowed: z.boolean().default(false),
                luggage: z.enum(['small', 'standard', 'large']).default('standard'),
                notes: z.string().trim().max(240).default(''),
            })
            .strict()
            .default({ smokingAllowed: false, luggage: 'standard', notes: '' }),
        womenOnly: z.boolean().default(false),
    })
    .strict();

const searchSchema = z
    .object({
        pickupName: z.string().trim().min(3).max(200),
        pickupLatitude: z.coerce.number().finite().min(-90).max(90),
        pickupLongitude: z.coerce.number().finite().min(-180).max(180),
        destinationName: z.string().trim().min(3).max(200),
        destinationLatitude: z.coerce.number().finite().min(-90).max(90),
        destinationLongitude: z.coerce.number().finite().min(-180).max(180),
        dateStart: z.string().datetime({ offset: true }),
        dateEnd: z.string().datetime({ offset: true }),
        departureAt: z.string().datetime({ offset: true }).optional(),
        timeWindowMinutes: z.coerce.number().int().min(15).max(360).default(60),
        requiredSeats: z.coerce.number().int().min(1).max(6).default(1),
    })
    .strict()
    .transform((input) => ({
        pickup: {
            displayName: input.pickupName,
            latitude: input.pickupLatitude,
            longitude: input.pickupLongitude,
        },
        destination: {
            displayName: input.destinationName,
            latitude: input.destinationLatitude,
            longitude: input.destinationLongitude,
        },
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
        departureAt: input.departureAt,
        timeWindowMinutes: input.timeWindowMinutes,
        requiredSeats: input.requiredSeats,
    }));

export const createRideController: RequestHandler = asyncHandler(
    async (request, response) => {
        const ride = await createRide(
            requireUser(request.authUser, 'Driver'),
            parseBody(rideInputSchema, request.body) as RideInput,
        );
        response.status(201).json({ ride });
    },
);

export const myRidesController: RequestHandler = asyncHandler(
    async (request, response) => {
        response.json({
            rides: await getMyRides(requireUser(request.authUser, 'Driver')),
        });
    },
);

export const myRideController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = parseRideId(request.params.id);
        response.json({
            ride: await getMyRide(requireUser(request.authUser, 'Driver'), id),
        });
    },
);

export const updateRideController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = parseRideId(request.params.id);
        const ride = await updateMyRide(
            requireUser(request.authUser, 'Driver'),
            id,
            parseBody(rideInputSchema, request.body) as RideInput,
        );
        response.json({ ride });
    },
);

export const cancelRideController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = parseRideId(request.params.id);
        const ride = await cancelMyRide(requireUser(request.authUser, 'Driver'), id);
        response.json({ ride });
    },
);

export const searchRidesController: RequestHandler = asyncHandler(
    async (request, response) => {
        const input = parseBody(searchSchema, request.query);
        const rides = await searchRides(
            requireUser(request.authUser, 'Passenger'),
            input,
        );
        response.json({ rides });
    },
);

export const passengerRideController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = parseRideId(request.params.id);
        const ride = await getPassengerRide(
            requireUser(request.authUser, 'Passenger'),
            id,
        );
        response.json({ ride });
    },
);

export const adminRidesController: RequestHandler = asyncHandler(
    async (_request, response) => {
        response.json({ rides: await getAdminRides() });
    },
);

export const adminRideController: RequestHandler = asyncHandler(
    async (request, response) => {
        const id = parseRideId(request.params.id);
        response.json({ ride: await getAdminRide(id) });
    },
);

function parseRideId(value: string | string[] | undefined): string {
    const result = z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .safeParse(value);
    if (!result.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }
    return result.data;
}

function requireUser(user: SafeUser | undefined, role: Role): SafeUser {
    if (!user) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }
    if (user.role !== role) {
        throw new AppError(
            403,
            'FORBIDDEN',
            'Your account does not have access to this area.',
        );
    }
    return user;
}
