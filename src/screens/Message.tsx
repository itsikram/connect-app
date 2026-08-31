import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector, useDispatch } from 'react-redux';
import { userAPI, debugAuth } from '../lib/api';
import { setProfile } from '../reducers/profileReducer';
import { RootState, AppDispatch } from '../store';
import UserPP from '../components/UserPP';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { hideTabBarForChat } from '../lib/chatScreenChrome';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import { fetchChatList, updateUnreadMessageCount, markMessagesAsRead } from '../reducers/chatReducer';
import moment from 'moment';
import ListItemSkeleton from '../components/skeleton/ListItemSkeleton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getColorWithOpacity } from '../theme/colors';

const idsMatch = (a?: string | number | null, b?: string | number | null) =>
  a != null && b != null && String(a) === String(b);

const firstName = (fullName?: string) => {
  const name = (fullName || '').trim();
  if (!name) return 'Friend';
  return name.split(/\s+/)[0];
};

const isAudioAttachment = (url?: string | boolean | null) => {
  if (typeof url !== 'string') return false;
  return /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)(\?|#|$)/i.test(url);
};

const isImageAttachment = (url?: string | boolean | null) => {
  if (typeof url !== 'string') return false;
  return /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?|#|$)/i.test(url);
};

type PreviewKind = 'text' | 'photo' | 'voice' | 'video-call' | 'audio-call' | 'missed-video' | 'missed-audio' | 'attachment';

function getLastMessagePreview(lastMessage: any): { text: string; kind: PreviewKind } {
  if (
    !lastMessage ||
    (!lastMessage.message && !lastMessage.attachment && !lastMessage.messageType)
  ) {
    return { text: 'Start a conversation', kind: 'text' };
  }

  if (lastMessage.messageType === 'call') {
    const isVideo = lastMessage.callType === 'video';
    const isMissed = lastMessage.callEvent === 'missed';
    if (isMissed) {
      return {
        text: isVideo ? 'Missed video call' : 'Missed audio call',
        kind: isVideo ? 'missed-video' : 'missed-audio',
      };
    }
    return {
      text: lastMessage.message || (isVideo ? 'Video call' : 'Audio call'),
      kind: isVideo ? 'video-call' : 'audio-call',
    };
  }

  if (lastMessage.messageType === 'audio' || isAudioAttachment(lastMessage.attachment)) {
    return { text: 'Voice message', kind: 'voice' };
  }

  const messageText = String(lastMessage?.message || lastMessage?.text || lastMessage?.content || '').trim();
  if (messageText) return { text: messageText, kind: 'text' };

  if (isImageAttachment(lastMessage.attachment) || lastMessage.attachment) {
    return {
      text: isImageAttachment(lastMessage.attachment) ? 'Photo' : 'Attachment',
      kind: isImageAttachment(lastMessage.attachment) ? 'photo' : 'attachment',
    };
  }

  return { text: 'Start a conversation', kind: 'text' };
}

const PREVIEW_ICONS: Record<PreviewKind, string | null> = {
  text: null,
  photo: 'photo',
  voice: 'mic',
  'video-call': 'videocam',
  'audio-call': 'call',
  'missed-video': 'missed-video-call',
  'missed-audio': 'phone-missed',
  attachment: 'attach-file',
};

function getShortTimeAgo(timestamp?: string | Date | null) {
  if (!timestamp) return '';
  const time = moment(timestamp);
  if (!time.isValid()) return '';

  const now = moment();
  const seconds = Math.max(0, now.diff(time, 'seconds'));
  if (seconds < 45) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (now.year() === time.year()) return time.format('MMM D');
  return time.format('MMM D, YYYY');
}

function countUnread(messages: any[] | undefined, myId?: string) {
  if (!myId || !Array.isArray(messages)) return 0;
  return messages.reduce((count, message) => {
    if (message && idsMatch(message.receiverId, myId) && !message.isSeen) return count + 1;
    return count;
  }, 0);
}

const CHAT_LIST_STORAGE_KEY = 'chat_list';

const saveChatListToStorage = async (chatList: any[], userId: string) => {
  try {
    const storageKey = `${CHAT_LIST_STORAGE_KEY}_${userId}`;
    const dataToStore = {
      chatList,
      timestamp: new Date().toISOString(),
      userId,
    };
    await AsyncStorage.setItem(storageKey, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Error saving chat list to AsyncStorage:', error);
  }
};

const loadChatListFromStorage = async (userId: string) => {
  try {
    const storageKey = `${CHAT_LIST_STORAGE_KEY}_${userId}`;
    const storedData = await AsyncStorage.getItem(storageKey);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      return parsedData.chatList || [];
    }
    return [];
  } catch (error) {
    console.error('Error loading chat list from AsyncStorage:', error);
    return [];
  }
};

const clearChatListFromStorage = async (userId: string) => {
  try {
    const storageKey = `${CHAT_LIST_STORAGE_KEY}_${userId}`;
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error clearing chat list from AsyncStorage:', error);
  }
};

export { clearChatListFromStorage };

const ConversationRow = React.memo(({
  person,
  last,
  unreadCount,
  isOnline,
  showDivider,
  myId,
  colors,
  onPress,
}: {
  person: any;
  last?: any;
  unreadCount: number;
  isOnline: boolean;
  showDivider: boolean;
  myId?: string;
  colors: any;
  onPress: () => void;
}) => {
  const preview = getLastMessagePreview(last);
  const isOutgoing = last && idsMatch(last.senderId, myId);
  const isUnread = unreadCount > 0;
  const previewIcon = PREVIEW_ICONS[preview.kind];
  const previewColor = isUnread ? colors.text.primary : colors.text.secondary;
  const nameColor = isUnread ? colors.text.primary : colors.text.primary;
  const missed = preview.kind === 'missed-video' || preview.kind === 'missed-audio';

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border.muted }}
      accessibilityRole="button"
      accessibilityLabel={`${person?.fullName || 'User'}${isOnline ? ', online' : ''}. ${isOutgoing ? 'You: ' : ''}${preview.text}. ${getShortTimeAgo(last?.timestamp)}${isUnread ? `. ${unreadCount} unread` : ''}`}
      style={({ pressed }) => [
        styles.conversationRow,
        {
          backgroundColor: pressed
            ? colors.surface.secondary
            : isUnread
              ? getColorWithOpacity(colors.primary, 0.08)
              : 'transparent',
        },
      ]}
    >
      <UserPP image={person?.profilePic} isActive={isOnline} size={54} />
      <View
        style={[
          styles.conversationBody,
          showDivider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.secondary },
        ]}
      >
        <View style={styles.conversationTop}>
          <Text
            style={[styles.conversationName, { color: nameColor, fontWeight: isUnread ? '700' : '600' }]}
            numberOfLines={1}
          >
            {person?.fullName || 'User'}
          </Text>
          {last?.timestamp ? (
            <Text
              style={[
                styles.conversationTime,
                { color: isUnread ? colors.primary : colors.text.tertiary },
              ]}
            >
              {getShortTimeAgo(last.timestamp)}
            </Text>
          ) : null}
        </View>
        <View style={styles.conversationBottom}>
          <View style={styles.previewRow}>
            {isOutgoing && last ? (
              <Icon
                name={last.isSeen ? 'done-all' : 'done'}
                size={15}
                color={last.isSeen ? colors.primary : colors.text.tertiary}
                style={styles.previewStatus}
              />
            ) : null}
            {previewIcon ? (
              <Icon
                name={previewIcon}
                size={14}
                color={missed ? colors.status.error : previewColor}
                style={styles.previewStatus}
              />
            ) : null}
            <Text
              style={[
                styles.previewText,
                {
                  color: missed ? colors.status.error : previewColor,
                  fontWeight: isUnread ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {isOutgoing ? `You: ${preview.text}` : preview.text}
            </Text>
          </View>
          {isUnread ? (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.unreadBadgeText, { color: colors.text.inverse }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

ConversationRow.displayName = 'ConversationRow';

const Message = React.memo(() => {
  const dispatch = useDispatch<AppDispatch>();
  const { colors: themeColors } = useTheme();
  const profileData = useSelector((state: RootState) => state.profile);
  const unreadMessageCount = useSelector((state: RootState) => state.chat.unreadMessageCount);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const activeFriends = useSelector((state: RootState) => state.presence.activeFriends);
  const { chats: chatList, loading: chatLoading, error: chatError } = useSelector((state: RootState) => state.chat as {
    chats: any[];
    loading: boolean;
    error: string | null;
  });

  const { on, off, isConnected, checkUserActive } = useSocket();
  const [isCallActive, setIsCallActive] = React.useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  const sortedFriends = useMemo(() => {
    const friendsList = [...(profileData?.friends || [])];
    return friendsList.sort((a: any, b: any) => {
      const aActive = activeFriends.includes(a?._id) ? 1 : 0;
      const bActive = activeFriends.includes(b?._id) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aName = (a?.fullName || '').toLowerCase();
      const bName = (b?.fullName || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [profileData?.friends, activeFriends]);

  const onlineFriends = useMemo(
    () => (sortedFriends || []).filter((friend: any) => activeFriends.includes(friend?._id)),
    [sortedFriends, activeFriends]
  );

  const openChat = useCallback((friend: any) => {
    if (!friend) return;
    Keyboard.dismiss();
    hideTabBarForChat(navigation);
    (navigation as any).navigate('SingleMessage', { friend });
  }, [navigation]);

  useEffect(() => {
    const handleCallAccepted = () => setIsCallActive(true);
    const handleVideoEnd = () => setIsCallActive(false);
    const handleAudioEnd = () => setIsCallActive(false);

    on('call-accepted', handleCallAccepted);
    on('videoCallEnd', handleVideoEnd);
    on('audio-call-ended', handleAudioEnd);

    return () => {
      off('call-accepted', handleCallAccepted);
      off('videoCallEnd', handleVideoEnd);
      off('audio-call-ended', handleAudioEnd);
    };
  }, [on, off]);

  useFocusEffect(
    React.useCallback(() => {
      setIsCallActive(false);
      return () => {};
    }, [])
  );

  useEffect(() => {
    const loadStoredChatList = async () => {
      if (profileData?._id) {
        await loadChatListFromStorage(profileData._id);
      }
    };
    loadStoredChatList();
  }, [profileData?._id]);

  useEffect(() => {
    if (profileData?._id) {
      debugAuth().then(({ user, token }) => {
        console.log('Auth debug result:', { hasUser: !!user, hasToken: !!token });
      });
      dispatch(fetchChatList(profileData._id)).then(() => {
        dispatch(updateUnreadMessageCount(profileData._id));
      });
    }
  }, [dispatch, profileData?._id]);

  useEffect(() => {
    if (chatList && chatList.length > 0 && profileData?._id) {
      const timeoutId = setTimeout(() => {
        saveChatListToStorage(chatList, profileData._id);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [chatList?.length, profileData?._id]);

  useEffect(() => {
    if (!isConnected || !chatList || chatList.length === 0 || !profileData?._id) return;
    chatList.forEach((contact) => {
      if (!contact?.person?._id) return;
      checkUserActive(contact.person._id, profileData._id);
    });
  }, [isConnected, chatList, profileData?._id, checkUserActive]);

  const sortedChatList = useMemo(() => {
    const list = [...(chatList || [])].filter((item) => item?.person?._id);
    return list.sort((a: any, b: any) => {
      const aTs = new Date(a?.messages?.[0]?.timestamp || 0).getTime();
      const bTs = new Date(b?.messages?.[0]?.timestamp || 0).getTime();
      return bTs - aTs;
    });
  }, [chatList]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredChatList = useMemo(() => {
    if (!normalizedQuery) return sortedChatList;
    return sortedChatList.filter((item: any) => {
      const person = item?.person || {};
      const name = (person.fullName || '').toLowerCase();
      const username = (person.username || person.nickname || '').toLowerCase();
      const lastText = getLastMessagePreview(item?.messages?.[0]).text.toLowerCase();
      return name.includes(normalizedQuery) || username.includes(normalizedQuery) || lastText.includes(normalizedQuery);
    });
  }, [sortedChatList, normalizedQuery]);

  const peopleStrip = useMemo(() => {
    if (normalizedQuery) {
      return (sortedFriends || [])
        .filter((friend: any) => (friend.fullName || '').toLowerCase().includes(normalizedQuery))
        .slice(0, 20);
    }
    if (onlineFriends.length > 0) return onlineFriends;
    if (!sortedChatList.length) return (sortedFriends || []).slice(0, 16);
    return [];
  }, [normalizedQuery, sortedFriends, onlineFriends, sortedChatList.length]);

  const peopleStripTitle = normalizedQuery
    ? 'People'
    : onlineFriends.length > 0
      ? 'Active now'
      : 'Friends';

  const headerSubtitle = useMemo(() => {
    if (unreadMessageCount > 0 && onlineFriends.length > 0) {
      return `${unreadMessageCount} unread · ${onlineFriends.length} online`;
    }
    if (unreadMessageCount > 0) return `${unreadMessageCount} unread`;
    if (onlineFriends.length > 0) return `${onlineFriends.length} online`;
    if (sortedChatList.length > 0) {
      return `${sortedChatList.length} conversation${sortedChatList.length === 1 ? '' : 's'}`;
    }
    return 'Chats and calls with friends';
  }, [unreadMessageCount, onlineFriends.length, sortedChatList.length]);

  const fetchProfile = useCallback(async () => {
    try {
      if (!profileData?._id) return;
      setIsLoading(true);
      const response = await userAPI.getProfile(profileData._id);
      dispatch(setProfile(response.data));
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, profileData?._id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (profileData?._id) {
      await dispatch(fetchChatList(profileData._id));
      dispatch(updateUnreadMessageCount(profileData._id));
    }
    if (!profileData || Object.keys(profileData).length === 0) {
      await fetchProfile();
    }
    setRefreshing(false);
  }, [profileData, dispatch, fetchProfile]);

  const markAllAsRead = useCallback(() => {
    if (!profileData?._id) return;
    (chatList || []).forEach((chat: any) => {
      if (chat?.person?._id) {
        dispatch(markMessagesAsRead({ chatId: chat.person._id, currentUserId: profileData._id }));
      }
    });
  }, [chatList, dispatch, profileData?._id]);

  const openOptions = useCallback(() => {
    const buttons: any[] = [
      unreadMessageCount > 0
        ? { text: 'Mark all as read', onPress: markAllAsRead }
        : null,
      {
        text: 'Message settings',
        onPress: () => (navigation as any).navigate('Menu', { screen: 'Settings' }),
      },
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean);
    Alert.alert('Messages', undefined, buttons);
  }, [markAllAsRead, navigation, unreadMessageCount]);

  const renderMessageItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const last = item?.messages?.[0];
    const unread = countUnread(item?.messages, profileData?._id);
    return (
      <ConversationRow
        person={item?.person}
        last={last}
        unreadCount={unread}
        isOnline={activeFriends.includes(item?.person?._id)}
        showDivider={index !== filteredChatList.length - 1}
        myId={profileData?._id}
        colors={themeColors}
        onPress={() => openChat(item?.person)}
      />
    );
  }, [activeFriends, filteredChatList.length, openChat, profileData?._id, themeColors]);

  const keyExtractor = useCallback((item: any, index: number) =>
    String(item?.person?._id || item?.id || `chat-${index}`)
  , []);

  const listHeaderComponent = useMemo(() => (
    <View>
      {peopleStrip.length > 0 && (
        <View style={styles.peopleSection}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
              {peopleStripTitle}
            </Text>
            {peopleStripTitle === 'Active now' ? (
              <View style={styles.onlineMeta}>
                <View style={[styles.onlineDot, { backgroundColor: themeColors.status.success }]} />
                <Text style={[styles.sectionCount, { color: themeColors.text.secondary }]}>
                  {peopleStrip.length}
                </Text>
              </View>
            ) : (
              <Text style={[styles.sectionCount, { color: themeColors.text.secondary }]}>
                {peopleStrip.length}
              </Text>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.peopleScroll}
            keyboardShouldPersistTaps="handled"
          >
            {peopleStrip.map((friend: any, index: number) => {
              const friendKey = friend?._id ?? friend?.id ?? `${friend?.fullName || 'friend'}-${index}`;
              const isOnline = activeFriends.includes(friend?._id);
              return (
                <Pressable
                  key={friendKey}
                  style={({ pressed }) => [styles.personItem, pressed && { opacity: 0.72 }]}
                  onPress={() => openChat(friend)}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${friend.fullName || 'friend'}${isOnline ? ', online' : ''}`}
                >
                  <UserPP image={friend.profilePic} isActive={isOnline} size={58} />
                  <Text style={[styles.personName, { color: themeColors.text.secondary }]} numberOfLines={1}>
                    {firstName(friend.fullName)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Chats</Text>
        <Text style={[styles.sectionCount, { color: themeColors.text.secondary }]}>
          {normalizedQuery
            ? `${filteredChatList.length}/${sortedChatList.length}`
            : sortedChatList.length}
        </Text>
      </View>
    </View>
  ), [
    peopleStrip,
    peopleStripTitle,
    themeColors.text.primary,
    themeColors.text.secondary,
    themeColors.status.success,
    activeFriends,
    openChat,
    normalizedQuery,
    filteredChatList.length,
    sortedChatList.length,
  ]);

  const chatListEmptyComponent = useMemo(() => {
    if (chatLoading || isLoading) {
      return <ListItemSkeleton count={8} />;
    }

    if (chatError) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: getColorWithOpacity(themeColors.status.error, 0.12) }]}>
            <Icon name="error-outline" size={28} color={themeColors.status.error} />
          </View>
          <Text style={[styles.emptyTitle, { color: themeColors.text.primary }]}>Couldn't load chats</Text>
          <Text style={[styles.emptyCopy, { color: themeColors.text.secondary }]}>
            Pull down to try again.
          </Text>
        </View>
      );
    }

    if (normalizedQuery) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: themeColors.surface.secondary }]}>
            <Icon name="search" size={28} color={themeColors.text.tertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: themeColors.text.primary }]}>
            No chats match “{searchQuery.trim()}”
          </Text>
          <Text style={[styles.emptyCopy, { color: themeColors.text.secondary }]}>
            Try a different name, or start a new conversation from People above.
          </Text>
          <Pressable
            onPress={() => setSearchQuery('')}
            style={({ pressed }) => [
              styles.emptyAction,
              { backgroundColor: themeColors.surface.secondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.emptyActionText, { color: themeColors.text.primary }]}>Clear search</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIconWrap, { backgroundColor: getColorWithOpacity(themeColors.primary, 0.14) }]}>
          <Icon name="chat-bubble-outline" size={28} color={themeColors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: themeColors.text.primary }]}>No conversations yet</Text>
        <Text style={[styles.emptyCopy, { color: themeColors.text.secondary }]}>
          Pick a friend above or find people to start chatting.
        </Text>
        <Pressable
          onPress={() => (navigation as any).navigate('Friends')}
          style={({ pressed }) => [
            styles.emptyAction,
            { backgroundColor: themeColors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={[styles.emptyActionText, { color: themeColors.text.inverse }]}>Find friends</Text>
        </Pressable>
      </View>
    );
  }, [
    chatLoading,
    isLoading,
    chatError,
    normalizedQuery,
    searchQuery,
    themeColors,
    navigation,
  ]);

  if (isCallActive) {
    return null;
  }

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.heading, { color: themeColors.text.primary }]}>Messages</Text>
          <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>{headerSubtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => (navigation as any).navigate('Friends')}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerButton,
              {
                backgroundColor: themeColors.surface.secondary,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Icon name="edit" size={20} color={themeColors.text.primary} />
          </Pressable>
          <Pressable
            onPress={openOptions}
            accessibilityRole="button"
            accessibilityLabel="Message options"
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerButton,
              {
                backgroundColor: themeColors.surface.secondary,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Icon name="more-horiz" size={22} color={themeColors.text.primary} />
          </Pressable>
        </View>
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
        <TextInput
          ref={searchInputRef}
          placeholder="Search conversations"
          placeholderTextColor={themeColors.text.tertiary}
          style={[styles.searchInput, { color: themeColors.text.primary }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search conversations"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close" size={18} color={themeColors.text.secondary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredChatList}
        renderItem={renderMessageItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={chatListEmptyComponent}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        extraData={`${activeFriends.length}-${unreadMessageCount}-${normalizedQuery}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[themeColors.primary]}
            tintColor={themeColors.primary}
          />
        }
      />
    </View>
  );
});

Message.displayName = 'Message';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  peopleSection: {
    paddingBottom: 6,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  onlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  peopleScroll: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  personItem: {
    alignItems: 'center',
    width: 72,
    marginRight: 4,
  },
  personName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 70,
    textAlign: 'center',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 76,
  },
  conversationBody: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 12,
    paddingRight: 8,
    minHeight: 76,
    justifyContent: 'center',
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  conversationName: {
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  conversationTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  conversationBottom: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  previewStatus: {
    marginRight: 4,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default Message;
