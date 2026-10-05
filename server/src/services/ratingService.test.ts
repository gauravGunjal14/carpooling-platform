import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Ride } from '../models/Ride.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Rating } from '../models/Rating.js';
import { submitRating, getUserRatings } from './ratingService.js';
import { calculateUserTrust } from './trustService.js';
import { cancelMyRide } from './rideService.js';
import { AppError } from '../utils/appError.js';
import type { SafeUser } from '../types/auth.js';

test.before(async () => {
    await connectDatabase();
});

test.after(async () => {
    await mongoose.disconnect();
});

test('Ratings & Trust: full lifecycle, validation, constraints, and trust calculations', async () => {
    // 1. Create a Driver and a Passenger
    const driver = await User.create({
        name: 'Rating Driver',
        email: `driver_rate_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Driver',
        status: 'active',
        driverTier: 'standard',
    });

    const passenger = await User.create({
        name: 'Rating Passenger',
        email: `pass_rate_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Passenger',
        status: 'active',
    });

    const safeDriver: SafeUser = {
        id: driver._id.toString(),
        name: driver.name,
        email: driver.email,
        role: 'Driver',
        createdAt: driver.createdAt,
    };

    const safePassenger: SafeUser = {
        id: passenger._id.toString(),
        name: passenger.name,
        email: passenger.email,
        role: 'Passenger',
        createdAt: passenger.createdAt,
    };

    // 2. Create Ride
    const ride = await Ride.create({
        driverId: driver._id,
        pickup: {
            displayName: 'Origin City',
            searchKey: 'origin city',
            latitude: 19.076,
            longitude: 72.8777,
            point: { type: 'Point', coordinates: [72.8777, 19.076] },
        },
        destination: {
            displayName: 'Destination City',
            searchKey: 'destination city',
            latitude: 18.5204,
            longitude: 73.8567,
            point: { type: 'Point', coordinates: [73.8567, 18.5204] },
        },
        departureAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        totalSeats: 3,
        availableSeats: 2,
        occupiedSeats: [1],
        preferences: { smokingAllowed: false, luggage: 'standard', notes: '' },
        womenOnly: false,
        status: 'scheduled',
    });

    // 3. Create Booking
    const booking = await Booking.create({
        rideId: ride._id,
        passengerId: passenger._id,
        seatsBooked: 1,
        seatNumbers: [1],
        status: 'accepted',
    });

    // 4. Test: Cannot rate an uncompleted ride
    await assert.rejects(
        async () => {
            await submitRating(safePassenger, {
                rideId: ride._id.toString(),
                bookingId: booking._id.toString(),
                toUserId: driver._id.toString(),
                targetRole: 'Driver',
                rating: 5,
                review: 'Great ride!',
            });
        },
        (err: unknown) => err instanceof AppError && err.code === 'RIDE_NOT_COMPLETED',
    );

    // 5. Test: Cannot rate self
    await assert.rejects(
        async () => {
            await submitRating(safePassenger, {
                rideId: ride._id.toString(),
                bookingId: booking._id.toString(),
                toUserId: passenger._id.toString(),
                targetRole: 'Passenger',
                rating: 5,
            });
        },
        (err: unknown) => err instanceof AppError && err.code === 'CANNOT_RATE_SELF',
    );

    // 6. Transition Ride and Booking to completed
    ride.status = 'completed';
    await ride.save();

    booking.status = 'completed';
    await booking.save();

    // 7. Passenger rates Driver (5 stars)
    const rating1 = await submitRating(safePassenger, {
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        toUserId: driver._id.toString(),
        targetRole: 'Driver',
        rating: 5,
        review: 'Excellent and safe driver!',
    });
    assert.equal(rating1.rating, 5);

    // 8. Test: Prevent duplicate rating
    await assert.rejects(
        async () => {
            await submitRating(safePassenger, {
                rideId: ride._id.toString(),
                bookingId: booking._id.toString(),
                toUserId: driver._id.toString(),
                targetRole: 'Driver',
                rating: 4,
            });
        },
        (err: unknown) => err instanceof AppError && err.code === 'DUPLICATE_RATING',
    );

    // 9. Driver rates Passenger (5 stars)
    const rating2 = await submitRating(safeDriver, {
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        toUserId: passenger._id.toString(),
        targetRole: 'Passenger',
        rating: 5,
        review: 'Punctual and courteous passenger.',
    });
    assert.equal(rating2.rating, 5);

    // 10. Check trust score calculation is deterministic and explainable
    const driverTrust = await calculateUserTrust(driver._id, 'Driver');
    assert.equal(typeof driverTrust.score, 'number');
    assert.ok(driverTrust.score >= 10 && driverTrust.score <= 100);
    assert.equal(driverTrust.completedRides, 1);
    assert.equal(driverTrust.rating, 5.0);
    assert.ok(driverTrust.breakdown.basePoints > 0);
    assert.ok(driverTrust.breakdown.ratingPoints > 0);

    // 11. Cleanup
    await Rating.deleteMany({ rideId: ride._id });
    await Booking.deleteMany({ rideId: ride._id });
    await Ride.deleteOne({ _id: ride._id });
    await User.deleteMany({ _id: { $in: [driver._id, passenger._id] } });
});

test('Cancellation rules: Standard Driver (30h) vs Pro Driver (12h)', async () => {
    const standardDriver = await User.create({
        name: 'Standard Driver',
        email: `std_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Driver',
        status: 'active',
        driverTier: 'standard',
    });

    const proDriver = await User.create({
        name: 'Pro Driver',
        email: `pro_${Date.now()}@example.com`,
        passwordHash: 'dummy',
        role: 'Driver',
        status: 'active',
        driverTier: 'pro',
    });

    const safeStd: SafeUser = {
        id: standardDriver._id.toString(),
        name: standardDriver.name,
        email: standardDriver.email,
        role: 'Driver',
        createdAt: standardDriver.createdAt,
    };

    const safePro: SafeUser = {
        id: proDriver._id.toString(),
        name: proDriver.name,
        email: proDriver.email,
        role: 'Driver',
        createdAt: proDriver.createdAt,
    };

    // Ride departing in 20 hours:
    // For Standard driver: within 30 hours -> Cancellation BLOCKED!
    // For Pro driver: more than 12 hours -> Cancellation ALLOWED!
    const rideStd = await Ride.create({
        driverId: standardDriver._id,
        pickup: {
            displayName: 'A',
            searchKey: 'a',
            latitude: 18.5,
            longitude: 73.8,
            point: { type: 'Point', coordinates: [73.8, 18.5] },
        },
        destination: {
            displayName: 'B',
            searchKey: 'b',
            latitude: 18.6,
            longitude: 73.9,
            point: { type: 'Point', coordinates: [73.9, 18.6] },
        },
        departureAt: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours
        totalSeats: 3,
        availableSeats: 3,
        occupiedSeats: [],
        preferences: { smokingAllowed: false, luggage: 'standard', notes: '' },
        womenOnly: false,
        status: 'scheduled',
    });

    const ridePro = await Ride.create({
        driverId: proDriver._id,
        pickup: {
            displayName: 'A',
            searchKey: 'a',
            latitude: 18.5,
            longitude: 73.8,
            point: { type: 'Point', coordinates: [73.8, 18.5] },
        },
        destination: {
            displayName: 'B',
            searchKey: 'b',
            latitude: 18.6,
            longitude: 73.9,
            point: { type: 'Point', coordinates: [73.9, 18.6] },
        },
        departureAt: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours
        totalSeats: 3,
        availableSeats: 3,
        occupiedSeats: [],
        preferences: { smokingAllowed: false, luggage: 'standard', notes: '' },
        womenOnly: false,
        status: 'scheduled',
    });

    // Standard driver attempts cancel within 20 hrs (< 30 hrs cutoff) -> must reject
    await assert.rejects(
        async () => {
            await cancelMyRide(safeStd, rideStd._id.toString());
        },
        (err: unknown) =>
            err instanceof AppError && err.code === 'CANCELLATION_WINDOW_CLOSED',
    );

    // Pro driver attempts cancel with 20 hrs (> 12 hrs cutoff) -> must succeed
    const cancelledPro = await cancelMyRide(safePro, ridePro._id.toString());
    assert.equal(cancelledPro.status, 'cancelled');

    // Cleanup
    await Ride.deleteMany({ _id: { $in: [rideStd._id, ridePro._id] } });
    await User.deleteMany({ _id: { $in: [standardDriver._id, proDriver._id] } });
});
