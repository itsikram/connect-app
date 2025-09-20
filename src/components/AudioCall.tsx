import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import RtcEngine, {
  ChannelProfile,
} from 'react-native-agora';
import { useSocket } from '../contexts/SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useTheme } from '../contexts/ThemeContext';
import { useCallMinimize } from '../contexts/CallMinimizeContext';
import api from '../lib/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { request, PERMISSIONS, RESULTS, check } from 'react-native-permissions';

interface AudioCallProps {
  myId: string;
  peerName?: string;
  peerProfilePic?: string;
}

interface IncomingCall {
  from: string;
  channelName: string;
  name: string;
  profilePic: string;
}

const AudioCall: React.FC<AudioCallProps> = ({ myId, peerName, peerProfilePic }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const { on, off, answerAudioCall, endAudioCall } = useSocket();
  const { minimizeCall, restoreCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();
  const myProfile = useSelector((state: RootState) => state.profile);
  const navigation = useNavigation();

  const [isAudioCall, setIsAudioCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [errorShown, setErrorShown] = useState(false);

  const engineRef = useRef<RtcEngine | null>(null);
  const isLeavingRef = useRef<boolean>(false);
  const callStartTime = useRef<number | null>(null);
  const minimizedDurationInterval = useRef<NodeJS.Timeout | null>(null);

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      console.log('Requesting microphone permission...');
      
      const microphonePermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      // Check current permission first
      const microphoneStatus = await check(microphonePermission);
      console.log('Current microphone permission:', microphoneStatus);

      // Request permission if not already granted
      const microphoneResult = microphoneStatus === RESULTS.GRANTED 
        ? microphoneStatus 
        : await request(microphonePermission);

      console.log('Microphone permission result:', microphoneResult);

      // Check if permission is granted
      const hasPermission = microphoneResult === RESULTS.GRANTED;

      if (!hasPermission) {
        Alert.alert(
          'Microphone Permission Required',
          'This app needs microphone permission to make audio calls. Please enable it in Settings.',
          [
            { text: 'Cancel', onPress: () => endCall() },
            { text: 'Settings', onPress: () => {
              // You could add a function to open app settings here
              endCall();
            }}
          ]
        );
        return false;
      }

      console.log('Microphone permission granted successfully');
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request microphone permission. Please check your device settings.',
        [{ text: 'OK', onPress: () => endCall() }]
      );
      return false;
    }
  };

  // Get Agora token
  const getToken = async (channelName: string, uid: number = 0) => {
    try {
      console.log('Requesting Agora token for channel:', channelName, 'uid:', uid);
      const { data } = await api.post('agora/token', { channelName, uid });
      
      if (!data || !data.appId || !data.token) {
        throw new Error('Invalid token response from server');
      }
      
      console.log('Token received successfully:', { 
        appId: data.appId, 
        hasToken: !!data.token, 
        channelName: data.channelName 
      });
      return data; // { appId, token }
    } catch (error: any) {
      console.error('Failed to get Agora token:', error);
      
      // Handle specific error cases
      if (error.response?.status === 500) {
        const errorMsg = error.response?.data?.error || 'Server configuration error';
        if (errorMsg.includes('agora-access-token')) {
          Alert.alert('Setup Error', 'Server is missing Agora SDK. Please contact support.');
        } else if (errorMsg.includes('AGORA_APP_ID') || errorMsg.includes('AGORA_APP_CERTIFICATE')) {
          Alert.alert('Configuration Error', 'Agora credentials are not configured on the server. Please contact support.');
        } else {
          Alert.alert('Server Error', 'Failed to generate call token. Please try again.');
        }
      } else if (error.response?.status === 400) {
        Alert.alert('Invalid Request', 'Invalid call parameters. Please try again.');
      } else {
        Alert.alert('Network Error', 'Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  };

  // Initialize Agora Engine
  const initializeEngine = useCallback(async () => {
    try {
      // Request microphone permission first
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      if (engineRef.current) {
        return engineRef.current;
      }

      console.log('Initializing Agora engine...');
      const { appId } = await getToken('test', 0); // Get appId from server
      
      if (!appId) {
        throw new Error('No App ID received from server');
      }
      
      console.log('Creating Agora engine with App ID:', appId);
      const engine = await RtcEngine.create(appId);
      
      // Disable video for audio-only call
      await engine.disableVideo();
      // Enable audio (permission already granted)
      console.log('Enabling audio...');
      await engine.enableAudio();
      
      // Set channel profile
      await engine.setChannelProfile(ChannelProfile.Communication);

      // Add event listeners
      engine.addListener('UserJoined', (uid: number) => {
        console.log('Remote user joined:', uid);
        setRemoteUid(uid);
      });

      engine.addListener('UserOffline', (uid: number) => {
        console.log('Remote user left:', uid);
        setRemoteUid(null);
      });

      engine.addListener('JoinChannelSuccess', (channel: string, uid: number) => {
        console.log('Joined channel successfully:', channel, uid);
        setIsConnected(true);
      });

      engine.addListener('LeaveChannel', () => {
        console.log('Left channel');
        setIsConnected(false);
        setRemoteUid(null);
      });

      // engine.addListener('Error', (errorCode: number, errorMsg?: string) => {
      //   console.error('Agora audio error:', { errorCode, errorMsg });
        
      //   // Prevent multiple alerts for the same error
      //   if (errorShown) {
      //     console.warn('Suppressing duplicate audio error alert for code:', errorCode);
      //     return;
      //   }
        
      //   // Handle specific error codes
      //   switch (errorCode) {
      //     case 1027:
      //       setErrorShown(true);
      //       Alert.alert(
      //         'Authentication Error',
      //         'The audio call token has expired or is invalid. Please try starting the call again.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     case 17:
      //       Alert.alert(
      //         'Network Error',
      //         'Unable to connect to Agora servers. Please check your internet connection and try again.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     case 2:
      //       Alert.alert(
      //         'Invalid Parameters',
      //         'Invalid call parameters. Please try starting the call again.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     case 3:
      //       Alert.alert(
      //         'Not Ready',
      //         'Call service is not ready. Please wait a moment and try again.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     case 109:
      //       setErrorShown(true);
      //       Alert.alert(
      //         'Token Expired',
      //         'Your call session has expired. Please start a new call.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     default:
      //       console.error('Unhandled Agora error:', errorCode, errorMsg);
      //       Alert.alert(
      //         'Call Error',
      //         `An error occurred during the call (Code: ${errorCode}). Please try again.`,
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //   }
      // });

      engineRef.current = engine;
      console.log('Agora engine initialized successfully');
      return engine;
    } catch (error: any) {
      console.error('Failed to initialize Agora engine:', error);
      
      // Handle initialization errors
      if (error.message?.includes('App ID')) {
        Alert.alert(
          'Configuration Error',
          'Invalid App ID. The call service is not properly configured.',
          [{ text: 'OK', onPress: () => endCall() }]
        );
      } else {
        Alert.alert(
          'Initialization Error',
          'Failed to initialize the call service. Please try again.',
          [{ text: 'OK', onPress: () => endCall() }]
        );
      }
      
      throw error;
    }
  }, [myId]);

  // Join channel
  const joinChannel = useCallback(async (channelName: string) => {
    try {
      console.log('Attempting to join audio channel:', channelName);
      const engine = await initializeEngine();
      const numericUid = Number.isFinite(Number(myId)) ? Number(myId) : 0;
      
      console.log('Getting token for channel:', channelName, 'uid:', numericUid);
      const { token } = await getToken(channelName, numericUid);
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      console.log('Token received, joining channel...');
      // Join channel
      await engine.joinChannel(token, channelName, null, numericUid);
      console.log('Successfully requested to join audio channel:', channelName);
      
      setCallAccepted(true);
      setCurrentChannel(channelName);
      setIsAudioCall(true);
      
      // Set call start time for duration tracking
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
    } catch (error: any) {
      console.error('Failed to join audio channel:', error);
      
      // Don't show additional alert if token request already showed one
      if (!error.response) {
        Alert.alert(
          'Call Failed', 
          'Unable to join the call. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      }
      
      // Reset call state
      setIsAudioCall(false);
      setCallAccepted(false);
      setCurrentChannel(null);
      
      // Clean up engine if it was created
      if (engineRef.current) {
        try {
          await engineRef.current.destroy();
          engineRef.current = null;
        } catch (cleanupError) {
          console.warn('Error cleaning up engine:', cleanupError);
        }
      }
    }
  }, [initializeEngine, myId]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    // Prevent multiple calls to leaveChannel
    if (isLeavingRef.current) {
      console.log('Already leaving audio channel, ignoring duplicate call');
      return;
    }
    
    isLeavingRef.current = true;
    
    try {
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        await engineRef.current.destroy();
        engineRef.current = null;
      }
      
      setCallAccepted(false);
      setIsAudioCall(false);
      setCurrentChannel(null);
      setIncomingCall(null);
      setIsMinimized(false);
      setCallDuration(0);
      setRemoteUid(null);
      setIsConnected(false);
      setErrorShown(false);
      callStartTime.current = null;
      
      // Clear duration interval
      if (minimizedDurationInterval.current) {
        clearInterval(minimizedDurationInterval.current);
        minimizedDurationInterval.current = null;
      }
    } catch (error) {
      console.error('Failed to leave audio channel:', error);
    } finally {
      isLeavingRef.current = false;
    }
  }, []);

  // Answer call
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    
    console.log('Answering audio call');
    answerAudioCall(incomingCall.from, incomingCall.channelName);
    await joinChannel(incomingCall.channelName);
  }, [incomingCall, answerAudioCall, joinChannel]);

  // End call
  const endCall = useCallback(async () => {
    if (currentChannel) {
      const callId = `audio-${currentChannel}`;
      endMinimizedCall(callId);
    }
    
    // endAudioCall(incomingCall?.from || '');
    await leaveChannel();
    
    // Simply navigate back without complex navigation logic to prevent loops
    try {
      const nav: any = navigation;
      // Just go back to the previous screen or Message tab
      if (nav.canGoBack && nav.canGoBack()) {
        nav.goBack();
      } else {
        nav.navigate('Message');
      }
    } catch (e) {
      console.warn('Navigation error after call end:', e);
    }
  }, [currentChannel, incomingCall, endAudioCall, leaveChannel, endMinimizedCall, navigation]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Toggle speaker
  const toggleSpeaker = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
    }
  }, [isSpeakerOn]);

  // Minimize call
  const minimizeAudioCall = useCallback(() => {
    if (!callAccepted || !currentChannel || !incomingCall) return;

    const callId = `audio-${currentChannel}`;
    const callData = {
      id: callId,
      type: 'audio' as const,
      callerName: incomingCall.name || 'Unknown Caller',
      callerProfilePic: incomingCall.profilePic,
      callerId: incomingCall.from,
      status: 'connected' as const,
      duration: callDuration,
      isMuted: isMuted,
      onRestore: () => {
        setIsMinimized(false);
        setIsAudioCall(true);
      },
      onEnd: () => {
        endCall();
      },
      onToggleMute: () => {
        toggleMute();
      }
    };

    minimizeCall(callData);
    setIsMinimized(true);
    setIsAudioCall(false);
  }, [callAccepted, currentChannel, incomingCall, callDuration, isMuted, minimizeCall, endCall, toggleMute]);

  // Call duration tracking
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (callAccepted && !isMinimized) {
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (callStartTime.current || 0)) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callAccepted, isMinimized]);

  // While minimized, push duration into minimized call bar
  useEffect(() => {
    if (callAccepted && isMinimized && currentChannel && callStartTime.current) {
      const callId = `audio-${currentChannel}`;
      minimizedDurationInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (callStartTime.current || 0)) / 1000);
        try {
          updateMinimizedCall(callId, { duration: elapsed });
        } catch (e) {
          console.warn('Failed to update minimized call duration:', e);
        }
      }, 1000);
    }
    return () => {
      if (minimizedDurationInterval.current) {
        clearInterval(minimizedDurationInterval.current);
        minimizedDurationInterval.current = null;
      }
    };
  }, [callAccepted, isMinimized, currentChannel, updateMinimizedCall]);

  // Socket event listeners
  useEffect(() => {
    // Remove incoming call handling - this is now handled by IncomingCall screen
    // const handleIncomingCall = ({ from, channelName, isAudio, callerName, callerProfilePic }: any) => {
    //   // Only handle audio calls
    //   if (isAudio) {
    //     console.log('Incoming audio call from', from, 'channel:', channelName);
    //     setIncomingCall({
    //       from,
    //       channelName,
    //       name: callerName || 'Unknown Caller',
    //       profilePic: callerProfilePic || ''
    //     });
    //     setCurrentChannel(channelName);
    //   }
    // };

    const handleCallAccepted = ({ channelName, isAudio, callerName, callerProfilePic, callerId }: any) => {
      // Don't handle call acceptance here - let VideoCall component handle all acceptances
      // This prevents conflict between AudioCall and VideoCall components
      console.log('AudioCall: Call accepted event received, but VideoCall component will handle it:', { channelName, isAudio, callerName });
      
      // Ensure AudioCall modal is hidden when call is accepted
      if (isAudio) {
        setIsAudioCall(false);
      }
    };

    const handleCallEnd = () => {

      return;
      endCall();
    };

    // Removed: on('agora-incoming-audio-call', handleIncomingCall); - handled by IncomingCall screen
    on('agora-call-accepted', handleCallAccepted);
    on('audioCallEnd', handleCallEnd);

    return () => {
      // Removed: off('agora-incoming-audio-call', handleIncomingCall); - handled by IncomingCall screen
      off('agora-call-accepted', handleCallAccepted);
      off('audioCallEnd', handleCallEnd);
    };
  }, [on, off, joinChannel, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, [leaveChannel]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isAudioCall || isMinimized) {
    return null;
  }

  const displayName = incomingCall?.name || peerName || 'Unknown Caller';
  const displayPic = incomingCall?.profilePic || peerProfilePic || '';

  return (
    <Modal
      visible={isAudioCall}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={endCall}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background.primary} />
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.surface.header }]}>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            Audio Call
          </Text>
          {callAccepted && (
            <Text style={[styles.duration, { color: themeColors.text.secondary }]}>
              {formatDuration(callDuration)}
            </Text>
          )}
        </View>

        {/* Audio Call UI */}
        <View style={styles.audioContainer}>
          {/* Profile Picture */}
          <View style={styles.profileContainer}>
            {displayPic ? (
              <Image source={{ uri: displayPic }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profilePlaceholder, { backgroundColor: themeColors.gray[700] }]}>
                <Icon name="person" size={80} color={themeColors.text.secondary} />
              </View>
            )}
            
            <Text style={[styles.callerName, { color: themeColors.text.primary }]}>
              {displayName}
            </Text>
            
            <Text style={[styles.callStatus, { color: themeColors.text.secondary }]}>
              {callAccepted ? `Connected • ${formatDuration(callDuration)}` : 'Connecting...'}
            </Text>
          </View>

          {/* Audio Visualizer or Status */}
          {callAccepted && (
            <View style={styles.audioStatusContainer}>
              <View style={styles.audioWaves}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.audioWave,
                      { backgroundColor: themeColors.primary, height: Math.random() * 26 + 14 }
                    ]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={[styles.controls, { backgroundColor: themeColors.surface.header }]}>
          {callAccepted && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isMuted ? themeColors.status.error : themeColors.gray[600] }]}
                onPress={toggleMute}
              >
                <Icon name={isMuted ? 'mic-off' : 'mic'} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isSpeakerOn ? themeColors.primary : themeColors.gray[600] }]}
                onPress={toggleSpeaker}
              >
                <Icon name={isSpeakerOn ? 'volume-up' : 'volume-down'} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: themeColors.gray[600] }]}
                onPress={minimizeAudioCall}
              >
                <Icon name="minimize" size={24} color="white" />
              </TouchableOpacity>
            </>
          )}

          {/* Answer/Decline buttons removed - handled by IncomingCall screen */}

          {/* End call button */}
          <TouchableOpacity
            style={[styles.controlButton, styles.endButton, { backgroundColor: themeColors.status.error }]}
            onPress={endCall}
          >
            <Icon name="call-end" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  duration: {
    fontSize: 14,
    marginTop: 4,
  },
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  profileImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 20,
  },
  profilePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 14,
    textAlign: 'center',
  },
  audioStatusContainer: {
    alignItems: 'center',
  },
  audioWaves: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
  },
  audioWave: {
    width: 5,
    marginHorizontal: 3,
    borderRadius: 3,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  controlButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerButton: {
    // Additional styling for answer button if needed
  },
  endButton: {
    // Additional styling for end button if needed
  },
});

export default AudioCall;
