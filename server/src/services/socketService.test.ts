import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { initializeSocket, emitToUser, SOCKET_EVENTS } from './socketService.js';
import { User } from '../models/User.js';
import { connectDatabase } from '../config/database.js';
import mongoose from 'mongoose';

test.before(async () => {
    await connectDatabase();
});

test.after(async () => {
    await mongoose.disconnect();
});

test('Socket.io authentication, isolation, and targeted delivery', async () => {
    // 1. Setup server
    const httpServer = createServer();
    const io = initializeSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    const socketUrl = `http://localhost:${port}`;

    // 2. Test unauthenticated connection is rejected
    await new Promise<void>((resolve, reject) => {
        const client = ClientSocket(socketUrl, {
            transports: ['websocket'],
            reconnection: false,
        });
        client.on('connect', () => {
            client.disconnect();
            reject(new Error('Unauthenticated socket should not have connected'));
        });
        client.on('connect_error', (err) => {
            assert.match(err.message, /AUTHENTICATION/);
            client.disconnect();
            resolve();
        });
    });

    // 3. Create two test users in MongoDB
    const user1 = await User.create({
        name: 'Socket User One',
        email: `sock1_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Passenger',
        status: 'active',
    });

    const user2 = await User.create({
        name: 'Socket User Two',
        email: `sock2_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Driver',
        status: 'active',
    });

    const token1 = jwt.sign({ role: user1.role }, env.JWT_ACCESS_SECRET, {
        subject: user1.id,
        issuer: 'wayfare',
        audience: 'wayfare-client',
        expiresIn: 300,
    });

    const token2 = jwt.sign({ role: user2.role }, env.JWT_ACCESS_SECRET, {
        subject: user2.id,
        issuer: 'wayfare',
        audience: 'wayfare-client',
        expiresIn: 300,
    });

    // 4. Connect both authenticated clients
    const client1: ClientSocketType = await new Promise((resolve, reject) => {
        const c = ClientSocket(socketUrl, {
            auth: { token: token1 },
            transports: ['websocket'],
            reconnection: false,
        });
        c.on('connect', () => resolve(c));
        c.on('connect_error', reject);
    });

    const client2: ClientSocketType = await new Promise((resolve, reject) => {
        const c = ClientSocket(socketUrl, {
            auth: { token: token2 },
            transports: ['websocket'],
            reconnection: false,
        });
        c.on('connect', () => resolve(c));
        c.on('connect_error', reject);
    });

    assert.equal(client1.connected, true);
    assert.equal(client2.connected, true);

    // 5. Test targeted emission: emit to user1 only
    let client1Received = false;
    let client2Received = false;

    client1.on(SOCKET_EVENTS.BOOKING_ACCEPTED, (payload) => {
        client1Received = true;
        assert.equal(payload.data.bookingId, 'test-123');
    });

    client2.on(SOCKET_EVENTS.BOOKING_ACCEPTED, () => {
        client2Received = true;
    });

    emitToUser(user1.id, SOCKET_EVENTS.BOOKING_ACCEPTED, { bookingId: 'test-123' });

    // Wait 150ms for message delivery
    await new Promise((r) => setTimeout(r, 150));

    assert.equal(
        client1Received,
        true,
        'User 1 should receive event intended for User 1',
    );
    assert.equal(
        client2Received,
        false,
        'User 2 MUST NOT receive event intended for User 1',
    );

    // 6. Cleanup
    client1.disconnect();
    client2.disconnect();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
});
