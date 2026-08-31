import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getColorWithOpacity } from './colors';

export const getWatchTokens = (colors: any, isDarkMode: boolean) => {
  const ink = (opacity: number) =>
    isDarkMode ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`;
  const primary = colors.primary;
  const isCyan = String(primary).toLowerCase() === '#00d4ff';

  return {
    pageBg: colors.background.primary,
    pageBgAlt: colors.background.secondary,
    surface: colors.surface.primary,
    elevated: colors.surface.elevated,
    border: colors.border.primary,
    text: colors.text.primary,
    muted: colors.text.secondary,
    tertiary: colors.text.tertiary,
    primary,
    primarySoft: getColorWithOpacity(primary, 0.16),
    primaryMid: getColorWithOpacity(primary, 0.32),
    error: colors.status.error,
    success: colors.status.success,
    chipBg: isDarkMode ? 'rgba(255,255,255,0.12)' : colors.background.tertiary,
    chipBorder: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.14)',
    btnBg: isDarkMode ? 'rgba(28,28,30,0.92)' : '#FFFFFF',
    listBg: ink(isDarkMode ? 0.04 : 0.03),
    overlay: ink(isDarkMode ? 0.08 : 0.05),
    inputBg: isDarkMode ? ink(0.06) : colors.background.tertiary,
    placeholder: colors.text.tertiary,
    mediaBg: colors.background.primary,
    mediaIcon: isDarkMode ? '#FFFFFF' : colors.text.primary,
    chromeText: colors.text.primary,
    chromeMuted: colors.text.secondary,
    metaBg: isDarkMode ? 'rgba(18,18,20,0.72)' : 'rgba(255,255,255,0.94)',
    playBadgeBg: isDarkMode ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.94)',
    chromeElevation: {
      shadowColor: '#000',
      shadowOpacity: isDarkMode ? 0.4 : 0.14,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    ctaText: isDarkMode || isCyan ? '#04222a' : '#FFFFFF',
    statusBar: (isDarkMode ? 'light-content' : 'dark-content') as 'light-content' | 'dark-content',
    disabled: colors.gray?.[500] || '#8E8E93',
    ink,
    isDarkMode,
  };
};

export const fitWatchContainSize = (
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
) => {
  if (!naturalW || !naturalH) {
    return { width: maxW, height: Math.min(maxH, Math.round(maxW * (9 / 16))) };
  }
  const ratio = naturalW / naturalH;
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
};

export const useWatchTokens = () => {
  const { colors, isDarkMode } = useTheme();
  return useMemo(() => getWatchTokens(colors, isDarkMode), [colors, isDarkMode]);
};
