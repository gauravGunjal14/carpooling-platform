import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/appError.js';

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    _next,
) => {
    if (error instanceof AppError) {
        response
            .status(error.status)
            .json({ error: { code: error.code, message: error.message } });
        return;
    }
    if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.too.large'
    ) {
        response.status(413).json({
            error: {
                code: 'REQUEST_TOO_LARGE',
                message: 'Request body is too large.',
            },
        });
        return;
    }
    if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.parse.failed'
    ) {
        response.status(400).json({
            error: {
                code: 'INVALID_JSON',
                message: 'Request body must contain valid JSON.',
            },
        });
        return;
    }
    console.error('Unhandled request error', error);
    response.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong. Please try again.',
        },
    });
};
