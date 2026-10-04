import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Search, Users } from 'lucide-react';
import { LocationAutocomplete } from '../components/LocationAutocomplete';
import { RideCard } from '../components/RideCard';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import type { Ride, RideLocation } from '../types/rides';

function toLocalDate(date: Date): string {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

function tomorrowLocal(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return toLocalDate(date);
}

function localDayRange(date: string) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { dateStart: start.toISOString(), dateEnd: end.toISOString() };
}

export function RideSearchPage() {
    const { request } = useAuth();
    const [pickup, setPickup] = useState<RideLocation | null>(null);
    const [destination, setDestination] = useState<RideLocation | null>(null);
    const [date, setDate] = useState(tomorrowLocal);
    const [time, setTime] = useState('');
    const [seats, setSeats] = useState('1');
    const [rides, setRides] = useState<Ride[]>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const minimumDate = useMemo(() => toLocalDate(new Date()), []);

    async function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        if (!pickup || !destination) {
            setError('Search for and select both pickup and destination places.');
            return;
        }
        const range = localDayRange(date);
        const params = new URLSearchParams({
            pickupName: pickup.displayName,
            pickupLatitude: String(pickup.latitude),
            pickupLongitude: String(pickup.longitude),
            destinationName: destination.displayName,
            destinationLatitude: String(destination.latitude),
            destinationLongitude: String(destination.longitude),
            dateStart: range.dateStart,
            dateEnd: range.dateEnd,
            requiredSeats: seats,
            timeWindowMinutes: '60',
        });
        if (time) {
            params.set('departureAt', new Date(`${date}T${time}`).toISOString());
        }

        setLoading(true);
        setSearched(true);
        try {
            const result = await request<{ rides: Ride[] }>(
                `/api/rides/search?${params.toString()}`,
            );
            setRides(result.rides);
        } catch (cause) {
            setRides([]);
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Ride search could not be completed.',
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='ride-workspace'>
            <RideWorkspaceHeader role='Passenger' />
            <main className='ride-workspace-main passenger-search-main'>
                <section className='ride-page-intro'>
                    <span className='eyebrow'>PASSENGER WORKSPACE</span>
                    <h1>Find a ride that fits your journey.</h1>
                    <p>
                        Compare driver verification, available seats, and ride details
                        before choosing where to go.
                    </p>
                </section>
                <section
                    className='ride-search-panel'
                    aria-labelledby='ride-search-title'
                >
                    <div className='ride-list-heading'>
                        <div>
                            <span className='eyebrow'>PLAN YOUR TRIP</span>
                            <h2 id='ride-search-title'>Search available rides</h2>
                        </div>
                    </div>
                    <form
                        className='ride-search-form'
                        onSubmit={handleSearch}
                    >
                        <div className='ride-location-grid'>
                            <LocationAutocomplete
                                id='search-pickup'
                                label='Pickup place'
                                value={pickup}
                                onChange={setPickup}
                            />
                            <LocationAutocomplete
                                id='search-destination'
                                label='Destination'
                                value={destination}
                                onChange={setDestination}
                            />
                        </div>
                        <div className='ride-search-filters'>
                            <label
                                className='auth-field'
                                htmlFor='search-date'
                            >
                                <span>
                                    <CalendarDays size={14} /> Travel date
                                </span>
                                <input
                                    id='search-date'
                                    className='ride-control'
                                    type='date'
                                    min={minimumDate}
                                    value={date}
                                    onChange={(event) => setDate(event.target.value)}
                                    required
                                />
                            </label>
                            <label
                                className='auth-field'
                                htmlFor='search-time'
                            >
                                <span>Approximate departure time</span>
                                <input
                                    id='search-time'
                                    className='ride-control'
                                    type='time'
                                    value={time}
                                    onChange={(event) => setTime(event.target.value)}
                                />
                            </label>
                            <label
                                className='auth-field'
                                htmlFor='search-seats'
                            >
                                <span>
                                    <Users size={14} /> Seats needed
                                </span>
                                <select
                                    id='search-seats'
                                    className='ride-control'
                                    value={seats}
                                    onChange={(event) => setSeats(event.target.value)}
                                >
                                    {[1, 2, 3, 4, 5, 6].map((count) => (
                                        <option
                                            key={count}
                                            value={count}
                                        >
                                            {count} {count === 1 ? 'seat' : 'seats'}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <p className='ride-search-scope'>
                            Place names are matched exactly in this phase. Nearby and
                            route-compatible suggestions arrive with smart matching.
                        </p>
                        {error && (
                            <p
                                className='auth-error'
                                role='alert'
                            >
                                {error}
                            </p>
                        )}
                        <button
                            className='button button-burgundy ride-search-submit'
                            type='submit'
                            disabled={loading || !pickup || !destination}
                        >
                            <Search size={16} />{' '}
                            {loading ? 'Searching rides…' : 'Find available rides'}
                        </button>
                    </form>
                </section>
                {searched && (
                    <section
                        className='ride-results'
                        aria-live='polite'
                        aria-busy={loading}
                    >
                        <div className='ride-list-heading'>
                            <div>
                                <span className='eyebrow'>AVAILABLE JOURNEYS</span>
                                <h2>
                                    {loading
                                        ? 'Looking for rides'
                                        : `${rides.length} ${rides.length === 1 ? 'ride' : 'rides'} found`}
                                </h2>
                            </div>
                        </div>
                        {loading ? (
                            <p
                                className='ride-empty'
                                role='status'
                            >
                                Checking the selected route and date…
                            </p>
                        ) : rides.length === 0 ? (
                            <div className='ride-empty ride-empty-card'>
                                <Search size={24} />
                                <h3>No rides match these places yet.</h3>
                                <p>
                                    Try another public place or check back as drivers add
                                    journeys.
                                </p>
                            </div>
                        ) : (
                            <div className='ride-card-list'>
                                {rides.map((ride) => (
                                    <RideCard
                                        key={ride.id}
                                        ride={ride}
                                        href={`/app/passenger/rides/${ride.id}`}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
