import { Types } from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Ride } from '../models/Ride.js';
import {
    SosAlert,
    type SosAlertFields,
    type SosEmergencyType,
    type SosStatus,
} from '../models/SosAlert.js';
import { User } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { createNotification } from './notificationService.js';
import { emitToUser, SOCKET_EVENTS } from './socketService.js';

export interface TriggerSosInput {
    rideId: string;
    emergencyType: SosEmergencyType;
    message?: string;
    location?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
    };
}

export async function triggerSosAlert(user: SafeUser, input: TriggerSosInput) {
    if (!Types.ObjectId.isValid(input.rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }

    const ride = await Ride.findById(input.rideId);
    if (!ride) {
        throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');
    }

    // Verify user authorization: must be either driver or accepted passenger
    const isDriver = ride.driverId.toString() === user.id;
    let isPassenger = false;
    if (!isDriver) {
        const activeBooking = await Booking.findOne({
            rideId: ride._id,
            passengerId: user.id,
            status: 'accepted',
        });
        if (activeBooking) {
            isPassenger = true;
        }
    }

    if (!isDriver && !isPassenger) {
        throw new AppError(
            403,
            'UNAUTHORIZED_RIDE_PARTICIPANT',
            'Only confirmed passengers or the driver of this ride can trigger an emergency SOS alert.',
        );
    }

    // Must be active or departing soon (within 2h)
    const hoursToDeparture = (ride.departureAt.getTime() - Date.now()) / (3600 * 1000);
    if (ride.status === 'cancelled' || ride.status === 'completed') {
        throw new AppError(
            400,
            'INVALID_RIDE_STATE',
            `Cannot trigger emergency SOS for a ride that is already ${ride.status}.`,
        );
    }

    if (ride.status === 'scheduled' && hoursToDeparture > 2) {
        throw new AppError(
            400,
            'INVALID_RIDE_STATE',
            'Emergency SOS can only be triggered during an active ride or within 2 hours of departure.',
        );
    }

    const alert = await SosAlert.create({
        rideId: ride._id,
        triggeredBy: user.id,
        role: isDriver ? 'Driver' : 'Passenger',
        emergencyType: input.emergencyType,
        message: input.message,
        location: input.location,
        status: 'triggered',
    });

    // Collect all participants on this ride
    const acceptedBookings = await Booking.find({
        rideId: ride._id,
        status: 'accepted',
    }).select('passengerId');

    const participantIds = new Set<string>();
    participantIds.add(ride.driverId.toString());
    for (const b of acceptedBookings) {
        participantIds.add(b.passengerId.toString());
    }

    // Find all platform admins
    const admins = await User.find({ role: 'Admin' }).select('_id');
    const adminIds = admins.map((a) => a._id.toString());

    const alertPayload = formatSosAlert(alert);

    // Notify participants in-app and via Socket.io
    for (const participantId of participantIds) {
        await createNotification(
            participantId,
            'sos_alert',
            'EMERGENCY SOS TRIGGERED',
            `An SOS alert was activated on your ride (${input.emergencyType.toUpperCase()}). Support & participants have been alerted.`,
            { rideId: ride._id.toString(), alertId: alert._id.toString() },
        );
        emitToUser(participantId, SOCKET_EVENTS.SOS_TRIGGERED, alertPayload);
    }

    // Notify admins in-app and via Socket.io
    for (const adminId of adminIds) {
        await createNotification(
            adminId,
            'sos_alert',
            'EMERGENCY SOS ALERT',
            `SOS triggered by ${user.name} on ride ${ride._id.toString()} (${input.emergencyType}).`,
            { rideId: ride._id.toString(), alertId: alert._id.toString() },
        );
        emitToUser(adminId, SOCKET_EVENTS.SOS_TRIGGERED, alertPayload);
    }

    return alertPayload;
}

export async function acknowledgeSosAlert(admin: SafeUser, alertId: string) {
    if (!Types.ObjectId.isValid(alertId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid alert identifier.');
    }

    const alert = await SosAlert.findById(alertId);
    if (!alert) {
        throw new AppError(404, 'NOT_FOUND', 'SOS alert not found.');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = new Types.ObjectId(admin.id);
    alert.acknowledgedAt = new Date();
    await alert.save();

    const formatted = formatSosAlert(alert);
    emitToUser(alert.triggeredBy.toString(), SOCKET_EVENTS.SOS_UPDATED, formatted);

    return formatted;
}

export async function resolveSosAlert(
    admin: SafeUser,
    alertId: string,
    input: { status: 'resolved' | 'false_alarm'; resolutionNotes?: string },
) {
    if (!Types.ObjectId.isValid(alertId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid alert identifier.');
    }

    const alert = await SosAlert.findById(alertId);
    if (!alert) {
        throw new AppError(404, 'NOT_FOUND', 'SOS alert not found.');
    }

    alert.status = input.status;
    alert.resolvedBy = new Types.ObjectId(admin.id);
    alert.resolvedAt = new Date();
    alert.resolutionNotes = input.resolutionNotes;
    await alert.save();

    const formatted = formatSosAlert(alert);
    emitToUser(alert.triggeredBy.toString(), SOCKET_EVENTS.SOS_UPDATED, formatted);

    return formatted;
}

export async function getRideActiveSos(user: SafeUser, rideId: string) {
    if (!Types.ObjectId.isValid(rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }

    const ride = await Ride.findById(rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');

    const isDriver = ride.driverId.toString() === user.id;
    const isPassenger = await Booking.exists({
        rideId: ride._id,
        passengerId: user.id,
        status: 'accepted',
    });
    const isAdmin = user.role === 'Admin';

    if (!isDriver && !isPassenger && !isAdmin) {
        throw new AppError(
            403,
            'FORBIDDEN',
            'Access to this ride emergency state denied.',
        );
    }

    const activeAlert = await SosAlert.findOne({
        rideId: ride._id,
        status: { $in: ['triggered', 'acknowledged'] },
    }).sort({ createdAt: -1 });

    return activeAlert ? formatSosAlert(activeAlert) : null;
}

export async function getAllSosIncidents(options: {
    status?: SosStatus;
    limit?: number;
}) {
    const query: Record<string, unknown> = {};
    if (options.status) {
        query.status = options.status;
    }

    const alerts = await SosAlert.find(query)
        .populate('rideId', 'pickup destination departureAt status')
        .populate('triggeredBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(options.limit ?? 50)
        .lean();

    return alerts.map((a) => ({
        id: a._id.toString(),
        rideId: a.rideId,
        triggeredBy: a.triggeredBy,
        role: a.role,
        status: a.status,
        emergencyType: a.emergencyType,
        message: a.message,
        location: a.location,
        acknowledgedAt: a.acknowledgedAt,
        resolvedAt: a.resolvedAt,
        resolutionNotes: a.resolutionNotes,
        createdAt: a.createdAt,
    }));
}

function formatSosAlert(a: SosAlertFields & { _id: Types.ObjectId }) {
    return {
        id: a._id.toString(),
        rideId: a.rideId.toString(),
        triggeredBy: a.triggeredBy.toString(),
        role: a.role,
        status: a.status,
        emergencyType: a.emergencyType,
        message: a.message,
        location: a.location,
        acknowledgedAt: a.acknowledgedAt,
        resolvedAt: a.resolvedAt,
        resolutionNotes: a.resolutionNotes,
        createdAt: a.createdAt,
    };
}
