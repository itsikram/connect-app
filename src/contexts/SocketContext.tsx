import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import socketService from '../services/socketService';

interface SocketContextType {
  isConnected: boolean;
  connect: (profileId: string) => Promise<void>;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  joinChat: (user1: string, user2: string) => void;
  sendMessage: (room: string, senderId: string, receiverId: string, message: string, attachment?: any, parent?: string) => void;
  loadMessages: (myId: string, friendId: string, skip: number) => void;
  markMessageAsSeen: (message: any) => void;
  setTyping: (room: string, isTyping: boolean, type: string, receiverId: string) => void;
  fetchMessages: (profileId: string) => void;
  updateLastLogin: (userId: string) => void;
  checkUserActive: (profileId: string, myId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Listen to socket connection status changes
    const checkConnection = () => {
      const connected = socketService.isSocketConnected();
      setIsConnected(connected);
    };

    // Check connection status periodically
    const interval = setInterval(checkConnection, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const connect = async (profileId: string) => {
    try {
      await socketService.connect(profileId);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setIsConnected(false);
      throw error;
    }
  };

  const disconnect = () => {
    socketService.disconnect();
    setIsConnected(false);
  };

  const emit = (event: string, data: any) => {
    socketService.emit(event, data);
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    socketService.on(event, callback);
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    socketService.off(event, callback);
  };

  const joinChat = (user1: string, user2: string) => {
    socketService.joinChat(user1, user2);
  };

  const sendMessage = (room: string, senderId: string, receiverId: string, message: string, attachment?: any, parent?: string) => {
    socketService.sendMessage(room, senderId, receiverId, message, attachment, parent);
  };

  const loadMessages = (myId: string, friendId: string, skip: number) => {
    socketService.loadMessages(myId, friendId, skip);
  };

  const markMessageAsSeen = (message: any) => {
    socketService.markMessageAsSeen(message);
  };

  const setTyping = (room: string, isTyping: boolean, type: string, receiverId: string) => {
    socketService.setTyping(room, isTyping, type, receiverId);
  };

  const fetchMessages = (profileId: string) => {
    socketService.fetchMessages(profileId);
  };

  const updateLastLogin = (userId: string) => {
    socketService.updateLastLogin(userId);
  };

  const checkUserActive = (profileId: string, myId: string) => {
    socketService.checkUserActive(profileId, myId);
  };

  const value: SocketContextType = {
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinChat,
    sendMessage,
    loadMessages,
    markMessageAsSeen,
    setTyping,
    fetchMessages,
    updateLastLogin,
    checkUserActive,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
