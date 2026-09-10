import { DeviceEventEmitter } from 'react-native';

export const LIVE_VOICE_EVENTS = {
  START: 'startLiveVoice',
  STOP: 'stopLiveVoice',
  STATUS: 'liveVoiceStatus',
} as const;

export type LiveVoiceStartDetail = {
  to: string;
  channelName: string;
  connectName?: string;
};

export type LiveVoiceStatusDetail = {
  active: boolean;
  connecting: boolean;
  duration?: number;
  peerId?: string | null;
  channelName?: string | null;
  role?: 'sender' | 'receiver';
};

export function emitStartLiveVoice(detail: LiveVoiceStartDetail): void {
  DeviceEventEmitter.emit(LIVE_VOICE_EVENTS.START, detail);
}

export function emitStopLiveVoice(): void {
  DeviceEventEmitter.emit(LIVE_VOICE_EVENTS.STOP);
}

export function emitLiveVoiceStatus(detail: LiveVoiceStatusDetail): void {
  DeviceEventEmitter.emit(LIVE_VOICE_EVENTS.STATUS, detail);
}

export function liveVoiceChannelName(myId?: string | null, connectId?: string | null, room?: string | null): string {
  if (room) return String(room);
  if (!myId || !connectId) return '';
  return [String(myId), String(connectId)].sort().join('_');
}
