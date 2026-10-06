import { Types } from 'mongoose';
import { Subscription, type SubscriptionFields } from '../models/Subscription.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { createNotification } from './notificationService.js';

export interface UpgradeProInput {
    billingPeriod: 'monthly' | 'annual';
}

export async function getUserProSubscription(user: SafeUser) {
    const sub = await Subscription.findOne({
        userId: user.id,
        status: 'active',
        endDate: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return sub ? formatSubscription(sub) : null;
}

export async function upgradeToProSubscription(user: SafeUser, input: UpgradeProInput) {
    const isAnnual = input.billingPeriod === 'annual';
    const price = isAnnual ? 2999 : 299;
    const durationDays = isAnnual ? 365 : 30;
    const startDate = new Date();
    const endDate = new Date(Date.now() + durationDays * 24 * 3600 * 1000);
    const paymentRef = `SUB-TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Deactivate existing active subscriptions
    await Subscription.updateMany(
        { userId: user.id, status: 'active' },
        { $set: { status: 'cancelled' } },
    );

    const subscription = await Subscription.create({
        userId: user.id,
        tier: 'pro',
        status: 'active',
        billingPeriod: input.billingPeriod,
        startDate,
        endDate,
        price,
        currency: 'INR',
        autoRenew: true,
        paymentReference: paymentRef,
    });

    // Enforce Pro status on the User model
    await User.findByIdAndUpdate(user.id, {
        $set: { driverTier: 'pro' },
    });

    await createNotification(
        user.id,
        'pro_subscription',
        'Welcome to Pro Driver!',
        `Your Pro Driver subscription is now active! Enjoy priority ride listing and a relaxed 12-hour cancellation window. Ref: ${paymentRef}`,
        { subscriptionId: subscription._id.toString(), tier: 'pro' },
    );

    return formatSubscription(subscription);
}

export async function cancelProSubscription(user: SafeUser) {
    const activeSub = await Subscription.findOne({
        userId: user.id,
        status: 'active',
    });

    if (!activeSub) {
        throw new AppError(
            404,
            'NO_ACTIVE_SUBSCRIPTION',
            'No active Pro subscription found.',
        );
    }

    activeSub.status = 'cancelled';
    activeSub.autoRenew = false;
    await activeSub.save();

    // Revert tier on user
    await User.findByIdAndUpdate(user.id, {
        $set: { driverTier: 'standard' },
    });

    await createNotification(
        user.id,
        'pro_subscription',
        'Pro Subscription Cancelled',
        'Your Pro Driver membership has been cancelled and will not renew.',
        { subscriptionId: activeSub._id.toString() },
    );

    return formatSubscription(activeSub);
}

function formatSubscription(s: SubscriptionFields & { _id: Types.ObjectId }) {
    return {
        id: s._id.toString(),
        userId: s.userId.toString(),
        tier: s.tier,
        status: s.status,
        billingPeriod: s.billingPeriod,
        startDate: s.startDate,
        endDate: s.endDate,
        price: s.price,
        currency: s.currency,
        autoRenew: s.autoRenew,
        paymentReference: s.paymentReference,
        createdAt: s.createdAt,
    };
}
