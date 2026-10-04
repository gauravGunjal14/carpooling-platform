import { useEffect, useId, useState } from 'react';
import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import type { RideLocation } from '../types/rides';

type Props = {
    id: string;
    label: string;
    value: RideLocation | null;
    onChange: (location: RideLocation | null) => void;
};

export function LocationAutocomplete({ id, label, value, onChange }: Props) {
    const descriptionId = useId();
    const { request } = useAuth();
    const [query, setQuery] = useState(value?.displayName ?? '');
    const [results, setResults] = useState<RideLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (value) setQuery(value.displayName);
    }, [value?.displayName]);

    async function searchPlaces() {
        if (loading) return;
        const trimmed = query.trim();
        if (trimmed.length < 3) {
            setError('Enter at least three characters.');
            return;
        }

        setLoading(true);
        setError('');
        setSearched(true);
        try {
            const params = new URLSearchParams({ q: trimmed });
            const result = await request<{ locations: RideLocation[] }>(
                `/api/locations/search?${params.toString()}`,
            );
            setResults(result.locations);
            if (result.locations.length === 0) {
                setError('No places found. Try a nearby public landmark or city.');
            }
        } catch (cause) {
            setResults([]);
            setError(
                cause instanceof ApiError
                    ? cause.message
                    : 'We could not reach place search. Check your connection and try again.',
            );
        } finally {
            setLoading(false);
        }
    }

    function selectLocation(location: RideLocation) {
        setQuery(location.displayName);
        setResults([]);
        setSearched(false);
        setError('');
        onChange(location);
    }

    function clearLocation() {
        setQuery('');
        setResults([]);
        setSearched(false);
        setError('');
        onChange(null);
    }

    return (
        <div className='location-field'>
            <label
                className='auth-field'
                htmlFor={id}
            >
                <span>{label}</span>
                <span className='location-input-wrap'>
                    <MapPin
                        size={16}
                        aria-hidden='true'
                    />
                    <input
                        id={id}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setResults([]);
                            setSearched(false);
                            setError('');
                            if (value) onChange(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void searchPlaces();
                            }
                        }}
                        autoComplete='off'
                        aria-describedby={descriptionId}
                        aria-invalid={Boolean(error)}
                        placeholder='Search a city or public landmark'
                        maxLength={100}
                        required
                    />
                    {query && (
                        <button
                            className='location-clear'
                            type='button'
                            onClick={clearLocation}
                            aria-label={`Clear ${label.toLowerCase()}`}
                        >
                            <X size={15} />
                        </button>
                    )}
                </span>
            </label>
            <p
                className='location-helper'
                id={descriptionId}
            >
                Search public places. Avoid home addresses and other private details.
            </p>
            <div className='location-search-form'>
                <button
                    className='location-search-button'
                    type='button'
                    onClick={() => void searchPlaces()}
                    disabled={loading || query.trim().length < 3}
                >
                    {loading ? (
                        <LoaderCircle
                            size={15}
                            className='location-spinner'
                        />
                    ) : (
                        <Search size={15} />
                    )}
                    {loading ? 'Searching places…' : 'Search places'}
                </button>
            </div>
            {results.length > 0 && (
                <ul
                    className='location-results'
                    aria-label={`${label} search results`}
                >
                    {results.map((location) => (
                        <li
                            key={`${location.latitude}:${location.longitude}:${location.displayName}`}
                        >
                            <button
                                type='button'
                                onClick={() => selectLocation(location)}
                            >
                                <MapPin
                                    size={15}
                                    aria-hidden='true'
                                />
                                <span>{location.displayName}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {error && (
                <p
                    className='location-error'
                    role='alert'
                >
                    {error}
                </p>
            )}
            {value && !searched && !error && (
                <p className='location-selected'>
                    Selected · {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
                </p>
            )}
        </div>
    );
}
