import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, LogOut, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../providers/SocketProvider';
import type { Role } from '../types/auth';
import { SOCKET_EVENTS } from '../types/socketEvents';

type Props = { role: Exclude<Role, 'Admin'> };

interface InAppNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export function RideWorkspaceHeader({ role }: Props) {
    const { signOut, request } = useAuth();
    const { subscribe } = useSocket();
    const navigate = useNavigate();
    const isDriver = role === 'Driver';

    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await request<{
                notifications: InAppNotification[];
                unreadCount: number;
            }>('/api/notifications');
            setNotifications(res.notifications);
            setUnreadCount(res.unreadCount);
        } catch {
            // Silently handle if notifications are unavailable
        }
    }, [request]);

    useEffect(() => {
        void loadNotifications();
    }, [loadNotifications]);

    // Real-time notification updates
    useEffect(() => {
        const unsub = subscribe<InAppNotification>(
            SOCKET_EVENTS.NOTIFICATION_RECEIVED,
            (newNotif) => {
                setNotifications((prev) => [newNotif, ...prev]);
                setUnreadCount((c) => c + 1);
            },
        );
        return () => unsub();
    }, [subscribe]);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    async function handleMarkRead(id: string) {
        try {
            await request(`/api/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch {
            // ignore
        }
    }

    async function handleMarkAllRead() {
        try {
            await request('/api/notifications/read-all', { method: 'PATCH' });
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch {
            // ignore
        }
    }

    async function handleSignOut() {
        try {
            await signOut();
        } catch {
            // The local session is cleared by the auth provider when the request fails.
        }
        navigate('/', { replace: true });
    }

    return (
        <header className='ride-workspace-header'>
            <Link
                className='brand'
                to='/'
                aria-label='Wayfare home'
            >
                <span className='brand-mark'>
                    <span />
                </span>
                <span>
                    wayfare<span className='brand-period'>.</span>
                </span>
            </Link>
            <nav
                className='ride-workspace-nav'
                aria-label='Account navigation'
            >
                <Link to={isDriver ? '/app/driver' : '/app/passenger'}>
                    {isDriver ? 'My rides' : 'Find rides'}
                </Link>
                {!isDriver && <Link to='/app/passenger/bookings'>My bookings</Link>}
                {isDriver && <Link to='/app/driver/rides/new'>Offer a ride</Link>}
                <Link to={isDriver ? '/app/driver/profile' : '/app/passenger/profile'}>
                    Profile
                </Link>
            </nav>

            <div className='header-action-group'>
                {/* Notification Bell */}
                <div
                    className='notification-dropdown-wrapper'
                    ref={dropdownRef}
                >
                    <button
                        type='button'
                        className='notification-bell-btn'
                        onClick={() => setIsOpen((prev) => !prev)}
                        aria-label={`Notifications (${unreadCount} unread)`}
                    >
                        <Bell size={16} />
                        {unreadCount > 0 && (
                            <span className='notification-badge'>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {isOpen && (
                        <div className='notification-dropdown-menu'>
                            <div className='notification-dropdown-head'>
                                <div>
                                    <strong>Notifications</strong>
                                    {unreadCount > 0 && <small>{unreadCount} new</small>}
                                </div>
                                <div className='notification-head-actions'>
                                    {unreadCount > 0 && (
                                        <button
                                            type='button'
                                            onClick={handleMarkAllRead}
                                            className='mark-all-read-btn'
                                            title='Mark all as read'
                                        >
                                            <CheckCheck size={13} />
                                        </button>
                                    )}
                                    <button
                                        type='button'
                                        onClick={() => setIsOpen(false)}
                                        className='close-dropdown-btn'
                                        aria-label='Close'
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                            <div className='notification-dropdown-list'>
                                {notifications.length === 0 ? (
                                    <p className='notifications-empty'>
                                        No notifications yet.
                                    </p>
                                ) : (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={`notification-item ${n.read ? 'read' : 'unread'}`}
                                            onClick={() => {
                                                if (!n.read) void handleMarkRead(n.id);
                                            }}
                                        >
                                            <div className='notification-item-text'>
                                                <b>{n.title}</b>
                                                <p>{n.message}</p>
                                                <small>
                                                    {new Date(
                                                        n.createdAt,
                                                    ).toLocaleTimeString(undefined, {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </small>
                                            </div>
                                            {!n.read && <span className='unread-dot' />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    className='profile-signout'
                    type='button'
                    onClick={handleSignOut}
                >
                    <LogOut size={14} /> <span>Sign out</span>
                </button>
            </div>
        </header>
    );
}
