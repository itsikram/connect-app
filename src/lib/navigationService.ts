import { createNavigationContainerRef, StackActions, CommonActions } from '@react-navigation/native';

export type RootNavigationParams = Record<string, object | undefined>;

export const navigationRef = createNavigationContainerRef<RootNavigationParams>();

let isReady = false;

export function markNavigationReady() {
  isReady = true;
}

export function isNavigationReady() {
  return isReady && navigationRef.isReady?.();
}

export function navigate(name: string, params?: object) {
  if (isNavigationReady()) {
    navigationRef.navigate(name as keyof RootNavigationParams, params as any);
  } else {
    // Queue a microtask to retry once ready to avoid losing navigation from early events
    queueMicrotask(() => {
      if (isNavigationReady()) {
        navigationRef.navigate(name as keyof RootNavigationParams, params as any);
      }
    });
  }
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


