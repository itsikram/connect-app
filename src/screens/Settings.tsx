import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import all settings components
import ProfileSettings from '../components/settings/ProfileSettings';
import PrivacySettings from '../components/settings/PrivacySettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import AccountSettings from '../components/settings/AccountSettings';
import PreferenceSettings from '../components/settings/PreferenceSettings';
import MessageSettings from '../components/settings/MessageSettings';
import SoundSettings from '../components/settings/SoundSettings';

const Settings = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', title: 'Profile', icon: 'person' },
    { id: 'privacy', title: 'Privacy', icon: 'security' },
    { id: 'notification', title: 'Notification', icon: 'notifications' },
    { id: 'account', title: 'Account', icon: 'account-circle' },
    { id: 'preference', title: 'Preference', icon: 'settings' },
    { id: 'message', title: 'Messaging', icon: 'message' },
    { id: 'sound', title: 'Sounds', icon: 'volume-up' },
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
              }
            ]}
            onPress={() => setActiveTab(tab.id)}
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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});

export default Settings;