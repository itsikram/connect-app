import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
} from 'react-native';
import { Audio } from '../lib/avCompat';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCallMinimize } from '../contexts/CallMinimizeContext';
import { prefetchAgoraJoin, clearAgoraJoinPrefetch } from '../lib/agoraJoin';
import { hashProfileUid } from '../lib/agoraUid';
import ProfileImage from './ProfileImage';
import { CALL_EVENTS, emitLocalCallEnded, takeLastIncomingCallFromPush, takeLastRejectCallFromPush } from '../lib/callEvents';
import { isCallBusy, setActiveCallKind } from '../lib/callSession';
import { configureInCallAudio } from '../lib/callRingtone';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../lib/incomingCallAlerts';
import { isAppFocused, notifyCallerRinging, sameProfileId } from '../lib/callStatus';
import AgoraWebEngine, { AgoraWebEngineHandle } from './AgoraWebEngine';

interface AudioCallProps {
  myId: string;
}

const AudioCall: React.FC<AudioCallProps> = ({ myId }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const { on, off, emit } = useSocket();
  const { minimizeCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();

  const [isAudioCall, setIsAudioCall] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerProfilePic, setCallerProfilePic] = useState('');
  const [incomingCall, setIncomingCall] = useState<{ from: string; channelName: string; name: string; profilePic?: string } | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [outgoingCallStatus, setOutgoingCallStatus] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [mediaActive, setMediaActive] = useState(false);
  const [engineWarm, setEngineWarm] = useState(false);

  const engineRef = useRef<AgoraWebEngineHandle>(null);
  const isTerminating = useRef(false);
  const isJoiningOrJoined = useRef(false);
  const receivingCallRef = useRef(false);
  const callAcceptedRef = useRef(false);
  const currentChannelRef = useRef<string | null>(null);
  const callerRef = useRef('');
  const isMinimizedRef = useRef(false);
  const isMutedRef = useRef(false);
  const incomingCallRef = useRef(incomingCall);
  const callStartTime = useRef<number | null>(null);
  const callSeenStatusSentRef = useRef(false);
  const callIgnoredStatusSentRef = useRef(false);
  const pendingAutoAcceptRef = useRef(false);
  const answerCallRef = useRef<(() => void) | null>(null);
  const pendingJoinRef = useRef<{ appId: string; token: string; channelName: string; uid: number } | null>(null);
  const startCallRef = useRef<(channelName: string) => Promise<void>>(async () => {});

  const numericUid = hashProfileUid(myId);

  useEffect(() => { receivingCallRef.current = receivingCall; }, [receivingCall]);
  useEffect(() => { callAcceptedRef.current = callAccepted; }, [callAccepted]);
  useEffect(() => { currentChannelRef.current = currentChannel; }, [currentChannel]);
  useEffect(() => { callerRef.current = caller; }, [caller]);
  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const cleanupAudioCall = useCallback(async () => {
    isTerminating.current = true;
    await stopIncomingCallAlert();
    try { engineRef.current?.leave(); } catch (_) {}
    setMediaActive(false);
    pendingJoinRef.current = null;
    clearAgoraJoinPrefetch(currentChannelRef.current || undefined);
    isJoiningOrJoined.current = false;
    setActiveCallKind(null);
    if (currentChannelRef.current) {
      try { endMinimizedCall(`audio-${currentChannelRef.current}`); } catch (_) {}
    }
    emitLocalCallEnded();
    setIsAudioCall(false);
    setReceivingCall(false);
    setCallAccepted(false);
    setCaller('');
    setCallerName('');
    setCallerProfilePic('');
    setIncomingCall(null);
    setCurrentChannel(null);
    setOutgoingCallStatus('');
    setCallDuration(0);
    setIsMinimized(false);
    setIsMuted(false);
    callStartTime.current = null;
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    pendingAutoAcceptRef.current = false;
    setTimeout(() => { isTerminating.current = false; }, 400);
  }, [endMinimizedCall]);

  const startCall = useCallback(async (channelName: string) => {
    try {
      if (isTerminating.current) return;
      setCallAccepted(true);
      setCurrentChannel(channelName);
      if (!callStartTime.current) callStartTime.current = Date.now();
      if (isJoiningOrJoined.current) return;
      isJoiningOrJoined.current = true;
      setActiveCallKind('audio');
      setMediaActive(true);
      setEngineWarm(true);

      configureInCallAudio(true).catch(() => {});
      Audio.requestPermissionsAsync().catch(() => {});
      const creds = await prefetchAgoraJoin(channelName, numericUid);
      if (isTerminating.current) return;
      pendingJoinRef.current = creds;
      engineRef.current?.join({ ...creds, isAudio: true });
    } catch (error: any) {
      console.error('AudioCall: failed to start', error);
      Alert.alert('Call failed', error?.message || 'Could not start the audio call.');
      isJoiningOrJoined.current = false;
      setActiveCallKind(null);
      setIsAudioCall(false);
      setCallAccepted(false);
    }
  }, [numericUid]);

  useEffect(() => { startCallRef.current = startCall; }, [startCall]);

  const answerCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    stopIncomingCallAlert().catch(() => {});
    emit('answer-call', {
      to: String(incoming.from),
      channelName: incoming.channelName,
      isAudio: true,
    });
    startCall(incoming.channelName);
  }, [emit, startCall]);

  useEffect(() => { answerCallRef.current = answerCall; }, [answerCall]);

  const endCall = useCallback(async () => {
    await stopIncomingCallAlert();
    const incoming = incomingCallRef.current;
    let friendIdToNotify: string | undefined;
    if (incoming?.from && incoming.from !== myId) {
      friendIdToNotify = incoming.from;
      if (!callAcceptedRef.current) {
        emit('audio-call-reject', { to: String(friendIdToNotify), channelName: currentChannelRef.current });
        await cleanupAudioCall();
        return;
      }
    } else if (callerRef.current && callerRef.current !== myId) {
      friendIdToNotify = callerRef.current;
      if (!callAcceptedRef.current) {
        emit('audio-call-cancel', { to: String(friendIdToNotify), channelName: currentChannelRef.current });
        await cleanupAudioCall();
        return;
      }
    }
    if (friendIdToNotify && friendIdToNotify !== myId && currentChannelRef.current) {
      emit('audio-call-end', { to: String(friendIdToNotify), channelName: currentChannelRef.current });
    }
    await cleanupAudioCall();
  }, [cleanupAudioCall, emit, myId]);

  const markCallSeenIfNeeded = useCallback(() => {
    if (
      callSeenStatusSentRef.current ||
      !receivingCallRef.current ||
      callAcceptedRef.current
    ) {
      return;
    }
    const to = callerRef.current;
    if (!to) return;
    callSeenStatusSentRef.current = true;
    emit('update-call-status', { to: String(to), status: 'Call seen' });
  }, [emit]);

  const markCallIgnoredIfNeeded = useCallback(() => {
    if (
      callIgnoredStatusSentRef.current ||
      !callSeenStatusSentRef.current ||
      !receivingCallRef.current ||
      callAcceptedRef.current
    ) {
      return;
    }
    const to = callerRef.current;
    if (!to) return;
    callIgnoredStatusSentRef.current = true;
    emit('update-call-status', { to: String(to), status: 'Call ignored' });
  }, [emit]);

  const applyIncomingAudioCall = useCallback(({ from, channelName, callerName: name, callerProfilePic: pic, ringtoneId }: any) => {
    if (!from || !channelName) return;
    if (isTerminating.current) return;
    if (receivingCallRef.current && currentChannelRef.current === channelName) return;
    if (isJoiningOrJoined.current || callAcceptedRef.current || receivingCallRef.current || isCallBusy()) {
      emit('audio-call-reject', { to: String(from), channelName });
      return;
    }
    const callerId = String(from);
    emit('update-call-status', { to: callerId, status: 'Ringing...' });
    if (!isAppFocused()) {
      notifyCallerRinging(callerId);
    }
    receivingCallRef.current = true;
    callAcceptedRef.current = false;
    currentChannelRef.current = channelName;
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    setIsAudioCall(true);
    setReceivingCall(true);
    setCaller(callerId);
    setIncomingCall({ from: callerId, channelName, name: name || 'Unknown Caller', profilePic: pic });
    setCallerName(name || 'Unknown Caller');
    setCallerProfilePic(pic || '');
    setCurrentChannel(channelName);
    setEngineWarm(true);
    prefetchAgoraJoin(channelName, numericUid).catch(() => {});
    Audio.requestPermissionsAsync().catch(() => {});
    configureInCallAudio(true).catch(() => {});
    engineRef.current?.preview(true);
    startIncomingCallAlert({
      callerId,
      callerName: name,
      callerProfilePic: pic,
      channelName,
      isAudio: true,
      ringtoneId,
    }).catch(() => {});
    if (isAppFocused()) {
      markCallSeenIfNeeded();
    }
  }, [emit, markCallSeenIfNeeded, numericUid]);

  useEffect(() => {
    const onIncoming = ({ from, channelName, isAudio, callerName: name, callerProfilePic: pic }: any) => {
      if (isAudio === false) return;
      applyIncomingAudioCall({ from, channelName, callerName: name, callerProfilePic: pic });
    };
    const onCallAccepted = ({ channelName, isAudio }: any) => {
      if (!isAudio) return;
      if (!receivingCallRef.current) {
        stopIncomingCallAlert();
        setOutgoingCallStatus('');
        startCallRef.current(channelName);
      }
    };
    const onEnded = () => { stopIncomingCallAlert(); cleanupAudioCall(); };
    const onCancelled = () => { stopIncomingCallAlert(); cleanupAudioCall(); };
    const onRejected = () => {
      stopIncomingCallAlert();
      setOutgoingCallStatus('Call rejected');
      setTimeout(() => cleanupAudioCall(), 500);
    };
    const onNotAccepted = ({ isAudio, channelName }: any) => {
      if (!isAudio) return;
      if (channelName && currentChannelRef.current && channelName !== currentChannelRef.current) return;
      stopIncomingCallAlert();
      setOutgoingCallStatus('No answer');
      setTimeout(() => cleanupAudioCall(), 500);
    };
    const onStatus = ({ from, status }: any) => {
      if (
        !receivingCallRef.current &&
        !callAcceptedRef.current &&
        callerRef.current &&
        sameProfileId(from, callerRef.current)
      ) {
        setOutgoingCallStatus(status || '');
      }
    };
    const onOutgoing = (detail: any) => {
      if (isJoiningOrJoined.current || callAcceptedRef.current || receivingCallRef.current || isCallBusy()) return;
      callSeenStatusSentRef.current = false;
      callIgnoredStatusSentRef.current = false;
      const to = String(detail.to);
      setIsAudioCall(true);
      setReceivingCall(false);
      setCaller(to);
      setCallerName(detail.callerName || 'Friend');
      setCallerProfilePic(detail.callerProfilePic || '');
      setCurrentChannel(detail.channelName);
      setIncomingCall({
        from: myId,
        channelName: detail.channelName,
        name: detail.callerName || 'Friend',
        profilePic: detail.callerProfilePic,
      });
      setOutgoingCallStatus('Calling...');
      setEngineWarm(true);
      prefetchAgoraJoin(detail.channelName, numericUid).catch(() => {});
      Audio.requestPermissionsAsync().catch(() => {});
      configureInCallAudio(true).catch(() => {});
    };
    const onPushIncoming = (detail: any) => {
      if (detail?.isAudio === false) return;
      if (detail?.autoAccept) pendingAutoAcceptRef.current = true;
      applyIncomingAudioCall({
        from: detail.from,
        channelName: detail.channelName,
        callerName: detail.callerName,
        callerProfilePic: detail.callerProfilePic,
        ringtoneId: detail.ringtoneId,
      });
    };
    const onPushReject = (detail: any) => {
      if (detail?.isAudio === false) return;
      stopIncomingCallAlert();
      if (detail.from && detail.channelName) {
        emit('audio-call-reject', { to: String(detail.from), channelName: detail.channelName });
      }
      cleanupAudioCall();
    };

    on('incoming-audio-call', onIncoming);
    on('call-accepted', onCallAccepted);
    on('audio-call-ended', onEnded);
    on('audio-call-cancelled', onCancelled);
    on('audio-call-rejected', onRejected);
    on('call-not-accepted', onNotAccepted);
    on('updated-call-status', onStatus);
    on('call-status-update', onStatus);
    const subStart = DeviceEventEmitter.addListener(CALL_EVENTS.START_AUDIO, onOutgoing);
    const subPush = DeviceEventEmitter.addListener(CALL_EVENTS.INCOMING_FROM_PUSH, onPushIncoming);
    const subReject = DeviceEventEmitter.addListener(CALL_EVENTS.REJECT_FROM_PUSH, onPushReject);

    return () => {
      off('incoming-audio-call', onIncoming);
      off('call-accepted', onCallAccepted);
      off('audio-call-ended', onEnded);
      off('audio-call-cancelled', onCancelled);
      off('audio-call-rejected', onRejected);
      off('call-not-accepted', onNotAccepted);
      off('updated-call-status', onStatus);
      off('call-status-update', onStatus);
      subStart.remove();
      subPush.remove();
      subReject.remove();
    };
  }, [applyIncomingAudioCall, cleanupAudioCall, emit, myId, numericUid, off, on]);

  useEffect(() => {
    const replayIncoming = takeLastIncomingCallFromPush();
    if (replayIncoming && replayIncoming.isAudio !== false) {
      if (replayIncoming.autoAccept) pendingAutoAcceptRef.current = true;
      applyIncomingAudioCall({
        from: replayIncoming.from,
        channelName: replayIncoming.channelName,
        callerName: replayIncoming.callerName,
        callerProfilePic: replayIncoming.callerProfilePic,
        ringtoneId: replayIncoming.ringtoneId,
      });
    }
    const replayReject = takeLastRejectCallFromPush();
    if (replayReject && replayReject.isAudio !== false) {
      stopIncomingCallAlert();
      cleanupAudioCall();
    }
    // Replay a notification tap that arrived before this overlay mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingAutoAcceptRef.current && receivingCall && incomingCall && !callAccepted) {
      pendingAutoAcceptRef.current = false;
      const t = setTimeout(() => answerCallRef.current?.(), 0);
      return () => clearTimeout(t);
    }
  }, [receivingCall, incomingCall, callAccepted]);

  useEffect(() => {
    if (!callAccepted) return;
    if (!callStartTime.current) callStartTime.current = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - (callStartTime.current || Date.now())) / 1000);
      setCallDuration(elapsed);
      if (isMinimizedRef.current && currentChannelRef.current) {
        updateMinimizedCall(`audio-${currentChannelRef.current}`, {
          duration: elapsed,
          status: 'connected',
        });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [callAccepted, updateMinimizedCall]);

  useEffect(() => {
    if (receivingCall && !callAccepted && isAppFocused()) {
      markCallSeenIfNeeded();
    }
  }, [receivingCall, callAccepted, markCallSeenIfNeeded]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        markCallSeenIfNeeded();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [markCallSeenIfNeeded]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    setIsMuted(next);
    engineRef.current?.muteAudio(next);
    if (isMinimizedRef.current && currentChannelRef.current) {
      updateMinimizedCall(`audio-${currentChannelRef.current}`, { isMuted: next });
    }
  }, [updateMinimizedCall]);

  const toggleSpeaker = useCallback(async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    await configureInCallAudio(next);
  }, [isSpeakerOn]);

  const minimizeAudioCall = useCallback(() => {
    if (!callAccepted || !currentChannel) return;
    const callId = `audio-${currentChannel}`;
    minimizeCall({
      id: callId,
      type: 'audio',
      callerName: callerName || 'Unknown Caller',
      callerProfilePic: callerProfilePic,
      callerId: caller,
      status: 'connected',
      duration: callDuration,
      isMuted,
      isCameraOn: false,
      onRestore: () => { setIsMinimized(false); setIsAudioCall(true); },
      onEnd: () => { endCall(); },
      onToggleMute: () => toggleMute(),
    });
    setIsMinimized(true);
    setIsAudioCall(false);
  }, [callAccepted, currentChannel, callerName, callerProfilePic, caller, callDuration, isMuted, minimizeCall, endCall, toggleMute]);

  const handleEngineEvent = useCallback((event: any) => {
    if (event.type === 'ready') {
      if (receivingCallRef.current && !callAcceptedRef.current) {
        engineRef.current?.preview(true);
      }
      if (pendingJoinRef.current) {
        engineRef.current?.join({ ...pendingJoinRef.current, isAudio: true });
      }
    }
    if (event.type === 'user-left' && callAcceptedRef.current) {
      cleanupAudioCall();
    }
    if (event.type === 'error') {
      console.warn('AudioCall media error', event.message);
    }
  }, [cleanupAudioCall]);

  const statusText = callAccepted
    ? `Connected • ${formatDuration(callDuration)}`
    : receivingCall
      ? `${callerName || 'Someone'} is calling you`
      : `Calling ${callerName || 'Friend'}${outgoingCallStatus ? ` • ${outgoingCallStatus}` : '...'}`;

  if (!isAudioCall && !mediaActive && !engineWarm) {
    return null;
  }

  return (
    <>
      <AgoraWebEngine
        ref={engineRef}
        visible={Boolean(isAudioCall || mediaActive || engineWarm)}
        isAudio
        onEvent={handleEngineEvent}
      />
      <Modal visible={isAudioCall && !isMinimized} animationType="slide" presentationStyle="fullScreen" onRequestClose={endCall}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
          <View style={styles.center}>
            {callerProfilePic ? (
              <ProfileImage uri={callerProfilePic} pixelSize={240} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.gray?.[700] || '#333' }]}>
                <Icon name="person" size={80} color="#fff" />
              </View>
            )}
            <Text style={[styles.name, { color: themeColors.text.primary }]}>{callerName || 'Unknown'}</Text>
            <Text style={[styles.status, { color: themeColors.text.secondary }]}>{statusText}</Text>
          </View>

          <View style={styles.controls}>
            {callAccepted && (
              <>
                <TouchableOpacity style={[styles.btn, { backgroundColor: isMuted ? '#666' : '#29B1A9' }]} onPress={toggleMute}>
                  <Icon name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: isSpeakerOn ? '#29B1A9' : '#666' }]} onPress={toggleSpeaker}>
                  <Icon name={isSpeakerOn ? 'volume-up' : 'volume-down'} size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: 'rgba(0,0,0,0.35)' }]} onPress={minimizeAudioCall}>
                  <Icon name="expand-more" size={26} color="#fff" />
                </TouchableOpacity>
              </>
            )}
            {receivingCall && !callAccepted && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#34C759' }]} onPress={answerCall}>
                <Icon name="call" size={26} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#E53935' }]} onPress={endCall}>
              <Icon name="call-end" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: '#29B1A9' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 20, fontSize: 24, fontWeight: '700' },
  status: { marginTop: 8, fontSize: 16, textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, paddingBottom: 40 },
  btn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});

export default AudioCall;
