export const SOCKET_EVENTS = {
    // Passenger events
    BOOKING_SUBMITTED: 'booking:submitted',
    BOOKING_ACCEPTED: 'booking:accepted',
    BOOKING_REJECTED: 'booking:rejected',
    BOOKING_CANCELLED: 'booking:cancelled',

    // Driver events
    BOOKING_REQUEST_RECEIVED: 'booking:request_received',

    // Lifecycle & notification events
    RIDE_STATUS_UPDATED: 'ride:status_updated',
    NOTIFICATION_RECEIVED: 'notification:received',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface SocketPayload<T = unknown> {
    eventId: string;
    timestamp: string;
    data: T;
}
