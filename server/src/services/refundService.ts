import type { BookingFields } from '../models/Booking.js';
import { processBookingRefund } from './paymentService.js';

export interface RefundContext {
    reason?: string;
    cancelledByRole: 'Driver' | 'Passenger';
    hoursBeforeDeparture: number;
}

export interface RefundResult {
    eligible: boolean;
    refundAmount: number;
    status: 'processed' | 'no_payment_found' | 'already_refunded' | 'recorded';
    note: string;
}

/**
 * Refund service integration.
 * Triggers mock/gateway refund for paid bookings upon driver or passenger cancellation.
 */
export async function processCancellationRefund(
    booking: BookingFields & { _id: unknown },
    context: RefundContext,
): Promise<RefundResult> {
    const bookingId = String(booking._id);
    const result = await processBookingRefund(bookingId, context);

    return {
        eligible: result.eligible,
        refundAmount: result.refundAmount,
        status: result.status,
        note: result.note,
    };
}
