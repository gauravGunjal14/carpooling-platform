import { Schema, model, type Types } from 'mongoose';

export const notificationTypes = [
    'booking_request',
    'booking_accepted',
    'booking_rejected',
    'booking_cancelled',
    'ride_completed',
    'ride_status_changed',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationFields {
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<NotificationFields>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: notificationTypes,
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        data: {
            type: Schema.Types.Mixed,
            default: {},
        },
        read: {
            type: Boolean,
            default: false,
            required: true,
            index: true,
        },
    },
    { timestamps: true, versionKey: false },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = model<NotificationFields>('Notification', notificationSchema);
