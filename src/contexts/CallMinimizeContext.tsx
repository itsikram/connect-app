import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';

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
  const minimizedCallsRef = useRef(minimizedCalls);
  minimizedCallsRef.current = minimizedCalls;

  const minimizeCall = useCallback((call: MinimizedCall) => {
    setMinimizedCalls(prev => {
      const existing = prev.find(c => c.id === call.id);
      if (
        existing &&
        existing.callerName === call.callerName &&
        existing.callerProfilePic === call.callerProfilePic &&
        existing.status === call.status &&
        existing.duration === call.duration &&
        existing.isMuted === call.isMuted &&
        existing.isCameraOn === call.isCameraOn
      ) {
        return prev;
      }
      return [...prev.filter(c => c.id !== call.id), call];
    });
  }, []);

  const restoreCall = useCallback((callId: string) => {
    const call = minimizedCallsRef.current.find(c => c.id === callId);
    setMinimizedCalls(prev => prev.filter(c => c.id !== callId));
    call?.onRestore?.();
  }, []);

  // Only remove from the bar. Hang-up is the caller's job — calling onEnd here
  // re-enters endCall → cleanup → endMinimizedCall and blows the render limit.
  const endMinimizedCall = useCallback((callId: string) => {
    setMinimizedCalls(prev => prev.filter(c => c.id !== callId));
  }, []);

  const updateMinimizedCall = useCallback((callId: string, updates: Partial<MinimizedCall>) => {
    setMinimizedCalls(prev => {
      const idx = prev.findIndex(c => c.id === callId);
      if (idx < 0) return prev;
      const current = prev[idx];
      const keys = Object.keys(updates) as (keyof MinimizedCall)[];
      if (keys.every((key) => current[key] === updates[key])) return prev;
      const next = prev.slice();
      next[idx] = { ...current, ...updates };
      return next;
    });
  }, []);

  const getMinimizedCall = useCallback((callId: string): MinimizedCall | undefined => {
    return minimizedCallsRef.current.find(c => c.id === callId);
  }, []);

  const value = useMemo<CallMinimizeContextType>(() => ({
    minimizedCalls,
    minimizeCall,
    restoreCall,
    endMinimizedCall,
    updateMinimizedCall,
    getMinimizedCall,
  }), [minimizedCalls, minimizeCall, restoreCall, endMinimizedCall, updateMinimizedCall, getMinimizedCall]);

  return (
    <CallMinimizeContext.Provider value={value}>
      {children}
    </CallMinimizeContext.Provider>
  );
};


