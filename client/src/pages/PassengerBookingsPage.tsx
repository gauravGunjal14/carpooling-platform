import { useCallback, useEffect, useState } from 'react';
import {
    BadgeCheck,
    Calendar,
    MapPin,
    RotateCcw,
    ShieldAlert,
    Star,
    X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../providers/SocketProvider';
import { SOCKET_EVENTS } from '../types/socketEvents';
import type { Booking } from '../types/rides';

export function PassengerBookingsPage() {
    const { request } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionId, setActionId] = useState<string | null>(null);

    // Rating modal state
    const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
    const [ratingValue, setRatingValue] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);
    const [ratingSuccess, setRatingSuccess] = useState('');

    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await request<{ bookings: Booking[] }>('/api/bookings/mine');
            setBookings(res.bookings);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Failed to load booking history.',
            );
        } finally {
            setLoading(false);
        }
    }, [request]);

    useEffect(() => {
        void loadBookings();
    }, [loadBookings]);

    const { subscribe } = useSocket();

    useEffect(() => {
        const unsubAccepted = subscribe(SOCKET_EVENTS.BOOKING_ACCEPTED, () => {
            void loadBookings();
        });
        const unsubRejected = subscribe(SOCKET_EVENTS.BOOKING_REJECTED, () => {
            void loadBookings();
        });
        const unsubCancelled = subscribe(SOCKET_EVENTS.BOOKING_CANCELLED, () => {
            void loadBookings();
        });
        const unsubRide = subscribe(SOCKET_EVENTS.RIDE_STATUS_UPDATED, () => {
            void loadBookings();
        });
        return () => {
            unsubAccepted();
            unsubRejected();
            unsubCancelled();
            unsubRide();
        };
    }, [subscribe, loadBookings]);

    async function handleCancel(bookingId: string) {
        if (!window.confirm('Are you sure you want to cancel this booking?')) return;
        setActionId(bookingId);
        setError('');
        try {
            await request(`/api/bookings/${bookingId}/cancel`, {
                method: 'PATCH',
                body: JSON.stringify({ reason: 'Cancelled by passenger' }),
            });
            await loadBookings();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Could not cancel booking.',
            );
        } finally {
            setActionId(null);
        }
    }

    async function handleSubmitRating() {
        if (!ratingBooking || !ratingBooking.ride) return;
        setSubmittingRating(true);
        setError('');
        try {
            await request('/api/ratings', {
                method: 'POST',
                body: JSON.stringify({
                    rideId: ratingBooking.ride.id,
                    bookingId: ratingBooking.id,
                    toUserId: ratingBooking.ride.driver.id,
                    targetRole: 'Driver',
                    rating: ratingValue,
                    review: reviewText,
                }),
            });
            setRatingSuccess('Thank you! Your rating has been recorded.');
            setRatingBooking(null);
            setReviewText('');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to submit rating.');
        } finally {
            setSubmittingRating(false);
        }
    }

    return (
        <div className='ride-workspace'>
            <RideWorkspaceHeader role='Passenger' />
            <main className='ride-workspace-main'>
                <section className='ride-page-intro'>
                    <span className='eyebrow'>PASSENGER WORKSPACE</span>
                    <h1>Your Bookings & Journeys</h1>
                    <p>
                        Track your pending booking requests, confirmed seats, and ride
                        history.
                    </p>
                </section>

                {error && (
                    <p
                        className='auth-error'
                        role='alert'
                    >
                        {error}
                    </p>
                )}

                {ratingSuccess && (
                    <div
                        className='ride-booking-success-banner'
                        role='status'
                    >
                        <BadgeCheck size={16} />
                        <span>{ratingSuccess}</span>
                    </div>
                )}

                <div className='ride-list-heading'>
                    <div>
                        <span className='eyebrow'>BOOKING HISTORY</span>
                        <h2>Recent bookings ({bookings.length})</h2>
                    </div>
                    <button
                        type='button'
                        className='ride-refresh'
                        onClick={() => void loadBookings()}
                    >
                        <RotateCcw size={13} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <p
                        className='ride-empty'
                        role='status'
                    >
                        Loading your bookings…
                    </p>
                ) : bookings.length === 0 ? (
                    <div className='ride-empty-card'>
                        <ShieldAlert size={28} />
                        <h3>No bookings yet</h3>
                        <p>
                            You have not booked any rides yet. Search for upcoming rides
                            to start traveling.
                        </p>
                        <Link
                            to='/app/passenger'
                            className='button button-burgundy'
                        >
                            Find rides
                        </Link>
                    </div>
                ) : (
                    <div className='booking-history-list'>
                        {bookings.map((booking) => {
                            const isCancellable =
                                booking.status === 'pending' ||
                                booking.status === 'accepted';
                            const isCompleted =
                                booking.status === 'completed' ||
                                booking.ride?.status === 'completed';

                            return (
                                <article
                                    key={booking.id}
                                    className='booking-card'
                                >
                                    <div className='booking-card-head'>
                                        <div className='booking-route'>
                                            <div className='booking-route-point'>
                                                <MapPin
                                                    size={14}
                                                    className='text-burgundy'
                                                />
                                                <span>
                                                    {booking.ride?.pickup.displayName ??
                                                        'Pickup location'}
                                                </span>
                                            </div>
                                            <div className='booking-route-arrow'>→</div>
                                            <div className='booking-route-point'>
                                                <MapPin
                                                    size={14}
                                                    className='text-plum'
                                                />
                                                <span>
                                                    {booking.ride?.destination
                                                        .displayName ??
                                                        'Destination location'}
                                                </span>
                                            </div>
                                        </div>
                                        <span
                                            className={`booking-status-tag status-${booking.status}`}
                                        >
                                            {booking.status}
                                        </span>
                                    </div>

                                    <div className='booking-card-details'>
                                        <div>
                                            <small>DEPARTURE</small>
                                            <span>
                                                <Calendar size={13} />{' '}
                                                {booking.ride
                                                    ? new Date(
                                                          booking.ride.departureAt,
                                                      ).toLocaleString(undefined, {
                                                          dateStyle: 'medium',
                                                          timeStyle: 'short',
                                                      })
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div>
                                            <small>SEATS BOOKED</small>
                                            <span>
                                                Seat(s):{' '}
                                                <b>{booking.seatNumbers.join(', ')}</b> (
                                                {booking.seatsBooked})
                                            </span>
                                        </div>
                                        <div>
                                            <small>DRIVER</small>
                                            <span className='booking-driver-name'>
                                                {booking.ride?.driver.displayName ??
                                                    'Driver'}
                                                {booking.ride?.driver.isVerified && (
                                                    <BadgeCheck size={13} />
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className='booking-card-footer'>
                                        {booking.ride && (
                                            <Link
                                                to={`/app/passenger/rides/${booking.ride.id}`}
                                                className='button button-outline'
                                            >
                                                View ride details
                                            </Link>
                                        )}

                                        {isCancellable && (
                                            <button
                                                type='button'
                                                className='button button-outline text-danger'
                                                disabled={actionId === booking.id}
                                                onClick={() =>
                                                    void handleCancel(booking.id)
                                                }
                                            >
                                                {actionId === booking.id
                                                    ? 'Cancelling…'
                                                    : 'Cancel booking'}
                                            </button>
                                        )}

                                        {isCompleted && (
                                            <button
                                                type='button'
                                                className='button button-burgundy'
                                                onClick={() => {
                                                    setRatingBooking(booking);
                                                    setRatingValue(5);
                                                    setReviewText('');
                                                }}
                                            >
                                                <Star size={13} /> Rate driver
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* Rating Modal */}
                {ratingBooking && (
                    <div className='rating-modal-overlay'>
                        <div className='rating-modal-card'>
                            <div className='rating-modal-header'>
                                <h3>Rate Your Driver</h3>
                                <button
                                    type='button'
                                    onClick={() => setRatingBooking(null)}
                                    aria-label='Close'
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <p>
                                How was your journey with{' '}
                                <b>{ratingBooking.ride?.driver.displayName}</b>?
                            </p>
                            <div className='rating-stars-input'>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type='button'
                                        className={`star-btn ${star <= ratingValue ? 'filled' : ''}`}
                                        onClick={() => setRatingValue(star)}
                                        aria-label={`${star} stars`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                            <textarea
                                className='rating-review-input'
                                placeholder='Leave a brief, respectful review (optional)…'
                                maxLength={500}
                                value={reviewText}
                                onChange={(e) => setReviewText(e.target.value)}
                            />
                            <div className='rating-modal-actions'>
                                <button
                                    type='button'
                                    className='button button-outline'
                                    onClick={() => setRatingBooking(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    className='button button-burgundy'
                                    disabled={submittingRating}
                                    onClick={handleSubmitRating}
                                >
                                    {submittingRating ? 'Submitting…' : 'Submit rating'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
