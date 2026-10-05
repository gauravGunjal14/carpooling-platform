import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { authenticateAccessToken } from './authService.js';
import type { SafeUser } from '../types/auth.js';
import {
    SOCKET_EVENTS,
    type SocketEventName,
    type SocketPayload,
} from '../types/socketEvents.js';

let ioInstance: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
    data: {
        user: SafeUser;
    };
}

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: env.CLIENT_ORIGIN,
            credentials: true,
            methods: ['GET', 'POST'],
        },
        pingTimeout: 20000,
        pingInterval: 25000,
    });

    // Authentication middleware: never trust client-supplied IDs or roles
    io.use(async (socket, next) => {
        try {
            const token =
                (socket.handshake.auth?.token as string | undefined) ??
                socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

            if (!token) {
                return next(new Error('AUTHENTICATION_REQUIRED'));
            }

            const safeUser = await authenticateAccessToken(token);
            socket.data.user = safeUser;
            next();
        } catch {
            next(new Error('AUTHENTICATION_FAILED'));
        }
    });

    io.on('connection', (rawSocket) => {
        const socket = rawSocket as AuthenticatedSocket;
        const user = socket.data.user;

        // Secure, isolated rooms based on verified identity
        const userRoom = `user:${user.id}`;
        const roleRoom = `role:${user.role}`;
        void socket.join(userRoom);
        void socket.join(roleRoom);

        socket.on('disconnect', () => {
            void socket.leave(userRoom);
            void socket.leave(roleRoom);
        });
    });

    ioInstance = io;
    return io;
}

export function getIO(): SocketIOServer | null {
    return ioInstance;
}

export function emitToUser<T>(userId: string, event: SocketEventName, data: T): void {
    if (!ioInstance) return;
    const payload: SocketPayload<T> = {
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        data,
    };
    ioInstance.to(`user:${userId}`).emit(event, payload);
}

export function emitToRole<T>(
    role: 'Passenger' | 'Driver' | 'Admin',
    event: SocketEventName,
    data: T,
): void {
    if (!ioInstance) return;
    const payload: SocketPayload<T> = {
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        data,
    };
    ioInstance.to(`role:${role}`).emit(event, payload);
}

export { SOCKET_EVENTS };
