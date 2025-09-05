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
            return resolve(s);
        }
        const onConnect = () => {
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            resolve(s);
        };
        const onError = (err: any) => {
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            reject(err);
        };
        s.on('connect', onConnect);
        s.on('connect_error', onError);
        setTimeout(() => {
            s.off('connect', onConnect);
            s.off('connect_error', onError);
            reject(new Error('Socket connect timeout'));
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

        socket = io(config.SOCKET_BASE_URL, {
            transports: ['websocket', 'polling'],
            query: { profile: effectiveProfileId },
            timeout: 20000,
            forceNew: true,
        });

        // Add connection event listeners
        socket.on('connect', () => {
            console.log('Socket connected successfully');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
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