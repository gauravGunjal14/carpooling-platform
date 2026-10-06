import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { Ride } from '../models/Ride.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import {
    processMockPayment,
    processBookingRefund,
    getPaymentForBooking,
} from './paymentService.js';
import { sendEmail } from './emailService.js';

test('Phase 9: Payment, Refund & Email Architecture', async (t) => {
    await connectDatabase();

    const timestamp = Date.now();
    const testPassengerDoc = await User.create({
        name: 'Payment Test Passenger',
        email: `pay_pass_${timestamp}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'Passenger',
        status: 'active',
    });

    const testDriverDoc = await User.create({
        name: 'Payment Test Driver',
        email: `pay_driver_${timestamp}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'Driver',
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

    const futureDate = new Date(Date.now() + 48 * 3600 * 1000);

    const testRide = await Ride.create({
        driverId: testDriverDoc._id,
        pickup: {
            displayName: 'Mumbai Central',
            searchKey: 'mumbai central',
            latitude: 18.9696,
            longitude: 72.8193,
            point: { type: 'Point', coordinates: [72.8193, 18.9696] },
        },
        destination: {
            displayName: 'Pune Station',
            searchKey: 'pune station',
            latitude: 18.5284,
            longitude: 73.8739,
            point: { type: 'Point', coordinates: [73.8739, 18.5284] },
        },
        departureAt: futureDate,
        totalSeats: 4,
        availableSeats: 2,
        occupiedSeats: [1, 2],
        pricePerSeat: 300,
        preferences: { smokingAllowed: false, luggage: 'standard', notes: '' },
        womenOnly: false,
        status: 'scheduled',
    });

    await t.test(
        'Nodemailer abstraction: gracefully handles mock sending without crashing',
        async () => {
            const result = await sendEmail({
                to: 'test@example.com',
                subject: 'Test Email',
                html: '<p>Testing</p>',
            });
            assert.equal(result, true);
        },
    );

    await t.test('Payment rejected if booking is not accepted', async () => {
        const pendingBooking = await Booking.create({
            rideId: testRide._id,
            passengerId: testPassengerDoc._id,
            seatsBooked: 2,
            seatNumbers: [1, 2],
            status: 'pending',
            totalPrice: 600,
            paymentStatus: 'unpaid',
        });

        await assert.rejects(
            async () => {
                await processMockPayment(passenger, {
                    bookingId: pendingBooking._id.toString(),
                    paymentMethod: 'upi',
                });
            },
            {
                name: 'AppError',
                message:
                    "Payments can only be made for accepted bookings. Current status is 'pending'.",
            },
        );

        await Booking.deleteOne({ _id: pendingBooking._id });
    });

    await t.test(
        'Successful mock payment updates payment and booking state',
        async () => {
            const acceptedBooking = await Booking.create({
                rideId: testRide._id,
                passengerId: testPassengerDoc._id,
                seatsBooked: 2,
                seatNumbers: [1, 2],
                status: 'accepted',
                totalPrice: 600,
                paymentStatus: 'unpaid',
            });

            try {
                const paymentResult = await processMockPayment(passenger, {
                    bookingId: acceptedBooking._id.toString(),
                    paymentMethod: 'upi',
                });

                assert.equal(paymentResult.success, true);
                assert.equal(paymentResult.payment.amount, 600); // 2 seats * 300
                assert.equal(paymentResult.payment.status, 'paid');
                assert.equal(paymentResult.payment.paymentMethod, 'upi');
                assert.match(paymentResult.payment.transactionReference, /^TXN-/);

                // Check updated booking
                const updatedBooking = await Booking.findById(acceptedBooking._id);
                assert.equal(updatedBooking?.paymentStatus, 'paid');

                // Lookup payment
                const fetched = await getPaymentForBooking(
                    passenger,
                    acceptedBooking._id.toString(),
                );
                assert.equal(fetched?.status, 'paid');
                assert.equal(fetched?.amount, 600);

                // Duplicate payment attempt should fail
                await assert.rejects(
                    async () => {
                        await processMockPayment(passenger, {
                            bookingId: acceptedBooking._id.toString(),
                            paymentMethod: 'card',
                        });
                    },
                    {
                        name: 'AppError',
                        message: 'This booking has already been paid for.',
                    },
                );

                // Test refund processing
                const refundResult = await processBookingRefund(
                    acceptedBooking._id.toString(),
                    {
                        reason: 'Driver cancelled trip',
                        cancelledByRole: 'Driver',
                        hoursBeforeDeparture: 40,
                    },
                );

                assert.equal(refundResult.eligible, true);
                assert.equal(refundResult.refundAmount, 600); // 100% refund
                assert.equal(refundResult.status, 'processed');

                // Verify payment document updated
                const refundedPayment = await Payment.findOne({
                    bookingId: acceptedBooking._id,
                });
                assert.equal(refundedPayment?.status, 'refunded');
                assert.equal(refundedPayment?.refundStatus, 'processed');
                assert.equal(refundedPayment?.refundAmount, 600);
                assert.match(refundedPayment?.refundReference ?? '', /^REF-/);

                // Verify booking updated
                const refundedBooking = await Booking.findById(acceptedBooking._id);
                assert.equal(refundedBooking?.paymentStatus, 'refunded');

                // Duplicate refund attempt should be prevented
                const duplicateRefund = await processBookingRefund(
                    acceptedBooking._id.toString(),
                    {
                        reason: 'Retry refund',
                        cancelledByRole: 'Driver',
                        hoursBeforeDeparture: 40,
                    },
                );
                assert.equal(duplicateRefund.eligible, false);
                assert.equal(duplicateRefund.status, 'already_refunded');
            } finally {
                await Payment.deleteMany({ bookingId: acceptedBooking._id });
                await Booking.deleteOne({ _id: acceptedBooking._id });
            }
        },
    );

    await t.test(
        'Simulated failure creates failed record without marking booking paid',
        async () => {
            const acceptedBooking2 = await Booking.create({
                rideId: testRide._id,
                passengerId: testPassengerDoc._id,
                seatsBooked: 1,
                seatNumbers: [1],
                status: 'accepted',
                totalPrice: 300,
                paymentStatus: 'unpaid',
            });

            try {
                const failureResult = await processMockPayment(passenger, {
                    bookingId: acceptedBooking2._id.toString(),
                    paymentMethod: 'card',
                    simulateFailure: true,
                });

                assert.equal(failureResult.success, false);
                assert.equal(failureResult.payment.status, 'failed');

                const bookingAfterFail = await Booking.findById(acceptedBooking2._id);
                assert.equal(bookingAfterFail?.paymentStatus, 'unpaid');
            } finally {
                await Payment.deleteMany({ bookingId: acceptedBooking2._id });
                await Booking.deleteOne({ _id: acceptedBooking2._id });
            }
        },
    );

    // Cleanup global test data
    await Ride.deleteOne({ _id: testRide._id });
    await User.deleteMany({ _id: { $in: [testPassengerDoc._id, testDriverDoc._id] } });
    await (await import('mongoose')).default.disconnect();
});
