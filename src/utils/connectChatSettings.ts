import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import {
  DEFAULT_CONNECT_CHAT_SETTINGS,
  ConnectChatSettings,
  normalizeConnectChatSettings,
} from './chatThemes';

export const CONNECT_CHAT_SETTINGS_EVENT = 'connectChatSettingsUpdated';

const storageKey = (userId: string) => `connect.connectChatSettings.${userId}`;

export const readConnectChatSettingsMap = async (
  userId?: string | null,
): Promise<Record<string, ConnectChatSettings>> => {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const writeConnectChatSettingsMap = async (
  userId: string,
  map: Record<string, ConnectChatSettings>,
) => {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(map || {}));
  } catch {
    // Ignore quota / private-mode failures.
  }
};

export const getConnectChatSettings = async (
  userId: string | null | undefined,
  connectId: string | null | undefined,
  serverMap?: Record<string, any> | null,
): Promise<ConnectChatSettings> => {
  if (!connectId) return { ...DEFAULT_CONNECT_CHAT_SETTINGS };
  const localMap = await readConnectChatSettingsMap(userId);
  const fromLocal = localMap[connectId];
  const fromServer =
    serverMap && typeof serverMap === 'object' ? serverMap[connectId] : null;
  return normalizeConnectChatSettings(fromLocal || fromServer || {});
};

export const setConnectChatSettingsLocal = async (
  userId: string | null | undefined,
  connectId: string | null | undefined,
  next: ConnectChatSettings,
) => {
  if (!userId || !connectId) return next;
  const normalized = normalizeConnectChatSettings(next);
  const map = await readConnectChatSettingsMap(userId);
  map[connectId] = normalized;
  await writeConnectChatSettingsMap(userId, map);
  DeviceEventEmitter.emit(CONNECT_CHAT_SETTINGS_EVENT, {
    userId,
    connectId,
    settings: normalized,
  });
  return normalized;
};

export const mergeServerConnectChatMap = async (
  userId: string | null | undefined,
  serverMap: Record<string, any> | null | undefined,
) => {
  if (!userId || !serverMap || typeof serverMap !== 'object') return;
  const localMap = await readConnectChatSettingsMap(userId);
  const merged = { ...serverMap, ...localMap };
  await writeConnectChatSettingsMap(userId, merged);
  return merged;
};
