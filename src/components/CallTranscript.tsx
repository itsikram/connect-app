import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useComposerLiveTranscribe from '../hooks/useComposerLiveTranscribe';
import { useSocket } from '../contexts/SocketContext';

type CallTranscriptProps = {
  enabled: boolean;
  channelName?: string | null;
  peerId?: string | null;
  myId: string;
};

type TranscriptLine = {
  id: string;
  senderId: string;
  text: string;
  final: boolean;
};

const MAX_LINES = 8;

const CallTranscript: React.FC<CallTranscriptProps> = ({ enabled, channelName, peerId, myId }) => {
  const { on, off, emit } = useSocket();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const sequenceRef = useRef(0);

  const addLine = (senderId: string, text: string, final: boolean) => {
    const value = String(text || '').trim();
    if (!value) return;
    setLines(previous => {
      const next = [...previous];
      if (!final && senderId === myId && next[next.length - 1]?.senderId === myId && !next[next.length - 1].final) {
        next[next.length - 1] = { ...next[next.length - 1], text: value };
      } else {
        next.push({ id: `${Date.now()}-${sequenceRef.current++}`, senderId, text: value, final });
      }
      return next.slice(-MAX_LINES);
    });
  };

  const transcribe = useComposerLiveTranscribe({
    preserveAudioSession: true,
    // Agora runs inside a WebView and owns the native microphone session.
    // A second Expo recorder cannot safely capture the same call microphone.
    captureEnabled: Platform.OS !== 'ios',
    onFinal: text => {
      addLine(myId, text, true);
      emit('call-transcript', { to: peerId, channelName, text, isFinal: true });
      setInterim('');
    },
    onInterim: text => {
      setInterim(text);
      emit('call-transcript', { to: peerId, channelName, text, isFinal: false });
    },
  });

  useEffect(() => {
    if (!enabled || !channelName) return;
    const onTranscript = (payload: any) => {
      if (String(payload?.channelName || '') !== String(channelName) || String(payload?.senderId || '') === String(myId)) return;
      addLine(String(payload.senderId), payload.text, Boolean(payload.isFinal));
    };
    on('call-transcript', onTranscript);
    return () => off('call-transcript', onTranscript);
  }, [channelName, enabled, myId, on, off]);

  useEffect(() => {
    setLines([]);
    setInterim('');
    transcribe.stop({ discard: true });
  }, [channelName]);

  if (!enabled || !channelName) return null;

  const toggle = async () => {
    if (transcribe.listening) {
      await transcribe.stop();
      setInterim('');
      return;
    }
    await transcribe.start('auto');
  };

  return (
    <View style={styles.container}>
      {lines.length > 0 || interim ? (
        <View style={styles.panel}>
          {lines.map(line => (
            <Text key={line.id} style={styles.line}>
              <Text style={styles.sender}>{line.senderId === myId ? 'You: ' : 'Friend: '}</Text>
              {line.text}
            </Text>
          ))}
          {interim ? <Text style={styles.interim}>You: {interim}</Text> : null}
        </View>
      ) : null}
      <TouchableOpacity
        disabled={Platform.OS === 'ios'}
        style={[styles.button, transcribe.listening && styles.active, Platform.OS === 'ios' && styles.disabled]}
        onPress={toggle}
      >
        <Icon name={transcribe.listening ? 'closed-caption' : 'closed-caption-disabled'} size={18} color="#fff" />
        <Text style={styles.buttonText}>
          {Platform.OS === 'ios' ? 'Captions unavailable during call' : transcribe.listening ? 'Captions on' : 'Live captions'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%', gap: 8 },
  panel: { width: '92%', maxHeight: 150, padding: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.72)' },
  line: { color: '#fff', fontSize: 13, marginBottom: 3 },
  interim: { color: '#b9f2ee', fontSize: 13, fontStyle: 'italic' },
  sender: { fontWeight: '700' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)' },
  active: { backgroundColor: '#168f88' },
  disabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export default CallTranscript;
