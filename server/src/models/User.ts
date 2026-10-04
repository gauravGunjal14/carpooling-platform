import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Role } from '../types/auth.js';

export interface UserFields {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    status: 'active' | 'disabled';
    refreshTokenHash?: string;
    refreshTokenExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserFields>;

const userSchema = new Schema<UserFields>(
    {
        name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
        },
        passwordHash: { type: String, required: true, select: false },
        role: {
            type: String,
            enum: ['Passenger', 'Driver', 'Admin'],
            required: true,
            default: 'Passenger',
            immutable: true,
        },
        status: {
            type: String,
            enum: ['active', 'disabled'],
            required: true,
            default: 'active',
        },
        refreshTokenHash: { type: String, select: false },
        refreshTokenExpiresAt: { type: Date, select: false },
    },
    { timestamps: true, versionKey: false },
);

export const User = model<UserFields>('User', userSchema);
