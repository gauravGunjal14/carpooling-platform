import { Booking } from '../models/Booking.js';
import { Ride, type RideFields } from '../models/Ride.js';
import { User } from '../models/User.js';
import { VerificationSubmission } from '../models/VerificationSubmission.js';
import type { SafeUser } from '../types/auth.js';
import { isWomenOnlyEligible } from './verificationService.js';
import { haversineDistanceKm } from './matchingService.js';

export interface SmartSuggestion {
    ride: {
        id: string;
        driver: {
            id: string;
            displayName: string;
            isVerified: boolean;
            isPro?: boolean;
        };
        pickup: {
            displayName: string;
            latitude: number;
            longitude: number;
        };
        destination: {
            displayName: string;
            latitude: number;
            longitude: number;
        };
        departureAt: Date;
        availableSeats: number;
        pricePerSeat: number;
        womenOnly: boolean;
        status: string;
    };
    suggestionScore: number;
    explanation: string;
    reasons: string[];
}

export async function getSmartRideSuggestions(
    passenger: SafeUser,
    limit = 6,
): Promise<SmartSuggestion[]> {
    // 1. Fetch passenger's past bookings to analyze behavioral patterns
    const pastBookings = await Booking.find({
        passengerId: passenger.id,
        status: { $in: ['accepted', 'completed'] },
    })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    const pastRideIds = pastBookings.map((b) => b.rideId);
    const pastRides = await Ride.find({ _id: { $in: pastRideIds } }).lean();

    // Collect frequently visited route coordinates, drivers, and hours
    const preferredPickups: { latitude: number; longitude: number; name: string }[] = [];
    const preferredDestinations: { latitude: number; longitude: number; name: string }[] =
        [];
    const frequentDriverIds = new Set<string>();
    const frequentHours: number[] = [];

    for (const r of pastRides) {
        preferredPickups.push({
            latitude: r.pickup.latitude,
            longitude: r.pickup.longitude,
            name: r.pickup.displayName,
        });
        preferredDestinations.push({
            latitude: r.destination.latitude,
            longitude: r.destination.longitude,
            name: r.destination.displayName,
        });
        frequentDriverIds.add(r.driverId.toString());
        frequentHours.push(new Date(r.departureAt).getHours());
    }

    // 2. Query available upcoming scheduled rides
    const now = new Date();
    const activeBookingRideIds = (
        await Booking.find({
            passengerId: passenger.id,
            status: { $in: ['pending', 'accepted'] },
        }).select('rideId')
    ).map((b) => b.rideId.toString());

    const candidateRides = await Ride.find({
        status: 'scheduled',
        departureAt: { $gt: now },
        availableSeats: { $gt: 0 },
        driverId: { $ne: passenger.id },
        _id: { $nin: activeBookingRideIds },
    })
        .sort({ departureAt: 1 })
        .limit(50)
        .lean();

    if (candidateRides.length === 0) {
        return [];
    }

    // Check women-only eligibility
    const passengerWomenOnly = await isWomenOnlyEligible(passenger.id, 'Passenger');

    // Load drivers info
    const driverIds = [...new Set(candidateRides.map((r) => r.driverId.toString()))];
    const [drivers, verifiedDriverIds] = await Promise.all([
        User.find({ _id: { $in: driverIds }, status: 'active' })
            .select('name driverTier')
            .lean(),
        VerificationSubmission.distinct('userId', {
            userId: { $in: driverIds },
            documentType: 'driver_license',
            status: 'approved',
        }),
    ]);

    const driverMap = new Map(
        drivers.map((d) => [
            d._id.toString(),
            { name: d.name, isPro: d.driverTier === 'pro' },
        ]),
    );
    const verifiedSet = new Set(verifiedDriverIds.map((id) => id.toString()));

    const scoredSuggestions: SmartSuggestion[] = [];

    for (const ride of candidateRides) {
        // Exclude incompatible women-only rides
        if (ride.womenOnly && !passengerWomenOnly) {
            continue;
        }

        let score = 50; // base score for upcoming open ride
        const reasons: string[] = [];

        const rideDeparture = new Date(ride.departureAt);
        const rideHour = rideDeparture.getHours();
        const driverId = ride.driverId.toString();
        const driverInfo = driverMap.get(driverId);
        const isVerified = verifiedSet.has(driverId);
        const isPro = Boolean(driverInfo?.isPro);

        // Signal 1: Previously traveled with this driver
        if (frequentDriverIds.has(driverId)) {
            score += 25;
            reasons.push(
                `Previously traveled with driver ${driverInfo?.name ?? 'Driver'}`,
            );
        }

        // Signal 2: Route proximity to frequently booked pickups
        for (const p of preferredPickups) {
            const dist = haversineDistanceKm(
                { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude },
                { latitude: p.latitude, longitude: p.longitude },
            );
            if (dist <= 15) {
                score += 20;
                reasons.push(
                    `Pickup near your frequent departure area (${p.name.slice(0, 25)})`,
                );
                break;
            }
        }

        // Signal 3: Route proximity to frequently booked destinations
        for (const d of preferredDestinations) {
            const dist = haversineDistanceKm(
                {
                    latitude: ride.destination.latitude,
                    longitude: ride.destination.longitude,
                },
                { latitude: d.latitude, longitude: d.longitude },
            );
            if (dist <= 15) {
                score += 20;
                reasons.push(
                    `Destination matches your usual travels to ${d.name.slice(0, 25)}`,
                );
                break;
            }
        }

        // Signal 4: Preferred time window
        const matchesTimeWindow = frequentHours.some((h) => Math.abs(h - rideHour) <= 2);
        if (matchesTimeWindow) {
            score += 15;
            reasons.push(
                `Departure aligns with your typical travel hours (${rideHour}:00)`,
            );
        }

        // Signal 5: Trust and Pro perks
        if (isVerified) {
            score += 10;
            reasons.push('Verified safe driver');
        }
        if (isPro) {
            score += 15;
            reasons.push('Pro Driver priority listing');
        }

        if (reasons.length === 0) {
            reasons.push('Popular upcoming route with available seats');
        }

        const primaryExplanation = reasons[0];

        scoredSuggestions.push({
            ride: {
                id: ride._id.toString(),
                driver: {
                    id: driverId,
                    displayName: driverInfo?.name ?? 'Driver',
                    isVerified,
                    isPro,
                },
                pickup: {
                    displayName: ride.pickup.displayName,
                    latitude: ride.pickup.latitude,
                    longitude: ride.pickup.longitude,
                },
                destination: {
                    displayName: ride.destination.displayName,
                    latitude: ride.destination.latitude,
                    longitude: ride.destination.longitude,
                },
                departureAt: ride.departureAt,
                availableSeats: ride.availableSeats,
                pricePerSeat: ride.pricePerSeat ?? 250,
                womenOnly: ride.womenOnly,
                status: ride.status,
            },
            suggestionScore: Math.min(100, score),
            explanation: `Suggested because: ${primaryExplanation}.`,
            reasons,
        });
    }

    // Sort by suggestion score descending, then departure date ascending
    scoredSuggestions.sort(
        (a, b) =>
            b.suggestionScore - a.suggestionScore ||
            new Date(a.ride.departureAt).getTime() -
                new Date(b.ride.departureAt).getTime(),
    );

    return scoredSuggestions.slice(0, limit);
}
