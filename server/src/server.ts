import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';

const app = express();
app.disable('x-powered-by');
app.use(
    helmet({
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
);
app.use(
    cors({
        origin: env.CLIENT_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
    }),
);
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/rides', rideRoutes);
app.use((_request, response) =>
    response
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }),
);
app.use(errorHandler);

async function start(): Promise<void> {
    try {
        await connectDatabase();
    } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error(
            `Could not connect to MongoDB (${errorName}). Check MONGODB_URI and database availability.`,
        );
        process.exitCode = 1;
        return;
    }

    const server = app.listen(env.PORT, () =>
        console.info(`Carpooling API listening on port ${env.PORT}`),
    );
    const shutdown = (): void => {
        server.close(() => {
            void import('mongoose')
                .then(({ default: mongoose }) => mongoose.disconnect())
                .finally(() => process.exit(0));
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

void start();
