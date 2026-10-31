import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import socketService from '../services/socketService';
import { applyPresenceStatuses } from '../reducers/presenceReducer';

type Status = { isActive?: boolean; lastSeen?: string | number | null };

/**
 * Realtime online/offline status (server/sockets/presence.js):
 * - keeps the presence slice in sync with presence_snapshot / presence_update
 *   (plus the legacy connect_online / connect_offline events);
 * - tells the server when this device is foreground ("active") or
 *   background ("away"), so others see us go offline as soon as the app is
 *   backgrounded and online again as soon as it returns;
 * - reconnects immediately when the app comes back to the foreground.
 */
export default function usePresenceSync(profileId?: string | null, isConnected?: boolean) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!profileId) return;

    const apply = (statuses: Record<string, Status>) => {
      if (statuses && typeof statuses === 'object' && Object.keys(statuses).length) {
        dispatch(applyPresenceStatuses(statuses as any));
      }
    };
    const onSnapshot = (payload: any) => apply(payload?.statuses || {});
    const onUpdate = (payload: any) => {
      if (!payload?.profileId) return;
      apply({ [String(payload.profileId)]: { isActive: !!payload.isActive, lastSeen: payload.lastSeen } });
    };
    const onLegacy = (isActive: boolean) => (payload: any) => {
      const id = payload?.profileId || payload?.id || payload;
      if (id && typeof id !== 'object') apply({ [String(id)]: { isActive } });
    };
    const onLegacyOnline = onLegacy(true);
    const onLegacyOffline = onLegacy(false);

    // On the web a hidden tab is still open (same as the web app), so only
    // native apps report "away" when backgrounded.
    const isForeground = () => Platform.OS === 'web' || AppState.currentState === 'active';

    // Whether the user is looking at the app right now; while any of their
    // devices/tabs is focused the server skips push notifications.
    const isFocused = () => {
      if (Platform.OS === 'web') {
        return typeof document === 'undefined' ||
          (document.visibilityState === 'visible' && document.hasFocus());
      }
      return AppState.currentState === 'active';
    };
    const reportFocus = () => socketService.emitIfConnected('presence:focus', { focused: isFocused() });

    const announce = () => {
      const active = isForeground();
      socketService.emitIfConnected(active ? 'presence:active' : 'presence:away');
      reportFocus();
      if (active) {
        // Catch up on anything missed while backgrounded / disconnected.
        socketService.emitIfConnected('presence:subscribe', { profileIds: [], connects: true }, onSnapshot);
      }
    };

    socketService.on('presence_snapshot', onSnapshot);
    socketService.on('presence_update', onUpdate);
    socketService.on('connect_online', onLegacyOnline);
    socketService.on('connect_offline', onLegacyOffline);
    socketService.on('connect', announce);
    announce();

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        socketService.reconnectNow();
        announce();
      } else {
        if (next === 'background' && Platform.OS !== 'web') {
          socketService.emitIfConnected('presence:away');
        }
        reportFocus();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    // AppState on web doesn't see a window losing focus to another app.
    const webWindow = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    webWindow?.addEventListener('focus', reportFocus);
    webWindow?.addEventListener('blur', reportFocus);

    return () => {
      sub.remove();
      webWindow?.removeEventListener('focus', reportFocus);
      webWindow?.removeEventListener('blur', reportFocus);
      socketService.off('presence_snapshot', onSnapshot);
      socketService.off('presence_update', onUpdate);
      socketService.off('connect_online', onLegacyOnline);
      socketService.off('connect_offline', onLegacyOffline);
      socketService.off('connect', announce);
    };
  }, [profileId, isConnected, dispatch]);
}
