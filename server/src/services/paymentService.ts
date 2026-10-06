import { Types } from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Payment, type PaymentFields, type PaymentMethod } from '../models/Payment.js';
import { Ride } from '../models/Ride.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { env } from '../config/env.js';
import { createNotification } from './notificationService.js';
import {
    sendPaymentSuccessEmail,
    sendPaymentFailedEmail,
    sendRefundProcessedEmail,
} from './emailService.js';
import { emitToUser, SOCKET_EVENTS } from './socketService.js';

export interface PaymentGatewayProvider {
    name: 'mock' | 'razorpay';
    isConfigured: boolean;
    createOrder(params: {
        amount: number;
        currency: string;
        receipt: string;
    }): Promise<{ orderId: string }>;
    verifyPayment(params: {
        orderId: string;
        paymentId: string;
        signature?: string;
    }): Promise<boolean>;
    refund(params: {
        paymentId: string;
        amount: number;
        reason?: string;
    }): Promise<{ refundId: string }>;
}

export class MockGatewayProvider implements PaymentGatewayProvider {
    readonly name = 'mock' as const;
    readonly isConfigured = true;

    async createOrder(params: {
        amount: number;
        currency: string;
        receipt: string;
    }): Promise<{ orderId: string }> {
        return {
            orderId: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
    }

    async verifyPayment(_params: {
        orderId: string;
        paymentId: string;
        signature?: string;
    }): Promise<boolean> {
        return true;
    }

    async refund(params: {
        paymentId: string;
        amount: number;
        reason?: string;
    }): Promise<{ refundId: string }> {
        return {
            refundId: `rfnd_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
    }
}

export class RazorpayGatewayProvider implements PaymentGatewayProvider {
    readonly name = 'razorpay' as const;
    readonly isConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

    async createOrder(params: {
        amount: number;
        currency: string;
        receipt: string;
    }): Promise<{ orderId: string }> {
        if (!this.isConfigured) {
            throw new AppError(
                500,
                'GATEWAY_ERROR',
                'Razorpay credentials not configured.',
            );
        }
        // Razorpay API order creation stub ready for production SDK
        return {
            orderId: `order_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
    }

    async verifyPayment(_params: {
        orderId: string;
        paymentId: string;
        signature?: string;
    }): Promise<boolean> {
        if (!this.isConfigured) return false;
        return true;
    }

    async refund(_params: {
        paymentId: string;
        amount: number;
        reason?: string;
    }): Promise<{ refundId: string }> {
        if (!this.isConfigured) {
            throw new AppError(
                500,
                'GATEWAY_ERROR',
                'Razorpay credentials not configured.',
            );
        }
        return {
            refundId: `rfnd_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
    }
}

export function getActivePaymentGateway(): PaymentGatewayProvider {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
        return new RazorpayGatewayProvider();
    }
    return new MockGatewayProvider();
}

export interface InitiatePaymentInput {
    bookingId: string;
    paymentMethod: PaymentMethod;
    simulateFailure?: boolean;
}

export async function processMockPayment(
    passenger: SafeUser,
    input: InitiatePaymentInput,
) {
    if (!Types.ObjectId.isValid(input.bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }

    const booking = await Booking.findOne({
        _id: input.bookingId,
        passengerId: passenger.id,
    });

    if (!booking) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    if (booking.status !== 'accepted') {
        throw new AppError(
            400,
            'INVALID_BOOKING_STATUS',
            `Payments can only be made for accepted bookings. Current status is '${booking.status}'.`,
        );
    }

    if (booking.paymentStatus === 'paid') {
        throw new AppError(
            409,
            'ALREADY_PAID',
            'This booking has already been paid for.',
        );
    }

    // Check if an existing paid payment record exists
    const existingPayment = await Payment.findOne({
        bookingId: booking._id,
        status: 'paid',
    });
    if (existingPayment) {
        booking.paymentStatus = 'paid';
        await booking.save();
        throw new AppError(
            409,
            'ALREADY_PAID',
            'A completed payment already exists for this booking.',
        );
    }

    const ride = await Ride.findById(booking.rideId);
    if (!ride) {
        throw new AppError(404, 'RIDE_NOT_FOUND', 'Associated ride not found.');
    }

    // Calculate amount STRICTLY server-side
    const pricePerSeat = ride.pricePerSeat ?? 250;
    const calculatedAmount = booking.seatsBooked * pricePerSeat;

    const gateway = getActivePaymentGateway();
    const order = await gateway.createOrder({
        amount: calculatedAmount,
        currency: 'INR',
        receipt: `bkg_${booking._id.toString()}`,
    });

    const txnRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    if (input.simulateFailure) {
        const failedPayment = await Payment.create({
            bookingId: booking._id,
            passengerId: passenger.id,
            driverId: ride.driverId,
            rideId: ride._id,
            amount: calculatedAmount,
            currency: 'INR',
            paymentMethod: input.paymentMethod,
            status: 'failed',
            transactionReference: txnRef,
            gateway: gateway.name,
            gatewayOrderId: order.orderId,
            auditTrail: [
                {
                    action: 'payment_attempt_failed',
                    status: 'failed',
                    timestamp: new Date(),
                    details: { reason: 'User requested failure simulation' },
                },
            ],
        });

        await createNotification(
            passenger.id,
            'payment_failed',
            'Payment Unsuccessful',
            `Your payment of ₹${calculatedAmount} for ${booking.seatsBooked} seat(s) could not be completed.`,
            {
                bookingId: booking._id.toString(),
                paymentId: failedPayment._id.toString(),
            },
        );

        emitToUser(passenger.id, SOCKET_EVENTS.PAYMENT_FAILED, {
            bookingId: booking._id.toString(),
            transactionReference: txnRef,
            reason: 'Simulated failure',
        });

        void sendPaymentFailedEmail(passenger.email, {
            passengerName: passenger.name,
            amount: calculatedAmount,
            reason: 'Simulated failure test',
        });

        return {
            success: false,
            payment: formatPayment(failedPayment),
            message: 'Payment simulation resulted in failure.',
        };
    }

    // Successful payment flow
    const payment = await Payment.create({
        bookingId: booking._id,
        passengerId: passenger.id,
        driverId: ride.driverId,
        rideId: ride._id,
        amount: calculatedAmount,
        currency: 'INR',
        paymentMethod: input.paymentMethod,
        status: 'paid',
        paidAt: new Date(),
        transactionReference: txnRef,
        gateway: gateway.name,
        gatewayOrderId: order.orderId,
        gatewayPaymentId: `pay_mock_${Date.now()}`,
        auditTrail: [
            {
                action: 'payment_completed',
                status: 'paid',
                timestamp: new Date(),
                details: {
                    method: input.paymentMethod,
                    amount: calculatedAmount,
                    gateway: gateway.name,
                },
            },
        ],
    });

    booking.paymentStatus = 'paid';
    booking.totalPrice = calculatedAmount;
    await booking.save();

    // In-app notifications
    await createNotification(
        passenger.id,
        'payment_success',
        'Payment Successful!',
        `Your payment of ₹${calculatedAmount} for ${booking.seatsBooked} seat(s) was processed successfully. Ref: ${txnRef}`,
        { bookingId: booking._id.toString(), paymentId: payment._id.toString() },
    );

    await createNotification(
        ride.driverId,
        'payment_success',
        'Passenger Payment Received',
        `${passenger.name} completed payment of ₹${calculatedAmount} for their confirmed seats.`,
        { bookingId: booking._id.toString(), rideId: ride._id.toString() },
    );

    // Real-time socket events
    emitToUser(passenger.id, SOCKET_EVENTS.PAYMENT_SUCCESS, {
        bookingId: booking._id.toString(),
        paymentId: payment._id.toString(),
        transactionReference: txnRef,
        amount: calculatedAmount,
        status: 'paid',
    });

    emitToUser(ride.driverId.toString(), SOCKET_EVENTS.PAYMENT_SUCCESS, {
        bookingId: booking._id.toString(),
        passengerId: passenger.id,
        amount: calculatedAmount,
        status: 'paid',
    });

    // Transactional email (isolated, non-blocking)
    void sendPaymentSuccessEmail(passenger.email, {
        passengerName: passenger.name,
        amount: calculatedAmount,
        transactionReference: txnRef,
        paymentMethod: input.paymentMethod,
        route: `${ride.pickup.displayName} → ${ride.destination.displayName}`,
    });

    return {
        success: true,
        payment: formatPayment(payment),
        message: 'Payment processed successfully (Demo Mode).',
    };
}

export async function getPaymentForBooking(user: SafeUser, bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    const ride = await Ride.findById(booking.rideId);
    const isPassenger = booking.passengerId.toString() === user.id;
    const isDriver = ride?.driverId.toString() === user.id;
    const isAdmin = user.role === 'Admin';

    if (!isPassenger && !isDriver && !isAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You cannot access this payment.');
    }

    const payment = await Payment.findOne({ bookingId: booking._id }).sort({
        createdAt: -1,
    });

    return payment ? formatPayment(payment) : null;
}

export async function getMyPayments(passenger: SafeUser) {
    const payments = await Payment.find({ passengerId: passenger.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    return payments.map(formatPayment);
}

export interface RefundOptions {
    reason?: string;
    cancelledByRole: 'Driver' | 'Passenger';
    hoursBeforeDeparture: number;
}

export async function processBookingRefund(
    bookingId: Types.ObjectId | string,
    options: RefundOptions,
) {
    const payment = await Payment.findOne({
        bookingId: new Types.ObjectId(bookingId.toString()),
    }).sort({ createdAt: -1 });

    if (!payment) {
        return {
            eligible: false,
            refundAmount: 0,
            status: 'no_payment_found' as const,
            note: 'No payment found for this booking.',
        };
    }

    if (payment.refundStatus === 'processed' || payment.status === 'refunded') {
        return {
            eligible: false,
            refundAmount: 0,
            status: 'already_refunded' as const,
            note: 'Payment has already been refunded.',
        };
    }

    if (payment.status !== 'paid') {
        return {
            eligible: false,
            refundAmount: 0,
            status: 'no_payment_found' as const,
            note: 'No completed payment to refund.',
        };
    }

    // Cancellation refund calculation:
    // 100% refund if cancelled by Driver or passenger cancelled >= 2 hours prior to departure
    // 50% partial refund if passenger cancelled < 2 hours prior to departure
    let refundAmount = payment.amount;
    let isPartial = false;

    if (options.cancelledByRole === 'Passenger' && options.hoursBeforeDeparture < 2) {
        refundAmount = Math.round(payment.amount * 0.5);
        isPartial = true;
    }

    const gateway = getActivePaymentGateway();
    const gatewayRefund = await gateway.refund({
        paymentId: payment.gatewayPaymentId ?? payment.transactionReference,
        amount: refundAmount,
        reason: options.reason,
    });

    const refundRef = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    payment.status = isPartial ? 'partially_refunded' : 'refunded';
    payment.refundStatus = 'processed';
    payment.refundAmount = refundAmount;
    payment.refundReference = refundRef;
    payment.refundReason = options.reason ?? 'Cancelled booking refund';
    payment.refundedAt = new Date();

    payment.auditTrail.push({
        action: 'refund_processed',
        status: payment.status,
        timestamp: new Date(),
        details: {
            refundAmount,
            refundReference: refundRef,
            gatewayRefundId: gatewayRefund.refundId,
            cancelledByRole: options.cancelledByRole,
            hoursBeforeDeparture: options.hoursBeforeDeparture,
        },
    });

    await payment.save();

    await Booking.findByIdAndUpdate(payment.bookingId, {
        $set: { paymentStatus: 'refunded' },
    });

    // In-app notification for passenger
    await createNotification(
        payment.passengerId,
        'refund_processed',
        'Refund Processed',
        `A refund of ₹${refundAmount} has been processed for your booking. Ref: ${refundRef}`,
        {
            bookingId: payment.bookingId.toString(),
            paymentId: payment._id.toString(),
            refundReference: refundRef,
        },
    );

    // Socket event
    emitToUser(payment.passengerId.toString(), SOCKET_EVENTS.REFUND_PROCESSED, {
        bookingId: payment.bookingId.toString(),
        refundAmount,
        refundReference: refundRef,
        status: payment.status,
    });

    // Email notification
    const passengerUser = await User.findById(payment.passengerId).select('name email');
    if (passengerUser) {
        void sendRefundProcessedEmail(passengerUser.email, {
            passengerName: passengerUser.name,
            amount: refundAmount,
            refundReference: refundRef,
            reason: options.reason,
        });
    }

    return {
        eligible: true,
        refundAmount,
        refundReference: refundRef,
        status: 'processed' as const,
        note: `Refund of ₹${refundAmount} processed successfully (${payment.gateway}).`,
    };
}

function formatPayment(p: PaymentFields & { _id: Types.ObjectId }) {
    return {
        id: p._id.toString(),
        bookingId: p.bookingId.toString(),
        passengerId: p.passengerId.toString(),
        driverId: p.driverId.toString(),
        rideId: p.rideId.toString(),
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionReference: p.transactionReference,
        refundStatus: p.refundStatus,
        refundAmount: p.refundAmount,
        refundReference: p.refundReference,
        refundReason: p.refundReason,
        refundedAt: p.refundedAt,
        paidAt: p.paidAt,
        gateway: p.gateway,
        createdAt: p.createdAt,
    };
}
