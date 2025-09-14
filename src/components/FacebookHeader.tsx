import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated, Dimensions, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './Logo';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { updateUnreadMessageCount } from '../reducers/chatReducer';
import { useSocket } from '../contexts/SocketContext';
import { useHeaderVisibility } from '../contexts/HeaderVisibilityContext';
import SearchModal from './SearchModal';
import moment from 'moment';

interface FacebookHeaderProps {
  title?: string;
}

const { width: screenWidth } = Dimensions.get('window');

const FacebookHeader: React.FC<FacebookHeaderProps> = ({ title = 'Connect' }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const myProfile = useSelector((state: RootState) => state.profile);
  const unreadMessageCount = useSelector((state: RootState) => state.chat.unreadMessageCount);
  const { isConnected, emit, on, off } = useSocket();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const dropdownAnimation = React.useRef(new Animated.Value(0)).current;
  const badgeAnimation = React.useRef(new Animated.Value(1)).current;
  const messageBadgeAnimation = React.useRef(new Animated.Value(1)).current;

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
    const newState = !notifOpen;
    setNotifOpen(newState);
    
    if (newState) {
      // Animate dropdown in
      Animated.spring(dropdownAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      // Animate dropdown out
      Animated.timing(dropdownAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return 'person-add';
      case 'message':
        return 'message';
      case 'post':
        return 'post-add';
      case 'story':
        return 'auto-stories';
      case 'watch':
        return 'play-circle';
      case 'like':
        return 'favorite';
      case 'comment':
        return 'comment';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'friend_request':
        return themeColors.primary;
      case 'message':
        return '#4CAF50';
      case 'post':
        return '#FF9800';
      case 'story':
        return '#9C27B0';
      case 'watch':
        return '#F44336';
      case 'like':
        return '#E91E63';
      case 'comment':
        return '#2196F3';
      default:
        return themeColors.primary;
    }
  };

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif._id === notificationId ? { ...notif, isSeen: true } : notif
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
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
      const reversedData = data.reverse();
      setNotifications(reversedData);
      const unread = reversedData.filter(n => !n.isSeen).length;
      setUnreadCount(unread);
    };
    const handleNew = (data: any) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Animate badge when new notification arrives
      Animated.sequence([
        Animated.timing(badgeAnimation, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(badgeAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    };
    on('oldNotifications', handleOld);
    on('newNotification', handleNew);
    return () => {
      off('oldNotifications', handleOld);
      off('newNotification', handleNew);
    };
  }, [myProfile?._id, isConnected, emit, on, off]);

  // Update message count when profile changes
  React.useEffect(() => {
    if (myProfile?._id) {
      dispatch(updateUnreadMessageCount(myProfile._id));
    }
  }, [myProfile?._id, dispatch]);

  // Animate message badge when count changes
  React.useEffect(() => {
    if (unreadMessageCount > 0) {
      Animated.sequence([
        Animated.timing(messageBadgeAnimation, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(messageBadgeAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [unreadMessageCount]);

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
          <View style={styles.messageButtonContainer}>
            <Icon name="chat" size={20} color={iconColor} />
            {unreadMessageCount > 0 && (
              <Animated.View 
                style={[
                  styles.messageBadge, 
                  { 
                    backgroundColor: themeColors.status.error,
                    transform: [{ scale: messageBadgeAnimation }]
                  }
                ]}
              >
                <Text style={styles.badgeText}>
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </Text>
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNotificationsPress} style={[styles.actionButton, { backgroundColor: themeColors.surface.secondary }]}>
          <View style={styles.notificationButtonContainer}>
            <Icon name="notifications" size={20} color={iconColor} />
            {unreadCount > 0 && (
              <Animated.View 
                style={[
                  styles.notificationBadge, 
                  { 
                    backgroundColor: themeColors.status.error,
                    transform: [{ scale: badgeAnimation }]
                  }
                ]}
              >
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>
        {/* <TouchableOpacity onPress={handleSettingsPress} style={[styles.actionButton, { backgroundColor: themeColors.surface.secondary }]}>
          <Icon name="settings" size={20} color={iconColor} />
        </TouchableOpacity> */}
      </View>
      {notifOpen && (
        <Animated.View 
          style={[
            styles.notificationsMenu, 
            { 
              backgroundColor: themeColors.surface.elevated, 
              borderColor: themeColors.border.primary,
              transform: [
                {
                  scale: dropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
                {
                  translateY: dropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
              opacity: dropdownAnimation,
            }
          ]}
        > 
          <View style={[styles.notificationHeader, { borderBottomColor: themeColors.border.primary }]}>
            <Text style={[styles.notificationHeaderTitle, { color: textColor }]}>
              Notifications
            </Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={clearAllNotifications} style={styles.clearAllButton}>
                <Text style={[styles.clearAllText, { color: themeColors.primary }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="notifications-none" size={48} color={themeColors.gray[400]} />
              <Text style={[styles.emptyStateText, { color: themeColors.text.secondary }]}>
                No notifications yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: themeColors.text.tertiary }]}>
                We'll notify you when something new happens
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item: any, idx) => item._id || String(idx)}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.notificationRow, 
                    { 
                      backgroundColor: !item.isSeen ? themeColors.primary + '08' : 'transparent',
                      borderLeftColor: !item.isSeen ? getNotificationColor(item.type || 'default') : 'transparent'
                    }
                  ]}
                  onPress={() => markNotificationAsRead(item._id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.notificationIconContainer,
                    { backgroundColor: getNotificationColor(item.type || 'default') + '15' }
                  ]}>
                    <Icon 
                      name={getNotificationIcon(item.type || 'default')} 
                      size={20} 
                      color={getNotificationColor(item.type || 'default')} 
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text 
                      numberOfLines={2} 
                      style={[
                        styles.notificationText, 
                        { 
                          color: textColor,
                          fontWeight: !item.isSeen ? '600' : '400'
                        }
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text style={[styles.notificationTime, { color: themeColors.text.tertiary }]}>
                      {moment(item.timestamp || item.createdAt).fromNow()}
                    </Text>
                  </View>
                  {!item.isSeen && (
                    <View style={[styles.unreadDot, { backgroundColor: getNotificationColor(item.type || 'default') }]} />
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
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
  notificationButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  messageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  notificationsMenu: {
    position: 'absolute',
    top: 60,
    right: 12,
    width: Math.min(screenWidth - 24, 340),
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    overflow: 'hidden',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notificationHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  clearAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    position: 'relative',
  },
  notificationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 12,
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default FacebookHeader;


