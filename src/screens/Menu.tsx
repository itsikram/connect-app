import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Image } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Menu = () => {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile);

  const goToProfile = () => {
    (navigation as any).navigate('MyProfile');
  };

  const goToSettings = () => {
    (navigation as any).navigate('Settings');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu</Text>

      <View style={styles.section}>
        <TouchableOpacity style={styles.item} onPress={goToProfile}>
          <View style={styles.itemLeft}>
            {myProfile?.profilePic ? (
              <Image source={{ uri: myProfile.profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="person" size={24} color={colors.gray[700]} />
              </View>
            )}
          </View>
          <View style={styles.itemBody}>
            <Text style={styles.itemTitle}>{myProfile?.fullName || 'My Profile'}</Text>
            <Text style={styles.itemSubtitle}>View your profile</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.gray[500]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={goToSettings}>
          <View style={styles.itemLeftIcon}>
            <Icon name="settings" size={22} color={colors.gray[800]} />
          </View>
          <View style={styles.itemBody}>
            <Text style={styles.itemTitle}>Settings</Text>
            <Text style={styles.itemSubtitle}>Account, privacy, notifications</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.gray[500]} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Button title="Logout" onPress={logout} color={colors.error} />
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
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#f2f2f2',
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
    backgroundColor: '#f2f2f2',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
});

export default Menu; 