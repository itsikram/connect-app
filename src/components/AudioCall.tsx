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

// Cross-mount guards to prevent duplicate joins/subscriptions
let joiningAudioChannel: string | null = null;
let activeAudioChannel: string | null = null;

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

  useEffect(() => {
    console.log('AudioCall: Component mounted with pp:', myId);
    if (!myId) return;
  }, [myId]);

  const { colors: themeColors, isDarkMode } = useTheme();
  const { on, off, answerAudioCall, endAudioCall, isConnected } = useSocket();

  console.log('AudioCall: Socket connection status:', isConnected);
  const { minimizeCall, restoreCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();
  const myProfile = useSelector((state: RootState) => state.profile);
  const navigation = useNavigation();

  const [isAudioCall, setIsAudioCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>('Connecting...');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [remoteFriendId, setRemoteFriendId] = useState<string | null>(null); // Track the other user's ID
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [errorShown, setErrorShown] = useState(false);

  const engineRef = useRef<RtcEngine | null>(null);
  const isLeavingRef = useRef<boolean>(false);
  const callStartTime = useRef<number | null>(null);
  const minimizedDurationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCallEndTime = useRef<number>(0);
  const isEndingCallRef = useRef<boolean>(false);
  const hasJoinedRef = useRef<boolean>(false);
  const listenersSetupRef = useRef<boolean>(false);
  const callAcceptedRef = useRef<boolean>(false);
  const isAudioCallRef = useRef<boolean>(false);
  const handleCallAcceptedRef = useRef<any>(null);
  const handleCallEndRef = useRef<any>(null);
  const leaveChannelRef = useRef<any>(null);

  // Track component lifecycle
  useEffect(() => {
    console.log('AudioCall: Component mounted, setting up...');
    console.log('AudioCall: Socket on/off functions available:', !!on, !!off);

    return () => {
      console.log('AudioCall: Component unmounting, cleaning up...');
    };
  }, []);

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
            {
              text: 'Settings', onPress: () => {
                // You could add a function to open app settings here
                endCall();
              }
            }
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

      setCallStatus("Waiting for user...")

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
        setCallStatus("Connected")
        setRemoteUid(uid);
      });

      engine.addListener('UserOffline', async (uid: number, reason: number) => {
        console.log('Remote user left:', uid);
        console.log('UserOffline reason:', reason);

        // Log reason details
        const reasonMessages: { [key: number]: string } = {
          0: 'User quit',
          1: 'User dropped (network issue)',
          2: 'Became audience',
          3: 'Same UID logged in from another device',
          4: 'Switched to voice-only',
        };
        const reasonMessage = reasonMessages[reason] || `Unknown reason (code: ${reason})`;
        console.log(`UserOffline reason: ${reasonMessage}`);
        await cleanupCall();


        setRemoteUid(null);
        // End audio call locally when remote leaves to ensure both sides end instantly
        // if (!isEndingCallRef.current && (callAccepted || isAudioCall || currentChannel)) {
        //   try {
        //     isEndingCallRef.current = true;
        //     await cleanupCall();
        //   } catch (e) {
        //     console.warn('Audio cleanup after remote offline failed:', e);
        //   }
        // }
      });

      engine.addListener('JoinChannelSuccess', (channel: string, uid: number) => {
        console.log('Joined channel successfully:', channel, uid);
        // Note: isConnected is now managed by socket context, not local state
      });

      engine.addListener('LeaveChannel', () => {
        console.log('Left channel');
        // Note: isConnected is now managed by socket context, not local state
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
      // Global guard across remounts
      if (joiningAudioChannel === channelName || activeAudioChannel === channelName) {
        console.log('Join channel skipped by global guard - already joining/joined:', channelName);
        return;
      }
      // Prevent duplicate join attempts
      if (hasJoinedRef.current) {
        console.log('Join channel skipped - already joining/joined:', channelName);
        return;
      }
      hasJoinedRef.current = true;
      joiningAudioChannel = channelName;
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
      activeAudioChannel = channelName;
      joiningAudioChannel = null;

      // Set call start time for duration tracking
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
    } catch (error: any) {
      console.error('Failed to join audio channel:', error);
      const message = (error?.message || '').toString().toLowerCase();
      // If join is rejected (often means already joined), treat as no-op
      if (message.includes('rejected')) {
        console.log('Join request rejected (likely already joined). Ignoring.');
        // Keep hasJoinedRef as true and do not reset state/engine
        joiningAudioChannel = null;
        return;
      }

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
      hasJoinedRef.current = false;
      joiningAudioChannel = null;

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
      setRemoteFriendId(null); // Clear remote friend ID
      setIsMinimized(false);
      setCallDuration(0);
      setRemoteUid(null);
      hasJoinedRef.current = false;
      activeAudioChannel = null;
      joiningAudioChannel = null;
      // Note: isConnected is now managed by socket context, not local state
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


  // Reset status bar when leaving this component to avoid translucent persisting globally
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

  // Local cleanup without emitting to server
  const cleanupCall = useCallback(async () => {
    console.log('AudioCall: cleanupCall called');
    setCallStatus("Ending call...")
    if (currentChannel) {
      const callId = `audio-${currentChannel}`;
      endMinimizedCall(callId);
    }

    await leaveChannel();
    activeAudioChannel = null;
    joiningAudioChannel = null;

    // Ensure status bar is not translucent after closing the call (prevents overlay on header)
    if (Platform.OS === 'android') {
      try {
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor(themeColors.background.primary);
      } catch (e) {
        // no-op
      }
    }

    // Simply navigate back without complex navigation logic to prevent loops
    try {
      const nav: any = navigation;
      nav.navigate('Message', { screen: 'MessageList' });
    } catch (e) {
      console.warn('Navigation error after call end:', e);
    }
  }, [currentChannel, leaveChannel, endMinimizedCall, navigation]);

  // End call - called when user clicks end button
  const endCall = useCallback(async () => {
    console.log('AudioCall: endCall called, isEndingCallRef:', isEndingCallRef.current);

    console.log('AudioCall: Ending audio call...');
    console.log('AudioCall: Debug state:', {
      remoteFriendId,
      incomingCallFrom: incomingCall?.from,
      currentChannel,
      myId,
      callAccepted,
      isAudioCall
    });

    // Emit leaveAudioCall to notify the other user (server will broadcast to both)
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
        console.log('AudioCall: Extracted friend ID from channel name:', friendIdToNotify);
      }
    }

    console.log('AudioCall: Friend ID to notify:', friendIdToNotify);

    if (friendIdToNotify && friendIdToNotify !== myId) {
      console.log('AudioCall: ✅ Emitting endAudioCall to friend:', friendIdToNotify);
      endAudioCall(friendIdToNotify, currentChannel || undefined, 'end');
    } else {
      console.error('AudioCall: ❌ ERROR - No valid friend ID to notify! Cannot end call for other user.');
      console.error('AudioCall: Debug - friendIdToNotify:', friendIdToNotify, ', myId:', myId);
    }

    // Do local cleanup
    await cleanupCall();

    // DON'T reset the flag - keep it set to prevent any further calls
    // isEndingCallRef.current = false;
  }, [remoteFriendId, callAccepted, isAudioCall, currentChannel, myId, incomingCall, endAudioCall, cleanupCall]);

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

  // Handle call acceptance
  const handleCallAccepted = useCallback(({ channelName, isAudio, callerName, callerProfilePic, callerId }: any) => {
    console.log('AudioCall: Call accepted event received:', { channelName, isAudio, callerName, callerProfilePic });
    console.log('AudioCall: Current state before handling - callAccepted:', callAccepted, 'isAudioCall:', isAudioCall);

    // Only handle audio call acceptance
    if (isAudio) {
      // Ignore duplicate accept events for the same channel
      if (hasJoinedRef.current && currentChannel === channelName) {
        console.log('AudioCall: Duplicate call-accepted for same channel, ignoring:', channelName);
        return;
      }
      // Global guard in case of remounts
      if (joiningAudioChannel === channelName || activeAudioChannel === channelName) {
        console.log('AudioCall: Global guard prevented duplicate accept handling for channel:', channelName);
        return;
      }
      console.log('AudioCall: Audio call accepted, joining channel:', channelName);
      console.log('AudioCall: Setting remote friend ID:', callerId);

      // Set up call information for audio calls
      setIncomingCall({
        from: callerId || 'caller',
        channelName,
        name: callerName || 'Audio Call',
        profilePic: callerProfilePic || ''
      });
      setRemoteFriendId(callerId || null); // IMPORTANT: Track the other user's ID
      setIsAudioCall(true);
      setCallAccepted(true);
      setCurrentChannel(channelName);

      console.log('AudioCall: Set states - isAudioCall: true, callAccepted: true, channel:', channelName);

      // Join the audio channel
      joinChannel(channelName);
    } else {
      console.log('AudioCall: Video call accepted, but letting VideoCall component handle it:', channelName);
      // Don't handle video calls here - let VideoCall component handle them
      return;
    }
  }, [joinChannel]);

  // Handle call end
  const handleCallEnd = useCallback(() => {
    console.log('AudioCall: Received audioCallEnd event from server');

    const now = Date.now();
    if (now - lastCallEndTime.current < 2000) {
      console.log('AudioCall: Ignoring rapid-fire call end event (debounce)');
      return;
    }
    lastCallEndTime.current = now;

    // Handle call end if we're in any call state or if we have an active channel
    if (callAccepted || isAudioCall || currentChannel) {
      console.log('AudioCall: Processing audio-call-ended - doing local cleanup only (NO re-emit)');
      // IMPORTANT: Only do local cleanup, do NOT call endCall() which would re-emit
      cleanupCall();
      // DON'T reset the flag - keep it set to prevent any further calls
    } else {
      console.log('AudioCall: Ignoring call end event - not in active audio call state');
      console.log('AudioCall: Debug - callAccepted:', callAccepted, 'isAudioCall:', isAudioCall, 'currentChannel:', currentChannel);
    }
  }, [callAccepted, isAudioCall, currentChannel, incomingCall, cleanupCall]);

  // Keep callbacks in ref for stable references
  useEffect(() => {
    handleCallAcceptedRef.current = handleCallAccepted;
  }, [handleCallAccepted]);

  useEffect(() => {
    handleCallEndRef.current = handleCallEnd;
  }, [handleCallEnd]);

  // Socket event listeners
  useEffect(() => {
    if (!isConnected) {
      console.log('AudioCall: Socket not connected, skipping event listener setup');
      return;
    }

    if (listenersSetupRef.current) {
      console.log('AudioCall: Socket event listeners already set, skipping');
      return;
    }
    listenersSetupRef.current = true;

    console.log('AudioCall: Setting up socket event listeners');
    console.log('AudioCall: Dependencies - on:', !!on, 'off:', !!off);

    const handleCallAcceptedWrapper = (data: any) => {
      if (handleCallAcceptedRef.current) {
        handleCallAcceptedRef.current(data);
      }
    };

    const handleCallEndWrapper = () => {
      if (handleCallEndRef.current) {
        handleCallEndRef.current();
      }
    };

    on('call-accepted', handleCallAcceptedWrapper);
    on('audio-call-ended', handleCallEndWrapper);


    return () => {
      console.log('AudioCall: Cleaning up socket event listeners');
      listenersSetupRef.current = false;
      off('call-accepted', handleCallAcceptedWrapper);
      off('audio-call-ended', handleCallEndWrapper);
    };
  }, [isConnected, on, off]);

  // Keep refs in sync with latest state to avoid stale logs/guards
  useEffect(() => {
    callAcceptedRef.current = callAccepted;
  }, [callAccepted]);
  useEffect(() => {
    isAudioCallRef.current = isAudioCall;
  }, [isAudioCall]);

  // Keep leaveChannel in ref for stable cleanup reference
  useEffect(() => {
    leaveChannelRef.current = leaveChannel;
  }, [leaveChannel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (leaveChannelRef.current) {
        leaveChannelRef.current();
      }
    };
  }, []);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isAudioCall || isMinimized) {
    return null;
  }

  const displayName = incomingCall?.name || 'Unknown Caller';
  const displayPic = incomingCall?.profilePic || '';

  return (
    <Modal
      visible={isAudioCall}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={endCall}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background.primary} translucent={false} />
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        {/* Header with Top Controls (aligned with VideoCall) */}
        <View style={[styles.header, { backgroundColor: themeColors.surface.header }]}>
          <View style={styles.topControls}>
            <View style={styles.topLeftControls}>
              <TouchableOpacity
                style={[styles.topControlButton, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}
                onPress={minimizeAudioCall}
              >
                <Icon name="minimize" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.topCenterInfo}>
              <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
                {`Audio Call - ${displayName}`}
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
                  { backgroundColor: isSpeakerOn ? 'rgba(41, 177, 169, 0.8)' : 'rgba(0, 0, 0, 0.3)' }
                ]}
                onPress={toggleSpeaker}
              >
                <Icon name={isSpeakerOn ? 'volume-up' : 'volume-down'} size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
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


            <Text style={[styles.callStatus, { color: callStatus === 'Connecting...' ? themeColors.text.secondary : themeColors.status.success || '#34C759' }]}>
              {callStatus}
            </Text>
          </View>

          {/* Audio Visualizer - only show when remote user has joined */}
          {callAccepted && remoteUid !== null && (
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
                style={[styles.controlButton, { backgroundColor: isMuted ? '#666666' : '#29B1A9' }]}
                onPress={toggleMute}
              >
                <Icon name={isMuted ? 'mic-off' : 'mic'} size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isSpeakerOn ? '#29B1A9' : '#666666' }]}
                onPress={toggleSpeaker}
              >
                <Icon name={isSpeakerOn ? 'volume-up' : 'volume-down'} size={24} color="white" />
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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

export default AudioCall;
