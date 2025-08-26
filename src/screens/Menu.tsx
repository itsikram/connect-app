import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Image } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Menu = () => {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { colors: themeColors } = useTheme();

  const goToProfile = () => {
    (navigation as any).navigate('MyProfile');
  };

  const goToSettings = () => {
    (navigation as any).navigate('Settings');
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
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
});

export default Menu; 