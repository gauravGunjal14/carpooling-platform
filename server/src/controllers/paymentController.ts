import type { RequestHandler } from 'express';
import { z } from 'zod';
import { paymentMethods } from '../models/Payment.js';
import {
    createBookingPaymentOrder,
    getPaymentForBooking,
    getMyPayments,
    processMockPayment,
    recordFailedPayment,
    verifyAndConfirmBookingPayment,
} from '../services/paymentService.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validation.js';

const mockPaymentSchema = z
    .object({
        bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
        paymentMethod: z.enum(paymentMethods),
        simulateFailure: z.boolean().optional(),
    })
    .strict();

const createOrderSchema = z
    .object({
        bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
    })
    .strict();

const verifyPaymentSchema = z
    .object({
        bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
        razorpayOrderId: z.string().min(1, 'Order ID is required'),
        razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
        razorpaySignature: z.string().optional(),
        paymentMethod: z.enum(paymentMethods).optional(),
    })
    .strict();

const paymentFailedSchema = z
    .object({
        bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
        reason: z.string().optional(),
    })
    .strict();

function requireAuth(user: SafeUser | undefined): SafeUser {
    if (!user) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }
    return user;
}

export const processMockPaymentController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Passenger') {
            throw new AppError(403, 'FORBIDDEN', 'Only passengers can make payments.');
        }

        const input = parseBody(mockPaymentSchema, request.body);
        const result = await processMockPayment(user, input);
        response.status(result.success ? 200 : 400).json(result);
    },
);

export const getBookingPaymentController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        const bookingId = String(request.params.bookingId);
        const payment = await getPaymentForBooking(user, bookingId);
        response.json({ payment });
    },
);

export const getMyPaymentsController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Passenger') {
            throw new AppError(403, 'FORBIDDEN', 'Only passengers have payment history.');
        }

        const payments = await getMyPayments(user);
        response.json({ payments });
    },
);

export const paymentWebhookController: RequestHandler = asyncHandler(
    async (request, response) => {
        // Razorpay / gateway webhook receiver stub
        // Logs signature and payload for future real gateway hook
        response.json({ status: 'received', message: 'Webhook endpoint active' });
    },
);

export const createPaymentOrderController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Passenger') {
            throw new AppError(
                403,
                'FORBIDDEN',
                'Only passengers can initiate payments.',
            );
        }

        const input = parseBody(createOrderSchema, request.body);
        const result = await createBookingPaymentOrder(user, input);
        response.status(200).json(result);
    },
);

export const verifyPaymentController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Passenger') {
            throw new AppError(403, 'FORBIDDEN', 'Only passengers can verify payments.');
        }

        const input = parseBody(verifyPaymentSchema, request.body);
        const result = await verifyAndConfirmBookingPayment(user, input);
        response.status(200).json(result);
    },
);

export const paymentFailedController: RequestHandler = asyncHandler(
    async (request, response) => {
        const user = requireAuth(request.authUser);
        if (user.role !== 'Passenger') {
            throw new AppError(
                403,
                'FORBIDDEN',
                'Only passengers can record payment outcomes.',
            );
        }

        const input = parseBody(paymentFailedSchema, request.body);
        const result = await recordFailedPayment(user, input.bookingId, input.reason);
        response.status(200).json(result ?? { success: true });
    },
);
