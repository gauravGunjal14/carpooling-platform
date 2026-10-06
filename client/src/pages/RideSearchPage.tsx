import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    Search,
    Sparkles,
    Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LocationAutocomplete } from '../components/LocationAutocomplete';
import { RideCard } from '../components/RideCard';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import type { RideLocation, RideSearchResult, RideSuggestion } from '../types/rides';

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
    const [rides, setRides] = useState<RideSearchResult[]>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [suggestions, setSuggestions] = useState<RideSuggestion[]>([]);
    const minimumDate = useMemo(() => toLocalDate(new Date()), []);

    useEffect(() => {
        let mounted = true;
        request<{ suggestions: RideSuggestion[] }>('/api/rides/suggestions')
            .then((res) => {
                if (mounted) setSuggestions(res.suggestions || []);
            })
            .catch(() => {
                if (mounted) setSuggestions([]);
            });
        return () => {
            mounted = false;
        };
    }, [request]);

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
            timeWindowMinutes: '120',
        });
        if (time) {
            params.set('departureAt', new Date(`${date}T${time}`).toISOString());
        }

        setLoading(true);
        setSearched(true);
        try {
            const result = await request<{ rides: RideSearchResult[] }>(
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

                {/* Rule-Based Smart Suggestions */}
                {suggestions.length > 0 && (
                    <section
                        className='suggestions-section'
                        aria-labelledby='suggestions-title'
                    >
                        <div className='suggestions-header'>
                            <div>
                                <span className='eyebrow'>RECOMMENDED FOR YOU</span>
                                <h2
                                    id='suggestions-title'
                                    style={{
                                        margin: '4px 0 0',
                                        fontSize: '20px',
                                        color: '#352431',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <Sparkles
                                        size={20}
                                        color='#631238'
                                    />
                                    Smart Ride Suggestions
                                </h2>
                            </div>
                            <small style={{ color: '#695761', fontSize: '11px' }}>
                                Based on past bookings and verified routes
                            </small>
                        </div>

                        <div className='suggestions-grid'>
                            {suggestions.slice(0, 3).map((item) => (
                                <div
                                    key={item.ride.id}
                                    className='suggestion-card'
                                >
                                    <div>
                                        <div className='suggestion-header-row'>
                                            <span className='suggestion-reason-badge'>
                                                <Sparkles size={11} />
                                                {item.reason}
                                            </span>
                                            <span className='suggestion-score-tag'>
                                                {item.score}% Match
                                            </span>
                                        </div>

                                        <div
                                            className='suggestion-route-info'
                                            style={{ marginTop: '12px' }}
                                        >
                                            <strong>
                                                {
                                                    item.ride.pickup.displayName.split(
                                                        ',',
                                                    )[0]
                                                }{' '}
                                                →{' '}
                                                {
                                                    item.ride.destination.displayName.split(
                                                        ',',
                                                    )[0]
                                                }
                                            </strong>
                                            <small>
                                                {new Date(
                                                    item.ride.departureAt,
                                                ).toLocaleString(undefined, {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}{' '}
                                                • {item.ride.availableSeats} seat
                                                {item.ride.availableSeats === 1
                                                    ? ''
                                                    : 's'}{' '}
                                                left
                                                {item.ride.pricePerSeat &&
                                                    ` • ₹${item.ride.pricePerSeat}`}
                                            </small>
                                        </div>

                                        {item.matchReasons &&
                                            item.matchReasons.length > 0 && (
                                                <div className='suggestion-reasons-list'>
                                                    {item.matchReasons.map(
                                                        (reason, idx) => (
                                                            <span
                                                                key={idx}
                                                                className='suggestion-reason-chip'
                                                            >
                                                                ✓ {reason}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: '12px',
                                            paddingTop: '10px',
                                            borderTop: '1px solid #f0e6eb',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '11px',
                                                color: '#695761',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
                                            {item.ride.driver.displayName}
                                            {item.ride.driver.isVerified && (
                                                <BadgeCheck
                                                    size={13}
                                                    color='#631238'
                                                />
                                            )}
                                        </span>
                                        <Link
                                            to={`/app/passenger/rides/${item.ride.id}`}
                                            className='button button-burgundy'
                                            style={{
                                                padding: '5px 12px',
                                                fontSize: '10px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
                                            View ride <ArrowRight size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

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
                            Matches are within 30 km of both places. When you choose a
                            time, departures within ±2 hours are ranked by route, seats,
                            and driver verification.
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
                                        key={ride.ride.id}
                                        ride={ride.ride}
                                        match={ride}
                                        href={`/app/passenger/rides/${ride.ride.id}`}
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
