import React, { createContext, useContext } from 'react';
import { Modal as RNModal, ModalProps, Platform, View } from 'react-native';
import {
  EdgeInsets,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ThemeContext } from '../contexts/ThemeContext';

/**
 * Android system bar handling.
 *
 * The app's layouts were built for Android drawing below the status bar and
 * above the navigation bar (safe-area insets of 0). Android 15+ forces
 * edge-to-edge, so content went under both bars there. The app shell and
 * every modal now reserve the real bar insets themselves on Android and hand
 * their children zero insets for those edges, so screens lay out the same on
 * every Android version. On older Android the insets are already 0 and
 * nothing changes; iOS is untouched.
 */

const RealInsetsContext = createContext<EdgeInsets | null>(null);

/** Records the window's real insets before any subtree zeroes them. */
export function RealSafeAreaInsetsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <RealInsetsContext.Provider value={insets}>
      {children}
    </RealInsetsContext.Provider>
  );
}

/** The window's real safe-area insets, even inside a padded subtree. */
export function useRealSafeAreaInsets(): EdgeInsets {
  const real = useContext(RealInsetsContext);
  const nearest = useSafeAreaInsets();
  return real || nearest;
}

type Edge = 'top' | 'right' | 'bottom' | 'left';

/**
 * Tells descendants that the given edges are already padded, so hooks such
 * as useSafeAreaInsets() report 0 for them instead of padding twice.
 */
export function PaddedEdgesInsetsProvider({
  edges,
  children,
}: {
  edges: readonly Edge[];
  children: React.ReactNode;
}) {
  const insets = useRealSafeAreaInsets();
  const value = {
    top: edges.includes('top') ? 0 : insets.top,
    right: edges.includes('right') ? 0 : insets.right,
    bottom: edges.includes('bottom') ? 0 : insets.bottom,
    left: edges.includes('left') ? 0 : insets.left,
  };
  return (
    <SafeAreaInsetsContext.Provider value={value}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}

/**
 * Drop-in replacement for React Native's Modal that keeps content clear of
 * the Android status and navigation bars (statusBarTranslucent /
 * navigationBarTranslucent still opt a modal into drawing under them).
 */
export default function Modal({ children, ...props }: ModalProps) {
  const insets = useRealSafeAreaInsets();
  const theme = useContext(ThemeContext);

  if (Platform.OS !== 'android') {
    return <RNModal {...props}>{children}</RNModal>;
  }

  const edges: Edge[] = ['left', 'right'];
  if (!props.statusBarTranslucent) edges.push('top');
  if (!props.navigationBarTranslucent) edges.push('bottom');
  const padded = (edge: Edge) =>
    edges.includes(edge) ? insets[edge] : 0;

  return (
    <RNModal {...props}>
      <View
        style={{
          flex: 1,
          paddingTop: padded('top'),
          paddingBottom: padded('bottom'),
          paddingLeft: padded('left'),
          paddingRight: padded('right'),
          // Full-screen modals: fill the bar strips with the app background
          // instead of the window's default white.
          backgroundColor: props.transparent
            ? 'transparent'
            : theme?.colors?.background?.primary,
        }}
      >
        <PaddedEdgesInsetsProvider edges={edges}>
          {children}
        </PaddedEdgesInsetsProvider>
      </View>
    </RNModal>
  );
}
