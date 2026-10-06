import { Types } from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Ride, type RideFields, type RideLocationFields } from '../models/Ride.js';
import { User } from '../models/User.js';
import { VerificationSubmission } from '../models/VerificationSubmission.js';
import { createNotification } from './notificationService.js';
import { processCancellationRefund } from './refundService.js';
import { sendDriverCancellationEmail } from './emailService.js';
import {
    haversineDistanceKm,
    matchingConfig,
    rankRideMatches,
    scoreRideMatch,
} from './matchingService.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { isWomenOnlyEligible } from './verificationService.js';

export { isWomenOnlyEligible };

export type RideLocationInput = {
    displayName: string;
    latitude: number;
    longitude: number;
};

export type RideInput = {
    pickup: RideLocationInput;
    destination: RideLocationInput;
    departureAt: string;
    availableSeats: number;
    preferences: {
        smokingAllowed: boolean;
        luggage: 'small' | 'standard' | 'large';
        notes: string;
    };
    womenOnly: boolean;
};

export type RideSearchInput = {
    pickup: RideLocationInput;
    destination: RideLocationInput;
    dateStart: string;
    dateEnd: string;
    departureAt?: string;
    timeWindowMinutes: number;
    requiredSeats: number;
};

type RideDocument = RideFields & { _id: Types.ObjectId };
type DriverSummary = {
    id: string;
    displayName: string;
    isVerified: boolean;
    isPro?: boolean;
};

export async function createRide(driver: SafeUser, input: RideInput) {
    const normalized = validateRideInput(input);
    if (normalized.womenOnly) {
        await assertWomenOnlyEligibility(driver.id, 'Driver');
    }
    const ride = await Ride.create({
        driverId: driver.id,
        ...normalized,
        status: 'scheduled',
    });
    return (await formatManyRides([ride.toObject() as RideDocument]))[0];
}

export async function getMyRides(driver: SafeUser) {
    const rides = (await Ride.find({ driverId: driver.id })
        .sort({ departureAt: 1, createdAt: -1 })
        .limit(100)
        .lean()) as unknown as RideDocument[];
    return formatManyRides(rides);
}

export async function getMyRide(driver: SafeUser, id: string) {
    const ride = await Ride.findOne({ _id: id, driverId: driver.id });
    if (!ride) throw rideNotFound();
    return (await formatManyRides([ride.toObject() as RideDocument]))[0];
}

export async function updateMyRide(driver: SafeUser, id: string, input: RideInput) {
    const ride = await Ride.findOne({ _id: id, driverId: driver.id });
    if (!ride) throw rideNotFound();
    assertUpcoming(ride);

    const normalized = validateRideInput(input);
    if (normalized.womenOnly) {
        await assertWomenOnlyEligibility(driver.id, 'Driver');
    }
    const updated = await Ride.findOneAndUpdate(
        {
            _id: id,
            driverId: driver.id,
            status: 'scheduled',
            departureAt: { $gt: new Date() },
        },
        { $set: normalized },
        { returnDocument: 'after', runValidators: true },
    );
    if (!updated) {
        throw new AppError(
            409,
            'RIDE_NOT_EDITABLE',
            'This ride can no longer be edited.',
        );
    }
    return getMyRide(driver, id);
}

export async function cancelMyRide(driver: SafeUser, id: string) {
    const ride = await Ride.findOne({ _id: id, driverId: driver.id });
    if (!ride) throw rideNotFound();
    assertUpcoming(ride);

    // Driver cancellation window enforcement: Standard = 30 hrs, Pro = 12 hrs
    const driverUser = await User.findById(driver.id);
    const isPro = driverUser?.driverTier === 'pro';
    const cutoffHours = isPro ? 12 : 30;
    const hoursBeforeDeparture =
        (ride.departureAt.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursBeforeDeparture < cutoffHours) {
        throw new AppError(
            400,
            'CANCELLATION_WINDOW_CLOSED',
            `Drivers cannot cancel within ${cutoffHours} hours of departure (${isPro ? 'Pro' : 'Standard'} driver policy).`,
        );
    }

    const cancelled = await Ride.findOneAndUpdate(
        {
            _id: id,
            driverId: driver.id,
            status: 'scheduled',
            departureAt: { $gt: new Date() },
        },
        { $set: { status: 'cancelled' } },
        { returnDocument: 'after' },
    );
    if (!cancelled) {
        throw new AppError(
            409,
            'RIDE_NOT_CANCELLABLE',
            'This ride can no longer be cancelled.',
        );
    }

    // Cancel all active bookings on this ride and notify passengers
    const affectedBookings = await Booking.find({
        rideId: ride._id,
        status: { $in: ['pending', 'accepted'] },
    });

    for (const b of affectedBookings) {
        b.status = 'cancelled';
        b.cancellationReason = 'Ride cancelled by driver';
        b.cancelledAt = new Date();
        b.cancelledBy = new Types.ObjectId(driver.id);
        await b.save();

        await processCancellationRefund(b, {
            reason: 'Ride cancelled by driver',
            cancelledByRole: 'Driver',
            hoursBeforeDeparture,
        });

        await createNotification(
            b.passengerId,
            'booking_cancelled',
            'Ride Cancelled by Driver',
            `Your scheduled trip on ${new Date(ride.departureAt).toLocaleDateString()} was cancelled by the driver. Any held seats have been released.`,
            { rideId: ride._id.toString(), bookingId: b._id.toString() },
        );

        const passengerUser = await User.findById(b.passengerId).select('name email');
        if (passengerUser) {
            void sendDriverCancellationEmail(passengerUser.email, {
                passengerName: passengerUser.name,
                driverName: driver.name,
                route: `${ride.pickup.displayName} → ${ride.destination.displayName}`,
                departureAt: new Date(ride.departureAt).toLocaleString(),
            });
        }
    }

    return getMyRide(driver, id);
}

export async function startRide(driver: SafeUser, id: string) {
    const ride = await Ride.findOne({ _id: id, driverId: driver.id });
    if (!ride) throw rideNotFound();

    if (ride.status !== 'scheduled') {
        throw new AppError(
            400,
            'INVALID_RIDE_TRANSITION',
            `Cannot start a ride with status '${ride.status}'.`,
        );
    }

    ride.status = 'active';
    await ride.save();

    // Notify passengers that ride is active
    const acceptedBookings = await Booking.find({
        rideId: ride._id,
        status: 'accepted',
    });
    for (const b of acceptedBookings) {
        await createNotification(
            b.passengerId,
            'ride_status_changed',
            'Your Ride Has Started',
            'The driver has marked your trip as active and in progress.',
            {
                rideId: ride._id.toString(),
                bookingId: b._id.toString(),
                status: 'active',
            },
        );
    }

    return getMyRide(driver, id);
}

export async function completeRide(driver: SafeUser, id: string) {
    const ride = await Ride.findOne({ _id: id, driverId: driver.id });
    if (!ride) throw rideNotFound();

    if (ride.status !== 'scheduled' && ride.status !== 'active') {
        throw new AppError(
            400,
            'INVALID_RIDE_TRANSITION',
            `Cannot complete a ride with status '${ride.status}'.`,
        );
    }

    ride.status = 'completed';
    await ride.save();

    // Mark all accepted bookings as completed
    const acceptedBookings = await Booking.find({
        rideId: ride._id,
        status: 'accepted',
    });
    for (const b of acceptedBookings) {
        b.status = 'completed';
        await b.save();

        await createNotification(
            b.passengerId,
            'ride_completed',
            'Trip Completed!',
            'Your ride has concluded safely. You can now leave a rating for your driver.',
            { rideId: ride._id.toString(), bookingId: b._id.toString() },
        );
    }

    // Also notify driver that ratings are unlocked
    await createNotification(
        driver.id,
        'ride_completed',
        'Trip Concluded',
        'Your ride is marked complete. You can now review your passengers.',
        { rideId: ride._id.toString() },
    );

    return getMyRide(driver, id);
}

export async function searchRides(passenger: SafeUser, input: RideSearchInput) {
    const dateStart = new Date(input.dateStart);
    const dateEnd = new Date(input.dateEnd);
    if (
        !Number.isFinite(dateStart.getTime()) ||
        !Number.isFinite(dateEnd.getTime()) ||
        dateStart >= dateEnd ||
        dateEnd.getTime() - dateStart.getTime() > 26 * 60 * 60 * 1000
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Choose a valid local departure date.',
        );
    }

    const sameLocation =
        normalizeLocation(input.pickup.displayName) ===
            normalizeLocation(input.destination.displayName) ||
        haversineDistanceKm(input.pickup, input.destination) < 0.01;
    if (sameLocation) {
        throw new AppError(
            400,
            'IDENTICAL_LOCATIONS',
            'Pickup and destination must be different locations.',
        );
    }

    if (
        input.departureAt !== undefined &&
        !Number.isFinite(new Date(input.departureAt).getTime())
    ) {
        throw new AppError(
            400,
            'INVALID_DEPARTURE_TIME',
            'Choose a valid requested departure time.',
        );
    }

    const query: Record<string, unknown> = {
        status: 'scheduled',
        departureAt: { $gte: dateStart, $lt: dateEnd, $gt: new Date() },
        availableSeats: { $gte: input.requiredSeats },
        'pickup.point': {
            $geoWithin: {
                $centerSphere: [
                    [input.pickup.longitude, input.pickup.latitude],
                    matchingConfig.radiusKm / 6371.0088,
                ],
            },
        },
    };
    if (input.departureAt) {
        const requestedTime = new Date(input.departureAt).getTime();
        const radius = input.timeWindowMinutes * 60 * 1000;
        const departureQuery = query.departureAt as Record<string, Date>;
        departureQuery.$gte = new Date(
            Math.max(dateStart.getTime(), requestedTime - radius),
        );
        const windowEnd = requestedTime + radius;
        if (windowEnd < dateEnd.getTime()) {
            departureQuery.$lte = new Date(windowEnd);
        }
    }

    const rides = (await Ride.find(query)
        .sort({ departureAt: 1 })
        .limit(matchingConfig.maximumCandidates)
        .lean()) as unknown as RideDocument[];
    const formatted = await formatManyRides(rides);
    const [passengerEligible, eligibleDrivers] = await Promise.all([
        isWomenOnlyEligible(passenger.id, 'Passenger'),
        getEligibleWomenOnlyDriverIds(formatted.map((ride) => ride.driver.id)),
    ]);
    const matches = formatted.flatMap((ride) => {
        const match = scoreRideMatch(ride, {
            pickup: input.pickup,
            destination: input.destination,
            requestedDepartureAt: input.departureAt,
            timeWindowMinutes: input.timeWindowMinutes,
            requiredSeats: input.requiredSeats,
            driverIsVerified: ride.driver.isVerified,
            passengerIsWomenOnlyEligible: passengerEligible,
            driverIsWomenOnlyEligible: eligibleDrivers.has(ride.driver.id),
        });
        return match ? [{ ride, ...match }] : [];
    });
    return rankRideMatches(
        matches,
        (match) => match.ride.departureAt,
        (match) => Boolean(match.ride.driver.isPro),
    );
}

export async function getPassengerRide(passenger: SafeUser, id: string) {
    const ride = await Ride.findOne({
        _id: id,
        status: 'scheduled',
        departureAt: { $gt: new Date() },
    });
    if (!ride) throw rideNotFound();

    if (ride.womenOnly) {
        const [passengerEligible, eligibleDrivers] = await Promise.all([
            isWomenOnlyEligible(passenger.id, 'Passenger'),
            getEligibleWomenOnlyDriverIds([ride.driverId.toString()]),
        ]);
        if (!passengerEligible || !eligibleDrivers.has(ride.driverId.toString())) {
            throw rideNotFound();
        }
    }
    return (await formatManyRides([ride.toObject() as RideDocument]))[0];
}

export async function getAdminRides() {
    const rides = (await Ride.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()) as unknown as RideDocument[];
    return formatManyRides(rides);
}

export async function getAdminRide(id: string) {
    const ride = await Ride.findById(id).lean();
    if (!ride) throw rideNotFound();
    return (await formatManyRides([ride as unknown as RideDocument]))[0];
}

export function normalizeLocation(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export async function assertWomenOnlyEligibility(
    userId: string,
    role: 'Driver' | 'Passenger',
): Promise<void> {
    if (!(await isWomenOnlyEligible(userId, role))) {
        throw new AppError(
            403,
            'WOMEN_ONLY_NOT_ELIGIBLE',
            'An administrator must grant women-only ride eligibility after verification.',
        );
    }
}

async function getEligibleWomenOnlyDriverIds(driverIds: string[]): Promise<Set<string>> {
    if (driverIds.length === 0) return new Set();
    const eligibleIds = await VerificationSubmission.distinct('userId', {
        userId: { $in: driverIds },
        documentType: 'driver_license',
        status: 'approved',
        womenOnlyEligible: true,
    });
    return new Set(eligibleIds.map((id) => id.toString()));
}

function validateRideInput(input: RideInput) {
    const departureAt = new Date(input.departureAt);
    if (!Number.isFinite(departureAt.getTime()) || departureAt.getTime() <= Date.now()) {
        throw new AppError(400, 'INVALID_DEPARTURE', 'Departure must be in the future.');
    }

    const pickup = toStoredLocation(input.pickup);
    const destination = toStoredLocation(input.destination);
    if (
        pickup.searchKey === destination.searchKey ||
        (Math.abs(pickup.latitude - destination.latitude) < 0.000001 &&
            Math.abs(pickup.longitude - destination.longitude) < 0.000001)
    ) {
        throw new AppError(
            400,
            'IDENTICAL_LOCATIONS',
            'Pickup and destination must be different locations.',
        );
    }
    return { ...input, pickup, destination, departureAt };
}

function toStoredLocation(location: RideLocationInput): RideLocationFields {
    return {
        displayName: location.displayName.trim(),
        searchKey: normalizeLocation(location.displayName),
        latitude: location.latitude,
        longitude: location.longitude,
        point: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude],
        },
    };
}

function assertUpcoming(ride: Pick<RideFields, 'status' | 'departureAt'>): void {
    if (ride.status !== 'scheduled' || ride.departureAt.getTime() <= Date.now()) {
        throw new AppError(
            409,
            'RIDE_NOT_EDITABLE',
            'Only scheduled rides that have not departed can be changed.',
        );
    }
}

async function formatManyRides(rides: RideDocument[]) {
    if (rides.length === 0) return [];
    const driverIds = [...new Set(rides.map((ride) => ride.driverId.toString()))];
    const [drivers, verifiedDriverIds] = await Promise.all([
        User.find({ _id: { $in: driverIds }, status: 'active' }).select(
            'name driverTier',
        ),
        VerificationSubmission.distinct('userId', {
            userId: { $in: driverIds },
            documentType: 'driver_license',
            status: 'approved',
        }),
    ]);
    const driverInfo = new Map(
        drivers.map((driver) => [
            driver.id,
            { name: driver.name, isPro: driver.driverTier === 'pro' },
        ]),
    );
    const verifiedSet = new Set(verifiedDriverIds.map((id) => id.toString()));
    return rides.map((ride) => formatRide(ride, driverInfo, verifiedSet));
}

function formatRide(
    ride: RideDocument,
    drivers: Map<string, { name: string; isPro: boolean }>,
    verifiedDriverIds: Set<string>,
) {
    const driverId = ride.driverId.toString();
    const driverData = drivers.get(driverId);
    return {
        id: ride._id.toString(),
        driver: {
            id: driverId,
            displayName: driverData?.name ?? 'Driver',
            isVerified: verifiedDriverIds.has(driverId),
            isPro: driverData?.isPro ?? false,
        } satisfies DriverSummary,
        pickup: formatLocation(ride.pickup),
        destination: formatLocation(ride.destination),
        departureAt: ride.departureAt,
        totalSeats: ride.totalSeats ?? ride.availableSeats,
        availableSeats: ride.availableSeats,
        pricePerSeat: ride.pricePerSeat ?? 250,
        preferences: ride.preferences,
        womenOnly: ride.womenOnly,
        status: ride.status,
        createdAt: ride.createdAt,
        updatedAt: ride.updatedAt,
    };
}

function formatLocation(location: RideLocationFields) {
    return {
        displayName: location.displayName,
        latitude: location.latitude,
        longitude: location.longitude,
    };
}

function rideNotFound(): AppError {
    return new AppError(404, 'RIDE_NOT_FOUND', 'Ride not found.');
}
