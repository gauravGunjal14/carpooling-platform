import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Clock,
    CreditCard,
    Luggage,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Tag,
    X,
    XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LazyRideMap } from '../components/LazyRideMap';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { SeatSelector } from '../components/SeatSelector';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../providers/SocketProvider';
import { SOCKET_EVENTS } from '../types/socketEvents';
import type {
    Booking,
    EmergencyType,
    Ride,
    SeatStatusInfo,
    SosAlert,
} from '../types/rides';

function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export function RideDetailsPage() {
    const { id } = useParams();
    const { request, user } = useAuth();
    const [ride, setRide] = useState<Ride | null>(null);
    const [seats, setSeats] = useState<SeatStatusInfo[]>([]);
    const [totalSeats, setTotalSeats] = useState(4);
    const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
    const [inspectedSeat, setInspectedSeat] = useState<SeatStatusInfo | null>(null);
    const [myBooking, setMyBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [bookingInProgress, setBookingInProgress] = useState(false);
    const [cancellingInProgress, setCancellingInProgress] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [paymentModal, setPaymentModal] = useState<{
        bookingId: string;
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        seatNumbers: number[];
        isSuccess?: boolean;
        confirmedBooking?: Booking;
    } | null>(null);
    const [verifyingPayment, setVerifyingPayment] = useState(false);

    // SOS Emergency State
    const [activeSos, setActiveSos] = useState<SosAlert | null>(null);
    const [sosModalOpen, setSosModalOpen] = useState(false);
    const [sosType, setSosType] = useState<EmergencyType>('unsafe_behavior');
    const [sosMessage, setSosMessage] = useState('');
    const [sosSubmitting, setSosSubmitting] = useState(false);

    const loadRideData = useCallback(async () => {
        try {
            const [rideRes, seatsRes, bookingsRes, sosRes] = await Promise.all([
                request<{ ride: Ride }>(`/api/rides/${id}`),
                request<{
                    totalSeats: number;
                    availableSeatsCount: number;
                    seats: SeatStatusInfo[];
                }>(`/api/rides/${id}/seats`),
                user
                    ? request<{ bookings: Booking[] }>('/api/bookings/mine').catch(
                          () => ({
                              bookings: [],
                          }),
                      )
                    : Promise.resolve({ bookings: [] }),
                user
                    ? request<{ sosAlert: SosAlert | null }>(`/api/sos/ride/${id}`).catch(
                          () => ({ sosAlert: null }),
                      )
                    : Promise.resolve({ sosAlert: null }),
            ]);

            setRide(rideRes.ride);
            setSeats(seatsRes.seats);
            setTotalSeats(seatsRes.totalSeats);
            setActiveSos(sosRes.sosAlert);

            const activeForThisRide = bookingsRes.bookings.find(
                (b) =>
                    b.rideId === id &&
                    (b.status === 'pending' || b.status === 'accepted'),
            );
            setMyBooking(activeForThisRide ?? null);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Ride details could not be loaded.',
            );
        } finally {
            setLoading(false);
        }
    }, [id, request, user]);

    useEffect(() => {
        void loadRideData();
    }, [loadRideData]);

    const { subscribe } = useSocket();

    useEffect(() => {
        const unsubAccepted = subscribe(SOCKET_EVENTS.BOOKING_ACCEPTED, () => {
            void loadRideData();
        });
        const unsubRejected = subscribe(SOCKET_EVENTS.BOOKING_REJECTED, () => {
            void loadRideData();
        });
        const unsubCancelled = subscribe(SOCKET_EVENTS.BOOKING_CANCELLED, () => {
            void loadRideData();
        });
        const unsubRideStatus = subscribe(SOCKET_EVENTS.RIDE_STATUS_UPDATED, () => {
            void loadRideData();
        });
        const unsubSos = subscribe(SOCKET_EVENTS.SOS_TRIGGERED, () => {
            void loadRideData();
        });
        const unsubSosUpdated = subscribe(SOCKET_EVENTS.SOS_UPDATED, () => {
            void loadRideData();
        });
        return () => {
            unsubAccepted();
            unsubRejected();
            unsubCancelled();
            unsubRideStatus();
            unsubSos();
            unsubSosUpdated();
        };
    }, [subscribe, loadRideData]);

    function handleToggleSeat(seatNum: number) {
        setError('');
        setSuccessMessage('');
        if (myBooking) return;
        setSelectedSeats((prev) =>
            prev.includes(seatNum)
                ? prev.filter((s) => s !== seatNum)
                : [...prev, seatNum].sort((a, b) => a - b),
        );
    }

    async function handleRequestBooking() {
        if (selectedSeats.length === 0 || !ride) return;
        setBookingInProgress(true);
        setError('');
        setSuccessMessage('');
        try {
            // Step 1: Create pending booking
            const res = await request<{ booking: Booking }>('/api/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    rideId: id,
                    seatNumbers: selectedSeats,
                }),
            });

            // Step 2: Request Razorpay payment order
            const orderRes = await request<{
                orderId: string;
                amount: number;
                currency: string;
                keyId: string;
                bookingId: string;
                seatsBooked: number;
                seatNumbers: number[];
            }>('/api/payments/order', {
                method: 'POST',
                body: JSON.stringify({
                    bookingId: res.booking.id,
                }),
            });

            // Check if Razorpay SDK is available
            const hasRazorpay = await loadRazorpayScript();
            if (
                hasRazorpay &&
                typeof (window as unknown as { Razorpay: unknown }).Razorpay ===
                    'function' &&
                orderRes.keyId &&
                !orderRes.keyId.startsWith('rzp_test_mock')
            ) {
                const RazorpayConstructor = (
                    window as unknown as {
                        Razorpay: new (options: Record<string, unknown>) => {
                            open: () => void;
                        };
                    }
                ).Razorpay;

                const rzp = new RazorpayConstructor({
                    key: orderRes.keyId,
                    amount: Math.round(orderRes.amount * 100),
                    currency: orderRes.currency,
                    name: 'Wayfare Carpooling',
                    description: `Payment for Seat ${selectedSeats.join(', ')} (${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''})`,
                    order_id: orderRes.orderId,
                    handler: async (response: {
                        razorpay_order_id: string;
                        razorpay_payment_id: string;
                        razorpay_signature: string;
                    }) => {
                        await handleVerifyPayment(
                            res.booking.id,
                            response.razorpay_order_id,
                            response.razorpay_payment_id,
                            response.razorpay_signature,
                        );
                    },
                    modal: {
                        ondismiss: async () => {
                            await handleCancelPayment(res.booking.id, 'Checkout closed');
                        },
                    },
                    prefill: {
                        name: user?.name,
                        email: user?.email,
                    },
                    theme: {
                        color: '#742b49',
                    },
                });
                rzp.open();
            } else {
                // Open test mode checkout modal in-app
                setPaymentModal({
                    bookingId: res.booking.id,
                    orderId: orderRes.orderId,
                    amount: orderRes.amount,
                    currency: orderRes.currency,
                    keyId: orderRes.keyId,
                    seatNumbers: selectedSeats,
                });
            }
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Failed to initiate booking payment.',
            );
            await loadRideData();
        } finally {
            setBookingInProgress(false);
        }
    }

    async function handleVerifyPayment(
        bookingId: string,
        razorpayOrderId: string,
        razorpayPaymentId: string,
        razorpaySignature?: string,
    ) {
        setVerifyingPayment(true);
        setError('');
        try {
            const result = await request<{
                success: boolean;
                booking: Booking;
            }>('/api/payments/verify', {
                method: 'POST',
                body: JSON.stringify({
                    bookingId,
                    razorpayOrderId,
                    razorpayPaymentId,
                    razorpaySignature,
                }),
            });
            const confirmedSeats =
                result.booking.seatNumbers ?? paymentModal?.seatNumbers ?? [];
            setSuccessMessage(
                `Ticket is booked! Confirmed for Seat ${confirmedSeats.join(', ')}.`,
            );
            setSelectedSeats([]);
            setMyBooking(result.booking);
            setPaymentModal((prev) =>
                prev
                    ? {
                          ...prev,
                          isSuccess: true,
                          confirmedBooking: result.booking,
                      }
                    : null,
            );
            await loadRideData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Payment verification failed.',
            );
        } finally {
            setVerifyingPayment(false);
        }
    }

    async function handleCancelPayment(
        bookingId: string,
        reason = 'Cancelled by passenger',
    ) {
        try {
            await request('/api/payments/failed', {
                method: 'POST',
                body: JSON.stringify({ bookingId, reason }),
            });
            setError(
                'Payment was cancelled. Your seat is not confirmed. You may retry anytime.',
            );
        } catch {
            // ignore
        } finally {
            setPaymentModal(null);
            await loadRideData();
        }
    }

    async function handleCancelBooking() {
        if (!myBooking) return;
        if (!window.confirm('Are you sure you want to cancel your booking request?'))
            return;
        setCancellingInProgress(true);
        setError('');
        setSuccessMessage('');
        try {
            await request(`/api/bookings/${myBooking.id}/cancel`, {
                method: 'PATCH',
                body: JSON.stringify({ reason: 'Cancelled by passenger' }),
            });
            setSuccessMessage(
                'Your booking has been cancelled and held seats have been released.',
            );
            setMyBooking(null);
            await loadRideData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Failed to cancel booking.',
            );
        } finally {
            setCancellingInProgress(false);
        }
    }

    const isDriverOfThisRide = ride && user && ride.driver.id === user.id;
    const isConfirmedPassenger = myBooking && myBooking.status === 'accepted';
    const isParticipant = Boolean(isDriverOfThisRide || isConfirmedPassenger);

    async function handleTriggerSos() {
        if (!ride) return;
        setSosSubmitting(true);
        setError('');
        try {
            let coords: { latitude: number; longitude: number } | undefined;
            if (navigator.geolocation) {
                try {
                    const position = await new Promise<GeolocationPosition>(
                        (resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                                timeout: 4000,
                            });
                        },
                    );
                    coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                } catch {
                    // Position optional if denied or timed out
                }
            }
            const res = await request<{ sosAlert: SosAlert }>('/api/sos/trigger', {
                method: 'POST',
                body: JSON.stringify({
                    rideId: ride.id,
                    emergencyType: sosType,
                    message: sosMessage || undefined,
                    location: coords,
                }),
            });
            setActiveSos(res.sosAlert);
            setSosModalOpen(false);
            setSosMessage('');
            setSuccessMessage(
                'Emergency SOS alert triggered! Platform safety monitors and participants have been notified.',
            );
            await loadRideData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Failed to trigger SOS alert.',
            );
        } finally {
            setSosSubmitting(false);
        }
    }

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
                {successMessage && (
                    <div
                        className='ride-booking-success-banner'
                        role='status'
                    >
                        <CheckCircle2 size={16} />
                        <span>{successMessage}</span>
                    </div>
                )}
                {activeSos &&
                    (activeSos.status === 'triggered' ||
                        activeSos.status === 'acknowledged') && (
                        <div
                            className='sos-active-banner'
                            role='alert'
                        >
                            <AlertTriangle size={24} />
                            <div>
                                <h3>
                                    ACTIVE EMERGENCY ALERT (
                                    {activeSos.emergencyType
                                        .replace('_', ' ')
                                        .toUpperCase()}
                                    )
                                </h3>
                                <p>
                                    An emergency alert was broadcast for this ride.{' '}
                                    Status:{' '}
                                    <span className='sos-status-tag'>
                                        {activeSos.status}
                                    </span>
                                    . Emergency safety monitoring is active.
                                </p>
                                {activeSos.message && (
                                    <p className='sos-user-msg'>"{activeSos.message}"</p>
                                )}
                            </div>
                        </div>
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
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                }}
                            >
                                {isParticipant &&
                                    ride.status !== 'cancelled' &&
                                    ride.status !== 'completed' && (
                                        <button
                                            type='button'
                                            className='sos-trigger-btn'
                                            onClick={() => setSosModalOpen(true)}
                                        >
                                            <Radio size={14} /> Emergency SOS
                                        </button>
                                    )}
                                {ride.womenOnly && (
                                    <span className='ride-women-only'>Women-only</span>
                                )}
                            </div>
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
                                <small>PRICE PER SEAT</small>
                                <strong>
                                    <Tag size={14} /> ₹{ride.pricePerSeat}
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

                        {/* Interactive Seat Selector & Seat Trust Feature */}
                        <section className='ride-seat-booking-section'>
                            <SeatSelector
                                totalSeats={totalSeats}
                                seats={seats}
                                selectedSeats={selectedSeats}
                                onToggleSelectSeat={handleToggleSeat}
                                inspectedSeat={inspectedSeat}
                                onInspectSeat={setInspectedSeat}
                                disabled={
                                    Boolean(myBooking) || Boolean(isDriverOfThisRide)
                                }
                            />

                            {/* Booking Action Area */}
                            <div className='ride-booking-action-panel'>
                                {myBooking ? (
                                    myBooking.status === 'accepted' ? (
                                        <div className='confirmed-ticket-card'>
                                            <div className='ticket-card-header'>
                                                <div className='ticket-header-title'>
                                                    <CheckCircle2
                                                        size={22}
                                                        color='#18794e'
                                                    />
                                                    <div>
                                                        <strong>
                                                            Ticket Booked & Confirmed
                                                        </strong>
                                                        <small>
                                                            Wayfare Boarding Pass ·
                                                            Instant Confirmation
                                                        </small>
                                                    </div>
                                                </div>
                                                <span className='ticket-paid-badge'>
                                                    PAID & BOOKED
                                                </span>
                                            </div>
                                            <div className='ticket-card-details'>
                                                <div className='ticket-col'>
                                                    <small>PASSENGER</small>
                                                    <strong>{user?.name}</strong>
                                                </div>
                                                <div className='ticket-col'>
                                                    <small>CONFIRMED SEAT(S)</small>
                                                    <strong className='ticket-seat-tag'>
                                                        Seat{' '}
                                                        {myBooking.seatNumbers.join(', ')}
                                                    </strong>
                                                </div>
                                                <div className='ticket-col'>
                                                    <small>TOTAL FARE</small>
                                                    <strong>
                                                        ₹
                                                        {myBooking.totalPrice ??
                                                            myBooking.seatNumbers.length *
                                                                (ride.pricePerSeat ??
                                                                    250)}
                                                    </strong>
                                                </div>
                                                <div className='ticket-col'>
                                                    <small>TICKET REF</small>
                                                    <code>
                                                        {myBooking.id
                                                            .slice(-8)
                                                            .toUpperCase()}
                                                    </code>
                                                </div>
                                            </div>
                                            <div className='ticket-card-route'>
                                                <div>
                                                    <small>PICKUP</small>
                                                    <p>{ride.pickup.displayName}</p>
                                                </div>
                                                <span className='ticket-route-arrow'>
                                                    →
                                                </span>
                                                <div>
                                                    <small>DESTINATION</small>
                                                    <p>{ride.destination.displayName}</p>
                                                </div>
                                            </div>
                                            <div className='ticket-card-footer'>
                                                <div className='ticket-meta-info'>
                                                    <span>
                                                        Driver:{' '}
                                                        <b>{ride.driver.displayName}</b>
                                                    </span>
                                                    <span>
                                                        Departure:{' '}
                                                        <b>
                                                            {new Date(
                                                                ride.departureAt,
                                                            ).toLocaleString(undefined, {
                                                                dateStyle: 'medium',
                                                                timeStyle: 'short',
                                                            })}
                                                        </b>
                                                    </span>
                                                </div>
                                                <button
                                                    type='button'
                                                    className='button button-outline ride-cancel-booking-btn'
                                                    disabled={cancellingInProgress}
                                                    onClick={handleCancelBooking}
                                                >
                                                    {cancellingInProgress
                                                        ? 'Cancelling…'
                                                        : 'Cancel booking'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`active-booking-status-card status-${myBooking.status}`}
                                        >
                                            <div className='active-booking-info'>
                                                {myBooking.status === 'pending' ? (
                                                    <Clock size={18} />
                                                ) : (
                                                    <XCircle size={18} />
                                                )}
                                                <div>
                                                    <strong>
                                                        {myBooking.status === 'pending'
                                                            ? 'Booking Pending Driver Approval'
                                                            : `Booking ${myBooking.status}`}
                                                    </strong>
                                                    <p>
                                                        Seat(s):{' '}
                                                        <b>
                                                            {myBooking.seatNumbers.join(
                                                                ', ',
                                                            )}
                                                        </b>
                                                    </p>
                                                </div>
                                            </div>
                                            {myBooking.status === 'pending' && (
                                                <button
                                                    type='button'
                                                    className='button button-outline ride-cancel-booking-btn'
                                                    disabled={cancellingInProgress}
                                                    onClick={handleCancelBooking}
                                                >
                                                    {cancellingInProgress
                                                        ? 'Cancelling…'
                                                        : 'Cancel booking'}
                                                </button>
                                            )}
                                        </div>
                                    )
                                ) : isDriverOfThisRide ? (
                                    <p className='ride-booking-notice'>
                                        <ShieldAlert size={15} /> You are the driver for
                                        this ride. You cannot book seats on your own ride.
                                    </p>
                                ) : ride.status !== 'scheduled' ? (
                                    <p className='ride-booking-notice'>
                                        This ride is {ride.status} and is no longer
                                        accepting bookings.
                                    </p>
                                ) : (
                                    <div className='booking-cta-bar'>
                                        <div className='booking-cta-meta'>
                                            <span>
                                                Selected seats:{' '}
                                                <strong>
                                                    {selectedSeats.length > 0
                                                        ? selectedSeats.join(', ')
                                                        : 'None'}
                                                </strong>
                                            </span>
                                            {selectedSeats.length > 0 && (
                                                <span
                                                    style={{
                                                        color: '#68203f',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Total amount:{' '}
                                                    <strong>
                                                        ₹
                                                        {selectedSeats.length *
                                                            (ride.pricePerSeat ?? 250)}
                                                    </strong>{' '}
                                                    <small
                                                        style={{
                                                            fontWeight: 400,
                                                            color: '#7a6470',
                                                        }}
                                                    >
                                                        ({selectedSeats.length} × ₹
                                                        {ride.pricePerSeat ?? 250})
                                                    </small>
                                                </span>
                                            )}
                                            <small>
                                                Razorpay Test Mode · Instant confirmation
                                            </small>
                                        </div>
                                        <button
                                            type='button'
                                            className='button button-burgundy booking-submit-cta'
                                            disabled={
                                                selectedSeats.length === 0 ||
                                                bookingInProgress
                                            }
                                            onClick={handleRequestBooking}
                                        >
                                            {bookingInProgress
                                                ? 'Processing…'
                                                : selectedSeats.length > 0
                                                  ? `Pay & Confirm (₹${selectedSeats.length * (ride.pricePerSeat ?? 250)})`
                                                  : 'Select a seat'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    </article>
                ) : null}

                {/* Razorpay Test Mode In-App Checkout Modal */}
                {paymentModal && (
                    <div
                        className='rating-modal-overlay'
                        role='dialog'
                        aria-modal='true'
                    >
                        <div
                            className='rating-modal-card'
                            style={{ maxWidth: '440px' }}
                        >
                            {paymentModal.isSuccess ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '12px 6px 8px',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '54px',
                                            height: '54px',
                                            borderRadius: '50%',
                                            background: '#e8f7ee',
                                            display: 'grid',
                                            placeItems: 'center',
                                            margin: '0 auto 12px',
                                        }}
                                    >
                                        <CheckCircle2
                                            size={32}
                                            color='#18794e'
                                        />
                                    </div>
                                    <span
                                        style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            letterSpacing: '1px',
                                            color: '#18794e',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        CONFIRMED & PAID
                                    </span>
                                    <h3
                                        style={{
                                            margin: '4px 0 6px',
                                            fontSize: '20px',
                                            color: '#1d2e24',
                                        }}
                                    >
                                        Ticket is Booked!
                                    </h3>
                                    <p
                                        style={{
                                            margin: '0 0 16px',
                                            fontSize: '12px',
                                            color: '#607267',
                                        }}
                                    >
                                        Your payment of ₹{paymentModal.amount} was
                                        verified and your seat is reserved.
                                    </p>

                                    <div
                                        style={{
                                            background: '#f9f6f7',
                                            border: '1px solid #ebd7df',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                            textAlign: 'left',
                                            marginBottom: '18px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            <span style={{ color: '#74626c' }}>
                                                Confirmed Seat(s):
                                            </span>
                                            <strong
                                                style={{
                                                    color: '#68203f',
                                                    fontSize: '13px',
                                                }}
                                            >
                                                Seat{' '}
                                                {paymentModal.confirmedBooking?.seatNumbers?.join(
                                                    ', ',
                                                ) ?? paymentModal.seatNumbers.join(', ')}
                                            </strong>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            <span style={{ color: '#74626c' }}>
                                                Route:
                                            </span>
                                            <strong
                                                style={{
                                                    color: '#352431',
                                                    textAlign: 'right',
                                                    maxWidth: '65%',
                                                }}
                                            >
                                                {ride?.pickup.displayName} →{' '}
                                                {ride?.destination.displayName}
                                            </strong>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            <span style={{ color: '#74626c' }}>
                                                Driver:
                                            </span>
                                            <span style={{ color: '#352431' }}>
                                                {ride?.driver.displayName}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            <span style={{ color: '#74626c' }}>
                                                Amount Paid:
                                            </span>
                                            <strong style={{ color: '#18794e' }}>
                                                ₹{paymentModal.amount}
                                            </strong>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '11px',
                                                paddingTop: '6px',
                                                borderTop: '1px dashed #d9c4ce',
                                            }}
                                        >
                                            <span style={{ color: '#74626c' }}>
                                                Ticket Ref:
                                            </span>
                                            <code>
                                                {paymentModal.confirmedBooking?.id
                                                    ?.slice(-8)
                                                    .toUpperCase() ??
                                                    paymentModal.bookingId
                                                        .slice(-8)
                                                        .toUpperCase()}
                                            </code>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type='button'
                                            className='button button-burgundy'
                                            style={{ flex: 1 }}
                                            onClick={() => setPaymentModal(null)}
                                        >
                                            View Ticket
                                        </button>
                                        <Link
                                            to='/bookings'
                                            className='button button-outline'
                                            style={{
                                                flex: 1,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            My Bookings
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className='rating-modal-header'>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            <CreditCard
                                                size={18}
                                                color='#742b49'
                                            />
                                            <h3 style={{ margin: 0, fontSize: '18px' }}>
                                                Razorpay Test Mode Checkout
                                            </h3>
                                        </div>
                                        <button
                                            type='button'
                                            className='rating-modal-close'
                                            onClick={() =>
                                                void handleCancelPayment(
                                                    paymentModal.bookingId,
                                                    'Modal closed',
                                                )
                                            }
                                            aria-label='Close'
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            padding: '16px 0',
                                            borderBottom: '1px solid #ebd7df',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <span style={{ color: '#68545e' }}>
                                                Selected Seats:
                                            </span>
                                            <strong>
                                                Seat {paymentModal.seatNumbers.join(', ')}
                                            </strong>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <span style={{ color: '#68545e' }}>
                                                Price per seat:
                                            </span>
                                            <span>₹{ride?.pricePerSeat ?? 250}</span>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '8px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            <span style={{ color: '#68545e' }}>
                                                Order ID:
                                            </span>
                                            <code
                                                style={{
                                                    fontSize: '11px',
                                                    background: '#f5eef1',
                                                    padding: '2px 5px',
                                                    borderRadius: '3px',
                                                }}
                                            >
                                                {paymentModal.orderId}
                                            </code>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginTop: '12px',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                color: '#4a2537',
                                            }}
                                        >
                                            <span>Total Amount:</span>
                                            <span>₹{paymentModal.amount}</span>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: '16px',
                                            display: 'grid',
                                            gap: '10px',
                                        }}
                                    >
                                        <button
                                            type='button'
                                            className='button button-burgundy'
                                            disabled={verifyingPayment}
                                            onClick={() =>
                                                void handleVerifyPayment(
                                                    paymentModal.bookingId,
                                                    paymentModal.orderId,
                                                    `pay_test_${Date.now()}`,
                                                    'test_signature_mock',
                                                )
                                            }
                                        >
                                            {verifyingPayment
                                                ? 'Verifying payment…'
                                                : `Pay ₹${paymentModal.amount}`}
                                        </button>
                                        <button
                                            type='button'
                                            className='button button-outline text-danger'
                                            disabled={verifyingPayment}
                                            onClick={() =>
                                                void handleCancelPayment(
                                                    paymentModal.bookingId,
                                                    'Simulated payment failure by user',
                                                )
                                            }
                                        >
                                            Simulate Payment Failure
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* SOS Emergency Confirmation Modal */}
                {sosModalOpen && (
                    <div
                        className='rating-modal-overlay'
                        role='dialog'
                        aria-modal='true'
                    >
                        <div
                            className='rating-modal-card'
                            style={{ maxWidth: '480px' }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid #ebd3df',
                                    paddingBottom: '12px',
                                    marginBottom: '16px',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <AlertTriangle
                                        size={20}
                                        color='#631238'
                                    />
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: '16px',
                                            color: '#352431',
                                        }}
                                    >
                                        Emergency SOS Confirmation
                                    </h3>
                                </div>
                                <button
                                    type='button'
                                    onClick={() => setSosModalOpen(false)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div
                                className='payment-demo-notice'
                                style={{ marginBottom: '16px' }}
                            >
                                <p style={{ margin: 0 }}>
                                    <strong>Safety Protocol:</strong> Triggering SOS
                                    immediately alerts platform safety monitors and other
                                    ride participants with your real-time coordinates.
                                </p>
                            </div>

                            <div style={{ display: 'grid', gap: '14px' }}>
                                <label className='auth-field'>
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '12px',
                                            color: '#352431',
                                        }}
                                    >
                                        Type of Emergency
                                    </span>
                                    <select
                                        className='ride-control'
                                        value={sosType}
                                        onChange={(e) =>
                                            setSosType(e.target.value as EmergencyType)
                                        }
                                    >
                                        <option value='unsafe_behavior'>
                                            Unsafe Behavior / Danger
                                        </option>
                                        <option value='medical'>Medical Emergency</option>
                                        <option value='accident'>
                                            Vehicle Breakdown / Accident
                                        </option>
                                        <option value='route_deviation'>
                                            Unauthorized Route Deviation
                                        </option>
                                        <option value='general'>General Emergency</option>
                                    </select>
                                </label>

                                <label className='auth-field'>
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '12px',
                                            color: '#352431',
                                        }}
                                    >
                                        Incident Details (Optional)
                                    </span>
                                    <textarea
                                        className='ride-control'
                                        rows={3}
                                        placeholder='Describe what happened or where you are…'
                                        value={sosMessage}
                                        onChange={(e) => setSosMessage(e.target.value)}
                                    />
                                </label>

                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '10px',
                                        marginTop: '10px',
                                    }}
                                >
                                    <button
                                        type='button'
                                        className='button button-outline'
                                        style={{ flex: 1 }}
                                        onClick={() => setSosModalOpen(false)}
                                        disabled={sosSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type='button'
                                        className='button'
                                        style={{
                                            flex: 2,
                                            background: '#631238',
                                            color: '#fff',
                                            border: 'none',
                                        }}
                                        onClick={handleTriggerSos}
                                        disabled={sosSubmitting}
                                    >
                                        {sosSubmitting
                                            ? 'Broadcasting Alert…'
                                            : '🚨 Broadcast SOS Alert'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
