import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  PanResponder,
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
  // The other side's connection dropped; waiting for them to rejoin.
  const [peerReconnecting, setPeerReconnecting] = useState(false);
  const peerGoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the engine draws my small camera view (for the drag handle).
  const [localRect, setLocalRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
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

  const clearPeerGone = useCallback(() => {
    if (peerGoneTimerRef.current) clearTimeout(peerGoneTimerRef.current);
    peerGoneTimerRef.current = null;
    setPeerReconnecting(false);
  }, []);

  const cleanupVideoCall = useCallback(async () => {
    const channel = currentChannelRef.current;
    // With no call of its own, leave the audio overlay's ringing, ringback
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
      DeviceEventEmitter.emit('video-call-active', false);
      await stopIncomingCallAlert();
    }
    try { engineRef.current?.leave(); } catch (_) {}
    setMediaActive(false);
    setEngineWarm(false);
    pendingJoinRef.current = null;
    clearAgoraJoinPrefetch(channel || undefined);
    isJoiningOrJoined.current = false;
    micAlertShownRef.current = false;
    clearActiveCallKind('video');
    if (channel) {
      try { endMinimizedCall(`video-${channel}`); } catch (_) {}
    }
    if (hadCall) emitLocalCallEnded();
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
      emit('video-call-end', { to: String(peer), channelName: channel });
    }
  }, [emit]);

  const startCall = useCallback(async (channelName: string) => {
    try {
      if (isTerminating.current) return;
      // A duplicate "call-accepted" or a second answer must not start a
      // second join.
      if (isJoiningOrJoined.current) return;
      isJoiningOrJoined.current = true;
      callAcceptedRef.current = true;
      currentChannelRef.current = channelName;
      setCallAccepted(true);
      setCurrentChannel(channelName);
      setActiveCallKind('video');
      setMediaActive(true);
      setEngineWarm(true);
      stopRingback().catch(() => {});
      // The global emotion camera uses the same front camera as Agora.
      DeviceEventEmitter.emit('video-call-active', true);

      // One permission request at a time, before the engine opens the
      // devices: Android ignores a second request made while one is showing,
      // and the engine's own camera/microphone request was then denied, so
      // the join failed and the call ended for both sides.
      const mic = await Audio.requestPermissionsAsync();
      if (isTerminating.current) return;
      if (!mic?.granted) {
        throw new Error('Connect needs microphone access for video calls. Allow it in Settings and try again.');
      }
      // No camera: the engine joins with the microphone only.
      await Camera.requestCameraPermissionsAsync().catch(() => null);
      if (isTerminating.current) return;
      // Keeps the call audio going if the screen is turned off mid-call.
      startOngoingCallService({ isVideo: true, peerName: callerNameRef.current || undefined });
      configureInCallAudio(true).catch(() => {});
      // Let the emotion camera release the front camera first.
      await new Promise(resolve => setTimeout(resolve, 150));
      if (isTerminating.current) return;
      const creds = await prefetchAgoraJoin(channelName, numericUid);
      if (isTerminating.current) return;
      pendingJoinRef.current = creds;
      engineRef.current?.join({ ...creds, isAudio: false });
    } catch (error: any) {
      console.error('VideoCall: failed to start', error);
      await stopIncomingCallAlert();
      Alert.alert('Call failed', error?.message || 'Could not start the video call.');
      isJoiningOrJoined.current = false;
      clearActiveCallKind('video');
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
    // A second tap, or the notification's Accept on top of the button, must
    // not answer twice: the caller got call-accepted twice and its second
    // join attempt cut short the first, so it never sent audio or video.
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

  // My camera behind the incoming-call screen, when the app may already use
  // it. Asking for permissions here put system dialogs over the ringing
  // screen (and Android drops one of two requests made at once); answering
  // asks for them.
  const previewWhileRinging = useCallback((channelName: string) => {
    Promise.all([Audio.getPermissionsAsync(), Camera.getCameraPermissionsAsync()])
      .then(([mic, cam]) => {
        if (mic?.granted && cam?.granted && currentChannelRef.current === channelName && !callAcceptedRef.current) {
          engineRef.current?.preview(false);
        }
      })
      .catch(() => {});
  }, []);

  // `fromPush`: a push, a notification tap or a replay of one, which can
  // arrive late or twice; otherwise the server's incoming-call event.
  const applyIncomingVideoCall = useCallback((args: any) => {
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
    previewWhileRinging(channelName);
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
  }, [clearEnded, emit, markCallSeenIfNeeded, numericUid, previewWhileRinging]);

  useEffect(() => { applyIncomingRef.current = applyIncomingVideoCall; }, [applyIncomingVideoCall]);

  useEffect(() => {
    const onIncoming = ({ from, channelName, isAudio, callerName: name, callerProfilePic: pic }: any) => {
      if (isAudio) return;
      applyIncomingVideoCall({ from, channelName, callerName: name, callerProfilePic: pic });
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
      if (!isForActiveCall(channelName)) {
        markOtherCallOver(channelName);
        return;
      }
      stopIncomingCallAlert();
      if (callAcceptedRef.current) showEnded('Call ended');
      cleanupVideoCall();
    };
    const onCancelled = ({ channelName }: any = {}) => {
      if (!isForActiveCall(channelName)) {
        markOtherCallOver(channelName);
        return;
      }
      stopIncomingCallAlert();
      cleanupVideoCall();
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
      cleanupVideoCall();
    };
    const onNotAccepted = ({ isAudio, channelName }: any) => {
      if (isAudio) return;
      if (!currentChannelRef.current) return;
      if (channelName && channelName !== currentChannelRef.current) return;
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
      setMediaActive(true);
      prefetchAgoraJoin(detail.channelName, numericUid).catch(() => {});
      const channel = String(detail.channelName);
      const peerName = detail.calleeName || detail.callerName;
      // One permission request at a time (Android ignores a second request
      // made while one is showing), then my camera shows while it rings.
      (async () => {
        try {
          const mic = await Audio.requestPermissionsAsync();
          if (currentChannelRef.current !== channel) return;
          if (!mic?.granted) {
            emit('video-call-cancel', { to, channelName: channel });
            Alert.alert('Microphone needed', 'Allow microphone access for Connect in Settings to make video calls.');
            cleanupVideoCall();
            return;
          }
          // Started now, while on screen: the caller may lock the phone
          // before the other side answers.
          startOngoingCallService({ isVideo: true, peerName });
          await Camera.requestCameraPermissionsAsync().catch(() => null);
          if (currentChannelRef.current !== channel || callAcceptedRef.current) return;
          engineRef.current?.preview(false);
        } catch (error) {
          console.warn('VideoCall: camera/microphone warm-up failed', error);
        }
      })();
    };
    const onPushIncoming = (detail: any) => {
      if (detail?.isAudio) return;
      const channel = detail?.channelName ? String(detail.channelName) : '';
      if (detail?.autoAccept && channel) {
        // Accept pressed on the notification of the call already ringing here.
        if (currentChannelRef.current === channel) {
          if (receivingCallRef.current && !callAcceptedRef.current) answerCallRef.current?.();
          return;
        }
        pendingAutoAcceptRef.current = channel;
      }
      applyIncomingVideoCall({
        from: detail.from,
        channelName: detail.channelName,
        callerName: detail.callerName,
        callerProfilePic: detail.callerProfilePic,
        ringtoneId: detail.ringtoneId,
        fromPush: true,
      });
    };
    const onPushReject = (detail: any) => {
      if (detail?.isAudio) return;
      const channel = detail?.channelName ? String(detail.channelName) : '';
      if (channel) markCallHandled(channel);
      // The server ignores a decline for a call that was already answered.
      if (detail.from && channel) {
        emit('video-call-reject', { to: String(detail.from), channelName: channel });
      }
      // Decline pressed on an old notification, or on the notification of a
      // call that was answered meanwhile: never close the call on screen.
      if (!currentChannelRef.current) return;
      if (channel && currentChannelRef.current !== channel) return;
      if (callAcceptedRef.current || isJoiningOrJoined.current) return;
      stopIncomingCallAlert();
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
    // Replay a notification tap that arrived before this overlay mounted.
    // A Decline goes first, so the call it declined is not rung below.
    const replayReject = takeLastRejectCallFromPush();
    if (replayReject && replayReject.isAudio === false && replayReject.channelName) {
      markCallHandled(replayReject.channelName);
    }
    const replayIncoming = takeLastIncomingCallFromPush();
    if (replayIncoming && replayIncoming.isAudio === false) {
      if (replayIncoming.autoAccept && replayIncoming.channelName) {
        pendingAutoAcceptRef.current = String(replayIncoming.channelName);
      }
      applyIncomingVideoCall({
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
    // Only the microphone: the engine mutes it without touching the camera.
    // (Re-running the camera preview here could close and replace the
    // published tracks mid-call.)
    engineRef.current?.muteAudio(next);

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
      if (receivingCallRef.current && !callAcceptedRef.current && currentChannelRef.current) {
        previewWhileRinging(currentChannelRef.current);
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
    if (event.type === 'user-joined') {
      // The other side came back after a dropped connection.
      clearPeerGone();
    }
    if (event.type === 'local-rect') {
      setLocalRect(event.shown ? { x: event.x, y: event.y, width: event.width, height: event.height } : null);
    }
    if (event.type === 'engine-reset') {
      setLocalRect(null);
      // The engine page was reloaded mid-call; it rejoins on "ready".
      if (isJoiningOrJoined.current) setIsReconnecting(true);
    }
    if (event.type === 'joined') {
      setIsReconnecting(false);
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
      // The peer is gone for good: close the call everywhere.
      const endForPeer = () => {
        peerGoneTimerRef.current = null;
        if (!callAcceptedRef.current) return;
        endCallForPeer();
        showEnded('Call ended');
        cleanupVideoCall();
      };
      if (peerLeftOnPurpose(event.reason)) {
        endForPeer();
      } else {
        // Their connection dropped: give them time to rejoin.
        setPeerReconnecting(true);
        setRemoteVideoOn(false);
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
      cleanupVideoCall();
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
      console.warn('VideoCall media error', event.message);
    }
    if (__DEV__ && event.type === 'log') {
      console.log('[VideoCall]', event.message);
    }
  }, [cleanupVideoCall, clearPeerGone, endCallForPeer, numericUid, previewWhileRinging, showEnded]);

  // The engine sits under the call screen, so the screen carries a drag
  // handle over my small camera view and moves it in the engine.
  const localDrag = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => engineRef.current?.dragLocal('start'),
    onPanResponderMove: (_e, g) => engineRef.current?.dragLocal('move', g.dx, g.dy),
    onPanResponderRelease: () => engineRef.current?.dragLocal('end'),
    onPanResponderTerminate: () => engineRef.current?.dragLocal('end'),
  }), []);

  let phase: 'incoming' | 'outgoing' | 'connecting' | 'connected' = 'outgoing';
  if (callAccepted) phase = mediaConnected ? 'connected' : 'connecting';
  else if (receivingCall) phase = 'incoming';

  let statusText = outgoingCallStatus || 'Calling…';
  if (phase === 'incoming') statusText = 'Incoming video call';
  else if (phase === 'connecting') statusText = 'Connecting…';
  else if (phase === 'connected') statusText = formatCallDuration(callDuration);

  const showEndedScreen = !!endedInfo && !isVideoCall;

  const showUi = isVideoCall && !isMinimized;
  // Before the other side's picture arrives my own camera fills the screen
  // (rendered by the engine); once connected their video is full screen.
  const remoteVisible = phase === 'connected' && remoteVideoOn;

  return (
    <>
      {/*
        The engine (camera + the other person's video) is rendered OUTSIDE
        the modal. A modal unmounts its content when hidden, so minimizing the
        call used to destroy the engine and cut the call's audio and video.
        The modal is transparent, so the video shows through behind the
        controls. It also stays mounted (and pre-warmed) between calls so
        calls connect fast.
      */}
      <AgoraWebEngine
        ref={engineRef}
        visible={Boolean(isVideoCall || mediaActive || engineWarm)}
        isAudio={false}
        prewarm
        foreground={showUi}
        onEvent={handleEngineEvent}
        style={showUi ? styles.engineOnTop : styles.engineFill}
      />
      <Modal
        visible={showUi || showEndedScreen}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={showEndedScreen ? clearEnded : endCall}
      >
        <View style={styles.videoScreen}>
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
              {localRect ? (
                <View
                  accessibilityLabel="Move your camera view"
                  style={[styles.localDragHandle, {
                    left: localRect.x,
                    top: localRect.y,
                    width: localRect.width,
                    height: localRect.height,
                  }]}
                  {...localDrag.panHandlers}
                />
              ) : null}
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
                reconnecting={isReconnecting || peerReconnecting}
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
  // Transparent: the engine's video, rendered behind the modal, shows through.
  videoScreen: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'transparent',
    paddingTop: 44,
  },
  engineFill: { ...StyleSheet.absoluteFill, backgroundColor: '#0b141a' },
  // On screen: above the app, below the (transparent) call screen.
  engineOnTop: { ...StyleSheet.absoluteFill, backgroundColor: '#0b141a', zIndex: 1000, elevation: 1000 },
  localDragHandle: { position: 'absolute', backgroundColor: 'transparent' },
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
