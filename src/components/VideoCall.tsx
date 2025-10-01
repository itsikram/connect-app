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
  Platform,
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
import { request, PERMISSIONS, RESULTS, check } from 'react-native-permissions';

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
  const [callEnded, setCallEnded] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [myFilter, setMyFilter] = useState<string>(''); // Filter I apply to my video (affects how others see me)
  const [remoteFilter, setRemoteFilter] = useState<string>(''); // Filter applied by remote user (affects how I see them)

  const engineRef = useRef<RtcEngine | null>(null);

  // Request camera and microphone permissions
  const requestPermissions = async (): Promise<boolean> => {
    try {
      console.log('Requesting camera and microphone permissions...');
      
      const cameraPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const microphonePermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      // Check current permissions first
      const cameraStatus = await check(cameraPermission);
      const microphoneStatus = await check(microphonePermission);

      console.log('Current permissions:', { cameraStatus, microphoneStatus });

      // Request permissions if not already granted
      const cameraResult = cameraStatus === RESULTS.GRANTED 
        ? cameraStatus 
        : await request(cameraPermission);
      
      const microphoneResult = microphoneStatus === RESULTS.GRANTED 
        ? microphoneStatus 
        : await request(microphonePermission);

      console.log('Permission results:', { cameraResult, microphoneResult });

      // Check if both permissions are granted
      const hasPermissions = cameraResult === RESULTS.GRANTED && microphoneResult === RESULTS.GRANTED;

      if (!hasPermissions) {
        const missingPermissions = [];
        if (cameraResult !== RESULTS.GRANTED) missingPermissions.push('Camera');
        if (microphoneResult !== RESULTS.GRANTED) missingPermissions.push('Microphone');
        
        Alert.alert(
          'Permissions Required',
          `This app needs ${missingPermissions.join(' and ')} permission to make video calls. Please enable them in Settings.`,
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

      console.log('All permissions granted successfully');
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request camera and microphone permissions. Please check your device settings.',
        [{ text: 'OK', onPress: () => endCall() }]
      );
      return false;
    }
  };
  const localUidRef = useRef<number | null>(null);
  const isJoiningRef = useRef<boolean>(false);
  const isLeavingRef = useRef<boolean>(false);
  const callStartTime = useRef<number | null>(null);
  const minimizedDurationInterval = useRef<NodeJS.Timeout | null>(null);
  const callEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        throw new Error('Camera and microphone permissions not granted');
      }

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

      // Enable video and audio (permissions already granted)
      console.log('Enabling video and audio...');
      await engine.enableVideo();
      await engine.enableAudio();

      // Start camera preview to ensure local video works
      console.log('Starting camera preview...');
      await engine.startPreview();

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

      engine.addListener('JoinChannelSuccess', async (channel: string, uid: number) => {
        console.log('Joined video channel successfully:', channel, uid);
        localUidRef.current = uid;
        setIsConnected(true);
        
        // Ensure local video is visible after joining
        try {
          await engine.muteLocalVideoStream(false);
          console.log('Local video unmuted after joining channel');
        } catch (error) {
          console.warn('Failed to unmute local video after joining:', error);
        }
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
      setCallEnded(false); // Reset call ended state for new call

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
    // Prevent multiple calls to leaveChannel
    if (isLeavingRef.current) {
      console.log('Already leaving channel, ignoring duplicate call');
      return;
    }

    isLeavingRef.current = true;

    try {
      console.log('Attempting to leave video channel...');

      if (engineRef.current) {
        try {
          // Check if engine is still valid before calling methods
          console.log('Leaving video channel...');
          await engineRef.current.leaveChannel();
          console.log('Video channel left successfully');
          
          // Stop camera preview when leaving
          try {
            await engineRef.current.stopPreview();
            console.log('Camera preview stopped');
          } catch (previewError) {
            console.warn('Error stopping camera preview:', previewError);
          }
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
      setCallEnded(false); // Reset call ended state
      setIsScreenSharing(false); // Reset screen sharing state
      setMyFilter(''); // Reset my filter state
      setRemoteFilter(''); // Reset remote filter state
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
      setCallEnded(false); // Reset call ended state
      setIsScreenSharing(false); // Reset screen sharing state
      setMyFilter(''); // Reset my filter state
      setRemoteFilter(''); // Reset remote filter state
      localUidRef.current = null;
      isJoiningRef.current = false;
      callStartTime.current = null;
      engineRef.current = null;
    } finally {
      isLeavingRef.current = false;
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
    // Prevent multiple calls to endCall
    if (callEnded) {
      console.log('Call already ended, ignoring duplicate endCall');
      return;
    }

    // Clear any existing timeout
    if (callEndTimeoutRef.current) {
      clearTimeout(callEndTimeoutRef.current);
    }

    // Debounce the end call to prevent rapid-fire calls
    callEndTimeoutRef.current = setTimeout(async () => {
      if (callEnded) {
        console.log('Call already ended in timeout, ignoring');
        return;
      }

      setCallEnded(true);
      console.log('Ending video call...');

      if (currentChannel) {
        const callId = `video-${currentChannel}`;
        endMinimizedCall(callId);
      }

      // endVideoCall(incomingCall?.from || '');
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
    }, 200); // 200ms debounce
  }, [currentChannel, incomingCall, endVideoCall, leaveChannel, endMinimizedCall, navigation, callEnded]);

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

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!engineRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing
        await engineRef.current.stopScreenCapture();
        setIsScreenSharing(false);
        console.log('Screen sharing stopped');
      } else {
        // Start screen sharing
        await engineRef.current.startScreenCapture({
          captureVideo: true,
          captureAudio: true,
        });
        setIsScreenSharing(true);
        console.log('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen share toggle failed:', error);
      Alert.alert(
        'Screen Share Error',
        'Failed to toggle screen sharing. Please check permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  }, [isScreenSharing]);

  // Toggle video filter - applies to how others see my video
  const toggleVideoFilter = useCallback(() => {
    const filters = ['', 'vivid', 'warm', 'cool', 'dramatic'];
    const currentIndex = filters.indexOf(myFilter);
    const nextIndex = (currentIndex + 1) % filters.length;
    const newFilter = filters[nextIndex];
    
    setMyFilter(newFilter);
    console.log('🎥 My video filter changed to:', newFilter || 'none');
    
    // Emit filter change to other participants so they can apply it to their view of me
    if (incomingCall?.from) {
      console.log('🎥 Sending filter to other participant:', incomingCall.from, 'filter:', newFilter);
      applyVideoFilter(incomingCall.from, newFilter);
    }
    
    // Show a brief feedback
    if (newFilter) {
      console.log(`Applied ${newFilter} filter to my video (others will see this effect)`);
    } else {
      console.log('Removed filter from my video');
    }
  }, [myFilter, incomingCall, applyVideoFilter]);

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
      isScreenSharing: isScreenSharing,
      myFilter: myFilter,
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
      },
      onToggleScreenShare: () => {
        toggleScreenShare();
      }
    };

    minimizeCall(callData);
    setIsMinimized(true);
    setIsVideoCall(false);
  }, [callAccepted, currentChannel, incomingCall, callDuration, isMuted, isCameraOn, isScreenSharing, minimizeCall, endCall, toggleMute, toggleCamera, toggleScreenShare]);

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

    const handleCallEnd = async () => {

      return;
      endCall();
    };

    const handleVideoFilter = ({ filter }: { filter: string }) => {
      console.log('🎥 Received video filter from other participant:', filter);
      console.log('🎥 Setting remoteFilter to:', filter);
      // This filter should be applied to how I see the remote user's video
      setRemoteFilter(filter);
      
      // Additional logging to track filter application
      if (filter) {
        console.log('🎥 Applied remote filter to video:', filter);
      } else {
        console.log('🎥 Removed remote filter from video');
      }
    };

    // Removed: on('agora-incoming-video-call', handleIncomingCall); - handled by IncomingCall screen
    on('agora-call-accepted', handleCallAccepted);
    on('videoCallEnd', handleCallEnd);
    on('agora-apply-video-filter', handleVideoFilter);

    return () => {
      // Removed: off('agora-incoming-video-call', handleIncomingCall); - handled by IncomingCall screen
      off('agora-call-accepted', handleCallAccepted);
      off('videoCallEnd', handleCallEnd);
      off('agora-apply-video-filter', handleVideoFilter);
    };
  }, [on, off, joinChannel, endCall]);

  // Track remote filter changes
  useEffect(() => {
    console.log('🎥 Remote filter state changed:', remoteFilter);
    if (remoteFilter) {
      console.log('🎥 Remote video should now show filter:', remoteFilter);
    }
  }, [remoteFilter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear timeout if it exists
      if (callEndTimeoutRef.current) {
        clearTimeout(callEndTimeoutRef.current);
        callEndTimeoutRef.current = null;
      }
      leaveChannel();
    };
  }, [leaveChannel]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get filter style based on current filter
  const getFilterStyle = (filter: string) => {
    switch (filter) {
      case 'vivid':
        return styles.filterVivid;
      case 'warm':
        return styles.filterWarm;
      case 'cool':
        return styles.filterCool;
      case 'dramatic':
        return styles.filterDramatic;
      default:
        return {};
    }
  };

  // Get filter overlay style
  const getFilterOverlayStyle = (filter: string) => {
    switch (filter) {
      case 'vivid':
        return styles.vividOverlay;
      case 'warm':
        return styles.warmOverlay;
      case 'cool':
        return styles.coolOverlay;
      case 'dramatic':
        return styles.dramaticOverlay;
      default:
        return {};
    }
  };
  // Get secondary filter overlay style
  const getFilterOverlaySecondaryStyle = (filter: string) => {
    switch (filter) {
      case 'vivid':
        return styles.vividOverlaySecondary;
      case 'warm':
        return styles.warmOverlaySecondary;
      case 'cool':
        return styles.coolOverlaySecondary;
      case 'dramatic':
        return styles.dramaticOverlaySecondary;
      default:
        return {};
    }
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
          {myFilter && (
            <Text style={[styles.filterIndicator, { color: themeColors.primary }]}>
              My Filter: {myFilter.charAt(0).toUpperCase() + myFilter.slice(1)}
            </Text>
          )}

        </View>

        {/* Video Container */}
        <View style={styles.videoContainer}>
          {/* Remote Video */}
          {callAccepted && remoteUid && !isAudioMode ? (
            <View style={styles.remoteVideo}>
              <RtcRemoteView.SurfaceView
                style={[styles.remoteVideo, getFilterStyle(remoteFilter)]}
                uid={remoteUid}
                channelId={currentChannel || ''}
                renderMode={VideoRenderMode.Fit}
                zOrderMediaOverlay={false}
              />
              {remoteFilter && (
                <>
                  {/* Primary filter overlay */}
                  <View style={[styles.filterOverlay, getFilterOverlayStyle(remoteFilter)]} />
                  {/* Secondary filter overlay for more realistic effect */}
                  <View style={[styles.filterOverlay, getFilterOverlaySecondaryStyle(remoteFilter)]} />
                </>
              )}
              {/* Debug overlay to show filter is applied */}
              {remoteFilter && (
                <View style={styles.debugFilterOverlay}>
                  <Text style={styles.debugFilterText}>Filter: {remoteFilter}</Text>
                </View>
              )}
            </View>
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

          {/* Local Video - No filter applied here as it's for my own view */}
          {isVideoCall && isCameraOn && !isAudioMode && (
            <RtcLocalView.SurfaceView
              style={styles.localVideo}
              channelId={currentChannel || ''}
              renderMode={VideoRenderMode.Fit}
              zOrderOnTop={true}
            />
          )}
          
          {/* Debug info for local video */}
          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                Debug: isVideoCall={isVideoCall.toString()}, isCameraOn={isCameraOn.toString()}, isAudioMode={isAudioMode.toString()}
              </Text>
              <Text style={styles.debugText}>
                Channel: {currentChannel || 'none'}, Connected: {isConnected.toString()}
              </Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={[styles.controls, { backgroundColor: themeColors.surface.header }]}>
          {callAccepted && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isMuted ? '#666666' : '#29B1A9' }]}
                onPress={toggleMute}
              >
                <Icon name={isMuted ? 'mic-off' : 'mic'} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isCameraOn ? '#666666' : '#29B1A9' }]}
                onPress={toggleCamera}
              >
                <Icon name={isCameraOn ? 'videocam' : 'videocam-off'} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: '#29B1A9' }]}
                onPress={switchCamera}
              >
                <Icon name="flip-camera-android" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isScreenSharing ? '#666666' : '#29B1A9' }]}
                onPress={toggleScreenShare}
              >
                <Icon name={isScreenSharing ? "stop-screen-share" : "screen-share"} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: myFilter ? '#666666' : '#29B1A9' }]}
                onPress={toggleVideoFilter}
              >
                <Icon name="filter-list" size={24} color="white" />
                {myFilter && (
                  <Text style={styles.filterButtonText}>
                    {myFilter.charAt(0).toUpperCase() + myFilter.slice(1)}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: '#29B1A9' }]}
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
  filterIndicator: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
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
  // Filter styles - Matching web CSS filter effects
  filterVivid: {
    // Vivid: contrast(1.2) saturate(1.4) brightness(1.1) hue-rotate(5deg) sepia(0.1)
    opacity: 1.0,
    borderWidth: 3,
    borderColor: '#FFD700', // Gold border for vivid
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  filterWarm: {
    // Warm: contrast(1.15) saturate(1.3) brightness(1.05) hue-rotate(10deg) sepia(0.15)
    opacity: 1.0,
    borderWidth: 3,
    borderColor: '#FF8C00', // Dark orange border for warm
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  filterCool: {
    // Cool: contrast(1.1) saturate(1.2) brightness(1.1) hue-rotate(-5deg) sepia(0.05)
    opacity: 1.0,
    borderWidth: 3,
    borderColor: '#00BFFF', // Deep sky blue border for cool
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  filterDramatic: {
    // Dramatic: contrast(1.3) saturate(1.5) brightness(1.05) hue-rotate(8deg) sepia(0.2)
    opacity: 1.0,
    borderWidth: 3,
    borderColor: '#FF4500', // Orange red border for dramatic
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  // Filter overlay styles
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    borderRadius: 8, // Match video border radius
  },
  vividOverlay: {
    // Vivid: contrast(1.2) saturate(1.4) brightness(1.1) hue-rotate(5deg) sepia(0.1)
    backgroundColor: 'rgba(255, 215, 0, 0.15)', // Gold tint matching web vivid
  },
  warmOverlay: {
    // Warm: contrast(1.15) saturate(1.3) brightness(1.05) hue-rotate(10deg) sepia(0.15)
    backgroundColor: 'rgba(255, 140, 0, 0.2)', // Dark orange tint matching web warm
  },
  coolOverlay: {
    // Cool: contrast(1.1) saturate(1.2) brightness(1.1) hue-rotate(-5deg) sepia(0.05)
    backgroundColor: 'rgba(0, 191, 255, 0.15)', // Deep sky blue tint matching web cool
  },
  dramaticOverlay: {
    // Dramatic: contrast(1.3) saturate(1.5) brightness(1.05) hue-rotate(8deg) sepia(0.2)
    backgroundColor: 'rgba(255, 69, 0, 0.2)', // Orange red tint matching web dramatic
  },
  // Additional overlay layers for more realistic filter effects
  vividOverlaySecondary: {
    backgroundColor: 'rgba(255, 255, 0, 0.05)', // Additional yellow layer
  },
  warmOverlaySecondary: {
    backgroundColor: 'rgba(255, 165, 0, 0.08)', // Additional orange layer
  },
  coolOverlaySecondary: {
    backgroundColor: 'rgba(0, 150, 255, 0.05)', // Additional blue layer
  },
  dramaticOverlaySecondary: {
    backgroundColor: 'rgba(255, 0, 0, 0.05)', // Additional red layer
  },
  // Debug overlay styles
  debugFilterOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    zIndex: 100,
  },
  debugFilterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  filterButtonText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
  },
  answerButton: {
    // Additional styling for answer button if needed
  },
  endButton: {
    // Additional styling for end button if needed
  },
  debugInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    zIndex: 100,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'monospace',
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
