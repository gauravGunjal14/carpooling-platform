import { Schema, model, type Types } from 'mongoose';

export interface RideLocationFields {
    displayName: string;
    searchKey: string;
    latitude: number;
    longitude: number;
    point: { type: 'Point'; coordinates: [number, number] };
}

export interface RideFields {
    driverId: Types.ObjectId;
    pickup: RideLocationFields;
    destination: RideLocationFields;
    departureAt: Date;
    availableSeats: number;
    preferences: {
        smokingAllowed: boolean;
        luggage: 'small' | 'standard' | 'large';
        notes: string;
    };
    womenOnly: boolean;
    status: 'scheduled' | 'cancelled' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}

const rideLocationSchema = new Schema<RideLocationFields>(
    {
        displayName: { type: String, required: true, trim: true, maxlength: 200 },
        searchKey: { type: String, required: true, trim: true, maxlength: 200 },
        latitude: { type: Number, required: true, min: -90, max: 90 },
        longitude: { type: Number, required: true, min: -180, max: 180 },
        point: {
            type: {
                type: String,
                enum: ['Point'],
                required: true,
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                required: true,
                validate: {
                    validator: (value: number[]) =>
                        value.length === 2 &&
                        value[0] >= -180 &&
                        value[0] <= 180 &&
                        value[1] >= -90 &&
                        value[1] <= 90,
                    message: 'Coordinates must contain longitude and latitude.',
                },
            },
        },
    },
    { _id: false },
);

const rideSchema = new Schema<RideFields>(
    {
        driverId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        pickup: { type: rideLocationSchema, required: true },
        destination: { type: rideLocationSchema, required: true },
        departureAt: { type: Date, required: true },
        availableSeats: { type: Number, required: true, min: 1, max: 6 },
        preferences: {
            smokingAllowed: { type: Boolean, default: false, required: true },
            luggage: {
                type: String,
                enum: ['small', 'standard', 'large'],
                default: 'standard',
                required: true,
            },
            notes: { type: String, trim: true, maxlength: 240, default: '' },
        },
        womenOnly: { type: Boolean, default: false, required: true },
        status: {
            type: String,
            enum: ['scheduled', 'cancelled', 'completed'],
            default: 'scheduled',
            required: true,
        },
    },
    { timestamps: true, versionKey: false },
);

rideSchema.index({
    status: 1,
    departureAt: 1,
    'pickup.searchKey': 1,
    'destination.searchKey': 1,
});
rideSchema.index({ 'pickup.point': '2dsphere' });
rideSchema.index({ 'destination.point': '2dsphere' });

export const Ride = model<RideFields>('Ride', rideSchema);
