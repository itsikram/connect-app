/** Process-wide lock so audio and video overlays cannot both join at once. */
import { DeviceEventEmitter } from 'react-native';
import { setLockScreenCallActive } from './lockScreenCall';
import { stopOngoingCallService } from './ongoingCall';

export type ActiveCallKind = 'audio' | 'video' | 'liveVoice';

let activeCallKind: ActiveCallKind | null = null;

export function isCallBusy(): boolean {
  return activeCallKind != null;
}

export function getActiveCallKind(): ActiveCallKind | null {
  return activeCallKind;
}

export function setActiveCallKind(kind: ActiveCallKind | null): void {
  activeCallKind = kind;
  setLockScreenCallActive(kind === 'audio' || kind === 'video');
  if (kind == null) stopOngoingCallService();
  DeviceEventEmitter.emit('communication-session-active', kind != null);
}
