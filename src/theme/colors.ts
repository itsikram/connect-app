export const colors = {
  // Primary colors
  primary: '#29b1a9',
  primaryLight: '#29b1a9',
  primaryDark: '#29b1a9',
  
  // Secondary colors
  secondary: '#5856D6',
  secondaryLight: '#8A8AFF',
  secondaryDark: '#3A3A8C',

  // input colors
  inputBackground: '#3A3B3C',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9F9F9',
    100: '#F2F2F2',
    200: '#E5E5EA',
    300: '#D1D1D6',
    400: '#C7C7CC',
    500: '#AEAEB2',
    600: '#8E8E93',
    700: '#636366',
    800: '#48484A',
    900: '#1C1C1E',
  },
  
  // Status colors
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',
  
  // Background colors
  background: {
    light: '#f5f5f5',
    dark: '#18191A',
  },

  // Text colors
  text: {
    primary: '#18191A',
    secondary: '#8E8E93',
    light: '#FFFFFF',
  },
  
  // Border colors
  border: {
    light: '#E5E5EA',
    dark: '#38383A',
  },
} as const;

// Theme definitions
export const themes = {
  light: {
    primary: '#29b1a9',
    secondary: '#5856D6',
    background: {
      primary: '#FFFFFF',
      secondary: '#F8F9FA',
      tertiary: '#F1F3F4',
    },
    surface: {
      primary: '#FFFFFF',
      secondary: '#F8F9FA',
      elevated: '#FFFFFF',
      header: '#FFFFFF', // Header background color for light mode
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#5F6368',
      tertiary: '#9AA0A6',
      inverse: '#FFFFFF',
    },
    border: {
      primary: '#E8EAED',
      secondary: '#DADCE0',
      focus: '#29b1a9',
    },
    status: {
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      info: '#007AFF',
    },
    gray: {
      50: '#F8F9FA',
      100: '#F1F3F4',
      200: '#E8EAED',
      300: '#DADCE0',
      400: '#BDC1C6',
      500: '#9AA0A6',
      600: '#80868B',
      700: '#5F6368',
      800: '#3C4043',
      900: '#202124',
    },
  },
  dark: {
    primary: '#29b1a9',
    secondary: '#8A8AFF',
    background: {
      primary: '#0F0F0F',
      secondary: '#1A1A1A',
      tertiary: '#2D2D2D',
    },
    surface: {
      primary: '#1A1A1A',
      secondary: '#2D2D2D',
      elevated: '#3C3C3C',
      header: '#242526', // Header background color for dark mode
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#E8EAED',
      tertiary: '#9AA0A6',
      inverse: '#1A1A1A',
    },
    border: {
      primary: '#3C4043',
      secondary: '#5F6368',
      focus: '#29b1a9',
    },
    status: {
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      info: '#007AFF',
    },
    gray: {
      50: '#202124',
      100: '#3C4043',
      200: '#5F6368',
      300: '#80868B',
      400: '#9AA0A6',
      500: '#BDC1C6',
      600: '#DADCE0',
      700: '#E8EAED',
      800: '#F1F3F4',
      900: '#F8F9FA',
    },
  },
  blue: {
    primary: '#1976D2',
    secondary: '#42A5F5',
    background: {
      primary: '#F5F9FF',
      secondary: '#E3F2FD',
      tertiary: '#BBDEFB',
    },
    surface: {
      primary: '#FFFFFF',
      secondary: '#F5F9FF',
      elevated: '#E3F2FD',
      header: '#FFFFFF', // Header background color for blue theme
    },
    text: {
      primary: '#0D47A1',
      secondary: '#1565C0',
      tertiary: '#42A5F5',
      inverse: '#FFFFFF',
    },
    border: {
      primary: '#BBDEFB',
      secondary: '#90CAF9',
      focus: '#1976D2',
    },
    status: {
      success: '#2E7D32',
      warning: '#F57C00',
      error: '#D32F2F',
      info: '#1976D2',
    },
    gray: {
      50: '#F5F9FF',
      100: '#E3F2FD',
      200: '#BBDEFB',
      300: '#90CAF9',
      400: '#64B5F6',
      500: '#42A5F5',
      600: '#2196F3',
      700: '#1E88E5',
      800: '#1976D2',
      900: '#1565C0',
    },
  },
  green: {
    primary: '#2E7D32',
    secondary: '#4CAF50',
    background: {
      primary: '#F1F8E9',
      secondary: '#E8F5E8',
      tertiary: '#C8E6C9',
    },
    surface: {
      primary: '#FFFFFF',
      secondary: '#F1F8E9',
      elevated: '#E8F5E8',
      header: '#FFFFFF', // Header background color for green theme
    },
    text: {
      primary: '#1B5E20',
      secondary: '#2E7D32',
      tertiary: '#4CAF50',
      inverse: '#FFFFFF',
    },
    border: {
      primary: '#C8E6C9',
      secondary: '#A5D6A7',
      focus: '#2E7D32',
    },
    status: {
      success: '#2E7D32',
      warning: '#F57C00',
      error: '#D32F2F',
      info: '#1976D2',
    },
    gray: {
      50: '#F1F8E9',
      100: '#E8F5E8',
      200: '#C8E6C9',
      300: '#A5D6A7',
      400: '#81C784',
      500: '#66BB6A',
      600: '#4CAF50',
      700: '#43A047',
      800: '#388E3C',
      900: '#2E7D32',
    },
  },
  purple: {
    primary: '#7B1FA2',
    secondary: '#9C27B0',
    background: {
      primary: '#F3E5F5',
      secondary: '#E1BEE7',
      tertiary: '#CE93D8',
    },
    surface: {
      primary: '#FFFFFF',
      secondary: '#F3E5F5',
      elevated: '#E1BEE7',
      header: '#FFFFFF', // Header background color for purple theme
    },
    text: {
      primary: '#4A148C',
      secondary: '#6A1B9A',
      tertiary: '#8E24AA',
      inverse: '#FFFFFF',
    },
    border: {
      primary: '#CE93D8',
      secondary: '#BA68C8',
      focus: '#7B1FA2',
    },
    status: {
      success: '#2E7D32',
      warning: '#F57C00',
      error: '#D32F2F',
      info: '#1976D2',
    },
    gray: {
      50: '#F3E5F5',
      100: '#E1BEE7',
      200: '#CE93D8',
      300: '#BA68C8',
      400: '#AB47BC',
      500: '#9C27B0',
      600: '#8E24AA',
      700: '#7B1FA2',
      800: '#6A1B9A',
      900: '#4A148C',
    },
  },
} as const;

export type ThemeType = keyof typeof themes;
export type ColorKey = keyof typeof colors;

// Helper function to get color with opacity
export const getColorWithOpacity = (color: string, opacity: number): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Export primary color for easy access
export const primaryColor = colors.primary; 