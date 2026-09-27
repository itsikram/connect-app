import { useEffect, useRef, useState } from 'react';

export type ConnectionHealth = 'ok' | 'slow' | 'offline';

const PING_INTERVAL_MS = 4000;
const SLOW_AFTER_MS = 3500;
const OFFLINE_GRACE_MS = 800;

/**
 * Tracks whether the online Ludo connection is usable. "offline" once the
 * socket has been down for a moment, "slow" when a ludo:ping round trip takes
 * longer than SLOW_AFTER_MS, otherwise "ok".
 */
export const useConnectionHealth = (
  active: boolean,
  isConnected: boolean,
  emit: (event: string, data: any, ack?: (...args: any[]) => void) => void,
): ConnectionHealth => {
  const [health, setHealth] = useState<ConnectionHealth>('ok');
  const pendingSinceRef = useRef<number | null>(null);
  // A server without the ludo:ping handler never answers; only judge latency
  // once the server has proven it replies.
  const serverAnswersPingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setHealth('ok');
      return;
    }
    if (!isConnected) {
      const timer = setTimeout(() => setHealth('offline'), OFFLINE_GRACE_MS);
      return () => clearTimeout(timer);
    }
    setHealth('ok');
    pendingSinceRef.current = null;
    let disposed = false;
    const ping = () => {
      if (pendingSinceRef.current != null) return;
      const sentAt = Date.now();
      pendingSinceRef.current = sentAt;
      emit('ludo:ping', {}, () => {
        serverAnswersPingRef.current = true;
        if (disposed || pendingSinceRef.current !== sentAt) return;
        pendingSinceRef.current = null;
        setHealth('ok');
      });
    };
    const watch = setInterval(() => {
      const since = pendingSinceRef.current;
      if (serverAnswersPingRef.current && since != null && Date.now() - since > SLOW_AFTER_MS) {
        setHealth('slow');
        // Allow a fresh probe so recovery is noticed promptly.
        if (Date.now() - since > SLOW_AFTER_MS * 2) pendingSinceRef.current = null;
      }
    }, 500);
    ping();
    const pinger = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      disposed = true;
      clearInterval(watch);
      clearInterval(pinger);
    };
  }, [active, isConnected, emit]);

  return health;
};
