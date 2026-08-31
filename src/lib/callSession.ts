/** Process-wide lock so audio and video overlays cannot both join at once. */
let activeCallKind: 'audio' | 'video' | null = null;

export function isCallBusy(): boolean {
  return activeCallKind != null;
}

export function getActiveCallKind(): 'audio' | 'video' | null {
  return activeCallKind;
}

export function setActiveCallKind(kind: 'audio' | 'video' | null): void {
  activeCallKind = kind;
}
