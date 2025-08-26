import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './Logo';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSocket } from '../contexts/SocketContext';
import { useHeaderVisibility } from '../contexts/HeaderVisibilityContext';
import SearchModal from './SearchModal';

interface FacebookHeaderProps {
  title?: string;
}

const FacebookHeader: React.FC<FacebookHeaderProps> = ({ title = 'Connect' }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { isConnected, emit, on, off } = useSocket();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const backgroundColor = themeColors.surface.primary;
  const iconColor = themeColors.text.primary;
  const textColor = themeColors.text.primary;

  const handleSearchPress = () => {
    setSearchOpen(true);
  };

  const handleMessagePress = () => {
    (navigation as any).navigate('Message', { screen: 'MessageList' });
  };

  const handleNotificationsPress = () => {
    setNotifOpen(v => !v);
  };

  const handleSettingsPress = () => {
    (navigation as any).navigate('Menu', {
      screen: 'Settings',
    } as any);
  };

  const handleLogoPress = () => {
    (navigation as any).navigate('Home');
  };

  React.useEffect(() => {
    if (!myProfile?._id || !isConnected) return;
    emit('fetchNotifications', myProfile._id);

    const handleOld = (data: any[]) => {
      setNotifications(data.reverse());
    };
    const handleNew = (data: any) => {
      setNotifications(prev => [data, ...prev]);
    };
    on('oldNotifications', handleOld);
    on('newNotification', handleNew);
    return () => {
      off('oldNotifications', handleOld);
      off('newNotification', handleNew);
    };
  }, [myProfile?._id, isConnected, emit, on, off]);

  const { translateY } = useHeaderVisibility();

  return (
    <Animated.View style={[styles.container, { backgroundColor, borderBottomColor: themeColors.border.primary, transform: [{ translateY }] }]}> 
      <TouchableOpacity style={styles.leftSection} onPress={handleLogoPress} accessibilityRole="button" accessibilityLabel="Go to Home">
        <Logo size="small" />
        <Text style={{ color: themeColors.primary, fontWeight: '700', fontSize: 28, marginLeft: 3, marginTop: 0 }}>Connect</Text>
      </TouchableOpacity>

      <View style={styles.rightSection}>
        <TouchableOpacity onPress={handleSearchPress} style={[styles.actionButton, { backgroundColor: themeColors.surface.secondary }]}>
          <Icon name="search" size={20} color={iconColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMessagePress} style={[styles.actionButton, { backgroundColor: themeColors.surface.secondary }]}>
          <Icon name="chat" size={20} color={iconColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNotificationsPress} style={[styles.actionButton, { backgroundColor: themeColors.surface.secondary }]}>
          <Icon name="notifications" size={20} color={iconColor} />
        </TouchableOpacity>
        {/* <TouchableOpacity onPress={handleSettingsPress} style={[styles.actionButton, { backgroundColor: themeColors.surface.secondary }]}>
          <Icon name="settings" size={20} color={iconColor} />
        </TouchableOpacity> */}
      </View>
      {notifOpen && (
        <View style={[styles.notificationsMenu, { backgroundColor: themeColors.surface.elevated, borderColor: themeColors.border.primary }]}> 
          {notifications.length === 0 ? (
            <Text style={{ color: textColor, padding: 12 }}>No notifications</Text>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item: any, idx) => item._id || String(idx)}
              renderItem={({ item }) => (
                <View style={styles.notificationRow}>
                  <Icon name="notifications" size={18} color={iconColor} />
                  <Text numberOfLines={2} style={[styles.notificationText, { color: textColor }]}>{item.text}</Text>
                </View>
              )}
              style={{ maxHeight: 280 }}
            />
          )}
        </View>
      )}
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftSection: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
    
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsMenu: {
    position: 'absolute',
    top: 56,
    right: 12,
    width: 300,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    paddingVertical: 8,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
  },
});

export default FacebookHeader;


