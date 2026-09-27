
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
} from 'react-native';
import Modal from './SystemBarsModal';
import { Audio } from '../lib/avCompat';
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
  CALL_COLORS,
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

interface AudioCallProps {
  myId: string;
}

const AudioCall: React.FC<AudioCallProps> = ({ myId }) => {
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
  const isSpeakerOnRef = useRef(true);
  isSpeakerOnRef.current = isSpeakerOn;
  const [mediaActive, setMediaActive] = useState(false);
  const [engineWarm, setEngineWarm] = useState(false);
  // The other person is in the media channel; the timer starts here.
  const [mediaConnected, setMediaConnected] = useState(false);
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
  const incomingCallRef = useRef(incomingCall);
  const callStartTime = useRef<number | null>(null);
  const callSeenStatusSentRef = useRef(false);
  const callIgnoredStatusSentRef = useRef(false);
  const microphonePublishedRef = useRef(false);
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

  const cleanupAudioCall = useCallback(async () => {
    isTerminating.current = true;
    stopRingback().catch(() => {});
    await stopIncomingCallAlert();
    try { engineRef.current?.leave(); } catch (_) {}
    setMediaActive(false);
    setEngineWarm(false);
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
    setIsSpeakerOn(true);
    setMediaConnected(false);
    setIsReconnecting(false);
    receivingCallRef.current = false;
    callAcceptedRef.current = false;
    currentChannelRef.current = null;
    microphonePublishedRef.current = false;
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
      emit('audio-call-end', { to: String(peer), channelName: channel });
    }
  }, [emit]);

  const startCall = useCallback(async (channelName: string) => {
    try {
      if (isTerminating.current) return;
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission is required for audio calls.');
      }
      stopRingback().catch(() => {});
      setCallAccepted(true);
      setCurrentChannel(channelName);
      if (isJoiningOrJoined.current) return;
      isJoiningOrJoined.current = true;
      microphonePublishedRef.current = false;
      setActiveCallKind('audio');
      setMediaActive(true);
      setEngineWarm(true);

      await configureInCallAudio(true);
      const creds = await prefetchAgoraJoin(channelName, numericUid);
      if (isTerminating.current) return;
      pendingJoinRef.current = creds;
      engineRef.current?.join({ ...creds, isAudio: true, publishAudio: true });
    } catch (error: any) {
      console.error('AudioCall: failed to start', error);
      await stopIncomingCallAlert();
      Alert.alert('Call failed', error?.message || 'Could not start the audio call.');
      isJoiningOrJoined.current = false;
      setActiveCallKind(null);
      setIsAudioCall(false);
      setCallAccepted(false);
      endCallForPeer(channelName);
      cleanupAudioCall();
    }
  }, [numericUid, endCallForPeer, cleanupAudioCall]);

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
      isAudio: true,
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
        emit('audio-call-reject', { to: String(connectIdToNotify), channelName: currentChannelRef.current });
        await cleanupAudioCall();
        return;
      }
    } else if (callerRef.current && callerRef.current !== myId) {
      connectIdToNotify = callerRef.current;
      if (!callAcceptedRef.current) {
        emit('audio-call-cancel', { to: String(connectIdToNotify), channelName: currentChannelRef.current });
        await cleanupAudioCall();
        return;
      }
    }
    if (connectIdToNotify && connectIdToNotify !== myId && currentChannelRef.current) {
      emit('audio-call-end', { to: String(connectIdToNotify), channelName: currentChannelRef.current });
      showEnded('Call ended');
    }
    await cleanupAudioCall();
  }, [cleanupAudioCall, emit, myId, showEnded]);

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
    const placingOwnCall = !!currentChannelRef.current && currentChannelRef.current !== channelName;
    if (isJoiningOrJoined.current || callAcceptedRef.current || receivingCallRef.current || placingOwnCall || isCallBusy()) {
      emit('audio-call-reject', { to: String(from), channelName, reason: 'busy' });
      return;
    }
    clearEnded();
    setActiveCallKind('audio');
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
    configureInCallAudio(true).catch(() => {});
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
  }, [clearEnded, emit, markCallSeenIfNeeded, numericUid]);

  useEffect(() => {
    const onIncoming = ({ from, channelName, isAudio, callerName: name, callerProfilePic: pic }: any) => {
      if (isAudio === false) return;
      applyIncomingAudioCall({ from, channelName, callerName: name, callerProfilePic: pic });
    };
    // Ignore events that belong to a different call than the one on screen.
    const isForActiveCall = (channelName?: string) =>
      !channelName ||
      !currentChannelRef.current ||
      String(channelName) === String(currentChannelRef.current);
    const onCallAccepted = ({ channelName, isAudio, callerName: acceptedName, callerProfilePic: acceptedPic }: any) => {
      if (!isAudio) return;
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
      cleanupAudioCall();
    };
    const onCancelled = ({ channelName }: any = {}) => {
      if (!isForActiveCall(channelName)) return;
      stopIncomingCallAlert();
      cleanupAudioCall();
    };
    const onRejected = ({ channelName, reason }: any = {}) => {
      if (!isForActiveCall(channelName)) return;
      // A late duplicate reject must never tear down an answered call.
      if (callAcceptedRef.current || isJoiningOrJoined.current) return;
      stopIncomingCallAlert();
      showEnded(endedLabelFor(reason || 'declined'));
      cleanupAudioCall();
    };
    const onNotAccepted = ({ isAudio, channelName }: any) => {
      if (!isAudio) return;
      if (channelName && currentChannelRef.current && channelName !== currentChannelRef.current) return;
      stopIncomingCallAlert();
      if (!receivingCallRef.current) showEnded('No answer');
      cleanupAudioCall();
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
      setActiveCallKind('audio');
      // Place the call from here, so the other side never rings for a call
      // this device refused to start (e.g. already on another call).
      emit('audio-call', { to, channelName: detail.channelName, isAudio: true });
      startRingback().catch(() => {});
      currentChannelRef.current = detail.channelName;
      callerRef.current = to;
      receivingCallRef.current = false;
      setIsAudioCall(true);
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
      // Ask for the microphone the moment the call is placed (not after the
      // other side answers), then open it in the call engine while ringing so
      // audio flows the instant the call is accepted.
      (async () => {
        try {
          const permission = await Audio.requestPermissionsAsync();
          if (!permission.granted) {
            emit('audio-call-cancel', { to, channelName: detail.channelName });
            Alert.alert(
              'Microphone needed',
              'Allow microphone access for Expo Go / Connect in Settings to make audio calls.',
            );
            cleanupAudioCall();
            return;
          }
          await configureInCallAudio(true);
          engineRef.current?.preview(true);
        } catch (error) {
          console.warn('AudioCall: microphone warm-up failed', error);
        }
      })();
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
  }, [applyIncomingAudioCall, cleanupAudioCall, clearEnded, emit, myId, numericUid, off, on, showEnded]);

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
    if (!callAccepted || !mediaConnected) return;
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
      if (pendingJoinRef.current) {
        engineRef.current?.join({ ...pendingJoinRef.current, isAudio: true, publishAudio: true });
      }
    }
    if (event.type === 'user-joined' || event.type === 'user-published') {
      setMediaConnected(true);
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
      cleanupAudioCall();
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
      cleanupAudioCall();
    }
    if (event.type === 'audio-enabled') {
      microphonePublishedRef.current = true;
    }
    if (event.type === 'joined' && !microphonePublishedRef.current) {
      // Keep the microphone publishing if the initial join publish raced
      // WebView media startup or was interrupted by the platform.
      engineRef.current?.enableAudio();
    }
    if (event.type === 'joined' || event.type === 'user-published') {
      engineRef.current?.resumeAudio();
    }
    if (event.type === 'joined') {
      // Re-assert the recording-capable session in case another sound switched
      // it to playback-only just before the call was marked active.
      configureInCallAudio(isSpeakerOnRef.current).catch(() => {});
    }
    if (event.type === 'error') {
      console.warn('AudioCall media error', event.message);
    }
    if (__DEV__ && event.type === 'log') {
      console.log('[AudioCall]', event.message);
    }
  }, [cleanupAudioCall, endCallForPeer, numericUid, showEnded]);

  let phase: 'incoming' | 'outgoing' | 'connecting' | 'connected' = 'outgoing';
  if (callAccepted) phase = mediaConnected ? 'connected' : 'connecting';
  else if (receivingCall) phase = 'incoming';

  let statusText = outgoingCallStatus || 'Calling…';
  if (phase === 'incoming') statusText = 'Incoming voice call';
  else if (phase === 'connecting') statusText = 'Connecting…';
  else if (phase === 'connected') statusText = formatCallDuration(callDuration);

  const showEndedScreen = !!endedInfo && !isAudioCall;

  if (!isAudioCall && !mediaActive && !engineWarm && !showEndedScreen) {
    return null;
  }

  return (
    <>
      <AgoraWebEngine
        ref={engineRef}
        visible={Boolean(isAudioCall || mediaActive || engineWarm)}
        isAudio
        foreground={isAudioCall && !isMinimized}
        onEvent={handleEngineEvent}
      />
      {/*
        The Agora engine (a hidden WebView) is rendered OUTSIDE this modal so it
        survives minimizing. A non-transparent fullScreen modal detaches the
        screen underneath it from the window on iOS, and WebKit then stops
        capturing the microphone in that WebView: the call connected but the
        other side heard nothing. A transparent (overFullScreen) modal keeps it
        attached — the same setup as the working live voice modal. The call UI
        below has its own opaque background, so it looks the same.
      */}
      <Modal
        visible={(isAudioCall && !isMinimized) || showEndedScreen}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={showEndedScreen ? clearEnded : endCall}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.root}>
          <CallBackdrop uri={showEndedScreen ? endedInfo?.pic : callerProfilePic} />
          <SafeAreaView style={styles.container}>
            <View style={styles.topRow}>
              {callAccepted && !showEndedScreen ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Minimize call"
                  style={styles.iconButton}
                  onPress={minimizeAudioCall}
                >
                  <Icon name="expand-more" size={26} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.iconButtonSpacer} />
              )}
            </View>
            <CallHeader
              name={showEndedScreen ? endedInfo?.name || '' : callerName}
              status={showEndedScreen ? endedInfo?.label || '' : statusText}
              reconnecting={!showEndedScreen && isReconnecting}
            />
            <View style={styles.center}>
              <CallAvatar
                uri={showEndedScreen ? endedInfo?.pic : callerProfilePic}
                ringing={!showEndedScreen && (phase === 'incoming' || phase === 'outgoing')}
              />
            </View>
            {callAccepted && !showEndedScreen ? (
              <CallTranscript enabled channelName={currentChannel} peerId={caller} myId={myId} />
            ) : null}
            <View style={styles.bottom}>
              {showEndedScreen ? null : phase === 'incoming' ? (
                <IncomingCallActions onAccept={answerCall} onDecline={endCall} />
              ) : (
                <CallControlBar>
                  <CallControl
                    icon={isSpeakerOn ? 'volume-up' : 'volume-down'}
                    label={isSpeakerOn ? 'Speaker on' : 'Speaker off'}
                    active={isSpeakerOn}
                    onPress={toggleSpeaker}
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
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CALL_COLORS.background },
  container: { flex: 1 },
  topRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  iconButtonSpacer: { width: 40, height: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: 16, paddingBottom: 36, paddingTop: 12 },
});

export default AudioCall;
