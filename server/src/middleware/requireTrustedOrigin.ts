import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
    if (request.header('origin') !== env.CLIENT_ORIGIN) {
        next(
            new AppError(
                403,
                'UNTRUSTED_ORIGIN',
                'This request did not come from the configured application origin.',
            ),
        );
        return;
    }
    next();
};
