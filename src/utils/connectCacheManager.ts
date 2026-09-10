import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const CONNECT_CACHE_EVENT = 'connects-cache-updated';

type ConnectList = 'requests' | 'suggestions';
type ConnectItem = Record<string, any> & { _id?: string };

const CACHE_VERSION = '1.0';
const CACHE_VERSION_KEY = 'connect_cache_version';
const CACHE_DURATION = 15 * 60 * 1000;

const listKey = (profileId: string, list: ConnectList) =>
  `cached_connect_${list}_${profileId}`;
const timestampKey = (profileId: string, list: ConnectList) =>
  `connect_${list}_timestamp_${profileId}`;

const uniqueById = (items: unknown): ConnectItem[] => {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.filter((item): item is ConnectItem => {
    if (!item || typeof item !== 'object') return false;
    const id = String((item as ConnectItem)._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const emitUpdate = (profileId: string, list: ConnectList, items: ConnectItem[]) => {
  DeviceEventEmitter.emit(CONNECT_CACHE_EVENT, { profileId, list, items });
};

class ConnectCacheManager {
  static async initialize() {
    const version = await AsyncStorage.getItem(CACHE_VERSION_KEY);
    if (version !== CACHE_VERSION) {
      const keys = await AsyncStorage.getAllKeys();
      const connectKeys = keys.filter((key) =>
        key.startsWith('cached_connect_') || key.startsWith('connect_requests_timestamp_') ||
        key.startsWith('connect_suggestions_timestamp_'),
      );
      if (connectKeys.length) await AsyncStorage.multiRemove(connectKeys);
      await AsyncStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  }

  static async getCached(profileId: string, list: ConnectList): Promise<ConnectItem[] | null> {
    const [raw, timestamp] = await AsyncStorage.multiGet([
      listKey(profileId, list),
      timestampKey(profileId, list),
    ]);
    if (!raw[1] || !timestamp[1]) return null;
    if (Date.now() - Number(timestamp[1]) > CACHE_DURATION) return null;
    try {
      return uniqueById(JSON.parse(raw[1]));
    } catch (error) {
      console.error('Error parsing connect cache:', error);
      return null;
    }
  }

  static async setCached(profileId: string, list: ConnectList, items: unknown) {
    const next = uniqueById(items);
    await AsyncStorage.multiSet([
      [listKey(profileId, list), JSON.stringify(next)],
      [timestampKey(profileId, list), String(Date.now())],
    ]);
    emitUpdate(profileId, list, next);
    return next;
  }

  static async removeProfile(profileId: string, list: ConnectList, targetId: string) {
    const current = (await this.getCached(profileId, list)) || [];
    return this.setCached(
      profileId,
      list,
      current.filter((item) => String(item._id) !== String(targetId)),
    );
  }
}

ConnectCacheManager.initialize().catch((error) => {
  console.error('Connect cache initialization error:', error);
});

export default ConnectCacheManager;
