import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { Audio } from 'expo-av';
import { useSelector } from 'react-redux';
import { useSocket } from '../contexts/SocketContext';
import { RootState } from '../store';
import api from '../lib/api';
import { hashProfileUid } from '../lib/agoraUid';
import { configureInCallAudio } from '../lib/callRingtone';
import { isCallBusy } from '../lib/callSession';
import {
  LIVE_VOICE_EVENTS,
  LiveVoiceStartDetail,
  LiveVoiceStatusDetail,
  emitLiveVoiceStatus,
} from '../lib/liveVoiceEvents';
import AgoraWebEngine, { AgoraEngineEvent, AgoraWebEngineHandle } from './AgoraWebEngine';
import LiveVoiceModal from './LiveVoiceModal';

const mapAgoraQuality = (uplink = 0, downlink = 0) => {
  const worst = Math.max(uplink || 0, downlink || 0);
  if (!worst || worst <= 1) return 4;
  if (worst === 2) return 3;
  if (worst === 3) return 2;
  return 1;
};

const peerFromChannel = (channelName: string | null, myId?: string | null) => {
  if (!channelName || !myId) return null;
  const parts = String(channelName).split('_');
  if (parts.length < 2) return null;
  return parts.find((id) => String(id) !== String(myId)) || null;
};

interface LiveVoiceProps {
  myId: string;
}

const LiveVoice: React.FC<LiveVoiceProps> = ({ myId }) => {
  const { on, off, emit, isConnected } = useSocket();
  const chats = useSelector((state: RootState) => state.chat.chats);

  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [role, setRole] = useState<'sender' | 'receiver'>('sender');
  const [friendName, setFriendName] = useState('Friend');
  const [connectionQuality, setConnectionQuality] = useState(4);
  const [mediaActive, setMediaActive] = useState(false);

  const engineRef = useRef<AgoraWebEngineHandle>(null);
  const pendingJoinRef = useRef<{ appId: string; token: string; channelName: string; uid: number } | null>(null);
  const channelRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const isJoiningRef = useRef(false);
  const isActiveRef = useRef(false);
  const sessionIdRef = useRef(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roleRef = useRef<'sender' | 'receiver'>('sender');
  const stopSessionRef = useRef<(notifyPeer?: boolean) => Promise<void>>(async () => {});
  const recentlyStoppedRef = useRef<Map<string, number>>(new Map());
  const notifyPeerOnJoinRef = useRef(false);

  const numericUid = useMemo(() => hashProfileUid(myId), [myId]);

  const clearDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const broadcastStatus = useCallback((overrides: Partial<LiveVoiceStatusDetail> = {}) => {
    emitLiveVoiceStatus({
      active: isActiveRef.current,
      connecting: isJoiningRef.current,
      duration: 0,
      peerId: peerIdRef.current,
      channelName: channelRef.current,
      role: roleRef.current,
      ...overrides,
    });
  }, []);

  const resolveFriendName = useCallback((friendId?: string | null, fallback?: string) => {
    if (fallback) return fallback;
    if (!friendId) return 'Friend';
    const chat = (chats || []).find((c: any) =>
      String(c?.person?._id) === String(friendId) ||
      String(c?.friend?._id) === String(friendId) ||
      String(c?.friend?.user?._id) === String(friendId) ||
      String(c?.user?._id) === String(friendId),
    );
    return (
      chat?.person?.fullName ||
      chat?.friend?.fullName ||
      [chat?.friend?.user?.firstName, chat?.friend?.user?.lastName].filter(Boolean).join(' ').trim() ||
      [chat?.user?.firstName, chat?.user?.lastName].filter(Boolean).join(' ').trim() ||
      'Friend'
    );
  }, [chats]);

  const ensureLeave = useCallback(() => {
    try { engineRef.current?.leave(); } catch (_e) {}
    pendingJoinRef.current = null;
    setMediaActive(false);
  }, []);

  const stopSession = useCallback(async (notifyPeer = true) => {
    const channelName = channelRef.current;
    const peerId = peerIdRef.current || peerFromChannel(channelName, myId);
    const hadSession = isActiveRef.current || isJoiningRef.current || !!channelName;

    if (channelName) {
      recentlyStoppedRef.current.set(String(channelName), Date.now());
    }

    sessionIdRef.current += 1;
    notifyPeerOnJoinRef.current = false;

    if (notifyPeer && hadSession && (peerId || channelName)) {
      emit('live-voice-stop', {
        to: peerId ? String(peerId) : undefined,
        channelName,
      });
    }

    clearDurationTimer();
    ensureLeave();

    isJoiningRef.current = false;
    isActiveRef.current = false;
    channelRef.current = null;
    peerIdRef.current = null;

    setIsConnecting(false);
    setIsActive(false);
    setIsOpen(false);
    setDuration(0);
    setConnectionQuality(4);

    broadcastStatus({
      active: false,
      connecting: false,
      duration: 0,
      peerId: null,
      channelName: null,
    });
  }, [broadcastStatus, clearDurationTimer, emit, ensureLeave, myId]);

  const startSession = useCallback(async ({
    to,
    channelName,
    friendName: name,
    sessionRole = 'sender',
    notifyPeer = true,
  }: {
    to: string;
    channelName: string;
    friendName?: string;
    sessionRole?: 'sender' | 'receiver';
    notifyPeer?: boolean;
  }) => {
    if (!to || !channelName || !myId) return;

    if (
      isActiveRef.current &&
      channelRef.current &&
      String(channelRef.current) === String(channelName)
    ) {
      setIsOpen(true);
      return;
    }

    if (isJoiningRef.current || isActiveRef.current) {
      console.warn('Live voice: already in a session');
      return;
    }

    if (isCallBusy()) {
      Alert.alert('Busy', 'Finish your current call before starting live voice.');
      return;
    }

    const sessionId = ++sessionIdRef.current;
    isJoiningRef.current = true;
    notifyPeerOnJoinRef.current = notifyPeer;
    peerIdRef.current = String(to);
    channelRef.current = channelName;
    roleRef.current = sessionRole;
    setRole(sessionRole);
    setFriendName(resolveFriendName(to, name));
    setIsOpen(true);
    setIsConnecting(true);
    setIsActive(false);
    setDuration(0);
    setConnectionQuality(4);
    broadcastStatus({
      active: false,
      connecting: true,
      duration: 0,
      peerId: String(to),
      channelName,
      role: sessionRole,
    });

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission is required for live voice.');
      }
      await configureInCallAudio(true);

      const { data } = await api.post('/agora/token', {
        channelName,
        uid: numericUid,
        role: 'publisher',
      });
      if (!data?.appId || !data?.token) {
        throw new Error('Invalid Agora token response');
      }
      if (sessionId !== sessionIdRef.current) return;

      pendingJoinRef.current = {
        appId: data.appId,
        token: data.token,
        channelName,
        uid: numericUid,
      };
      setMediaActive(true);
      engineRef.current?.join({
        appId: data.appId,
        token: data.token,
        channelName,
        uid: numericUid,
        isAudio: true,
      });
    } catch (error: any) {
      console.error('Live voice start failed:', error);
      await stopSession(false);
      Alert.alert('Live Voice Error', error?.message || 'Failed to start live voice transfer');
    }
  }, [broadcastStatus, myId, numericUid, resolveFriendName, stopSession]);

  const markJoined = useCallback(() => {
    if (!isJoiningRef.current && !channelRef.current) return;
    const to = peerIdRef.current;
    const channelName = channelRef.current;
    const sessionRole = roleRef.current;

    isJoiningRef.current = false;
    isActiveRef.current = true;
    setIsConnecting(false);
    setIsActive(true);
    setIsOpen(true);

    if (notifyPeerOnJoinRef.current && to && channelName) {
      notifyPeerOnJoinRef.current = false;
      emit('live-voice-start', {
        to: String(to),
        channelName,
      });
    }

    clearDurationTimer();
    durationTimerRef.current = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        broadcastStatus({
          active: true,
          connecting: false,
          duration: next,
          peerId: to,
          channelName,
          role: sessionRole,
        });
        return next;
      });
    }, 1000);

    broadcastStatus({
      active: true,
      connecting: false,
      duration: 0,
      peerId: to,
      channelName,
      role: sessionRole,
    });
  }, [broadcastStatus, clearDurationTimer, emit]);

  const onEngineEvent = useCallback((event: AgoraEngineEvent) => {
    if (event.type === 'ready' && pendingJoinRef.current) {
      const pending = pendingJoinRef.current;
      engineRef.current?.join({ ...pending, isAudio: true });
      return;
    }
    if (event.type === 'joined') {
      markJoined();
      return;
    }
    if (event.type === 'network-quality') {
      setConnectionQuality(mapAgoraQuality(event.uplink, event.downlink));
      return;
    }
    if (event.type === 'user-left') {
      if (!isActiveRef.current && !isJoiningRef.current) return;
      stopSessionRef.current(false);
      return;
    }
    if (event.type === 'error') {
      console.warn('Live voice engine error:', event.message);
      if (isJoiningRef.current) {
        stopSessionRef.current(false);
        Alert.alert('Live Voice Error', event.message || 'Failed to join live voice');
      }
    }
  }, [markJoined]);

  useEffect(() => {
    stopSessionRef.current = stopSession;
  }, [stopSession]);

  useEffect(() => {
    if (!isConnected || !myId) return;

    const onIncoming = ({ from, channelName, callerName }: { from?: string; channelName?: string; callerName?: string }) => {
      if (!from || !channelName) return;
      if (String(from) === String(myId)) return;
      const stoppedAt = recentlyStoppedRef.current.get(String(channelName));
      if (stoppedAt && Date.now() - stoppedAt < 8000) return;
      startSession({
        to: from,
        channelName,
        friendName: callerName,
        sessionRole: 'receiver',
        notifyPeer: false,
      });
    };

    const onPeerStop = ({ from, channelName }: { from?: string; channelName?: string }) => {
      if (from && String(from) === String(myId)) return;
      if (channelName) {
        recentlyStoppedRef.current.set(String(channelName), Date.now());
      }
      if (
        channelName &&
        channelRef.current &&
        String(channelName) !== String(channelRef.current)
      ) {
        return;
      }
      if (
        from &&
        peerIdRef.current &&
        String(from) !== String(peerIdRef.current) &&
        !channelName
      ) {
        return;
      }
      if (!isActiveRef.current && !isJoiningRef.current && !channelRef.current) {
        return;
      }
      stopSession(false);
    };

    on('live-voice-start', onIncoming);
    on('live-voice-stop', onPeerStop);

    return () => {
      off('live-voice-start', onIncoming);
      off('live-voice-stop', onPeerStop);
    };
  }, [isConnected, myId, on, off, startSession, stopSession]);

  useEffect(() => {
    const onOutgoing = (detail: LiveVoiceStartDetail) => {
      const { to, channelName, friendName: name } = detail || {};
      if (!to || !channelName) return;
      startSession({
        to,
        channelName,
        friendName: name,
        sessionRole: 'sender',
        notifyPeer: true,
      });
    };
    const onStopRequest = () => {
      stopSession(true);
    };

    const startSub = DeviceEventEmitter.addListener(LIVE_VOICE_EVENTS.START, onOutgoing);
    const stopSub = DeviceEventEmitter.addListener(LIVE_VOICE_EVENTS.STOP, onStopRequest);
    return () => {
      startSub.remove();
      stopSub.remove();
    };
  }, [startSession, stopSession]);

  useEffect(() => {
    return () => {
      stopSessionRef.current(false);
    };
  }, []);

  return (
    <>
      <AgoraWebEngine
        ref={engineRef}
        visible={mediaActive}
        isAudio
        onEvent={onEngineEvent}
      />
      {isOpen ? (
        <LiveVoiceModal
          isOpen
          onClose={() => { void stopSession(true); }}
          isActive={isActive}
          duration={duration}
          isConnecting={isConnecting}
          role={role}
          friendName={friendName}
          connectionQuality={connectionQuality}
          onStop={() => { void stopSession(true); }}
        />
      ) : null}
    </>
  );
};

export default LiveVoice;
