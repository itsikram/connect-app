import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
} from 'react-native';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSocket } from '../contexts/SocketContext';
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

interface VideoCallProps {
  myId: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ myId }) => {
  const { on, off, emit } = useSocket();
  const { minimizeCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();

  const [isVideoCall, setIsVideoCall] = useState(false);
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
  const [isCameraOn, setIsCameraOn] = useState(true);
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
  const isCameraOnRef = useRef(true);
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
  useEffect(() => { isCameraOnRef.current = isCameraOn; }, [isCameraOn]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const cleanupVideoCall = useCallback(async () => {
    isTerminating.current = true;
    await stopIncomingCallAlert();
    try { engineRef.current?.leave(); } catch (_) {}
    setMediaActive(false);
    pendingJoinRef.current = null;
    clearAgoraJoinPrefetch(currentChannelRef.current || undefined);
    isJoiningOrJoined.current = false;
    setActiveCallKind(null);
    if (currentChannelRef.current) {
      try { endMinimizedCall(`video-${currentChannelRef.current}`); } catch (_) {}
    }
    emitLocalCallEnded();
    setIsVideoCall(false);
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
    setIsCameraOn(true);
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
      setActiveCallKind('video');
      setMediaActive(true);
      setEngineWarm(true);

      configureInCallAudio(true).catch(() => {});
      Audio.requestPermissionsAsync().catch(() => {});
      Camera.requestCameraPermissionsAsync().catch(() => {});
      const creds = await prefetchAgoraJoin(channelName, numericUid);
      if (isTerminating.current) return;
      pendingJoinRef.current = creds;
      engineRef.current?.join({ ...creds, isAudio: false });
    } catch (error: any) {
      console.error('VideoCall: failed to start', error);
      Alert.alert('Call failed', error?.message || 'Could not start the video call.');
      isJoiningOrJoined.current = false;
      setActiveCallKind(null);
      setIsVideoCall(false);
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
      isAudio: false,
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
        emit('video-call-reject', { to: String(friendIdToNotify), channelName: currentChannelRef.current });
        await cleanupVideoCall();
        return;
      }
    } else if (callerRef.current && callerRef.current !== myId) {
      friendIdToNotify = callerRef.current;
      if (!callAcceptedRef.current) {
        emit('video-call-cancel', { to: String(friendIdToNotify), channelName: currentChannelRef.current });
        await cleanupVideoCall();
        return;
      }
    }
    if (friendIdToNotify && friendIdToNotify !== myId && currentChannelRef.current) {
      emit('video-call-end', { to: String(friendIdToNotify), channelName: currentChannelRef.current });
    }
    await cleanupVideoCall();
  }, [cleanupVideoCall, emit, myId]);

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

  const applyIncomingVideoCall = useCallback(({ from, channelName, callerName: name, callerProfilePic: pic, ringtoneId }: any) => {
    if (!from || !channelName) return;
    if (isTerminating.current) return;
    if (receivingCallRef.current && currentChannelRef.current === channelName) return;
    if (isJoiningOrJoined.current || callAcceptedRef.current || receivingCallRef.current || isCallBusy()) {
      emit('video-call-reject', { to: String(from), channelName });
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
    setIsVideoCall(true);
    setReceivingCall(true);
    setCaller(callerId);
    setIncomingCall({ from: callerId, channelName, name: name || 'Unknown Caller', profilePic: pic });
    setCallerName(name || 'Unknown Caller');
    setCallerProfilePic(pic || '');
    setCurrentChannel(channelName);
    setEngineWarm(true);
    prefetchAgoraJoin(channelName, numericUid).catch(() => {});
    Audio.requestPermissionsAsync().catch(() => {});
    Camera.requestCameraPermissionsAsync().catch(() => {});
    engineRef.current?.preview(false);
    startIncomingCallAlert({
      callerId,
      callerName: name,
      callerProfilePic: pic,
      channelName,
      isAudio: false,
      ringtoneId,
    }).catch(() => {});
    if (isAppFocused()) {
      markCallSeenIfNeeded();
    }
  }, [emit, markCallSeenIfNeeded, numericUid]);

  useEffect(() => {
    const onIncoming = ({ from, channelName, isAudio, callerName: name, callerProfilePic: pic }: any) => {
      if (isAudio) return;
      applyIncomingVideoCall({ from, channelName, callerName: name, callerProfilePic: pic });
    };
    const onCallAccepted = ({ channelName, isAudio }: any) => {
      if (isAudio) return;
      if (!receivingCallRef.current) {
        stopIncomingCallAlert();
        setOutgoingCallStatus('');
        startCallRef.current(channelName);
      }
    };
    const onEnded = () => { stopIncomingCallAlert(); cleanupVideoCall(); };
    const onCancelled = () => { stopIncomingCallAlert(); cleanupVideoCall(); };
    const onRejected = () => {
      stopIncomingCallAlert();
      setOutgoingCallStatus('Call rejected');
      setTimeout(() => cleanupVideoCall(), 500);
    };
    const onNotAccepted = ({ isAudio, channelName }: any) => {
      if (isAudio) return;
      if (channelName && currentChannelRef.current && channelName !== currentChannelRef.current) return;
      stopIncomingCallAlert();
      setOutgoingCallStatus('No answer');
      setTimeout(() => cleanupVideoCall(), 500);
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
      setIsVideoCall(true);
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
      setMediaActive(true);
      Camera.requestCameraPermissionsAsync().then(() => {
        engineRef.current?.preview(false);
      }).catch(() => {});
    };
    const onPushIncoming = (detail: any) => {
      if (detail?.isAudio) return;
      if (detail?.autoAccept) pendingAutoAcceptRef.current = true;
      applyIncomingVideoCall({
        from: detail.from,
        channelName: detail.channelName,
        callerName: detail.callerName,
        callerProfilePic: detail.callerProfilePic,
        ringtoneId: detail.ringtoneId,
      });
    };
    const onPushReject = (detail: any) => {
      if (detail?.isAudio) return;
      stopIncomingCallAlert();
      if (detail.from && detail.channelName) {
        emit('video-call-reject', { to: String(detail.from), channelName: detail.channelName });
      }
      cleanupVideoCall();
    };

    on('incoming-video-call', onIncoming);
    on('call-accepted', onCallAccepted);
    on('video-call-ended', onEnded);
    on('video-call-cancelled', onCancelled);
    on('video-call-rejected', onRejected);
    on('call-not-accepted', onNotAccepted);
    on('updated-call-status', onStatus);
    on('call-status-update', onStatus);
    const subStart = DeviceEventEmitter.addListener(CALL_EVENTS.START_VIDEO, onOutgoing);
    const subPush = DeviceEventEmitter.addListener(CALL_EVENTS.INCOMING_FROM_PUSH, onPushIncoming);
    const subReject = DeviceEventEmitter.addListener(CALL_EVENTS.REJECT_FROM_PUSH, onPushReject);

    return () => {
      off('incoming-video-call', onIncoming);
      off('call-accepted', onCallAccepted);
      off('video-call-ended', onEnded);
      off('video-call-cancelled', onCancelled);
      off('video-call-rejected', onRejected);
      off('call-not-accepted', onNotAccepted);
      off('updated-call-status', onStatus);
      off('call-status-update', onStatus);
      subStart.remove();
      subPush.remove();
      subReject.remove();
    };
  }, [applyIncomingVideoCall, cleanupVideoCall, emit, myId, numericUid, off, on]);

  useEffect(() => {
    const replayIncoming = takeLastIncomingCallFromPush();
    if (replayIncoming && replayIncoming.isAudio === false) {
      if (replayIncoming.autoAccept) pendingAutoAcceptRef.current = true;
      applyIncomingVideoCall({
        from: replayIncoming.from,
        channelName: replayIncoming.channelName,
        callerName: replayIncoming.callerName,
        callerProfilePic: replayIncoming.callerProfilePic,
        ringtoneId: replayIncoming.ringtoneId,
      });
    }
    const replayReject = takeLastRejectCallFromPush();
    if (replayReject && replayReject.isAudio === false) {
      stopIncomingCallAlert();
      cleanupVideoCall();
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
        updateMinimizedCall(`video-${currentChannelRef.current}`, {
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

    // If in a video call ensure video stays enabled and preview remains active.
    try {
      if (isCameraOnRef.current) {
        // small timeout to let audio toggle process in the webview
        setTimeout(() => {
          // Re-enable video track (defensive)
          engineRef.current?.muteVideo(false);
          // Force a preview to ensure the webview's local track is replayed/published
          engineRef.current?.preview(false);
        }, 150);
      }
    } catch (e) {}

    if (isMinimizedRef.current && currentChannelRef.current) {
      updateMinimizedCall(`video-${currentChannelRef.current}`, { isMuted: next });
    }
  }, [updateMinimizedCall]);

  const toggleCamera = useCallback(() => {
    const next = !isCameraOnRef.current;
    setIsCameraOn(next);
    engineRef.current?.muteVideo(!next);
    if (isMinimizedRef.current && currentChannelRef.current) {
      updateMinimizedCall(`video-${currentChannelRef.current}`, { isCameraOn: next });
    }
  }, [updateMinimizedCall]);

  const switchCamera = useCallback(() => {
    engineRef.current?.switchCamera();
  }, []);

  const minimizeVideoCall = useCallback(() => {
    if (!callAccepted || !currentChannel) return;
    const callId = `video-${currentChannel}`;
    minimizeCall({
      id: callId,
      type: 'video',
      callerName: callerName || 'Unknown Caller',
      callerProfilePic: callerProfilePic,
      callerId: caller,
      status: 'connected',
      duration: callDuration,
      isMuted,
      isCameraOn,
      onRestore: () => { setIsMinimized(false); setIsVideoCall(true); },
      onEnd: () => { endCall(); },
      onToggleMute: () => toggleMute(),
      onToggleCamera: () => toggleCamera(),
    });
    setIsMinimized(true);
    setIsVideoCall(false);
  }, [callAccepted, currentChannel, callerName, callerProfilePic, caller, callDuration, isMuted, isCameraOn, minimizeCall, endCall, toggleMute, toggleCamera]);

  const handleEngineEvent = useCallback((event: any) => {
    if (event.type === 'ready') {
      if (receivingCallRef.current && !callAcceptedRef.current) {
        engineRef.current?.preview(false);
      }
      if (pendingJoinRef.current) {
        engineRef.current?.join({ ...pendingJoinRef.current, isAudio: false });
      }
    }
    if (event.type === 'user-left' && callAcceptedRef.current) {
      cleanupVideoCall();
    }
    if (event.type === 'error') {
      console.warn('VideoCall media error', event.message);
    }
  }, [cleanupVideoCall]);

  const statusText = callAccepted
    ? formatDuration(callDuration)
    : receivingCall
      ? `${callerName || 'Someone'} is calling you`
      : `Calling ${callerName || 'Friend'}${outgoingCallStatus ? ` • ${outgoingCallStatus}` : '...'}`;

  if (!isVideoCall && !mediaActive && !engineWarm) {
    return null;
  }

  const showRemotePlaceholder = !callAccepted;
  const showUi = isVideoCall && !isMinimized;

  return (
    <>
      <View
        style={[showUi ? styles.engineFill : styles.hiddenEngine, { zIndex: showUi ? 9998 : 0 }]}
        pointerEvents={showUi ? 'auto' : 'none'}
      >
        <AgoraWebEngine
          ref={engineRef}
          visible={Boolean(isVideoCall || mediaActive || engineWarm)}
          isAudio={false}
          onEvent={handleEngineEvent}
        />
      </View>
      {showUi ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <StatusBar barStyle="light-content" />
          {showRemotePlaceholder && (
            <View style={styles.placeholder} pointerEvents="auto">
              {callerProfilePic ? (
                <ProfileImage uri={callerProfilePic} pixelSize={240} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Icon name="person" size={80} color="#fff" />
                </View>
              )}
              <Text style={styles.name}>{callerName || 'Unknown'}</Text>
              <Text style={styles.status}>{statusText}</Text>
            </View>
          )}

          {callAccepted && (
            <View style={styles.topBar} pointerEvents="box-none">
              <Text style={styles.topTitle}>{callerName || 'Video call'}</Text>
              <Text style={styles.topStatus}>{statusText}</Text>
            </View>
          )}

          <View style={styles.controls}>
            {callAccepted && (
              <>
                <TouchableOpacity style={[styles.btn, { backgroundColor: isMuted ? '#666' : '#29B1A9' }]} onPress={toggleMute}>
                  <Icon name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: isCameraOn ? '#29B1A9' : '#666' }]} onPress={toggleCamera}>
                  <Icon name={isCameraOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={switchCamera}>
                  <Icon name="flip-camera-ios" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={minimizeVideoCall}>
                  <Icon name="expand-more" size={24} color="#fff" />
                </TouchableOpacity>
              </>
            )}
            {receivingCall && !callAccepted && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#34C759' }]} onPress={answerCall}>
                <Icon name="videocam" size={26} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#E53935' }]} onPress={endCall}>
              <Icon name="call-end" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'transparent',
    paddingTop: 50,
  },
  engineFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0b0f17' },
  hiddenEngine: { position: 'absolute', width: 2, height: 2, opacity: 0.01, overflow: 'hidden' },
  container: { flex: 1, backgroundColor: '#0b0f17' },
  placeholder: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0f17',
  },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: '#29B1A9' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#222' },
  name: { marginTop: 20, fontSize: 24, fontWeight: '700', color: '#fff' },
  status: { marginTop: 8, fontSize: 16, color: '#ccc', textAlign: 'center' },
  topBar: { position: 'absolute', top: 66, left: 0, right: 0, alignItems: 'center' },
  topTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  topStatus: { color: '#ddd', marginTop: 4 },
  controls: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  btn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});

export default VideoCall;
