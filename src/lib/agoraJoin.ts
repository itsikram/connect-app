import api from './api';

export type AgoraJoinCreds = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
};

const prefetchCache = new Map<string, Promise<AgoraJoinCreds>>();

function cacheKey(channelName: string, uid: number) {
  return `${channelName}:${uid}`;
}

export function prefetchAgoraJoin(channelName: string, uid: number): Promise<AgoraJoinCreds> {
  const key = cacheKey(channelName, uid);
  const existing = prefetchCache.get(key);
  if (existing) return existing;

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
