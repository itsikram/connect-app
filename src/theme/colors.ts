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

// Type for color keys
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