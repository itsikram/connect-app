
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
import {
  clearActiveCallKind,
  forgetHandledCall,
  isCallBusy,
  markCallHandled,
  setActiveCallKind,
  wasCallHandled,
} from '../lib/callSession';
import { clearPendingIncomingCall } from '../lib/pendingIncomingCall';
import { startOngoingCallService } from '../lib/ongoingCall';
import { configureInCallAudio } from '../lib/callRingtone';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../lib/incomingCallAlerts';
import { isAppFocused, notifyCallerRinging, sameProfileId } from '../lib/callStatus';
import { PEER_RECONNECT_GRACE_MS, peerLeftOnPurpose } from '../lib/callReconnect';
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
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const isSpeakerOnRef = useRef(false);
  isSpeakerOnRef.current = isSpeakerOn;
  const [mediaActive, setMediaActive] = useState(false);
  const [engineWarm, setEngineWarm] = useState(false);
  // The other person is in the media channel; the timer starts here.
  const [mediaConnected, setMediaConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  // The other side's connection dropped; waiting for them to rejoin.
  const [peerReconnecting, setPeerReconnecting] = useState(false);
  const peerGoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // Channel of a call accepted from its notification before it was on screen.
  const pendingAutoAcceptRef = useRef<string | null>(null);
  const answerCallRef = useRef<(() => void) | null>(null);
  const pendingJoinRef = useRef<{ appId: string; token: string; channelName: string; uid: number } | null>(null);
  const startCallRef = useRef<(channelName: string) => Promise<void>>(async () => {});
  const applyIncomingRef = useRef<(args: any) => void>(() => {});
  // "Microphone unavailable" is said once per call.
  const micAlertShownRef = useRef(false);

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

  const clearPeerGone = useCallback(() => {
    if (peerGoneTimerRef.current) clearTimeout(peerGoneTimerRef.current);
    peerGoneTimerRef.current = null;
    setPeerReconnecting(false);
  }, []);

  const cleanupAudioCall = useCallback(async () => {
    const channel = currentChannelRef.current;
    // With no call of its own, leave the video overlay's ringing, ringback
    // and busy state alone.
    const hadCall = !!channel || isJoiningOrJoined.current || receivingCallRef.current || callAcceptedRef.current;
    isTerminating.current = true;
    clearPeerGone();
    if (channel) {
      // Over: a late push or a replayed notification must not ring it again.
      markCallHandled(channel);
      clearPendingIncomingCall(channel).catch(() => {});
    }
    if (hadCall) {
      stopRingback().catch(() => {});
      await stopIncomingCallAlert();
    }
    try { engineRef.current?.leave(); } catch (_) {}
    setMediaActive(false);
    setEngineWarm(false);
    pendingJoinRef.current = null;
    clearAgoraJoinPrefetch(channel || undefined);
    isJoiningOrJoined.current = false;
    micAlertShownRef.current = false;
    clearActiveCallKind('audio');
    if (channel) {
      try { endMinimizedCall(`audio-${channel}`); } catch (_) {}
    }
    if (hadCall) emitLocalCallEnded();
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
    setIsSpeakerOn(false);
    setMediaConnected(false);
    setIsReconnecting(false);
    receivingCallRef.current = false;
    callAcceptedRef.current = false;
    currentChannelRef.current = null;
    microphonePublishedRef.current = false;
    callStartTime.current = null;
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    pendingAutoAcceptRef.current = null;
    setTimeout(() => { isTerminating.current = false; }, 400);
  }, [clearPeerGone, endMinimizedCall]);

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
      // A duplicate "call-accepted" or a second answer must not start a
      // second join.
      if (isJoiningOrJoined.current) return;
      isJoiningOrJoined.current = true;
      microphonePublishedRef.current = false;
      callAcceptedRef.current = true;
      currentChannelRef.current = channelName;
      setCallAccepted(true);
      setCurrentChannel(channelName);
      setActiveCallKind('audio');
      stopRingback().catch(() => {});
      const permission = await Audio.requestPermissionsAsync();
      if (isTerminating.current) return;
      if (!permission.granted) {
        throw new Error('Microphone permission is required for audio calls.');
      }
      // Keeps the microphone live if the screen is turned off mid-call.
      startOngoingCallService({ isVideo: false, peerName: callerNameRef.current || undefined });
      setMediaActive(true);
      setEngineWarm(true);

      await configureInCallAudio(isSpeakerOnRef.current);
      const creds = await prefetchAgoraJoin(channelName, numericUid);
      if (isTerminating.current) return;
      pendingJoinRef.current = creds;
      engineRef.current?.join({ ...creds, isAudio: true, publishAudio: true });
    } catch (error: any) {
      console.error('AudioCall: failed to start', error);
      await stopIncomingCallAlert();
      Alert.alert('Call failed', error?.message || 'Could not start the audio call.');
      isJoiningOrJoined.current = false;
      clearActiveCallKind('audio');
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
    // A second tap, or the notification's Accept on top of the button, must
    // not answer twice: the caller would get call-accepted twice.
    if (callAcceptedRef.current || isJoiningOrJoined.current) return;
    callAcceptedRef.current = true;
    setCallAccepted(true);
    // Answered: a late push or a replayed notification must not ring it again.
    markCallHandled(incoming.channelName);
    clearPendingIncomingCall(incoming.channelName).catch(() => {});
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

  // `fromPush`: a push, a notification tap or a replay of one, which can
  // arrive late or twice; otherwise the server's incoming-call event.
  const applyIncomingAudioCall = useCallback((args: any) => {
    const { from, channelName, callerName: name, callerProfilePic: pic, ringtoneId, fromPush, deferred = 0 } = args || {};
    if (!from || !channelName) return;
    // The server rings every call once (older apps reuse one channel per pair).
    if (!fromPush && !deferred) forgetHandledCall(channelName);
    if (isTerminating.current) {
      // Still closing the previous call (e.g. the caller redialled at once):
      // ring once that is done instead of dropping this call.
      if (deferred < 3) {
        setTimeout(() => applyIncomingRef.current({ ...args, deferred: deferred + 1 }), 450);
      }
      return;
    }
    // Already on screen (ringing, answering or connected): a second delivery
    // must neither ring again nor be answered "busy".
    if (currentChannelRef.current === channelName) return;
    // Answered, declined or over (a late push, an old notification, or the
    // caller hung up while this call waited above).
    if ((fromPush || deferred) && wasCallHandled(channelName)) return;
    const placingOwnCall = !!currentChannelRef.current;
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

  useEffect(() => { applyIncomingRef.current = applyIncomingAudioCall; }, [applyIncomingAudioCall]);

  useEffect(() => {
    const onIncoming = ({ from, channelName, isAudio, callerName: name, callerProfilePic: pic }: any) => {
      if (isAudio === false) return;
      applyIncomingAudioCall({ from, channelName, callerName: name, callerProfilePic: pic });
    };
    // Ignore events that belong to a different call than the one on screen,
    // and all of them while no call is on screen.
    const isForActiveCall = (channelName?: string) =>
      !!currentChannelRef.current &&
      (!channelName || String(channelName) === String(currentChannelRef.current));
    // A call that ended before it reached the screen (it was still waiting
    // for the previous call to close, or only its push is still to come).
    const markOtherCallOver = (channelName?: string) => {
      if (channelName && String(channelName) !== String(currentChannelRef.current || '')) {
        markCallHandled(String(channelName));
      }
    };
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
      if (!isForActiveCall(channelName)) {
        markOtherCallOver(channelName);
        return;
      }
      stopIncomingCallAlert();
      if (callAcceptedRef.current) showEnded('Call ended');
      cleanupAudioCall();
    };
    const onCancelled = ({ channelName }: any = {}) => {
      if (!isForActiveCall(channelName)) {
        markOtherCallOver(channelName);
        return;
      }
      stopIncomingCallAlert();
      cleanupAudioCall();
    };
    const onRejected = ({ channelName, reason }: any = {}) => {
      if (!isForActiveCall(channelName)) {
        markOtherCallOver(channelName);
        return;
      }
      // A late duplicate reject must never tear down an answered call.
      if (callAcceptedRef.current || isJoiningOrJoined.current) return;
      stopIncomingCallAlert();
      showEnded(endedLabelFor(reason || 'declined'));
      cleanupAudioCall();
    };
    const onNotAccepted = ({ isAudio, channelName }: any) => {
      if (!isAudio) return;
      if (!currentChannelRef.current) return;
      if (channelName && channelName !== currentChannelRef.current) return;
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
          if (currentChannelRef.current !== detail.channelName) return;
          if (!permission.granted) {
            emit('audio-call-cancel', { to, channelName: detail.channelName });
            Alert.alert(
              'Microphone needed',
              'Allow microphone access for Expo Go / Connect in Settings to make audio calls.',
            );
            cleanupAudioCall();
            return;
          }
          // Started now, while on screen: the caller may lock the phone
          // before the other side answers.
          startOngoingCallService({
            isVideo: false,
            peerName: detail.calleeName || detail.callerName,
          });
          await configureInCallAudio(isSpeakerOnRef.current);
          engineRef.current?.preview(true);
        } catch (error) {
          console.warn('AudioCall: microphone warm-up failed', error);
        }
      })();
    };
    const onPushIncoming = (detail: any) => {
      if (detail?.isAudio === false) return;
      const channel = detail?.channelName ? String(detail.channelName) : '';
      if (detail?.autoAccept && channel) {
        // Accept pressed on the notification of the call already ringing here.
        if (currentChannelRef.current === channel) {
          if (receivingCallRef.current && !callAcceptedRef.current) answerCallRef.current?.();
          return;
        }
        pendingAutoAcceptRef.current = channel;
      }
      applyIncomingAudioCall({
        from: detail.from,
        channelName: detail.channelName,
        callerName: detail.callerName,
        callerProfilePic: detail.callerProfilePic,
        ringtoneId: detail.ringtoneId,
        fromPush: true,
      });
    };
    const onPushReject = (detail: any) => {
      if (detail?.isAudio === false) return;
      const channel = detail?.channelName ? String(detail.channelName) : '';
      if (channel) markCallHandled(channel);
      // The server ignores a decline for a call that was already answered.
      if (detail.from && channel) {
        emit('audio-call-reject', { to: String(detail.from), channelName: channel });
      }
      // Decline pressed on an old notification, or on the notification of a
      // call that was answered meanwhile: never close the call on screen.
      if (!currentChannelRef.current) return;
      if (channel && currentChannelRef.current !== channel) return;
      if (callAcceptedRef.current || isJoiningOrJoined.current) return;
      stopIncomingCallAlert();
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
    // Replay a notification tap that arrived before this overlay mounted.
    // A Decline goes first, so the call it declined is not rung below.
    const replayReject = takeLastRejectCallFromPush();
    if (replayReject && replayReject.isAudio !== false && replayReject.channelName) {
      markCallHandled(replayReject.channelName);
    }
    const replayIncoming = takeLastIncomingCallFromPush();
    if (replayIncoming && replayIncoming.isAudio !== false) {
      if (replayIncoming.autoAccept && replayIncoming.channelName) {
        pendingAutoAcceptRef.current = String(replayIncoming.channelName);
      }
      applyIncomingAudioCall({
        from: replayIncoming.from,
        channelName: replayIncoming.channelName,
        callerName: replayIncoming.callerName,
        callerProfilePic: replayIncoming.callerProfilePic,
        ringtoneId: replayIncoming.ringtoneId,
        fromPush: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only the call that was accepted from its notification: a stale accept
    // (its call was already over) must never answer the next call.
    const accepted = pendingAutoAcceptRef.current;
    if (accepted && receivingCall && incomingCall && !callAccepted) {
      pendingAutoAcceptRef.current = null;
      if (incomingCall.channelName !== accepted) return;
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
    if (event.type === 'user-joined') {
      // The other side came back after a dropped connection.
      clearPeerGone();
    }
    if (event.type === 'connection-state') {
      setIsReconnecting(event.state === 'RECONNECTING');
    }
    if (event.type === 'engine-reset' && isJoiningOrJoined.current) {
      // The engine page was reloaded mid-call; it rejoins on "ready".
      microphonePublishedRef.current = false;
      setIsReconnecting(true);
    }
    if (event.type === 'joined') {
      setIsReconnecting(false);
    }
    if (event.type === 'token-will-expire' && currentChannelRef.current) {
      fetchAgoraToken(currentChannelRef.current, numericUid)
        .then((creds) => engineRef.current?.renewToken(creds.token))
        .catch(() => {});
    }
    if (event.type === 'user-left' && callAcceptedRef.current) {
      // The peer is gone for good: close the call everywhere.
      const endForPeer = () => {
        peerGoneTimerRef.current = null;
        if (!callAcceptedRef.current) return;
        endCallForPeer();
        showEnded('Call ended');
        cleanupAudioCall();
      };
      if (peerLeftOnPurpose(event.reason)) {
        endForPeer();
      } else {
        // Their connection dropped: give them time to rejoin.
        setPeerReconnecting(true);
        if (peerGoneTimerRef.current) clearTimeout(peerGoneTimerRef.current);
        peerGoneTimerRef.current = setTimeout(endForPeer, PEER_RECONNECT_GRACE_MS);
      }
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
    if (event.type === 'mic-unavailable' && isJoiningOrJoined.current && !micAlertShownRef.current) {
      // The call stays up and the engine keeps trying the microphone.
      micAlertShownRef.current = true;
      Alert.alert(
        'Microphone unavailable',
        'Connect could not start your microphone, so the other person may not hear you. Close other apps using the microphone; the call keeps trying.',
      );
    }
    if (event.type === 'error') {
      console.warn('AudioCall media error', event.message);
    }
    if (__DEV__ && event.type === 'log') {
      console.log('[AudioCall]', event.message);
    }
  }, [cleanupAudioCall, clearPeerGone, endCallForPeer, numericUid, showEnded]);

  let phase: 'incoming' | 'outgoing' | 'connecting' | 'connected' = 'outgoing';
  if (callAccepted) phase = mediaConnected ? 'connected' : 'connecting';
  else if (receivingCall) phase = 'incoming';

  let statusText = outgoingCallStatus || 'Calling…';
  if (phase === 'incoming') statusText = 'Incoming voice call';
  else if (phase === 'connecting') statusText = 'Connecting…';
  else if (phase === 'connected') statusText = formatCallDuration(callDuration);

  const showEndedScreen = !!endedInfo && !isAudioCall;

  return (
    <>
      {/* Stays mounted (and pre-warmed) between calls so calls connect fast. */}
      <AgoraWebEngine
        ref={engineRef}
        visible={Boolean(isAudioCall || mediaActive || engineWarm)}
        isAudio
        prewarm
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
              reconnecting={!showEndedScreen && (isReconnecting || peerReconnecting)}
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
