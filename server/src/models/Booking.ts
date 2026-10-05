import { Schema, model, type Types } from 'mongoose';

export const bookingStatuses = [
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'completed',
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export interface BookingFields {
    rideId: Types.ObjectId;
    passengerId: Types.ObjectId;
    seatsBooked: number;
    seatNumbers: number[];
    status: BookingStatus;
    cancellationReason?: string;
    cancelledAt?: Date;
    cancelledBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const bookingSchema = new Schema<BookingFields>(
    {
        rideId: {
            type: Schema.Types.ObjectId,
            ref: 'Ride',
            required: true,
            index: true,
        },
        passengerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        seatsBooked: {
            type: Number,
            required: true,
            min: 1,
            max: 6,
        },
        seatNumbers: {
            type: [Number],
            required: true,
            validate: {
                validator: (val: number[]) =>
                    Array.isArray(val) &&
                    val.length > 0 &&
                    val.every((n) => Number.isInteger(n) && n >= 1 && n <= 6),
                message: 'Seat numbers must be integers between 1 and 6.',
            },
        },
        status: {
            type: String,
            enum: bookingStatuses,
            default: 'pending',
            required: true,
            index: true,
        },
        cancellationReason: {
            type: String,
            maxlength: 300,
            trim: true,
        },
        cancelledAt: Date,
        cancelledBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true, versionKey: false },
);

// Prevent duplicate active bookings for the same passenger and ride
bookingSchema.index(
    { rideId: 1, passengerId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $in: ['pending', 'accepted'] } },
    },
);

bookingSchema.index({ rideId: 1, status: 1 });
bookingSchema.index({ passengerId: 1, createdAt: -1 });

export const Booking = model<BookingFields>('Booking', bookingSchema);
