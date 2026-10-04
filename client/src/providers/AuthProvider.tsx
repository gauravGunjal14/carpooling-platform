import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiRequest, apiRequestBlob, jsonBody } from '../lib/api';
import { AuthContext } from '../lib/authContext';
import type { AuthSession, Role, User } from '../types/auth';

type Props = { children: ReactNode };

export function AuthProvider({ children }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshFlight = useRef<Promise<AuthSession | null> | null>(null);

    const refreshSession = useCallback((): Promise<AuthSession | null> => {
        if (!refreshFlight.current) {
            refreshFlight.current = apiRequest<AuthSession>('/api/auth/refresh', {
                method: 'POST',
            })
                .catch(() => null)
                .finally(() => {
                    refreshFlight.current = null;
                });
        }
        return refreshFlight.current;
    }, []);

    const acceptSession = useCallback((session: AuthSession) => {
        setAccessToken(session.accessToken);
        setUser(session.user);
    }, []);

    useEffect(() => {
        let active = true;
        void refreshSession().then((session) => {
            if (active && session) acceptSession(session);
            if (active) setIsLoading(false);
        });
        return () => {
            active = false;
        };
    }, [acceptSession, refreshSession]);

    const signIn = useCallback(
        async (email: string, password: string): Promise<User> => {
            const session = await apiRequest<AuthSession>('/api/auth/login', {
                method: 'POST',
                body: jsonBody({ email, password }),
            });
            acceptSession(session);
            return session.user;
        },
        [acceptSession],
    );

    const signUp = useCallback(
        async (input: {
            name: string;
            email: string;
            password: string;
            role: 'Passenger' | 'Driver';
        }): Promise<User> => {
            const session = await apiRequest<AuthSession>('/api/auth/register', {
                method: 'POST',
                body: jsonBody(input),
            });
            acceptSession(session);
            return session.user;
        },
        [acceptSession],
    );

    const signOut = useCallback(async () => {
        try {
            await apiRequest<void>('/api/auth/logout', { method: 'POST' });
        } finally {
            setUser(null);
            setAccessToken(null);
        }
    }, []);

    const request = useCallback(
        async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
            const send = (token: string | null) =>
                apiRequest<T>(path, {
                    ...init,
                    headers: {
                        ...init.headers,
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
            try {
                return await send(accessToken);
            } catch (error) {
                if (!(error instanceof ApiError) || error.status !== 401) throw error;
                const refreshed = await refreshSession();
                if (!refreshed) {
                    setUser(null);
                    setAccessToken(null);
                    throw error;
                }
                acceptSession(refreshed);
                return send(refreshed.accessToken);
            }
        },
        [accessToken, acceptSession, refreshSession],
    );

    const updateName = useCallback(
        async (name: string) => {
            const result = await request<{ user: User }>('/api/auth/me', {
                method: 'PATCH',
                body: jsonBody({ name }),
            });
            setUser(result.user);
        },
        [request],
    );

    const requestBlob = useCallback(
        async (path: string): Promise<Blob> => {
            const send = (token: string | null) =>
                apiRequestBlob(path, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
            try {
                return await send(accessToken);
            } catch (error) {
                if (!(error instanceof ApiError) || error.status !== 401) throw error;
                const refreshed = await refreshSession();
                if (!refreshed) {
                    setUser(null);
                    setAccessToken(null);
                    throw error;
                }
                acceptSession(refreshed);
                return send(refreshed.accessToken);
            }
        },
        [accessToken, acceptSession, refreshSession],
    );

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                accessToken,
                signIn,
                signUp,
                signOut,
                updateName,
                request,
                requestBlob,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const publicRoles: readonly Role[] = ['Passenger', 'Driver'];
