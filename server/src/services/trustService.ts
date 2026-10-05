import { Types } from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Rating } from '../models/Rating.js';
import { Ride } from '../models/Ride.js';
import { VerificationSubmission } from '../models/VerificationSubmission.js';

export interface TrustScoreBreakdown {
    basePoints: number;
    verificationPoints: number;
    completedRidesPoints: number;
    ratingPoints: number;
    cancellationDeduction: number;
}

export interface UserTrustProfile {
    score: number;
    isVerified: boolean;
    completedRides: number;
    rating: number;
    ratingCount: number;
    breakdown: TrustScoreBreakdown;
}

export interface AnonymousSeatTrust {
    trustScore: number;
    isVerified: boolean;
    completedRides: number;
    rating: number;
}

export async function calculateUserTrust(
    userId: string | Types.ObjectId,
    role: 'Passenger' | 'Driver',
): Promise<UserTrustProfile> {
    const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const [verificationExists, ratingsAgg, completedRidesCount, cancellationsCount] =
        await Promise.all([
            // 1. Verification
            VerificationSubmission.exists({
                userId: objectId,
                status: 'approved',
            }),

            // 2. Ratings received
            Rating.aggregate<{ _id: null; avgRating: number; count: number }>([
                { $match: { toUserId: objectId } },
                {
                    $group: {
                        _id: null,
                        avgRating: { $avg: '$rating' },
                        count: { $sum: 1 },
                    },
                },
            ]),

            // 3. Completed rides
            role === 'Driver'
                ? Ride.countDocuments({ driverId: objectId, status: 'completed' })
                : Booking.countDocuments({ passengerId: objectId, status: 'completed' }),

            // 4. Cancellations
            role === 'Driver'
                ? Ride.countDocuments({ driverId: objectId, status: 'cancelled' })
                : Booking.countDocuments({ passengerId: objectId, status: 'cancelled' }),
        ]);

    const isVerified = Boolean(verificationExists);
    const ratingStats = ratingsAgg[0];
    const ratingCount = ratingStats?.count ?? 0;
    const averageRating =
        ratingCount > 0 ? Math.round(ratingStats.avgRating * 10) / 10 : 5.0;

    // Deterministic calculation
    const basePoints = 50;
    const verificationPoints = isVerified ? 20 : 0;
    const completedRidesPoints = Math.min(20, completedRidesCount * 2);

    let ratingPoints = 5;
    if (ratingCount > 0) {
        ratingPoints = Math.max(-20, Math.min(20, Math.round((averageRating - 3) * 10)));
    }

    const cancellationDeduction = Math.min(20, cancellationsCount * 5);

    const rawScore =
        basePoints +
        verificationPoints +
        completedRidesPoints +
        ratingPoints -
        cancellationDeduction;

    const finalScore = Math.max(10, Math.min(100, rawScore));

    return {
        score: finalScore,
        isVerified,
        completedRides: completedRidesCount,
        rating: averageRating,
        ratingCount,
        breakdown: {
            basePoints,
            verificationPoints,
            completedRidesPoints,
            ratingPoints,
            cancellationDeduction,
        },
    };
}

export async function getAnonymousSeatTrust(
    passengerId: string | Types.ObjectId,
): Promise<AnonymousSeatTrust> {
    const profile = await calculateUserTrust(passengerId, 'Passenger');
    return {
        trustScore: profile.score,
        isVerified: profile.isVerified,
        completedRides: profile.completedRides,
        rating: profile.rating,
    };
}
