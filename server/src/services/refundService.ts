import type { BookingFields } from '../models/Booking.js';

export interface RefundContext {
    reason?: string;
    cancelledByRole: 'Driver' | 'Passenger';
    hoursBeforeDeparture: number;
}

export interface RefundResult {
    eligible: boolean;
    refundAmount: number;
    status: 'recorded' | 'no_payment_required';
    note: string;
}

/**
 * Refund service stub/hook for future payment gateway (Razorpay) integration.
 * Records cancellation refund context cleanly without real transactions.
 */
export async function processCancellationRefund(
    booking: BookingFields & { _id: unknown },
    context: RefundContext,
): Promise<RefundResult> {
    // In Phase 6-8, real payment is out of scope.
    // This hook standardizes the interface for Phase 9/Payment integration.
    return {
        eligible: true,
        refundAmount: 0,
        status: 'no_payment_required',
        note: `Cancellation recorded for booking ${String(booking._id)}. Payment gateway refund hook ready.`,
    };
}
