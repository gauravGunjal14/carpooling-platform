import { useCallback, useEffect, useState } from 'react';
import {
    BadgeCheck,
    Calendar,
    CheckCircle,
    CreditCard,
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
import type { Booking, PaymentMethod } from '../types/rides';

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

    // Payment modal state
    const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
    const [simulateFailure, setSimulateFailure] = useState(false);
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');
    const [paymentErrorMsg, setPaymentErrorMsg] = useState('');

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
        const unsubPayment = subscribe(SOCKET_EVENTS.PAYMENT_SUCCESS, () => {
            void loadBookings();
        });
        const unsubRefund = subscribe(SOCKET_EVENTS.REFUND_PROCESSED, () => {
            void loadBookings();
        });
        return () => {
            unsubAccepted();
            unsubRejected();
            unsubCancelled();
            unsubRide();
            unsubPayment();
            unsubRefund();
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

    async function handlePayMockPayment() {
        if (!payingBooking) return;
        setSubmittingPayment(true);
        setPaymentErrorMsg('');
        setPaymentSuccessMsg('');
        try {
            const res = await request<{
                success: boolean;
                message: string;
                payment?: { transactionReference: string; amount: number };
            }>('/api/payments/mock', {
                method: 'POST',
                body: JSON.stringify({
                    bookingId: payingBooking.id,
                    paymentMethod,
                    simulateFailure,
                }),
            });

            if (res.success && res.payment) {
                setPaymentSuccessMsg(
                    `Payment of ₹${res.payment.amount} completed! Ref: ${res.payment.transactionReference}`,
                );
                await loadBookings();
                setTimeout(() => {
                    setPayingBooking(null);
                    setPaymentSuccessMsg('');
                }, 1800);
            } else {
                setPaymentErrorMsg(res.message || 'Payment simulation failed.');
                await loadBookings();
            }
        } catch (cause) {
            setPaymentErrorMsg(
                cause instanceof Error ? cause.message : 'Payment failed. Please retry.',
            );
        } finally {
            setSubmittingPayment(false);
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
                                            <small>FARE & PAYMENT</small>
                                            <span>
                                                {booking.paymentStatus === 'paid' ? (
                                                    <span className='badge-paid'>
                                                        <CheckCircle size={10} /> Paid (₹
                                                        {booking.totalPrice ??
                                                            booking.seatsBooked * 250}
                                                        )
                                                    </span>
                                                ) : booking.paymentStatus ===
                                                  'refunded' ? (
                                                    <span className='badge-refunded'>
                                                        <RotateCcw size={10} /> Refunded
                                                    </span>
                                                ) : (
                                                    <span>
                                                        ₹
                                                        {booking.totalPrice ??
                                                            booking.seatsBooked *
                                                                250}{' '}
                                                        (Unpaid)
                                                    </span>
                                                )}
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

                                        {booking.status === 'accepted' &&
                                            (!booking.paymentStatus ||
                                                booking.paymentStatus === 'unpaid') && (
                                                <button
                                                    type='button'
                                                    className='button button-burgundy'
                                                    onClick={() => {
                                                        setPayingBooking(booking);
                                                        setPaymentErrorMsg('');
                                                        setPaymentSuccessMsg('');
                                                        setSimulateFailure(false);
                                                    }}
                                                >
                                                    <CreditCard size={13} /> Pay Now
                                                    (Demo)
                                                </button>
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

                {/* Payment Modal */}
                {payingBooking && (
                    <div className='rating-modal-overlay'>
                        <div
                            className='rating-modal-card'
                            style={{ maxWidth: '460px' }}
                        >
                            <div className='rating-modal-header'>
                                <h3>Complete Seat Payment</h3>
                                <button
                                    type='button'
                                    onClick={() => setPayingBooking(null)}
                                    aria-label='Close'
                                    disabled={submittingPayment}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className='payment-demo-notice'>
                                <strong>⚡ Demo Payment Gateway</strong>
                                <br />
                                Razorpay-ready mock architecture. No real money will be
                                charged.
                            </div>

                            {paymentErrorMsg && (
                                <div
                                    className='status-banner status-banner-error'
                                    style={{ margin: 0, padding: '8px 12px' }}
                                >
                                    <ShieldAlert size={14} /> {paymentErrorMsg}
                                </div>
                            )}

                            {paymentSuccessMsg && (
                                <div
                                    className='status-banner'
                                    style={{
                                        margin: 0,
                                        padding: '8px 12px',
                                        background: '#f4e9ee',
                                        borderColor: '#d9becc',
                                        color: '#432135',
                                    }}
                                >
                                    <CheckCircle size={14} /> {paymentSuccessMsg}
                                </div>
                            )}

                            <div className='payment-summary-box'>
                                <div>
                                    <strong>Route:</strong>{' '}
                                    {payingBooking.ride?.pickup.displayName} →{' '}
                                    {payingBooking.ride?.destination.displayName}
                                </div>
                                <div>
                                    <strong>Reserved Seat(s):</strong>{' '}
                                    {payingBooking.seatNumbers.join(', ')} (
                                    {payingBooking.seatsBooked} seats)
                                </div>
                                <div style={{ fontSize: '13px', color: '#631238' }}>
                                    <strong>Total Amount:</strong> ₹
                                    {payingBooking.totalPrice ??
                                        payingBooking.seatsBooked * 250}
                                </div>
                            </div>

                            <div>
                                <small style={{ fontWeight: 600, color: '#695761' }}>
                                    CHOOSE PAYMENT METHOD
                                </small>
                                <div className='payment-method-selector'>
                                    {(
                                        [
                                            { id: 'upi', label: 'UPI' },
                                            { id: 'gpay', label: 'Google Pay' },
                                            { id: 'phonepe', label: 'PhonePe' },
                                            { id: 'card', label: 'Debit/Credit' },
                                            { id: 'netbanking', label: 'Net Banking' },
                                        ] as const
                                    ).map((method) => (
                                        <button
                                            key={method.id}
                                            type='button'
                                            className={`payment-method-btn ${paymentMethod === method.id ? 'selected' : ''}`}
                                            onClick={() => setPaymentMethod(method.id)}
                                            disabled={submittingPayment}
                                        >
                                            {method.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    color: '#695761',
                                }}
                            >
                                <input
                                    type='checkbox'
                                    checked={simulateFailure}
                                    onChange={(e) => setSimulateFailure(e.target.checked)}
                                    disabled={submittingPayment}
                                />
                                Simulate payment failure test (test error handling)
                            </label>

                            <div className='rating-modal-actions'>
                                <button
                                    type='button'
                                    className='button button-outline'
                                    onClick={() => setPayingBooking(null)}
                                    disabled={submittingPayment}
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    className='button button-burgundy'
                                    disabled={
                                        submittingPayment || Boolean(paymentSuccessMsg)
                                    }
                                    onClick={() => void handlePayMockPayment()}
                                >
                                    {submittingPayment ? (
                                        'Processing Payment…'
                                    ) : (
                                        <>
                                            <CreditCard size={13} /> Pay ₹
                                            {payingBooking.totalPrice ??
                                                payingBooking.seatsBooked * 250}{' '}
                                            (Demo)
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
