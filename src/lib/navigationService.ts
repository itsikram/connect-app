import { createNavigationContainerRef, StackActions, CommonActions } from '@react-navigation/native';

export type RootNavigationParams = Record<string, object | undefined>;

export const navigationRef = createNavigationContainerRef<RootNavigationParams>();

let isReady = false;
// Navigations requested before the container is ready (e.g. tapping a
// notification that cold-starts the app). Previously these were retried once
// in a microtask and then silently dropped.
let pendingNavigations: Array<{ name: string; params?: object }> = [];

function flushPendingNavigations() {
  if (!isNavigationReady() || pendingNavigations.length === 0) return;
  const queued = pendingNavigations;
  pendingNavigations = [];
  queued.forEach(({ name, params }) => {
    try {
      navigationRef.navigate(name as keyof RootNavigationParams, params as any);
    } catch (error) {
      console.warn('Deferred navigation failed:', name, error);
    }
  });
}

export function markNavigationReady() {
  isReady = true;
  flushPendingNavigations();
}

export function isNavigationReady() {
  return isReady && navigationRef.isReady?.();
}

export function navigate(name: string, params?: object) {
  if (isNavigationReady()) {
    navigationRef.navigate(name as keyof RootNavigationParams, params as any);
    return;
  }
  // Keep only the latest request: a stale queued screen is worse than none.
  pendingNavigations = [{ name, params }];
  queueMicrotask(flushPendingNavigations);
}

export function dispatch(action: ReturnType<typeof CommonActions.navigate | typeof StackActions.push>) {
  if (isNavigationReady()) {
    navigationRef.dispatch(action as any);
  }
}

export function reset(state: Parameters<typeof CommonActions.reset>[0]) {
  if (isNavigationReady()) {
    navigationRef.reset(state as any);
  }
}
