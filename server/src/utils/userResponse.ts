import type { UserDocument } from '../models/User.js';
import type { SafeUser } from '../types/auth.js';

export function toSafeUser(user: UserDocument): SafeUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        driverTier: user.driverTier,
        createdAt: user.createdAt,
    };
}
