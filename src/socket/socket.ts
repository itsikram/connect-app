import { io, Socket } from "socket.io-client";
import config from "../lib/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import {
    applyAdminServerConfig,
    canFailover,
    failoverFrom,
    getServerList,
    onServerUrlChange,
} from "../lib/serverUrl";

let socket: Socket | null = null;
let socketProfileId: string | null = null;
let stopFollowingServer: (() => void) | null = null;

// With a backup server available, give up on an unresponsive one quickly.
const FAILOVER_CONNECT_TIMEOUT_MS = 8000;

// Point the existing socket at another server. Keeping the same instance keeps
// every listener the app registered on it attached.
const moveSocketTo = (s: Socket, serverUrl: string) => {
    const manager: any = s.io;
    if (!manager || manager.uri === serverUrl) return;
    if (__DEV__) {
        console.log('🔄 Socket switching to server:', serverUrl);
    }
    manager.uri = serverUrl;
    manager.engine?.close();
};

// The access token the REST API uses; the server takes the socket's identity
// from it. Read on every (re)connect so a refreshed token is used.
const socketAuth = (profileId: string) => (cb: (data: object) => void) => {
    AsyncStorage.getItem('authToken')
        .catch(() => null)
        .then((token) => cb({ profile: profileId, token: token || undefined }));
};

// socket.io doesn't retry a connection the server refused; API calls refresh
// the token meanwhile.
const AUTH_RETRY_MS = 5000;

const attachFailover = (s: Socket) => {
    s.on('connect_error', (err: any) => {
        // A server that answered and refused the connection (auth middleware)
        // is up, so only network errors and timeouts count as "down".
        if (err && 'data' in err && err.type !== 'TransportError') {
            setTimeout(() => {
                if (socket === s && !s.connected) s.connect();
            }, AUTH_RETRY_MS);
            return;
        }
        // The first failed connect moves API and socket to the next server;
        // onServerUrlChange below then repoints this socket.
        const current = (s.io as any)?.uri || config.SOCKET_BASE_URL;
        const next = canFailover() ? failoverFrom(current) : null;
        if (next) moveSocketTo(s, next);
    });
    // An admin saved new server settings (admin panel → Settings → Servers).
    s.on('server-config-changed', (serverConfig: any) => {
        applyAdminServerConfig(serverConfig);
    });
    stopFollowingServer?.();
    stopFollowingServer = onServerUrlChange((serverUrl) => {
        // Follow API failovers too, but never drop a working connection
        // unless its server was removed from the list.
        const current = (s.io as any)?.uri;
        if (!s.connected || !getServerList().includes(current)) moveSocketTo(s, serverUrl);
    });
};

const getUserData = async () => {
    try {
        const userData = await AsyncStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

const waitForConnect = (s: Socket): Promise<Socket> => {
    return new Promise((resolve, reject) => {
        if (s.connected) {
            if (__DEV__) {
                console.log('✅ Socket already connected');
            }
            return resolve(s);
        }
        
        if (__DEV__) {
            console.log('⏳ Waiting for socket connection...');
        }
        const onConnect = () => {
            if (__DEV__) {
                console.log('✅ Socket connected in waitForConnect');
            }
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            clearTimeout(timeoutId);
            resolve(s);
        };
        // With several servers a failed connect is followed by a retry on the
        // next one, so only give up once every server has failed.
        let errorCount = 0;
        const errorsBeforeReject = Math.max(1, getServerList().length);
        const onError = (err: any) => {
            if (__DEV__) {
                console.error('❌ Socket connection error in waitForConnect:', err);
            }
            errorCount += 1;
            if (errorCount < errorsBeforeReject) return;
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            clearTimeout(timeoutId);
            reject(err);
        };
        s.on('connect', onConnect);
        s.on('connect_error', onError);

        // Leave time to try every server (connect timeout plus reconnect delay each).
        const waitMs = canFailover()
            ? getServerList().length * (FAILOVER_CONNECT_TIMEOUT_MS + 2000)
            : 20000;
        const timeoutId = setTimeout(() => {
            if (__DEV__) {
                console.error(`❌ Socket connect timeout after ${waitMs / 1000} seconds`);
            }
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            reject(new Error(`Socket connect timeout. Server URL: ${config.SOCKET_BASE_URL}`));
        }, waitMs);
    });
}

export const initializeSocket = async (profileId: string): Promise<Socket> => {
    // A socket authenticated as a different profile (logout → login as
    // someone else) must not be reused: the server routes by that identity.
    if (socket && profileId && socketProfileId && socketProfileId !== String(profileId)) {
        socket.disconnect();
        socket = null;
        socketProfileId = null;
    }
    if (socket) {
        if (socket.connected) {
            return socket;
        }
        return await waitForConnect(socket);
    }

    try {
        // Prefer the explicitly provided profileId; fall back to stored user if needed
        let effectiveProfileId: string | undefined = profileId;
        if (!effectiveProfileId) {
            const user = await getUserData();
            console.log('Socket: loaded user from storage for fallback:', !!user);
            effectiveProfileId = user?.profile?._id;
        }

        if (!effectiveProfileId) {
            throw new Error('initializeSocket: profileId is missing');
        }

        if (__DEV__) {
            console.log('🔌 Initializing socket connection to:', config.SOCKET_BASE_URL);
            console.log('🔌 Profile ID:', effectiveProfileId);
        }
        
        socket = io(config.SOCKET_BASE_URL, {
            transports: ['websocket', 'polling'],
            query: {
                profile: effectiveProfileId,
                // A socket opened while the app is backgrounded (e.g. woken
                // by a push) must not show the user as online.
                presence: Platform.OS !== 'web' && AppState.currentState === 'background' ? 'away' : 'active',
            },
            auth: socketAuth(String(effectiveProfileId)),
            timeout: canFailover() ? FAILOVER_CONNECT_TIMEOUT_MS : 20000,
            forceNew: true,
            reconnection: true,
            // Keep retrying indefinitely so a web client recovers after the
            // local nodemon server restarts during development.
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });
        socketProfileId = String(effectiveProfileId);
        attachFailover(socket);

        // Add connection event listeners
        socket.on('connect', () => {
            if (__DEV__) {
                console.log('✅ Socket connected successfully to:', config.SOCKET_BASE_URL);
                if (socket) {
                    console.log('✅ Socket ID:', socket.id);
                }
            }
        });

        socket.on('connect_error', (error: any) => {
            // Only log errors in development to reduce noise in production
            if (__DEV__) {
                console.error('❌ Socket connection error:', error);
                console.error('❌ Error details:', {
                    message: error?.message || 'Unknown error',
                    type: error?.type || 'Unknown',
                    description: error?.description || 'No description',
                    serverUrl: config.SOCKET_BASE_URL
                });
            }
        });

        socket.on('disconnect', (reason) => {
            if (__DEV__) {
                console.log('⚠️ Socket disconnected:', reason);
            }
            if (reason === 'io server disconnect' && socket) {
                // Server disconnected the socket, try to reconnect manually
                if (__DEV__) {
                    console.log('🔄 Server disconnected, attempting to reconnect...');
                }
                socket.connect();
            }
        });

        socket.on('reconnect', (attemptNumber) => {
            if (__DEV__) {
                console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
            }
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            // Only log in development to reduce noise
            if (__DEV__) {
                console.log('🔄 Socket reconnection attempt', attemptNumber);
            }
        });

        socket.on('reconnect_error', (error: any) => {
            // Only log in development to reduce noise
            if (__DEV__) {
                console.error('❌ Socket reconnection error:', error);
            }
        });

        socket.on('reconnect_failed', () => {
            // Always log reconnection failures as they're important
            console.error('❌ Socket reconnection failed after all attempts');
        });

        // Wait for actual connection before resolving
        return await waitForConnect(socket);
    } catch (error) {
        console.error('Failed to initialize socket:', error);
        throw error;
    }
}

export const getSocket = (): Socket | null => {
    return socket;
}

export const disconnectSocket = () => {
    stopFollowingServer?.();
    stopFollowingServer = null;
    if (socket) {
        socket.disconnect();
        socket = null;
        socketProfileId = null;
    }
}

// For backward compatibility, export a default that throws an error if used directly
const defaultExport = () => {
    throw new Error('Please use initializeSocket() instead of importing socket directly');
};

export default defaultExport;