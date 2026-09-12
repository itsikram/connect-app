import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { persistRingtonePreference } from '../lib/ringtoneAssets';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface SettingsData {
  // Profile Settings
  firstName?: string;
  surname?: string;
  nickname?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  presentAddress?: string;
  permanentAddress?: string;
  workPlaces?: Array<{ name: string; designation: string }>;
  schools?: Array<{ name: string; degree: string }>;
  
  // Message Settings
  showTyping?: boolean;
  showIsTyping?: boolean;
  isShareEmotion?: boolean;
  isShareLocation?: boolean;
  readReceipts?: boolean;
  typingIndicators?: boolean;
  messagePreview?: boolean;
  autoSaveDrafts?: boolean;
  chatBackground?: string | null;
  connectChatSettings?: Record<string, any>;
  
  // Privacy Settings
  postVisibility?: string;
  connectRequestVisibility?: string;
  timelinePostVisibility?: string;
  
  // Notification Settings
  connectRequestReceived?: boolean;
  connectRequestAccepted?: boolean;
  newMessageReceived?: boolean;
  newConnectPost?: boolean;
  newConnectStory?: boolean;
  newConnectWatch?: boolean;
  connectRequestReceivedEmail?: boolean;
  connectRequestAcceptedEmail?: boolean;
  newMessageReceivedEmail?: boolean;
  newConnectPostEmail?: boolean;
  newConnectStoryEmail?: boolean;
  newConnectWatchEmail?: boolean;
  
  // Preference Settings
  themeMode?: string;
  language?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  
  // Sound Settings
  ringtone?: string;
  notificationSound?: string;
  messageSound?: string;
  vibrationEnabled?: boolean;
  silentMode?: boolean;
  volumeLevel?: number;
}

interface SettingsContextType {
  settings: SettingsData;
  loading: boolean;
  updateSetting: (key: string, value: any) => Promise<boolean>;
  updateSettings: (newSettings: Partial<SettingsData>) => Promise<boolean>;
  loadSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;
}

const normalizeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
};

const normalizeSettings = (value: Record<string, any>): Record<string, any> => ({
  ...value,
  isShareEmotion:
    normalizeBoolean(value.isShareEmotion) ||
    normalizeBoolean(value.isShareFaceMode) ||
    normalizeBoolean(value.shareFaceMode),
});

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = '@app_settings';

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const profile = useSelector((state: RootState) => state.profile);
  const [settings, setSettings] = useState<SettingsData>({
    // Default values
    showTyping: true,
    showIsTyping: true,
    isShareEmotion: false,
    isShareLocation: true,
    readReceipts: true,
    typingIndicators: true,
    messagePreview: true,
    autoSaveDrafts: true,
    chatBackground: null,
    connectChatSettings: {},
    postVisibility: 'public',
    connectRequestVisibility: 'public',
    timelinePostVisibility: 'public',
    connectRequestReceived: true,
    connectRequestAccepted: true,
    newMessageReceived: true,
    newConnectPost: true,
    newConnectStory: true,
    newConnectWatch: true,
    connectRequestReceivedEmail: false,
    connectRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
    newConnectPostEmail: false,
    newConnectStoryEmail: false,
    newConnectWatchEmail: false,
    themeMode: 'default',
    language: 'eng',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    ringtone: '1',
    notificationSound: '1',
    messageSound: '1',
    vibrationEnabled: true,
    silentMode: false,
    volumeLevel: 80,
  });
  const [loading, setLoading] = useState(false);
  const settingsRevisionRef = useRef(0);

  // Load settings from server and local storage
  const loadSettings = async () => {
    const loadRevision = settingsRevisionRef.current;
    try {
      setLoading(true);
      
      // Load from local storage first
      const localSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      let localNormalizedSettings: Record<string, any> | null = null;
      if (localSettings) {
        const parsedSettings = normalizeSettings(JSON.parse(localSettings));
        localNormalizedSettings = parsedSettings;
        setSettings(prev => ({ ...prev, ...parsedSettings }));
        if (parsedSettings?.ringtone != null) {
          persistRingtonePreference(parsedSettings.ringtone).catch(() => {});
        }
      }

      // Load from server if profile is available
      if (profile?._id) {
        const response = await api.get(`/setting?profileId=${profile._id}`);
        if (response.status === 200 && response.data) {
          const serverSettings = normalizeSettings(response.data);
          if (serverSettings.showIsTyping !== undefined && serverSettings.showTyping === undefined) {
            serverSettings.showTyping = serverSettings.showIsTyping;
          }
          if (serverSettings.showTyping !== undefined && serverSettings.showIsTyping === undefined) {
            serverSettings.showIsTyping = serverSettings.showTyping;
          }
          // Do not let a stale load response overwrite a toggle changed while
          // this request was in flight.
          if (settingsRevisionRef.current !== loadRevision) {
            console.log('[Settings] Ignoring stale server settings response after local update');
            return;
          }
          const mergedSettings = {
            ...serverSettings,
            // Keep a locally enabled face-mode preference when an older server
            // record still reports the legacy/default false value.
            isShareEmotion:
              localNormalizedSettings?.isShareEmotion === true ||
              serverSettings.isShareEmotion === true,
          };
          setSettings(prev => ({ ...prev, ...mergedSettings }));
          if (serverSettings.ringtone != null) {
            persistRingtonePreference(serverSettings.ringtone).catch(() => {});
          }
          // Update local storage with server data
          await AsyncStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify({ ...settings, ...mergedSettings }),
          );
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update a single setting
  const updateSetting = async (key: string, value: any): Promise<boolean> => {
    try {
      const normalizedValue = key === 'isShareEmotion'
        ? normalizeBoolean(value)
        : value;
      const newSettings = { ...settings, [key]: normalizedValue };
      setSettings(newSettings);

      // Save to local storage immediately
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      if (key === 'ringtone') {
        await persistRingtonePreference(value);
      }

      // Save to server if profile is available
      if (profile?._id) {
        const response = await api.post('/setting/update', { [key]: normalizedValue });
        if (response.status === 200) {
          return true;
        }
      }
      return true;
    } catch (error) {
      console.error('Error updating setting:', error);
      return false;
    }
  };

  // Update multiple settings
  const updateSettings = async (newSettings: Partial<SettingsData>): Promise<boolean> => {
    try {
      settingsRevisionRef.current += 1;
      const syncedSettings = normalizeSettings({ ...newSettings });
      if (syncedSettings.showIsTyping !== undefined) {
        syncedSettings.showTyping = syncedSettings.showIsTyping;
      } else if (syncedSettings.showTyping !== undefined) {
        syncedSettings.showIsTyping = syncedSettings.showTyping;
      }
      const updatedSettings = { ...settings, ...syncedSettings };
      setSettings(updatedSettings);

      // Save to local storage immediately
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      if (updatedSettings.ringtone != null) {
        await persistRingtonePreference(updatedSettings.ringtone);
      }

      // Save to server if profile is available
      if (profile?._id) {
        const response = await api.post('/setting/update', syncedSettings);
        if (response.status === 200) {
          console.log('[Settings] Persisted settings update:', {
            profileId: profile._id,
            isShareEmotion: syncedSettings.isShareEmotion,
          });
          return true;
        }
      }
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  };

  // Reset settings to defaults
  const resetSettings = async () => {
    try {
      const defaultSettings: SettingsData = {
        showTyping: true,
        showIsTyping: true,
        isShareEmotion: false,
        isShareLocation: true,
        readReceipts: true,
        typingIndicators: true,
        messagePreview: true,
        autoSaveDrafts: true,
        chatBackground: null,
        connectChatSettings: {},
        postVisibility: 'public',
        connectRequestVisibility: 'public',
        timelinePostVisibility: 'public',
        connectRequestReceived: true,
        connectRequestAccepted: true,
        newMessageReceived: true,
        newConnectPost: true,
        newConnectStory: true,
        newConnectWatch: true,
        connectRequestReceivedEmail: false,
        connectRequestAcceptedEmail: false,
        newMessageReceivedEmail: false,
        newConnectPostEmail: false,
        newConnectStoryEmail: false,
        newConnectWatchEmail: false,
        themeMode: 'default',
        language: 'eng',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        ringtone: '1',
        notificationSound: '1',
        messageSound: '1',
        vibrationEnabled: true,
        silentMode: false,
        volumeLevel: 80,
      };
      
      setSettings(defaultSettings);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
      await persistRingtonePreference(defaultSettings.ringtone);
      
      if (profile?._id) {
        await api.post('/setting/update', defaultSettings);
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  };

  // Load settings when profile changes
  useEffect(() => {
    if (profile?._id) {
      loadSettings();
    }
  }, [profile?._id]);

  const value: SettingsContextType = {
    settings,
    loading,
    updateSetting,
    updateSettings,
    loadSettings,
    resetSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
