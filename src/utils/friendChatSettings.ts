import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import {
  DEFAULT_FRIEND_CHAT_SETTINGS,
  FriendChatSettings,
  normalizeFriendChatSettings,
} from './chatThemes';

export const FRIEND_CHAT_SETTINGS_EVENT = 'friendChatSettingsUpdated';

const storageKey = (userId: string) => `connect.friendChatSettings.${userId}`;

export const readFriendChatSettingsMap = async (
  userId?: string | null,
): Promise<Record<string, FriendChatSettings>> => {
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

export const writeFriendChatSettingsMap = async (
  userId: string,
  map: Record<string, FriendChatSettings>,
) => {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(map || {}));
  } catch {
    // Ignore quota / private-mode failures.
  }
};

export const getFriendChatSettings = async (
  userId: string | null | undefined,
  friendId: string | null | undefined,
  serverMap?: Record<string, any> | null,
): Promise<FriendChatSettings> => {
  if (!friendId) return { ...DEFAULT_FRIEND_CHAT_SETTINGS };
  const localMap = await readFriendChatSettingsMap(userId);
  const fromLocal = localMap[friendId];
  const fromServer =
    serverMap && typeof serverMap === 'object' ? serverMap[friendId] : null;
  return normalizeFriendChatSettings(fromLocal || fromServer || {});
};

export const setFriendChatSettingsLocal = async (
  userId: string | null | undefined,
  friendId: string | null | undefined,
  next: FriendChatSettings,
) => {
  if (!userId || !friendId) return next;
  const normalized = normalizeFriendChatSettings(next);
  const map = await readFriendChatSettingsMap(userId);
  map[friendId] = normalized;
  await writeFriendChatSettingsMap(userId, map);
  DeviceEventEmitter.emit(FRIEND_CHAT_SETTINGS_EVENT, {
    userId,
    friendId,
    settings: normalized,
  });
  return normalized;
};

export const mergeServerFriendChatMap = async (
  userId: string | null | undefined,
  serverMap: Record<string, any> | null | undefined,
) => {
  if (!userId || !serverMap || typeof serverMap !== 'object') return;
  const localMap = await readFriendChatSettingsMap(userId);
  const merged = { ...serverMap, ...localMap };
  await writeFriendChatSettingsMap(userId, merged);
  return merged;
};
