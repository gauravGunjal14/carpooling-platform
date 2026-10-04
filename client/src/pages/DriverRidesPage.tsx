import { useEffect, useState } from 'react';
import { CalendarDays, Plus, RefreshCw, Route, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RideCard } from '../components/RideCard';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import type { Ride } from '../types/rides';

export function DriverRidesPage() {
    const { request } = useAuth();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    async function loadRides() {
        setLoading(true);
        setError('');
        try {
            const result = await request<{ rides: Ride[] }>('/api/rides/mine');
            setRides(result.rides);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Your rides could not be loaded.',
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadRides();
    }, []);

    async function cancelRide(id: string) {
        if (!window.confirm('Cancel this ride?')) return;
        setError('');
        try {
            await request(`/api/rides/mine/${id}/cancel`, { method: 'PATCH' });
            await loadRides();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'This ride could not be cancelled.',
            );
        }
    }

    const upcomingCount = rides.filter((ride) => ride.status === 'scheduled').length;

    return (
        <div className='ride-workspace'>
            <RideWorkspaceHeader role='Driver' />
            <main className='ride-workspace-main'>
                <section className='ride-page-intro'>
                    <span className='eyebrow'>DRIVER WORKSPACE</span>
                    <h1>Your journeys, thoughtfully planned.</h1>
                    <p>
                        Create a ride, keep the details current, and manage your upcoming
                        journeys in one place.
                    </p>
                    <Link
                        className='button button-burgundy ride-create-cta'
                        to='/app/driver/rides/new'
                    >
                        <Plus size={16} /> Offer a ride
                    </Link>
                </section>
                <div className='ride-dashboard-stats'>
                    <div>
                        <Route size={17} />
                        <span>
                            <small>YOUR RIDES</small>
                            <strong>{rides.length}</strong>
                        </span>
                    </div>
                    <div>
                        <CalendarDays size={17} />
                        <span>
                            <small>UPCOMING</small>
                            <strong>{upcomingCount}</strong>
                        </span>
                    </div>
                    <div>
                        <ShieldCheck size={17} />
                        <span>
                            <small>WOMEN-ONLY RIDES</small>
                            <strong>Eligibility-gated</strong>
                        </span>
                    </div>
                </div>
                <div className='ride-list-heading'>
                    <div>
                        <span className='eyebrow'>RIDE MANAGEMENT</span>
                        <h2>Created rides</h2>
                    </div>
                    <button
                        className='ride-refresh'
                        type='button'
                        onClick={() => void loadRides()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
                {error && (
                    <p
                        className='auth-error'
                        role='alert'
                    >
                        {error}
                    </p>
                )}
                {loading ? (
                    <p
                        className='ride-empty'
                        role='status'
                    >
                        Loading your rides…
                    </p>
                ) : rides.length === 0 ? (
                    <div className='ride-empty ride-empty-card'>
                        <Route size={25} />
                        <h3>Your first ride starts here.</h3>
                        <p>Share your route and available seats to get started.</p>
                        <Link
                            className='button button-burgundy'
                            to='/app/driver/rides/new'
                        >
                            Create a ride
                        </Link>
                    </div>
                ) : (
                    <div className='ride-card-list'>
                        {rides.map((ride) => (
                            <div
                                className='driver-ride-item'
                                key={ride.id}
                            >
                                <RideCard
                                    ride={ride}
                                    href={`/app/driver/rides/${ride.id}/edit`}
                                    actionLabel={
                                        ride.status === 'scheduled'
                                            ? 'Edit ride'
                                            : 'View ride'
                                    }
                                />
                                {ride.status === 'scheduled' &&
                                    new Date(ride.departureAt) > new Date() && (
                                        <div className='driver-ride-actions'>
                                            <Link
                                                to={`/app/driver/rides/${ride.id}/edit`}
                                            >
                                                Edit details
                                            </Link>
                                            <button
                                                type='button'
                                                onClick={() => void cancelRide(ride.id)}
                                            >
                                                Cancel ride
                                            </button>
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
