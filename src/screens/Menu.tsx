import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useChessGame } from '../contexts/ChessGameContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import VoiceTextInput from '../components/VoiceTextInput';
import AppGrid from '../components/AppGrid';
import ProfileImage from '../components/ProfileImage';
import { sampleApps, AppItem } from '../data/appData';
import LudoGameSVG from './LudoGameSVG';

const WORKING_APP_IDS = new Set([
  'Ludu',
  'Chess',
  'cricbuzz',
  'mediaPlayer',
  'camera',
  'gallery',
  'downloads',
  'facebook',
  'youtube',
  'vpnBrowser',
  'maps',
  'contacts',
]);

const APP_SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'Games', ids: ['Ludu', 'Chess', 'cricbuzz'] },
  { title: 'Media', ids: ['mediaPlayer', 'youtube', 'camera', 'gallery', 'downloads', 'facebook'] },
  { title: 'Tools', ids: ['vpnBrowser', 'maps', 'contacts'] },
];

const Menu = () => {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { colors: themeColors, isDarkMode } = useTheme();
  const { isLudoGameActive, setLudoGameActive } = useLudoGame();
  const { isChessGameActive, setChessGameActive } = useChessGame();
  const [query, setQuery] = useState('');
  const [showComingSoon, setShowComingSoon] = useState(false);

  const friendsCount = Array.isArray(myProfile?.friends) ? myProfile.friends.length : 0;
  const normalizedQuery = query.trim().toLowerCase();

  const goToProfile = () => {
    (navigation as any).navigate('MyProfile');
  };

  const goToSettings = () => {
    (navigation as any).navigate('Settings');
  };

  const handleAppPress = useCallback((app: AppItem) => {
    if (app.id === 'Ludu') {
      setLudoGameActive(true);
      return;
    }
    if (app.id === 'Chess') {
      setChessGameActive(true);
      return;
    }
    if (app.id === 'camera') {
      (navigation as any).navigate('Home', { screen: 'Camera' });
      return;
    }
    if (app.id === 'gallery') {
      (navigation as any).navigate('Home', { screen: 'Gallery' });
      return;
    }
    if (app.id === 'mediaPlayer') {
      (navigation as any).navigate('Menu', { screen: 'MediaPlayer' });
      return;
    }
    if (app.id === 'facebook') {
      (navigation as any).navigate('Menu', { screen: 'Facebook' });
      return;
    }
    if (app.id === 'youtube') {
      (navigation as any).navigate('Menu', { screen: 'YouTube' });
      return;
    }
    if (app.id === 'vpnBrowser') {
      (navigation as any).navigate('VpnBrowser');
      return;
    }
    if (app.id === 'maps') {
      (navigation as any).navigate('Menu', { screen: 'GoogleMaps' });
      return;
    }
    if (app.id === 'contacts') {
      (navigation as any).navigate('Menu', { screen: 'GoogleContacts' });
      return;
    }
    if (app.id === 'cricbuzz') {
      (navigation as any).navigate('Menu', { screen: 'Cricbuzz' });
      return;
    }
    if (app.id === 'downloads') {
      (navigation as any).navigate('Menu', { screen: 'Downloads' });
      return;
    }
    if (app.id === 'settings') {
      (navigation as any).navigate('Settings');
      return;
    }
    Alert.alert('Coming soon', `${app.name} is not available in Connect yet.`);
  }, [navigation, setLudoGameActive, setChessGameActive]);

  const appsWithActions = useMemo(
    () =>
      sampleApps.map((app) => ({
        ...app,
        onPress: () => handleAppPress(app),
      })),
    [handleAppPress]
  );

  const matchesQuery = (app: AppItem) =>
    !normalizedQuery || app.name.toLowerCase().includes(normalizedQuery);

  const sectionApps = useMemo(() => {
    return APP_SECTIONS.map((section) => ({
      ...section,
      apps: appsWithActions.filter((app) => section.ids.includes(app.id) && matchesQuery(app)),
    })).filter((section) => section.apps.length > 0);
  }, [appsWithActions, normalizedQuery]);

  const comingSoonApps = useMemo(
    () =>
      appsWithActions.filter(
        (app) => !WORKING_APP_IDS.has(app.id) && app.id !== 'settings' && matchesQuery(app)
      ),
    [appsWithActions, normalizedQuery]
  );

  const handleLogout = () => {
    Alert.alert('Log out', 'You will need to sign in again to use your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  if (isLudoGameActive) {
    return <LudoGameSVG />;
  }

  if (isChessGameActive) {
    const ChessGame = require('./ChessGame').default;
    return <ChessGame />;
  }

  const shortcuts = [
    { id: 'settings', label: 'Settings', hint: 'Privacy & account', icon: 'settings', color: '#607D8B', onPress: goToSettings },
    { id: 'friends', label: 'Friends', hint: 'People you know', icon: 'people', color: '#2196F3', onPress: () => (navigation as any).navigate('Friends') },
    { id: 'messages', label: 'Messages', hint: 'Chats & calls', icon: 'chat', color: '#9C27B0', onPress: () => (navigation as any).navigate('Message') },
    { id: 'downloads', label: 'Downloads', hint: 'Saved videos', icon: 'download', color: '#009688', onPress: () => (navigation as any).navigate('Menu', { screen: 'Downloads' }) },
    { id: 'tasks', label: 'Tasks', hint: 'Keep track of work', icon: 'checklist', color: '#10B981', onPress: () => (navigation as any).navigate('Menu', { screen: 'Tasks' }) },
  ];

  const showComingSoonSection = comingSoonApps.length > 0 && (showComingSoon || Boolean(normalizedQuery));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background.primary }]} edges={[]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text.primary }]}>Menu</Text>
          <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
            Profile, shortcuts, and apps
          </Text>
        </View>

        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: themeColors.surface.primary,
              borderColor: themeColors.border.primary,
            },
          ]}
        >
          <Icon name="search" size={20} color={themeColors.text.tertiary} />
          <VoiceTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={themeColors.text.tertiary}
            style={[styles.searchInput, { color: themeColors.text.primary }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search apps"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={18} color={themeColors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {!user && (
          <View
            style={[
              styles.welcomeCard,
              {
                backgroundColor: themeColors.surface.primary,
                borderColor: themeColors.border.primary,
              },
            ]}
          >
            <View style={[styles.welcomeIcon, { backgroundColor: themeColors.primary + '22' }]}>
              <Icon name="favorite" size={22} color={themeColors.primary} />
            </View>
            <Text style={[styles.welcomeTitle, { color: themeColors.text.primary }]}>
              Welcome to Connect
            </Text>
            <Text style={[styles.welcomeText, { color: themeColors.text.secondary }]}>
              Log in to see your profile, chat with friends, and sync your settings.
            </Text>
            <View style={styles.welcomeActions}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: themeColors.primary }]}
                onPress={() => (navigation as any).navigate('Login')}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: themeColors.surface.secondary }]}
                onPress={() => (navigation as any).navigate('Register')}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryBtnText, { color: themeColors.text.primary }]}>
                  Create account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {user && !normalizedQuery && (
          <>
            <Pressable
              onPress={goToProfile}
              accessibilityRole="button"
              accessibilityLabel="View your profile"
              style={({ pressed }) => [
                styles.profileCard,
                {
                  backgroundColor: themeColors.surface.primary,
                  borderColor: themeColors.border.primary,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={styles.profileAvatarWrap}>
                {myProfile?.profilePic ? (
                  <ProfileImage uri={myProfile.profilePic} pixelSize={112} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.surface.secondary }]}>
                    <Icon name="person" size={28} color={themeColors.text.secondary} />
                  </View>
                )}
              </View>
              <View style={styles.profileBody}>
                <Text style={[styles.profileName, { color: themeColors.text.primary }]} numberOfLines={1}>
                  {myProfile?.fullName || 'My Profile'}
                </Text>
                <Text style={[styles.profileHint, { color: themeColors.text.secondary }]}>
                  {friendsCount > 0 ? `See your profile · ${friendsCount} friends` : 'See your profile'}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={themeColors.text.tertiary} />
            </Pressable>

            <View style={styles.shortcutGrid}>
              {shortcuts.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={({ pressed }) => [
                    styles.shortcutCard,
                    {
                      backgroundColor: themeColors.surface.primary,
                      borderColor: themeColors.border.primary,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View style={[styles.shortcutIcon, { backgroundColor: item.color + '22' }]}>
                    <Icon name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.shortcutLabel, { color: themeColors.text.primary }]}>{item.label}</Text>
                  <Text style={[styles.shortcutHint, { color: themeColors.text.tertiary }]} numberOfLines={1}>
                    {item.hint}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {sectionApps.length === 0 && comingSoonApps.length === 0 && normalizedQuery ? (
          <View
            style={[
              styles.emptySearch,
              {
                backgroundColor: themeColors.surface.primary,
                borderColor: themeColors.border.primary,
              },
            ]}
          >
            <Icon name="search" size={28} color={themeColors.text.tertiary} />
            <Text style={[styles.emptySearchTitle, { color: themeColors.text.primary }]}>No matching apps</Text>
            <Text style={[styles.emptySearchText, { color: themeColors.text.secondary }]}>
              Try a different name, like Camera or Chess.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.appsPanel,
              {
                backgroundColor: themeColors.surface.primary,
                borderColor: themeColors.border.primary,
              },
            ]}
          >
            {sectionApps.map((section) => (
              <AppGrid key={section.title} title={section.title} apps={section.apps} columns={4} />
            ))}

            {comingSoonApps.length > 0 && !normalizedQuery && (
              <TouchableOpacity
                style={styles.moreToggle}
                onPress={() => setShowComingSoon((open) => !open)}
                accessibilityRole="button"
              >
                <Text style={[styles.moreToggleText, { color: themeColors.primary }]}>
                  {showComingSoon ? 'Hide more apps' : `More apps (${comingSoonApps.length})`}
                </Text>
                <Icon
                  name={showComingSoon ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={themeColors.primary}
                />
              </TouchableOpacity>
            )}

            {showComingSoonSection && (
              <View style={styles.comingSoonWrap}>
                <AppGrid title={normalizedQuery ? 'Other apps' : 'Coming soon'} apps={comingSoonApps} columns={4} />
              </View>
            )}
          </View>
        )}

        {user && (
          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [
              styles.logoutRow,
              {
                backgroundColor: themeColors.surface.primary,
                borderColor: themeColors.border.primary,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={[styles.logoutIcon, { backgroundColor: themeColors.status.error + '22' }]}>
              <Icon name="logout" size={20} color={themeColors.status.error} />
            </View>
            <Text style={[styles.logoutText, { color: themeColors.status.error }]}>Log out</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 46,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  welcomeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  welcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  welcomeText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  welcomeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#041018',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  profileAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBody: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  profileHint: {
    fontSize: 13,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  shortcutCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '47%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shortcutLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  shortcutHint: {
    marginTop: 2,
    fontSize: 12,
  },
  appsPanel: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
    marginBottom: 14,
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 4,
  },
  moreToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  comingSoonWrap: {
    opacity: 0.72,
  },
  emptySearch: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySearchText: {
    fontSize: 13,
    textAlign: 'center',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 56,
  },
  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Menu;
