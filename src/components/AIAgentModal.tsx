import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { AuthContext } from '../contexts/AuthContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useChessGame } from '../contexts/ChessGameContext';
import useComposerLiveTranscribe from '../hooks/useComposerLiveTranscribe';
import {
  clearAgentChat,
  fetchLatestAgentChat,
  saveAgentChat,
  streamAgentReply,
} from '../services/aiAgentService';
import {
  createMobileAgentActionAdapter,
  executeAgentActions,
  parseAgentIntent,
} from '../services/agentActionCatalog';
import { AgentSpeechLanguage, createAgentSpeechController } from '../services/agentSpeechService';
import { AgentMessage } from '../types/aiAgent';

interface Props { visible: boolean; onClose: () => void; }
const id = () => `${Date.now()}-${Math.random()}`;
const welcome = (): AgentMessage => ({
  id: id(), type: 'agent', timestamp: new Date().toISOString(),
  content: 'Hi! I am Connect AI Agent. Ask me to search, navigate, or help with Connect.',
});

const AIAgentModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { logout } = React.useContext(AuthContext);
  const { setLudoGameActive } = useLudoGame();
  const { setChessGameActive } = useChessGame();
  const [messages, setMessages] = React.useState<AgentMessage[]>([welcome()]);
  const [input, setInput] = React.useState('');
  const [interimInput, setInterimInput] = React.useState('');
  const [language, setLanguage] = React.useState<AgentSpeechLanguage>('auto');
  const [loading, setLoading] = React.useState(false);
  const speechControllerRef = React.useRef<ReturnType<typeof createAgentSpeechController> | null>(null);
  const requestRef = React.useRef<AbortController | null>(null);
  const generationRef = React.useRef(0);
  const listRef = React.useRef<FlatList<AgentMessage>>(null);
  const clearChat = React.useCallback(async () => {
    await clearAgentChat();
    setMessages([welcome()]);
  }, []);
  const transcribe = useComposerLiveTranscribe({
    onFinal: text => {
      setInput(text);
      setInterimInput('');
    },
    onInterim: setInterimInput,
  });

  React.useEffect(() => {
    if (!visible) return;
    let active = true;
    fetchLatestAgentChat().then(data => {
      if (active && Array.isArray(data?.messages) && data.messages.length) setMessages(data.messages);
    }).catch(error => console.warn('Failed to load AI chat', error));
    return () => { active = false; };
  }, [visible]);

  React.useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setTimeout(() => saveAgentChat(messages).catch(error => console.warn('Failed to save AI chat', error)), 1200);
    return () => clearTimeout(timer);
  }, [messages]);

  React.useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  React.useEffect(() => {
    if (visible) return undefined;
    transcribe.stop({ discard: true }).catch(() => {});
    speechControllerRef.current?.stop().catch(() => {});
    return undefined;
  }, [transcribe.stop, visible]);

  const close = () => {
    generationRef.current += 1;
    requestRef.current?.abort();
    transcribe.stop({ discard: true }).catch(() => {});
    speechControllerRef.current?.stop().catch(() => {});
    setLoading(false);
    onClose();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    transcribe.stop({ discard: true }).catch(() => {});
    setInterimInput('');
    const user: AgentMessage = { id: id(), type: 'user', content: text, timestamp: new Date().toISOString() };
    const stream: AgentMessage = { id: id(), type: 'agent', content: '', timestamp: new Date().toISOString(), streaming: true };
    const generation = ++generationRef.current;
    setInput('');
    setMessages(previous => [...previous, user, stream]);
    setLoading(true);
    const controller = new AbortController();
    const speechController = createAgentSpeechController(language);
    await speechControllerRef.current?.stop().catch(() => {});
    speechControllerRef.current = speechController;
    requestRef.current = controller;
    try {
      const rawReply = await streamAgentReply(text, [...messages, user], next => {
        if (generation !== generationRef.current) return;
        setMessages(previous => previous.map(item => item.id === stream.id ? { ...item, content: next } : item));
        // Do not read machine-readable JSON while it is streaming; read the
        // user-facing reply after the intent has been validated below.
        if (!next.trimStart().startsWith('{')) speechController.update(next, language);
      }, controller.signal);
      if (generation !== generationRef.current) return;

      const parsed = parseAgentIntent(rawReply);
      if (parsed.ok) {
        const intent = parsed.intent;
        const visibleReply = intent.reply || intent.ask?.question || (intent.actions?.length ? 'ঠিক আছে, কাজটি করছি।' : '');
        if (visibleReply) {
          setMessages(previous => previous.map(item => item.id === stream.id ? { ...item, content: visibleReply } : item));
          if (rawReply.trimStart().startsWith('{')) speechController.update(visibleReply, language);
        }
        const adapter = createMobileAgentActionAdapter({
          startLudo: () => setLudoGameActive(true),
          startChess: () => setChessGameActive(true),
          startVoiceInput: async () => { await transcribe.start(language === 'auto' ? undefined : language); },
          stopVoiceInput: async () => { await transcribe.stop(); },
          speakText: value => {
            const reader = createAgentSpeechController(language);
            reader.update(value, language);
            reader.finish();
            speechControllerRef.current = reader;
          },
          stopSpeaking: () => speechControllerRef.current?.stop(),
          logout,
          clearAgentChat: clearChat,
        });
        const results = await executeAgentActions(intent.actions, adapter, {
          confirm: definition => new Promise<boolean>(resolve => {
            Alert.alert('Confirm action', `Allow the agent to ${definition.label.toLowerCase()}?`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Allow', style: 'destructive', onPress: () => resolve(true) },
            ]);
          }),
        });
        const failed = results.filter(result => !result.ok);
        if (failed.length) {
          const summary = failed.map(result => result.message).join(' ');
          setMessages(previous => previous.map(item => item.id === stream.id ? {
            ...item,
            content: `${visibleReply}${visibleReply ? '\n' : ''}${summary}`,
          } : item));
        }
      } else if ('unsupportedActions' in parsed && parsed.unsupportedActions?.length) {
        setMessages(previous => previous.map(item => item.id === stream.id ? {
          ...item,
          content: 'দুঃখিত, এই কাজটি এই Expo অ্যাপে সমর্থিত নয়।',
        } : item));
      }
      speechController.finish();
      setMessages(previous => previous.map(item => item.id === stream.id ? { ...item, streaming: false } : item));
    } catch (error: any) {
      if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') {
        setMessages(previous => previous.map(item => item.id === stream.id ? { ...item, content: error?.message || 'Sorry, the AI Agent is unavailable.', streaming: false } : item));
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  };

  const clear = () => Alert.alert('Clear AI chat?', 'Saved AI chat history will be deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: async () => {
      try {
        await clearChat();
      } catch (error) {
        console.warn('Failed to clear AI chat', error);
      }
    }},
  ]);
  const toggleVoice = async () => {
    if (transcribe.listening) {
      await transcribe.stop();
      return;
    }
    const started = await transcribe.start(language === 'auto' ? undefined : language);
    if (!started) {
      Alert.alert('Microphone unavailable', 'Allow microphone access and try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.header, { borderBottomColor: colors.border.primary }]}>
            <Icon name="psychology" size={28} color={colors.primary} />
            <View style={styles.title}><Text style={[styles.heading, { color: colors.text.primary }]}>AI Agent</Text><Text style={{ color: colors.text.secondary }}>Ready to help</Text></View>
            <Pressable
              onPress={() => setLanguage(current => current === 'auto' ? 'bn-BD' : current === 'bn-BD' ? 'en-US' : 'auto')}
              accessibilityLabel={`Speech language: ${language === 'bn-BD' ? 'Bangla' : language === 'en-US' ? 'English' : 'Auto'}`}
            >
              <Text style={[styles.language, { color: colors.primary }]}>{language === 'bn-BD' ? 'বাংলা' : language === 'en-US' ? 'EN' : 'Auto'}</Text>
            </Pressable>
            <Pressable onPress={clear} accessibilityLabel="Clear AI chat"><Icon name="delete-outline" size={22} color={colors.text.secondary} /></Pressable>
            <Pressable onPress={close} accessibilityLabel="Close AI Agent"><Icon name="close" size={26} color={colors.text.primary} /></Pressable>
          </View>
          <FlatList ref={listRef} style={styles.flex} contentContainerStyle={styles.messages} data={messages} keyExtractor={item => item.id} renderItem={({ item }) => (
            <View style={[styles.row, item.type === 'user' && styles.userRow]}>
              <View style={[styles.bubble, { backgroundColor: item.type === 'user' ? colors.primary : colors.surface.secondary }]}>
                <Text style={{ color: item.type === 'user' ? '#fff' : colors.text.primary }}>{item.content || ' '}</Text>
              </View>
            </View>
          )} ListEmptyComponent={<Text style={{ color: colors.text.secondary }}>Ask the AI Agent anything about Connect.</Text>} />
          {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
          {interimInput ? <Text style={[styles.interim, { color: colors.text.secondary }]}>{interimInput}</Text> : null}
          <View style={[styles.composer, { borderTopColor: colors.border.primary }]}>
            <Pressable
              onPress={toggleVoice}
              disabled={loading || !transcribe.supported}
              accessibilityLabel={transcribe.listening ? 'Stop voice input' : 'Start voice input'}
            >
              <Icon name={transcribe.listening ? 'mic' : 'mic-none'} size={24} color={transcribe.listening ? colors.status.error : colors.text.secondary} />
            </Pressable>
            <TextInput value={input} onChangeText={setInput} multiline placeholder="Ask the AI Agent..." placeholderTextColor={colors.text.tertiary} style={[styles.input, { color: colors.text.primary, backgroundColor: colors.surface.secondary }]} editable={!loading} onSubmitEditing={send} />
            <Pressable onPress={send} disabled={!input.trim() || loading} style={[styles.send, { backgroundColor: colors.primary, opacity: input.trim() && !loading ? 1 : .45 }]}><Icon name="send" size={20} color="#fff" /></Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1 }, flex: { flex: 1 }, header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth }, title: { flex: 1 }, heading: { fontSize: 20, fontWeight: '700' }, language: { fontSize: 12, fontWeight: '700' }, messages: { padding: 16, gap: 10 }, row: { flexDirection: 'row' }, userRow: { justifyContent: 'flex-end' }, bubble: { maxWidth: '82%', borderRadius: 16, padding: 12 }, loader: { margin: 8 }, interim: { paddingHorizontal: 18, paddingBottom: 4, fontStyle: 'italic' }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth }, input: { flex: 1, maxHeight: 110, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 }, send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
export default AIAgentModal;
