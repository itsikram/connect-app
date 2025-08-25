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

export const initializeSocket = async (): Promise<Socket> => {
    if (socket) {
        return socket;
    }

    try {
        const user = await getUserData();
        console.log('User data for socket:', user);

        if (!user || !user.profile?._id) {
            throw new Error('User data or profileId not available');
        }

        socket = io(config.SOCKET_BASE_URL, {
            transports: ['websocket', 'polling'],
            query: { profileId: user.profile?._id },
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

        return socket;
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