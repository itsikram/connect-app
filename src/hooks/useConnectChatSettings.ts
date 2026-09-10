import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useSelector } from 'react-redux';
import { useSettings } from '../contexts/SettingsContext';
import { RootState } from '../store';
import {
  DEFAULT_CONNECT_CHAT_SETTINGS,
  ConnectChatSettings,
  getChatTheme,
  normalizeConnectChatSettings,
  resolveChatWallpaper,
} from '../utils/chatThemes';
import {
  CONNECT_CHAT_SETTINGS_EVENT,
  getConnectChatSettings,
  mergeServerConnectChatMap,
  readConnectChatSettingsMap,
  setConnectChatSettingsLocal,
} from '../utils/connectChatSettings';

const useConnectChatSettings = (connectId?: string | null) => {
  const userId = useSelector((state: RootState) => state.profile?._id);
  const { settings: globalSettings, updateSettings: persistGlobalSettings } =
    useSettings();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [settings, setSettings] = useState<ConnectChatSettings>({
    ...DEFAULT_CONNECT_CHAT_SETTINGS,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId || !connectId) {
        if (!cancelled) setSettings({ ...DEFAULT_CONNECT_CHAT_SETTINGS });
        return;
      }
      const next = await getConnectChatSettings(
        userId,
        connectId,
        globalSettings?.connectChatSettings as Record<string, any> | undefined,
      );
      if (!cancelled) setSettings(next);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, connectId, globalSettings?.connectChatSettings]);

  useEffect(() => {
    if (!userId || !globalSettings?.connectChatSettings) return;
    mergeServerConnectChatMap(
      userId,
      globalSettings.connectChatSettings as Record<string, any>,
    );
  }, [userId, globalSettings?.connectChatSettings]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      CONNECT_CHAT_SETTINGS_EVENT,
      (detail: any) => {
        if (
          String(detail?.userId) !== String(userId) ||
          String(detail?.connectId) !== String(connectId)
        ) {
          return;
        }
        setSettings(normalizeConnectChatSettings(detail.settings));
      },
    );
    return () => sub.remove();
  }, [userId, connectId]);

  const persistToServer = useCallback(
    (next: ConnectChatSettings) => {
      if (!userId || !connectId) return;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(async () => {
        try {
          const serverMap =
            globalSettings?.connectChatSettings &&
            typeof globalSettings.connectChatSettings === 'object'
              ? globalSettings.connectChatSettings
              : {};
          const localMap = await readConnectChatSettingsMap(userId);
          const merged = { ...serverMap, ...localMap, [connectId]: next };
          await persistGlobalSettings({ connectChatSettings: merged });
        } catch (error) {
          console.error('Failed to persist chat appearance:', error);
        }
      }, 280);
    },
    [userId, connectId, persistGlobalSettings, globalSettings?.connectChatSettings],
  );

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    [],
  );

  const updateSettings = useCallback(
    async (patch: Partial<ConnectChatSettings>) => {
      const next = normalizeConnectChatSettings({ ...settings, ...patch });
      setSettings(next);
      await setConnectChatSettingsLocal(userId, connectId, next);
      persistToServer(next);
      return next;
    },
    [userId, connectId, settings, persistToServer],
  );

  const resetSettings = useCallback(() => {
    return updateSettings({ ...DEFAULT_CONNECT_CHAT_SETTINGS });
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

export default useConnectChatSettings;
