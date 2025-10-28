import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StatusBar, Animated, Dimensions, StyleSheet, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import Video from 'react-native-video';

interface OutgoingCallParams {
  calleeId: string;
  calleeName: string;
  calleeProfilePic?: string;
  channelName: string;
  isAudio: boolean;
}

const { width, height } = Dimensions.get('window');

const OutgoingCall: React.FC = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute();
  const { startVideoCall, startAudioCall, endVideoCall, endAudioCall, on, off } = useSocket();
  const [callStatus, setCallStatus] = useState('Calling...');
  const [playBeep, setPlayBeep] = useState(true);

  // Reset status bar when leaving this screen to avoid translucent persisting globally
  React.useEffect(() => {
    return () => {
      try {
        if (Platform.OS === 'android') {
          StatusBar.setTranslucent(false);
          StatusBar.setBackgroundColor(themeColors.background.primary);
        }
        StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
      } catch (e) {}
    };
  }, [isDarkMode, themeColors.background.primary]);

  // Animation values
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const slideAnim = useMemo(() => new Animated.Value(50), []);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const rotateAnim = useMemo(() => new Animated.Value(0), []);

  const safeGoBack = () => {
    try {
      if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
        (navigation as any).navigate('Message', { screen: 'Home' });
      } else {
        (navigation as any).navigate('Message', { screen: 'MessageList' });
      }
    } catch (e) {}
  };

  const params = route.params as unknown as OutgoingCallParams;
  const { calleeId, calleeName, calleeProfilePic, channelName, isAudio } = params || {} as OutgoingCallParams;

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
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Rotating animation for call status
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotateAnimation.stop();
    };
  }, []);

  useEffect(() => {
    if (!calleeId || !channelName) {
      console.warn('OutgoingCall: Missing required parameters', { calleeId, channelName });
      navigation.navigate('Message', { screen: 'Home' });
      return;
    }
    
    console.log('OutgoingCall: Initiating call', { calleeId, channelName, isAudio });
    // Initiate call once when screen opens
    if (isAudio) {
      startAudioCall(calleeId, channelName);
    } else {
      startVideoCall(calleeId, channelName);
    }
  }, [calleeId, channelName, isAudio, startAudioCall, startVideoCall]);

  // Close this screen once the peer accepts or ends the call
  useEffect(() => {
    const handleAccepted = () => { 
      setPlayBeep(false);
      setCallStatus('Call accepted!');
      setTimeout(() => safeGoBack(), 500);
    };
    const handleEnd = () => { 
      setPlayBeep(false);
      setCallStatus('Call ended');
      setTimeout(() => safeGoBack(), 1000);
    };

    on('call-accepted', handleAccepted);
    on(isAudio ? 'audio-call-ended' : 'video-call-ended', handleEnd);

    return () => {
      off('call-accepted', handleAccepted);
      off(isAudio ? 'audio-call-ended' : 'video-call-ended', handleEnd);
    };
  }, [on, off, navigation, isAudio]);

  const title = useMemo(() => (isAudio ? 'Outgoing Audio Call' : 'Outgoing Video Call'), [isAudio]);

  const onCancel = () => {
    if (!calleeId) return;
    setPlayBeep(false);
    setCallStatus('Cancelling...');
    if (isAudio) {
      endAudioCall(calleeId);
    } else {
      endVideoCall(calleeId);
    }
    setTimeout(() => safeGoBack(), 500);
  };

  // Ensure beep stops on unmount
  useEffect(() => {
    return () => {
      setPlayBeep(false);
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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
        
        {/* Beep sound player */}
        {playBeep && (
          <Video
            source={require('../assets/audio/calling-beep.mp3')}
            paused={!playBeep}
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
              {calleeProfilePic ? (
                <Image 
                  source={{ uri: calleeProfilePic }} 
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
            
            {/* Calling indicator dots */}
            <View style={styles.callingIndicator}>
              <Animated.View 
                style={[
                  styles.callingDot,
                  { transform: [{ rotate: spin }] }
                ]}
              />
            </View>
          </Animated.View>

          {/* Callee Name */}
          <Text style={styles.calleeName}>
            {calleeName || 'Unknown User'}
          </Text>

          {/* Call Status */}
          <Text style={styles.callStatus}>
            {callStatus}
          </Text>

          {/* Action Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.actionButton, styles.cancelButton]}
              activeOpacity={0.8}
            >
              <Icon name="call-end" size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Call Duration (for future use) */}
          <Text style={styles.callDuration}>
            Tap to cancel
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
    position: 'relative',
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
  callingIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  calleeName: {
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
    justifyContent: 'center',
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
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  callDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default OutgoingCall;
