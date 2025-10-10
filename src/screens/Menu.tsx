import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Image, ScrollView } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useChessGame } from '../contexts/ChessGameContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppGrid from '../components/AppGrid';
import DeviceAppsGrid from '../components/DeviceAppsGrid';
import MixedAppsGrid from '../components/MixedAppsGrid';
import { sampleApps, AppItem } from '../data/appData';
import LudoGame from './LudoGame';
import LudoGameSVG from './LudoGameSVG';

const Menu = () => {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { colors: themeColors } = useTheme();
  const { isLudoGameActive, setLudoGameActive } = useLudoGame();
  const { isChessGameActive, setChessGameActive } = useChessGame();

  const goToProfile = () => {
    (navigation as any).navigate('MyProfile');
  };

  const goToSettings = () => {
    (navigation as any).navigate('Settings');
  };

  const handleAppPress = (app: AppItem) => {
    if (app.id === 'Ludu') {
      setLudoGameActive(true);
      return;
    }
    if (app.id === 'Chess') {
      setChessGameActive(true);
      return;
    }
    app.onPress?.();
  };

  const closeLudoGame = () => {
    setLudoGameActive(false);
  };

  if (isLudoGameActive) {
    return (
      <LudoGameSVG />
    );
  }

  if (isChessGameActive) {
    // Lazy import to avoid circular deps in RN require cycle
    const ChessGame = require('./ChessGame').default;
    return <ChessGame />;
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: themeColors.background.primary }]}
      showsVerticalScrollIndicator={true}
      bounces={true}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={[styles.title, { color: themeColors.text.primary }]}>Menu</Text>

      <View style={styles.section}>
        <TouchableOpacity style={[styles.item, { backgroundColor: themeColors.surface.primary }]} onPress={goToProfile}>
          <View style={styles.itemLeft}>
            {myProfile?.profilePic ? (
              <Image source={{ uri: myProfile.profilePic }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.surface.secondary }]}>
                <Icon name="person" size={24} color={themeColors.text.secondary} />
              </View>
            )}
          </View>
          <View style={styles.itemBody}>
            <Text style={[styles.itemTitle, { color: themeColors.text.primary }]}>{myProfile?.fullName || 'My Profile'}</Text>
            <Text style={[styles.itemSubtitle, { color: themeColors.text.secondary }]}>View your profile</Text>
          </View>
          <Icon name="chevron-right" size={20} color={themeColors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { backgroundColor: themeColors.surface.primary }]} onPress={goToSettings}>
          <View style={[styles.itemLeftIcon, { backgroundColor: themeColors.surface.secondary }]}>
            <Icon name="settings" size={22} color={themeColors.text.primary} />
          </View>
          <View style={styles.itemBody}>
            <Text style={[styles.itemTitle, { color: themeColors.text.primary }]}>Settings</Text>
            <Text style={[styles.itemSubtitle, { color: themeColors.text.secondary }]}>Account, privacy, notifications</Text>
          </View>
          <Icon name="chevron-right" size={20} color={themeColors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Button title="Logout" onPress={logout} color={themeColors.status.error} />
      </View>

      {/* Option 1: Separate sections for custom and device apps */}
      <AppGrid 
        apps={sampleApps.map(app => ({
          ...app,
          onPress: () => handleAppPress(app)
        }))} 
        title="Connect Apps"
        columns={4}
      />


      {/* Option 2: Mixed apps with tabs (uncomment to use instead of above) */}
      {/* 
      <MixedAppsGrid 
        title="Apps"
        columns={4}
        showCustomApps={true}
        showDeviceApps={true}
        maxDeviceApps={24}
      />
      */}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  item: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  itemLeft: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  itemLeftIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemBody: {
    flex: 1,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 1000,
  },
});

export default Menu; 