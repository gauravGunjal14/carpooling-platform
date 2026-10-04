import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Cigarette, Luggage, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LazyRideMap } from '../components/LazyRideMap';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import type { Ride } from '../types/rides';

export function RideDetailsPage() {
    const { id } = useParams();
    const { request } = useAuth();
    const [ride, setRide] = useState<Ride | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void request<{ ride: Ride }>(`/api/rides/${id}`)
            .then((result) => {
                if (active) setRide(result.ride);
            })
            .catch((cause) => {
                if (active)
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : 'Ride details could not be loaded.',
                    );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [id, request]);

    return (
        <div className='ride-workspace'>
            <RideWorkspaceHeader role='Passenger' />
            <main className='ride-detail-main'>
                <Link
                    className='ride-back-link'
                    to='/app/passenger'
                >
                    <ArrowLeft size={14} /> Back to results
                </Link>
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
                        Loading ride details…
                    </p>
                ) : ride ? (
                    <article className='ride-detail-card'>
                        <div className='ride-detail-heading'>
                            <div>
                                <span className='eyebrow'>RIDE DETAILS</span>
                                <h1>Your route, at a glance.</h1>
                            </div>
                            {ride.womenOnly && (
                                <span className='ride-women-only'>Women-only</span>
                            )}
                        </div>
                        <div className='ride-detail-driver'>
                            <span
                                className='ride-driver-avatar'
                                aria-hidden='true'
                            >
                                {ride.driver.displayName.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                                <small>DRIVER</small>
                                <strong>{ride.driver.displayName}</strong>
                            </span>
                            {ride.driver.isVerified && (
                                <span className='ride-verified'>
                                    <BadgeCheck size={14} /> Verified driver
                                </span>
                            )}
                        </div>
                        <LazyRideMap
                            pickup={ride.pickup}
                            destination={ride.destination}
                        />
                        <div className='ride-detail-facts'>
                            <div>
                                <small>DEPARTURE</small>
                                <strong>
                                    {new Date(ride.departureAt).toLocaleString(
                                        undefined,
                                        { dateStyle: 'full', timeStyle: 'short' },
                                    )}
                                </strong>
                            </div>
                            <div>
                                <small>AVAILABLE SEATS</small>
                                <strong>{ride.availableSeats}</strong>
                            </div>
                            <div>
                                <small>LUGGAGE</small>
                                <strong>
                                    <Luggage size={14} /> {ride.preferences.luggage}
                                </strong>
                            </div>
                            <div>
                                <small>SMOKING</small>
                                <strong>
                                    <Cigarette size={14} />{' '}
                                    {ride.preferences.smokingAllowed
                                        ? 'Allowed'
                                        : 'Not allowed'}
                                </strong>
                            </div>
                        </div>
                        {ride.preferences.notes && (
                            <p className='ride-detail-notes'>{ride.preferences.notes}</p>
                        )}
                        {ride.womenOnly && (
                            <p className='ride-detail-safety'>
                                <ShieldCheck size={16} /> This ride is shown only to
                                passengers whose verification and women-only eligibility
                                were approved by an administrator.
                            </p>
                        )}
                        <p className='ride-booking-phase-note'>
                            Booking requests are not available yet. You can review this
                            ride’s details while ride management is in progress.
                        </p>
                    </article>
                ) : null}
            </main>
        </div>
    );
}
