import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { colors } from '../theme/colors';

const SUGGESTED_FRIENDS = [
  {
    id: '1',
    name: 'Mohammad Ikram',
    profilePic: 'https://res.cloudinary.com/dz88yjerw/image/upload/v1746447796/yvxxljetumsl9sjezggu.png',
  },
  {
    id: '2',
    name: 'Md Atik',
    profilePic: 'http://res.cloudinary.com/dz88yjerw/image/upload/v1743050609/i6cnhplhlunwrzh8v916.png',
  },
  {
    id: '3',
    name: 'Md Alamin',
    profilePic: 'http://res.cloudinary.com/dz88yjerw/image/upload/v1743600479/yzdagmwjzeb4axm5wvbg.png',
  },
  {
    id: '4',
    name: 'Gorila Sohan',
    profilePic: 'http://res.cloudinary.com/dz88yjerw/image/upload/v1743970799/v2qocxpe0j4uzxmnt8hv.png',
  },
  {
    id: '5',
    name: 'Mohammad Mehedi Hassan',
    profilePic: 'https://res.cloudinary.com/dz88yjerw/image/upload/v1746960769/ixntnekeyvcfy2xghqx8.png',
  },
  {
    id: '6',
    name: 'Md Byzid',
    profilePic: 'https://res.cloudinary.com/dz88yjerw/image/upload/v1747904851/pd6ifljwvoiyor8rmzjf.png',
  },
  {
    id: '7',
    name: 'Rohan Sheikh',
    profilePic: 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png',
  },
  {
    id: '8',
    name: 'Tuhin Sheikh',
    profilePic: 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png',
  },
  {
    id: '9',
    name: 'MD. Shamim Hossan',
    profilePic: 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png',
  },
  {
    id: '10',
    name: 'ssa dsasdgsadtest',
    profilePic: 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png',
  },
  {
    id: '11',
    name: 'asdas asdasd',
    profilePic: 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png',
  },
  {
    id: '12',
    name: 'md Tayem',
    profilePic: 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png',
  },
];

const Friends = () => {
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
          <Text style={[styles.dataNotFound, { color: subTextColor }]}>You don't have any Friend Request to show</Text>
        </View>
      </View>

      {/* People You May Know Section */}
      <View style={[styles.sectionContainer, { marginBottom: 32, backgroundColor: cardBg }]}> 
        <View style={styles.headingRow}>
          <Text style={[styles.headingTitle, { color: textColor }]}>People You May Know</Text>
        </View>
        <View style={styles.friendGridContainer}>
          {SUGGESTED_FRIENDS.map(friend => (
            <View key={friend.id} style={[styles.friendGridItem, { backgroundColor: cardBg }]}> {/* Card */}
              <View style={styles.profilePictureWrapper}>
                <Image source={{ uri: friend.profilePic }} style={styles.profilePicture} />
              </View>
              <View style={styles.gridBody}>
                <Text style={[styles.profileName, { color: textColor }]}>{friend.name}</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: buttonBg }]}> {/* Add Friend */}
                    <Text style={[styles.addFriendBtnText, { color: buttonText }]}>Add Friend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.removeFriendBtn, { backgroundColor: removeBtnBg }]}> {/* Remove */}
                    <Text style={[styles.removeFriendBtnText, { color: removeBtnText }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
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
    justifyContent: 'flex-start',
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
    backgroundColor: '#f9f9f9',
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
    alignItems: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'column',
    marginTop: 4,
    width: '100%',
    gap: 0,
    justifyContent: 'center',
  },
  addFriendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  addFriendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
  },
});

export default Friends; 