import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Defaults to navigation.goBack(). Pass null to hide the back button. */
  onBack?: (() => void) | null;
  /** Optional trailing element, e.g. a HeaderAction. */
  right?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Standard in-screen header for stack screens that don't get the app's
 * top bar: a 44pt back target, a title, and an optional trailing action.
 */
const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  right,
  style,
}) => {
  const navigation = useNavigation();
  const { colors: themeColors } = useTheme();

  const handleBack =
    onBack === null
      ? null
      : onBack ?? (() => navigation.canGoBack() && navigation.goBack());

  return (
    <View style={[styles.container, style]}>
      {handleBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          android_ripple={{
            color: themeColors.border.strong,
            borderless: true,
            radius: 22,
          }}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: themeColors.surface.secondary },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="arrow-back" size={22} color={themeColors.text.primary} />
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <Text
          style={[styles.title, { color: themeColors.text.primary }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: themeColors.text.secondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
    paddingVertical: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default ScreenHeader;
