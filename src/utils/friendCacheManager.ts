import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const FRIEND_CACHE_EVENT = 'friends-cache-updated';

type FriendList = 'requests' | 'suggestions';
type FriendItem = Record<string, any> & { _id?: string };

const CACHE_VERSION = '1.0';
const CACHE_VERSION_KEY = 'friend_cache_version';
const CACHE_DURATION = 15 * 60 * 1000;

const listKey = (profileId: string, list: FriendList) =>
  `cached_friend_${list}_${profileId}`;
const timestampKey = (profileId: string, list: FriendList) =>
  `friend_${list}_timestamp_${profileId}`;

const uniqueById = (items: unknown): FriendItem[] => {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.filter((item): item is FriendItem => {
    if (!item || typeof item !== 'object') return false;
    const id = String((item as FriendItem)._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const emitUpdate = (profileId: string, list: FriendList, items: FriendItem[]) => {
  DeviceEventEmitter.emit(FRIEND_CACHE_EVENT, { profileId, list, items });
};

class FriendCacheManager {
  static async initialize() {
    const version = await AsyncStorage.getItem(CACHE_VERSION_KEY);
    if (version !== CACHE_VERSION) {
      const keys = await AsyncStorage.getAllKeys();
      const friendKeys = keys.filter((key) =>
        key.startsWith('cached_friend_') || key.startsWith('friend_requests_timestamp_') ||
        key.startsWith('friend_suggestions_timestamp_'),
      );
      if (friendKeys.length) await AsyncStorage.multiRemove(friendKeys);
      await AsyncStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  }

  static async getCached(profileId: string, list: FriendList): Promise<FriendItem[] | null> {
    const [raw, timestamp] = await AsyncStorage.multiGet([
      listKey(profileId, list),
      timestampKey(profileId, list),
    ]);
    if (!raw[1] || !timestamp[1]) return null;
    if (Date.now() - Number(timestamp[1]) > CACHE_DURATION) return null;
    try {
      return uniqueById(JSON.parse(raw[1]));
    } catch (error) {
      console.error('Error parsing friend cache:', error);
      return null;
    }
  }

  static async setCached(profileId: string, list: FriendList, items: unknown) {
    const next = uniqueById(items);
    await AsyncStorage.multiSet([
      [listKey(profileId, list), JSON.stringify(next)],
      [timestampKey(profileId, list), String(Date.now())],
    ]);
    emitUpdate(profileId, list, next);
    return next;
  }

  static async removeProfile(profileId: string, list: FriendList, targetId: string) {
    const current = (await this.getCached(profileId, list)) || [];
    return this.setCached(
      profileId,
      list,
      current.filter((item) => String(item._id) !== String(targetId)),
    );
  }
}

FriendCacheManager.initialize().catch((error) => {
  console.error('Friend cache initialization error:', error);
});

export default FriendCacheManager;
