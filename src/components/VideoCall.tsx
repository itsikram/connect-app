import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import RtcEngine, {
  RtcLocalView,
  RtcRemoteView,
  VideoRenderMode,
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

const { width, height } = Dimensions.get('window');

interface VideoCallProps {
  myId: string;
}

interface IncomingCall {
  from: string;
  channelName: string;
  name: string;
  profilePic: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ myId }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const { on, off, answerVideoCall, endVideoCall, applyVideoFilter } = useSocket();
  const { minimizeCall, restoreCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();
  const myProfile = useSelector((state: RootState) => state.profile);
  const navigation = useNavigation();

  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [errorShown, setErrorShown] = useState(false);
  const [tokenRefreshAttempts, setTokenRefreshAttempts] = useState(0);
  const [isAudioMode, setIsAudioMode] = useState(false);

  const engineRef = useRef<RtcEngine | null>(null);
  const localUidRef = useRef<number | null>(null);
  const isJoiningRef = useRef<boolean>(false);
  const callStartTime = useRef<number | null>(null);
  const minimizedDurationInterval = useRef<NodeJS.Timeout | null>(null);

  // Refresh token when needed
  const refreshToken = async () => {
    if (!currentChannel) return;
    
    try {
      console.log('Refreshing Agora token for channel:', currentChannel);
      // Always refresh token for the actual joined UID
      const fallbackUid = getStableNumericUid(myId);
      const uidForToken = localUidRef.current ?? fallbackUid;
      const { token } = await getToken(currentChannel, uidForToken);
      
      if (engineRef.current && token) {
        await engineRef.current.renewToken(token);
        console.log('Token refreshed successfully');
        // Reset error flag and refresh counter after successful refresh
        setErrorShown(false);
        setTokenRefreshAttempts(0);
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
  };

  // Get Agora token
  const getToken = async (channelName: string, uid: number = 0) => {
    try {
      console.log('Requesting Agora token for video channel:', channelName, 'uid:', uid);
      const { data } = await api.post('agora/token', { channelName, uid });
      
      if (!data || !data.appId || !data.token) {
        throw new Error('Invalid token response from server');
      }
      
      console.log('Video token received successfully:', { 
        appId: data.appId, 
        hasToken: !!data.token, 
        channelName: data.channelName 
      });
      return data; // { appId, token }
    } catch (error: any) {
      console.error('Failed to get Agora video token:', error);
      
      // Handle specific error cases
      if (error.response?.status === 500) {
        const errorMsg = error.response?.data?.error || 'Server configuration error';
        if (errorMsg.includes('agora-access-token')) {
          Alert.alert('Setup Error', 'Server is missing Agora SDK. Please contact support.');
        } else if (errorMsg.includes('AGORA_APP_ID') || errorMsg.includes('AGORA_APP_CERTIFICATE')) {
          Alert.alert('Configuration Error', 'Agora credentials are not configured on the server. Please contact support.');
        } else {
          Alert.alert('Server Error', 'Failed to generate video call token. Please try again.');
        }
      } else if (error.response?.status === 400) {
        Alert.alert('Invalid Request', 'Invalid video call parameters. Please try again.');
      } else {
        Alert.alert('Network Error', 'Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  };

  // Initialize Agora Engine
  const initializeEngine = useCallback(async () => {
    try {
      if (engineRef.current) {
        console.log('Video engine already exists, checking state...');
        // Ensure engine is in a good state
        try {
          // Test if engine is still valid by checking a simple property
          await engineRef.current.enableAudio();
          console.log('Existing engine is valid, reusing...');
          return engineRef.current;
        } catch (e) {
          console.warn('Existing engine is invalid, creating new one:', e);
          // Clean up invalid engine
          try {
            await engineRef.current.destroy();
          } catch (cleanupError) {
            console.warn('Error cleaning up invalid engine:', cleanupError);
          }
          engineRef.current = null;
        }
      }

      console.log('Initializing Agora video engine...');
      const { appId } = await getToken('test', 0); // Get appId from server
      
      if (!appId) {
        throw new Error('No App ID received from server');
      }
      
      console.log('Creating Agora video engine with App ID:', appId);
       const engine = await RtcEngine.create(appId);
      
      // Enable video and audio
      await engine.enableVideo();
      await engine.enableAudio();
      
      // Set channel profile
      await engine.setChannelProfile(ChannelProfile.Communication);

      // Add event listeners
      engine.addListener('UserJoined', (uid: number) => {
        console.log('Remote video user joined:', uid);
        setRemoteUid(uid);
      });

      engine.addListener('UserOffline', (uid: number) => {
        console.log('Remote video user left:', uid);
        setRemoteUid(null);
      });

      engine.addListener('JoinChannelSuccess', (channel: string, uid: number) => {
        console.log('Joined video channel successfully:', channel, uid);
        localUidRef.current = uid;
        setIsConnected(true);
      });

      engine.addListener('LeaveChannel', () => {
        console.log('Left video channel');
        setIsConnected(false);
        setRemoteUid(null);
      });

      // Proactively handle token lifecycle
      engine.addListener('TokenPrivilegeWillExpire', async () => {
        console.log('Token will expire soon – refreshing...');
        try {
          await refreshToken();
        } catch (e) {
          console.warn('Token refresh (will expire) failed:', e);
        }
      });

      engine.addListener('RequestToken', async () => {
        console.log('Engine requested a new token – refreshing...');
        try {
          await refreshToken();
        } catch (e) {
          console.warn('Token refresh (request) failed:', e);
        }
      });

      // engine.addListener('Error', (errorCode: number, errorMsg?: string) => {
      //   console.error('Agora video error:', { 
      //     errorCode, 
      //     errorMsg, 
      //     channelState: currentChannel,
      //     isConnected,
      //     callAccepted,
      //     remoteUid,
      //     timestamp: new Date().toISOString()
      //   });
        
      //   // Prevent multiple alerts for the same error
      //   if (errorShown) {
      //     console.warn('Suppressing duplicate error alert for code:', errorCode);
      //     return;
      //   }
        
      //   // Handle specific error codes
      //   switch (errorCode) {
      //     case 1027:
      //       // Limit token refresh attempts to prevent infinite loops
      //       if (tokenRefreshAttempts >= 3) {
      //         console.error('Maximum token refresh attempts reached');
      //         setErrorShown(true);
      //         Alert.alert(
      //           'Authentication Error',
      //           'Unable to maintain video call connection. Please restart the call.',
      //           [{ text: 'OK', onPress: () => endCall() }]
      //         );
      //         return;
      //       }
            
      //       setTokenRefreshAttempts(prev => prev + 1);
      //       console.log(`Attempting token refresh (attempt ${tokenRefreshAttempts + 1}/3)...`);
            
      //       // Try to refresh token first
      //       refreshToken().then(() => {
      //         console.log('Token refresh completed');
      //       }).catch(() => {
      //         // If refresh fails, show error
      //         setErrorShown(true);
      //         Alert.alert(
      //           'Authentication Error',
      //           'The video call token has expired or is invalid. Please try starting the call again.',
      //           [{ text: 'OK', onPress: () => endCall() }]
      //         );
      //       });
      //       break;
      //     case 1501:
      //       // If we're already connected and get 1501, it might be a spurious error
      //       if (isConnected && callAccepted) {
      //         console.warn('Received 1501 error but call is already connected - ignoring');
      //         return;
      //       }
      //       // Also ignore if a join is in progress to avoid duplicate alerts
      //       if (isJoiningRef.current) {
      //         console.warn('Received 1501 while a join is in progress - ignoring');
      //         return;
      //       }
            
      //       setErrorShown(true);
      //       Alert.alert(
      //         'Channel Join Failed',
      //         'Unable to join the video call. The channel may be full or no longer available. Please try again.',
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
      //         'Invalid video call parameters. Please try starting the call again.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     case 3:
      //       Alert.alert(
      //         'Not Ready',
      //         'Video call service is not ready. Please wait a moment and try again.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     case 109:
      //       setErrorShown(true);
      //       Alert.alert(
      //         'Token Expired',
      //         'Your video call session has expired. Please start a new call.',
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //       break;
      //     default:
      //       console.error('Unhandled Agora video error:', errorCode, errorMsg);
      //       Alert.alert(
      //         'Video Call Error',
      //         `An error occurred during the video call (Code: ${errorCode}). Please try again.`,
      //         [{ text: 'OK', onPress: () => endCall() }]
      //       );
      //   }
      // });

      engineRef.current = engine;
      console.log('Agora video engine initialized successfully');
      return engine;
    } catch (error: any) {
      console.error('Failed to initialize Agora video engine:', error);
      
      // Handle initialization errors
      if (error.message?.includes('App ID')) {
        Alert.alert(
          'Configuration Error',
          'Invalid App ID. The video call service is not properly configured.',
          [{ text: 'OK', onPress: () => endCall() }]
        );
      } else {
        Alert.alert(
          'Initialization Error',
          'Failed to initialize the video call service. Please try again.',
          [{ text: 'OK', onPress: () => endCall() }]
        );
      }
      
      throw error;
    }
  }, [myId]);

  // Join channel
  const joinChannel = useCallback(async (channelName: string) => {
    try {
      console.log('Attempting to join video channel:', channelName);
      // Guard against duplicate joins
      if (isJoiningRef.current) {
        console.log('Join already in progress, skipping duplicate join');
        return;
      }
      if (currentChannel === channelName && isConnected) {
        console.log('Already connected to this channel, skipping join');
        return;
      }
      isJoiningRef.current = true;
      const engine = await initializeEngine();
      const numericUid = getStableNumericUid(myId);
      
      console.log('Getting token for video channel:', channelName, 'uid:', numericUid);
      const { token } = await getToken(channelName, numericUid);
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      console.log('Video token received, joining channel...');
      // Join channel
      await engine.joinChannel(token, channelName, null, numericUid);
      console.log('Successfully requested to join video channel:', channelName);
      
      setCallAccepted(true);
      setCurrentChannel(channelName);
      setIsVideoCall(true);
      
      // Set call start time for duration tracking
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
    } catch (error: any) {
      console.error('Failed to join video channel:', error);
      
      // Don't show additional alert if token request already showed one
      if (!error.response) {
        Alert.alert(
          'Video Call Failed', 
          'Unable to join the video call. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      }
      
      // Reset call state
      setIsVideoCall(false);
      setCallAccepted(false);
      setCurrentChannel(null);
      
      // Clean up engine if it was created
      if (engineRef.current) {
        try {
          await engineRef.current.destroy();
          engineRef.current = null;
        } catch (cleanupError) {
          console.warn('Error cleaning up video engine:', cleanupError);
        }
      }
    }
    finally {
      isJoiningRef.current = false;
    }
  }, [initializeEngine, myId]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    try {
      console.log('Attempting to leave video channel...');
      
      if (engineRef.current) {
        try {
          // Check if engine is still valid before calling methods
          console.log('Leaving video channel...');
          await engineRef.current.leaveChannel();
          console.log('Video channel left successfully');
        } catch (leaveError: any) {
          console.warn('Error leaving video channel:', leaveError);
          // Continue with cleanup even if leave fails
        }
        
        try {
          console.log('Destroying video engine...');
          await engineRef.current.destroy();
          console.log('Video engine destroyed successfully');
        } catch (destroyError: any) {
          console.warn('Error destroying video engine:', destroyError);
          // Continue with cleanup even if destroy fails
        } finally {
          engineRef.current = null;
        }
      }
      
      // Reset all state regardless of engine cleanup success
      setCallAccepted(false);
      setIsVideoCall(false);
      setCurrentChannel(null);
      setIncomingCall(null);
      setIsMinimized(false);
      setCallDuration(0);
      setRemoteUid(null);
      setIsConnected(false);
      setErrorShown(false);
      setTokenRefreshAttempts(0);
      localUidRef.current = null;
      isJoiningRef.current = false;
      callStartTime.current = null;
      
      // Clear duration interval
      if (minimizedDurationInterval.current) {
        clearInterval(minimizedDurationInterval.current);
        minimizedDurationInterval.current = null;
      }
      
      console.log('Video call cleanup completed');
    } catch (error) {
      console.error('Failed to leave video channel:', error);
      // Even if cleanup fails, reset the state to prevent UI issues
      setCallAccepted(false);
      setIsVideoCall(false);
      setCurrentChannel(null);
      setIncomingCall(null);
      setIsMinimized(false);
      setCallDuration(0);
      setRemoteUid(null);
      setIsConnected(false);
      setErrorShown(false);
      setTokenRefreshAttempts(0);
      localUidRef.current = null;
      isJoiningRef.current = false;
      callStartTime.current = null;
      engineRef.current = null;
    }
  }, []);

  // Answer call
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    
    console.log('Answering video call');
    answerVideoCall(incomingCall.from, incomingCall.channelName);
    await joinChannel(incomingCall.channelName);
  }, [incomingCall, answerVideoCall, joinChannel]);

  // End call
  const endCall = useCallback(async () => {
    if (currentChannel) {
      const callId = `video-${currentChannel}`;
      endMinimizedCall(callId);
    }
    
    endVideoCall(incomingCall?.from || '');
    await leaveChannel();
    try {
      (navigation as any).navigate('Home', { screen: 'HomeMain' });
    } catch (e) {}
  }, [currentChannel, incomingCall, endVideoCall, leaveChannel, endMinimizedCall, navigation]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.muteLocalVideoStream(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  }, [isCameraOn]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.switchCamera();
      setIsFrontCamera(!isFrontCamera);
    }
  }, [isFrontCamera]);

  // Minimize call
  const minimizeVideoCall = useCallback(() => {
    if (!callAccepted || !currentChannel || !incomingCall) return;

    const callId = `video-${currentChannel}`;
    const callData = {
      id: callId,
      type: 'video' as const,
      callerName: incomingCall.name || 'Unknown Caller',
      callerProfilePic: incomingCall.profilePic,
      callerId: incomingCall.from,
      status: 'connected' as const,
      duration: callDuration,
      isMuted: isMuted,
      isCameraOn: isCameraOn,
      onRestore: () => {
        setIsMinimized(false);
        setIsVideoCall(true);
      },
      onEnd: () => {
        endCall();
      },
      onToggleMute: () => {
        toggleMute();
      },
      onToggleCamera: () => {
        toggleCamera();
      }
    };

    minimizeCall(callData);
    setIsMinimized(true);
    setIsVideoCall(false);
  }, [callAccepted, currentChannel, incomingCall, callDuration, isMuted, isCameraOn, minimizeCall, endCall, toggleMute, toggleCamera]);

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
      const callId = `video-${currentChannel}`;
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
    //   // Only handle video calls
    //   if (!isAudio) {
    //     console.log('Incoming video call from', from, 'channel:', channelName);
    //     setIncomingCall({
    //       from,
    //       channelName,
    //       name: callerName || 'Unknown Caller',
    //       profilePic: callerProfilePic || ''
    //     });
    //     setIsVideoCall(true);
    //     setReceivingCall(true);
    //     setCurrentChannel(channelName);
    //   }
    // };

    const handleCallAccepted = ({ channelName, isAudio, callerName, callerProfilePic, callerId }: any) => {
      console.log('VideoCall: Call accepted event received:', { channelName, isAudio, callerName, callerProfilePic });
      
      // Handle both video and audio call acceptance
      if (!isAudio) {
        console.log('VideoCall: Video call accepted, joining channel:', channelName);
        // Set up call information for video calls
        setIncomingCall({
          from: callerId || 'caller',
          channelName,
          name: callerName || 'Video Call',
          profilePic: callerProfilePic || ''
        });
        setIsVideoCall(true);
        setIsCameraOn(true); // Enable camera for video calls
        setCurrentChannel(channelName);
        setCallAccepted(true); // Important: mark call as accepted
        setIsAudioMode(false);
        joinChannel(channelName);
      } else {
        console.log('VideoCall: Audio call accepted, rendering profile placeholder:', channelName);
        // Use caller name and profile for audio calls; avoid remote video surface
        setIncomingCall({
          from: callerId || 'caller',
          channelName,
          name: callerName || 'Unknown Caller',
          profilePic: callerProfilePic || ''
        });
        setIsVideoCall(true);
        setIsCameraOn(false); // Camera off for audio calls
        setCurrentChannel(channelName);
        setCallAccepted(true);
        setIsAudioMode(true);
        joinChannel(channelName);
      }
    };

    const handleCallEnd = () => {
      endCall();
    };

    // Removed: on('agora-incoming-video-call', handleIncomingCall); - handled by IncomingCall screen
    on('agora-call-accepted', handleCallAccepted);
    on('videoCallEnd', handleCallEnd);

    return () => {
      // Removed: off('agora-incoming-video-call', handleIncomingCall); - handled by IncomingCall screen
      off('agora-call-accepted', handleCallAccepted);
      off('videoCallEnd', handleCallEnd);
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

  if (!isVideoCall || isMinimized) {
    return null;
  }

  return (
    <Modal
      visible={isVideoCall}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={endCall}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background.primary} />
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.surface.header }]}>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            {isAudioMode ? 'Audio Call' : 'Video Call'} - {incomingCall?.name || 'Unknown'}
          </Text>
          {callAccepted && (
            <Text style={[styles.duration, { color: themeColors.text.secondary }]}>
              {formatDuration(callDuration)}
            </Text>
          )}
        </View>

        {/* Video Container */}
        <View style={styles.videoContainer}>
          {/* Remote Video */}
          {callAccepted && remoteUid && !isAudioMode ? (
            <RtcRemoteView.SurfaceView
              style={styles.remoteVideo}
              uid={remoteUid}
              channelId={currentChannel || ''}
              renderMode={VideoRenderMode.Hidden}
              zOrderMediaOverlay={false}
            />
          ) : (
            <View style={[styles.remoteVideo, styles.placeholderVideo, { backgroundColor: themeColors.gray[800] }]}>
              {incomingCall?.profilePic ? (
                <Image source={{ uri: incomingCall.profilePic }} style={styles.profileImage} />
              ) : (
                <Icon name="person" size={80} color={themeColors.text.secondary} />
              )}
              <Text style={[styles.waitingText, { color: themeColors.text.secondary }]}>
                Connecting...
              </Text>
            </View>
          )}

          {/* Local Video */}
          {isVideoCall && isCameraOn && !isAudioMode && (
            <RtcLocalView.SurfaceView
              style={styles.localVideo}
              channelId={currentChannel || ''}
              renderMode={VideoRenderMode.Hidden}
              zOrderOnTop={true}
            />
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
                style={[styles.controlButton, { backgroundColor: isCameraOn ? themeColors.gray[600] : themeColors.status.error }]}
                onPress={toggleCamera}
              >
                <Icon name={isCameraOn ? 'videocam' : 'videocam-off'} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: themeColors.gray[600] }]}
                onPress={switchCamera}
              >
                <Icon name="flip-camera-android" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: themeColors.gray[600] }]}
                onPress={minimizeVideoCall}
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  duration: {
    fontSize: 14,
    marginTop: 4,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  localVideo: {
    width: 120,
    height: 160,
    position: 'absolute',
    top: 20,
    right: 20,
    borderRadius: 8,
    backgroundColor: '#333',
    zIndex: 10,
  },
  placeholderVideo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
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

export default VideoCall;

// Helpers
function getStableNumericUid(id: string): number {
  const asNum = Number(id);
  if (Number.isFinite(asNum) && asNum > 0 && asNum < 4294967295) {
    return Math.floor(asNum);
  }
  // Fallback: generate a stable 32-bit unsigned hash from the string
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0; // FNV prime
  }
  // Ensure non-zero and within Agora valid range
  const uid = hash % 4000000000;
  return uid === 0 ? 1 : uid;
}
