// A tiny singleton to hold server-provided remote config (from GET /connect/)

export type ConnectRemoteConfig = {
  appVersion?: string;
  isNewVersionAvailable?: boolean;
  apkUrl?: string;
  showAds?: boolean;
  // Allow arbitrary additional fields from the backend without strict typing
  [key: string]: any;
};

let remoteConfig: ConnectRemoteConfig | null = null;
const listeners = new Set<(cfg: ConnectRemoteConfig | null) => void>();

export function setRemoteConfig(config: ConnectRemoteConfig | null): void {
  remoteConfig = config ? { ...config } : null;
  for (const cb of listeners) {
    try { cb(remoteConfig); } catch (_) {}
  }
}

export function getRemoteConfig(): ConnectRemoteConfig | null {
  return remoteConfig;
}

export function subscribeRemoteConfig(
  callback: (cfg: ConnectRemoteConfig | null) => void
): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}


