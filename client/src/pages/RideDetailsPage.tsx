import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Cigarette,
    Clock,
    Luggage,
    Radio,
    ShieldAlert,
    ShieldCheck,
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
                request<{ bookings: Booking[] }>('/api/bookings/mine').catch(() => ({
                    bookings: [],
                })),
                request<{ sosAlert: SosAlert | null }>(`/api/sos/ride/${id}`).catch(
                    () => ({ sosAlert: null }),
                ),
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
