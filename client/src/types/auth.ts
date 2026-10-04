export type Role = 'Passenger' | 'Driver' | 'Admin';

export type User = {
    id: string;
    name: string;
    email: string;
    role: Role;
    createdAt: string;
};

export type AuthSession = {
    accessToken: string;
    user: User;
};

export type ApiErrorBody = { error?: { code?: string; message?: string } };
