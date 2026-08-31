import React, { useCallback, useMemo, useState, Suspense, useTransition } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
const CacheSettings = React.lazy(() => import('../components/settings/CacheSettings'));

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  profile: ProfileSettings,
  privacy: PrivacySettings,
  notification: NotificationSettings,
  account: AccountSettings,
  preference: PreferenceSettings,
  message: MessageSettings,
  sound: SoundSettings,
  cache: CacheSettings,
};

const SETTINGS_NAV = [
  { id: 'profile', title: 'Profile', icon: 'person' },
  { id: 'privacy', title: 'Privacy', icon: 'security' },
  { id: 'notification', title: 'Notifications', icon: 'notifications' },
  { id: 'account', title: 'Account', icon: 'account-box' },
  { id: 'preference', title: 'Preferences', icon: 'tune' },
  { id: 'message', title: 'Messaging', icon: 'chat' },
  { id: 'sound', title: 'Sounds', icon: 'volume-up' },
  { id: 'cache', title: 'Cache', icon: 'storage' },
];

const Settings = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [isPending, startTransition] = useTransition();

  const activeLabel = useMemo(
    () => SETTINGS_NAV.find((tab) => tab.id === activeTab)?.title || 'Settings',
    [activeTab]
  );

  const handleTabPress = useCallback((tabId: string) => {
    if (tabId === activeTab) return;
    startTransition(() => setActiveTab(tabId));
  }, [activeTab, startTransition]);

  const ActiveComponent = TAB_COMPONENTS[activeTab] || ProfileSettings;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={styles.shell}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            Settings
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.text.secondary }]}>
            Manage your profile, privacy, notifications, and app preferences.
          </Text>
        </View>

        <View
          style={[
            styles.navPanel,
            {
              backgroundColor: themeColors.surface.primary,
              borderColor: themeColors.border.primary,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navContent}
          >
            {SETTINGS_NAV.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.navItem,
                    isActive && {
                      backgroundColor: themeColors.primary + '1F',
                    },
                    isPending && isActive && { opacity: 0.6 },
                  ]}
                  onPress={() => handleTabPress(tab.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <View
                    style={[
                      styles.navIcon,
                      {
                        backgroundColor: isActive
                          ? themeColors.primary + '2E'
                          : themeColors.surface.secondary,
                      },
                    ]}
                  >
                    <Icon
                      name={tab.icon}
                      size={16}
                      color={isActive ? themeColors.primary : themeColors.text.secondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: isActive ? themeColors.text.primary : themeColors.text.secondary,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.pageScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View
            style={[
              styles.contentPanel,
              {
                backgroundColor: themeColors.surface.primary,
                borderColor: themeColors.border.primary,
                opacity: isPending ? 0.85 : 1,
              },
            ]}
            accessibilityLabel={activeLabel}
          >
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
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  navPanel: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  navContent: {
    gap: 6,
  },
  navItem: {
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 12,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    flexGrow: 0,
    paddingBottom: 24,
  },
  contentPanel: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 16,
  },
  suspenseFallback: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Settings;
