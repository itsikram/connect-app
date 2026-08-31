import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getRingtoneSoundName } from './ringtoneAssets';

export function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

/** OS notification sound. Expo Go cannot play custom bundled ringtone files. */
export function getIncomingCallOsSound(ringtoneId?: unknown): string {
  if (isExpoGo()) return 'default';
  if (Platform.OS === 'ios') return `${getRingtoneSoundName(ringtoneId)}.mp3`;
  return getRingtoneSoundName(ringtoneId);
}
