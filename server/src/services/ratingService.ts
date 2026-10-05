import { Types } from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Rating, type RatingFields } from '../models/Rating.js';
import { Ride } from '../models/Ride.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { createNotification } from './notificationService.js';
import { calculateUserTrust } from './trustService.js';

export interface SubmitRatingInput {
    rideId: string;
    bookingId: string;
    toUserId: string;
    targetRole: 'Driver' | 'Passenger';
    rating: number;
    review?: string;
}

export async function submitRating(user: SafeUser, input: SubmitRatingInput) {
    if (!Types.ObjectId.isValid(input.rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }
    if (!Types.ObjectId.isValid(input.bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }
    if (!Types.ObjectId.isValid(input.toUserId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid target user identifier.');
    }

    // 1. No self-rating
    if (user.id === input.toUserId) {
        throw new AppError(400, 'CANNOT_RATE_SELF', 'You cannot rate yourself.');
    }

    // 2. Validate rating range 1 to 5
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new AppError(
            400,
            'INVALID_RATING_VALUE',
            'Rating must be an integer between 1 and 5 stars.',
        );
    }

    // 3. Verify ride exists and is completed
    const ride = await Ride.findById(input.rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');

    if (ride.status !== 'completed') {
        throw new AppError(
            400,
            'RIDE_NOT_COMPLETED',
            'Ratings can only be submitted after the ride is marked completed.',
        );
    }

    // 4. Verify booking exists and is completed
    const booking = await Booking.findById(input.bookingId);
    if (!booking || booking.rideId.toString() !== ride._id.toString()) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found for this ride.');
    }

    if (booking.status !== 'completed') {
        throw new AppError(
            400,
            'BOOKING_NOT_COMPLETED',
            'Ratings can only be submitted for completed bookings.',
        );
    }

    // 5. Verify relationship / authorization
    const isPassengerRatingDriver =
        booking.passengerId.toString() === user.id &&
        ride.driverId.toString() === input.toUserId &&
        input.targetRole === 'Driver';

    const isDriverRatingPassenger =
        ride.driverId.toString() === user.id &&
        booking.passengerId.toString() === input.toUserId &&
        input.targetRole === 'Passenger';

    if (!isPassengerRatingDriver && !isDriverRatingPassenger) {
        throw new AppError(
            403,
            'FORBIDDEN',
            'You are not authorized to rate this participant for this ride.',
        );
    }

    // 6. Check duplicate rating
    const existing = await Rating.findOne({
        rideId: ride._id,
        fromUserId: user.id,
        toUserId: input.toUserId,
    });
    if (existing) {
        throw new AppError(
            409,
            'DUPLICATE_RATING',
            'You have already submitted a rating for this user on this ride.',
        );
    }

    // 7. Create rating document
    let created;
    try {
        created = await Rating.create({
            rideId: ride._id,
            bookingId: booking._id,
            fromUserId: user.id,
            toUserId: input.toUserId,
            targetRole: input.targetRole,
            rating: input.rating,
            review: input.review?.trim() ?? '',
        });
    } catch (err: unknown) {
        if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            err.code === 11000
        ) {
            throw new AppError(
                409,
                'DUPLICATE_RATING',
                'You have already submitted a rating for this user on this ride.',
            );
        }
        throw err;
    }

    // 8. Update trust and send notification to target user
    const updatedTrust = await calculateUserTrust(input.toUserId, input.targetRole);

    await createNotification(
        input.toUserId,
        'ride_status_changed',
        'New Review Received',
        `You received a ${input.rating}-star rating. Your updated trust score is ${updatedTrust.score}/100.`,
        {
            rideId: ride._id.toString(),
            ratingId: created._id.toString(),
            newTrustScore: updatedTrust.score,
        },
    );

    return {
        id: created._id.toString(),
        rideId: created.rideId.toString(),
        rating: created.rating,
        review: created.review,
        targetRole: created.targetRole,
        createdAt: created.createdAt,
    };
}

export async function getUserRatings(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid user identifier.');
    }
    const ratings = await Rating.find({ toUserId: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    const fromUserIds = [...new Set(ratings.map((r) => r.fromUserId.toString()))];
    const fromUsers = await User.find({ _id: { $in: fromUserIds } }).select('name');
    const nameMap = new Map(fromUsers.map((u) => [u._id.toString(), u.name]));

    return ratings.map((r) => ({
        id: r._id.toString(),
        rating: r.rating,
        review: r.review,
        targetRole: r.targetRole,
        reviewerName: nameMap.get(r.fromUserId.toString()) ?? 'Traveler',
        createdAt: r.createdAt,
    }));
}

export async function getRideRatings(rideId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }
    const ratings = await Rating.find({
        rideId,
        $or: [{ fromUserId: currentUserId }, { toUserId: currentUserId }],
    }).lean();

    return ratings.map((r) => ({
        id: r._id.toString(),
        fromUserId: r.fromUserId.toString(),
        toUserId: r.toUserId.toString(),
        rating: r.rating,
        review: r.review,
        targetRole: r.targetRole,
        createdAt: r.createdAt,
    }));
}
