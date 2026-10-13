import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
    // Standard browsers do not include an Origin header on same-origin/safe GET or HEAD requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        next();
        return;
    }

    const origin = request.header('origin');
    const referer = request.header('referer');

    let requestOrigin: string | null = null;
    if (origin) {
        requestOrigin = origin;
    } else if (referer) {
        try {
            requestOrigin = new URL(referer).origin;
        } catch {
            requestOrigin = null;
        }
    }

    if (requestOrigin && requestOrigin !== env.CLIENT_ORIGIN) {
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
