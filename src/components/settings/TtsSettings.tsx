import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { backgroundTtsService } from '../../lib/backgroundTtsService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TtsSettings {
  enabled: boolean;
  language: string;
  rate: number;
  volume: number;
  pitch: number;
}

const TtsSettings = () => {
  const { colors: themeColors } = useTheme();
  const { showSuccess, showError } = useToast();
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>({
    enabled: true,
    language: 'en-US',
    rate: 0.5,
    volume: 1.0,
    pitch: 1.0,
  });

  useEffect(() => {
    loadTtsSettings();
  }, []);

  const loadTtsSettings = async () => {
    try {
      const settings = backgroundTtsService.getSettings();
      setTtsSettings(settings);
    } catch (error) {
      console.error('Error loading TTS settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await backgroundTtsService.saveSettings(ttsSettings);
      showSuccess('TTS settings saved successfully');
    } catch (error) {
      console.error('Error saving TTS settings:', error);
      showError('Failed to save TTS settings');
    }
  };

  const handleTestTts = async () => {
    try {
      const testMessage = 'This is a test of the text to speech functionality.';
      await backgroundTtsService.speakMessage(testMessage, { priority: 'normal' });
    } catch (error) {
      console.error('Error testing TTS:', error);
      showError('Failed to test TTS');
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset TTS Settings',
      'Are you sure you want to reset all TTS settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setTtsSettings({
              enabled: true,
              language: 'en-US',
              rate: 0.5,
              volume: 1.0,
              pitch: 1.0,
            });
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background.primary,
    },
    scrollContainer: {
      flex: 1,
      padding: 20,
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.text.primary,
      marginBottom: 15,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 15,
      paddingHorizontal: 10,
      backgroundColor: themeColors.background.secondary,
      borderRadius: 10,
      marginBottom: 10,
    },
    settingLabel: {
      fontSize: 16,
      color: themeColors.text.primary,
      flex: 1,
    },
    settingDescription: {
      fontSize: 14,
      color: themeColors.text.secondary,
      marginTop: 5,
    },
    sliderContainer: {
      paddingVertical: 15,
      paddingHorizontal: 10,
      backgroundColor: themeColors.background.secondary,
      borderRadius: 10,
      marginBottom: 10,
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sliderValue: {
      fontSize: 16,
      color: themeColors.text.primary,
      fontWeight: 'bold',
      minWidth: 50,
      textAlign: 'right',
    },
    button: {
      backgroundColor: themeColors.primary,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: themeColors.text.inverse,
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    resetButton: {
      backgroundColor: '#FF5722',
    },
    testButton: {
      backgroundColor: '#4CAF50',
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Main TTS Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text-to-Speech Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Enable TTS</Text>
              <Text style={styles.settingDescription}>
                Enable text-to-speech for push notifications and messages
              </Text>
            </View>
            <Switch
              value={ttsSettings.enabled}
              onValueChange={(value) => setTtsSettings({ ...ttsSettings, enabled: value })}
              trackColor={{ false: themeColors.background.secondary, true: themeColors.primary }}
              thumbColor={ttsSettings.enabled ? themeColors.text.inverse : themeColors.text.secondary}
            />
          </View>
        </View>

        {/* Speech Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Speech Rate</Text>
          
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <Text style={styles.settingLabel}>Speed</Text>
              <Text style={styles.sliderValue}>
                {Math.round(ttsSettings.rate * 100)}%
              </Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0.1}
              maximumValue={1.0}
              step={0.1}
              value={ttsSettings.rate}
              onValueChange={(value: number) => setTtsSettings({ ...ttsSettings, rate: value })}
              minimumTrackTintColor={themeColors.primary}
              maximumTrackTintColor={themeColors.background.secondary}
            />
            <Text style={styles.settingDescription}>
              Adjust how fast the text is spoken (10% - 100%)
            </Text>
          </View>
        </View>

        {/* Volume */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume</Text>
          
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <Text style={styles.settingLabel}>Volume</Text>
              <Text style={styles.sliderValue}>
                {Math.round(ttsSettings.volume * 100)}%
              </Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0.0}
              maximumValue={1.0}
              step={0.1}
              value={ttsSettings.volume}
              onValueChange={(value: number) => setTtsSettings({ ...ttsSettings, volume: value })}
              minimumTrackTintColor={themeColors.primary}
              maximumTrackTintColor={themeColors.background.secondary}
            />
            <Text style={styles.settingDescription}>
              Adjust the volume of the speech (0% - 100%)
            </Text>
          </View>
        </View>

        {/* Pitch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pitch</Text>
          
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <Text style={styles.settingLabel}>Pitch</Text>
              <Text style={styles.sliderValue}>
                {Math.round(ttsSettings.pitch * 100)}%
              </Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.1}
              value={ttsSettings.pitch}
              onValueChange={(value: number) => setTtsSettings({ ...ttsSettings, pitch: value })}
              minimumTrackTintColor={themeColors.primary}
              maximumTrackTintColor={themeColors.background.secondary}
            />
            <Text style={styles.settingDescription}>
              Adjust the pitch of the voice (50% - 200%)
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.button, styles.testButton]} onPress={handleTestTts}>
            <Icon name="play-arrow" size={24} color={themeColors.text.inverse} />
            <Text style={styles.buttonText}>Test TTS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleSaveSettings}>
            <Icon name="save" size={24} color={themeColors.text.inverse} />
            <Text style={styles.buttonText}>Save Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleResetSettings}>
            <Icon name="refresh" size={24} color={themeColors.text.inverse} />
            <Text style={styles.buttonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.settingDescription}>
              • TTS works in the background even when the app is closed{'\n'}
              • Incoming calls will be announced with high priority{'\n'}
              • Messages and notifications will be spoken with normal priority{'\n'}
              • You can interrupt current speech by starting new speech{'\n'}
              • TTS requires notification permissions to work properly
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

export default TtsSettings;
