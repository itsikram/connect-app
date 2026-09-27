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
import Modal from './SystemBarsModal';
import { Audio } from '../lib/avCompat';
import { Camera } from 'expo-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSocket } from '../contexts/SocketContext';
import { useCallMinimize } from '../contexts/CallMinimizeContext';
import { prefetchAgoraJoin, clearAgoraJoinPrefetch, fetchAgoraToken } from '../lib/agoraJoin';
import { hashProfileUid } from '../lib/agoraUid';
import {
  CallAvatar,
  CallBackdrop,
  CallControl,
  CallControlBar,
  CallHeader,
  ENDED_SCREEN_MS,
  IncomingCallActions,
  endedLabelFor,
  formatCallDuration,
} from './call/CallUi';
import { startRingback, stopRingback } from '../lib/callRingback';
import { CALL_EVENTS, emitLocalCallEnded, takeLastIncomingCallFromPush, takeLastRejectCallFromPush } from '../lib/callEvents';
import { isCallBusy, setActiveCallKind } from '../lib/callSession';
import { configureInCallAudio } from '../lib/callRingtone';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../lib/incomingCallAlerts';
import { isAppFocused, notifyCallerRinging, sameProfileId } from '../lib/callStatus';
import AgoraWebEngine, { AgoraWebEngineHandle } from './AgoraWebEngine';
import CallTranscript from './CallTranscript';

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
  // The other person is in the media channel; the timer starts here.
  const [mediaConnected, setMediaConnected] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  // Outcome shown briefly after the call closes ("Call ended", "Declined"…).
  const [endedInfo, setEndedInfo] = useState<{ label: string; name: string; pic: string } | null>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callerNameRef = useRef('');
  const callerPicRef = useRef('');
  callerNameRef.current = callerName;
  callerPicRef.current = callerProfilePic;

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

  const showEnded = useCallback((label: string) => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    setEndedInfo({ label, name: callerNameRef.current, pic: callerPicRef.current });
    endedTimerRef.current = setTimeout(() => {
      endedTimerRef.current = null;
      setEndedInfo(null);
    }, ENDED_SCREEN_MS);
  }, []);

  const clearEnded = useCallback(() => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    endedTimerRef.current = null;
    setEndedInfo(null);
  }, []);

  useEffect(() => () => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
  }, []);

  const cleanupVideoCall = useCallback(async () => {
    isTerminating.current = true;
    stopRingback().catch(() => {});
    DeviceEventEmitter.emit('video-call-active', false);
    await stopIncomingCallAlert();
    try { engineRef.current?.leave(); } catch (_) {}
    setMediaActive(false);
    setEngineWarm(false);
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
    setMediaConnected(false);
    setRemoteVideoOn(false);
    setIsReconnecting(false);
    receivingCallRef.current = false;
    callAcceptedRef.current = false;
    currentChannelRef.current = null;
    callStartTime.current = null;
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    pendingAutoAcceptRef.current = false;
    setTimeout(() => { isTerminating.current = false; }, 400);
  }, [endMinimizedCall]);

  // Join failed or the peer dropped out of the media channel: close the call
  // on the server too, so the other side (web or app) and all their devices
  // stop waiting in an empty call and the call log is written.
  const endCallForPeer = useCallback((channelName?: string | null) => {
    const peer = callerRef.current;
    const channel = channelName || currentChannelRef.current;
    if (peer && channel) {
      emit('video-call-end', { to: String(peer), channelName: channel });
    }
  }, [emit]);

  const startCall = useCallback(async (channelName: string) => {
    try {
      if (isTerminating.current) return;
      // The global emotion camera uses the same front camera as Agora.
      DeviceEventEmitter.emit('video-call-active', true);
      await new Promise(resolve => setTimeout(resolve, 150));
      if (isTerminating.current) return;
      stopRingback().catch(() => {});
      setCallAccepted(true);
      setCurrentChannel(channelName);
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
      await stopIncomingCallAlert();
      Alert.alert('Call failed', error?.message || 'Could not start the video call.');
      isJoiningOrJoined.current = false;
      setActiveCallKind(null);
      setIsVideoCall(false);
      setCallAccepted(false);
      endCallForPeer(channelName);
      cleanupVideoCall();
    }
  }, [numericUid, endCallForPeer, cleanupVideoCall]);

  useEffect(() => { startCallRef.current = startCall; }, [startCall]);

  const answerCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;
    stopIncomingCallAlert().catch(() => {});
    receivingCallRef.current = false;
    setReceivingCall(false);
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
    let connectIdToNotify: string | undefined;
    if (incoming?.from && incoming.from !== myId) {
      connectIdToNotify = incoming.from;
      if (!callAcceptedRef.current) {
        emit('video-call-reject', { to: String(connectIdToNotify), channelName: currentChannelRef.current });
        await cleanupVideoCall();
        return;
      }
    } else if (callerRef.current && callerRef.current !== myId) {
      connectIdToNotify = callerRef.current;
      if (!callAcceptedRef.current) {
        emit('video-call-cancel', { to: String(connectIdToNotify), channelName: currentChannelRef.current });
        await cleanupVideoCall();
        return;
      }
    }
    if (connectIdToNotify && connectIdToNotify !== myId && currentChannelRef.current) {
      emit('video-call-end', { to: String(connectIdToNotify), channelName: currentChannelRef.current });
      showEnded('Call ended');
    }
    await cleanupVideoCall();
  }, [cleanupVideoCall, emit, myId, showEnded]);

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
    const placingOwnCall = !!currentChannelRef.current && currentChannelRef.current !== channelName;
    if (isJoiningOrJoined.current || callAcceptedRef.current || receivingCallRef.current || placingOwnCall || isCallBusy()) {
      emit('video-call-reject', { to: String(from), channelName, reason: 'busy' });
      return;
    }
    clearEnded();
    setActiveCallKind('video');
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
  }, [clearEnded, emit, markCallSeenIfNeeded, numericUid]);

  useEffect(() => {
    const onIncoming = ({ from, channelName, isAudio, callerName: name, callerProfilePic: pic }: any) => {
      if (isAudio) return;
      applyIncomingVideoCall({ from, channelName, callerName: name, callerProfilePic: pic });
    };
    // Ignore events that belong to a different call than the one on screen.
    const isForActiveCall = (channelName?: string) =>
      !channelName ||
      !currentChannelRef.current ||
      String(channelName) === String(currentChannelRef.current);
    const onCallAccepted = ({ channelName, isAudio, callerName: acceptedName, callerProfilePic: acceptedPic }: any) => {
      if (isAudio) return;
      if (!isForActiveCall(channelName) || !currentChannelRef.current) return;
      if (!receivingCallRef.current && incomingCallRef.current?.from === myId) {
        stopIncomingCallAlert();
        stopRingback().catch(() => {});
        setOutgoingCallStatus('');
        if (acceptedName) setCallerName(String(acceptedName));
        if (acceptedPic) setCallerProfilePic(String(acceptedPic));
        startCallRef.current(channelName);
      }
    };
    const onEnded = ({ channelName }: any = {}) => {
      if (!isForActiveCall(channelName)) return;
      stopIncomingCallAlert();
      if (callAcceptedRef.current) showEnded('Call ended');
      cleanupVideoCall();
    };
    const onCancelled = ({ channelName }: any = {}) => {
      if (!isForActiveCall(channelName)) return;
      stopIncomingCallAlert();
      cleanupVideoCall();
    };
    const onRejected = ({ channelName, reason }: any = {}) => {
      if (!isForActiveCall(channelName)) return;
      // A late duplicate reject must never tear down an answered call.
      if (callAcceptedRef.current || isJoiningOrJoined.current) return;
      stopIncomingCallAlert();
      showEnded(endedLabelFor(reason || 'declined'));
      cleanupVideoCall();
    };
    const onNotAccepted = ({ isAudio, channelName }: any) => {
      if (isAudio) return;
      if (channelName && currentChannelRef.current && channelName !== currentChannelRef.current) return;
      stopIncomingCallAlert();
      if (!receivingCallRef.current) showEnded('No answer');
      cleanupVideoCall();
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
      if (!detail?.to || !detail?.channelName) return;
      if (isJoiningOrJoined.current || callAcceptedRef.current || receivingCallRef.current || isCallBusy()) return;
      callSeenStatusSentRef.current = false;
      callIgnoredStatusSentRef.current = false;
      const to = String(detail.to);
      clearEnded();
      setActiveCallKind('video');
      // Place the call from here, so the other side never rings for a call
      // this device refused to start (e.g. already on another call).
      emit('video-call', { to, channelName: detail.channelName, isAudio: false });
      startRingback().catch(() => {});
      currentChannelRef.current = detail.channelName;
      callerRef.current = to;
      receivingCallRef.current = false;
      setIsVideoCall(true);
      setReceivingCall(false);
      setCaller(to);
      setCallerName(detail.calleeName || detail.callerName || 'Connect');
      setCallerProfilePic(detail.calleeProfilePic || detail.callerProfilePic || '');
      setCurrentChannel(detail.channelName);
      setIncomingCall({
        from: myId,
        channelName: detail.channelName,
        name: detail.calleeName || detail.callerName || 'Connect',
        profilePic: detail.calleeProfilePic || detail.callerProfilePic,
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
  }, [applyIncomingVideoCall, cleanupVideoCall, clearEnded, emit, myId, numericUid, off, on, showEnded]);

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
    if (!callAccepted || !mediaConnected) return;
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
  }, [callAccepted, mediaConnected, updateMinimizedCall]);

  useEffect(() => {
    if (receivingCall && !callAccepted && isAppFocused()) {
      markCallSeenIfNeeded();
    }
  }, [receivingCall, callAccepted, markCallSeenIfNeeded]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        markCallSeenIfNeeded();
      } else {
        markCallIgnoredIfNeeded();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [markCallIgnoredIfNeeded, markCallSeenIfNeeded]);

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
    if (event.type === 'joined') {
      // Re-assert the recording-capable session in case another sound switched
      // it to playback-only just before the call was marked active.
      configureInCallAudio(true).catch(() => {});
    }
    if (event.type === 'user-joined' || event.type === 'user-published') {
      setMediaConnected(true);
    }
    if (event.type === 'user-published' && event.mediaType === 'video') {
      setRemoteVideoOn(true);
    }
    if (event.type === 'user-unpublished' && event.mediaType === 'video') {
      setRemoteVideoOn(false);
    }
    if (event.type === 'connection-state') {
      setIsReconnecting(event.state === 'RECONNECTING');
    }
    if (event.type === 'token-will-expire' && currentChannelRef.current) {
      fetchAgoraToken(currentChannelRef.current, numericUid)
        .then((creds) => engineRef.current?.renewToken(creds.token))
        .catch(() => {});
    }
    if (event.type === 'user-left' && callAcceptedRef.current) {
      endCallForPeer();
      showEnded('Call ended');
      cleanupVideoCall();
    }
    // A failed join used to only log a warning, leaving both sides stuck on
    // "connecting". End the call cleanly instead.
    if (
      event.type === 'error' &&
      /^join failed/i.test(String(event.message || '')) &&
      isJoiningOrJoined.current
    ) {
      Alert.alert('Call failed', 'Could not connect the call. Please try again.');
      endCallForPeer();
      cleanupVideoCall();
    }
    if (event.type === 'error') {
      console.warn('VideoCall media error', event.message);
    }
    if (__DEV__ && event.type === 'log') {
      console.log('[VideoCall]', event.message);
    }
  }, [cleanupVideoCall, endCallForPeer, numericUid, showEnded]);

  let phase: 'incoming' | 'outgoing' | 'connecting' | 'connected' = 'outgoing';
  if (callAccepted) phase = mediaConnected ? 'connected' : 'connecting';
  else if (receivingCall) phase = 'incoming';

  let statusText = outgoingCallStatus || 'Calling…';
  if (phase === 'incoming') statusText = 'Incoming video call';
  else if (phase === 'connecting') statusText = 'Connecting…';
  else if (phase === 'connected') statusText = formatCallDuration(callDuration);

  const showEndedScreen = !!endedInfo && !isVideoCall;

  if (!isVideoCall && !mediaActive && !engineWarm && !showEndedScreen) {
    return null;
  }

  const showUi = isVideoCall && !isMinimized;
  // Before the other side's picture arrives my own camera fills the screen
  // (rendered by the engine); once connected their video is full screen.
  const remoteVisible = phase === 'connected' && remoteVideoOn;

  return (
    <>
      <Modal
        visible={showUi || showEndedScreen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={showEndedScreen ? clearEnded : endCall}
      >
        <View style={styles.videoScreen}>
          <AgoraWebEngine
            ref={engineRef}
            visible={Boolean(isVideoCall || mediaActive || engineWarm)}
            isAudio={false}
            onEvent={handleEngineEvent}
            style={styles.engineFill}
          />
          {showEndedScreen ? (
            <View style={styles.endedScreen}>
              <CallBackdrop uri={endedInfo?.pic} />
              <View style={styles.endedContent}>
                <CallHeader isVideo name={endedInfo?.name || ''} status={endedInfo?.label || ''} />
                <View style={styles.center}>
                  <CallAvatar uri={endedInfo?.pic} />
                </View>
              </View>
            </View>
          ) : null}
          {showUi ? (
            <View style={styles.overlay} pointerEvents="box-none">
              <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
              <View style={[styles.topShade, remoteVisible && styles.topShadeCompact]} pointerEvents="none" />
              <View style={styles.bottomShade} pointerEvents="none" />
              <View style={styles.topRow} pointerEvents="box-none">
                {callAccepted ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Minimize call"
                    style={styles.iconButton}
                    onPress={minimizeVideoCall}
                  >
                    <Icon name="expand-more" size={26} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <CallHeader
                isVideo
                compact={remoteVisible}
                name={callerName}
                status={statusText}
                reconnecting={isReconnecting}
              />
              {!remoteVisible && phase !== 'outgoing' && phase !== 'incoming' ? (
                // Connected with the other camera off (or still connecting):
                // show their photo like WhatsApp does.
                <View style={styles.center} pointerEvents="none">
                  <CallAvatar uri={callerProfilePic} />
                </View>
              ) : (
                <View style={styles.center} pointerEvents="none">
                  {phase === 'incoming' || phase === 'outgoing' ? (
                    <View style={styles.smallAvatar}>
                      <CallAvatar uri={callerProfilePic} ringing />
                    </View>
                  ) : null}
                </View>
              )}
              {callAccepted ? <CallTranscript enabled channelName={currentChannel} peerId={caller} myId={myId} /> : null}
              <View style={styles.bottom} pointerEvents="box-none">
                {phase === 'incoming' ? (
                  <IncomingCallActions isVideo onAccept={answerCall} onDecline={endCall} />
                ) : (
                  <CallControlBar>
                    <CallControl
                      icon="flip-camera-ios"
                      label="Switch camera"
                      disabled={!isCameraOn}
                      onPress={switchCamera}
                    />
                    <CallControl
                      icon={isCameraOn ? 'videocam' : 'videocam-off'}
                      label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                      active={!isCameraOn}
                      onPress={toggleCamera}
                    />
                    <CallControl
                      icon={isMuted ? 'mic-off' : 'mic'}
                      label={isMuted ? 'Unmute' : 'Mute'}
                      active={isMuted}
                      disabled={!callAccepted}
                      onPress={toggleMute}
                    />
                    <CallControl icon="call-end" label="End call" danger onPress={endCall} />
                  </CallControlBar>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  videoScreen: { flex: 1, backgroundColor: '#0b141a' },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'transparent',
    paddingTop: 44,
  },
  engineFill: { ...StyleSheet.absoluteFill, backgroundColor: '#0b141a' },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topShadeCompact: { height: 130, backgroundColor: 'rgba(0,0,0,0.25)' },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topRow: { flexDirection: 'row', paddingHorizontal: 12, minHeight: 40 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  smallAvatar: { transform: [{ scale: 0.6 }], marginTop: -120 },
  bottom: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 },
  endedScreen: { ...StyleSheet.absoluteFill, zIndex: 10000, elevation: 10000, backgroundColor: '#0b141a' },
  endedContent: { flex: 1, paddingTop: 72 },
});

export default VideoCall;
