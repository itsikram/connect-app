import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { userAPI, debugAuth } from '../lib/api';
import { setProfile } from '../reducers/profileReducer';
import { RootState, AppDispatch } from '../store';
import UserPP from '../components/UserPP';
import { useNavigation } from '@react-navigation/native';
// import { useSocket } from '../contexts/SocketContext';
import { fetchChatList } from '../reducers/chatReducer';
import moment from 'moment';



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


const Message = () => {
  const dispatch = useDispatch<AppDispatch>();
  // Use proper typing for Redux state
  const profileData = useSelector((state: RootState) => state.profile);
  const [isLoading, setIsLoading] = React.useState(false);
  const [friends, setFriends] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const { chats: chatList, loading: chatLoading, error: chatError } = useSelector((state: RootState) => state.chat as {
    chats: any[];
    loading: boolean;
    error: string | null;
  });

  // const { emit, on, off, isConnected } = useSocket();



  useEffect(() => {
    if (chatList) {
      console.log('Chat list:', chatList);
    }
  }, [chatList]);


  useEffect(() => {
    if (profileData?._id) {
      // Debug auth storage first
      debugAuth().then(({ user, token }) => {
        console.log('🔍 Auth debug result:', { hasUser: !!user, hasToken: !!token });
      });

      dispatch(fetchChatList(profileData?._id));


    }
  }, [profileData]);

  const navigation = useNavigation();


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const response = await userAPI.getProfile();
        console.log('Profile data:', response.data);
        dispatch(setProfile(response.data));
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if profile data is empty
    if (!profileData || Object.keys(profileData).length === 0) {
      fetchProfile();
    }
  }, [dispatch, profileData]);


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >

      
      <Text style={styles.heading}>Messages</Text>
      
      {/* Friends Section */}
      {profileData?.friends && profileData.friends.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Friends</Text>
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
                <UserPP image={friend.profilePic} isActive={friend.isActive} size={50} />
                <Text style={styles.friendName} numberOfLines={1}>
                  {friend.fullName || 'Friend'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search Bar */}
      <View style={{ width: '100%', marginBottom: 5 }}>
        <TextInput
          placeholder="Search friends..."
          style={{
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 16,
            borderWidth: 1,
            borderColor: '#ddd',
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
          <Text style={{ fontSize: 20, color: '#888' }}>🔍</Text>
        </View>

      </View>


      {/* Show message if no profile data */}
      {(!profileData || Object.keys(profileData).length === 0) && (
        <View style={styles.noDataSection}>
          <Text style={styles.noDataText}>No profile data available</Text>
        </View>
      )}

      <FlatList
        data={chatList}
        style={styles.contactListContainer}
        renderItem={({ item }: { item: any }) => {
          const last = item?.messages?.[0];
          return (
            <TouchableOpacity
              style={styles.messageItem}
              onPress={() => {
                (navigation as any).navigate('SingleMessage', { friend: item?.person as any });
              }}
            >
              <UserPP image={item?.person?.profilePic} isActive={item?.person?.isActive} size={40} />
              <View style={styles.messageContent}>
                <Text style={styles.profileName}>{item?.person?.fullName || 'User'}</Text>
                <View style={styles.lastMessageContainer}>
                  {last ? (
                    <>
                      <Text style={styles.lastMessage} numberOfLines={1}>{last?.message}</Text>
                      <Text style={styles.lastMessageTime}>
                        <Text style={{ color: '#666' }}> · </Text>
                        {moment(last?.timestamp).fromNow()}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.lastMessage}>No messages yet</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item: any) =>
          (item?.person?._id && item?.person?._id.toString()) || String(item?.id || Math.random())
        }
        scrollEnabled={false}
      />
    </ScrollView>
  );
};

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
    color: '#333',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  container: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 10,

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
    color: '#333',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileSection: {
    width: '100%',
    marginVertical: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,

  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',

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
    color: '#666',
    maxWidth: '70%',
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#666',
    marginTop: -3,
  },
  profileKey: {
    fontWeight: '600',
    color: '#666',
    marginRight: 5,
  },
  profileValue: {
    color: '#333',
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
    borderBottomColor: '#e0e0e0',
  },
  noDataSection: {
    width: '100%',
    marginVertical: 20,
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  noDataText: {
    color: '#856404',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default Message; 