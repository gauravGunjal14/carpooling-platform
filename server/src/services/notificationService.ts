import { Types } from 'mongoose';
import {
    Notification,
    type NotificationFields,
    type NotificationType,
} from '../models/Notification.js';
import { emitToUser, SOCKET_EVENTS } from './socketService.js';

export async function createNotification(
    userId: string | Types.ObjectId,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown> = {},
): Promise<NotificationFields & { id: string }> {
    const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const notification = await Notification.create({
        userId: objectId,
        type,
        title,
        message,
        data,
        read: false,
    });

    const formatted = {
        id: notification._id.toString(),
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
    };

    // Real-time notification delivery via authenticated socket
    emitToUser(objectId.toString(), SOCKET_EVENTS.NOTIFICATION_RECEIVED, formatted);

    return formatted;
}

export async function getUserNotifications(userId: string | Types.ObjectId, limit = 50) {
    const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const items = await Notification.find({ userId: objectId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    return items.map((item) => ({
        id: item._id.toString(),
        type: item.type,
        title: item.title,
        message: item.message,
        data: item.data,
        read: item.read,
        createdAt: item.createdAt,
    }));
}

export async function markNotificationAsRead(
    userId: string | Types.ObjectId,
    notificationId: string,
) {
    const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const updated = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: objectId },
        { $set: { read: true } },
        { returnDocument: 'after' },
    );
    return Boolean(updated);
}

export async function markAllNotificationsAsRead(userId: string | Types.ObjectId) {
    const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    await Notification.updateMany(
        { userId: objectId, read: false },
        { $set: { read: true } },
    );
}

export async function getUnreadCount(userId: string | Types.ObjectId): Promise<number> {
    const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return Notification.countDocuments({ userId: objectId, read: false });
}
