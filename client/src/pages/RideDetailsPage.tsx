import { useCallback, useEffect, useState } from 'react';
import {
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Cigarette,
    Clock,
    Luggage,
    ShieldAlert,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LazyRideMap } from '../components/LazyRideMap';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { SeatSelector } from '../components/SeatSelector';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../providers/SocketProvider';
import { SOCKET_EVENTS } from '../types/socketEvents';
import type { Booking, Ride, SeatStatusInfo } from '../types/rides';

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

    const loadRideData = useCallback(async () => {
        try {
            const [rideRes, seatsRes, bookingsRes] = await Promise.all([
                request<{ ride: Ride }>(`/api/rides/${id}`),
                request<{
                    totalSeats: number;
                    availableSeatsCount: number;
                    seats: SeatStatusInfo[];
                }>(`/api/rides/${id}/seats`),
                request<{ bookings: Booking[] }>('/api/bookings/mine').catch(() => ({
                    bookings: [],
                })),
            ]);

            setRide(rideRes.ride);
            setSeats(seatsRes.seats);
            setTotalSeats(seatsRes.totalSeats);

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
    }, [id, request]);

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
        return () => {
            unsubAccepted();
            unsubRejected();
            unsubCancelled();
            unsubRideStatus();
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
        if (selectedSeats.length === 0) return;
        setBookingInProgress(true);
        setError('');
        setSuccessMessage('');
        try {
            const res = await request<{ booking: Booking }>('/api/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    rideId: id,
                    seatNumbers: selectedSeats,
                }),
            });
            setSuccessMessage(
                `Booking requested for Seat ${selectedSeats.join(', ')}! The driver has been notified.`,
            );
            setSelectedSeats([]);
            setMyBooking(res.booking);
            await loadRideData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Failed to request booking.',
            );
        } finally {
            setBookingInProgress(false);
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
                                    <div
                                        className={`active-booking-status-card status-${myBooking.status}`}
                                    >
                                        <div className='active-booking-info'>
                                            {myBooking.status === 'pending' ? (
                                                <Clock size={18} />
                                            ) : myBooking.status === 'accepted' ? (
                                                <CheckCircle2 size={18} />
                                            ) : (
                                                <XCircle size={18} />
                                            )}
                                            <div>
                                                <strong>
                                                    {myBooking.status === 'pending'
                                                        ? 'Booking Pending Driver Approval'
                                                        : myBooking.status === 'accepted'
                                                          ? 'Booking Confirmed'
                                                          : `Booking ${myBooking.status}`}
                                                </strong>
                                                <p>
                                                    Seat(s):{' '}
                                                    <b>
                                                        {myBooking.seatNumbers.join(', ')}
                                                    </b>
                                                </p>
                                            </div>
                                        </div>
                                        {(myBooking.status === 'pending' ||
                                            myBooking.status === 'accepted') && (
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
                                            <small>
                                                Driver reviews request before confirmation
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
                                                ? 'Requesting…'
                                                : `Request booking (${selectedSeats.length} seat${
                                                      selectedSeats.length > 1 ? 's' : ''
                                                  })`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    </article>
                ) : null}
            </main>
        </div>
    );
}
