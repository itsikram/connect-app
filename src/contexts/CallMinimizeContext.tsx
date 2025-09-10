import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MinimizedCall {
  id: string;
  type: 'video' | 'audio';
  callerName: string;
  callerProfilePic?: string;
  callerId: string;
  status: 'ringing' | 'connected';
  duration?: number;
  isMuted?: boolean;
  isCameraOn?: boolean;
  isScreenSharing?: boolean;
  onRestore?: () => void;
  onEnd?: () => void;
  onToggleMute?: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
}

interface CallMinimizeContextType {
  minimizedCalls: MinimizedCall[];
  minimizeCall: (call: MinimizedCall) => void;
  restoreCall: (callId: string) => void;
  endMinimizedCall: (callId: string) => void;
  updateMinimizedCall: (callId: string, updates: Partial<MinimizedCall>) => void;
  getMinimizedCall: (callId: string) => MinimizedCall | undefined;
}

const CallMinimizeContext = createContext<CallMinimizeContextType | undefined>(undefined);

export const useCallMinimize = () => {
  const context = useContext(CallMinimizeContext);
  if (context === undefined) {
    throw new Error('useCallMinimize must be used within a CallMinimizeProvider');
  }
  return context;
};

interface CallMinimizeProviderProps {
  children: ReactNode;
}

export const CallMinimizeProvider: React.FC<CallMinimizeProviderProps> = ({ children }) => {
  const [minimizedCalls, setMinimizedCalls] = useState<MinimizedCall[]>([]);

  const minimizeCall = (call: MinimizedCall) => {
    setMinimizedCalls(prev => {
      // Remove existing call with same ID and add new one
      const filtered = prev.filter(c => c.id !== call.id);
      return [...filtered, call];
    });
  };

  const restoreCall = (callId: string) => {
    const call = minimizedCalls.find(c => c.id === callId);
    if (call && call.onRestore) {
      call.onRestore();
    }
    // Remove from minimized calls
    setMinimizedCalls(prev => prev.filter(c => c.id !== callId));
  };

  const endMinimizedCall = (callId: string) => {
    const call = minimizedCalls.find(c => c.id === callId);
    if (call && call.onEnd) {
      call.onEnd();
    }
    // Remove from minimized calls
    setMinimizedCalls(prev => prev.filter(c => c.id !== callId));
  };

  const updateMinimizedCall = (callId: string, updates: Partial<MinimizedCall>) => {
    setMinimizedCalls(prev => prev.map(call => 
      call.id === callId ? { ...call, ...updates } : call
    ));
  };

  const getMinimizedCall = (callId: string): MinimizedCall | undefined => {
    return minimizedCalls.find(c => c.id === callId);
  };

  const value: CallMinimizeContextType = {
    minimizedCalls,
    minimizeCall,
    restoreCall,
    endMinimizedCall,
    updateMinimizedCall,
    getMinimizedCall,
  };

  return (
    <CallMinimizeContext.Provider value={value}>
      {children}
    </CallMinimizeContext.Provider>
  );
};


