import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
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
  isShareEmotion?: boolean;
  isShareLocation?: boolean;
  readReceipts?: boolean;
  typingIndicators?: boolean;
  messagePreview?: boolean;
  autoSaveDrafts?: boolean;
  chatBackground?: string | null;
  
  // Privacy Settings
  postVisibility?: string;
  friendRequestVisibility?: string;
  timelinePostVisibility?: string;
  
  // Notification Settings
  friendRequestReceived?: boolean;
  friendRequestAccepted?: boolean;
  newMessageReceived?: boolean;
  newFriendPost?: boolean;
  newFriendStory?: boolean;
  newFriendWatch?: boolean;
  friendRequestReceivedEmail?: boolean;
  friendRequestAcceptedEmail?: boolean;
  newMessageReceivedEmail?: boolean;
  newFriendPostEmail?: boolean;
  newFriendStoryEmail?: boolean;
  newFriendWatchEmail?: boolean;
  
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
    isShareEmotion: false,
    readReceipts: true,
    typingIndicators: true,
    messagePreview: true,
    autoSaveDrafts: true,
    chatBackground: null,
    postVisibility: 'public',
    friendRequestVisibility: 'public',
    timelinePostVisibility: 'public',
    friendRequestReceived: true,
    friendRequestAccepted: true,
    newMessageReceived: true,
    newFriendPost: true,
    newFriendStory: true,
    newFriendWatch: true,
    friendRequestReceivedEmail: false,
    friendRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
    newFriendPostEmail: false,
    newFriendStoryEmail: false,
    newFriendWatchEmail: false,
    themeMode: 'default',
    language: 'en',
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

  // Load settings from server and local storage
  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load from local storage first
      const localSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (localSettings) {
        const parsedSettings = JSON.parse(localSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }

      // Load from server if profile is available
      if (profile?._id) {
        const response = await api.get(`/setting?profileId=${profile._id}`);
        if (response.status === 200 && response.data) {
          const serverSettings = response.data;
          setSettings(prev => ({ ...prev, ...serverSettings }));
          // Update local storage with server data
          await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings, ...serverSettings }));
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
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      // Save to local storage immediately
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));

      // Save to server if profile is available
      if (profile?._id) {
        const response = await api.post('/setting/update', { [key]: value });
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
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      // Save to local storage immediately
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));

      // Save to server if profile is available
      if (profile?._id) {
        const response = await api.post('/setting/update', newSettings);
        if (response.status === 200) {
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
        isShareEmotion: true,
        readReceipts: true,
        typingIndicators: true,
        messagePreview: true,
        autoSaveDrafts: true,
        chatBackground: null,
        postVisibility: 'public',
        friendRequestVisibility: 'public',
        timelinePostVisibility: 'public',
        friendRequestReceived: true,
        friendRequestAccepted: true,
        newMessageReceived: true,
        newFriendPost: true,
        newFriendStory: true,
        newFriendWatch: true,
        friendRequestReceivedEmail: false,
        friendRequestAcceptedEmail: false,
        newMessageReceivedEmail: false,
        newFriendPostEmail: false,
        newFriendStoryEmail: false,
        newFriendWatchEmail: false,
        themeMode: 'default',
        language: 'en',
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
