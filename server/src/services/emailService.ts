import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporterInstance: Transporter | null = null;

function getTransporter(): Transporter | null {
    if (transporterInstance) return transporterInstance;
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
        transporterInstance = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASSWORD,
            },
        });
    }
    return transporterInstance;
}

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Sends an email using Nodemailer with full error isolation.
 * If SMTP is unconfigured or errors occur, the failure is logged safely
 * and will NEVER crash the primary business transaction.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    const transporter = getTransporter();
    const from = env.MAIL_FROM || 'no-reply@carpooling.local';

    if (!transporter) {
        if (env.NODE_ENV !== 'test') {
            console.info(
                `[Mock Email] To: ${options.to} | Subject: "${options.subject}" | (SMTP not configured)`,
            );
        }
        return true;
    }

    try {
        await transporter.sendMail({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        return true;
    } catch (error) {
        console.warn(
            `[Email Error] Failed to send email to ${options.to}:`,
            error instanceof Error ? error.message : error,
        );
        return false;
    }
}

export async function sendBookingAcceptedEmail(
    to: string,
    details: {
        passengerName: string;
        pickup: string;
        destination: string;
        departureAt: string;
        bookingId: string;
    },
): Promise<void> {
    const html = `
        <div style="font-family: sans-serif; color: #1a0814; padding: 20px;">
            <h2 style="color: #631238;">Your Booking is Confirmed!</h2>
            <p>Hi ${details.passengerName},</p>
            <p>Great news! The driver has accepted your booking request.</p>
            <div style="background: #fbf6f8; border-left: 4px solid #8e1b4f; padding: 12px 16px; margin: 16px 0;">
                <p><strong>Route:</strong> ${details.pickup} &rarr; ${details.destination}</p>
                <p><strong>Departure:</strong> ${details.departureAt}</p>
                <p><strong>Booking ID:</strong> ${details.bookingId}</p>
            </div>
            <p>Please log in to your dashboard to complete payment and view trip updates.</p>
        </div>
    `;
    void sendEmail({
        to,
        subject: 'Booking Confirmed - Smart Carpooling Platform',
        html,
    });
}

export async function sendBookingRejectedEmail(
    to: string,
    details: {
        passengerName: string;
        pickup: string;
        destination: string;
        reason?: string;
    },
): Promise<void> {
    const html = `
        <div style="font-family: sans-serif; color: #1a0814; padding: 20px;">
            <h2 style="color: #631238;">Booking Request Update</h2>
            <p>Hi ${details.passengerName},</p>
            <p>Unfortunately, your booking request for the ride from <strong>${details.pickup}</strong> to <strong>${details.destination}</strong> could not be accepted.</p>
            ${details.reason ? `<p><strong>Reason:</strong> ${details.reason}</p>` : ''}
            <p>Any held seats have been released. You can explore other matched rides on the platform.</p>
        </div>
    `;
    void sendEmail({
        to,
        subject: 'Booking Request Update - Smart Carpooling Platform',
        html,
    });
}

export async function sendPaymentSuccessEmail(
    to: string,
    details: {
        passengerName: string;
        amount: number;
        transactionReference: string;
        paymentMethod: string;
        route: string;
    },
): Promise<void> {
    const html = `
        <div style="font-family: sans-serif; color: #1a0814; padding: 20px;">
            <h2 style="color: #631238;">Payment Receipt</h2>
            <p>Hi ${details.passengerName},</p>
            <p>We received your payment of <strong>&#8377;${details.amount}</strong> for your upcoming trip.</p>
            <div style="background: #fbf6f8; border-left: 4px solid #8e1b4f; padding: 12px 16px; margin: 16px 0;">
                <p><strong>Trip:</strong> ${details.route}</p>
                <p><strong>Payment Method:</strong> ${details.paymentMethod.toUpperCase()}</p>
                <p><strong>Transaction Ref:</strong> ${details.transactionReference}</p>
                <p><strong>Status:</strong> Successful</p>
            </div>
            <p>Have a safe and pleasant journey!</p>
        </div>
    `;
    void sendEmail({
        to,
        subject: 'Payment Successful - Smart Carpooling Platform',
        html,
    });
}

export async function sendPaymentFailedEmail(
    to: string,
    details: {
        passengerName: string;
        amount: number;
        reason?: string;
    },
): Promise<void> {
    const html = `
        <div style="font-family: sans-serif; color: #1a0814; padding: 20px;">
            <h2 style="color: #631238;">Payment Unsuccessful</h2>
            <p>Hi ${details.passengerName},</p>
            <p>Your payment attempt of <strong>&#8377;${details.amount}</strong> was not successful.</p>
            ${details.reason ? `<p><strong>Error:</strong> ${details.reason}</p>` : ''}
            <p>Please try again from your bookings page to retain your confirmed seat.</p>
        </div>
    `;
    void sendEmail({
        to,
        subject: 'Payment Failed - Smart Carpooling Platform',
        html,
    });
}

export async function sendRefundProcessedEmail(
    to: string,
    details: {
        passengerName: string;
        amount: number;
        refundReference: string;
        reason?: string;
    },
): Promise<void> {
    const html = `
        <div style="font-family: sans-serif; color: #1a0814; padding: 20px;">
            <h2 style="color: #631238;">Refund Processed</h2>
            <p>Hi ${details.passengerName},</p>
            <p>A refund of <strong>&#8377;${details.amount}</strong> has been processed for your booking.</p>
            <div style="background: #fbf6f8; border-left: 4px solid #8e1b4f; padding: 12px 16px; margin: 16px 0;">
                <p><strong>Refund Reference:</strong> ${details.refundReference}</p>
                ${details.reason ? `<p><strong>Reason:</strong> ${details.reason}</p>` : ''}
                <p><strong>Status:</strong> Processed</p>
            </div>
            <p>Depending on your payment method, funds typically reflect in your account within 3–5 business days.</p>
        </div>
    `;
    void sendEmail({
        to,
        subject: 'Refund Processed - Smart Carpooling Platform',
        html,
    });
}

export async function sendDriverCancellationEmail(
    to: string,
    details: {
        passengerName: string;
        driverName: string;
        route: string;
        departureAt: string;
    },
): Promise<void> {
    const html = `
        <div style="font-family: sans-serif; color: #1a0814; padding: 20px;">
            <h2 style="color: #631238;">Ride Cancelled by Driver</h2>
            <p>Hi ${details.passengerName},</p>
            <p>We regret to inform you that driver <strong>${details.driverName}</strong> has cancelled the scheduled ride (${details.route}) departing on ${details.departureAt}.</p>
            <p>If you made a payment for this trip, an automated 100% refund has been initiated.</p>
        </div>
    `;
    void sendEmail({
        to,
        subject: 'Trip Cancelled by Driver - Smart Carpooling Platform',
        html,
    });
}
