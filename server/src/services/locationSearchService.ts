import { AppError } from '../utils/appError.js';

export type LocationResult = {
    displayName: string;
    latitude: number;
    longitude: number;
};

type CacheEntry = { expiresAt: number; results: LocationResult[] };
const resultCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<LocationResult[]>>();
const cacheTtlMs = 6 * 60 * 60 * 1000;
const maxCacheEntries = 500;
const minRequestIntervalMs = 1100;
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

export async function searchPlaces(query: string): Promise<LocationResult[]> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ').toLowerCase();
    const cached = resultCache.get(normalizedQuery);
    if (cached && cached.expiresAt > Date.now()) return cached.results;
    const pending = inFlight.get(normalizedQuery);
    if (pending) return pending;

    const result = queueNominatimRequest(() => queryNominatim(normalizedQuery));
    inFlight.set(normalizedQuery, result);
    try {
        const locations = await result;
        resultCache.set(normalizedQuery, {
            expiresAt: Date.now() + cacheTtlMs,
            results: locations,
        });
        if (resultCache.size > maxCacheEntries) {
            const oldestKey = resultCache.keys().next().value;
            if (oldestKey) resultCache.delete(oldestKey);
        }
        return locations;
    } finally {
        inFlight.delete(normalizedQuery);
    }
}

function queueNominatimRequest<T>(operation: () => Promise<T>): Promise<T> {
    const result = requestQueue.then(async () => {
        const waitMs = Math.max(0, lastRequestAt + minRequestIntervalMs - Date.now());
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
        lastRequestAt = Date.now();
        return operation();
    });
    requestQueue = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}

async function queryNominatim(query: string): Promise<LocationResult[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'en',
                'User-Agent': 'WayfareCarpoolingPlatform/0.1 (location search)',
            },
            signal: AbortSignal.timeout(8000),
        });
    } catch (error) {
        const causeCode =
            typeof error === 'object' && error !== null && 'cause' in error
                ? (error.cause as { code?: unknown } | undefined)?.code
                : undefined;
        console.warn('Nominatim place search request failed.', {
            name: error instanceof Error ? error.name : 'UnknownError',
            code: typeof causeCode === 'string' ? causeCode : undefined,
        });
        throw new AppError(
            503,
            'LOCATION_SEARCH_UNAVAILABLE',
            'Place search could not connect to OpenStreetMap. Check your connection and try again shortly.',
        );
    }

    if (!response.ok) {
        console.warn('Nominatim place search returned an error response.', {
            status: response.status,
        });
        const message =
            response.status === 429
                ? 'Place search is busy. Wait a moment, then try again.'
                : 'OpenStreetMap place search is temporarily unavailable. Try again shortly.';
        throw new AppError(503, 'LOCATION_SEARCH_UNAVAILABLE', message);
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!Array.isArray(payload)) {
        throw new AppError(
            502,
            'INVALID_LOCATION_RESPONSE',
            'Place search returned an invalid response.',
        );
    }

    return payload
        .flatMap((item): LocationResult[] => {
            if (typeof item !== 'object' || item === null) return [];
            const record = item as Record<string, unknown>;
            const latitude = Number(record.lat);
            const longitude = Number(record.lon);
            if (
                typeof record.display_name !== 'string' ||
                !record.display_name.trim() ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
            ) {
                return [];
            }
            return [
                {
                    displayName: record.display_name.trim().slice(0, 200),
                    latitude,
                    longitude,
                },
            ];
        })
        .slice(0, 5);
}
