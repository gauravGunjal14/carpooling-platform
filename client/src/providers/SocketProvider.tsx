import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import type { SocketEventName, SocketPayload } from '../types/socketEvents';

interface SocketContextValue {
    socket: Socket | null;
    isConnected: boolean;
    subscribe: <T>(event: SocketEventName, handler: (data: T) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue>({
    socket: null,
    isConnected: false,
    subscribe: () => () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
    const { accessToken, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const seenEventIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!accessToken || !user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
        const newSocket = io(apiBase, {
            auth: { token: accessToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        newSocket.on('connect_error', () => {
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [accessToken, user]);

    const subscribe = useCallback(
        <T,>(event: SocketEventName, handler: (data: T) => void) => {
            if (!socket) return () => {};

            const wrappedListener = (payload: SocketPayload<T>) => {
                // Duplicate event protection: ignore already processed events
                if (payload?.eventId) {
                    if (seenEventIds.current.has(payload.eventId)) return;
                    seenEventIds.current.add(payload.eventId);
                    if (seenEventIds.current.size > 200) {
                        const first = seenEventIds.current.values().next().value;
                        if (first) seenEventIds.current.delete(first);
                    }
                }
                handler(
                    payload?.data !== undefined
                        ? payload.data
                        : (payload as unknown as T),
                );
            };

            socket.on(event, wrappedListener as (...args: unknown[]) => void);

            return () => {
                socket.off(event, wrappedListener as (...args: unknown[]) => void);
            };
        },
        [socket],
    );

    return (
        <SocketContext.Provider value={{ socket, isConnected, subscribe }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
