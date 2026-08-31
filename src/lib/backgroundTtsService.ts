import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSpeakPayload, stopSpokenPlayback } from './speakMessagePlayback';

interface TtsSettings {
  enabled: boolean;
  language: string;
  rate: number;
  volume: number;
  pitch: number;
}

class BackgroundTtsService {
  private isInitialized = false;
  private isSpeaking = false;
  private settings: TtsSettings = {
    enabled: true,
    language: 'en-US',
    rate: 1,
    volume: 1.0,
    pitch: 1.0,
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.loadSettings();
    this.isInitialized = true;
  }

  private async loadSettings(): Promise<void> {
    try {
      const settingsJson = await AsyncStorage.getItem('ttsSettings');
      if (settingsJson) {
        this.settings = { ...this.settings, ...JSON.parse(settingsJson) };
      }
    } catch (error) {
      console.error('Error loading TTS settings:', error);
    }
  }

  async saveSettings(settings: Partial<TtsSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await AsyncStorage.setItem('ttsSettings', JSON.stringify(this.settings));
  }

  async speakMessage(message: string, options?: {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
  }): Promise<void> {
    await this.initialize();
    if (!this.settings.enabled || !message.trim()) return;

    const interrupt = options?.interrupt !== false;
    if (interrupt) {
      await Speech.stop();
    }

    this.isSpeaking = true;
    const rate = options?.priority === 'high'
      ? Math.max(0.5, this.settings.rate * 0.9)
      : this.settings.rate;

    await Speech.speak(message, {
      language: this.settings.language || 'en-US',
      pitch: this.settings.pitch || 1,
      rate: rate || 1,
      onDone: () => {
        this.isSpeaking = false;
      },
      onStopped: () => {
        this.isSpeaking = false;
      },
      onError: () => {
        this.isSpeaking = false;
      },
    });
  }

  async speakNotification(title: string, body: string, options?: {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
  }): Promise<void> {
    await this.speakMessage(`${title}. ${body}`, options);
  }

  async speakIncomingCall(callerName: string, isAudio: boolean): Promise<void> {
    const callType = isAudio ? 'audio' : 'video';
    await this.speakMessage(`Incoming ${callType} call from ${callerName}`, {
      priority: 'high',
      interrupt: true,
    });
  }

  async speakNewMessage(senderName: string, message: string): Promise<void> {
    const truncatedMessage = message.length > 50 ? `${message.substring(0, 50)}...` : message;
    await this.speakMessage(`New message from ${senderName}: ${truncatedMessage}`, {
      priority: 'normal',
      interrupt: false,
    });
  }

  async speakPayload(payload: any): Promise<void> {
    await this.initialize();
    if (!this.settings.enabled) return;
    await playSpeakPayload(payload);
  }

  async stopSpeaking(): Promise<void> {
    await stopSpokenPlayback();
    this.isSpeaking = false;
  }

  getSettings(): TtsSettings {
    return { ...this.settings };
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  async destroy(): Promise<void> {
    await this.stopSpeaking();
    this.isInitialized = false;
  }
}

export const backgroundTtsService = new BackgroundTtsService();

export default backgroundTtsService;
