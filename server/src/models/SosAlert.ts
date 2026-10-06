import { Schema, model, type Types } from 'mongoose';

export const sosStatuses = [
    'triggered',
    'acknowledged',
    'resolved',
    'false_alarm',
] as const;

export type SosStatus = (typeof sosStatuses)[number];

export const sosEmergencyTypes = [
    'medical',
    'accident',
    'unsafe_behavior',
    'route_deviation',
    'general',
] as const;

export type SosEmergencyType = (typeof sosEmergencyTypes)[number];

export interface SosAlertFields {
    rideId: Types.ObjectId;
    triggeredBy: Types.ObjectId;
    role: 'Passenger' | 'Driver';
    status: SosStatus;
    emergencyType: SosEmergencyType;
    message?: string;
    location?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
    };
    acknowledgedBy?: Types.ObjectId;
    acknowledgedAt?: Date;
    resolvedBy?: Types.ObjectId;
    resolvedAt?: Date;
    resolutionNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const sosAlertSchema = new Schema<SosAlertFields>(
    {
        rideId: {
            type: Schema.Types.ObjectId,
            ref: 'Ride',
            required: true,
            index: true,
        },
        triggeredBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: ['Passenger', 'Driver'],
            required: true,
        },
        status: {
            type: String,
            enum: sosStatuses,
            default: 'triggered',
            required: true,
            index: true,
        },
        emergencyType: {
            type: String,
            enum: sosEmergencyTypes,
            default: 'general',
            required: true,
        },
        message: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        location: {
            latitude: { type: Number, min: -90, max: 90 },
            longitude: { type: Number, min: -180, max: 180 },
            accuracy: { type: Number },
        },
        acknowledgedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        acknowledgedAt: Date,
        resolvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        resolvedAt: Date,
        resolutionNotes: {
            type: String,
            trim: true,
            maxlength: 500,
        },
    },
    { timestamps: true, versionKey: false },
);

sosAlertSchema.index({ status: 1, createdAt: -1 });

export const SosAlert = model<SosAlertFields>('SosAlert', sosAlertSchema);
