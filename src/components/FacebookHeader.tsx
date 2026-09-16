import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './Logo';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSocket } from '../contexts/SocketContext';
import { useHeaderVisibility } from '../contexts/HeaderVisibilityContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import SearchModal from './SearchModal';
import moment from 'moment';
import api from '../lib/api';
import type { LudoInvite } from '../lib/ludo/types';

interface FacebookHeaderProps {
  title?: string;
  onOpenAIAgent?: () => void;
  onLongPressAIAgent?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const FacebookHeader: React.FC<FacebookHeaderProps> = ({
  title = 'Connect',
  onOpenAIAgent,
  onLongPressAIAgent,
}) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { isConnected, emit, on, off } = useSocket();
  const { requestLudoInvite } = useLudoGame();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [ludoInvites, setLudoInvites] = React.useState<LudoInvite[]>([]);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = React.useState('');
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isConnectPlus, setIsConnectPlus] = React.useState(false);
  const dropdownAnimation = React.useRef(new Animated.Value(0)).current;
  const badgeAnimation = React.useRef(new Animated.Value(1)).current;

  const loadSubscription = React.useCallback(async () => {
    api.get('/wallet')
      .then((response) => {
        const wallet = response.data;
        const active = wallet?.connectPlusActive === true ||
          (wallet?.subscriptionStatus === 'active' &&
            Boolean(wallet.subscriptionExpiresAt) &&
            new Date(wallet.subscriptionExpiresAt).getTime() > Date.now());
        setIsConnectPlus(active);
      })
      .catch((error) => {
        setIsConnectPlus(false);
        console.warn('Unable to load Connect+ status:', error);
      });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadSubscription();
    }, [loadSubscription]),
  );

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted) void loadSubscription();
    };
    const interval = setInterval(refresh, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [loadSubscription]);

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'open-hashtag-search',
      (query: string) => {
        setSearchInitialQuery(query);
        setSearchOpen(true);
      },
    );
    return () => subscription.remove();
  }, []);

  const backgroundColor = themeColors.surface.primary;
  const iconColor = themeColors.text.primary;
  const textColor = themeColors.text.primary;

  const handleSearchPress = () => {
    setSearchOpen(true);
  };

  const isMessageNotification = (notification: any) => {
    const type = String(
      notification?.type ||
        notification?.category ||
        notification?.kind ||
        notification?.meta?.type ||
        '',
    ).toLowerCase();

    return (
      type === 'message' ||
      type === 'new_message' ||
      type === 'message_received' ||
      type === 'received_message' ||
      type.includes('message')
    );
  };

  const shouldCountNotification = (notification: any) =>
    !isMessageNotification(notification);

  const notificationToLudoInvite = React.useCallback((notification: any): LudoInvite | null => {
    const type = String(notification?.type || notification?.data?.type || '').toLowerCase();
    const data = notification?.data || notification?.meta || {};
    const gameId = data.gameId || notification?.gameId;
    const inviterId =
      data.inviterId ||
      data.by ||
      notification?.fromUserId ||
      notification?.senderId ||
      notification?.userId;
    if (type !== 'ludo_invite' || !gameId || !inviterId) return null;
    return {
      gameId: String(gameId),
      by: String(inviterId),
      from: String(inviterId),
      name: data.name || notification?.title,
      avatar: data.avatar || notification?.icon,
      playerCount: Number(data.playerCount) || 4,
      slotIndex: Number.isInteger(Number(data.slotIndex)) ? Number(data.slotIndex) : 1,
      inviteId: data.inviteId || notification?._id,
    };
  }, []);

  const resolveLudoInviteNotification = React.useCallback(
    async (invite: LudoInvite) => {
      if (!invite.gameId) return;
      try {
        await api.post('/notification/resolve-ludo-invite', {
          gameId: invite.gameId,
          inviterId: invite.by || invite.from,
        });
      } catch (error) {
        console.warn('Unable to resolve Ludo invite notification:', error);
      }
    },
    [],
  );

  const acceptLudoInvite = React.useCallback(
    (invite: LudoInvite) => {
      if (!invite.gameId || !invite.from && !invite.by) return;
      const inviterId = String(invite.from || invite.by);
      const acceptedInvite = {
        ...invite,
        from: inviterId,
        by: invite.by || inviterId,
      };
      setLudoInvites((prev) =>
        prev.filter((item) => item.inviteId !== invite.inviteId && item.gameId !== invite.gameId),
      );
      requestLudoInvite({
        id: inviterId,
        name: invite.name,
        profilePic: invite.avatar,
        gameId: invite.gameId,
        by: acceptedInvite.by,
        playerCount: invite.playerCount,
        slotIndex: invite.slotIndex,
        inviteId: invite.inviteId,
      });
      (navigation as any).navigate('Menu', { screen: 'MenuHome' });
      void resolveLudoInviteNotification(invite);
    },
    [emit, myProfile?._id, myProfile?.fullName, myProfile?.profilePic, myProfile?.coverPic, navigation, requestLudoInvite, resolveLudoInviteNotification],
  );

  const rejectLudoInvite = React.useCallback(
    (invite: LudoInvite) => {
      if (!invite.gameId) return;
      setLudoInvites((prev) =>
        prev.filter((item) => item.inviteId !== invite.inviteId && item.gameId !== invite.gameId),
      );
      emit('ludo:invites:dismiss', {
        gameId: invite.gameId,
        by: invite.by || invite.from,
      });
      void resolveLudoInviteNotification(invite);
    },
    [emit, resolveLudoInviteNotification],
  );

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
      case 'connect_request':
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
      case 'connect_request':
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
        notif._id === notificationId ? { ...notif, isSeen: true } : notif,
      ),
    );
  };

  const handleNotificationPress = (notification: any) => {
    // Mark as read in UI
    markNotificationAsRead(notification._id);

    // Try to navigate to the relevant screen based on notification type.
    // Fallbacks are defensive since payload shape varies.
    const type = notification.type;
    try {
      switch (type) {
        case 'message': {
          // Open messages screen / specific thread if available
          const threadId =
            notification.threadId ||
            notification.conversationId ||
            notification.meta?.threadId;
          if (threadId) {
            (navigation as any).navigate('Message', {
              screen: 'Chat',
              params: { threadId },
            });
          } else {
            (navigation as any).navigate('Message', { screen: 'MessageList' });
          }
          break;
        }
        case 'connect_request': {
          const userId =
            notification.fromUserId ||
            notification.userId ||
            notification.actor?._id ||
            notification.meta?.userId;
          if (userId) {
            (navigation as any).navigate('Profile', { userId });
          }
          break;
        }
        case 'post':
        case 'comment':
        case 'like': {
          const postId =
            notification.postId ||
            notification.entityId ||
            notification.meta?.postId;
          if (postId) {
            (navigation as any).navigate('Post', { postId });
          }
          break;
        }
        default:
          // No-op for unknown types — the notification is already marked read.
          break;
      }
    } catch (err) {
      // Ignore navigation errors — ensure UI still marks notification as read.
      console.warn('Failed to navigate for notification', err);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    ludoInvites.forEach((invite) => {
      emit('ludo:invites:dismiss', {
        gameId: invite.gameId,
        by: invite.by || invite.from,
      });
      void resolveLudoInviteNotification(invite);
    });
    setLudoInvites([]);
    setUnreadCount(0);
  };

  const handleSettingsPress = () => {
    (navigation as any).navigate('Menu', {
      screen: 'Settings',
    } as any);
  };

  const handleLogoPress = () => {
    try {
      // Reset navigation stack to the root Home screen so logo always returns home
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (err) {
      // Fallback to navigate if reset isn't supported by this navigator instance
      (navigation as any).navigate('Home');
    }
  };

  React.useEffect(() => {
    if (!myProfile?._id || !isConnected) return;
    emit('fetchNotifications', myProfile._id);
    emit('ludo:invites:get', {});

    const handleLudoInvite = (invite: LudoInvite) => {
      if (!invite?.gameId) return;
      setLudoInvites((prev) => {
        const withoutExisting = prev.filter(
          (item) => item.inviteId !== invite.inviteId && item.gameId !== invite.gameId,
        );
        return [invite, ...withoutExisting];
      });
    };
    const handleLudoInvites = (data: { invites?: LudoInvite[] }) => {
      setLudoInvites(Array.isArray(data?.invites) ? data.invites : []);
    };

    const handleOld = (data: any[]) => {
      const reversedData = data.reverse();
      setNotifications(reversedData);
      setLudoInvites(
        reversedData
          .map(notificationToLudoInvite)
          .filter((invite): invite is LudoInvite => Boolean(invite)),
      );
      const unread = reversedData.filter(
        n => shouldCountNotification(n) && !n.isSeen,
      ).length;
      setUnreadCount(unread);
    };
    const handleNew = (data: any) => {
      setNotifications(prev => [data, ...prev]);
      const ludoInvite = notificationToLudoInvite(data);
      if (ludoInvite) {
        setLudoInvites((prev) => [
          ludoInvite,
          ...prev.filter((item) => item.gameId !== ludoInvite.gameId),
        ]);
      }
      if (shouldCountNotification(data)) {
        setUnreadCount(prev => prev + 1);
      }

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
    on('ludo:invite', handleLudoInvite);
    on('ludo:invites', handleLudoInvites);
    return () => {
      off('oldNotifications', handleOld);
      off('newNotification', handleNew);
      off('ludo:invite', handleLudoInvite);
      off('ludo:invites', handleLudoInvites);
    };
  }, [myProfile?._id, isConnected, emit, on, off, notificationToLudoInvite]);

  const { translateY } = useHeaderVisibility();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'ios' ? 0 : insets.top;
  const notificationUnreadCount = unreadCount + ludoInvites.length;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          borderBottomColor: themeColors.border.primary,
          paddingTop: topInset,
          height: 56 + topInset,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.leftSection}
        onPress={handleLogoPress}
        accessibilityRole="button"
        accessibilityLabel="Go to Home"
      >
        <Logo size="small" />
        <Text
          style={{
            color: themeColors.primary,
            fontWeight: '700',
            fontSize: 28,
            marginLeft: 3,
            marginTop: 0,
          }}
        >
          Connect
        </Text>
        {isConnectPlus ? (
          <View
            style={[styles.connectPlusBadge, { backgroundColor: themeColors.primary }]}
            accessibilityLabel="Connect Plus active"
          >
            <Icon name="workspace-premium" size={13} color="#FFFFFF" />
            <Text style={styles.connectPlusText}>+</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.rightSection}>
        <Pressable
          onPress={handleSearchPress}
          style={({ pressed }) => [
            styles.actionButton,
            styles.searchButton,
            {
              backgroundColor: isDarkMode
                ? 'rgba(36, 37, 38, 0.55)'
                : 'rgba(248, 249, 250, 0.9)',
              borderColor: pressed
                ? themeColors.primary + '66'
                : isDarkMode
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          {({ pressed }) => (
            <>
              <View style={styles.searchButtonHighlight} />
              <Icon
                name="search"
                size={20}
                color={
                  pressed ? themeColors.primary : themeColors.text.secondary
                }
              />
            </>
          )}
        </Pressable>
        <TouchableOpacity
          onPress={onOpenAIAgent}
          onLongPress={onLongPressAIAgent}
          accessibilityRole="button"
          accessibilityLabel="Open AI Agent"
          style={[
            styles.actionButton,
            { backgroundColor: themeColors.surface.secondary },
          ]}
        >
          <Icon name="psychology" size={22} color={iconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleNotificationsPress}
          style={[
            styles.actionButton,
            { backgroundColor: themeColors.surface.secondary },
          ]}
        >
          <View style={styles.notificationButtonContainer}>
            <Icon name="notifications" size={20} color={iconColor} />
            {notificationUnreadCount > 0 && (
              <Animated.View
                style={[
                  styles.notificationBadge,
                  {
                    backgroundColor: themeColors.status.error,
                    transform: [{ scale: badgeAnimation }],
                  },
                ]}
              >
                <Text style={styles.badgeText}>
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
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
              top: 60 + topInset,
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
            },
          ]}
        >
          <View
            style={[
              styles.notificationHeader,
              { borderBottomColor: themeColors.border.primary },
            ]}
          >
            <Text
              style={[styles.notificationHeaderTitle, { color: textColor }]}
            >
              Notifications
            </Text>
            {notifications.length > 0 && (
              <TouchableOpacity
                onPress={clearAllNotifications}
                style={styles.clearAllButton}
              >
                <Text
                  style={[styles.clearAllText, { color: themeColors.primary }]}
                >
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {notifications.length === 0 && ludoInvites.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon
                name="notifications-none"
                size={48}
                color={themeColors.gray[400]}
              />
              <Text
                style={[
                  styles.emptyStateText,
                  { color: themeColors.text.secondary },
                ]}
              >
                No notifications yet
              </Text>
              <Text
                style={[
                  styles.emptyStateSubtext,
                  { color: themeColors.text.tertiary },
                ]}
              >
                We'll notify you when something new happens
              </Text>
            </View>
          ) : (
            <View>
              {ludoInvites.map((invite) => (
                <View
                  key={invite.inviteId || `${invite.gameId}-${invite.by || invite.from}`}
                  style={[
                    styles.ludoInviteRow,
                    {
                      backgroundColor: themeColors.primary + '08',
                      borderLeftColor: themeColors.primary,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.notificationIconContainer,
                      { backgroundColor: themeColors.primary + '15' },
                    ]}
                  >
                    <Icon name="casino" size={20} color={themeColors.primary} />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text style={[styles.notificationText, { color: textColor, fontWeight: '600' }]}>
                      {invite.name || 'A connect'} invited you to play Ludo
                    </Text>
                    <View style={styles.ludoInviteActions}>
                      <TouchableOpacity
                        onPress={() => acceptLudoInvite(invite)}
                        style={[styles.ludoInviteButton, { backgroundColor: themeColors.primary }]}
                        accessibilityRole="button"
                        accessibilityLabel="Accept Ludo invitation"
                      >
                        <Text style={styles.ludoInviteAcceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => rejectLudoInvite(invite)}
                        style={[
                          styles.ludoInviteButton,
                          styles.ludoInviteRejectButton,
                          { borderColor: themeColors.border.primary },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Reject Ludo invitation"
                      >
                        <Text style={[styles.ludoInviteRejectText, { color: textColor }]}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              <FlatList
                data={notifications}
                keyExtractor={(item: any, idx) => item._id || String(idx)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.notificationRow,
                      {
                        backgroundColor: !item.isSeen
                          ? themeColors.primary + '08'
                          : 'transparent',
                        borderLeftColor: !item.isSeen
                          ? getNotificationColor(item.type || 'default')
                          : 'transparent',
                      },
                    ]}
                    onPress={() => markNotificationAsRead(item._id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.notificationIconContainer,
                        {
                          backgroundColor:
                            getNotificationColor(item.type || 'default') + '15',
                        },
                      ]}
                    >
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
                            fontWeight: !item.isSeen ? '600' : '400',
                          },
                        ]}
                      >
                        {item.text}
                      </Text>
                      <Text
                        style={[
                          styles.notificationTime,
                          { color: themeColors.text.tertiary },
                        ]}
                      >
                        {moment(item.timestamp || item.createdAt).fromNow()}
                      </Text>
                    </View>
                    {!item.isSeen && (
                      <View
                        style={[
                          styles.unreadDot,
                          {
                            backgroundColor: getNotificationColor(
                              item.type || 'default',
                            ),
                          },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 320 }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </Animated.View>
      )}
      <SearchModal
        visible={searchOpen}
        initialQuery={searchInitialQuery}
        onClose={() => setSearchOpen(false)}
      />
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
  connectPlusBadge: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  connectPlusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  searchButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationButtonContainer: {
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
  ludoInviteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
  },
  ludoInviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ludoInviteButton: {
    borderRadius: 8,
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  ludoInviteRejectButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  ludoInviteAcceptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  ludoInviteRejectText: {
    fontSize: 12,
    fontWeight: '600',
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
