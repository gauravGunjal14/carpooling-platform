import { BadgeCheck, Clock3, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Ride } from '../types/rides';

type Props = {
    ride: Ride;
    href: string;
    actionLabel?: string;
};

export function RideCard({ ride, href, actionLabel = 'View ride' }: Props) {
    return (
        <article className='ride-card'>
            <div className='ride-card-topline'>
                <span className='ride-driver-name'>
                    <span
                        className='ride-driver-avatar'
                        aria-hidden='true'
                    >
                        {ride.driver.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{ride.driver.displayName}</span>
                    {ride.driver.isVerified && (
                        <span
                            className='ride-verified'
                            aria-label='Verified driver'
                        >
                            <BadgeCheck size={14} /> Verified
                        </span>
                    )}
                </span>
                {ride.womenOnly && (
                    <span className='ride-women-only'>
                        <Users size={14} /> Women-only
                    </span>
                )}
                {ride.status !== 'scheduled' && (
                    <span className={`ride-status ride-status-${ride.status}`}>
                        {ride.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    </span>
                )}
            </div>
            <div className='ride-route'>
                <div className='ride-route-point'>
                    <span className='ride-route-marker ride-route-marker-pickup' />
                    <span>
                        <small>FROM</small>
                        <strong>{ride.pickup.displayName}</strong>
                    </span>
                </div>
                <span
                    className='ride-route-line'
                    aria-hidden='true'
                />
                <div className='ride-route-point'>
                    <span className='ride-route-marker ride-route-marker-destination' />
                    <span>
                        <small>TO</small>
                        <strong>{ride.destination.displayName}</strong>
                    </span>
                </div>
            </div>
            <div className='ride-card-meta'>
                <span>
                    <Clock3 size={14} />{' '}
                    {new Date(ride.departureAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                    })}
                </span>
                <span>
                    <Users size={14} /> {ride.availableSeats}{' '}
                    {ride.availableSeats === 1 ? 'seat' : 'seats'} available
                </span>
                <span>
                    <MapPin size={14} /> Exact-place listing
                </span>
            </div>
            {ride.preferences.notes && (
                <p className='ride-card-note'>{ride.preferences.notes}</p>
            )}
            <Link
                className='ride-card-link'
                to={href}
            >
                {actionLabel}
                <span aria-hidden='true'>↗</span>
            </Link>
        </article>
    );
}
