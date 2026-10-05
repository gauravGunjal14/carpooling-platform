import assert from 'node:assert/strict';
import test from 'node:test';
import {
    canAccessWomenOnlyRide,
    haversineDistanceKm,
    isWithinMatchingRadius,
    matchingConfig,
    rankRideMatches,
    scoreRideMatch,
    type MatchableRide,
    type MatchOptions,
} from './matchingService.js';

const requestedPickup = { latitude: 19.076, longitude: 72.8777 };
const requestedDestination = { latitude: 18.5204, longitude: 73.8567 };
const fixedNow = new Date('2030-01-01T00:00:00.000Z');
const requestedDepartureAt = new Date('2030-01-01T10:00:00.000Z');

function createRide(overrides: Partial<MatchableRide> = {}): MatchableRide {
    return {
        pickup: requestedPickup,
        destination: requestedDestination,
        departureAt: new Date('2030-01-01T10:00:00.000Z'),
        availableSeats: 3,
        status: 'scheduled',
        womenOnly: false,
        ...overrides,
    };
}

function createOptions(overrides: Partial<MatchOptions> = {}): MatchOptions {
    return {
        pickup: requestedPickup,
        destination: requestedDestination,
        requestedDepartureAt,
        timeWindowMinutes: matchingConfig.defaultTimeWindowMinutes,
        requiredSeats: 1,
        driverIsVerified: true,
        passengerIsWomenOnlyEligible: false,
        driverIsWomenOnlyEligible: false,
        now: fixedNow,
        ...overrides,
    };
}

test('Haversine returns geographic distance in kilometers to one decimal place', () => {
    assert.equal(
        haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
        111.2,
    );
    assert.throws(
        () =>
            haversineDistanceKm(
                { latitude: 91, longitude: 0 },
                { latitude: 0, longitude: 0 },
            ),
        RangeError,
    );
});

test('matching radius includes 30 km and excludes distances beyond it', () => {
    assert.equal(matchingConfig.radiusKm, 30);
    assert.equal(isWithinMatchingRadius(30), true);
    assert.equal(isWithinMatchingRadius(30.01), false);

    const longitudeAtKm = (kilometers: number) =>
        (kilometers / 6371.0088) * (180 / Math.PI);
    assert.ok(
        scoreRideMatch(
            createRide({
                pickup: { latitude: 0, longitude: longitudeAtKm(30) },
            }),
            createOptions({ pickup: { latitude: 0, longitude: 0 } }),
        ),
    );
    assert.equal(
        scoreRideMatch(
            createRide({
                pickup: { latitude: 0, longitude: longitudeAtKm(30.05) },
            }),
            createOptions({ pickup: { latitude: 0, longitude: 0 } }),
        ),
        null,
    );
});

test('pickup and destination are independently checked against the radius', () => {
    const farPickup = { latitude: 18.5204, longitude: 73.8567 };
    assert.equal(
        scoreRideMatch(createRide({ pickup: farPickup }), createOptions()),
        null,
    );

    const nearbyDestination = {
        latitude: requestedDestination.latitude + 0.02,
        longitude: requestedDestination.longitude,
    };
    const fartherDestination = {
        latitude: requestedDestination.latitude + 0.12,
        longitude: requestedDestination.longitude,
    };
    const options = createOptions({ requestedDepartureAt: undefined });
    const closerMatch = scoreRideMatch(
        createRide({ destination: nearbyDestination }),
        options,
    );
    const fartherMatch = scoreRideMatch(
        createRide({ destination: fartherDestination }),
        options,
    );

    assert.ok(closerMatch);
    assert.ok(fartherMatch);
    assert.ok(closerMatch.matchScore > fartherMatch.matchScore);
});

test('a requested departure is compatible up to the configured two-hour window', () => {
    const nearbyInTime = scoreRideMatch(
        createRide({ departureAt: new Date('2030-01-01T12:00:00.000Z') }),
        createOptions(),
    );
    const outsideWindow = scoreRideMatch(
        createRide({ departureAt: new Date('2030-01-01T12:01:00.000Z') }),
        createOptions(),
    );
    const exactTime = scoreRideMatch(createRide(), createOptions());

    assert.ok(nearbyInTime);
    assert.equal(outsideWindow, null);
    assert.ok(exactTime);
    assert.ok(exactTime.matchScore > nearbyInTime.matchScore);
    assert.ok(
        nearbyInTime.matchReasons.includes(
            'Departure is 120 minutes from your requested time',
        ),
    );
});

test('past rides, cancelled rides, and rides without enough seats are excluded', () => {
    assert.equal(
        scoreRideMatch(
            createRide({ departureAt: new Date('2029-12-31T23:59:00.000Z') }),
            createOptions(),
        ),
        null,
    );
    assert.equal(
        scoreRideMatch(createRide({ status: 'cancelled' }), createOptions()),
        null,
    );
    assert.equal(
        scoreRideMatch(
            createRide({ availableSeats: 1 }),
            createOptions({ requiredSeats: 2 }),
        ),
        null,
    );
});

test('women-only rides require both admin-granted eligibility flags', () => {
    const womenOnlyRide = createRide({ womenOnly: true });
    assert.equal(canAccessWomenOnlyRide(true, false, true), false);
    assert.equal(canAccessWomenOnlyRide(true, true, false), false);
    assert.equal(canAccessWomenOnlyRide(true, true, true), true);
    assert.equal(canAccessWomenOnlyRide(false, false, false), true);
    assert.equal(scoreRideMatch(womenOnlyRide, createOptions()), null);
    assert.ok(
        scoreRideMatch(
            womenOnlyRide,
            createOptions({
                passengerIsWomenOnlyEligible: true,
                driverIsWomenOnlyEligible: true,
            }),
        ),
    );
});

test('match scores and reasons use calculated distances, time, seats, and verification', () => {
    const result = scoreRideMatch(
        createRide({ availableSeats: 5 }),
        createOptions({ requiredSeats: 2 }),
    );

    assert.ok(result);
    assert.equal(result.matchScore, 100);
    assert.equal(result.pickupDistanceKm, 0);
    assert.equal(result.destinationDistanceKm, 0);
    assert.equal(result.routeCompatibilityScore, 100);
    assert.deepEqual(result.matchReasons, [
        'Pickup is 0.0 km from your selected pickup',
        'Destination is 0.0 km from your selected destination',
        'Enough seats for 2 passengers',
        'Departure matches your requested time',
        'Verified driver',
    ]);
});

test('ride ranking sorts by score, then route distance, then departure time', () => {
    const laterDeparture = {
        ...scoreRideMatch(createRide(), createOptions())!,
        id: 'later',
        departureAt: new Date('2030-01-01T11:00:00.000Z'),
    };
    const earlierDeparture = {
        ...laterDeparture,
        id: 'earlier',
        departureAt: new Date('2030-01-01T10:30:00.000Z'),
    };
    const lowerScore = {
        ...scoreRideMatch(
            createRide({
                availableSeats: 1,
                pickup: { latitude: 19.15, longitude: 72.8777 },
            }),
            createOptions({ driverIsVerified: false }),
        )!,
        id: 'lower-score',
        departureAt: new Date('2030-01-01T10:15:00.000Z'),
    };

    assert.deepEqual(
        rankRideMatches(
            [laterDeparture, lowerScore, earlierDeparture],
            (ride) => ride.departureAt,
        ).map((ride) => ride.id),
        ['earlier', 'later', 'lower-score'],
    );
});
