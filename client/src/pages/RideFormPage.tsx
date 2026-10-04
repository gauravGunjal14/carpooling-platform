import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CarFront, Save, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LocationAutocomplete } from '../components/LocationAutocomplete';
import { LazyRideMap } from '../components/LazyRideMap';
import { RideWorkspaceHeader } from '../components/RideWorkspaceHeader';
import { useAuth } from '../hooks/useAuth';
import type { Ride, RideLocation } from '../types/rides';

type FormState = {
    pickup: RideLocation | null;
    destination: RideLocation | null;
    date: string;
    time: string;
    seats: string;
    smokingAllowed: boolean;
    luggage: 'small' | 'standard' | 'large';
    notes: string;
    womenOnly: boolean;
};
type Verification = {
    isVerified: boolean;
    womenOnlyEligible: boolean;
};

function localInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function localInputTime(date: Date): string {
    return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function initialForm(): FormState {
    const defaultDeparture = new Date(Date.now() + 24 * 60 * 60 * 1000);
    defaultDeparture.setSeconds(0, 0);
    return {
        pickup: null,
        destination: null,
        date: localInputDate(defaultDeparture),
        time: '10:00',
        seats: '3',
        smokingAllowed: false,
        luggage: 'standard',
        notes: '',
        womenOnly: false,
    };
}

function formFromRide(ride: Ride): FormState {
    const departure = new Date(ride.departureAt);
    return {
        pickup: ride.pickup,
        destination: ride.destination,
        date: localInputDate(departure),
        time: localInputTime(departure),
        seats: String(ride.availableSeats),
        smokingAllowed: ride.preferences.smokingAllowed,
        luggage: ride.preferences.luggage,
        notes: ride.preferences.notes,
        womenOnly: ride.womenOnly,
    };
}

export function RideFormPage() {
    const { id } = useParams();
    const isEditing = Boolean(id);
    const { request } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(initialForm);
    const [verification, setVerification] = useState<Verification | null>(null);
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [canEdit, setCanEdit] = useState(true);
    const [error, setError] = useState('');
    const minimumDate = useMemo(() => localInputDate(new Date()), []);

    useEffect(() => {
        let active = true;
        void Promise.all([
            request<{ verification: Verification }>('/api/verification/me'),
            id ? request<{ ride: Ride }>(`/api/rides/mine/${id}`) : Promise.resolve(null),
        ])
            .then(([verificationResult, rideResult]) => {
                if (!active) return;
                setVerification(verificationResult.verification);
                if (rideResult) {
                    setForm(formFromRide(rideResult.ride));
                    const editable =
                        rideResult.ride.status === 'scheduled' &&
                        new Date(rideResult.ride.departureAt) > new Date();
                    setCanEdit(editable);
                    if (!editable)
                        setError(
                            'This ride has already departed or is no longer active.',
                        );
                }
            })
            .catch((cause) => {
                if (active) {
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : 'Ride details could not be loaded.',
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [id, request]);

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        if (!form.pickup || !form.destination) {
            setError('Search for and select both pickup and destination places.');
            return;
        }
        const departureAt = new Date(`${form.date}T${form.time}`);
        if (!Number.isFinite(departureAt.getTime()) || departureAt <= new Date()) {
            setError('Choose a departure date and time in the future.');
            return;
        }
        if (form.womenOnly && !verification?.womenOnlyEligible) {
            setError(
                'Women-only rides require administrator-granted eligibility after verification.',
            );
            return;
        }

        setSaving(true);
        try {
            const payload = {
                pickup: form.pickup,
                destination: form.destination,
                departureAt: departureAt.toISOString(),
                availableSeats: Number(form.seats),
                preferences: {
                    smokingAllowed: form.smokingAllowed,
                    luggage: form.luggage,
                    notes: form.notes.trim(),
                },
                womenOnly: form.womenOnly,
            };
            await request<{ ride: Ride }>(
                isEditing ? `/api/rides/mine/${id}` : '/api/rides',
                {
                    method: isEditing ? 'PATCH' : 'POST',
                    body: JSON.stringify(payload),
                },
            );
            navigate('/app/driver', { replace: true });
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : 'This ride could not be saved.',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className='ride-workspace'>
            <RideWorkspaceHeader role='Driver' />
            <main className='ride-form-main'>
                <Link
                    className='ride-back-link'
                    to='/app/driver'
                >
                    <ArrowLeft size={14} /> Back to your rides
                </Link>
                <section
                    className='ride-form-shell'
                    aria-labelledby='ride-form-title'
                >
                    <div className='ride-form-heading'>
                        <span className='ride-form-icon'>
                            <CarFront size={21} />
                        </span>
                        <div>
                            <span className='eyebrow'>DRIVER WORKSPACE</span>
                            <h1 id='ride-form-title'>
                                {isEditing ? 'Update your ride' : 'Offer a ride'}
                            </h1>
                        </div>
                    </div>
                    <p className='ride-form-intro'>
                        Add the route and travel details passengers need to find a
                        compatible ride.
                    </p>
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
                    ) : (
                        <>
                            {!canEdit && (
                                <p className='ride-readonly-note'>
                                    This ride is read-only.
                                </p>
                            )}
                            <form
                                className='ride-form'
                                onSubmit={handleSubmit}
                            >
                                <div className='ride-location-grid'>
                                    <LocationAutocomplete
                                        id='ride-pickup'
                                        label='Pickup place'
                                        value={form.pickup}
                                        onChange={(value) => update('pickup', value)}
                                    />
                                    <LocationAutocomplete
                                        id='ride-destination'
                                        label='Destination'
                                        value={form.destination}
                                        onChange={(value) => update('destination', value)}
                                    />
                                </div>
                                <LazyRideMap
                                    pickup={form.pickup}
                                    destination={form.destination}
                                />
                                <div className='ride-form-grid'>
                                    <label
                                        className='auth-field'
                                        htmlFor='ride-date'
                                    >
                                        <span>Departure date</span>
                                        <input
                                            id='ride-date'
                                            className='ride-control'
                                            type='date'
                                            min={minimumDate}
                                            value={form.date}
                                            onChange={(event) =>
                                                update('date', event.target.value)
                                            }
                                            required
                                        />
                                    </label>
                                    <label
                                        className='auth-field'
                                        htmlFor='ride-time'
                                    >
                                        <span>Departure time</span>
                                        <input
                                            id='ride-time'
                                            className='ride-control'
                                            type='time'
                                            value={form.time}
                                            onChange={(event) =>
                                                update('time', event.target.value)
                                            }
                                            required
                                        />
                                    </label>
                                    <label
                                        className='auth-field'
                                        htmlFor='ride-seats'
                                    >
                                        <span>Available seats</span>
                                        <select
                                            id='ride-seats'
                                            className='ride-control'
                                            value={form.seats}
                                            onChange={(event) =>
                                                update('seats', event.target.value)
                                            }
                                            required
                                        >
                                            {[1, 2, 3, 4, 5, 6].map((count) => (
                                                <option
                                                    key={count}
                                                    value={count}
                                                >
                                                    {count}{' '}
                                                    {count === 1 ? 'seat' : 'seats'}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label
                                        className='auth-field'
                                        htmlFor='ride-luggage'
                                    >
                                        <span>Luggage space</span>
                                        <select
                                            id='ride-luggage'
                                            className='ride-control'
                                            value={form.luggage}
                                            onChange={(event) =>
                                                update(
                                                    'luggage',
                                                    event.target
                                                        .value as FormState['luggage'],
                                                )
                                            }
                                        >
                                            <option value='small'>Small bag</option>
                                            <option value='standard'>
                                                Standard luggage
                                            </option>
                                            <option value='large'>Large luggage</option>
                                        </select>
                                    </label>
                                </div>
                                <label className='ride-check-row'>
                                    <input
                                        type='checkbox'
                                        checked={form.smokingAllowed}
                                        onChange={(event) =>
                                            update('smokingAllowed', event.target.checked)
                                        }
                                    />
                                    <span>Smoking is allowed during this ride</span>
                                </label>
                                <label
                                    className='auth-field'
                                    htmlFor='ride-notes'
                                >
                                    <span>
                                        Ride notes <small>(optional)</small>
                                    </span>
                                    <textarea
                                        id='ride-notes'
                                        className='ride-control ride-notes'
                                        maxLength={240}
                                        value={form.notes}
                                        onChange={(event) =>
                                            update('notes', event.target.value)
                                        }
                                        placeholder='Share useful details about the trip.'
                                    />
                                    <small className='auth-field-note'>
                                        {form.notes.length}/240 characters
                                    </small>
                                </label>
                                <div
                                    className={`ride-women-toggle${verification?.womenOnlyEligible ? '' : ' ride-women-toggle-disabled'}`}
                                >
                                    <label className='ride-check-row'>
                                        <input
                                            type='checkbox'
                                            checked={form.womenOnly}
                                            disabled={
                                                !verification?.womenOnlyEligible &&
                                                !form.womenOnly
                                            }
                                            onChange={(event) =>
                                                update('womenOnly', event.target.checked)
                                            }
                                        />
                                        <span>
                                            <strong>Women-only ride</strong>
                                            <small>
                                                For eligible, verified passengers;
                                                visibility is enforced by the server.
                                            </small>
                                        </span>
                                    </label>
                                    <div className='ride-women-status'>
                                        <ShieldCheck size={15} />
                                        {verification?.womenOnlyEligible
                                            ? 'Eligibility confirmed by an administrator'
                                            : 'Eligibility is granted by an administrator after document review'}
                                    </div>
                                </div>
                                <div className='ride-form-actions'>
                                    <Link
                                        className='ride-cancel-link'
                                        to='/app/driver'
                                    >
                                        Discard
                                    </Link>
                                    <button
                                        className='button button-burgundy'
                                        type='submit'
                                        disabled={saving || !canEdit}
                                    >
                                        <Save size={15} />{' '}
                                        {saving
                                            ? 'Saving…'
                                            : isEditing
                                              ? 'Save changes'
                                              : 'Publish ride'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}
