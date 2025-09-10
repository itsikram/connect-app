import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FlingGestureHandler, Directions, State } from 'react-native-gesture-handler';

type SwipeTabsOverlayProps = {
  navigationRef: React.MutableRefObject<any>;
};

/**
 * Full-screen invisible overlay that listens for left/right fling gestures
 * and switches between root tab screens. It ignores swipes if the focused
 * tab's nested stack is deeper than the root (index > 0).
 */
export default function SwipeTabsOverlay({ navigationRef }: SwipeTabsOverlayProps) {
  const navigateByDelta = React.useCallback((delta: number) => {
    try {
      const nav = navigationRef?.current;
      if (!nav || typeof nav.getRootState !== 'function') return;
      const rootState = nav.getRootState?.() || nav.getState?.();
      if (!rootState) return;

      // Expecting the root to be the bottom tabs
      const { index: tabIndex, routes: tabRoutes } = rootState;
      if (!Array.isArray(tabRoutes) || typeof tabIndex !== 'number') return;

      // If current tab has a nested state (e.g., a stack), only allow swipe when at stack root
      const currentTabRoute: any = tabRoutes[tabIndex];
      const nestedState = currentTabRoute?.state;
      if (nestedState && typeof nestedState.index === 'number' && nestedState.index > 0) {
        return; // Deep in a stack; don't switch tabs on swipe
      }

      const nextIndex = tabIndex + delta;
      if (nextIndex < 0 || nextIndex >= tabRoutes.length) return;

      const nextRouteName = tabRoutes[nextIndex]?.name;
      if (typeof nextRouteName === 'string') {
        nav.navigate(nextRouteName);
      }
    } catch (e) {
      // no-op
    }
  }, [navigationRef]);

  const onLeftFling = React.useCallback(({ nativeEvent }: any) => {
    if (nativeEvent.state === State.ACTIVE) {
      // Left fling: go to the next tab
      navigateByDelta(1);
    }
  }, [navigateByDelta]);

  const onRightFling = React.useCallback(({ nativeEvent }: any) => {
    if (nativeEvent.state === State.ACTIVE) {
      // Right fling: go to the previous tab
      navigateByDelta(-1);
    }
  }, [navigateByDelta]);

  return (
    <FlingGestureHandler direction={Directions.LEFT} onHandlerStateChange={onLeftFling}>
      <FlingGestureHandler direction={Directions.RIGHT} onHandlerStateChange={onRightFling}>
        <View pointerEvents="box-none" style={styles.overlay} />
      </FlingGestureHandler>
    </FlingGestureHandler>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    // Keep the overlay transparent and non-intrusive
    backgroundColor: 'transparent',
  },
});


