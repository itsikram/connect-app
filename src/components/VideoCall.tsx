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
  const [remoteFriendId, setRemoteFriendId] = useState<string | null>(null); // Track the other user's ID
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
  const [localRemoteFilter, setLocalRemoteFilter] = useState<string>(''); // Local filter I apply to view remote user (doesn't affect them)

  const engineRef = useRef<RtcEngine | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const callAcceptedRef = useRef<boolean>(false);
  const lastCallAcceptedTime = useRef<number>(0);
  const localPreviewStarted = useRef<boolean>(false);

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
  const minimizedDurationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const callEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallEndTime = useRef<number>(0);
  const isEndingCallRef = useRef<boolean>(false);

  // Refresh token when needed
  const refreshToken = async () => {
    if (!currentChannel || !engineRef.current) return;

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
      // Increment refresh attempts and show error if too many failures
      setTokenRefreshAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts >= 3 && !errorShown) {
          setErrorShown(true);
          Alert.alert(
            'Token Refresh Failed',
            'Unable to refresh video call token. The call may be interrupted.',
            [{ text: 'OK' }]
          );
        }
        return newAttempts;
      });
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
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log('Engine initialization already in progress, waiting...');
      // Wait for existing initialization to complete
      while (isInitializingRef.current) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
      }
      return engineRef.current;
    }

    try {
      isInitializingRef.current = true;
      
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
      
      // Enable local video explicitly
      await engine.enableLocalVideo(true);
      console.log('Local video enabled');

      // Set channel profile
      await engine.setChannelProfile(ChannelProfile.Communication);

      // Don't start preview here - it will be started after the view is rendered
      console.log('Engine initialized, preview will start after view renders');

      // Add event listeners
      engine.addListener('UserJoined', (uid: number) => {
        console.log('Remote video user joined:', uid);
        setRemoteUid(uid);
      });

      engine.addListener('UserOffline', async (uid: number) => {
        console.log('Remote video user left:', uid);
        setRemoteUid(null);
        // If the remote leaves, end the call locally to keep both sides in sync
        if (!isEndingCallRef.current && (callAccepted || isVideoCall)) {
          try {
            isEndingCallRef.current = true;
            setCallEnded(true);
            await cleanupCall();
          } catch (e) {
            console.warn('Cleanup after remote offline failed:', e);
          }
        }
      });

      engine.addListener('JoinChannelSuccess', (channel: string, uid: number) => {
        console.log('Joined video channel successfully:', channel, uid);
        localUidRef.current = uid;
        setIsConnected(true);
        console.log('📹 JoinChannelSuccess: Will start preview via useEffect with proper timing');
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
    } finally {
      isInitializingRef.current = false;
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

      // Check if call was already accepted to prevent duplicate processing
      if (callAcceptedRef.current && currentChannel === channelName) {
        console.log('Call already accepted for this channel, skipping join');
        return;
      }

      isJoiningRef.current = true;
      callAcceptedRef.current = true;
      
      const engine = await initializeEngine();
      const numericUid = getStableNumericUid(myId);

      console.log('Getting token for video channel:', channelName, 'uid:', numericUid);
      const { token } = await getToken(channelName, numericUid);

      if (!token) {
        throw new Error('No token received from server');
      }

      console.log('Video token received, joining channel...');
      // Join channel
      if (!engine) {
        throw new Error('Engine not available for joining channel');
      }
      await engine.joinChannel(token, channelName, null, numericUid);
      console.log('Successfully requested to join video channel:', channelName);
      console.log('Waiting for JoinChannelSuccess event to start local video...');

      setCallAccepted(true);
      setCurrentChannel(channelName);
      setIsVideoCall(true);
      setCallEnded(false); // Reset call ended state for new call
      isEndingCallRef.current = false;

      // Set call start time for duration tracking
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
    } catch (error: any) {
      console.error('Failed to join video channel:', error);

      // Handle specific error types
      let errorMessage = 'Unable to join the video call. Please check your connection and try again.';
      
      if (error.message?.includes('request to join channel is rejected')) {
        errorMessage = 'Channel access denied. The call may have ended or you may not have permission to join.';
      } else if (error.message?.includes('token')) {
        errorMessage = 'Authentication failed. Please try again.';
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }

      // Don't show additional alert if token request already showed one
      if (!error.response) {
        Alert.alert(
          'Video Call Failed',
          errorMessage,
          [{ text: 'OK' }]
        );
      }

      // Reset call state
      setIsVideoCall(false);
      setCallAccepted(false);
      setCurrentChannel(null);
      callAcceptedRef.current = false;

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
  }, [initializeEngine, myId, currentChannel, isConnected]);

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
          // Stop video preview before leaving
          console.log('Stopping video preview...');
          await engineRef.current.stopPreview();
        } catch (previewError: any) {
          console.warn('Error stopping video preview:', previewError);
        }

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
      setRemoteFriendId(null); // Clear remote friend ID
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
      setLocalRemoteFilter(''); // Reset local remote filter state
      localUidRef.current = null;
      isJoiningRef.current = false;
      callAcceptedRef.current = false;
      callStartTime.current = null;
      localPreviewStarted.current = false; // Reset preview flag

      // Clear duration interval
      if (minimizedDurationInterval.current) {
        clearInterval(minimizedDurationInterval.current);
        minimizedDurationInterval.current = null;
      }

      // Release end-call lock after cleanup completes
      isEndingCallRef.current = false;

      console.log('Video call cleanup completed');
    } catch (error) {
      console.error('Failed to leave video channel:', error);
      // Even if cleanup fails, reset the state to prevent UI issues
      setCallAccepted(false);
      setIsVideoCall(false);
      setCurrentChannel(null);
      setIncomingCall(null);
      setRemoteFriendId(null); // Clear remote friend ID
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
      setLocalRemoteFilter(''); // Reset local remote filter state
      localUidRef.current = null;
      isJoiningRef.current = false;
      callAcceptedRef.current = false;
      callStartTime.current = null;
      localPreviewStarted.current = false; // Reset preview flag
      engineRef.current = null;
      // Ensure end-call lock is released even on failures
      isEndingCallRef.current = false;
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

  // Reset status bar when leaving this component to avoid translucent persisting globally
  useEffect(() => {
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

  // Local cleanup without emitting to server
  const cleanupCall = useCallback(async () => {
    console.log('VideoCall: cleanupCall called');
    
    if (currentChannel) {
      const callId = `video-${currentChannel}`;
      endMinimizedCall(callId);
    }
    
    await leaveChannel();

    // Ensure status bar is not translucent after closing the call (prevents overlay on header)
    if (Platform.OS === 'android') {
      try {
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor(themeColors.background.primary);
      } catch (e) {
        // no-op
      }
    }

    // Navigate back to MessageList screen specifically
    try {
      const nav: any = navigation;
      nav.navigate('Message', { screen: 'MessageList' });
    } catch (e) {
      console.warn('Navigation error after call end:', e);
    }
  }, [currentChannel, leaveChannel, endMinimizedCall, navigation]);

  // End call - called when user clicks end button
  const endCall = useCallback(async () => {
    console.log('VideoCall: endCall called, isEndingCallRef:', isEndingCallRef.current, 'callEnded:', callEnded);
    
    // CRITICAL: Use ref for immediate synchronous check (state updates are async!)
    if (isEndingCallRef.current) {
      console.log('VideoCall: Already ending call (ref check), ignoring duplicate');
      return;
    }
    
    // Prevent multiple calls to endCall with both ref and state
    if (callEnded) {
      console.log('VideoCall: Call already ended (state check), ignoring duplicate');
      return;
    }

    // IMPORTANT: Set BOTH ref and state immediately
    isEndingCallRef.current = true;
    setCallEnded(true);

    console.log('VideoCall: Ending video call...');
    console.log('VideoCall: Debug state:', {
      remoteFriendId,
      incomingCallFrom: incomingCall?.from,
      currentChannel,
      myId,
      callAccepted,
      isVideoCall
    });

    // Emit leaveVideoCall to notify the other user (server will broadcast to both)
    // Try multiple sources to get the friend ID:
    // 1. remoteFriendId (set when call is accepted)
    // 2. incomingCall?.from (person who called us)
    // 3. Extract from channel name (format: userId1-userId2)
    let friendIdToNotify = remoteFriendId || incomingCall?.from;
    
    // Fallback: Extract friend ID from channel name
    if (!friendIdToNotify && currentChannel) {
      const channelParts = currentChannel.split('-');
      if (channelParts.length === 2) {
        // Channel format is myId-friendId or friendId-myId
        friendIdToNotify = channelParts[0] === myId ? channelParts[1] : channelParts[0];
        console.log('VideoCall: Extracted friend ID from channel name:', friendIdToNotify);
      }
    }
    
    console.log('VideoCall: Friend ID to notify:', friendIdToNotify);
    
    if (friendIdToNotify && friendIdToNotify !== myId) {
      console.log('VideoCall: ✅ Emitting endVideoCall to friend:', friendIdToNotify);
      endVideoCall(friendIdToNotify);
    } else {
      console.error('VideoCall: ❌ ERROR - No valid friend ID to notify! Cannot end call for other user.');
      console.error('VideoCall: Debug - friendIdToNotify:', friendIdToNotify, ', myId:', myId);
    }
    
    // Do local cleanup
    await cleanupCall();
  }, [remoteFriendId, incomingCall, currentChannel, myId, endVideoCall, cleanupCall, callEnded, callAccepted, isVideoCall]);

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
      try {
        console.log('Toggling camera from', isCameraOn, 'to', !isCameraOn);
        
        if (!isCameraOn) {
          // Turning camera ON
          console.log('Starting camera preview...');
          await engineRef.current.enableLocalVideo(true);
          await engineRef.current.muteLocalVideoStream(false);
          await engineRef.current.startPreview();
          localPreviewStarted.current = true;
          setIsCameraOn(true);
        } else {
          // Turning camera OFF
          console.log('Stopping camera preview...');
          await engineRef.current.muteLocalVideoStream(true);
          await engineRef.current.stopPreview();
          localPreviewStarted.current = false;
          setIsCameraOn(false);
        }
        
        console.log('Camera toggled successfully');
      } catch (error) {
        console.error('Failed to toggle camera:', error);
        // Still update state to reflect user intent, but log the error
        setIsCameraOn(!isCameraOn);
      }
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

  // Toggle video filter - applies LOCAL filter to how I see the remote user
  const toggleVideoFilter = useCallback(() => {
    const filters = ['', 'vivid', 'warm', 'cool', 'dramatic'];
    const currentIndex = filters.indexOf(localRemoteFilter);
    const nextIndex = (currentIndex + 1) % filters.length;
    const newFilter = filters[nextIndex];
    
    console.log('🎥 Toggling LOCAL remote video filter from', localRemoteFilter, 'to', newFilter);
    setLocalRemoteFilter(newFilter);
    console.log('🎥 Filter applied locally - does not affect other user');
  }, [localRemoteFilter]);

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
    let interval: ReturnType<typeof setInterval> | null = null;
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

      // Debounce rapid-fire events (prevent processing same event within 2 seconds)
      const now = Date.now();
      if (now - lastCallAcceptedTime.current < 2000) {
        console.log('VideoCall: Ignoring rapid-fire call accepted event');
        return;
      }
      lastCallAcceptedTime.current = now;

      // Prevent duplicate processing of the same call
      if (callAcceptedRef.current && currentChannel === channelName) {
        console.log('VideoCall: Call already accepted for this channel, ignoring duplicate event');
        return;
      }

      // Only handle video call acceptance - let AudioCall component handle audio calls
      if (!isAudio) {
        console.log('VideoCall: Video call accepted, joining channel:', channelName);
        console.log('VideoCall: Setting remote friend ID:', callerId);
        
        // Set up call information for video calls
        setIncomingCall({
          from: callerId || 'caller',
          channelName,
          name: callerName || 'Video Call',
          profilePic: callerProfilePic || ''
        });
        setRemoteFriendId(callerId || null); // IMPORTANT: Track the other user's ID
        setIsVideoCall(true);
        setIsCameraOn(true); // Enable camera for video calls
        setCurrentChannel(channelName);
        setCallAccepted(true); // Important: mark call as accepted
        setCallEnded(false); // Reset call ended state for accepted call
        isEndingCallRef.current = false;
        setIsAudioMode(false);
        joinChannel(channelName);
      } else {
        console.log('VideoCall: Audio call accepted, but letting AudioCall component handle it:', channelName);
        // Don't handle audio calls here - let AudioCall component handle them
        return;
      }
    };

    const handleCallEnd = async () => {
      console.log('VideoCall: Received videoCallEnd event from server');
      console.log('VideoCall: Current state - isEndingCallRef:', isEndingCallRef.current, 'callAccepted:', callAccepted, 'isVideoCall:', isVideoCall, 'callEnded:', callEnded);
      
      // CRITICAL: Check ref first (synchronous check)
      if (isEndingCallRef.current) {
        console.log('VideoCall: Already ending call (ref check), ignoring videoCallEnd event');
        return;
      }
      
      // Prevent multiple processing with state
      if (callEnded) {
        console.log('VideoCall: Call already ended (state check), ignoring duplicate videoCallEnd event');
        return;
      }
      
      // Debounce rapid-fire call end events (prevent processing same event within 2 seconds)
      const now = Date.now();
      if (now - lastCallEndTime.current < 2000) {
        console.log('VideoCall: Ignoring rapid-fire videoCallEnd event (debounce)');
        return;
      }
      lastCallEndTime.current = now;
      
      // Only handle call end if we're actually in a video call
      if (callAccepted || isVideoCall) {
        console.log('VideoCall: Processing videoCallEnd - doing local cleanup only (NO re-emit)');
        
        // Set BOTH ref and state
        isEndingCallRef.current = true;
        setCallEnded(true);
        
        // IMPORTANT: Only do local cleanup, do NOT call endCall() which would re-emit
        await cleanupCall();
      } else {
        console.log('VideoCall: Ignoring videoCallEnd event - not in active video call state');
      }
    };

    const handleVideoFilter = ({ filter }: { filter: string }) => {
      // This filter should be applied to how I see the remote user's video
      setRemoteFilter(filter);
    };

    // Removed: on('incoming-video-call', handleIncomingCall); - handled by IncomingCall screen
    on('call-accepted', handleCallAccepted);
    on('videoCallEnd', handleCallEnd);
    // Removed: audioCallEnd - handled by AudioCall component
    on('apply-video-filter', handleVideoFilter);

    return () => {
      // Removed: off('incoming-video-call', handleIncomingCall); - handled by IncomingCall screen
      off('call-accepted', handleCallAccepted);
      off('videoCallEnd', handleCallEnd);
      // Removed: audioCallEnd cleanup - handled by AudioCall component
      off('apply-video-filter', handleVideoFilter);
    };
  }, [on, off, joinChannel, cleanupCall]);

  // Track remote filter changes
  useEffect(() => {
    console.log('🎥 Remote filter state changed:', remoteFilter);
    if (remoteFilter) {
      console.log('🎥 Remote video should now show filter:', remoteFilter);
    }
  }, [remoteFilter]);

  // Track my filter changes
  useEffect(() => {
    console.log('🎥 My filter state changed:', myFilter);
    if (myFilter) {
      console.log('🎥 My video should now show filter:', myFilter);
    }
  }, [myFilter]);

  // Start local video when all conditions are met and view is ready to render
  useEffect(() => {
    const retryTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    // Check if the local video view should be rendered (same conditions as in JSX)
    const shouldRenderLocalVideo = !isEndingCallRef.current && !callEnded && isVideoCall && isCameraOn && !isAudioMode && callAccepted && isConnected && localUidRef.current;
    
    if (shouldRenderLocalVideo && engineRef.current && !localPreviewStarted.current) {
      console.log('📹 Local video view conditions met, starting preview...');
      
      // Multiple attempts with increasing delays to ensure it works
      const startWithRetry = (attempt: number = 1) => {
        const delay = attempt * 400; // 400ms, 800ms, 1200ms
        
        const timeout = setTimeout(async () => {
          try {
            console.log(`📹 Attempt ${attempt}: Starting local video preview...`);
            if (engineRef.current && !localPreviewStarted.current) {
              await engineRef.current.enableLocalVideo(true);
              await engineRef.current.muteLocalVideoStream(false);
              await engineRef.current.startPreview();
              
              // CRITICAL FIX: Add a small delay then trigger camera activation
              // This ensures the camera hardware is properly initialized
              setTimeout(async () => {
                try {
                  if (engineRef.current) {
                    console.log('📹 Activating camera hardware...');
                    // Switching camera twice activates the hardware properly
                    await engineRef.current.switchCamera();
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
                    await engineRef.current.switchCamera();
                    console.log('📹 Camera hardware activated successfully');
                  }
                } catch (activationError) {
                  console.warn('📹 Camera activation warning (non-critical):', activationError);
                }
              }, 200);
              
              localPreviewStarted.current = true;
              console.log(`📹 Attempt ${attempt}: Local video preview started successfully! ✅`);
            }
          } catch (error) {
            console.error(`📹 Attempt ${attempt} failed:`, error);
            if (attempt < 3 && !localPreviewStarted.current) {
              startWithRetry(attempt + 1);
            }
          }
        }, delay);
        
        retryTimeouts.push(timeout);
      };
      
      startWithRetry(1);
    }
    
    // Reset preview flag when camera is turned off
    if (!isCameraOn) {
      localPreviewStarted.current = false;
    }
    
    return () => {
      retryTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isConnected, isVideoCall, isCameraOn, isAudioMode, callAccepted, callEnded]);

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

  // Debug helper to check video stream status
  const debugVideoStatus = useCallback(async () => {
    if (!engineRef.current) {
      console.log('🔍 Debug: No engine available');
      return;
    }

    try {
      console.log('🔍 Debug: Video stream status check');
      console.log('🔍 - isVideoCall:', isVideoCall);
      console.log('🔍 - isCameraOn:', isCameraOn);
      console.log('🔍 - isAudioMode:', isAudioMode);
      console.log('🔍 - callAccepted:', callAccepted);
      console.log('🔍 - currentChannel:', currentChannel);
      console.log('🔍 - isConnected:', isConnected);
      console.log('🔍 - localUid:', localUidRef.current);
      console.log('🔍 - remoteUid:', remoteUid);
      
      // Try to force restart preview
      console.log('🔍 Attempting to restart video preview...');
      await engineRef.current.enableLocalVideo(true);
      await engineRef.current.muteLocalVideoStream(false);
      await engineRef.current.startPreview();
      console.log('🔍 Video preview restarted successfully');
      setIsCameraOn(true);
    } catch (error) {
      console.error('🔍 Debug: Error checking video status:', error);
    }
  }, [isVideoCall, isCameraOn, isAudioMode, callAccepted, currentChannel, isConnected, remoteUid]);

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
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background.primary} translucent={false} />
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        {/* Header with Top Controls */}
        <View style={[styles.header, { backgroundColor: themeColors.surface.header }]}>
          {/* Top Row: Action Buttons */}
          <View style={styles.topControls}>
            <View style={styles.topLeftControls}>
              <TouchableOpacity
                style={[styles.topControlButton, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}
                onPress={minimizeVideoCall}
              >
                <Icon name="minimize" size={20} color="white" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.topCenterInfo}>
              <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
                {isAudioMode ? 'Audio Call' : 'Video Call'} - {incomingCall?.name || 'Unknown'}
              </Text>
              {callAccepted && (
                <Text style={[styles.duration, { color: themeColors.text.secondary }]}>
                  {formatDuration(callDuration)}
                </Text>
              )}
            </View>

            <View style={styles.topRightControls}>
              <TouchableOpacity
                style={[
                  styles.topControlButton, 
                  { backgroundColor: localRemoteFilter ? 'rgba(41, 177, 169, 0.8)' : 'rgba(0, 0, 0, 0.3)' }
                ]}
                onPress={toggleVideoFilter}
              >
                <Icon name="filter-list" size={20} color="white" />
                {localRemoteFilter && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      {localRemoteFilter.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* Debug button - remove in production */}
              {/* <TouchableOpacity
                style={[styles.topControlButton, { backgroundColor: 'rgba(255, 0, 0, 0.3)', marginLeft: 8 }]}
                onPress={debugVideoStatus}
              >
                <Icon name="bug-report" size={16} color="white" />
              </TouchableOpacity> */}
            </View>
          </View>

          {/* Filter Indicator */}
          {localRemoteFilter && (
            <View style={styles.filterIndicatorContainer}>
              <Text style={[styles.filterIndicator, { color: themeColors.primary }]}>
                Filter: {localRemoteFilter.charAt(0).toUpperCase() + localRemoteFilter.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Video Container */}
        <View style={styles.videoContainer}>
          {/* Remote Video */}
          {callAccepted && remoteUid && !isAudioMode ? (
            <View style={styles.remoteVideo}>
              <RtcRemoteView.SurfaceView
                style={[styles.remoteVideo, getFilterStyle(localRemoteFilter || remoteFilter)]}
                uid={remoteUid}
                channelId={currentChannel || ''}
                renderMode={VideoRenderMode.Fit}
                zOrderMediaOverlay={false}
              />
              {(localRemoteFilter || remoteFilter) && (
                <>
                  {/* Primary filter overlay - prioritize local filter over remote */}
                  <View style={[styles.filterOverlay, getFilterOverlayStyle(localRemoteFilter || remoteFilter)]} />
                  {/* Secondary filter overlay for more realistic effect */}
                  <View style={[styles.filterOverlay, getFilterOverlaySecondaryStyle(localRemoteFilter || remoteFilter)]} />
                </>
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

          {/* Local Video - Show filter preview on my own video */}
          {isVideoCall && isCameraOn && !isAudioMode && callAccepted && isConnected && localUidRef.current && (
            <View style={styles.localVideoContainer}>
              <RtcLocalView.SurfaceView
                style={styles.localVideo}
                channelId={currentChannel || ''}
                renderMode={VideoRenderMode.Hidden}
                zOrderMediaOverlay={true}
                mirrorMode={1}
              />
              {myFilter && (
                <>
                  {/* Primary filter overlay */}
                  <View style={[styles.filterOverlay, getFilterOverlayStyle(myFilter), { pointerEvents: 'none' }]} />
                  {/* Secondary filter overlay for more realistic effect */}
                  <View style={[styles.filterOverlay, getFilterOverlaySecondaryStyle(myFilter), { pointerEvents: 'none' }]} />
                </>
              )}
              {/* Me indicator */}
              <View style={styles.meIndicator}>
                <Text style={styles.meIndicatorText}>Me</Text>
              </View>
              {/* Filter indicator on local video */}
              {myFilter && (
                <View style={styles.localFilterIndicator}>
                  <Text style={styles.localFilterText}>
                    {myFilter.charAt(0).toUpperCase() + myFilter.slice(1)}
                  </Text>
                </View>
              )}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topLeftControls: {
    flex: 1,
    alignItems: 'flex-start',
  },
  topCenterInfo: {
    flex: 2,
    alignItems: 'center',
  },
  topRightControls: {
    flex: 1,
    alignItems: 'flex-end',
  },
  topControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  filterBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filterIndicatorContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  duration: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  filterIndicator: {
    fontSize: 11,
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
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#29B1A9',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  },
  localVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },
  meIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(41, 177, 169, 0.9)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  meIndicatorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  localFilterIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  localFilterText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
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
  // Ensure non-zero and within Agora valid rangemove 
  const uid = hash % 4000000000;
  return uid === 0 ? 1 : uid;
}
