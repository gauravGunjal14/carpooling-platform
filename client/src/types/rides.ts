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
        isPro?: boolean;
    };
    pickup: RideLocation;
    destination: RideLocation;
    departureAt: string;
    totalSeats?: number;
    availableSeats: number;
    occupiedSeats?: number[];
    confirmedPassengerCount?: number;
    pendingPassengerCount?: number;
    pricePerSeat?: number;
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

export type PaymentMethod = 'upi' | 'gpay' | 'phonepe' | 'card' | 'netbanking';

export type PaymentStatus =
    | 'pending'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'refunded'
    | 'partially_refunded';

export type Payment = {
    id: string;
    bookingId: string;
    passengerId: string;
    driverId: string;
    rideId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    transactionReference: string;
    refundStatus: 'not_requested' | 'pending' | 'processed' | 'failed';
    refundAmount: number;
    refundReference?: string;
    refundReason?: string;
    gateway: 'mock' | 'razorpay';
    createdAt: string;
};

export type Booking = {
    id: string;
    rideId: string;
    passengerId?: string;
    seatsBooked: number;
    seatNumbers: number[];
    status: BookingStatus;
    totalPrice?: number;
    paymentStatus?: 'unpaid' | 'paid' | 'refunded';
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
    status?: BookingStatus;
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

export type EmergencyType =
    'medical' | 'accident' | 'unsafe_behavior' | 'route_deviation' | 'general';

export type SosStatus = 'triggered' | 'acknowledged' | 'resolved' | 'false_alarm';

export type SosAlert = {
    id: string;
    rideId: string;
    triggeredByUserId: string;
    role: 'Passenger' | 'Driver';
    emergencyType: EmergencyType;
    message?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    status: SosStatus;
    acknowledgedByAdminId?: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
    resolutionNotes?: string;
    createdAt: string;
};

export type SubscriptionTier = 'standard' | 'pro';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export type ProSubscription = {
    id: string;
    userId: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    amount: number;
    billingCycle: 'monthly';
    startedAt: string;
    expiresAt: string;
    autoRenew: boolean;
};

export type RideSuggestion = {
    ride: Ride;
    reason: string;
    score: number;
    matchReasons: string[];
};
