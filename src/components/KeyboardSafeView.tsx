import React, { createContext, useContext } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const KeyboardAvoidanceContext = createContext(false);

export const KEYBOARD_AVOIDING_BEHAVIOR = Platform.OS === 'ios' ? ('padding' as const) : undefined;

export function useKeyboardVerticalOffset(nested = false, extra = 0) {
  const insets = useSafeAreaInsets();
  // Nested avoiding views sit below the status bar / notch. Their onLayout
  // origin is relative while keyboard screenY is absolute — add insets.top.
  return (nested ? insets.top : 0) + extra;
}

type KeyboardSafeViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  extraOffset?: number;
  /** True when this view is inside a SafeAreaView / not full-window. */
  nested?: boolean;
  enabled?: boolean;
  /** Keep avoiding even if a parent KeyboardSafeView is already active (Modals). */
  force?: boolean;
};

const KeyboardSafeView: React.FC<KeyboardSafeViewProps> = ({
  children,
  style,
  extraOffset = 0,
  nested = false,
  enabled = true,
  force = false,
}) => {
  const parentActive = useContext(KeyboardAvoidanceContext);
  const offset = useKeyboardVerticalOffset(nested, extraOffset);
  const isEnabled = force ? enabled : enabled && !parentActive;

  return (
    <KeyboardAvoidanceContext.Provider value={parentActive || isEnabled}>
      <KeyboardAvoidingView
        style={[styles.flex, style]}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
        keyboardVerticalOffset={offset}
        enabled={isEnabled}
      >
        {children}
      </KeyboardAvoidingView>
    </KeyboardAvoidanceContext.Provider>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default KeyboardSafeView;
