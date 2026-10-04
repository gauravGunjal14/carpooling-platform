import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        PORT: z.coerce.number().int().positive().default(4000),
        CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
        MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
        JWT_ACCESS_SECRET: z
            .string()
            .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
        JWT_REFRESH_SECRET: z
            .string()
            .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    })
    .superRefine((config, context) => {
        if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
            context.addIssue({
                code: 'custom',
                path: ['JWT_REFRESH_SECRET'],
                message: 'Access and refresh secrets must be different',
            });
        }
        if (
            config.NODE_ENV === 'production' &&
            [config.JWT_ACCESS_SECRET, config.JWT_REFRESH_SECRET].some((secret) =>
                secret.startsWith('CHANGE_ME_'),
            )
        ) {
            context.addIssue({
                code: 'custom',
                path: ['JWT_ACCESS_SECRET'],
                message: 'Replace example secrets before running in production',
            });
        }
    });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
    throw new Error(
        `Invalid server configuration:\n${details}\nCopy the root .env.example to .env, then provide the required values.`,
    );
}

export const env = parsed.data;
