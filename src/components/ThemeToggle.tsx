import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ThemeToggle = () => {
  const { currentTheme, setTheme, toggleTheme, colors: themeColors } = useTheme();

  const themes = [
    { key: 'default', label: 'System', icon: 'settings' },
    { key: 'light', label: 'Light', icon: 'light-mode' },
    { key: 'dark', label: 'Dark', icon: 'dark-mode' },
    { key: 'blue', label: 'Blue', icon: 'palette' },
    { key: 'green', label: 'Green', icon: 'eco' },
    { key: 'purple', label: 'Purple', icon: 'color-lens' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface.primary }]}>
      <Text style={[styles.title, { color: themeColors.text.primary }]}>
        Theme Selection
      </Text>
      <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
        Choose your preferred theme
      </Text>
      
      <View style={styles.themeGrid}>
        {themes.map((theme) => (
          <TouchableOpacity
            key={theme.key}
            style={[
              styles.themeCard,
              { 
                backgroundColor: themeColors.surface.secondary,
                borderColor: currentTheme === theme.key ? themeColors.primary : themeColors.border.primary,
                borderWidth: currentTheme === theme.key ? 2 : 1,
              }
            ]}
            onPress={() => theme.key === 'default' ? toggleTheme() : setTheme(theme.key as any)}
          >
            <Icon 
              name={theme.icon} 
              size={24} 
              color={currentTheme === theme.key ? themeColors.primary : themeColors.text.secondary} 
            />
            <Text style={[
              styles.themeLabel,
              { color: currentTheme === theme.key ? themeColors.primary : themeColors.text.primary }
            ]}>
              {theme.label}
            </Text>
            {currentTheme === theme.key && (
              <Icon name="check-circle" size={20} color={themeColors.primary} style={styles.checkIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: themeColors.primary }]}
        onPress={toggleTheme}
      >
        <Text style={[styles.toggleButtonText, { color: themeColors.text.inverse }]}>
          Quick Toggle
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 12,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  themeCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  toggleButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ThemeToggle;
