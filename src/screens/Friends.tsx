import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { colors } from '../theme/colors';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { friendAPI } from '../lib/api';
import { useNavigation } from '@react-navigation/native';


const Friends = () => {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const backgroundColor = isDarkMode ? colors.background.dark : colors.background.light;
  const cardBg = isDarkMode ? colors.background.dark : '#fff';
  const textColor = isDarkMode ? colors.text.light : colors.text.primary;
  const subTextColor = isDarkMode ? colors.gray[400] : '#888';
  const buttonBg = colors.primary;
  const buttonText = '#fff';
  const removeBtnBg = isDarkMode ? colors.gray[800] : '#eee';
  const removeBtnText = isDarkMode ? colors.text.light : '#333';
  const myProfile = useSelector((state: RootState) => state.profile);

  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friendSuggestions, setFriendSuggestions] = useState<any[]>([]);



  useEffect(() => {
    if (!myProfile?._id) return;
    friendAPI.getFriendRequest(myProfile?._id).then((res) => {
      setFriendRequests(res.data);
    });
    friendAPI.getFriendSuggestions(myProfile?._id).then((res) => {
      setFriendSuggestions(res.data);
    });
  }, [myProfile?._id]);

  const handleSendFriendRequest = async (friendId: string) => {
    try {
      const res = await friendAPI.sendFriendRequest(friendId);
      console.log(res.data);
      setFriendSuggestions((prev) => prev.filter((f: any) => f._id !== friendId));
    } catch (error) {
      console.log(error);
    }
  };
  const handleRemoveFriendRequest = async (friendId: string) => {
    try {
      const res = await friendAPI.removeFriend(friendId);
      console.log(res.data);
      // Hide from suggestions if present
      setFriendSuggestions((prev) => prev.filter((f: any) => f._id !== friendId));
    } catch (error) {
      console.log(error);
    }
  };

  const handleAcceptFriendRequest = async (friendId: string) => {
    console.log('accept friend request', friendId);
    try {
      const res = await friendAPI.acceptFriendRequest(friendId);
      console.log(res.data);
      // Remove the accepted request from the list
      setFriendRequests((prev) => prev.filter((f: any) => f._id !== friendId));
    } catch (error) {
      console.log(error);
    }
  };

  const handleDeleteFriendRequest = async (friendId: string) => {
    try {
      const res = await friendAPI.deleteFriendRequest(friendId);
      console.log(res.data);
      // Remove the deleted request from the list
      setFriendRequests((prev) => prev.filter((f: any) => f._id !== friendId));
    } catch (error) {
      console.log(error);
    }
  };

  const navigateToFriendProfile = (friend: any) => {
    (navigation as any).navigate('Message', {
      screen: 'FriendProfile',
      params: { friendId: friend._id, friendData: friend }
    });
  };

  return (
    <ScrollView style={[styles.friendsContent, { backgroundColor }]}> {/* Main container */}

      
      {/* Friend Requests Section */}
      <View style={[styles.sectionContainer, { backgroundColor: cardBg }]}> {/* Card */}
        <View style={styles.headingRow}>
          <Text style={[styles.headingTitle, { color: textColor }]}>Friend Requests</Text>
          <TouchableOpacity>
            <Text style={[styles.viewMoreBtn, { color: colors.primary }]}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.friendGridContainer}>
          {friendRequests.length > 0 && friendRequests.map((friend: any) => (
            <TouchableOpacity key={friend._id} style={[styles.friendGridItem, { backgroundColor: cardBg }]} onPress={() => navigateToFriendProfile(friend)}> {/* Card */}
              <View style={styles.profilePictureWrapper}>
                <Image source={{ uri: friend.profilePic }} style={styles.profilePicture} />
              </View>
              <View style={styles.gridBody}>
                <Text style={[styles.profileName, { color: textColor }]}>{friend.fullName}</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: buttonBg }]} onPress={() => { handleAcceptFriendRequest(friend._id); }}> {/* Add Friend */}
                    <Text style={[styles.addFriendBtnText, { color: buttonText }]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.removeFriendBtn, { backgroundColor: removeBtnBg }]} onPress={() => { handleDeleteFriendRequest(friend._id); }}> {/* Remove */}
                    <Text style={[styles.removeFriendBtnText, { color: removeBtnText }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {friendRequests.length === 0 && (
            <Text style={[styles.dataNotFound, { color: subTextColor }]}>You don't have any Friend Request to show</Text>
          )}
        </View>
      </View>

      {/* People You May Know Section */}
      <View style={[styles.sectionContainer, { marginBottom: 32, backgroundColor: cardBg }]}>
        <View style={styles.headingRow}>
          <Text style={[styles.headingTitle, { color: textColor }]}>People You May Know</Text>
        </View>
        <View style={styles.friendGridContainer}>
          {friendSuggestions.length > 0 && friendSuggestions.map((friend: any) => (
            <TouchableOpacity key={friend._id} style={[styles.friendGridItem, { backgroundColor: cardBg }]} onPress={() => navigateToFriendProfile(friend)}> {/* Card */}
              <View style={styles.profilePictureWrapper}>
                <Image source={{ uri: friend.profilePic }} style={styles.profilePicture} />
              </View>
              <View style={styles.gridBody}>
                <Text style={[styles.profileName, { color: textColor }]}>{friend.fullName}</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: buttonBg }]} onPress={() => { handleSendFriendRequest(friend._id); }}> {/* Add Friend */}
                    <Text style={[styles.addFriendBtnText, { color: buttonText }]}>Add Friend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.removeFriendBtn, { backgroundColor: removeBtnBg }]} onPress={() => { handleRemoveFriendRequest(friend._id); }}> {/* Remove */}
                    <Text style={[styles.removeFriendBtnText, { color: removeBtnText }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {friendSuggestions.length === 0 && (
            <Text style={[styles.dataNotFound, { color: subTextColor }]}>You don't have any Friend Suggestions to show</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  friendsContent: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    padding: 12,
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  viewMoreBtn: {
    color: '#007bff',
    fontSize: 15,
    fontWeight: '500',
  },
  friendGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dataNotFound: {
    width: '100%',
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginVertical: 16,
  },
  friendGridItem: {
    width: '48%',
    borderRadius: 10,
    margin: '1%',
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  profilePictureWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridBody: {
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 6,
    padding: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'column',
    marginTop: 4,
    width: '100%',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 3,
    width: '100%',
    alignSelf: 'stretch',
  },
  addFriendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  removeFriendBtn: {
    backgroundColor: '#eee',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  removeFriendBtnText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default Friends; 