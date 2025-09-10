import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StatusBar, Animated, Dimensions, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import Video from 'react-native-video';

interface IncomingCallParams {
  callerId: string;
  callerName: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  autoAccept?: boolean;
}

const { width, height } = Dimensions.get('window');

const IncomingCall: React.FC = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute();
  const { answerVideoCall, answerAudioCall, endVideoCall, endAudioCall, on, off } = useSocket();
  const [playRingtone, setPlayRingtone] = useState(true);
  
  // Animation values
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const slideAnim = useMemo(() => new Animated.Value(50), []);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);

  const safeGoBack = () => {
    try {
      if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
        (navigation as any).goBack();
      } else {
        (navigation as any).navigate('Message', { screen: 'MessageList' });
      }
    } catch (e) {}
  };

  const params = route.params as unknown as IncomingCallParams;
  const { callerId, callerName, callerProfilePic, channelName, isAudio, autoAccept } = params || {} as IncomingCallParams;

  // Start animations on mount
  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Slide up animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Pulse animation for profile picture
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, []);

  useEffect(() => {
    if(playRingtone) {
      // Trigger incoming call notification when ringtone starts playing
      import('../lib/push').then(({ displayIncomingCallNotification }) => {
        displayIncomingCallNotification({
          callerName: callerName || 'Unknown Caller',
          callerProfilePic: callerProfilePic || '',
          channelName: channelName || '',
          isAudio: isAudio || false,
          callerId: callerId || '',
        });
      }).catch(error => {
        console.error('Error displaying incoming call notification:', error);
      });
    }
  }, [playRingtone, callerName, callerProfilePic, channelName, isAudio, callerId]);

  useEffect(() => {
    if (!callerId || !channelName) {
      navigation.goBack();
    }
  }, [callerId, channelName, navigation]);

  // Auto-accept call if autoAccept flag is set (from notification button)
  useEffect(() => {
    if (autoAccept && callerId && channelName) {
      console.log('Auto-accepting call from notification');
      onAccept();
    }
  }, [autoAccept, callerId, channelName]);

  const title = useMemo(() => (isAudio ? 'Incoming Audio Call' : 'Incoming Video Call'), [isAudio]);

  const onAccept = () => {
    if (!callerId || !channelName) {
      console.warn('IncomingCall: Missing required parameters for call acceptance', { callerId, channelName });
      return;
    }
    
    console.log('IncomingCall: Accepting call', { callerId, channelName, isAudio, callerName });
    setPlayRingtone(false);
    if (isAudio) {
      answerAudioCall(callerId, channelName);
    } else {
      answerVideoCall(callerId, channelName);
    }
    
    // Navigate back - call components are now global and will show automatically
    safeGoBack();
  };

  const onDecline = () => {
    if (!callerId) return;
    setPlayRingtone(false);
    if (isAudio) {
      endAudioCall(callerId);
    } else {
      endVideoCall(callerId);
    }
    safeGoBack();
  };

  // Close this screen if the remote cancels/ends before we accept
  useEffect(() => {
    const handleEnd = () => {
      setPlayRingtone(false);
      safeGoBack();
    };
    const handleAccepted = () => {
      setPlayRingtone(false);
      safeGoBack();
    };

    on('videoCallEnd', handleEnd);
    on('audioCallEnd', handleEnd);
    on('agora-call-accepted', handleAccepted);

    return () => {
      off('videoCallEnd', handleEnd);
      off('audioCallEnd', handleEnd);
      off('agora-call-accepted', handleAccepted);
    };
  }, [on, off, navigation]);

  // Ensure ringtone stops on unmount
  useEffect(() => {
    return () => setPlayRingtone(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background with gradient effect */}
      <View style={[
        styles.gradientBackground,
        { backgroundColor: isDarkMode ? '#0F0F0F' : '#667eea' }
      ]}>
        <View style={[
          styles.gradientOverlay,
          { backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.8)' : 'rgba(118, 75, 162, 0.8)' }
        ]} />
        <View style={[
          styles.gradientOverlay2,
          { backgroundColor: isDarkMode ? 'rgba(45, 45, 45, 0.6)' : 'rgba(240, 147, 251, 0.6)' }
        ]} />
        {/* Ringtone player */}
        {playRingtone && (
          <Video
            source={require('../assets/ringtones/my_awesome_ringtone.mp3')}
            paused={!playRingtone}
            repeat
            muted={false}
            playInBackground
            ignoreSilentSwitch="ignore"
            volume={1.0}
            style={{ width: 0, height: 0 }}
          />
        )}

        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Call Type Indicator */}
          <View style={styles.callTypeContainer}>
            <View style={[
              styles.callTypeBadge,
              { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)' }
            ]}>
              <Icon 
                name={isAudio ? "mic" : "videocam"} 
                size={20} 
                color="white" 
              />
              <Text style={styles.callTypeText}>
                {isAudio ? 'Audio Call' : 'Video Call'}
              </Text>
            </View>
          </View>

          {/* Profile Picture with Animation */}
          <Animated.View 
            style={[
              styles.profileContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <View style={[
              styles.profileRing,
              { borderColor: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)' }
            ]}>
              {callerProfilePic ? (
                <Image 
                  source={{ uri: callerProfilePic }} 
                  style={styles.profileImage} 
                />
              ) : (
                <View style={[
                  styles.profilePlaceholder,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)' }
                ]}>
                  <Icon name="person" size={60} color="white" />
                </View>
              )}
            </View>
          </Animated.View>

          {/* Caller Name */}
          <Text style={styles.callerName}>
            {callerName || 'Unknown Caller'}
          </Text>

          {/* Call Status */}
          <Text style={styles.callStatus}>
            Incoming call...
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Decline Button */}
            <TouchableOpacity
              onPress={onDecline}
              style={[styles.actionButton, styles.declineButton]}
              activeOpacity={0.8}
            >
              <Icon name="call-end" size={28} color="white" />
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              onPress={onAccept}
              style={[styles.actionButton, styles.acceptButton]}
              activeOpacity={0.8}
            >
              <Icon name="call" size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Call Duration (for future use) */}
          <Text style={styles.callDuration}>
            Tap to answer
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  callTypeContainer: {
    marginBottom: 40,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  callTypeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  profileContainer: {
    marginBottom: 32,
  },
  profileRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  profileImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  profilePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 60,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 40,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  callDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default IncomingCall;
