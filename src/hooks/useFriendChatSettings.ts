import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useSelector } from 'react-redux';
import { useSettings } from '../contexts/SettingsContext';
import { RootState } from '../store';
import {
  DEFAULT_FRIEND_CHAT_SETTINGS,
  FriendChatSettings,
  getChatTheme,
  normalizeFriendChatSettings,
  resolveChatWallpaper,
} from '../utils/chatThemes';
import {
  FRIEND_CHAT_SETTINGS_EVENT,
  getFriendChatSettings,
  mergeServerFriendChatMap,
  readFriendChatSettingsMap,
  setFriendChatSettingsLocal,
} from '../utils/friendChatSettings';

const useFriendChatSettings = (friendId?: string | null) => {
  const userId = useSelector((state: RootState) => state.profile?._id);
  const { settings: globalSettings, updateSettings: persistGlobalSettings } =
    useSettings();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [settings, setSettings] = useState<FriendChatSettings>({
    ...DEFAULT_FRIEND_CHAT_SETTINGS,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId || !friendId) {
        if (!cancelled) setSettings({ ...DEFAULT_FRIEND_CHAT_SETTINGS });
        return;
      }
      const next = await getFriendChatSettings(
        userId,
        friendId,
        globalSettings?.friendChatSettings as Record<string, any> | undefined,
      );
      if (!cancelled) setSettings(next);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, friendId, globalSettings?.friendChatSettings]);

  useEffect(() => {
    if (!userId || !globalSettings?.friendChatSettings) return;
    mergeServerFriendChatMap(
      userId,
      globalSettings.friendChatSettings as Record<string, any>,
    );
  }, [userId, globalSettings?.friendChatSettings]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      FRIEND_CHAT_SETTINGS_EVENT,
      (detail: any) => {
        if (
          String(detail?.userId) !== String(userId) ||
          String(detail?.friendId) !== String(friendId)
        ) {
          return;
        }
        setSettings(normalizeFriendChatSettings(detail.settings));
      },
    );
    return () => sub.remove();
  }, [userId, friendId]);

  const persistToServer = useCallback(
    (next: FriendChatSettings) => {
      if (!userId || !friendId) return;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(async () => {
        try {
          const serverMap =
            globalSettings?.friendChatSettings &&
            typeof globalSettings.friendChatSettings === 'object'
              ? globalSettings.friendChatSettings
              : {};
          const localMap = await readFriendChatSettingsMap(userId);
          const merged = { ...serverMap, ...localMap, [friendId]: next };
          await persistGlobalSettings({ friendChatSettings: merged });
        } catch (error) {
          console.error('Failed to persist chat appearance:', error);
        }
      }, 280);
    },
    [userId, friendId, persistGlobalSettings, globalSettings?.friendChatSettings],
  );

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    [],
  );

  const updateSettings = useCallback(
    async (patch: Partial<FriendChatSettings>) => {
      const next = normalizeFriendChatSettings({ ...settings, ...patch });
      setSettings(next);
      await setFriendChatSettingsLocal(userId, friendId, next);
      persistToServer(next);
      return next;
    },
    [userId, friendId, settings, persistToServer],
  );

  const resetSettings = useCallback(() => {
    return updateSettings({ ...DEFAULT_FRIEND_CHAT_SETTINGS });
  }, [updateSettings]);

  const theme = useMemo(() => getChatTheme(settings.themeId), [settings.themeId]);

  const wallpaper = useMemo(
    () =>
      resolveChatWallpaper(
        settings,
        theme,
        globalSettings?.chatBackground,
      ),
    [settings, theme, globalSettings?.chatBackground],
  );

  return {
    settings,
    theme,
    wallpaper,
    updateSettings,
    resetSettings,
    globalBackground: globalSettings?.chatBackground || null,
  };
};

export default useFriendChatSettings;
