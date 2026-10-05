import { Schema, model, type Types } from 'mongoose';

export interface RatingFields {
    rideId: Types.ObjectId;
    bookingId: Types.ObjectId;
    fromUserId: Types.ObjectId;
    toUserId: Types.ObjectId;
    targetRole: 'Driver' | 'Passenger';
    rating: number;
    review: string;
    createdAt: Date;
    updatedAt: Date;
}

const ratingSchema = new Schema<RatingFields>(
    {
        rideId: {
            type: Schema.Types.ObjectId,
            ref: 'Ride',
            required: true,
            index: true,
        },
        bookingId: {
            type: Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            index: true,
        },
        fromUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        toUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        targetRole: {
            type: String,
            enum: ['Driver', 'Passenger'],
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        review: {
            type: String,
            trim: true,
            maxlength: 500,
            default: '',
        },
    },
    { timestamps: true, versionKey: false },
);

// Prevent duplicate rating from same user to same target on same ride
ratingSchema.index({ rideId: 1, fromUserId: 1, toUserId: 1 }, { unique: true });
ratingSchema.index({ toUserId: 1, createdAt: -1 });

export const Rating = model<RatingFields>('Rating', ratingSchema);
