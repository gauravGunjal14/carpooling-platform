import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';
import { authenticateAccessToken, requireAnyRole } from '../services/authService.js';
import type { Role } from '../types/auth.js';

export const authenticate: RequestHandler = asyncHandler(
    async (request, _response, next) => {
        const authorization = request.header('authorization');
        if (!authorization?.startsWith('Bearer '))
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        request.authUser = await authenticateAccessToken(
            authorization.slice('Bearer '.length).trim(),
        );
        next();
    },
);

export function authorize(...roles: Role[]): RequestHandler {
    return (request, _response, next) => {
        try {
            requireAnyRole(request.authUser, roles);
            next();
        } catch (error) {
            next(error);
        }
    };
}
