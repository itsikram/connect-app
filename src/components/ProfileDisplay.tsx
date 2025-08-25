import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const ProfileDisplay: React.FC = () => {
  const profile = useSelector((state: RootState) => state.profile);

  if (!profile || Object.keys(profile).length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No profile data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Data from Redux Store</Text>
      <Text style={styles.text}>Username: {profile.username || 'N/A'}</Text>
      <Text style={styles.text}>Full Name: {profile.fullName || 'N/A'}</Text>
      <Text style={styles.text}>Bio: {profile.bio || 'N/A'}</Text>
      <Text style={styles.text}>Profile Pic: {profile.profilePic ? 'Set' : 'Not set'}</Text>
      <Text style={styles.text}>Cover Pic: {profile.coverPic ? 'Set' : 'Not set'}</Text>
      <Text style={styles.text}>Friends Count: {profile.friends?.length || 0}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    margin: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  text: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
});

export default ProfileDisplay;
