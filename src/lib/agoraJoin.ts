import api from './api';

export type AgoraJoinCreds = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
};

const prefetchCache = new Map<string, Promise<AgoraJoinCreds>>();
const prefetchTimes = new Map<string, number>();
// Server tokens last 1h; refetch well before that.
const PREFETCH_TTL_MS = 10 * 60 * 1000;

function cacheKey(channelName: string, uid: number) {
  return `${channelName}:${uid}`;
}

export function prefetchAgoraJoin(channelName: string, uid: number): Promise<AgoraJoinCreds> {
  const key = cacheKey(channelName, uid);
  const existing = prefetchCache.get(key);
  const fetchedAt = prefetchTimes.get(key) || 0;
  if (existing && Date.now() - fetchedAt < PREFETCH_TTL_MS) return existing;
  prefetchTimes.set(key, Date.now());

  const request = api
    .post('/agora/token', { channelName, uid })
    .then(({ data }) => ({
      appId: String(data.appId),
      token: String(data.token),
      channelName,
      uid,
    }))
    .catch((error) => {
      prefetchCache.delete(key);
      prefetchTimes.delete(key);
      throw error;
    });

  prefetchCache.set(key, request);
  return request;
}

export function clearAgoraJoinPrefetch(channelName?: string): void {
  if (!channelName) {
    prefetchCache.clear();
    return;
  }
  for (const key of [...prefetchCache.keys()]) {
    if (key.startsWith(`${channelName}:`)) prefetchCache.delete(key);
  }
}
