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
import {
  clearAgentChat,
  fetchLatestAgentChat,
  saveAgentChat,
  streamAgentReply,
} from '../services/aiAgentService';
import { AgentMessage } from '../types/aiAgent';

interface Props { visible: boolean; onClose: () => void; }
const id = () => `${Date.now()}-${Math.random()}`;
const welcome = (): AgentMessage => ({
  id: id(), type: 'agent', timestamp: new Date().toISOString(),
  content: 'Hi! I am Connect AI Agent. Ask me to search, navigate, or help with Connect.',
});

const AIAgentModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const [messages, setMessages] = React.useState<AgentMessage[]>([welcome()]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const requestRef = React.useRef<AbortController | null>(null);
  const generationRef = React.useRef(0);
  const listRef = React.useRef<FlatList<AgentMessage>>(null);

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

  const close = () => {
    generationRef.current += 1;
    requestRef.current?.abort();
    setLoading(false);
    onClose();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const user: AgentMessage = { id: id(), type: 'user', content: text, timestamp: new Date().toISOString() };
    const stream: AgentMessage = { id: id(), type: 'agent', content: '', timestamp: new Date().toISOString(), streaming: true };
    const generation = ++generationRef.current;
    setInput('');
    setMessages(previous => [...previous, user, stream]);
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      await streamAgentReply(text, [...messages, user], next => {
        if (generation !== generationRef.current) return;
        setMessages(previous => previous.map(item => item.id === stream.id ? { ...item, content: next } : item));
      }, controller.signal);
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
        await clearAgentChat();
        setMessages([welcome()]);
      } catch (error) {
        console.warn('Failed to clear AI chat', error);
      }
    }},
  ]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.header, { borderBottomColor: colors.border.primary }]}>
            <Icon name="psychology" size={28} color={colors.primary} />
            <View style={styles.title}><Text style={[styles.heading, { color: colors.text.primary }]}>AI Agent</Text><Text style={{ color: colors.text.secondary }}>Ready to help</Text></View>
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
          <View style={[styles.composer, { borderTopColor: colors.border.primary }]}>
            <TextInput value={input} onChangeText={setInput} multiline placeholder="Ask the AI Agent..." placeholderTextColor={colors.text.tertiary} style={[styles.input, { color: colors.text.primary, backgroundColor: colors.surface.secondary }]} editable={!loading} onSubmitEditing={send} />
            <Pressable onPress={send} disabled={!input.trim() || loading} style={[styles.send, { backgroundColor: colors.primary, opacity: input.trim() && !loading ? 1 : .45 }]}><Icon name="send" size={20} color="#fff" /></Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1 }, flex: { flex: 1 }, header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth }, title: { flex: 1 }, heading: { fontSize: 20, fontWeight: '700' }, messages: { padding: 16, gap: 10 }, row: { flexDirection: 'row' }, userRow: { justifyContent: 'flex-end' }, bubble: { maxWidth: '82%', borderRadius: 16, padding: 12 }, loader: { margin: 8 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth }, input: { flex: 1, maxHeight: 110, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 }, send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
export default AIAgentModal;
