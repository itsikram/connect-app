import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, Image, TextInput, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { userAPI } from '../lib/api';
import { setProfile } from '../reducers/profileReducer';
import { RootState } from '../store';
import UserPP from '../components/UserPP';
import { useNavigation } from '@react-navigation/native';

const Message = () => {
  const dispatch = useDispatch();
  // Use proper typing for Redux state
  const profileData = useSelector((state: RootState) => state.profile);
  const [isLoading, setIsLoading] = React.useState(false);
  const [friends, setFriends] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');


  useEffect(() => {
    if (profileData?.friends.length == 0) return;
    let friends = profileData?.friends;
    setFriends(friends);
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
      {/* Search Bar */}
      <View style={{ width: '100%', marginBottom: 16 }}>
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
              const filtered = (profileData?.friends || []).filter(friend =>
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
        data={friends}
        style={styles.contactListContainer}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.messageItem} onPress={() => {
            navigation.navigate('SingleMessage', { friend: item });
          }}>
            <UserPP image={item.profilePic} isActive={item.isActive} size={40} />

            <View style={styles.messageContent}>
              <Text style={styles.profileName}>{item.fullName}</Text>
              <Text style={styles.lastMessage}>Lorem ipsum</Text>
            </View>

              </TouchableOpacity>
        )}
        keyExtractor={(item) => item._id.toString()}
        scrollEnabled={false}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
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
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: -3
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