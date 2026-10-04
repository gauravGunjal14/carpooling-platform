import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../config/env.js';
import { User, type UserDocument } from '../models/User.js';
import type { Role, SafeUser } from '../types/auth.js';
import { AppError } from '../utils/appError.js';
import { toSafeUser } from '../utils/userResponse.js';

const accessTokenLifetimeSeconds = 15 * 60;
const refreshTokenLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const issuer = 'wayfare';
const audience = 'wayfare-client';
const cookieName = 'wayfare_refresh';
const dummyPasswordHash = bcrypt.hash(randomUUID(), 12);

export type AuthResult = { accessToken: string; user: SafeUser };

function digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

function sameDigest(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}

function signAccess(user: UserDocument): string {
    return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
        algorithm: 'HS256',
        subject: user.id,
        issuer,
        audience,
        expiresIn: accessTokenLifetimeSeconds,
    });
}

function signRefresh(user: UserDocument): string {
    return jwt.sign({ type: 'refresh' }, env.JWT_REFRESH_SECRET, {
        algorithm: 'HS256',
        subject: user.id,
        issuer,
        audience,
        expiresIn: Math.floor(refreshTokenLifetimeMs / 1000),
        jwtid: randomUUID(),
    });
}

function setRefreshCookie(response: Response, token: string): void {
    response.cookie(cookieName, token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: refreshTokenLifetimeMs,
    });
}

export function clearRefreshCookie(response: Response): void {
    response.clearCookie(cookieName, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
    });
}

function unauthorized(): AppError {
    return new AppError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Email or password is incorrect, or your session has expired.',
    );
}

async function startSession(user: UserDocument, response: Response): Promise<AuthResult> {
    const refreshToken = signRefresh(user);
    user.refreshTokenHash = digest(refreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + refreshTokenLifetimeMs);
    await user.save();
    setRefreshCookie(response, refreshToken);
    return { accessToken: signAccess(user), user: toSafeUser(user) };
}

export async function register(
    input: {
        name: string;
        email: string;
        password: string;
        role: 'Passenger' | 'Driver';
    },
    response: Response,
): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    let user: UserDocument;
    try {
        user = await User.create({
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            passwordHash,
            role: input.role,
        });
    } catch (error) {
        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 11000
        ) {
            throw new AppError(
                409,
                'EMAIL_ALREADY_REGISTERED',
                'An account with this email already exists.',
            );
        }
        throw error;
    }
    return startSession(user, response);
}

export async function login(
    input: { email: string; password: string },
    response: Response,
): Promise<AuthResult> {
    const user = await User.findOne({ email: input.email.trim().toLowerCase() }).select(
        '+passwordHash',
    );
    const passwordHash = user ? user.passwordHash : await dummyPasswordHash;
    const passwordMatches = await bcrypt.compare(input.password, passwordHash);
    if (!user || !passwordMatches || user.status !== 'active') throw unauthorized();
    return startSession(user, response);
}

export async function rotateSession(
    rawToken: unknown,
    response: Response,
): Promise<AuthResult> {
    if (typeof rawToken !== 'string') throw unauthorized();
    let claims: JwtPayload;
    try {
        const verified = jwt.verify(rawToken, env.JWT_REFRESH_SECRET, {
            algorithms: ['HS256'],
            issuer,
            audience,
        });
        if (typeof verified === 'string' || verified.type !== 'refresh' || !verified.sub)
            throw unauthorized();
        claims = verified;
    } catch {
        clearRefreshCookie(response);
        throw unauthorized();
    }

    const oldDigest = digest(rawToken);
    const user = await User.findOne({
        _id: claims.sub,
        status: 'active',
        refreshTokenHash: oldDigest,
        refreshTokenExpiresAt: { $gt: new Date() },
    }).select('+refreshTokenHash +refreshTokenExpiresAt');

    if (
        !user ||
        !user.refreshTokenHash ||
        !sameDigest(user.refreshTokenHash, oldDigest)
    ) {
        clearRefreshCookie(response);
        throw unauthorized();
    }

    const nextToken = signRefresh(user);
    const rotated = await User.findOneAndUpdate(
        {
            _id: user.id,
            refreshTokenHash: oldDigest,
            refreshTokenExpiresAt: { $gt: new Date() },
            status: 'active',
        },
        {
            $set: {
                refreshTokenHash: digest(nextToken),
                refreshTokenExpiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
            },
        },
        { new: true },
    ).select('+refreshTokenHash +refreshTokenExpiresAt');

    if (!rotated) {
        clearRefreshCookie(response);
        throw unauthorized();
    }
    setRefreshCookie(response, nextToken);
    return { accessToken: signAccess(rotated), user: toSafeUser(rotated) };
}

export async function revokeSession(
    rawToken: unknown,
    response: Response,
): Promise<void> {
    clearRefreshCookie(response);
    if (typeof rawToken !== 'string') return;
    try {
        const verified = jwt.verify(rawToken, env.JWT_REFRESH_SECRET, {
            algorithms: ['HS256'],
            issuer,
            audience,
        });
        if (typeof verified === 'string' || verified.type !== 'refresh' || !verified.sub)
            return;
        await User.updateOne(
            { _id: verified.sub, refreshTokenHash: digest(rawToken) },
            {
                $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 },
            },
        );
    } catch {
        // Logout always clears the browser cookie, including when its token is already expired.
    }
}

export async function authenticateAccessToken(rawToken: string): Promise<SafeUser> {
    let claims: JwtPayload;
    try {
        const verified = jwt.verify(rawToken, env.JWT_ACCESS_SECRET, {
            algorithms: ['HS256'],
            issuer,
            audience,
        });
        if (typeof verified === 'string' || !verified.sub) throw unauthorized();
        claims = verified;
    } catch {
        throw unauthorized();
    }
    const user = await User.findById(claims.sub);
    if (!user || user.status !== 'active') throw unauthorized();
    return toSafeUser(user);
}

export function requireAnyRole(user: SafeUser | undefined, roles: readonly Role[]): void {
    if (!user) throw unauthorized();
    if (!roles.includes(user.role))
        throw new AppError(
            403,
            'FORBIDDEN',
            'Your account does not have access to this area.',
        );
}

export { cookieName };
