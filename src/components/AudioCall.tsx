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

interface AudioCallProps {
  myId: string;
}

interface IncomingCall {
  from: string;
  channelName: string;
  name: string;
  profilePic: string;
}

const AudioCall: React.FC<AudioCallProps> = ({ myId }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const { on, off, answerAudioCall, endAudioCall } = useSocket();
  const { minimizeCall, restoreCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();
  const myProfile = useSelector((state: RootState) => state.profile);

  const [isAudioCall, setIsAudioCall] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const engineRef = useRef<RtcEngine | null>(null);
  const callStartTime = useRef<number | null>(null);
  const minimizedDurationInterval = useRef<NodeJS.Timeout | null>(null);

  // Get Agora token
  const getToken = async (channelName: string, uid: number = 0) => {
    try {
      const { data } = await api.post('/agora/token', { channelName, uid });
      return data; // { appId, token }
    } catch (error) {
      console.error('Failed to get Agora token:', error);
      throw error;
    }
  };

  // Initialize Agora Engine
  const initializeEngine = useCallback(async () => {
    try {
      if (engineRef.current) {
        return engineRef.current;
      }

      const { appId } = await getToken('test', 0); // Get appId from server
      const engine = await RtcEngine.create(appId);
      
      // Disable video for audio-only call
      await engine.disableVideo();
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

      engine.addListener('Error', (error: any) => {
        console.error('Agora error:', error);
      });

      engineRef.current = engine;
      return engine;
    } catch (error) {
      console.error('Failed to initialize Agora engine:', error);
      throw error;
    }
  }, [myId]);

  // Join channel
  const joinChannel = useCallback(async (channelName: string) => {
    try {
      const engine = await initializeEngine();
      const numericUid = Number.isFinite(Number(myId)) ? Number(myId) : 0;
      const { token } = await getToken(channelName, numericUid);
      
      // Join channel
      await engine.joinChannel(token, channelName, null, numericUid);
      console.log('Joining audio channel:', channelName);
      
      setCallAccepted(true);
      setCurrentChannel(channelName);
      
      // Set call start time for duration tracking
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
    } catch (error) {
      console.error('Failed to join audio channel:', error);
      Alert.alert('Call Failed', 'Unable to join the call. Please try again.');
      setIsAudioCall(false);
      setCallAccepted(false);
    }
  }, [initializeEngine, myId]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    try {
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        await engineRef.current.destroy();
        engineRef.current = null;
      }
      
      setCallAccepted(false);
      setIsAudioCall(false);
      setCurrentChannel(null);
      setReceivingCall(false);
      setIncomingCall(null);
      setIsMinimized(false);
      setCallDuration(0);
      setRemoteUid(null);
      setIsConnected(false);
      callStartTime.current = null;
      
      // Clear duration interval
      if (minimizedDurationInterval.current) {
        clearInterval(minimizedDurationInterval.current);
        minimizedDurationInterval.current = null;
      }
    } catch (error) {
      console.error('Failed to leave audio channel:', error);
    }
  }, []);

  // Answer call
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    
    console.log('Answering audio call');
    answerAudioCall(incomingCall.from, incomingCall.channelName);
    await joinChannel(incomingCall.channelName);
    setReceivingCall(false);
  }, [incomingCall, answerAudioCall, joinChannel]);

  // End call
  const endCall = useCallback(async () => {
    if (currentChannel) {
      const callId = `audio-${currentChannel}`;
      endMinimizedCall(callId);
    }
    
    endAudioCall(incomingCall?.from || '');
    await leaveChannel();
  }, [currentChannel, incomingCall, endAudioCall, leaveChannel, endMinimizedCall]);

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
    const handleIncomingCall = ({ from, channelName, isAudio, callerName, callerProfilePic }: any) => {
      // Only handle audio calls
      if (isAudio) {
        console.log('Incoming audio call from', from, 'channel:', channelName);
        setIncomingCall({
          from,
          channelName,
          name: callerName || 'Unknown Caller',
          profilePic: callerProfilePic || ''
        });
        setIsAudioCall(true);
        setReceivingCall(true);
        setCurrentChannel(channelName);
      }
    };

    const handleCallAccepted = ({ channelName, isAudio }: any) => {
      // Only handle audio call acceptance
      if (isAudio) {
        console.log('Audio call accepted, joining channel:', channelName);
        joinChannel(channelName);
      }
    };

    const handleCallEnd = () => {
      endCall();
    };

    on('agora-incoming-audio-call', handleIncomingCall);
    on('agora-call-accepted', handleCallAccepted);
    on('audioCallEnd', handleCallEnd);

    return () => {
      off('agora-incoming-audio-call', handleIncomingCall);
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
            {incomingCall?.profilePic ? (
              <Image source={{ uri: incomingCall.profilePic }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profilePlaceholder, { backgroundColor: themeColors.gray[600] }]}>
                <Icon name="person" size={80} color={themeColors.text.secondary} />
              </View>
            )}
            
            <Text style={[styles.callerName, { color: themeColors.text.primary }]}>
              {incomingCall?.name || 'Unknown Caller'}
            </Text>
            
            <Text style={[styles.callStatus, { color: themeColors.text.secondary }]}>
              {receivingCall ? 'Incoming call...' : callAccepted ? `Connected • ${formatDuration(callDuration)}` : 'Connecting...'}
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
                      { backgroundColor: themeColors.primary, height: Math.random() * 30 + 10 }
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

          {/* Answer/Decline for incoming calls */}
          {!callAccepted && receivingCall && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, styles.answerButton, { backgroundColor: themeColors.status.success }]}
                onPress={answerCall}
              >
                <Icon name="call" size={24} color="white" />
              </TouchableOpacity>
            </>
          )}

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
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 24,
  },
  profilePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 16,
    textAlign: 'center',
  },
  audioStatusContainer: {
    alignItems: 'center',
  },
  audioWaves: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
  },
  audioWave: {
    width: 4,
    marginHorizontal: 2,
    borderRadius: 2,
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
