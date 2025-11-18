import { io, Socket } from "socket.io-client";
import config from "../lib/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

let socket: Socket | null = null;

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
            console.log('✅ Socket already connected');
            return resolve(s);
        }
        
        console.log('⏳ Waiting for socket connection...');
        const onConnect = () => {
            console.log('✅ Socket connected in waitForConnect');
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            clearTimeout(timeoutId);
            resolve(s);
        };
        const onError = (err: any) => {
            console.error('❌ Socket connection error in waitForConnect:', err);
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            clearTimeout(timeoutId);
            reject(err);
        };
        s.on('connect', onConnect);
        s.on('connect_error', onError);
        
        const timeoutId = setTimeout(() => {
            console.error('❌ Socket connect timeout after 20 seconds');
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            reject(new Error(`Socket connect timeout. Server URL: ${config.SOCKET_BASE_URL}`));
        }, 20000);
    });
}

export const initializeSocket = async (profileId: string): Promise<Socket> => {
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

        console.log('🔌 Initializing socket connection to:', config.SOCKET_BASE_URL);
        console.log('🔌 Profile ID:', effectiveProfileId);
        
        socket = io(config.SOCKET_BASE_URL, {
            transports: ['websocket', 'polling'],
            query: { profile: effectiveProfileId },
            timeout: 20000,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        // Add connection event listeners
        socket.on('connect', () => {
            console.log('✅ Socket connected successfully to:', config.SOCKET_BASE_URL);
            if (socket) {
                console.log('✅ Socket ID:', socket.id);
            }
        });

        socket.on('connect_error', (error: any) => {
            console.error('❌ Socket connection error:', error);
            console.error('❌ Error details:', {
                message: error?.message || 'Unknown error',
                type: error?.type || 'Unknown',
                description: error?.description || 'No description',
                serverUrl: config.SOCKET_BASE_URL
            });
        });

        socket.on('disconnect', (reason) => {
            console.log('⚠️ Socket disconnected:', reason);
            if (reason === 'io server disconnect' && socket) {
                // Server disconnected the socket, try to reconnect manually
                console.log('🔄 Server disconnected, attempting to reconnect...');
                socket.connect();
            }
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('🔄 Socket reconnection attempt', attemptNumber);
        });

        socket.on('reconnect_error', (error: any) => {
            console.error('❌ Socket reconnection error:', error);
        });

        socket.on('reconnect_failed', () => {
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
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// For backward compatibility, export a default that throws an error if used directly
const defaultExport = () => {
    throw new Error('Please use initializeSocket() instead of importing socket directly');
};

export default defaultExport;