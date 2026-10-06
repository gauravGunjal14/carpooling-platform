import { Schema, model, type Types } from 'mongoose';

export const paymentMethods = ['upi', 'gpay', 'phonepe', 'card', 'netbanking'] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentStatuses = [
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled',
    'refunded',
    'partially_refunded',
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

export const refundStatuses = [
    'not_requested',
    'pending',
    'processed',
    'failed',
] as const;

export type RefundStatus = (typeof refundStatuses)[number];

export interface PaymentAuditEntry {
    action: string;
    status: string;
    timestamp: Date;
    details?: Record<string, unknown>;
}

export interface PaymentFields {
    bookingId: Types.ObjectId;
    passengerId: Types.ObjectId;
    driverId: Types.ObjectId;
    rideId: Types.ObjectId;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    transactionReference: string;
    refundStatus: RefundStatus;
    refundAmount: number;
    refundReference?: string;
    refundReason?: string;
    refundedAt?: Date;
    paidAt?: Date;
    gateway: 'mock' | 'razorpay';
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    auditTrail: PaymentAuditEntry[];
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new Schema<PaymentFields>(
    {
        bookingId: {
            type: Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            index: true,
        },
        passengerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        driverId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        rideId: {
            type: Schema.Types.ObjectId,
            ref: 'Ride',
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            default: 'INR',
            trim: true,
            uppercase: true,
        },
        paymentMethod: {
            type: String,
            enum: paymentMethods,
            required: true,
        },
        status: {
            type: String,
            enum: paymentStatuses,
            default: 'pending',
            required: true,
            index: true,
        },
        transactionReference: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        refundStatus: {
            type: String,
            enum: refundStatuses,
            default: 'not_requested',
            required: true,
            index: true,
        },
        refundAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        refundReference: {
            type: String,
            trim: true,
        },
        refundReason: {
            type: String,
            trim: true,
            maxlength: 300,
        },
        refundedAt: Date,
        paidAt: Date,
        gateway: {
            type: String,
            enum: ['mock', 'razorpay'],
            default: 'mock',
            required: true,
        },
        gatewayOrderId: String,
        gatewayPaymentId: String,
        auditTrail: [
            {
                action: { type: String, required: true },
                status: { type: String, required: true },
                timestamp: { type: Date, default: Date.now },
                details: { type: Schema.Types.Mixed },
                _id: false,
            },
        ],
    },
    { timestamps: true, versionKey: false },
);

paymentSchema.index({ passengerId: 1, createdAt: -1 });
paymentSchema.index({ driverId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = model<PaymentFields>('Payment', paymentSchema);
