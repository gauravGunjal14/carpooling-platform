import { Types } from 'mongoose';
import { Ride, type RideFields, type RideLocationFields } from '../models/Ride.js';
import { User } from '../models/User.js';
import { VerificationSubmission } from '../models/VerificationSubmission.js';
import type { SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';

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
type DriverSummary = { id: string; displayName: string; isVerified: boolean };

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
        { new: true, runValidators: true },
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

    const cancelled = await Ride.findOneAndUpdate(
        {
            _id: id,
            driverId: driver.id,
            status: 'scheduled',
            departureAt: { $gt: new Date() },
        },
        { $set: { status: 'cancelled' } },
        { new: true },
    );
    if (!cancelled) {
        throw new AppError(
            409,
            'RIDE_NOT_CANCELLABLE',
            'This ride can no longer be cancelled.',
        );
    }
    return getMyRide(driver, id);
}

export async function searchRides(passenger: SafeUser, input: RideSearchInput) {
    const dateStart = new Date(input.dateStart);
    const dateEnd = new Date(input.dateEnd);
    if (
        dateStart >= dateEnd ||
        dateEnd.getTime() - dateStart.getTime() > 26 * 60 * 60 * 1000
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Choose a valid local departure date.',
        );
    }

    const query: Record<string, unknown> = {
        status: 'scheduled',
        departureAt: { $gte: dateStart, $lt: dateEnd, $gt: new Date() },
        availableSeats: { $gte: input.requiredSeats },
        'pickup.searchKey': normalizeLocation(input.pickup.displayName),
        'destination.searchKey': normalizeLocation(input.destination.displayName),
    };
    if (input.departureAt) {
        const requestedTime = new Date(input.departureAt).getTime();
        const radius = input.timeWindowMinutes * 60 * 1000;
        (query.departureAt as Record<string, Date>).$gte = new Date(
            Math.max(dateStart.getTime(), requestedTime - radius),
        );
        (query.departureAt as Record<string, Date>).$lt = new Date(
            Math.min(dateEnd.getTime(), requestedTime + radius),
        );
    }

    const rides = (await Ride.find(query)
        .sort({ departureAt: 1 })
        .limit(50)
        .lean()) as unknown as RideDocument[];
    const formatted = await formatManyRides(rides);
    const [passengerEligible, eligibleDrivers] = await Promise.all([
        isWomenOnlyEligible(passenger.id, 'Passenger'),
        getEligibleWomenOnlyDriverIds(formatted.map((ride) => ride.driver.id)),
    ]);
    return formatted.filter(
        (ride) =>
            !ride.womenOnly || (passengerEligible && eligibleDrivers.has(ride.driver.id)),
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

async function isWomenOnlyEligible(
    userId: string,
    role: 'Driver' | 'Passenger',
): Promise<boolean> {
    const documentType = role === 'Driver' ? 'driver_license' : 'identity';
    return Boolean(
        await VerificationSubmission.exists({
            userId,
            documentType,
            status: 'approved',
            womenOnlyEligible: true,
        }),
    );
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
        User.find({ _id: { $in: driverIds }, status: 'active' }).select('name'),
        VerificationSubmission.distinct('userId', {
            userId: { $in: driverIds },
            documentType: 'driver_license',
            status: 'approved',
        }),
    ]);
    const driverInfo = new Map(drivers.map((driver) => [driver.id, driver.name]));
    const verifiedSet = new Set(verifiedDriverIds.map((id) => id.toString()));
    return rides.map((ride) => formatRide(ride, driverInfo, verifiedSet));
}

function formatRide(
    ride: RideDocument,
    drivers: Map<string, string>,
    verifiedDriverIds: Set<string>,
) {
    const driverId = ride.driverId.toString();
    return {
        id: ride._id.toString(),
        driver: {
            id: driverId,
            displayName: drivers.get(driverId) ?? 'Driver',
            isVerified: verifiedDriverIds.has(driverId),
        } satisfies DriverSummary,
        pickup: formatLocation(ride.pickup),
        destination: formatLocation(ride.destination),
        departureAt: ride.departureAt,
        availableSeats: ride.availableSeats,
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
