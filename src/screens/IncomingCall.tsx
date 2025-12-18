import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StatusBar, Animated, Dimensions, StyleSheet, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import Video from 'react-native-video';

interface IncomingCallParams {
  callerId: string;
  callerName: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  autoAccept?: boolean;
  prevScreenId?: string;
}

const { width, height } = Dimensions.get('window');

const IncomingCall: React.FC = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute();
  const { answerVideoCall, answerAudioCall, endVideoCall, endAudioCall, on, off, emit } = useSocket();
  const [statusText, setStatusText] = useState<string>('Incoming call...');
  const [playRingtone, setPlayRingtone] = useState(true);
  const [callAccepted, setCallAccepted] = useState(false);
  const lastCallEndTime = useRef<number>(0);
  const callEndDebounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const params = route.params as unknown as IncomingCallParams;

  const { callerId, callerName, callerProfilePic, channelName, isAudio, autoAccept, prevScreenId } = params || {} as IncomingCallParams;

  const myProfile = useSelector((state: RootState) => state.profile);

  // Animation values
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const slideAnim = useMemo(() => new Animated.Value(50), []);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const acceptButtonPulse = useMemo(() => new Animated.Value(1), []);

  const safeGoBack = () => {
    console.log('IncomingCall: Going back', prevScreenId);
    setPlayRingtone(false);

    // Log previous screen ID
    try {

      (navigation as any).navigate(prevScreenId, { screen: prevScreenId === "Message" ? "MessageList" : (prevScreenId || 'Home') });


    } catch (stateError) {
      (navigation as any).navigate('Home', { screen: 'Home' });
    }

    // try {
    //   if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
    //     (navigation as any).navigate('Message', { screen: 'Home' });
    //   } else {
    //     (navigation as any).navigate('Message', { screen: 'MessageList' });
    //   }
    // } catch (e) {
    //   (navigation as any).navigate('Message', { screen: 'Home' });
    //   console.log('IncomingCall: Error going back', e);
    // }
  };


  // Log the previous screen ID
  useEffect(() => {
    if (prevScreenId) {
      console.log('Previous screen ID from params:', prevScreenId);
    }
  }, [prevScreenId]);

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

    // Accept button pulse animation
    const acceptButtonAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(acceptButtonPulse, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(acceptButtonPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    acceptButtonAnimation.start();

    return () => {
      pulseAnimation.stop();
      acceptButtonAnimation.stop();
    };
  }, []);

  // Reset status bar when leaving this screen to avoid translucent persisting globally
  useEffect(() => {
    return () => {
      try {
        if (Platform.OS === 'android') {
          StatusBar.setTranslucent(false);
          StatusBar.setBackgroundColor(themeColors.background.primary);
        }
        StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
      } catch (e) { }
    };
  }, [isDarkMode, themeColors.background.primary]);

  useEffect(() => {
    if (playRingtone) {
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
      try {
        if (Platform.OS === 'android') {
          StatusBar.setTranslucent(false);
          StatusBar.setBackgroundColor(themeColors.background.primary);
        }
        StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
      } catch (e) { }
      navigation.navigate('Message', { screen: 'Home' });
    }
  }, [callerId, channelName, navigation, isDarkMode, themeColors.background.primary]);

  // Check if call is still active - if not, go back immediately
  // This effect only handles the case where call ends BEFORE acceptance
  useEffect(() => {
    const checkCallActive = () => {
      // If we don't have the required parameters, exit
      if (!callerId || !channelName) {
        console.log('IncomingCall: Missing parameters, exiting');
        navigation.navigate('Message', { screen: 'Home' });
        return;
      }

      // Check if call was already ended by listening to call end events
      const handleCallEnd = () => {
        setPlayRingtone(false);
        // If call was accepted, don't handle here (let VideoCall/AudioCall handle it)
        if (callAccepted) {
          console.log('IncomingCall: Call accepted, ignoring early call end check');
          return;
        }

        // Debounce rapid-fire call end events (prevent processing same event within 1 second)
        const now = Date.now();
        if (now - lastCallEndTime.current < 1000) {
          console.log('IncomingCall: Ignoring rapid-fire call end event');
          return;
        }
        lastCallEndTime.current = now;

        // Clear any existing debounce timeout
        if (callEndDebounceTimeout.current) {
          clearTimeout(callEndDebounceTimeout.current);
        }

        // Debounce the call end handling
        callEndDebounceTimeout.current = setTimeout(() => {
          console.log('IncomingCall: Call ended before user could respond, exiting');
          // Ensure StatusBar is restored before leaving this screen
          try {
            if (Platform.OS === 'android') {
              StatusBar.setTranslucent(false);
              StatusBar.setBackgroundColor(themeColors.background.primary);
            }
            StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
          } catch (e) { }
          safeGoBack();
        }, 300); // 300ms debounce
      };
      const handleCallCancel = (data: any) => {
        setPlayRingtone(false);

        // If call was accepted, don't handle here (let VideoCall/AudioCall handle it)
        if (callAccepted) {
          console.log('IncomingCall: Call accepted, ignoring early call end check');
          return;
        }

        // Debounce rapid-fire call end events (prevent processing same event within 1 second)
        const now = Date.now();
        if (now - lastCallEndTime.current < 1000) {
          console.log('IncomingCall: Ignoring rapid-fire call end event');
          return;
        }
        lastCallEndTime.current = now;

        // Clear any existing debounce timeout
        if (callEndDebounceTimeout.current) {
          clearTimeout(callEndDebounceTimeout.current);
        }

        // Debounce the call end handling
        callEndDebounceTimeout.current = setTimeout(() => {
          console.log('IncomingCall: Call ended before user could respond, exiting');
          // Ensure StatusBar is restored before leaving this screen
          try {
            if (Platform.OS === 'android') {
              StatusBar.setTranslucent(false);
              StatusBar.setBackgroundColor(themeColors.background.primary);
            }
            StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
          } catch (e) { }
          safeGoBack();
        }, 300); // 300ms debounce
      };

      const handleReject = (data: any) => {
        console.log('IncomingCall: rejected', playRingtone, 'callAccepted:', callAccepted);
        setPlayRingtone(false);

        // IMPORTANT: If call was already accepted, don't handle call end here
        // Let VideoCall/AudioCall components handle it instead
        if (callAccepted) {
          console.log('IncomingCall: Call was accepted, ignoring call end event (VideoCall/AudioCall will handle it)');
          return;
        }
  
        // Debounce rapid-fire call end events (prevent processing same event within 1 second)
        const now = Date.now();
        if (now - lastCallEndTime.current < 1000) {
          console.log('IncomingCall: Ignoring rapid-fire call end event');
          return;
        }
        lastCallEndTime.current = now;
  
        // Clear any existing debounce timeout
        if (callEndDebounceTimeout.current) {
          clearTimeout(callEndDebounceTimeout.current);
        }
  
        // Debounce the call end handling
        callEndDebounceTimeout.current = setTimeout(() => {
          // Only handle call end if call wasn't accepted (caller cancelled)
          console.log('IncomingCall: Handling call end - caller cancelled before acceptance');
          setCallAccepted(false); // Reset call accepted state
          setPlayRingtone(false);
          // Ensure StatusBar is restored before leaving this screen
          try {
            if (Platform.OS === 'android') {
              StatusBar.setTranslucent(false);
              StatusBar.setBackgroundColor(themeColors.background.primary);
            }
            StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
          } catch (e) { }
          safeGoBack();
        }, 300); // 300ms debounce
      };

      // Listen for call end events
      on('audio-call-ended', handleCallEnd);
      on('video-call-ended', handleCallEnd);
      on('audio-call-cancelled', handleCallCancel);
      on('video-call-cancelled', handleCallCancel);
      // Notify caller that we are ringing
      if (callerId) {
        try {
          emit('update-call-status', { to: callerId, status: 'Ringing...' });
          setStatusText('Ringing...');
        } catch (e) { }
      }
      
      on('video-call-rejected', handleReject);
      on('audio-call-rejected', handleReject);

      // Cleanup listeners
      return () => {
        off('audio-call-ended', handleCallEnd);
        off('audio-call-ended', handleCallEnd);
        off('audio-call-cancelled', handleCallCancel);
        off('video-call-cancelled', handleCallCancel);
        off('video-call-rejected', handleReject);
        off('audio-call-rejected', handleReject);
      };
    };

    const cleanup = checkCallActive();
    return cleanup;
  }, [callerId, channelName, navigation, on, off, emit, callAccepted]);

  // Auto-accept call if autoAccept flag is set (from notification button)
  useEffect(() => {
    if (autoAccept && callerId && channelName) {
      console.log('Auto-accepting call from notification');
      onAccept();
    }
  }, [autoAccept, callerId, channelName]);

  const title = useMemo(() => (isAudio ? 'Incoming Audio Call' : 'Incoming Video Call'), [isAudio]);

  

  const [callAcceptedState, setCallAcceptedState] = useState(false);

  const onAccept = useCallback(() => {
    if (!callerId || !channelName) {
      console.warn('IncomingCall: Missing required parameters for call acceptance', { callerId, channelName });
      return;
    }

    console.log('IncomingCall: Accepting call', { callerId, channelName, isAudio, callerName });
    setPlayRingtone(false);
    setCallAccepted(true); // Mark call as accepted
    setCallAcceptedState(true); // Hide the incoming call UI
    // Ensure StatusBar is restored before leaving this screen
    try {
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor(themeColors.background.primary);
      }
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    } catch (e) { }
    
    // Accept the call - this will emit socket event to server
    if (isAudio) {
      answerAudioCall(callerId, channelName);
    } else {
      answerVideoCall(callerId, channelName);
    }
    
    // Hide IncomingCall screen immediately so AudioCall/VideoCall Modal appears on top
    // Navigate back after a brief delay to let AudioCall/VideoCall show
    setTimeout(() => {
      safeGoBack();
    }, 300);
  }, [callerId, channelName, isAudio, callerName, themeColors.background.primary, isDarkMode, answerAudioCall, answerVideoCall, prevScreenId, navigation]);

  const onDecline = () => {
    if (!callerId) return;
    setPlayRingtone(false);
    // Ensure StatusBar is restored before leaving this screen
    try {
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor(themeColors.background.primary);
      }
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    } catch (e) { }
    if (isAudio) {
      if (!callAccepted) {
        endAudioCall(callerId, channelName, 'reject');
      } else {
        endAudioCall(callerId, channelName, 'end');
      }
    } else {
      if (!callAccepted) {
        endVideoCall(callerId, channelName, 'reject');
      } else {
        endVideoCall(callerId, channelName, 'end');
      }
    }
    safeGoBack();
  };


  // Ensure ringtone stops on unmount and cleanup debounce timeout
  useEffect(() => {
    return () => {
      setPlayRingtone(false);
      if (callEndDebounceTimeout.current) {
        clearTimeout(callEndDebounceTimeout.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {!callAcceptedState && (
        <>
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
          {/* Top Section - Call Type Indicator */}
          <View style={styles.topSection}>
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
          </View>

          {/* Center Section - Profile and Name */}
          <View style={styles.centerSection}>
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
              {statusText}
            </Text>
          </View>

          {/* Bottom Section - Action Buttons */}
          <View style={styles.bottomSection}>
            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {/* Decline Button */}
              <TouchableOpacity
                onPress={onDecline}
                style={[styles.actionButton, styles.declineButton]}
                activeOpacity={0.7}
              >
                <View style={styles.buttonInner}>
                  <Icon name="call-end" size={32} color="white" />
                </View>
                <View style={[styles.buttonRing, styles.declineButtonRing]} />
              </TouchableOpacity>

              {/* Accept Button */}
              <Animated.View style={{ transform: [{ scale: acceptButtonPulse }] }}>
                <TouchableOpacity
                  onPress={onAccept}
                  style={[styles.actionButton, styles.acceptButton]}
                  activeOpacity={0.7}
                >
                  <View style={styles.buttonInner}>
                    <Icon name="call" size={32} color="white" />
                  </View>
                  <View style={[styles.buttonRing, styles.acceptButtonRing]} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </View>
      </>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    width: '100%',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bottomSection: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 20,
  },
  callTypeContainer: {
    marginBottom: 0,
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
    marginBottom: 0,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 50,
    marginBottom: 0,
    marginTop: -50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  buttonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  buttonRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    zIndex: 1,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.6,
  },
  declineButtonRing: {
    borderColor: 'rgba(255, 59, 48, 0.8)',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  acceptButton: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOpacity: 0.6,
  },
  acceptButtonRing: {
    borderColor: 'rgba(52, 199, 89, 0.8)',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  callDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default IncomingCall;
