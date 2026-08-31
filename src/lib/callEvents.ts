import { DeviceEventEmitter } from 'react-native';

export const CALL_EVENTS = {
  START_AUDIO: 'startAudioCall',
  START_VIDEO: 'startVideoCall',
  INCOMING_FROM_PUSH: 'incomingCallFromPush',
  REJECT_FROM_PUSH: 'rejectCallFromPush',
  LOCAL_ENDED: 'localCallEnded',
} as const;

const PENDING_TTL_MS = 90 * 1000;

export type StartCallDetail = {
  to: string;
  channelName: string;
  callerName?: string;
  callerProfilePic?: string;
};

export type IncomingCallPushDetail = {
  from: string;
  channelName: string;
  callerName?: string;
  callerProfilePic?: string;
  isAudio?: boolean;
  isVideo?: boolean;
  autoAccept?: boolean;
  ringtoneId?: string;
};

let lastIncoming: { detail: IncomingCallPushDetail; ts: number } | null = null;
let lastReject: { detail: IncomingCallPushDetail; ts: number } | null = null;

export function emitStartAudioCall(detail: StartCallDetail): void {
  DeviceEventEmitter.emit(CALL_EVENTS.START_AUDIO, detail);
}

export function emitStartVideoCall(detail: StartCallDetail): void {
  DeviceEventEmitter.emit(CALL_EVENTS.START_VIDEO, detail);
}

export function emitIncomingCallFromPush(detail: IncomingCallPushDetail): void {
  lastIncoming = { detail, ts: Date.now() };
  DeviceEventEmitter.emit(CALL_EVENTS.INCOMING_FROM_PUSH, detail);
}

export function emitRejectCallFromPush(detail: IncomingCallPushDetail): void {
  lastReject = { detail, ts: Date.now() };
  DeviceEventEmitter.emit(CALL_EVENTS.REJECT_FROM_PUSH, detail);
}

export function takeLastIncomingCallFromPush(): IncomingCallPushDetail | null {
  if (!lastIncoming || Date.now() - lastIncoming.ts > PENDING_TTL_MS) return null;
  return lastIncoming.detail;
}

export function takeLastRejectCallFromPush(): IncomingCallPushDetail | null {
  if (!lastReject || Date.now() - lastReject.ts > PENDING_TTL_MS) return null;
  return lastReject.detail;
}

export function emitLocalCallEnded(): void {
  DeviceEventEmitter.emit(CALL_EVENTS.LOCAL_ENDED);
}
