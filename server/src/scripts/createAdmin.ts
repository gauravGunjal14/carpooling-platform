import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { passwordSchema } from '../utils/validation.js';

const adminInput = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254),
    password: passwordSchema,
});

async function createAdmin(): Promise<void> {
    const input = adminInput.parse({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    });
    await connectDatabase();
    const email = input.email.toLowerCase();
    if (await User.exists({ email }))
        throw new Error('An account with ADMIN_EMAIL already exists.');
    await User.create({
        name: input.name,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: 'Admin',
    });
    console.info(`Admin account created for ${email}`);
}

createAdmin()
    .catch((error) => {
        console.error(
            error instanceof Error
                ? error.message
                : 'Admin account could not be created.',
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        const mongoose = await import('mongoose');
        await mongoose.default.disconnect();
    });
