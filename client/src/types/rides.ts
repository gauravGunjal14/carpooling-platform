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
    availableSeats: number;
    preferences: {
        smokingAllowed: boolean;
        luggage: 'small' | 'standard' | 'large';
        notes: string;
    };
    womenOnly: boolean;
    status: 'scheduled' | 'cancelled' | 'completed';
    createdAt: string;
    updatedAt: string;
};

export type RideFormInput = Omit<
    Ride,
    'id' | 'driver' | 'status' | 'createdAt' | 'updatedAt'
>;
