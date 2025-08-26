import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useUserToast } from '../contexts/UserToastContext';
import { colors } from '../theme/colors';

const UserToastExample: React.FC = () => {
  const { 
    showUserToast, 
    showMessageToast, 
    showFriendRequestToast, 
    showNotificationToast 
  } = useUserToast();

  // Sample user data
  const sampleUsers = [
    {
      id: 1,
      name: 'Sarah Johnson',
      profilePic: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      message: 'Hey! How are you doing today?',
    },
    {
      id: 2,
      name: 'Mike Chen',
      profilePic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      message: 'Thanks for the help yesterday!',
    },
    {
      id: 3,
      name: 'Emma Wilson',
      profilePic: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      message: 'Can we meet for coffee tomorrow?',
    },
    {
      id: 4,
      name: 'Alex Rodriguez',
      profilePic: undefined, // No profile pic
      message: 'Just wanted to say hi!',
    },
  ];

  const handleShowMessageToast = (user: any) => {
    showMessageToast({
      userProfilePic: user.profilePic,
      fullName: user.name,
      message: user.message,
      onPress: () => {
        console.log(`Navigate to chat with ${user.name}`);
        // You can navigate to the chat screen here
      },
    });
  };

  const handleShowFriendRequestToast = (user: any) => {
    showFriendRequestToast({
      userProfilePic: user.profilePic,
      fullName: user.name,
      onPress: () => {
        console.log(`Navigate to friend request from ${user.name}`);
        // You can navigate to the friend request screen here
      },
    });
  };

  const handleShowNotificationToast = (user: any) => {
    showNotificationToast({
      userProfilePic: user.profilePic,
      fullName: user.name,
      message: `${user.name} liked your post`,
      onPress: () => {
        console.log(`Navigate to notification from ${user.name}`);
        // You can navigate to the notification screen here
      },
    });
  };

  const handleShowCustomToast = (user: any) => {
    showUserToast({
      userProfilePic: user.profilePic,
      fullName: user.name,
      message: 'This is a custom toast message',
      type: 'custom',
      duration: 8000,
      onPress: () => {
        console.log(`Custom action for ${user.name}`);
      },
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>User Toast Examples</Text>
      <Text style={styles.subtitle}>
        Tap the buttons below to see different types of user toasts
      </Text>

      {sampleUsers.map((user) => (
        <View key={user.id} style={styles.userCard}>
          <View style={styles.userInfo}>
            <View style={styles.profilePicContainer}>
              {user.profilePic ? (
                <Image source={{ uri: user.profilePic }} style={styles.profilePic} />
              ) : (
                <View style={[styles.profilePic, styles.defaultProfilePic]}>
                  <Text style={styles.defaultProfileText}>
                    {user.name.charAt(0)}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userMessage}>{user.message}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => handleShowMessageToast(user)}
            >
              <Text style={styles.buttonText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.secondary }]}
              onPress={() => handleShowFriendRequestToast(user)}
            >
              <Text style={styles.buttonText}>Friend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.info }]}
              onPress={() => handleShowNotificationToast(user)}
            >
              <Text style={styles.buttonText}>Notify</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.gray[800] }]}
              onPress={() => handleShowCustomToast(user)}
            >
              <Text style={styles.buttonText}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>User Toast Features:</Text>
        <Text style={styles.infoText}>• Profile picture display with fallback</Text>
        <Text style={styles.infoText}>• User's full name prominently displayed</Text>
        <Text style={styles.infoText}>• Customizable message content</Text>
        <Text style={styles.infoText}>• Different types: Message, Friend, Notification, Custom</Text>
        <Text style={styles.infoText}>• Tap to navigate to relevant screen</Text>
        <Text style={styles.infoText}>• Auto-dismiss with configurable duration</Text>
        <Text style={styles.infoText}>• Smooth animations and professional design</Text>
        <Text style={styles.infoText}>• Status bar aware positioning</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicContainer: {
    marginRight: 16,
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gray[200],
  },
  defaultProfilePic: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  defaultProfileText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  userMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default UserToastExample;
