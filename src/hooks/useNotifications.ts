import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  initializeNotifications,
  getNotificationToken,
  saveNotificationToken,
  configureNotificationsChannel,
} from '../lib/pushExpo';
import { configureIncomingCallChannels } from '../lib/incomingCallAlerts';
import { handleIncomingCallNotificationAction, expoActionId, notifeeActionId } from '../lib/callNotificationActions';
import { consumePendingIncomingCall, dispatchPendingIncomingCall } from '../lib/pendingIncomingCall';
import { isAndroidExpoGo } from '../lib/expoGo';

interface UseNotificationsProps {
  navigate: (screen: string, params?: any) => void;
}

const STALE_NOTIFICATION_MS = 90 * 1000;

function notificationTimestamp(notification: Notifications.Notification | undefined): number {
  const raw = (notification as any)?.date;
  if (typeof raw === 'number') {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export const useNotifications = ({ navigate }: UseNotificationsProps) => {
  const unsubscribeRefs = useRef<Array<() => void>>([]);
  const isInitializedRef = useRef<boolean>(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  const memoizedNavigate = useCallback(navigate, []);

  const cancelIncomingCallNotifications = useCallback(async () => {
    try {
      const { cancelIncomingCallNotifications: cancel } = await import('../lib/incomingCallAlerts');
      await cancel();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (isAndroidExpoGo()) {
      console.log('Android Expo Go detected: remote push notifications require an EAS development build');
      return;
    }
    if (isInitializedRef.current || initializationPromiseRef.current) {
      return;
    }

    const initialize = async () => {
      if (isInitializedRef.current) return;

      try {
        await initializeNotifications();
        await configureNotificationsChannel();
        await configureIncomingCallChannels();

        const tokenResult = await getNotificationToken();
        if (tokenResult?.token) {
          await saveNotificationToken(tokenResult.token, tokenResult.previousToken);
        }

        const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data || {};
          if ((data as any).type === 'incoming_call') {
            handleIncomingCallNotificationAction(data, expoActionId(response)).catch(() => {});
            return;
          }
          if ((data as any).type === 'new_message' || (data as any).type === 'chat') {
            memoizedNavigate('Message', {
              screen: 'SingleMessage',
              params: {
                friendId: (data as any).friendId || (data as any).senderId,
                friendName: (data as any).friendName || (data as any).senderName,
              },
            });
          }
        });

        const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
          const data = notification.request.content.data || {};
          if ((data as any).type === 'incoming_call') {
            handleIncomingCallNotificationAction(data).catch(() => {});
          }
        });

        const nativeSub = DeviceEventEmitter.addListener('nativeIncomingCallAction', (raw: any) => {
          const actionId = raw?.declined || raw?.action === 'decline_call'
            ? 'decline_call'
            : raw?.autoAccept || raw?.action === 'accept_call'
              ? 'accept_call'
              : raw?.action;
          handleIncomingCallNotificationAction(raw, actionId).catch(() => {});
        });

        unsubscribeRefs.current = [
          () => responseSub.remove(),
          () => receivedSub.remove(),
          () => nativeSub.remove(),
        ];

        try {
          const notifeeModule = require('@notifee/react-native');
          const notifee = notifeeModule.default;
          const EventType = notifeeModule.EventType;
          if (notifee?.onForegroundEvent) {
            const unsub = notifee.onForegroundEvent(async ({ type, detail }: any) => {
              const data = detail?.notification?.data || {};
              if (data.type !== 'incoming_call') return;
              if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
                await handleIncomingCallNotificationAction(data, notifeeActionId(detail));
              }
            });
            unsubscribeRefs.current.push(() => {
              try {
                if (typeof unsub === 'function') unsub();
              } catch (_) {}
            });
          }
          const initial = await notifee.getInitialNotification?.();
          if (initial?.notification?.data?.type === 'incoming_call') {
            await handleIncomingCallNotificationAction(
              initial.notification.data,
              notifeeActionId(initial),
            );
          }
        } catch (_) {}

        const pending = await consumePendingIncomingCall();
        if (pending) {
          dispatchPendingIncomingCall(pending);
        }

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        const lastData = lastResponse?.notification?.request?.content?.data;
        if (lastData && (lastData as any).type === 'incoming_call') {
          const receivedAt = notificationTimestamp(lastResponse.notification);
          if (receivedAt && Date.now() - receivedAt < STALE_NOTIFICATION_MS) {
            await handleIncomingCallNotificationAction(lastData, lastResponse.actionIdentifier);
          }
        }

        isInitializedRef.current = true;
        console.log('Expo notification listeners set up successfully');
      } catch (error) {
        console.error('Error setting up notifications:', error);
      } finally {
        initializationPromiseRef.current = null;
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !isInitializedRef.current) {
        if (!initializationPromiseRef.current) {
          initializationPromiseRef.current = initialize();
        }
      }
      if (nextAppState === 'active') {
        consumePendingIncomingCall().then((pending) => {
          if (pending) dispatchPendingIncomingCall(pending);
        }).catch(() => {});
        if (Platform.OS === 'android') {
          NativeModules.CallNotificationModule?.getPendingCallAction?.()
            .then((raw: any) => {
              if (raw?.channelName) {
                const actionId = raw?.declined ? 'decline_call' : raw?.autoAccept ? 'accept_call' : raw?.action;
                handleIncomingCallNotificationAction(raw, actionId).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    if (!initializationPromiseRef.current) {
      initializationPromiseRef.current = initialize();
    }

    return () => {
      subscription?.remove();
      unsubscribeRefs.current.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from notification listener:', error);
        }
      });
      unsubscribeRefs.current = [];
    };
  }, [memoizedNavigate]);

  return {
    cancelIncomingCallNotifications,
  };
};
