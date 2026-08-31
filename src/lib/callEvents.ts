import { DeviceEventEmitter } from 'react-native';

export const CALL_EVENTS = {
  START_AUDIO: 'startAudioCall',
  START_VIDEO: 'startVideoCall',
  INCOMING_FROM_PUSH: 'incomingCallFromPush',
  REJECT_FROM_PUSH: 'rejectCallFromPush',
} as const;

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
};

export function emitStartAudioCall(detail: StartCallDetail): void {
  DeviceEventEmitter.emit(CALL_EVENTS.START_AUDIO, detail);
}

export function emitStartVideoCall(detail: StartCallDetail): void {
  DeviceEventEmitter.emit(CALL_EVENTS.START_VIDEO, detail);
}

export function emitIncomingCallFromPush(detail: IncomingCallPushDetail): void {
  DeviceEventEmitter.emit(CALL_EVENTS.INCOMING_FROM_PUSH, detail);
}

export function emitRejectCallFromPush(detail: IncomingCallPushDetail): void {
  DeviceEventEmitter.emit(CALL_EVENTS.REJECT_FROM_PUSH, detail);
}
