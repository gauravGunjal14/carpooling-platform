import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Ride } from '../models/Ride.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import {
    createBooking,
    getRideSeatsStatus,
    cancelPassengerBooking,
    acceptBooking,
    rejectBooking,
} from './bookingService.js';
import { AppError } from '../utils/appError.js';
import type { SafeUser } from '../types/auth.js';

test.before(async () => {
    await connectDatabase();
});

test.after(async () => {
    await mongoose.disconnect();
});

test('Booking validation: rejects invalid ride IDs', async () => {
    const passenger: SafeUser = {
        id: new Types.ObjectId().toString(),
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Passenger',
        createdAt: new Date(),
    };

    await assert.rejects(
        async () => {
            await createBooking(passenger, {
                rideId: 'not-an-id',
                seatNumbers: [1],
            });
        },
        (err: unknown) => {
            return err instanceof AppError && err.code === 'VALIDATION_ERROR';
        },
    );
});

test('Booking workflow & constraint tests against MongoDB', async () => {
    // 1. Setup a driver and a passenger
    const driver = await User.create({
        name: 'Test Driver',
        email: `driver_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Driver',
        status: 'active',
    });

    const passenger1 = await User.create({
        name: 'Passenger One',
        email: `pass1_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Passenger',
        status: 'active',
    });

    const passenger2 = await User.create({
        name: 'Passenger Two',
        email: `pass2_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Passenger',
        status: 'active',
    });

    const safePassenger1: SafeUser = {
        id: passenger1._id.toString(),
        name: passenger1.name,
        email: passenger1.email,
        role: 'Passenger',
        createdAt: passenger1.createdAt,
    };

    const safePassenger2: SafeUser = {
        id: passenger2._id.toString(),
        name: passenger2.name,
        email: passenger2.email,
        role: 'Passenger',
        createdAt: passenger2.createdAt,
    };

    const safeDriver: SafeUser = {
        id: driver._id.toString(),
        name: driver.name,
        email: driver.email,
        role: 'Driver',
        createdAt: driver.createdAt,
    };

    // 2. Create a test ride with 2 seats
    const departure = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hrs in future
    const ride = await Ride.create({
        driverId: driver._id,
        pickup: {
            displayName: 'Central Station',
            searchKey: 'central station',
            latitude: 18.5204,
            longitude: 73.8567,
            point: { type: 'Point', coordinates: [73.8567, 18.5204] },
        },
        destination: {
            displayName: 'Airport Terminal',
            searchKey: 'airport terminal',
            latitude: 18.5804,
            longitude: 73.9197,
            point: { type: 'Point', coordinates: [73.9197, 18.5804] },
        },
        departureAt: departure,
        totalSeats: 2,
        availableSeats: 2,
        preferences: {
            smokingAllowed: false,
            luggage: 'standard',
            notes: 'Test trip',
        },
        womenOnly: false,
        status: 'scheduled',
    });

    const rideId = ride._id.toString();

    // 3. Driver cannot book own ride
    await assert.rejects(
        async () => {
            await createBooking(safeDriver, { rideId, seatNumbers: [1] });
        },
        (err: unknown) => err instanceof AppError && err.code === 'CANNOT_BOOK_OWN_RIDE',
    );

    // 4. Passenger 1 books Seat 1
    const booking1 = await createBooking(safePassenger1, {
        rideId,
        seatNumbers: [1],
    });
    assert.equal(booking1.status, 'pending');
    assert.deepEqual(booking1.seatNumbers, [1]);

    // Check seat status and anonymous privacy
    const seatStatus = await getRideSeatsStatus(rideId);
    assert.equal(seatStatus.totalSeats, 2);
    assert.equal(seatStatus.availableSeatsCount, 1);
    const seat1 = seatStatus.seats.find((s) => s.seatNumber === 1);
    assert.equal(seat1?.isOccupied, true);
    // Private identity information MUST NOT be present
    assert.equal('name' in (seat1?.trustSummary ?? {}), false);
    assert.equal('email' in (seat1?.trustSummary ?? {}), false);
    assert.equal(typeof seat1?.trustSummary?.trustScore, 'number');

    // 5. Duplicate active booking: Passenger 1 attempts to book again for same ride
    await assert.rejects(
        async () => {
            await createBooking(safePassenger1, { rideId, seatNumbers: [2] });
        },
        (err: unknown) => err instanceof AppError && err.code === 'DUPLICATE_BOOKING',
    );

    // 6. Overbooking / Seat unavailable: Passenger 2 attempts to book Seat 1 (already occupied)
    await assert.rejects(
        async () => {
            await createBooking(safePassenger2, { rideId, seatNumbers: [1] });
        },
        (err: unknown) => err instanceof AppError && err.code === 'SEAT_UNAVAILABLE',
    );

    // 7. Driver accepts Booking 1
    const accepted = await acceptBooking(safeDriver, booking1.id);
    assert.equal(accepted.status, 'accepted');

    // 8. Passenger 2 books Seat 2 (taking the last seat)
    const booking2 = await createBooking(safePassenger2, {
        rideId,
        seatNumbers: [2],
    });
    assert.equal(booking2.status, 'pending');

    // 9. Fully booked: now available seats is 0
    const fullStatus = await getRideSeatsStatus(rideId);
    assert.equal(fullStatus.availableSeatsCount, 0);

    // 10. Passenger 2 cancels booking -> frees up Seat 2
    const cancelled = await cancelPassengerBooking(safePassenger2, booking2.id);
    assert.equal(cancelled.status, 'cancelled');

    const statusAfterCancel = await getRideSeatsStatus(rideId);
    assert.equal(statusAfterCancel.availableSeatsCount, 1);

    // Clean up test documents
    await Booking.deleteMany({ rideId: ride._id });
    await Ride.deleteOne({ _id: ride._id });
    await User.deleteMany({ _id: { $in: [driver._id, passenger1._id, passenger2._id] } });
});

test('Concurrent overbooking: two passengers attempting final seat simultaneously', async () => {
    const driver = await User.create({
        name: 'Concurrent Driver',
        email: `driver_c_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Driver',
        status: 'active',
    });

    const pA = await User.create({
        name: 'Passenger A',
        email: `pass_a_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Passenger',
        status: 'active',
    });

    const pB = await User.create({
        name: 'Passenger B',
        email: `pass_b_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Passenger',
        status: 'active',
    });

    const ride = await Ride.create({
        driverId: driver._id,
        pickup: {
            displayName: 'A Point',
            searchKey: 'a point',
            latitude: 18.5204,
            longitude: 73.8567,
            point: { type: 'Point', coordinates: [73.8567, 18.5204] },
        },
        destination: {
            displayName: 'B Point',
            searchKey: 'b point',
            latitude: 18.5804,
            longitude: 73.9197,
            point: { type: 'Point', coordinates: [73.9197, 18.5804] },
        },
        departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        totalSeats: 1,
        availableSeats: 1,
        preferences: { smokingAllowed: false, luggage: 'standard', notes: '' },
        womenOnly: false,
        status: 'scheduled',
    });

    const userA: SafeUser = {
        id: pA._id.toString(),
        name: pA.name,
        email: pA.email,
        role: 'Passenger',
        createdAt: pA.createdAt,
    };
    const userB: SafeUser = {
        id: pB._id.toString(),
        name: pB.name,
        email: pB.email,
        role: 'Passenger',
        createdAt: pB.createdAt,
    };

    // Both attempt to book the single seat simultaneously
    const results = await Promise.allSettled([
        createBooking(userA, { rideId: ride._id.toString(), seatNumbers: [1] }),
        createBooking(userB, { rideId: ride._id.toString(), seatNumbers: [1] }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and exactly one must be rejected
    assert.equal(fulfilled.length, 1, 'Exactly one passenger should win the final seat');
    assert.equal(rejected.length, 1, 'The other passenger request should be rejected');

    // Verify database has only 1 active booking
    const activeBookings = await Booking.find({
        rideId: ride._id,
        status: { $in: ['pending', 'accepted'] },
    });
    assert.equal(activeBookings.length, 1);

    // Clean up
    await Booking.deleteMany({ rideId: ride._id });
    await Ride.deleteOne({ _id: ride._id });
    await User.deleteMany({ _id: { $in: [driver._id, pA._id, pB._id] } });
});
