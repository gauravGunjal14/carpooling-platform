import type { ApiErrorBody } from '../types/auth';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const response = await fetch(`${apiBase}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
            ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers,
        },
    });
    if (response.status === 204) return undefined as T;
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;
    if (!response.ok) {
        throw new ApiError(
            body.error?.message ?? 'Something went wrong. Please try again.',
            response.status,
            body.error?.code,
        );
    }
    return body;
}

export async function apiRequestBlob(
    path: string,
    init: RequestInit = {},
): Promise<Blob> {
    const response = await fetch(`${apiBase}${path}`, {
        ...init,
        credentials: 'include',
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        throw new ApiError(
            body.error?.message ?? 'Something went wrong. Please try again.',
            response.status,
            body.error?.code,
        );
    }
    return response.blob();
}

export function jsonBody(value: unknown): string {
    return JSON.stringify(value);
}
