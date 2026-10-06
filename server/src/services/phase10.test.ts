import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Booking } from '../models/Booking.js';
import { Ride } from '../models/Ride.js';
import { SosAlert } from '../models/SosAlert.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import {
    triggerSosAlert,
    acknowledgeSosAlert,
    resolveSosAlert,
    getRideActiveSos,
} from './sosService.js';
import {
    upgradeToProSubscription,
    cancelProSubscription,
    getUserProSubscription,
} from './subscriptionService.js';

test('Phase 10: SOS Emergency System & Pro Subscriptions', async (t) => {
    await connectDatabase();

    const timestamp = Date.now();
    const testPassengerDoc = await User.create({
        name: 'Phase 10 Passenger',
        email: `p10_pass_${timestamp}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'Passenger',
        status: 'active',
    });

    const testDriverDoc = await User.create({
        name: 'Phase 10 Driver',
        email: `p10_driver_${timestamp}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'Driver',
        status: 'active',
        driverTier: 'standard',
    });

    const testAdminDoc = await User.create({
        name: 'Phase 10 Admin',
        email: `p10_admin_${timestamp}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'Admin',
        status: 'active',
    });

    const outsiderDoc = await User.create({
        name: 'Phase 10 Outsider',
        email: `p10_out_${timestamp}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'Passenger',
        status: 'active',
    });

    const passenger: SafeUser = {
        id: testPassengerDoc._id.toString(),
        name: testPassengerDoc.name,
        email: testPassengerDoc.email,
        role: 'Passenger',
        driverTier: 'standard',
    };

    const driver: SafeUser = {
        id: testDriverDoc._id.toString(),
        name: testDriverDoc.name,
        email: testDriverDoc.email,
        role: 'Driver',
        driverTier: 'standard',
    };

    const admin: SafeUser = {
        id: testAdminDoc._id.toString(),
        name: testAdminDoc.name,
        email: testAdminDoc.email,
        role: 'Admin',
        driverTier: 'standard',
    };

    const outsider: SafeUser = {
        id: outsiderDoc._id.toString(),
        name: outsiderDoc.name,
        email: outsiderDoc.email,
        role: 'Passenger',
        driverTier: 'standard',
    };

    const testRide = await Ride.create({
        driverId: testDriverDoc._id,
        pickup: {
            displayName: 'Andheri Station',
            searchKey: 'andheri station',
            latitude: 19.1197,
            longitude: 72.8464,
        },
        destination: {
            displayName: 'Bandra Kurla Complex',
            searchKey: 'bandra kurla complex',
            latitude: 19.0657,
            longitude: 72.8687,
        },
        departureAt: new Date(Date.now() + 2 * 3600 * 1000),
        totalSeats: 4,
        availableSeats: 3,
        pricePerSeat: 250,
        preferences: {
            smokingAllowed: false,
            luggage: 'standard',
            notes: 'Test trip',
        },
        womenOnly: false,
        status: 'scheduled',
    });

    // Create an accepted booking for the passenger
    const testBooking = await Booking.create({
        rideId: testRide._id,
        passengerId: testPassengerDoc._id,
        seatsBooked: 1,
        seatNumbers: [1],
        status: 'accepted',
        totalPrice: 250,
        paymentStatus: 'paid',
    });

    await t.test('1. Unauthorized user cannot trigger SOS for the ride', async () => {
        await assert.rejects(
            async () => {
                await triggerSosAlert(outsider, {
                    rideId: testRide._id.toString(),
                    emergencyType: 'unsafe_behavior',
                    message: 'Im not even on this ride!',
                });
            },
            {
                name: 'AppError',
                message:
                    'Only confirmed passengers or the driver of this ride can trigger an emergency SOS alert.',
            },
        );
    });

    let createdSosId = '';

    await t.test(
        '2. Confirmed passenger can trigger SOS alert with location',
        async () => {
            const result = await triggerSosAlert(passenger, {
                rideId: testRide._id.toString(),
                emergencyType: 'unsafe_behavior',
                message: 'Vehicle experiencing suspicious deviation from route.',
                location: {
                    latitude: 19.1,
                    longitude: 72.85,
                },
            });

            assert.equal(result.rideId, testRide._id.toString());
            assert.equal(result.triggeredBy, passenger.id);
            assert.equal(result.role, 'Passenger');
            assert.equal(result.emergencyType, 'unsafe_behavior');
            assert.equal(result.status, 'triggered');
            assert.ok(result.location);
            assert.equal(result.location?.latitude, 19.1);

            createdSosId = result.id;

            // Verify active SOS retrieval
            const active = await getRideActiveSos(passenger, testRide._id.toString());
            assert.ok(active);
            assert.equal(active?.id, createdSosId);
        },
    );

    await t.test('3. Admin can acknowledge the SOS incident', async () => {
        const acknowledged = await acknowledgeSosAlert(admin, createdSosId);

        assert.equal(acknowledged.status, 'acknowledged');
        assert.ok(acknowledged.acknowledgedAt);
    });

    await t.test('4. Admin can resolve the SOS incident with notes', async () => {
        const resolved = await resolveSosAlert(admin, createdSosId, {
            status: 'resolved',
            resolutionNotes: 'Contacted driver and passenger. Situation secured safely.',
        });

        assert.equal(resolved.status, 'resolved');
        assert.equal(
            resolved.resolutionNotes,
            'Contacted driver and passenger. Situation secured safely.',
        );
        assert.ok(resolved.resolvedAt);

        // Verify active SOS is now null for this ride
        const activeAfterResolve = await getRideActiveSos(
            passenger,
            testRide._id.toString(),
        );
        assert.equal(activeAfterResolve, null);
    });

    await t.test('5. Driver can upgrade to Pro subscription and tier syncs', async () => {
        const sub = await upgradeToProSubscription(driver, {
            billingPeriod: 'monthly',
        });

        assert.equal(sub.userId, driver.id);
        assert.equal(sub.tier, 'pro');
        assert.equal(sub.status, 'active');
        assert.equal(sub.price, 299);

        // Verify User document updated
        const updatedUser = await User.findById(driver.id);
        assert.equal(updatedUser?.driverTier, 'pro');

        const activeSub = await getUserProSubscription(driver);
        assert.ok(activeSub);
        assert.equal(activeSub?.tier, 'pro');
    });

    await t.test(
        '6. Driver can cancel Pro subscription and tier reverts to standard',
        async () => {
            const cancelled = await cancelProSubscription(driver);
            assert.equal(cancelled.status, 'cancelled');

            const updatedUser = await User.findById(driver.id);
            assert.equal(updatedUser?.driverTier, 'standard');
        },
    );

    // Clean up
    await SosAlert.deleteMany({ rideId: testRide._id });
    await Subscription.deleteMany({ userId: driver.id });
    await Booking.deleteMany({ _id: testBooking._id });
    await Ride.deleteMany({ _id: testRide._id });
    await User.deleteMany({
        _id: {
            $in: [
                testPassengerDoc._id,
                testDriverDoc._id,
                testAdminDoc._id,
                outsiderDoc._id,
            ],
        },
    });
});
