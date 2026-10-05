import { Types } from 'mongoose';
import { Booking, type BookingFields, type BookingStatus } from '../models/Booking.js';
import { Ride, type RideFields } from '../models/Ride.js';
import { User } from '../models/User.js';
import { VerificationSubmission } from '../models/VerificationSubmission.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { createNotification } from './notificationService.js';
import { processCancellationRefund } from './refundService.js';
import { assertWomenOnlyEligibility } from './rideService.js';
import { emitToUser, SOCKET_EVENTS } from './socketService.js';
import { getAnonymousSeatTrust, type AnonymousSeatTrust } from './trustService.js';

export interface SeatInfo {
    seatNumber: number;
    isOccupied: boolean;
    isMySeat?: boolean;
    trustSummary?: AnonymousSeatTrust;
}

export interface CreateBookingInput {
    rideId: string;
    seatNumbers: number[];
}

export async function createBooking(passenger: SafeUser, input: CreateBookingInput) {
    if (!Types.ObjectId.isValid(input.rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }
    const ride = await Ride.findById(input.rideId);
    if (!ride) {
        throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');
    }

    if (ride.status !== 'scheduled') {
        throw new AppError(
            400,
            'RIDE_NOT_BOOKABLE',
            'Cannot book a ride that is not scheduled.',
        );
    }

    if (ride.departureAt.getTime() <= Date.now()) {
        throw new AppError(
            400,
            'PAST_RIDE_BOOKING',
            'Cannot book a ride that has already departed.',
        );
    }

    if (ride.driverId.toString() === passenger.id) {
        throw new AppError(
            400,
            'CANNOT_BOOK_OWN_RIDE',
            'Drivers cannot book seats on their own rides.',
        );
    }

    if (ride.womenOnly) {
        await assertWomenOnlyEligibility(passenger.id, 'Passenger');
    }

    const totalSeats = ride.totalSeats ?? ride.availableSeats;
    const seatNumbers = [...new Set(input.seatNumbers)].sort((a, b) => a - b);

    if (seatNumbers.length === 0) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Please select at least one seat to book.',
        );
    }

    for (const seat of seatNumbers) {
        if (!Number.isInteger(seat) || seat < 1 || seat > totalSeats) {
            throw new AppError(
                400,
                'INVALID_SEAT_NUMBER',
                `Seat number ${seat} is outside the allowed range (1 to ${totalSeats}).`,
            );
        }
    }

    // Check for existing active booking for this passenger on this ride
    const existingActiveBooking = await Booking.findOne({
        rideId: ride._id,
        passengerId: passenger.id,
        status: { $in: ['pending', 'accepted'] },
    });
    if (existingActiveBooking) {
        throw new AppError(
            409,
            'DUPLICATE_BOOKING',
            'You already have an active booking request for this ride.',
        );
    }

    // Atomic reservation of seats on the Ride document to prevent race conditions
    const updatedRide = await Ride.findOneAndUpdate(
        {
            _id: ride._id,
            status: 'scheduled',
            departureAt: { $gt: new Date() },
            occupiedSeats: { $nin: seatNumbers },
            availableSeats: { $gte: seatNumbers.length },
        },
        {
            $push: { occupiedSeats: { $each: seatNumbers } },
            $inc: { availableSeats: -seatNumbers.length },
        },
        { returnDocument: 'after' },
    );

    if (!updatedRide) {
        const currentRide = await Ride.findById(ride._id);
        if (
            !currentRide ||
            currentRide.status !== 'scheduled' ||
            currentRide.departureAt <= new Date()
        ) {
            throw new AppError(
                400,
                'RIDE_NOT_BOOKABLE',
                'Ride is no longer available for booking.',
            );
        }
        const hasOccupied = seatNumbers.some((s) =>
            (currentRide.occupiedSeats ?? []).includes(s),
        );
        if (hasOccupied) {
            throw new AppError(
                409,
                'SEAT_UNAVAILABLE',
                'One or more selected seats are already occupied. Please select an available seat.',
            );
        }
        throw new AppError(
            409,
            'INSUFFICIENT_SEATS',
            'There are not enough seats remaining on this ride.',
        );
    }

    // Create the booking document
    let booking;
    try {
        booking = await Booking.create({
            rideId: ride._id,
            passengerId: passenger.id,
            seatsBooked: seatNumbers.length,
            seatNumbers,
            status: 'pending',
        });
    } catch (err: unknown) {
        // Rollback atomic reservation on duplicate active booking or validation error
        await Ride.findByIdAndUpdate(ride._id, {
            $pull: { occupiedSeats: { $in: seatNumbers } },
            $inc: { availableSeats: seatNumbers.length },
        });

        if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            err.code === 11000
        ) {
            throw new AppError(
                409,
                'DUPLICATE_BOOKING',
                'You already have an active booking request for this ride.',
            );
        }
        throw err;
    }

    // Send in-app notification to Driver
    await createNotification(
        ride.driverId,
        'booking_request',
        'New Booking Request',
        `${passenger.name} requested ${seatNumbers.length} seat(s) for your trip.`,
        { rideId: ride._id.toString(), bookingId: booking._id.toString() },
    );

    const formatted = formatBooking(booking, ride, passenger);

    // Real-time events for passenger and driver
    emitToUser(passenger.id, SOCKET_EVENTS.BOOKING_SUBMITTED, formatted);
    emitToUser(ride.driverId.toString(), SOCKET_EVENTS.BOOKING_REQUEST_RECEIVED, {
        booking: formatted,
        passenger: { id: passenger.id, name: passenger.name },
    });

    return formatted;
}

export async function getRideSeatsStatus(
    rideId: string,
    currentUserId?: string,
): Promise<{ totalSeats: number; availableSeatsCount: number; seats: SeatInfo[] }> {
    if (!Types.ObjectId.isValid(rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }
    const ride = await Ride.findById(rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');

    const totalSeats = ride.totalSeats ?? ride.availableSeats;
    const activeBookings = await Booking.find({
        rideId: ride._id,
        status: { $in: ['pending', 'accepted'] },
    });

    const seatMap = new Map<number, { passengerId: Types.ObjectId }>();
    for (const b of activeBookings) {
        for (const s of b.seatNumbers) {
            seatMap.set(s, { passengerId: b.passengerId });
        }
    }

    const seats: SeatInfo[] = [];
    let availableCount = 0;

    for (let s = 1; s <= totalSeats; s++) {
        const occupant = seatMap.get(s);
        if (occupant) {
            const isMySeat = currentUserId
                ? occupant.passengerId.toString() === currentUserId
                : false;
            // Privacy protection: compute anonymous trust summary without exposing identity
            const trustSummary = await getAnonymousSeatTrust(occupant.passengerId);
            seats.push({
                seatNumber: s,
                isOccupied: true,
                isMySeat,
                trustSummary,
            });
        } else {
            availableCount++;
            seats.push({
                seatNumber: s,
                isOccupied: false,
            });
        }
    }

    return {
        totalSeats,
        availableSeatsCount: availableCount,
        seats,
    };
}

export async function getPassengerBookings(passenger: SafeUser) {
    const bookings = await Booking.find({ passengerId: passenger.id })
        .sort({ createdAt: -1 })
        .limit(100);

    const rideIds = [...new Set(bookings.map((b) => b.rideId))];
    const rides = await Ride.find({ _id: { $in: rideIds } }).lean();
    const rideMap = new Map(rides.map((r) => [r._id.toString(), r]));

    const driverIds = [...new Set(rides.map((r) => r.driverId.toString()))];
    const [drivers, verifiedDriverIds] = await Promise.all([
        User.find({ _id: { $in: driverIds } }).select('name'),
        VerificationSubmission.distinct('userId', {
            userId: { $in: driverIds },
            documentType: 'driver_license',
            status: 'approved',
        }),
    ]);
    const driverNameMap = new Map(drivers.map((d) => [d._id.toString(), d.name]));
    const verifiedSet = new Set(verifiedDriverIds.map((id) => id.toString()));

    return bookings.map((b) => {
        const r = rideMap.get(b.rideId.toString());
        const dId = r ? r.driverId.toString() : '';
        return {
            id: b._id.toString(),
            rideId: b.rideId.toString(),
            seatsBooked: b.seatsBooked,
            seatNumbers: b.seatNumbers,
            status: b.status,
            cancellationReason: b.cancellationReason,
            createdAt: b.createdAt,
            ride: r
                ? {
                      id: r._id.toString(),
                      pickup: r.pickup,
                      destination: r.destination,
                      departureAt: r.departureAt,
                      status: r.status,
                      driver: {
                          id: dId,
                          displayName: driverNameMap.get(dId) ?? 'Driver',
                          isVerified: verifiedSet.has(dId),
                      },
                  }
                : null,
        };
    });
}

export async function getBookingDetails(user: SafeUser, bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');

    const ride = await Ride.findById(booking.rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Associated ride not found.');

    const isPassenger = booking.passengerId.toString() === user.id;
    const isDriver = ride.driverId.toString() === user.id;
    const isAdmin = user.role === 'Admin';

    if (!isPassenger && !isDriver && !isAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this booking.');
    }

    const passengerDoc = await User.findById(booking.passengerId).select('name email');
    const driverDoc = await User.findById(ride.driverId).select('name email');

    return {
        id: booking._id.toString(),
        rideId: booking.rideId.toString(),
        passengerId: booking.passengerId.toString(),
        passenger: passengerDoc
            ? {
                  id: passengerDoc._id.toString(),
                  name: passengerDoc.name,
                  email: passengerDoc.email,
              }
            : null,
        driver: driverDoc
            ? {
                  id: driverDoc._id.toString(),
                  name: driverDoc.name,
                  email: driverDoc.email,
              }
            : null,
        seatsBooked: booking.seatsBooked,
        seatNumbers: booking.seatNumbers,
        status: booking.status,
        cancellationReason: booking.cancellationReason,
        cancelledAt: booking.cancelledAt,
        createdAt: booking.createdAt,
        ride: {
            id: ride._id.toString(),
            pickup: ride.pickup,
            destination: ride.destination,
            departureAt: ride.departureAt,
            status: ride.status,
        },
    };
}

export async function cancelPassengerBooking(
    passenger: SafeUser,
    bookingId: string,
    reason?: string,
) {
    if (!Types.ObjectId.isValid(bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }
    const booking = await Booking.findOne({ _id: bookingId, passengerId: passenger.id });
    if (!booking) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    if (booking.status !== 'pending' && booking.status !== 'accepted') {
        throw new AppError(
            400,
            'CANNOT_CANCEL_BOOKING',
            `Cannot cancel a booking that is currently ${booking.status}.`,
        );
    }

    const ride = await Ride.findById(booking.rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Associated ride not found.');

    if (ride.status === 'completed' || ride.status === 'cancelled') {
        throw new AppError(
            400,
            'RIDE_ALREADY_FINISHED',
            `Ride is already ${ride.status}. Booking cannot be cancelled.`,
        );
    }

    const hoursBeforeDeparture =
        (ride.departureAt.getTime() - Date.now()) / (1000 * 60 * 60);

    booking.status = 'cancelled';
    booking.cancellationReason = reason ?? 'Cancelled by passenger';
    booking.cancelledAt = new Date();
    booking.cancelledBy = new Types.ObjectId(passenger.id);
    await booking.save();

    // Recalculate remaining seats for the ride
    await refreshRideAvailableSeats(ride._id);

    // Call refund service hook
    await processCancellationRefund(booking, {
        reason: booking.cancellationReason,
        cancelledByRole: 'Passenger',
        hoursBeforeDeparture,
    });

    // Notify Driver
    await createNotification(
        ride.driverId,
        'booking_cancelled',
        'Passenger Cancelled Booking',
        `${passenger.name} cancelled their booking for ${booking.seatsBooked} seat(s).`,
        { rideId: ride._id.toString(), bookingId: booking._id.toString() },
    );

    // Real-time cancellation event to driver and passenger
    emitToUser(ride.driverId.toString(), SOCKET_EVENTS.BOOKING_CANCELLED, {
        bookingId: booking._id.toString(),
        rideId: ride._id.toString(),
        cancelledBy: 'passenger',
    });
    emitToUser(passenger.id, SOCKET_EVENTS.BOOKING_CANCELLED, {
        bookingId: booking._id.toString(),
        rideId: ride._id.toString(),
        cancelledBy: 'passenger',
    });

    return {
        id: booking._id.toString(),
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason,
    };
}

export async function getDriverBookingRequests(driver: SafeUser, rideId?: string) {
    const rideQuery: Record<string, unknown> = { driverId: driver.id };
    if (rideId) {
        if (!Types.ObjectId.isValid(rideId)) {
            throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
        }
        rideQuery._id = rideId;
    }

    const driverRides = await Ride.find(rideQuery).lean();
    const rideIds = driverRides.map((r) => r._id);
    const rideMap = new Map(driverRides.map((r) => [r._id.toString(), r]));

    const bookings = await Booking.find({
        rideId: { $in: rideIds },
    })
        .sort({ createdAt: -1 })
        .limit(100);

    const passengerIds = [...new Set(bookings.map((b) => b.passengerId.toString()))];
    const [passengers, passengerVerifiedDocs] = await Promise.all([
        User.find({ _id: { $in: passengerIds } }).select('name email'),
        VerificationSubmission.distinct('userId', {
            userId: { $in: passengerIds },
            documentType: 'identity',
            status: 'approved',
        }),
    ]);

    const passengerMap = new Map(passengers.map((p) => [p._id.toString(), p]));
    const verifiedPassengers = new Set(passengerVerifiedDocs.map((id) => id.toString()));

    return bookings.map((b) => {
        const passenger = passengerMap.get(b.passengerId.toString());
        const ride = rideMap.get(b.rideId.toString());
        return {
            id: b._id.toString(),
            rideId: b.rideId.toString(),
            passengerId: b.passengerId.toString(),
            passenger: passenger
                ? {
                      id: passenger._id.toString(),
                      displayName: passenger.name,
                      email: passenger.email,
                      isVerified: verifiedPassengers.has(passenger._id.toString()),
                  }
                : null,
            seatsBooked: b.seatsBooked,
            seatNumbers: b.seatNumbers,
            status: b.status,
            cancellationReason: b.cancellationReason,
            createdAt: b.createdAt,
            ride: ride
                ? {
                      id: ride._id.toString(),
                      pickup: ride.pickup,
                      destination: ride.destination,
                      departureAt: ride.departureAt,
                      status: ride.status,
                  }
                : null,
        };
    });
}

export async function acceptBooking(driver: SafeUser, bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');

    const ride = await Ride.findById(booking.rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Associated ride not found.');

    if (ride.driverId.toString() !== driver.id) {
        throw new AppError(403, 'FORBIDDEN', 'You do not own this ride.');
    }

    if (booking.status !== 'pending') {
        throw new AppError(
            400,
            'INVALID_BOOKING_STATUS',
            `Cannot accept a booking with status ${booking.status}.`,
        );
    }

    if (ride.status !== 'scheduled' && ride.status !== 'active') {
        throw new AppError(
            400,
            'RIDE_NOT_ACTIVE',
            `Cannot accept bookings for a ride that is ${ride.status}.`,
        );
    }

    booking.status = 'accepted';
    await booking.save();

    await refreshRideAvailableSeats(ride._id);

    // Notify Passenger
    await createNotification(
        booking.passengerId,
        'booking_accepted',
        'Booking Accepted!',
        `Your driver accepted your booking for the ride from ${ride.pickup.displayName.slice(0, 30)} to ${ride.destination.displayName.slice(0, 30)}.`,
        { rideId: ride._id.toString(), bookingId: booking._id.toString() },
    );

    // Real-time socket event to passenger
    emitToUser(booking.passengerId.toString(), SOCKET_EVENTS.BOOKING_ACCEPTED, {
        bookingId: booking._id.toString(),
        rideId: ride._id.toString(),
    });

    return {
        id: booking._id.toString(),
        status: booking.status,
    };
}

export async function rejectBooking(
    driver: SafeUser,
    bookingId: string,
    reason?: string,
) {
    if (!Types.ObjectId.isValid(bookingId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid booking identifier.');
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');

    const ride = await Ride.findById(booking.rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Associated ride not found.');

    if (ride.driverId.toString() !== driver.id) {
        throw new AppError(403, 'FORBIDDEN', 'You do not own this ride.');
    }

    if (booking.status !== 'pending') {
        throw new AppError(
            400,
            'INVALID_BOOKING_STATUS',
            `Cannot reject a booking with status ${booking.status}.`,
        );
    }

    booking.status = 'rejected';
    booking.cancellationReason = reason ?? 'Declined by driver';
    booking.cancelledAt = new Date();
    booking.cancelledBy = new Types.ObjectId(driver.id);
    await booking.save();

    // Frees up the seats
    await refreshRideAvailableSeats(ride._id);

    // Notify Passenger
    await createNotification(
        booking.passengerId,
        'booking_rejected',
        'Booking Declined',
        `Your booking request was declined by the driver. Seats have been released.`,
        { rideId: ride._id.toString(), bookingId: booking._id.toString() },
    );

    // Real-time socket event to passenger
    emitToUser(booking.passengerId.toString(), SOCKET_EVENTS.BOOKING_REJECTED, {
        bookingId: booking._id.toString(),
        rideId: ride._id.toString(),
        reason: booking.cancellationReason,
    });

    return {
        id: booking._id.toString(),
        status: booking.status,
    };
}

export async function getRideConfirmedPassengers(driver: SafeUser, rideId: string) {
    if (!Types.ObjectId.isValid(rideId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ride identifier.');
    }
    const ride = await Ride.findById(rideId);
    if (!ride) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');

    if (ride.driverId.toString() !== driver.id) {
        throw new AppError(403, 'FORBIDDEN', 'You do not own this ride.');
    }

    const acceptedBookings = await Booking.find({
        rideId: ride._id,
        status: 'accepted',
    }).sort({ createdAt: 1 });

    const passengerIds = acceptedBookings.map((b) => b.passengerId);
    const passengers = await User.find({ _id: { $in: passengerIds } }).select(
        'name email',
    );
    const passengerMap = new Map(passengers.map((p) => [p._id.toString(), p]));

    return acceptedBookings.map((b) => {
        const p = passengerMap.get(b.passengerId.toString());
        return {
            bookingId: b._id.toString(),
            passengerId: b.passengerId.toString(),
            name: p?.name ?? 'Passenger',
            email: p?.email ?? '',
            seatNumbers: b.seatNumbers,
            seatsBooked: b.seatsBooked,
            bookedAt: b.createdAt,
        };
    });
}

export async function refreshRideAvailableSeats(
    rideId: Types.ObjectId | string,
): Promise<number> {
    const ride = await Ride.findById(rideId);
    if (!ride) return 0;

    const totalSeats = ride.totalSeats ?? ride.availableSeats;
    const activeBookings = await Booking.find({
        rideId: ride._id,
        status: { $in: ['pending', 'accepted'] },
    });

    const occupied = [...new Set(activeBookings.flatMap((b) => b.seatNumbers))];
    const bookedCount = activeBookings.reduce((sum, b) => sum + b.seatsBooked, 0);
    const available = Math.max(0, totalSeats - bookedCount);

    await Ride.findByIdAndUpdate(ride._id, {
        $set: { occupiedSeats: occupied, availableSeats: available },
    });
    return available;
}

function formatBooking(
    booking: BookingFields & { _id: Types.ObjectId },
    ride: RideFields & { _id: Types.ObjectId },
    passenger: SafeUser,
) {
    return {
        id: booking._id.toString(),
        rideId: ride._id.toString(),
        passengerId: passenger.id,
        seatsBooked: booking.seatsBooked,
        seatNumbers: booking.seatNumbers,
        status: booking.status,
        createdAt: booking.createdAt,
    };
}
