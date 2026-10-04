import { z } from 'zod';
import { AppError } from './appError.js';

export const passwordSchema = z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(72, 'Password must be no more than 72 characters')
    .refine(
        (value) => Buffer.byteLength(value, 'utf8') <= 72,
        'Password must be no more than 72 bytes',
    );

export function parseBody<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            result.error.issues[0]?.message ?? 'Invalid request',
        );
    }
    return result.data;
}
