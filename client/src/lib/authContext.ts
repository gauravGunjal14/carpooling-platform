import { createContext } from 'react';
import type { AuthSession, Role, User } from '../types/auth';

export type AuthContextValue = {
    user: User | null;
    isLoading: boolean;
    accessToken: string | null;
    signIn: (email: string, password: string) => Promise<User>;
    signUp: (input: {
        name: string;
        email: string;
        password: string;
        role: 'Passenger' | 'Driver';
    }) => Promise<User>;
    signOut: () => Promise<void>;
    updateName: (name: string) => Promise<void>;
    request: <T>(path: string, init?: RequestInit) => Promise<T>;
    requestBlob: (path: string) => Promise<Blob>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function sessionToRolePath(session: Pick<AuthSession, 'user'>): string {
    return `/app/${session.user.role.toLowerCase() as Lowercase<Role>}`;
}
