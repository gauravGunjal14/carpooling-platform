import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;
    if (mongoose.connection.readyState === 2) {
        await new Promise((resolve) => mongoose.connection.once('open', resolve));
        return;
    }
    if (mongoose.connection.readyState === 3) {
        await new Promise((resolve) => mongoose.connection.once('close', resolve));
    }
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
    console.info('MongoDB connection established');
}
