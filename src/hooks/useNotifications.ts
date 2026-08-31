import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  initializeNotifications,
  getNotificationToken,
  saveNotificationToken,
  configureNotificationsChannel,
} from '../lib/pushExpo';
import {
  configureIncomingCallChannels,
  parseIncomingCallNotificationData,
  startIncomingCallAlert,
  stopIncomingCallAlert,
} from '../lib/incomingCallAlerts';
import { emitIncomingCallFromPush, emitRejectCallFromPush } from '../lib/callEvents';
import { notifyCallerRinging } from '../lib/callStatus';

interface UseNotificationsProps {
  navigate: (screen: string, params?: any) => void;
}

function handleIncomingCallResponse(data: any, actionId?: string) {
  const parsed = parseIncomingCallNotificationData(data) || {
    from: String(data?.callerId || data?.from || ''),
    channelName: String(data?.channelName || ''),
    callerName: data?.callerName,
    callerProfilePic: data?.callerProfilePic,
    isAudio: data?.isAudio === true || data?.isAudio === 'true',
    autoAccept: false,
    ringtoneId: data?.ringtoneId,
  };
  if (!parsed.from || !parsed.channelName) return;

  if (actionId === 'reject_call' || actionId === 'decline_call') {
    stopIncomingCallAlert(parsed.channelName).catch(() => {});
    emitRejectCallFromPush(parsed);
    return;
  }

  startIncomingCallAlert({
    callerId: parsed.from,
    callerName: parsed.callerName,
    callerProfilePic: parsed.callerProfilePic,
    channelName: parsed.channelName,
    isAudio: parsed.isAudio,
    ringtoneId: parsed.ringtoneId,
  }).catch(() => {});

  notifyCallerRinging(parsed.from);

  emitIncomingCallFromPush({
    ...parsed,
    autoAccept: actionId === 'accept_call',
  });
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
    if (isInitializedRef.current || initializationPromiseRef.current) {
      return;
    }

    const initialize = async () => {
      if (isInitializedRef.current) return;

      try {
        await initializeNotifications();
        await configureNotificationsChannel();
        await configureIncomingCallChannels();

        const token = await getNotificationToken();
        if (token) {
          await saveNotificationToken(token);
        }

        const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data || {};
          if ((data as any).type === 'incoming_call') {
            handleIncomingCallResponse(data, response.actionIdentifier);
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
            handleIncomingCallResponse(data);
          }
        });

        unsubscribeRefs.current = [
          () => responseSub.remove(),
          () => receivedSub.remove(),
        ];

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse?.notification?.request?.content?.data) {
          const lastData = lastResponse.notification.request.content.data;
          if ((lastData as any).type === 'incoming_call') {
            handleIncomingCallResponse(lastData, lastResponse.actionIdentifier);
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
