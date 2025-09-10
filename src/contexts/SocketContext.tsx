import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import socketService from '../services/socketService';
import { setGlobalSocketService } from '../lib/notificationSocketService';

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
  // Video call methods
  startVideoCall: (to: string, channelName: string) => void;
  answerVideoCall: (to: string, channelName: string) => void;
  endVideoCall: (friendId: string) => void;
  // Audio call methods
  startAudioCall: (to: string, channelName: string) => void;
  answerAudioCall: (to: string, channelName: string) => void;
  endAudioCall: (friendId: string) => void;
  // Filter methods
  applyVideoFilter: (to: string, filter: string) => void;
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

  // Video call methods
  const startVideoCall = (to: string, channelName: string) => {
    socketService.startVideoCall(to, channelName);
  };

  const answerVideoCall = (to: string, channelName: string) => {
    socketService.answerVideoCall(to, channelName);
  };

  const endVideoCall = (friendId: string) => {
    socketService.endVideoCall(friendId);
  };

  // Audio call methods
  const startAudioCall = (to: string, channelName: string) => {
    socketService.startAudioCall(to, channelName);
  };

  const answerAudioCall = (to: string, channelName: string) => {
    socketService.answerAudioCall(to, channelName);
  };

  const endAudioCall = (friendId: string) => {
    socketService.endAudioCall(friendId);
  };

  // Filter methods
  const applyVideoFilter = (to: string, filter: string) => {
    socketService.applyVideoFilter(to, filter);
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
    startVideoCall,
    answerVideoCall,
    endVideoCall,
    startAudioCall,
    answerAudioCall,
    endAudioCall,
    applyVideoFilter,
  };

  // Register global socket service for notifications
  useEffect(() => {
    setGlobalSocketService(value);
  }, [value]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
