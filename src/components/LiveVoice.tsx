import React, { useEffect, useState, useRef, useCallback } from 'react';
import RtcEngine from 'react-native-agora';
import { useSocket } from '../contexts/SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import LiveVoiceModal from './LiveVoiceModal';
import api from '../lib/api';

interface LiveVoiceProps {
  myId: string;
}

const LiveVoice: React.FC<LiveVoiceProps> = ({ myId }) => {
  const { on, off, isConnected } = useSocket();
  const myProfile = useSelector((state: RootState) => state.profile);
  
  const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
  const [isLiveVoiceModalOpen, setIsLiveVoiceModalOpen] = useState(false);
  const [liveVoiceDuration, setLiveVoiceDuration] = useState(0);
  const [friendName, setFriendName] = useState<string>('Friend');
  const [senderId, setSenderId] = useState<string | null>(null);
  const [currentChannelName, setCurrentChannelName] = useState<string | null>(null);
  
  const liveVoiceEngineRef = useRef<RtcEngine | null>(null);
  const liveVoiceDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate consistent UID from profileId hash
  const generateUid = useCallback((str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, []);

  // Extract friend ID from channel name (format: userId1_userId2 sorted)
  const extractFriendId = useCallback((channelName: string, myId: string): string | null => {
    try {
      const parts = channelName.split('_');
      if (parts.length !== 2) return null;
      
      // Find which one is not myId
      const friendId = parts.find(id => id !== myId);
      return friendId || null;
    } catch (e) {
      console.error('Error extracting friend ID:', e);
      return null;
    }
  }, []);

  // Get chats from Redux to find friend name
  const chats = useSelector((state: RootState) => state.chat.chats);
  
  // Fetch friend name by ID
  const fetchFriendName = useCallback(async (friendId: string): Promise<string> => {
    try {
      // Try to get from Redux chat list first
      const chat = chats.find((c: any) => 
        c.friend?._id === friendId || 
        c.friend?.user?._id === friendId ||
        c.user?._id === friendId
      );
      
      if (chat?.friend?.fullName) {
        return chat.friend.fullName;
      }
      if (chat?.friend?.user?.firstName) {
        return `${chat.friend.user.firstName} ${chat.friend.user.lastName || ''}`.trim();
      }
      if (chat?.user?.firstName) {
        return `${chat.user.firstName} ${chat.user.lastName || ''}`.trim();
      }
      
      // Fallback: try API call if not in store
      try {
        const response = await api.get(`/profile/${friendId}`);
        if (response.data?.fullName) {
          return response.data.fullName;
        }
        if (response.data?.user?.firstName) {
          return `${response.data.user.firstName} ${response.data.user.lastName || ''}`.trim();
        }
      } catch (apiError) {
        console.warn('Could not fetch friend name from API:', apiError);
      }
      
      console.log('Live voice: Friend ID:', friendId, '- using default name');
      return 'Friend';
    } catch (e) {
      console.error('Error fetching friend name:', e);
      return 'Friend';
    }
  }, [chats]);

  // Handle live voice start (receiver side)
  const handleLiveVoiceStart = useCallback(async ({ channelName, from }: { channelName: string; from?: string }) => {
    try {
      console.log('Live voice: Received start event', { channelName, from });
      
      // Leave any existing connection
      if (liveVoiceEngineRef.current) {
        try {
          await liveVoiceEngineRef.current.leaveChannel();
          await liveVoiceEngineRef.current.destroy();
        } catch (e) {
          console.warn('Error leaving existing live voice:', e);
        }
        liveVoiceEngineRef.current = null;
      }

      // Clear existing timer
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
        liveVoiceDurationTimerRef.current = null;
      }

      const numericUid = generateUid(myProfile?._id || myId || '0');
      
      // Use 'from' field from socket event (sender's profileId)
      const senderFriendId = from || extractFriendId(channelName, myProfile?._id || myId);
      if (senderFriendId) {
        setSenderId(senderFriendId);
        // Fetch friend name asynchronously
        fetchFriendName(senderFriendId).then(name => {
          setFriendName(name);
        });
      } else {
        setFriendName('Friend');
      }
      
      setCurrentChannelName(channelName);

      // Get token
      const { data } = await api.post('/agora/token', { 
        channelName, 
        uid: numericUid, 
        role: 'subscriber' 
      });
      
      if (!data || !data.appId || !data.token) {
        throw new Error('Invalid token response from server');
      }
      
      // Initialize engine
      const engine = await RtcEngine.create(data.appId);
      
      // Disable video for audio-only live voice
      await engine.disableVideo();
      
      // Enable audio
      await engine.enableAudio();
      
      // Set channel profile to Communication mode (0) to match web RTC mode
      await engine.setChannelProfile(0); // 0 = Communication (RTC mode)
      
      // Enable all remote audio streams (important for receiving audio in Communication mode)
      await engine.muteAllRemoteAudioStreams(false);
      
      // Set up event handlers BEFORE joining channel
      engine.addListener('JoinChannelSuccess', (channel: string, uid: number) => {
        console.log('Live voice: Joined channel successfully', channel, uid);
      });
      
      engine.addListener('UserJoined', (uid: number) => {
        console.log('Live voice: User joined', uid);
        // Ensure remote audio is enabled for the newly joined user
        engine.muteRemoteAudioStream(uid, false).catch(e => 
          console.warn('Failed to unmute remote audio:', e)
        );
      });
      
      engine.addListener('UserOffline', (uid: number, reason: number) => {
        console.log('Live voice: User offline', uid, 'reason:', reason);
      });
      
      engine.addListener('RemoteAudioStateChanged', (uid: number, state: number, reason: number, elapsed: number) => {
        console.log('Live voice: Remote audio state changed', { uid, state, reason });
        // state: 0 = STATE_STOPPED, 1 = STATE_STARTING, 2 = STATE_DECODING, 3 = STATE_FAILED
        if (state === 1 || state === 2) { // STATE_STARTING or STATE_DECODING
          console.log('Live voice: Remote audio starting/decoding, ensuring unmuted');
          // Ensure audio is unmuted when remote audio starts
          engine.muteRemoteAudioStream(uid, false).catch(e => 
            console.warn('Failed to unmute remote audio:', e)
          );
        }
      });
      
      // Join channel (no role needed in Communication mode)
      await engine.joinChannel(data.token, channelName, null, numericUid);

      liveVoiceEngineRef.current = engine;
      setIsLiveVoiceActive(true);
      setLiveVoiceDuration(0);
      setIsLiveVoiceModalOpen(true);
      
      // Start duration timer
      liveVoiceDurationTimerRef.current = setInterval(() => {
        setLiveVoiceDuration(prev => prev + 1);
      }, 1000);
    } catch (e: any) {
      console.error('Live voice subscribe failed:', e);
      setIsLiveVoiceActive(false);
      setIsLiveVoiceModalOpen(false);
      // Cleanup on error
      try {
        if (liveVoiceEngineRef.current) {
          await liveVoiceEngineRef.current.leaveChannel().catch(() => {});
          await liveVoiceEngineRef.current.destroy().catch(() => {});
          liveVoiceEngineRef.current = null;
        }
      } catch (cleanupErr) {
        console.error('Error during live voice cleanup:', cleanupErr);
      }
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
        liveVoiceDurationTimerRef.current = null;
      }
    }
  }, [myProfile?._id, myId, generateUid, extractFriendId, fetchFriendName]);

  // Handle live voice stop
  const handleLiveVoiceStop = useCallback(async () => {
    try {
      if (liveVoiceEngineRef.current) {
        await liveVoiceEngineRef.current.leaveChannel();
        await liveVoiceEngineRef.current.destroy();
        liveVoiceEngineRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping live voice:', e);
    }
    setIsLiveVoiceActive(false);
    setIsLiveVoiceModalOpen(false);
    setLiveVoiceDuration(0);
    setSenderId(null);
    setCurrentChannelName(null);
    if (liveVoiceDurationTimerRef.current) {
      clearInterval(liveVoiceDurationTimerRef.current);
      liveVoiceDurationTimerRef.current = null;
    }
  }, []);

  // Handle live voice leave subscriber (when user starts publishing)
  const handleLiveVoiceLeaveSubscriber = useCallback(async ({ channelName }: { channelName: string }) => {
    // Only leave if we're currently receiving on this channel
    if (liveVoiceEngineRef.current && isLiveVoiceActive && currentChannelName === channelName) {
      await handleLiveVoiceStop();
    }
  }, [isLiveVoiceActive, currentChannelName, handleLiveVoiceStop]);

  // Set up socket listeners
  useEffect(() => {
    if (!isConnected || !myId) return;

    console.log('LiveVoice: Setting up socket listeners');

    on('live-voice-start', handleLiveVoiceStart);
    on('live-voice-stop', handleLiveVoiceStop);
    on('live-voice-leave-subscriber', handleLiveVoiceLeaveSubscriber);

    return () => {
      console.log('LiveVoice: Cleaning up socket listeners');
      off('live-voice-start', handleLiveVoiceStart);
      off('live-voice-stop', handleLiveVoiceStop);
      off('live-voice-leave-subscriber', handleLiveVoiceLeaveSubscriber);
      
      // Cleanup live voice
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
        liveVoiceDurationTimerRef.current = null;
      }
      if (liveVoiceEngineRef.current) {
        liveVoiceEngineRef.current.leaveChannel().catch(() => {});
        liveVoiceEngineRef.current.destroy().catch(() => {});
        liveVoiceEngineRef.current = null;
      }
    };
  }, [isConnected, myId, on, off, handleLiveVoiceStart, handleLiveVoiceStop, handleLiveVoiceLeaveSubscriber]);

  return (
    <LiveVoiceModal
      isOpen={isLiveVoiceModalOpen}
      onClose={() => setIsLiveVoiceModalOpen(false)}
      isActive={isLiveVoiceActive}
      duration={liveVoiceDuration}
      isConnecting={false}
      role="receiver"
      friendName={friendName}
      onStop={undefined} // Receiver can't stop, only sender can
    />
  );
};

export default LiveVoice;

