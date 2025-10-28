import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { userAPI, debugAuth } from '../lib/api';
import { setProfile } from '../reducers/profileReducer';
import { RootState, AppDispatch } from '../store';
import UserPP from '../components/UserPP';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import { fetchChatList, updateUnreadMessageCount } from '../reducers/chatReducer';
import moment from 'moment';
import ListItemSkeleton from '../components/skeleton/ListItemSkeleton';
import { ChatHeaderSkeleton } from '../components/skeleton/ChatSkeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';



const formatTime = (date: Date) => {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// AsyncStorage utility functions for chat list
const CHAT_LIST_STORAGE_KEY = 'chat_list';

const saveChatListToStorage = async (chatList: any[], userId: string) => {
  try {
    const storageKey = `${CHAT_LIST_STORAGE_KEY}_${userId}`;
    const dataToStore = {
      chatList,
      timestamp: new Date().toISOString(),
      userId
    };
    await AsyncStorage.setItem(storageKey, JSON.stringify(dataToStore));
    console.log('💾 Chat list saved to AsyncStorage for user:', userId);
  } catch (error) {
    console.error('❌ Error saving chat list to AsyncStorage:', error);
  }
};

const loadChatListFromStorage = async (userId: string) => {
  try {
    const storageKey = `${CHAT_LIST_STORAGE_KEY}_${userId}`;
    const storedData = await AsyncStorage.getItem(storageKey);
    
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      console.log('📱 Chat list loaded from AsyncStorage for user:', userId);
      return parsedData.chatList || [];
    }
    return [];
  } catch (error) {
    console.error('❌ Error loading chat list from AsyncStorage:', error);
    return [];
  }
};

const clearChatListFromStorage = async (userId: string) => {
  try {
    const storageKey = `${CHAT_LIST_STORAGE_KEY}_${userId}`;
    await AsyncStorage.removeItem(storageKey);
    console.log('🗑️ Chat list cleared from AsyncStorage for user:', userId);
  } catch (error) {
    console.error('❌ Error clearing chat list from AsyncStorage:', error);
  }
};

// Export the clear function for use in other components (e.g., logout)
export { clearChatListFromStorage };


const Message = React.memo(() => {
  const dispatch = useDispatch<AppDispatch>();
  const { colors: themeColors } = useTheme();
  // Use proper typing for Redux state
  const profileData = useSelector((state: RootState) => state.profile);
  const [isLoading, setIsLoading] = React.useState(false);
  const [friends, setFriends] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeFriends, setActiveFriends] = React.useState<string[]>([]);
  const { chats: chatList, loading: chatLoading, error: chatError } = useSelector((state: RootState) => state.chat as {
    chats: any[];
    loading: boolean;
    error: string | null;
  });

  const { emit, on, off, isConnected, checkUserActive } = useSocket();
  const [isCallActive, setIsCallActive] = React.useState(false);

  // Suspend rendering when a call is active (audio or video)
  useEffect(() => {
    const handleCallAccepted = ({ isAudio }: any) => {
      setIsCallActive(true);
    };
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



  // Load chat list from AsyncStorage on component mount
  useEffect(() => {
    const loadStoredChatList = async () => {
      if (profileData?._id) {
        const storedChatList = await loadChatListFromStorage(profileData._id);
        if (storedChatList.length > 0) {
          console.log('📱 Loaded stored chat list:', storedChatList.length, 'items');
          // You might want to dispatch an action to set the stored chat list in Redux
          // For now, we'll just log it since the main fetch will happen next
        }
      }
    };

    loadStoredChatList();
  }, [profileData?._id]);

  useEffect(() => {
    if (chatList && chatList.length > 0) {
      console.log('Chat list updated:', chatList.length, 'items');
    }
  }, [chatList?.length]);

  useEffect(() => {
    if (profileData?._id) {
      // Debug auth storage (optional)
      debugAuth().then(({ user, token }) => {
        console.log('🔍 Auth debug result:', { hasUser: !!user, hasToken: !!token });
      });

      console.log('📱 Message component: Fetching chat list for profile:', profileData._id);
      console.log('📱 Message component: Current chat list length:', chatList?.length || 0);
      dispatch(fetchChatList(profileData._id)).then(() => {
        // Update unread message count after fetching chat list
        dispatch(updateUnreadMessageCount(profileData._id));
      });
    }
  }, [dispatch, profileData?._id]);

  // Save chat list to AsyncStorage whenever chatList changes (debounced)
  useEffect(() => {
    if (chatList && chatList.length > 0 && profileData?._id) {
      const timeoutId = setTimeout(() => {
        saveChatListToStorage(chatList, profileData._id);
      }, 500); // Debounce saves to AsyncStorage
      return () => clearTimeout(timeoutId);
    }
  }, [chatList?.length, profileData?._id]);

  // Listen for real-time friend online/offline updates
  useEffect(() => {
    console.log('useEffect', isConnected);
    if (!isConnected) return;

    const handleFriendOnline = (data: any) => {
      const friendProfileId = data?.profileId;
      console.log('handleFriendOnline', friendProfileId);
      if (friendProfileId) {
        setActiveFriends(prev => {
          if (!prev.includes(friendProfileId)) {
            return [...prev, friendProfileId];
          }
          return prev;
        });
      }
    };

    const handleFriendOffline = (data: any) => {
      const friendProfileId = data?.profileId;
      console.log('handleFriendOffline', friendProfileId);
      if (friendProfileId) {
        setActiveFriends(prev => prev.filter(id => id !== friendProfileId));
      }
    };

    on('friend_online', handleFriendOnline);
    on('friend_offline', handleFriendOffline);

    return () => {
      off('friend_online', handleFriendOnline);
      off('friend_offline', handleFriendOffline);
    };
  }, [isConnected, on, off]);

  // Initial check for online status when contacts change
  useEffect(() => {
    if (!isConnected || !chatList || chatList.length === 0 || !profileData?._id) return;

    chatList.forEach((contact) => {
      if (!contact?.person?._id) return;
      
      // Check if friend is active
      checkUserActive(contact.person._id, profileData._id);
      
      // Listen for is_active response
      const handleIsActive = (isUserActive: boolean, lastLogin: Date, activeProfileId: string) => {
        if (isUserActive === true && activeProfileId === contact.person._id) {
          setActiveFriends(prev => {
            if (!prev.includes(activeProfileId)) {
              return [...prev, activeProfileId];
            }
            return prev;
          });
        }
      };

      on('is_active', handleIsActive);

      return () => {
        off('is_active', handleIsActive);
      };
    });
  }, [isConnected, chatList, profileData?._id, checkUserActive, on, off]);

  const navigation = useNavigation();

  const renderMessageItem = useCallback(({ item, index }: { item: any, index: number }) => {
    const last = item?.messages?.[0];
    return (
      <TouchableOpacity
        style={[
          styles.messageItem,
          {
            borderBottomColor: themeColors.border.secondary,
            borderBottomWidth: index === ((chatList?.length || 0) - 1) ? 0 : 1,
          }
        ]}
        onPress={() => {
          (navigation as any).navigate('SingleMessage', { friend: item?.person as any });
        }}
      >
        <UserPP image={item?.person?.profilePic} isActive={activeFriends.includes(item?.person?._id)} size={40} />
        <View style={styles.messageContent}>
          <Text style={[styles.profileName, { color: themeColors.text.primary }]}>{item?.person?.fullName || 'User'}</Text>
          <View style={styles.lastMessageContainer}>
            {last ? (
              <>
                <Text style={[styles.lastMessage, { color: themeColors.text.secondary }]} numberOfLines={1} ellipsizeMode="tail">
                  {(() => {
                    const messageText = last?.message || last?.text || last?.content || '';
                    return messageText.length > 0 ? messageText : 'No message content';
                  })()}
                </Text>
                <Text style={[styles.lastMessageTime, { color: themeColors.text.tertiary }]}>
                  <Text style={{ color: themeColors.text.tertiary }}> · </Text>
                  {moment(last?.timestamp).fromNow()}
                </Text>
              </>
            ) : (
              <Text style={[styles.lastMessage, { color: themeColors.text.tertiary }]} numberOfLines={1}>No messages yet</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [themeColors.border.secondary, themeColors.text.primary, themeColors.text.secondary, themeColors.text.tertiary, chatList?.length, activeFriends, navigation]);

  const keyExtractor = useCallback((item: any) =>
    (item?.person?._id && item?.person?._id.toString()) || String(item?.id || Math.random())
  , []);

  const fetchProfile = useCallback(async () => {
    try {
      if (!profileData?._id) {
        console.log('No profile ID available for fetching profile');
        return;
      }
      setIsLoading(true);
      const response = await userAPI.getProfile(profileData._id);
      console.log('Profile data:', response.data);
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
      dispatch(fetchChatList(profileData._id)).then(() => {
        // Update unread message count after refreshing chat list
        dispatch(updateUnreadMessageCount(profileData._id));
        // The chat list will be automatically saved to AsyncStorage via the useEffect
        console.log('🔄 Chat list refreshed and will be saved to AsyncStorage');
      });
    }
    if (!profileData || Object.keys(profileData).length === 0) {
      await fetchProfile();
    }
    setRefreshing(false);
  }, [profileData?._id, dispatch, fetchProfile]);


  if (isCallActive) {
    return null;
  }

  if (isLoading) {
    return (
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background.primary }]} contentContainerStyle={styles.container}>
        <ChatHeaderSkeleton />
        <Text style={[styles.heading, { color: themeColors.text.primary, marginTop: 8 }]}>Messages</Text>
        <ListItemSkeleton count={8} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background.primary }]}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[themeColors.primary]}
          tintColor={themeColors.primary}
        />
      }
    >

      
      <Text style={[styles.heading, { color: themeColors.text.primary }]}>Messages</Text>
      

      {profileData?.friends && profileData.friends.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Friends</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsScrollView}>
            {profileData.friends.map((friend: any) => (
              <TouchableOpacity
                key={friend._id}
                style={styles.friendItem}
                onPress={() => {
                  (navigation as any).navigate('Message', {
                    screen: 'FriendProfile',
                    params: { friendId: friend._id, friendData: friend }
                  });
                }}
              >
                <UserPP image={friend.profilePic} isActive={activeFriends.includes(friend._id)} size={50} />
                <Text style={[styles.friendName, { color: themeColors.text.secondary }]} numberOfLines={1}>
                  {friend.fullName || 'Friend'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}


      <View style={{ width: '100%', marginBottom: 5 }}>
        <TextInput
          placeholder="Search friends..."
          placeholderTextColor={themeColors.text.tertiary}
          style={{
            backgroundColor: themeColors.surface.secondary,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 16,
            borderWidth: 1,
            borderColor: themeColors.border.primary,
            color: themeColors.text.primary,
          }}
          value={searchQuery}
          onChangeText={text => {
            setSearchQuery(text);
            if (text.trim() === '') {
              setFriends(profileData?.friends || []);
            } else {
              const filtered = (profileData?.friends || []).filter((friend: any) =>
                (friend.fullName || '')
                  .toLowerCase()
                  .includes(text.toLowerCase())
              );
              setFriends(filtered);
            }
          }}
        />

        <View style={{
          position: 'absolute',
          right: 12,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          height: '100%',
        }}>
          <Text style={{ fontSize: 20, color: themeColors.text.tertiary }}>🔍</Text>
        </View>

      </View>



      {(!profileData || Object.keys(profileData).length === 0) && (
        <View style={[styles.noDataSection, { 
          backgroundColor: themeColors.surface.secondary, 
          borderColor: themeColors.border.secondary 
        }]}>
          <Text style={[styles.noDataText, { color: themeColors.text.secondary }]}>No profile data available</Text>
        </View>
      )}

      <FlatList
        data={chatList}
        style={styles.contactListContainer}
        renderItem={renderMessageItem}
        keyExtractor={keyExtractor}
        scrollEnabled={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        ListEmptyComponent={<ListItemSkeleton count={8} />}
      />
    </ScrollView>
  );
});

Message.displayName = 'Message';

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 10,
  },
  friendsScrollView: {
    paddingVertical: 6,
  },
  friendItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  friendName: {
    marginTop: 6,
    maxWidth: 70,
    fontSize: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 10,
    paddingBottom: 90,
  },
  contactListContainer: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',

  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileSection: {
    width: '100%',
    marginVertical: 20,
    padding: 15,
    borderRadius: 8,

  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,

  },
  messageContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  lastMessageContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lastMessage: {
    maxWidth: '70%',
    fontSize: 14,
    lineHeight: 18,
  },
  lastMessageTime: {
    fontSize: 12,
    marginTop: -3,
  },
  profileKey: {
    fontWeight: '600',
    marginRight: 5,
  },
  profileValue: {
    flex: 1,
  },
  messageItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
  },
  noDataSection: {
    width: '100%',
    marginVertical: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
  },
});

export default Message; 