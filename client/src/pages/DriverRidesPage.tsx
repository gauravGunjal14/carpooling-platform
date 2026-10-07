import { useCallback, useEffect, useState } from 'react';
import {
    Award,
    CalendarDays,
    Check,
    CheckCircle2,
    Flag,
    Play,
    Plus,
    RefreshCw,
    Route,
    ShieldCheck,
    Star,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RideCard } from '../components/RideCard';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../providers/SocketProvider';
import { SOCKET_EVENTS } from '../types/socketEvents';
import type { Booking, ConfirmedPassenger, ProSubscription, Ride } from '../types/rides';

export function DriverRidesPage() {
    const { request } = useAuth();
    const [rides, setRides] = useState<Ride[]>([]);
    const [requests, setRequests] = useState<Booking[]>([]);
    const [subscription, setSubscription] = useState<ProSubscription | null>(null);
    const [subscribingInProgress, setSubscribingInProgress] = useState(false);
    const [selectedRidePassengers, setSelectedRidePassengers] = useState<{
        rideId: string;
        passengers: ConfirmedPassenger[];
    } | null>(null);
    const [activeTab, setActiveTab] = useState<'rides' | 'requests' | 'subscription'>(
        'rides',
    );
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Rating modal state for Driver rating Passenger
    const [ratingPassenger, setRatingPassenger] = useState<{
        rideId: string;
        bookingId: string;
        passengerId: string;
        name: string;
    } | null>(null);
    const [ratingValue, setRatingValue] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [ridesRes, requestsRes, subRes] = await Promise.all([
                request<{ rides: Ride[] }>('/api/rides/mine'),
                request<{ requests: Booking[] }>('/api/bookings/driver/requests').catch(
                    () => ({ requests: [] }),
                ),
                request<{ subscription: ProSubscription | null }>(
                    '/api/subscriptions/me',
                ).catch(() => ({ subscription: null })),
            ]);
            setRides(ridesRes.rides);
            setRequests(requestsRes.requests);
            setSubscription(subRes.subscription);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Failed to load driver dashboard data.',
            );
        } finally {
            setLoading(false);
        }
    }, [request]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const { subscribe } = useSocket();

    useEffect(() => {
        const unsubReq = subscribe(SOCKET_EVENTS.BOOKING_REQUEST_RECEIVED, () => {
            void loadData();
        });
        const unsubCancel = subscribe(SOCKET_EVENTS.BOOKING_CANCELLED, () => {
            void loadData();
        });
        return () => {
            unsubReq();
            unsubCancel();
        };
    }, [subscribe, loadData]);

    async function handleAcceptBooking(bookingId: string) {
        setActionId(bookingId);
        setError('');
        setSuccessMessage('');
        try {
            await request(`/api/bookings/${bookingId}/accept`, { method: 'PATCH' });
            setSuccessMessage('Booking accepted! The passenger has been confirmed.');
            await loadData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Could not accept booking.',
            );
        } finally {
            setActionId(null);
        }
    }

    async function handleRejectBooking(bookingId: string) {
        const reason = window.prompt(
            'Optional: Reason for declining this booking request:',
        );
        setActionId(bookingId);
        setError('');
        setSuccessMessage('');
        try {
            await request(`/api/bookings/${bookingId}/reject`, {
                method: 'PATCH',
                body: JSON.stringify({ reason: reason || 'Declined by driver' }),
            });
            setSuccessMessage('Booking declined. Held seats have been restored.');
            await loadData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Could not decline booking.',
            );
        } finally {
            setActionId(null);
        }
    }

    async function handleStartRide(rideId: string) {
        if (!window.confirm('Start this trip now?')) return;
        setActionId(rideId);
        setError('');
        setSuccessMessage('');
        try {
            await request(`/api/rides/mine/${rideId}/start`, { method: 'PATCH' });
            setSuccessMessage(
                'Trip is now active and in progress. Passengers have been notified.',
            );
            await loadData();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not start trip.');
        } finally {
            setActionId(null);
        }
    }

    async function handleCompleteRide(rideId: string) {
        if (
            !window.confirm(
                'Mark this trip as completed? This will conclude the ride and unlock ratings.',
            )
        )
            return;
        setActionId(rideId);
        setError('');
        setSuccessMessage('');
        try {
            await request(`/api/rides/mine/${rideId}/complete`, {
                method: 'PATCH',
            });
            setSuccessMessage('Trip completed safely! You can now rate your passengers.');
            await loadData();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not complete trip.');
        } finally {
            setActionId(null);
        }
    }

    async function handleCancelRide(id: string) {
        if (
            !window.confirm(
                'Cancel this ride? Note: Standard drivers cannot cancel within 30 hours of departure (12 hours for Pro drivers).',
            )
        )
            return;
        setActionId(id);
        setError('');
        setSuccessMessage('');
        try {
            await request(`/api/rides/mine/${id}/cancel`, { method: 'PATCH' });
            setSuccessMessage(
                'Ride cancelled. All passengers have been notified and seats released.',
            );
            await loadData();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'This ride could not be cancelled.',
            );
        } finally {
            setActionId(null);
        }
    }

    async function handleViewPassengers(rideId: string) {
        setError('');
        try {
            const res = await request<{ passengers: ConfirmedPassenger[] }>(
                `/api/rides/${rideId}/passengers`,
            );
            setSelectedRidePassengers({ rideId, passengers: res.passengers });
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Failed to load passengers.',
            );
        }
    }

    async function handleSubmitRating() {
        if (!ratingPassenger) return;
        setSubmittingRating(true);
        setError('');
        try {
            await request('/api/ratings', {
                method: 'POST',
                body: JSON.stringify({
                    rideId: ratingPassenger.rideId,
                    bookingId: ratingPassenger.bookingId,
                    toUserId: ratingPassenger.passengerId,
                    targetRole: 'Passenger',
                    rating: ratingValue,
                    review: reviewText,
                }),
            });
            setSuccessMessage(`Rating submitted for ${ratingPassenger.name}! Thank you.`);
            setRatingPassenger(null);
            setReviewText('');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to submit rating.');
        } finally {
            setSubmittingRating(false);
        }
    }

    async function handleUpgradeToPro() {
        setSubscribingInProgress(true);
        setError('');
        setSuccessMessage('');
        try {
            const res = await request<{ subscription: ProSubscription }>(
                '/api/subscriptions/upgrade',
                {
                    method: 'POST',
                    body: JSON.stringify({ billingCycle: 'monthly' }),
                },
            );
            setSubscription(res.subscription);
            setSuccessMessage(
                'Congratulations! You are now upgraded to Verified Pro Driver membership.',
            );
            await loadData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Failed to upgrade to Pro.',
            );
        } finally {
            setSubscribingInProgress(false);
        }
    }

    async function handleCancelSubscription() {
        if (!window.confirm('Are you sure you want to cancel your Pro membership?'))
            return;
        setSubscribingInProgress(true);
        setError('');
        setSuccessMessage('');
        try {
            await request('/api/subscriptions/cancel', { method: 'POST' });
            setSuccessMessage('Pro subscription has been cancelled.');
            await loadData();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'Failed to cancel subscription.',
            );
        } finally {
            setSubscribingInProgress(false);
        }
    }

    const upcomingCount = rides.filter(
        (r) => r.status === 'scheduled' || r.status === 'active',
    ).length;
    const pendingRequests = requests.filter((r) => r.status === 'pending');

    return (
        <div className='ride-workspace'>
            <RideWorkspaceHeader role='Driver' />
            <main className='ride-workspace-main'>
                <section className='ride-page-intro'>
                    <span className='eyebrow'>DRIVER WORKSPACE</span>
                    <h1>Your journeys, thoughtfully planned.</h1>
                    <p>
                        Create rides, manage passenger booking requests, track trips, and
                        maintain passenger trust.
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
                            <small>UPCOMING / ACTIVE</small>
                            <strong>{upcomingCount}</strong>
                        </span>
                    </div>
                    <div>
                        <Users size={17} />
                        <span>
                            <small>PENDING REQUESTS</small>
                            <strong>{pendingRequests.length}</strong>
                        </span>
                    </div>
                </div>

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

                {/* Dashboard Tabs: My Rides vs Booking Requests vs Pro Membership */}
                <div className='driver-dashboard-tabs'>
                    <button
                        type='button'
                        className={`driver-tab ${activeTab === 'rides' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rides')}
                    >
                        Created Rides ({rides.length})
                    </button>
                    <button
                        type='button'
                        className={`driver-tab ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        Booking Requests ({pendingRequests.length} pending)
                    </button>
                    <button
                        type='button'
                        className={`driver-tab ${activeTab === 'subscription' ? 'active' : ''}`}
                        onClick={() => setActiveTab('subscription')}
                    >
                        Pro Membership {subscription?.status === 'active' ? '★' : ''}
                    </button>
                </div>

                <div className='ride-list-heading'>
                    <div>
                        <span className='eyebrow'>
                            {activeTab === 'rides'
                                ? 'RIDE MANAGEMENT'
                                : activeTab === 'requests'
                                  ? 'PASSENGER REQUESTS'
                                  : 'MEMBERSHIP & PERKS'}
                        </span>
                        <h2>
                            {activeTab === 'rides'
                                ? 'Created journeys'
                                : activeTab === 'requests'
                                  ? `Booking requests (${requests.length})`
                                  : 'Verified Pro Driver'}
                        </h2>
                    </div>
                    <button
                        className='ride-refresh'
                        type='button'
                        onClick={() => void loadData()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <p
                        className='ride-empty'
                        role='status'
                    >
                        Loading dashboard…
                    </p>
                ) : activeTab === 'rides' ? (
                    rides.length === 0 ? (
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
                                    <div className='driver-ride-actions'>
                                        <button
                                            type='button'
                                            onClick={() =>
                                                void handleViewPassengers(ride.id)
                                            }
                                        >
                                            <Users size={12} /> Passengers (
                                            {ride.confirmedPassengerCount ?? 0})
                                            {Boolean(ride.pendingPassengerCount) && (
                                                <span
                                                    style={{
                                                        marginLeft: '4px',
                                                        fontSize: '10px',
                                                        color: '#8e1b4f',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    +{ride.pendingPassengerCount} req
                                                </span>
                                            )}
                                        </button>

                                        {ride.status === 'scheduled' && (
                                            <>
                                                <button
                                                    type='button'
                                                    disabled={actionId === ride.id}
                                                    onClick={() =>
                                                        void handleStartRide(ride.id)
                                                    }
                                                >
                                                    <Play size={12} /> Start trip
                                                </button>
                                                <button
                                                    type='button'
                                                    className='text-danger'
                                                    disabled={actionId === ride.id}
                                                    onClick={() =>
                                                        void handleCancelRide(ride.id)
                                                    }
                                                >
                                                    Cancel ride
                                                </button>
                                            </>
                                        )}

                                        {ride.status === 'active' && (
                                            <button
                                                type='button'
                                                className='text-burgundy'
                                                disabled={actionId === ride.id}
                                                onClick={() =>
                                                    void handleCompleteRide(ride.id)
                                                }
                                            >
                                                <Flag size={12} /> Complete trip
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : activeTab === 'requests' ? (
                    requests.length === 0 ? (
                        <div className='ride-empty ride-empty-card'>
                            <Users size={25} />
                            <h3>No booking requests</h3>
                            <p>
                                When passengers request seats on your rides, their
                                requests will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className='booking-requests-list'>
                            {requests.map((req) => (
                                <article
                                    key={req.id}
                                    className='booking-request-card'
                                >
                                    <div className='booking-request-header'>
                                        <div>
                                            <strong>
                                                {req.passenger?.displayName ??
                                                    'Passenger'}
                                            </strong>
                                            <small>{req.passenger?.email}</small>
                                        </div>
                                        <span
                                            className={`booking-status-tag status-${req.status}`}
                                        >
                                            {req.status}
                                        </span>
                                    </div>
                                    <div className='booking-request-body'>
                                        <p>
                                            Requested{' '}
                                            <b>
                                                {req.seatsBooked} seat
                                                {req.seatsBooked > 1 ? 's' : ''}
                                            </b>{' '}
                                            (Seat {req.seatNumbers.join(', ')})
                                        </p>
                                        {req.ride && (
                                            <p className='booking-request-route'>
                                                Trip:{' '}
                                                {req.ride.pickup.displayName.slice(0, 30)}{' '}
                                                →{' '}
                                                {req.ride.destination.displayName.slice(
                                                    0,
                                                    30,
                                                )}{' '}
                                                (
                                                {new Date(
                                                    req.ride.departureAt,
                                                ).toLocaleDateString()}
                                                )
                                            </p>
                                        )}
                                    </div>
                                    {req.status === 'pending' && (
                                        <div className='booking-request-actions'>
                                            <button
                                                type='button'
                                                className='button button-burgundy'
                                                disabled={actionId === req.id}
                                                onClick={() =>
                                                    void handleAcceptBooking(req.id)
                                                }
                                            >
                                                <Check size={14} /> Accept
                                            </button>
                                            <button
                                                type='button'
                                                className='button button-outline text-danger'
                                                disabled={actionId === req.id}
                                                onClick={() =>
                                                    void handleRejectBooking(req.id)
                                                }
                                            >
                                                <X size={14} /> Decline
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )
                ) : (
                    /* activeTab === 'subscription' */
                    <div className='pro-card-panel'>
                        <div className='pro-hero-tier'>
                            <div>
                                <span className='eyebrow'>MEMBERSHIP STATUS</span>
                                <h3
                                    style={{
                                        margin: '6px 0 2px',
                                        fontSize: '20px',
                                        color: '#352431',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    {subscription?.status === 'active' ? (
                                        <>
                                            <Award
                                                size={22}
                                                color='#631238'
                                            />
                                            Verified Pro Driver (Active)
                                        </>
                                    ) : (
                                        <>Standard Driver</>
                                    )}
                                </h3>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: '12px',
                                        color: '#695761',
                                    }}
                                >
                                    {subscription?.status === 'active'
                                        ? `Active monthly subscription (₹${subscription.amount}/mo). Valid until ${new Date(subscription.expiresAt).toLocaleDateString()}.`
                                        : 'Upgrade your driver profile to maximize ride bookings, search prominence, and cancellation flexibility.'}
                                </p>
                            </div>
                            {subscription?.status === 'active' ? (
                                <span className='pro-badge'>★ PRO MEMBER</span>
                            ) : (
                                <button
                                    type='button'
                                    className='button button-burgundy'
                                    disabled={subscribingInProgress}
                                    onClick={handleUpgradeToPro}
                                >
                                    {subscribingInProgress
                                        ? 'Activating…'
                                        : 'Upgrade to Pro (Demo: ₹499/mo)'}
                                </button>
                            )}
                        </div>

                        <div className='pro-benefits-grid'>
                            <div className='pro-benefit-card'>
                                <Zap
                                    size={20}
                                    color='#631238'
                                />
                                <h4>Priority Search Matching</h4>
                                <p>
                                    Your scheduled rides appear at the top of passenger
                                    search results with a +15 score boost.
                                </p>
                            </div>
                            <div className='pro-benefit-card'>
                                <CalendarDays
                                    size={20}
                                    color='#631238'
                                />
                                <h4>12-Hour Cancellation Window</h4>
                                <p>
                                    Enjoy shortened 12h cancellation flexibility without
                                    penalties or trust score impact.
                                </p>
                            </div>
                            <div className='pro-benefit-card'>
                                <ShieldCheck
                                    size={20}
                                    color='#631238'
                                />
                                <h4>Verified Pro Trust Badge</h4>
                                <p>
                                    Stand out to prospective passengers with an exclusive
                                    Pro badge on your ride listings and profile.
                                </p>
                            </div>
                        </div>

                        {subscription?.status === 'active' && (
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    paddingTop: '16px',
                                    borderTop: '1px solid #f0e6eb',
                                }}
                            >
                                <button
                                    type='button'
                                    className='button button-outline text-danger'
                                    disabled={subscribingInProgress}
                                    onClick={handleCancelSubscription}
                                >
                                    {subscribingInProgress
                                        ? 'Processing…'
                                        : 'Cancel Pro Subscription'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Confirmed Passengers Modal */}
                {selectedRidePassengers && (
                    <div className='rating-modal-overlay'>
                        <div className='rating-modal-card'>
                            <div className='rating-modal-header'>
                                <h3>Ride Passengers & Bookings</h3>
                                <button
                                    type='button'
                                    onClick={() => setSelectedRidePassengers(null)}
                                    aria-label='Close'
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            {(() => {
                                const confirmedList =
                                    selectedRidePassengers.passengers.filter(
                                        (p) => (p.status ?? 'accepted') === 'accepted',
                                    );
                                const pendingList =
                                    selectedRidePassengers.passengers.filter(
                                        (p) => p.status === 'pending',
                                    );

                                if (
                                    confirmedList.length === 0 &&
                                    pendingList.length === 0
                                ) {
                                    return (
                                        <p className='text-muted'>
                                            No passengers or booking requests for this
                                            ride yet.
                                        </p>
                                    );
                                }

                                return (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        {pendingList.length > 0 && (
                                            <div>
                                                <h4
                                                    style={{
                                                        fontSize: '11px',
                                                        letterSpacing: '0.5px',
                                                        textTransform: 'uppercase',
                                                        color: '#8e1b4f',
                                                        marginBottom: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    <Users size={13} /> Pending Booking
                                                    Requests ({pendingList.length})
                                                </h4>
                                                <div className='confirmed-passengers-list'>
                                                    {pendingList.map((p) => (
                                                        <div
                                                            key={p.bookingId}
                                                            className='confirmed-passenger-item'
                                                            style={{
                                                                borderColor: '#e4b6c8',
                                                                background: '#fdf7f9',
                                                            }}
                                                        >
                                                            <div>
                                                                <strong>{p.name}</strong>
                                                                <small>{p.email}</small>
                                                                <div
                                                                    className='passenger-seat-badge'
                                                                    style={{
                                                                        background:
                                                                            '#f5e8ee',
                                                                        color: '#631238',
                                                                    }}
                                                                >
                                                                    Requested Seat{' '}
                                                                    {p.seatNumbers.join(
                                                                        ', ',
                                                                    )}{' '}
                                                                    ({p.seatsBooked} seat
                                                                    {p.seatsBooked > 1
                                                                        ? 's'
                                                                        : ''}
                                                                    )
                                                                </div>
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    gap: '6px',
                                                                }}
                                                            >
                                                                <button
                                                                    type='button'
                                                                    className='button button-burgundy'
                                                                    style={{
                                                                        padding:
                                                                            '6px 12px',
                                                                        fontSize: '11px',
                                                                    }}
                                                                    disabled={
                                                                        actionId ===
                                                                        p.bookingId
                                                                    }
                                                                    onClick={async () => {
                                                                        await handleAcceptBooking(
                                                                            p.bookingId,
                                                                        );
                                                                        void handleViewPassengers(
                                                                            selectedRidePassengers.rideId,
                                                                        );
                                                                    }}
                                                                >
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    type='button'
                                                                    className='button button-outline text-danger'
                                                                    style={{
                                                                        padding:
                                                                            '6px 10px',
                                                                        fontSize: '11px',
                                                                    }}
                                                                    disabled={
                                                                        actionId ===
                                                                        p.bookingId
                                                                    }
                                                                    onClick={async () => {
                                                                        await handleRejectBooking(
                                                                            p.bookingId,
                                                                        );
                                                                        void handleViewPassengers(
                                                                            selectedRidePassengers.rideId,
                                                                        );
                                                                    }}
                                                                >
                                                                    Decline
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <h4
                                                style={{
                                                    fontSize: '11px',
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase',
                                                    color: '#4a3b42',
                                                    marginBottom: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <Check size={13} /> Confirmed Passengers (
                                                {confirmedList.length})
                                            </h4>
                                            {confirmedList.length === 0 ? (
                                                <p className='text-muted'>
                                                    No confirmed passengers yet for this
                                                    ride.
                                                </p>
                                            ) : (
                                                <div className='confirmed-passengers-list'>
                                                    {confirmedList.map((p) => {
                                                        const ride = rides.find(
                                                            (r) =>
                                                                r.id ===
                                                                selectedRidePassengers.rideId,
                                                        );
                                                        const isCompleted =
                                                            ride?.status === 'completed';

                                                        return (
                                                            <div
                                                                key={p.bookingId}
                                                                className='confirmed-passenger-item'
                                                            >
                                                                <div>
                                                                    <strong>
                                                                        {p.name}
                                                                    </strong>
                                                                    <small>
                                                                        {p.email}
                                                                    </small>
                                                                    <div className='passenger-seat-badge'>
                                                                        Seat{' '}
                                                                        {p.seatNumbers.join(
                                                                            ', ',
                                                                        )}{' '}
                                                                        ({p.seatsBooked}{' '}
                                                                        seat
                                                                        {p.seatsBooked > 1
                                                                            ? 's'
                                                                            : ''}
                                                                        )
                                                                    </div>
                                                                </div>
                                                                {isCompleted && (
                                                                    <button
                                                                        type='button'
                                                                        className='button button-outline'
                                                                        onClick={() => {
                                                                            setRatingPassenger(
                                                                                {
                                                                                    rideId: selectedRidePassengers.rideId,
                                                                                    bookingId:
                                                                                        p.bookingId,
                                                                                    passengerId:
                                                                                        p.passengerId,
                                                                                    name: p.name,
                                                                                },
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Star size={13} />{' '}
                                                                        Rate
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* Driver rating Passenger Modal */}
                {ratingPassenger && (
                    <div className='rating-modal-overlay'>
                        <div className='rating-modal-card'>
                            <div className='rating-modal-header'>
                                <h3>Rate Passenger</h3>
                                <button
                                    type='button'
                                    onClick={() => setRatingPassenger(null)}
                                    aria-label='Close'
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <p>
                                How was your experience traveling with{' '}
                                <b>{ratingPassenger.name}</b>?
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
                                placeholder='Leave a brief review about this passenger (optional)…'
                                maxLength={500}
                                value={reviewText}
                                onChange={(e) => setReviewText(e.target.value)}
                            />
                            <div className='rating-modal-actions'>
                                <button
                                    type='button'
                                    className='button button-outline'
                                    onClick={() => setRatingPassenger(null)}
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
