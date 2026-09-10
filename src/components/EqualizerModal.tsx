/**
 * Professional equalizer control component for audio visualization and adjustment.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import {
  EQUALIZER_BANDS,
  BAND_RANGE,
  GAIN_RANGE,
  EqualizerState,
  EqualizerPreset,
} from '../utils/audioEqualizerUtils';

interface EqualizerModalProps {
  visible: boolean;
  onClose: () => void;
  state: EqualizerState;
  presets: EqualizerPreset[];
  onStateUpdate: (updates: Partial<EqualizerState>) => void;
  onLoadPreset: (presetId: string) => void;
  onResetToDefaults: () => void;
  isSupported: boolean;
  theme: {
    text: string;
    muted: string;
    background: string;
    surface: string;
    primary: string;
    border: string;
    overlay: string;
  };
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  presetBtn: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetBtnActive: {
    borderWidth: 2,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  presetBtnDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  equalizerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  bandLabel: {
    width: 50,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  sliderContainer: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
    justifyContent: 'center',
  },
  bandValue: {
    width: 35,
    fontSize: 11,
    textAlign: 'right',
    fontWeight: '500',
  },
  gainSection: {
    marginBottom: 20,
  },
  gainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  gainLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  gainSliderContainer: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
    justifyContent: 'center',
  },
  gainValue: {
    width: 35,
    fontSize: 11,
    textAlign: 'right',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unsupportedMsg: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
});

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  visible,
  onClose,
  state,
  presets,
  onStateUpdate,
  onLoadPreset,
  onResetToDefaults,
  isSupported,
  theme,
}) => {
  if (!isSupported) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.surface }]}>
          <View style={[styles.container, { backgroundColor: theme.surface }]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Equalizer</Text>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Icon name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <Text style={[styles.unsupportedMsg, { color: theme.muted }]}>
              Audio equalizer is available on web and desktop platforms.{'\n\n'}On mobile native platforms, use your system volume controls.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modal, { backgroundColor: theme.surface }]}>
        <ScrollView
          style={[styles.container, { backgroundColor: theme.surface }]}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Equalizer</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Icon name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          {/* Enable/Disable Toggle */}
          <View style={[styles.toggleRow, { backgroundColor: theme.background + '30' }]}>
            <Text style={[{ fontSize: 13, fontWeight: '500' }, { color: theme.text }]}>Enabled</Text>
            <Pressable
              style={[
                styles.toggleSwitch,
                { backgroundColor: state.enabled ? theme.primary : theme.border },
              ]}
              onPress={() => onStateUpdate({ enabled: !state.enabled })}
            >
              <View
                style={[
                  styles.toggleThumb,
                  {
                    marginLeft: state.enabled ? 24 : 2,
                    backgroundColor: theme.text,
                  },
                ]}
              />
            </Pressable>
          </View>

          {/* Preset Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Presets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={[styles.presetGrid, { flexDirection: 'row', flexWrap: 'nowrap' }]}>
                {presets.map((preset) => (
                  <Pressable
                    key={preset.id}
                    onPress={() => onLoadPreset(preset.id)}
                    style={[
                      styles.presetBtn,
                      { minWidth: 110, borderColor: theme.border, backgroundColor: theme.background },
                      state.preset === preset.id && [
                        styles.presetBtnActive,
                        { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        { color: state.preset === preset.id ? theme.primary : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {preset.name}
                    </Text>
                    {preset.description && (
                      <Text
                        style={[
                          styles.presetBtnDesc,
                          { color: state.preset === preset.id ? theme.primary : theme.muted },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.description}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Frequency Bands */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Frequency Bands</Text>
            {EQUALIZER_BANDS.map((band, idx) => (
              <View key={band.id} style={styles.equalizerRow}>
                <Text style={[styles.bandLabel, { color: theme.text }]}>{band.label}</Text>
                <View style={styles.sliderContainer}>
                  <Slider
                    style={{ flex: 1 }}
                    minimumValue={BAND_RANGE.min}
                    maximumValue={BAND_RANGE.max}
                    step={BAND_RANGE.step}
                    value={state.bands[idx] || 0}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.border}
                    thumbTintColor={theme.primary}
                    onValueChange={(value) => {
                      const newBands = [...state.bands];
                      newBands[idx] = value;
                      onStateUpdate({ bands: newBands, preset: 'custom' });
                    }}
                  />
                </View>
                <Text
                  style={[
                    styles.bandValue,
                    {
                      color: state.bands[idx] > 0 ? theme.primary : state.bands[idx] < 0 ? theme.muted : theme.text,
                    },
                  ]}
                >
                  {state.bands[idx] > 0 ? '+' : ''}{state.bands[idx].toFixed(0)} dB
                </Text>
              </View>
            ))}
          </View>

          {/* Master Gain */}
          <View style={styles.gainSection}>
            <View style={styles.gainRow}>
              <Text style={[styles.gainLabel, { color: theme.text }]}>Master Gain</Text>
              <View style={styles.gainSliderContainer}>
                <Slider
                  style={{ flex: 1 }}
                  minimumValue={GAIN_RANGE.min}
                  maximumValue={GAIN_RANGE.max}
                  step={GAIN_RANGE.step}
                  value={state.gain}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                  onValueChange={(value) => onStateUpdate({ gain: value })}
                />
              </View>
              <Text
                style={[
                  styles.gainValue,
                  {
                    color: state.gain > 0 ? theme.primary : state.gain < 0 ? theme.muted : theme.text,
                  },
                ]}
              >
                {state.gain > 0 ? '+' : ''}{state.gain.toFixed(1)} dB
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
              onPress={onResetToDefaults}
            >
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Reset</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}
              onPress={onClose}
            >
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default EqualizerModal;
