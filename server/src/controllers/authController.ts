import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
    login,
    register,
    revokeSession,
    rotateSession,
} from '../services/authService.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody, passwordSchema } from '../utils/validation.js';
import { toSafeUser } from '../utils/userResponse.js';

const registerSchema = z
    .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(254),
        password: passwordSchema,
        role: z.enum(['Passenger', 'Driver']).default('Passenger'),
    })
    .strict();

const loginSchema = z
    .object({
        email: z.string().trim().email().max(254),
        password: z
            .string()
            .min(1)
            .max(72)
            .refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
    })
    .strict();

const profileSchema = z.object({ name: z.string().trim().min(2).max(80) }).strict();

export const registerController: RequestHandler = asyncHandler(
    async (request, response) => {
        const input = parseBody(registerSchema, request.body);
        const result = await register(input, response);
        response.status(201).json(result);
    },
);

export const loginController: RequestHandler = asyncHandler(async (request, response) => {
    const input = parseBody(loginSchema, request.body);
    response.json(await login(input, response));
});

export const refreshController: RequestHandler = asyncHandler(
    async (request, response) => {
        response.json(await rotateSession(request.cookies?.wayfare_refresh, response));
    },
);

export const logoutController: RequestHandler = asyncHandler(
    async (request, response) => {
        await revokeSession(request.cookies?.wayfare_refresh, response);
        response.status(204).end();
    },
);

export const getProfileController: RequestHandler = (request, response) => {
    if (!request.authUser)
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    response.json({ user: request.authUser });
};

export const updateProfileController: RequestHandler = asyncHandler(
    async (request, response) => {
        const input = parseBody(profileSchema, request.body);
        const currentUser: SafeUser | undefined = request.authUser;
        if (!currentUser)
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        const user = await User.findOneAndUpdate(
            { _id: currentUser.id, status: 'active' },
            { $set: { name: input.name } },
            { returnDocument: 'after', runValidators: true },
        );
        if (!user)
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        response.json({ user: toSafeUser(user) });
    },
);
