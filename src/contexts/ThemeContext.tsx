import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, ThemeType } from '../theme/colors';
import { theme } from '../theme/theme';

// Extended theme type that includes 'default'
type ExtendedThemeType = ThemeType | 'default';

interface ThemeContextType {
  currentTheme: ExtendedThemeType;
  setTheme: (theme: ThemeType) => void;
  isDarkMode: boolean;
  colors: typeof themes.light | typeof themes.dark | typeof themes.blue | typeof themes.green | typeof themes.purple;
  toggleTheme: () => void;
  // Extended theme properties
  typography: typeof theme.typography;
  borderRadius: typeof theme.borderRadius;
  spacing: typeof theme.spacing;
  shadows: typeof theme.shadows;
  animations: typeof theme.animations;
  gradients: typeof theme.gradients;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export { ThemeContext };

const THEME_STORAGE_KEY = '@app_theme';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [currentTheme, setCurrentTheme] = useState<ExtendedThemeType>('dark');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Load saved theme from storage
  useEffect(() => {
    loadSavedTheme();
  }, []);

  // Update dark mode when theme changes
  useEffect(() => {
    if (currentTheme === 'default') {
      setIsDarkMode(systemColorScheme === 'dark');
    } else if (currentTheme === 'dark') {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(false);
    }
  }, [currentTheme, systemColorScheme]);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'default' || themes[savedTheme as ThemeType])) {
        setCurrentTheme(savedTheme as ExtendedThemeType);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const setTheme = async (theme: ThemeType) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setCurrentTheme(theme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    if (currentTheme === 'light') {
      setTheme('dark');
    } else if (currentTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme(isDarkMode ? 'light' : 'dark');
    }
  };

  // Get current theme colors
  const getCurrentColors = () => {
    if (currentTheme === 'default') {
      return isDarkMode ? themes.dark : themes.light;
    }
    return themes[currentTheme];
  };

  const colors = getCurrentColors();

  const value: ThemeContextType = {
    currentTheme,
    setTheme,
    isDarkMode,
    colors,
    toggleTheme,
    typography: theme.typography,
    borderRadius: theme.borderRadius,
    spacing: theme.spacing,
    shadows: theme.shadows,
    animations: theme.animations,
    gradients: theme.gradients,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
