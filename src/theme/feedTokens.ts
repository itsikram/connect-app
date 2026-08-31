import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const getFeedTokens = (colors: any, isDarkMode: boolean) => {
  const primary = String(colors.primary || '').toLowerCase();
  const isCyanAccent = primary === '#00d4ff';
  return {
    postBg: colors.surface.primary,
    postBorder: colors.border.primary,
    postText: colors.text.primary,
    postTextMuted: colors.text.secondary,
    postAccent: colors.primary,
    postAccentSoft: `${colors.primary}24`,
    postDivider: colors.border.subtle || colors.border.primary,
    postHover: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    composerBg: colors.surface.secondary,
    composerField: isDarkMode ? colors.surface.elevated : colors.background.tertiary,
    cardBorder: colors.border.primary,
    ctaText: isDarkMode || isCyanAccent ? '#04222a' : '#FFFFFF',
    promptCardBg: isDarkMode ? 'rgba(0, 40, 54, 0.96)' : `${colors.primary}18`,
    kicker: isDarkMode ? '#7ce7ff' : colors.primary,
    mediaBg: isDarkMode ? '#111111' : colors.background.tertiary,
    chipBg: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    inputBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : colors.background.tertiary,
    shadowOpacity: isDarkMode ? 0.22 : 0.08,
  };
};

export const useFeedTokens = () => {
  const { colors, isDarkMode } = useTheme();
  return useMemo(() => getFeedTokens(colors, isDarkMode), [colors, isDarkMode]);
};

/** Dark defaults for static styles that do not need live theme. */
export const FEED = getFeedTokens(
  {
    primary: '#00D4FF',
    surface: { primary: 'rgba(22, 24, 28, 0.96)', secondary: 'rgba(36, 37, 38, 0.98)', elevated: '#393a3a' },
    text: { primary: '#f2f4f7', secondary: '#a8b0bb' },
    border: { primary: 'rgba(255, 255, 255, 0.08)', subtle: 'rgba(255, 255, 255, 0.07)' },
    background: { tertiary: '#393a3a' },
  },
  true,
);
