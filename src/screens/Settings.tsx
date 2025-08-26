import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  useColorScheme,
  SafeAreaView,
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme/colors';
import ProfileSettings from '../components/settings/ProfileSettings';
import PrivacySettings from '../components/settings/PrivacySettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import AccountSettings from '../components/settings/AccountSettings';
import PreferenceSettings from '../components/settings/PreferenceSettings';
import MessageSettings from '../components/settings/MessageSettings';
import SoundSettings from '../components/settings/SoundSettings';

type TabType = 'profile' | 'privacy' | 'notification' | 'account' | 'preference' | 'message' | 'sound';

const Settings = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'person' },
    { key: 'privacy', label: 'Privacy', icon: 'security' },
    { key: 'notification', label: 'Notification', icon: 'notifications' },
    { key: 'account', label: 'Account', icon: 'account-circle' },
    { key: 'preference', label: 'Preference', icon: 'settings' },
    { key: 'message', label: 'Messaging', icon: 'message' },
    { key: 'sound', label: 'Sounds', icon: 'volume-up' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'privacy':
        return <PrivacySettings />;
      case 'notification':
        return <NotificationSettings />;
      case 'account':
        return <AccountSettings />;
      case 'preference':
        return <PreferenceSettings />;
      case 'message':
        return <MessageSettings />;
      case 'sound':
        return <SoundSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? colors.background.dark : colors.background.light }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDarkMode ? colors.border.dark : colors.border.light }]}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Settings
        </Text>
      </View>

      <View style={styles.content}>
        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && { 
                    backgroundColor: colors.primary,
                    borderColor: colors.primary 
                  }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Icon 
                  name={tab.icon} 
                  size={20} 
                  color={activeTab === tab.key ? colors.white : isDarkMode ? colors.text.light : colors.text.primary} 
                />
                <Text style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? colors.white : isDarkMode ? colors.text.light : colors.text.primary }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </View>
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
  },
  content: {
    flex: 1,
  },
  tabContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minWidth: 100,
    justifyContent: 'center',
  },
  tabLabel: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});

export default Settings;