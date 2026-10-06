export const roles = ['Passenger', 'Driver', 'Admin'] as const;
export type Role = (typeof roles)[number];

export type SafeUser = {
    id: string;
    name: string;
    email: string;
    role: Role;
    driverTier?: 'standard' | 'pro';
    createdAt?: Date;
};

declare global {
    namespace Express {
        interface Request {
            authUser?: SafeUser;
        }
    }
}
