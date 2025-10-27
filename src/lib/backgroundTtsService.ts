import Tts from 'react-native-tts';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    language: 'bn-IN',
    rate: 0.5,
    volume: 1.0,
    pitch: 1.0,
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load settings from storage
      await this.loadSettings();
      
      // Configure TTS
      await Tts.setDefaultLanguage(this.settings.language);
      await Tts.setDefaultRate(this.settings.rate);
      
      // Set up event listeners
      Tts.addEventListener('tts-start', this.onTtsStart);
      Tts.addEventListener('tts-finish', this.onTtsFinish);
      Tts.addEventListener('tts-cancel', this.onTtsCancel);
      Tts.addEventListener('tts-error', this.onTtsError);

      this.isInitialized = true;
      console.log('🎤 Background TTS Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Background TTS Service:', error);
    }
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
    try {
      this.settings = { ...this.settings, ...settings };
      await AsyncStorage.setItem('ttsSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving TTS settings:', error);
    }
  }

  async speakMessage(message: string, options?: {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
  }): Promise<void> {
    if (!this.settings.enabled || !message.trim()) {
      console.log('🎤 TTS disabled or empty message, skipping');
      return;
    }

    try {
      // Stop current speech if interrupting is allowed
      if (options?.interrupt !== false && this.isSpeaking) {
        await Tts.stop();
      }

      // Wait a bit if we just stopped speech
      if (options?.interrupt !== false && this.isSpeaking) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
      }

      // Configure TTS based on priority
      const rate = options?.priority === 'high' ? this.settings.rate * 0.8 : this.settings.rate;
      await Tts.setDefaultRate(rate);

      console.log('🎤 Speaking message:', message.substring(0, 50) + '...');
      await Tts.speak(message);
    } catch (error) {
      console.error('❌ Error speaking message:', error);
    }
  }

  async speakNotification(title: string, body: string, options?: {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
  }): Promise<void> {
    const message = `${title}. ${body}`;
    await this.speakMessage(message, options);
  }

  async speakIncomingCall(callerName: string, isAudio: boolean): Promise<void> {
    const callType = isAudio ? 'audio' : 'video';
    const message = `Incoming ${callType} call from ${callerName}`;
    await this.speakMessage(message, { priority: 'high', interrupt: true });
  }

  async speakNewMessage(senderName: string, message: string): Promise<void> {
    const truncatedMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
    const fullMessage = `New message from ${senderName}: ${truncatedMessage}`;
    await this.speakMessage(fullMessage, { priority: 'normal', interrupt: false });
  }

  async stopSpeaking(): Promise<void> {
    try {
      await Tts.stop();
      console.log('🎤 TTS stopped');
    } catch (error) {
      console.error('❌ Error stopping TTS:', error);
    }
  }

  private onTtsStart = (): void => {
    this.isSpeaking = true;
    console.log('🎤 TTS started speaking');
  };

  private onTtsFinish = (): void => {
    this.isSpeaking = false;
    console.log('🎤 TTS finished speaking');
  };

  private onTtsCancel = (): void => {
    this.isSpeaking = false;
    console.log('🎤 TTS cancelled');
  };

  private onTtsError = (error: any): void => {
    this.isSpeaking = false;
    console.error('❌ TTS error:', error);
  };

  getSettings(): TtsSettings {
    return { ...this.settings };
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  async destroy(): Promise<void> {
    try {
      await Tts.stop();
      Tts.removeEventListener('tts-start', this.onTtsStart);
      Tts.removeEventListener('tts-finish', this.onTtsFinish);
      Tts.removeEventListener('tts-cancel', this.onTtsCancel);
      Tts.removeEventListener('tts-error', this.onTtsError);
      this.isInitialized = false;
      console.log('🎤 Background TTS Service destroyed');
    } catch (error) {
      console.error('❌ Error destroying Background TTS Service:', error);
    }
  }
}

// Create singleton instance
export const backgroundTtsService = new BackgroundTtsService();

export default backgroundTtsService;
