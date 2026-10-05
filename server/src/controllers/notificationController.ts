import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
    getUnreadCount,
    getUserNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../services/notificationService.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMyNotificationsController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        const notifications = await getUserNotifications(request.authUser.id);
        const unreadCount = await getUnreadCount(request.authUser.id);
        response.json({ notifications, unreadCount });
    },
);

export const markNotificationReadController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        const id = parseId(request.params.id);
        const success = await markNotificationAsRead(request.authUser.id, id);
        response.json({ success });
    },
);

export const markAllNotificationsReadController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        await markAllNotificationsAsRead(request.authUser.id);
        response.json({ success: true });
    },
);

export const getUnreadCountController: RequestHandler = asyncHandler(
    async (request, response) => {
        if (!request.authUser) {
            throw new AppError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Please sign in to continue.',
            );
        }
        const count = await getUnreadCount(request.authUser.id);
        response.json({ unreadCount: count });
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
