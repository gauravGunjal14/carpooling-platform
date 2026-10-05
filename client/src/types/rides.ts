export type RideLocation = {
    displayName: string;
    latitude: number;
    longitude: number;
};

export type Ride = {
    id: string;
    driver: {
        id: string;
        displayName: string;
        isVerified: boolean;
    };
    pickup: RideLocation;
    destination: RideLocation;
    departureAt: string;
    totalSeats?: number;
    availableSeats: number;
    preferences: {
        smokingAllowed: boolean;
        luggage: 'small' | 'standard' | 'large';
        notes: string;
    };
    womenOnly: boolean;
    status: 'scheduled' | 'active' | 'cancelled' | 'completed';
    createdAt: string;
    updatedAt: string;
};

export type AnonymousTrustSummary = {
    trustScore: number;
    isVerified: boolean;
    completedRides: number;
    rating: number;
};

export type SeatStatusInfo = {
    seatNumber: number;
    isOccupied: boolean;
    isMySeat?: boolean;
    trustSummary?: AnonymousTrustSummary;
};

export type BookingStatus =
    'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

export type Booking = {
    id: string;
    rideId: string;
    passengerId?: string;
    seatsBooked: number;
    seatNumbers: number[];
    status: BookingStatus;
    cancellationReason?: string;
    createdAt: string;
    passenger?: {
        id: string;
        displayName: string;
        email: string;
        isVerified: boolean;
    } | null;
    ride?: {
        id: string;
        pickup: RideLocation;
        destination: RideLocation;
        departureAt: string;
        status: 'scheduled' | 'active' | 'cancelled' | 'completed';
        driver: {
            id: string;
            displayName: string;
            isVerified: boolean;
        };
    } | null;
};

export type ConfirmedPassenger = {
    bookingId: string;
    passengerId: string;
    name: string;
    email: string;
    seatNumbers: number[];
    seatsBooked: number;
    bookedAt: string;
};

export type RideMatchMetadata = {
    matchScore: number;
    pickupDistanceKm: number;
    destinationDistanceKm: number;
    routeCompatibilityScore: number;
    matchReasons: string[];
};

export type RideSearchResult = RideMatchMetadata & {
    ride: Ride;
};

export type RideFormInput = Omit<
    Ride,
    'id' | 'driver' | 'status' | 'createdAt' | 'updatedAt'
>;
