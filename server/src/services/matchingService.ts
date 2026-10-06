const earthRadiusKm = 6371.0088;

export const matchingConfig = {
    radiusKm: 30,
    defaultTimeWindowMinutes: 120,
    maximumCandidates: 200,
    weights: {
        pickupProximity: 30,
        destinationProximity: 30,
        timeCompatibility: 20,
        seatFlexibility: 10,
        driverVerification: 10,
    },
} as const;

export type Coordinates = {
    latitude: number;
    longitude: number;
};

export type MatchableRide = {
    pickup: Coordinates;
    destination: Coordinates;
    departureAt: string | Date;
    availableSeats: number;
    status: string;
    womenOnly: boolean;
};

export type MatchOptions = {
    pickup: Coordinates;
    destination: Coordinates;
    requestedDepartureAt?: string | Date;
    timeWindowMinutes: number;
    requiredSeats: number;
    driverIsVerified: boolean;
    passengerIsWomenOnlyEligible: boolean;
    driverIsWomenOnlyEligible: boolean;
    now?: Date;
};

export type MatchMetadata = {
    matchScore: number;
    pickupDistanceKm: number;
    destinationDistanceKm: number;
    routeCompatibilityScore: number;
    matchReasons: string[];
};

export function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
    return roundDistance(rawHaversineDistanceKm(from, to));
}

function rawHaversineDistanceKm(from: Coordinates, to: Coordinates): number {
    validateCoordinates(from);
    validateCoordinates(to);

    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDifference = radians(to.latitude - from.latitude);
    const longitudeDifference = radians(to.longitude - from.longitude);
    const haversine =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(radians(from.latitude)) *
            Math.cos(radians(to.latitude)) *
            Math.sin(longitudeDifference / 2) ** 2;
    const centralAngle =
        2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
    return earthRadiusKm * centralAngle;
}

export function isWithinMatchingRadius(distanceKm: number): boolean {
    return Number.isFinite(distanceKm) && distanceKm <= matchingConfig.radiusKm;
}

export function canAccessWomenOnlyRide(
    isWomenOnly: boolean,
    passengerIsEligible: boolean,
    driverIsEligible: boolean,
): boolean {
    return !isWomenOnly || (passengerIsEligible && driverIsEligible);
}

export function scoreRideMatch(
    ride: MatchableRide,
    options: MatchOptions,
): MatchMetadata | null {
    const departureTime = new Date(ride.departureAt).getTime();
    if (
        ride.status !== 'scheduled' ||
        !Number.isFinite(departureTime) ||
        departureTime <= (options.now ?? new Date()).getTime() ||
        ride.availableSeats < options.requiredSeats ||
        (options.requestedDepartureAt !== undefined &&
            (!Number.isFinite(options.timeWindowMinutes) ||
                options.timeWindowMinutes <= 0)) ||
        !canAccessWomenOnlyRide(
            ride.womenOnly,
            options.passengerIsWomenOnlyEligible,
            options.driverIsWomenOnlyEligible,
        )
    ) {
        return null;
    }

    let pickupDistance: number;
    let destinationDistance: number;
    try {
        pickupDistance = rawHaversineDistanceKm(options.pickup, ride.pickup);
        destinationDistance = rawHaversineDistanceKm(
            options.destination,
            ride.destination,
        );
    } catch {
        return null;
    }
    if (
        !isWithinMatchingRadius(pickupDistance) ||
        !isWithinMatchingRadius(destinationDistance)
    ) {
        return null;
    }

    const timeDifferenceMinutes = options.requestedDepartureAt
        ? Math.abs(
              new Date(ride.departureAt).getTime() -
                  new Date(options.requestedDepartureAt).getTime(),
          ) / 60000
        : undefined;
    if (
        timeDifferenceMinutes !== undefined &&
        (!Number.isFinite(timeDifferenceMinutes) ||
            timeDifferenceMinutes > options.timeWindowMinutes)
    ) {
        return null;
    }

    const pickupFactor = 1 - pickupDistance / matchingConfig.radiusKm;
    const destinationFactor = 1 - destinationDistance / matchingConfig.radiusKm;
    const timeFactor =
        timeDifferenceMinutes === undefined
            ? undefined
            : 1 - timeDifferenceMinutes / options.timeWindowMinutes;
    const spareSeats = ride.availableSeats - options.requiredSeats;
    // Extra seats add limited flexibility after the hard seat-count filter.
    const seatFactor = 0.5 + Math.min(spareSeats, 3) / 6;
    const factors: Array<{ weight: number; value: number }> = [
        {
            weight: matchingConfig.weights.pickupProximity,
            value: pickupFactor,
        },
        {
            weight: matchingConfig.weights.destinationProximity,
            value: destinationFactor,
        },
        {
            weight: matchingConfig.weights.seatFlexibility,
            value: seatFactor,
        },
        {
            weight: matchingConfig.weights.driverVerification,
            value: options.driverIsVerified ? 1 : 0,
        },
    ];
    if (timeFactor !== undefined) {
        factors.push({
            weight: matchingConfig.weights.timeCompatibility,
            value: timeFactor,
        });
    }

    const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0);
    const weightedScore = factors.reduce(
        (total, factor) => total + factor.value * factor.weight,
        0,
    );
    const roundedPickupDistance = roundDistance(pickupDistance);
    const roundedDestinationDistance = roundDistance(destinationDistance);
    const matchReasons = [
        `Pickup is ${roundedPickupDistance.toFixed(1)} km from your selected pickup`,
        `Destination is ${roundedDestinationDistance.toFixed(1)} km from your selected destination`,
        `Enough seats for ${options.requiredSeats} ${options.requiredSeats === 1 ? 'passenger' : 'passengers'}`,
    ];
    if (timeDifferenceMinutes !== undefined) {
        matchReasons.push(
            timeDifferenceMinutes < 1
                ? 'Departure matches your requested time'
                : `Departure is ${Math.round(timeDifferenceMinutes)} minutes from your requested time`,
        );
    }
    if (options.driverIsVerified) matchReasons.push('Verified driver');

    return {
        matchScore: Math.round((weightedScore / totalWeight) * 100),
        pickupDistanceKm: roundedPickupDistance,
        destinationDistanceKm: roundedDestinationDistance,
        routeCompatibilityScore: Math.round(
            ((pickupFactor + destinationFactor) / 2) * 100,
        ),
        matchReasons,
    };
}

export function rankRideMatches<T extends MatchMetadata>(
    matches: T[],
    getDepartureAt: (match: T) => string | Date,
    getIsPro?: (match: T) => boolean,
): T[] {
    return [...matches].sort((left, right) => {
        const leftPro = getIsPro ? (getIsPro(left) ? 1 : 0) : 0;
        const rightPro = getIsPro ? (getIsPro(right) ? 1 : 0) : 0;
        return (
            rightPro - leftPro ||
            right.matchScore - left.matchScore ||
            left.pickupDistanceKm +
                left.destinationDistanceKm -
                (right.pickupDistanceKm + right.destinationDistanceKm) ||
            new Date(getDepartureAt(left)).getTime() -
                new Date(getDepartureAt(right)).getTime()
        );
    });
}

function validateCoordinates(coordinates: Coordinates): void {
    if (
        !Number.isFinite(coordinates.latitude) ||
        coordinates.latitude < -90 ||
        coordinates.latitude > 90 ||
        !Number.isFinite(coordinates.longitude) ||
        coordinates.longitude < -180 ||
        coordinates.longitude > 180
    ) {
        throw new RangeError('Coordinates must contain valid latitude and longitude.');
    }
}

function roundDistance(distance: number): number {
    return Math.round(distance * 10) / 10;
}
