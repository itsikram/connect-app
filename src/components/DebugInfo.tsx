import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';

interface DebugInfoProps {
  user: any;
  isLoading: boolean;
  isDarkMode: boolean;
  posts: any[];
  profile: any;
}

const DebugInfo: React.FC<DebugInfoProps> = ({ user, isLoading, isDarkMode, posts, profile }) => {
  if (!__DEV__) return null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Debug Information</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App State</Text>
        <Text style={styles.text}>Loading: {isLoading ? 'Yes' : 'No'}</Text>
        <Text style={styles.text}>Dark Mode: {isDarkMode ? 'Yes' : 'No'}</Text>
        <Text style={styles.text}>User: {user ? 'Logged In' : 'Not Logged In'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Data</Text>
        <Text style={styles.text}>User ID: {user?.user_id || 'N/A'}</Text>
        <Text style={styles.text}>Name: {user?.firstName} {user?.surname}</Text>
        <Text style={styles.text}>Profile: {user?.profile ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile State</Text>
        <Text style={styles.text}>Profile ID: {profile?._id || 'N/A'}</Text>
        <Text style={styles.text}>Profile Name: {profile?.fullName || 'N/A'}</Text>
        <Text style={styles.text}>Profile Pic: {profile?.profilePic ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posts</Text>
        <Text style={styles.text}>Count: {posts?.length || 0}</Text>
        <Text style={styles.text}>First Post ID: {posts?.[0]?._id || 'N/A'}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background.light,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
});

export default DebugInfo;
