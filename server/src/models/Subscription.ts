import { Schema, model, type Types } from 'mongoose';

export const subscriptionStatuses = ['active', 'expired', 'cancelled'] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export interface SubscriptionFields {
    userId: Types.ObjectId;
    tier: 'pro';
    status: SubscriptionStatus;
    billingPeriod: 'monthly' | 'annual';
    startDate: Date;
    endDate: Date;
    price: number;
    currency: string;
    autoRenew: boolean;
    paymentReference: string;
    createdAt: Date;
    updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionFields>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        tier: {
            type: String,
            enum: ['pro'],
            default: 'pro',
            required: true,
        },
        status: {
            type: String,
            enum: subscriptionStatuses,
            default: 'active',
            required: true,
            index: true,
        },
        billingPeriod: {
            type: String,
            enum: ['monthly', 'annual'],
            default: 'monthly',
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        endDate: {
            type: Date,
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: 'INR',
            uppercase: true,
        },
        autoRenew: {
            type: Boolean,
            default: true,
        },
        paymentReference: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true, versionKey: false },
);

subscriptionSchema.index({ userId: 1, status: 1 });

export const Subscription = model<SubscriptionFields>('Subscription', subscriptionSchema);
