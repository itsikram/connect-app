import React, { useCallback, useMemo, useState, Suspense, useTransition } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ProfileSettings = React.lazy(() => import('../components/settings/ProfileSettings'));
const PrivacySettings = React.lazy(() => import('../components/settings/PrivacySettings'));
const NotificationSettings = React.lazy(() => import('../components/settings/NotificationSettings'));
const AccountSettings = React.lazy(() => import('../components/settings/AccountSettings'));
const PreferenceSettings = React.lazy(() => import('../components/settings/PreferenceSettings'));
const MessageSettings = React.lazy(() => import('../components/settings/MessageSettings'));
const SoundSettings = React.lazy(() => import('../components/settings/SoundSettings'));
const TtsSettings = React.lazy(() => import('../components/settings/TtsSettings'));
const BackgroundSettings = React.lazy(() => import('../components/BackgroundNotificationTester'));

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  profile: ProfileSettings,
  privacy: PrivacySettings,
  notification: NotificationSettings,
  account: AccountSettings,
  preference: PreferenceSettings,
  message: MessageSettings,
  sound: SoundSettings,
  tts: TtsSettings,
  background: BackgroundSettings,
};

const Settings = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [isPending, startTransition] = useTransition();

  const tabs = useMemo(() => [
    { id: 'profile', title: 'Profile', icon: 'person' },
    { id: 'privacy', title: 'Privacy', icon: 'security' },
    { id: 'notification', title: 'Notification', icon: 'notifications' },
    { id: 'account', title: 'Account', icon: 'account-circle' },
    { id: 'preference', title: 'Preference', icon: 'settings' },
    { id: 'message', title: 'Messaging', icon: 'message' },
    { id: 'sound', title: 'Sounds', icon: 'volume-up' },
    { id: 'tts', title: 'TTS', icon: 'record-voice-over' },
    { id: 'background', title: 'Background', icon: 'background-replacement' },
  ], []);

  const activeLabel = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.title || 'Settings',
    [tabs, activeTab]
  );

  const handleTabPress = useCallback((tabId: string) => {
    if (tabId === activeTab) return;
    startTransition(() => setActiveTab(tabId));
  }, [activeTab, startTransition]);

  const ActiveComponent = useMemo(
    () => TAB_COMPONENTS[activeTab] || ProfileSettings,
    [activeTab]
  );

  const tabContent = useMemo(() => (
    <Suspense
      fallback={
        <View style={styles.suspenseFallback}>
          <ActivityIndicator size="small" color={themeColors.primary} />
          <Text style={{ marginTop: 8, color: themeColors.text.secondary }}>
            Loading {activeLabel} settings...
          </Text>
        </View>
      }
    >
      <ActiveComponent />
    </Suspense>
  ), [ActiveComponent, activeLabel, themeColors.primary, themeColors.text.secondary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border.primary }]}>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
          Settings
        </Text>
        <Text style={[styles.headerSubtitle, { color: themeColors.text.secondary }]}>
          Customize your app experience
        </Text>
      </View>

      {/* Tab Navigation */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={[styles.tabContainer, { borderBottomColor: themeColors.border.primary }]}
        contentContainerStyle={styles.tabContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { 
                borderBottomColor: themeColors.primary,
                borderBottomWidth: 2
              },
              isPending && activeTab === tab.id && { opacity: 0.6 }
            ]}
            onPress={() => handleTabPress(tab.id)}
          >
            <Icon 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? themeColors.primary : themeColors.text.secondary} 
            />
            <Text style={[
              styles.tabText,
              { 
                color: activeTab === tab.id ? themeColors.primary : themeColors.text.secondary 
              }
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView
        style={[styles.content, { opacity: isPending ? 0.85 : 1 }]}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {tabContent}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  tabContainer: {
    borderBottomWidth: 1,
    height: 40,
    maxHeight: 60,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    gap: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 80,
  },
  suspenseFallback: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Settings;