import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-account list of friends whose live voice should auto turn on our mic.
const storageKey = (myId?: string | null) => `liveVoiceAutoMic:${myId || ''}`;

const readPeers = async (myId?: string | null): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(myId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch (_e) {
    return [];
  }
};

export const isLiveVoiceAutoMicEnabled = async (
  myId: string | null | undefined,
  peerId: string | null | undefined,
): Promise<boolean> => {
  if (!peerId) return false;
  return (await readPeers(myId)).includes(String(peerId));
};

export const setLiveVoiceAutoMicEnabled = async (
  myId: string | null | undefined,
  peerId: string | null | undefined,
  enabled: boolean,
): Promise<void> => {
  if (!peerId) return;
  try {
    const id = String(peerId);
    const others = (await readPeers(myId)).filter(p => p !== id);
    await AsyncStorage.setItem(
      storageKey(myId),
      JSON.stringify(enabled ? [...others, id] : others),
    );
  } catch (_e) {}
};
