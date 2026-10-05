import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
    acceptBooking,
    cancelPassengerBooking,
    createBooking,
    getBookingDetails,
    getDriverBookingRequests,
    getPassengerBookings,
    getRideConfirmedPassengers,
    getRideSeatsStatus,
    rejectBooking,
} from '../services/bookingService.js';
import type { Role, SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const createBookingSchema = z
    .object({
        rideId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ride ID'),
        seatNumbers: z.array(z.number().int().min(1).max(6)).min(1).max(6),
    })
    .strict();

const cancelBookingSchema = z
    .object({
        reason: z.string().trim().max(300).optional(),
    })
    .strict();

const rejectBookingSchema = z
    .object({
        reason: z.string().trim().max(300).optional(),
    })
    .strict();

export const createBookingController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Passenger');
        const input = parseBody(createBookingSchema, request.body);
        const booking = await createBooking(user, input);
        response.status(201).json({ booking });
    },
);

export const getMyBookingsController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Passenger');
        const bookings = await getPassengerBookings(user);
        response.json({ bookings });
    },
);

export const getBookingController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const id = parseId(request.params.id);
        const booking = await getBookingDetails(user, id);
        response.json({ booking });
    },
);

export const cancelBookingController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Passenger');
        const id = parseId(request.params.id);
        const body = parseBody(cancelBookingSchema, request.body ?? {});
        const result = await cancelPassengerBooking(user, id, body.reason);
        response.json({ booking: result });
    },
);

export const getDriverRequestsController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Driver');
        const rideId =
            typeof request.query.rideId === 'string' ? request.query.rideId : undefined;
        const requests = await getDriverBookingRequests(user, rideId);
        response.json({ requests });
    },
);

export const acceptBookingController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Driver');
        const id = parseId(request.params.id);
        const result = await acceptBooking(user, id);
        response.json({ booking: result });
    },
);

export const rejectBookingController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Driver');
        const id = parseId(request.params.id);
        const body = parseBody(rejectBookingSchema, request.body ?? {});
        const result = await rejectBooking(user, id, body.reason);
        response.json({ booking: result });
    },
);

export const getRidePassengersController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireUser(request.authUser, 'Driver');
        const rideId = parseId(request.params.id);
        const passengers = await getRideConfirmedPassengers(user, rideId);
        response.json({ passengers });
    },
);

export const getRideSeatsController: RequestHandler = asyncHandler(
    async (request, response) => {
        const rideId = parseId(request.params.id);
        const currentUserId = request.authUser?.id;
        const result = await getRideSeatsStatus(rideId, currentUserId);
        response.json(result);
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

function requireAuth(user: SafeUser | undefined): SafeUser {
    if (!user) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }
    return user;
}

function requireUser(user: SafeUser | undefined, role: Role): SafeUser {
    const auth = requireAuth(user);
    if (auth.role !== role) {
        throw new AppError(
            403,
            'FORBIDDEN',
            'Your account does not have access to this area.',
        );
    }
    return auth;
}
