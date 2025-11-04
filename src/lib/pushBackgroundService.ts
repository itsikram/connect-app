import BackgroundService from 'react-native-background-actions';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Background socket state (module-scoped to persist during service lifetime)
let backgroundSocket: any = null;
let isSettingUpSocket = false;
let hasRegisteredSocketHandlers = false;

// Resolve a safe caller name from payload
const resolveCallerName = (payload: any): string => {
  return (
    payload?.callerName ||
    payload?.name ||
    payload?.fromName ||
    'Unknown Caller'
  );
};

// Normalize incoming call payload across possible server event shapes
const normalizeIncomingCallPayload = (raw: any) => {
  const isAudio = Boolean(
    raw?.isAudio === true || raw?.isAudio === 'true' || raw?.type === 'audio'
  );
  return {
    callerName: resolveCallerName(raw),
    callerProfilePic: raw?.callerProfilePic || raw?.profilePic || '',
    channelName: raw?.channelName || raw?.channel || raw?.room || '',
    isAudio,
    callerId: raw?.callerId || raw?.from || raw?.userId || raw?.id || '',
  };
};

// Android-only: ensure channels exist and ask user to disable battery optimizations
async function ensureAndroidForegroundPrereqs(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: 'default',
      name: 'Default',
      importance: AndroidImportance.DEFAULT,
    });
  } catch (_) {}
  try {
    await notifee.createChannel({
      id: 'incoming_calls',
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
  } catch (_) {}
  try {
    const batteryOptimizationEnabled = await (notifee as any).isBatteryOptimizationEnabled?.();
    if (batteryOptimizationEnabled) {
      await (notifee as any).openBatteryOptimizationSettings?.();
    }
  } catch (_) {}
}

// Set up a resilient socket connection usable in background context
async function ensureBackgroundSocketConnected(): Promise<void> {
  if (isSettingUpSocket || (backgroundSocket && backgroundSocket.connected)) {
    return;
  }
  isSettingUpSocket = true;
  try {
    // Defer imports to avoid heavy init on module load
    const [{ initializeSocket }, { default: configAsync }] = await Promise.all([
      import('../socket/socket'),
      import('@react-native-async-storage/async-storage'),
    ]);

    // Read stored user to get profile id
    let profileId: string | undefined;
    try {
      const userJson = await AsyncStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : null;
      profileId = user?.profile?._id;
    } catch (e) {
      // ignore
    }

    if (!profileId) {
      isSettingUpSocket = false;
      return; // No user session; nothing to do
    }

    backgroundSocket = await initializeSocket(profileId);

    if (!hasRegisteredSocketHandlers && backgroundSocket) {
      hasRegisteredSocketHandlers = true;

      // Generic incoming call handler (covers multiple event names)
      const handleIncoming = async (payload: any) => {
        try {
          const { callNotificationService } = await import('./callNotificationService');
          const normalized = normalizeIncomingCallPayload(payload);
          if (!normalized.channelName || !normalized.callerId) {
            return;
          }
          await callNotificationService.displayIncomingCallNotification(normalized);
        } catch (e) {
          // Fallback: minimal notifee notification if service import fails
          try {
            const normalized = normalizeIncomingCallPayload(payload);
            await notifee.displayNotification({
              title: normalized.isAudio ? 'Incoming Audio Call' : 'Incoming Video Call',
              body: `Call from ${normalized.callerName}`,
              android: {
                channelId: 'incoming_calls',
                ongoing: true,
                pressAction: { id: 'open_incoming_call', launchActivity: 'default' },
                fullScreenAction: { id: 'incoming_call_fullscreen', launchActivity: 'default' },
              },
              data: { type: 'incoming_call', ...normalized, isAudio: String(normalized.isAudio) },
            });
          } catch (_) {}
        }
      };

      // Listen to various possible server events for incoming calls
      const incomingEvents = [
        'incoming_call',
        'incoming-call',
        'incoming-audio-call',
        'incoming-video-call',
      ];
      incomingEvents.forEach(evt => {
        try { backgroundSocket.on(evt, handleIncoming); } catch (_) {}
      });

      // Speak message handler (server-driven TTS)
      const handleSpeakMessage = async (payload: any) => {
        try {
          const { backgroundTtsService } = await import('./backgroundTtsService');
          await backgroundTtsService.initialize();
          const message: string = String(
            payload?.message || payload?.text || payload?.body || ''
          );
          if (!message.trim()) return;

          const priority = (payload?.priority === 'high' || payload?.priority === 'low') ? payload.priority : 'normal';
          const interrupt = payload?.interrupt !== false; // default true

          console.log('speak message', payload)
          await backgroundTtsService.speakMessage(message, { priority, interrupt });
        } catch (_) {}
      };
      const speakEvents = [ 'speak_message', 'speak-message' ];
      speakEvents.forEach(evt => {
        try { backgroundSocket.on(evt, handleSpeakMessage); } catch (_) {}
      });

      // Keep minimal logging to observe connection state
      try { backgroundSocket.on('disconnect', () => {}); } catch (_) {}
      try { backgroundSocket.on('connect_error', () => {}); } catch (_) {}
    }
  } catch (e) {
    // ignore connection errors; will retry on next tick
  } finally {
    isSettingUpSocket = false;
  }
}

// Minimal task to keep JS runtime alive in background and maintain socket
async function backgroundTask({ taskName }: { taskName: string }) {
  // Initialize TTS for background speech
  try {
    const { backgroundTtsService } = await import('./backgroundTtsService');
    await backgroundTtsService.initialize();
  } catch (_) {}

  // Ensure Android notification channels and request ignore battery optimizations
  try { await ensureAndroidForegroundPrereqs(); } catch (_) {}

  // Best-effort: bring up socket once on start
  await ensureBackgroundSocketConnected();

  // Loop with small sleep; periodically ensure socket is connected
  for (;;) {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 5000));
    try { await ensureBackgroundSocketConnected(); } catch (_) {}
  }
}

const options = {
  taskName: 'ConnectBackground',
  taskTitle: 'Background service running',
  taskDesc: 'Handling notifications and background tasks',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' as const },
  color: '#0A84FF',
  linkingURI: 'connect://home',
  parameters: { taskName: 'ConnectBackground' },
  allowExecutionInForeground: false,
  stopWithTerminate: false,
  // Android specific
  foregroundService: true,
};

class PushBackgroundService {
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;
    try {
      await BackgroundService.start(backgroundTask as any, options as any);
      this.isRunning = true;
      console.log("background server running")
    } catch (e) {
      // If already running or failed to start, ignore
      this.isRunning = true;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      await BackgroundService.stop();
    } catch (e) {
      // ignore
    } finally {
      this.isRunning = false;
      console.log('background service stopped')
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  // Convenience to ensure service is running before operations
  async ensure(): Promise<void> {
    if (!this.isRunning) {
      await this.start();
    }
  }

  // One-shot helper to show a notification from background
  async displayNotification(title: string, body: string, data: Record<string, string> = {}): Promise<void> {
    await this.ensure();
    await notifee.displayNotification({
      title,
      body:body + ' from background service',
      android: {
        channelId: 'default',
        smallIcon: 'ic_launcher',
        ongoing: true,
        pressAction: { id: 'default' },
      },
      data,
    });
  }
}

export const pushBackgroundService = new PushBackgroundService();
export default pushBackgroundService;
