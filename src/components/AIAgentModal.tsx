import React from 'react';
import {
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
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import { AuthContext } from '../contexts/AuthContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useChessGame } from '../contexts/ChessGameContext';
import { useSocket } from '../contexts/SocketContext';
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
import {
  AgentSpeechLanguage,
  createAgentSpeechController,
} from '../services/agentSpeechService';
import { AgentMessage } from '../types/aiAgent';
import { AgentActionIntent } from '../services/agentActionCatalog';
import { RootState } from '../store';
import { friendAPI } from '../lib/api';
import { emitStartAudioCall, emitStartVideoCall } from '../lib/callEvents';

interface Props {
  visible: boolean;
  onClose: () => void;
}
const id = () => `${Date.now()}-${Math.random()}`;
const welcome = (): AgentMessage => ({
  id: id(),
  type: 'agent',
  timestamp: new Date().toISOString(),
  content:
    'Hi! I am Connect AI Agent. Ask me to search, navigate, or help with Connect.',
});

const AIAgentModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { logout, user } = React.useContext(AuthContext);
  const profile = useSelector((state: RootState) => state.profile);
  const profileContext = React.useMemo(
    () => ({
      ...(user?.profile && typeof user.profile === 'object'
        ? user.profile
        : {}),
      ...(profile && typeof profile === 'object' ? profile : {}),
    }),
    [profile, user?.profile],
  );
  const { setLudoGameActive } = useLudoGame();
  const { setChessGameActive } = useChessGame();
  const { startAudioCall, startVideoCall } = useSocket();
  const [messages, setMessages] = React.useState<AgentMessage[]>([welcome()]);
  const [input, setInput] = React.useState('');
  const [interimInput, setInterimInput] = React.useState('');
  const [language, setLanguage] = React.useState<AgentSpeechLanguage>('auto');
  const [loading, setLoading] = React.useState(false);
  const [autoMode, setAutoMode] = React.useState(true);
  const [pendingActions, setPendingActions] = React.useState<
    AgentActionIntent[]
  >([]);
  const [voiceConversation, setVoiceConversation] = React.useState(false);
  const sendRef = React.useRef<() => void>(() => {});
  const speechControllerRef = React.useRef<ReturnType<
    typeof createAgentSpeechController
  > | null>(null);
  const requestRef = React.useRef<AbortController | null>(null);
  const generationRef = React.useRef(0);
  const listRef = React.useRef<FlatList<AgentMessage>>(null);
  const clearChat = React.useCallback(async () => {
    await clearAgentChat();
    setMessages([welcome()]);
  }, []);
  const resolveUser = React.useCallback(async (query: string) => {
    const profileId = String((profile as Record<string, unknown> | null)?._id || '');
    if (!profileId) return null;
    const response = await friendAPI.getFriendList(profileId);
    const data: unknown = response.data;
    const dataRecord = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const friends = Array.isArray(data)
      ? data
      : (Array.isArray(dataRecord.friends)
        ? dataRecord.friends
        : (Array.isArray(dataRecord.data) ? dataRecord.data : []));
    const needle = query.trim().toLowerCase();
    const matches = friends.filter((friend: Record<string, unknown>) => {
      const fields = [friend.fullName, friend.username, friend.email, friend.name]
        .filter(value => typeof value === 'string')
        .map(value => String(value).toLowerCase());
      return fields.some(value => value === needle || value.includes(needle));
    });
    if (matches.length !== 1) return null;
    const match = matches[0] as Record<string, unknown>;
    if (!match?._id) return null;
    return { id: String(match._id), name: String(match.fullName || match.username || query) };
  }, [profile]);

  const callAdapter = React.useMemo(() => ({
    resolveUser,
    startAudioCall: async (userId: string, channelName: string, userName?: string) => {
      const ownId = String((profile as Record<string, unknown> | null)?._id || '');
      const effectiveChannel = channelName === userId && ownId ? `${ownId}-${userId}` : channelName;
      emitStartAudioCall({ to: userId, channelName: effectiveChannel, callerName: userName });
      startAudioCall(userId, effectiveChannel);
    },
    startVideoCall: async (userId: string, channelName: string, userName?: string) => {
      const ownId = String((profile as Record<string, unknown> | null)?._id || '');
      const effectiveChannel = channelName === userId && ownId ? `${ownId}-${userId}` : channelName;
      emitStartVideoCall({ to: userId, channelName: effectiveChannel, callerName: userName });
      startVideoCall(userId, effectiveChannel);
    },
  }), [profile, resolveUser, startAudioCall, startVideoCall]);
  const transcribe = useComposerLiveTranscribe({
    onFinal: text => {
      setInput(text);
      setInterimInput('');
      if (voiceConversation) setTimeout(() => sendRef.current(), 0);
    },
    onInterim: setInterimInput,
  });

  React.useEffect(() => {
    if (!visible) return;
    let active = true;
    fetchLatestAgentChat()
      .then(data => {
        if (active && Array.isArray(data?.messages) && data.messages.length)
          setMessages(data.messages);
      })
      .catch(error => console.warn('Failed to load AI chat', error));
    return () => {
      active = false;
    };
  }, [visible]);

  React.useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setTimeout(
      () =>
        saveAgentChat(messages).catch(error =>
          console.warn('Failed to save AI chat', error),
        ),
      1200,
    );
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
    const user: AgentMessage = {
      id: id(),
      type: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const stream: AgentMessage = {
      id: id(),
      type: 'agent',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    };
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
      const rawReply = await streamAgentReply(
        text,
        [...messages, user],
        next => {
          if (generation !== generationRef.current) return;
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id ? { ...item, content: next } : item,
            ),
          );
          // Do not read machine-readable JSON while it is streaming; read the
          // user-facing reply after the intent has been validated below.
          if (!next.trimStart().startsWith('{'))
            speechController.update(next, language);
        },
        controller.signal,
        profileContext,
      );
      if (generation !== generationRef.current) return;

      const parsed = parseAgentIntent(rawReply);
      if (parsed.ok) {
        const intent = parsed.intent;
        const visibleReply =
          intent.reply ||
          intent.ask?.question ||
          (intent.actions?.length ? 'ঠিক আছে, কাজটি করছি।' : '');
        if (visibleReply) {
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id ? { ...item, content: visibleReply } : item,
            ),
          );
          if (rawReply.trimStart().startsWith('{'))
            speechController.update(visibleReply, language);
        }
        const adapter = createMobileAgentActionAdapter({
          ...callAdapter,
          startLudo: () => setLudoGameActive(true),
          startChess: () => setChessGameActive(true),
          startVoiceInput: async () => {
            await transcribe.start(language === 'auto' ? undefined : language);
          },
          stopVoiceInput: async () => {
            await transcribe.stop();
          },
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
        if (!autoMode && intent.actions?.length) {
          setPendingActions(intent.actions);
          speechController.finish();
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id
                ? {
                    ...item,
                    content: `${visibleReply}${
                      visibleReply ? '\n' : ''
                    }Review the suggested actions below.`,
                    streaming: false,
                  }
                : item,
            ),
          );
          return;
        }
        const results = await executeAgentActions(intent.actions, adapter, {
          confirm: definition =>
            new Promise<boolean>(resolve => {
              Alert.alert(
                'Confirm action',
                `Allow the agent to ${definition.label.toLowerCase()}?`,
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => resolve(false),
                  },
                  {
                    text: 'Allow',
                    style: 'destructive',
                    onPress: () => resolve(true),
                  },
                ],
              );
            }),
        });
        const failed = results.filter(result => !result.ok);
        if (failed.length) {
          const summary = failed.map(result => result.message).join(' ');
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id
                ? {
                    ...item,
                    content: `${visibleReply}${
                      visibleReply ? '\n' : ''
                    }${summary}`,
                  }
                : item,
            ),
          );
        }
      } else if (
        'unsupportedActions' in parsed &&
        parsed.unsupportedActions?.length
      ) {
        setMessages(previous =>
          previous.map(item =>
            item.id === stream.id
              ? {
                  ...item,
                  content: 'দুঃখিত, এই কাজটি এই Expo অ্যাপে সমর্থিত নয়।',
                }
              : item,
          ),
        );
      }
      speechController.finish();
      setMessages(previous =>
        previous.map(item =>
          item.id === stream.id ? { ...item, streaming: false } : item,
        ),
      );
    } catch (error: any) {
      if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') {
        setMessages(previous =>
          previous.map(item =>
            item.id === stream.id
              ? {
                  ...item,
                  content:
                    error?.message || 'Sorry, the AI Agent is unavailable.',
                  streaming: false,
                }
              : item,
          ),
        );
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
      if (voiceConversation && generation === generationRef.current) {
        const started = await transcribe.start(
          language === 'auto' ? undefined : language,
        );
        if (!started) setVoiceConversation(false);
      }
    }
  };
  sendRef.current = send;

  const clear = () =>
    Alert.alert('Clear AI chat?', 'Saved AI chat history will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearChat();
          } catch (error) {
            console.warn('Failed to clear AI chat', error);
          }
        },
      },
    ]);
  const toggleVoice = async () => {
    if (transcribe.listening) {
      setVoiceConversation(false);
      await transcribe.stop();
      return;
    }
    setVoiceConversation(true);
    const started = await transcribe.start(
      language === 'auto' ? undefined : language,
    );
    if (!started) {
      setVoiceConversation(false);
      Alert.alert(
        'Microphone unavailable',
        'Allow microphone access and try again.',
      );
    }
  };
  const quickPrompts = [
    'Open my profile',
    'Show my messages',
    'Start a Ludo game',
  ];
  const renderMessage = ({ item }: { item: AgentMessage }) => {
    const isUser = item.type === 'user';
    const isAction = item.type === 'action-result';
    return (
      <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
        {!isUser && (
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: isAction
                  ? colors.status.success
                  : colors.primary,
              },
            ]}
          >
            <Icon
              name={isAction ? 'check' : 'psychology'}
              size={15}
              color="#fff"
            />
          </View>
        )}
        <View style={styles.messageColumn}>
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isUser
                  ? colors.primary
                  : colors.surface.secondary,
                borderColor: isAction
                  ? colors.status.success
                  : colors.border.primary,
              },
              isUser ? styles.userBubble : styles.agentBubble,
            ]}
          >
            {item.streaming && !item.content ? (
              <View style={styles.typingDots}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colors.text.secondary },
                  ]}
                />
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colors.text.secondary },
                  ]}
                />
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colors.text.secondary },
                  ]}
                />
              </View>
            ) : (
              <Text
                style={[
                  styles.messageText,
                  { color: isUser ? '#fff' : colors.text.primary },
                ]}
              >
                {item.content || ' '}
              </Text>
            )}
          </View>
          <Text style={[styles.time, { color: colors.text.tertiary }]}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };
  const runPendingAction = async (action: AgentActionIntent) => {
    const adapter = createMobileAgentActionAdapter({
      ...callAdapter,
      startLudo: () => setLudoGameActive(true),
      startChess: () => setChessGameActive(true),
      logout,
      clearAgentChat: clearChat,
    });
    const results = await executeAgentActions([action], adapter, {
      confirm: definition =>
        new Promise<boolean>(resolve => {
          Alert.alert(
            'Confirm action',
            `Allow the agent to ${definition.label.toLowerCase()}?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Allow',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ],
          );
        }),
    });
    const result = results[0];
    setPendingActions(previous => previous.filter(item => item !== action));
    setMessages(previous => [
      ...previous,
      {
        id: id(),
        type: 'action-result',
        content: result?.message || 'Action completed.',
        timestamp: new Date().toISOString(),
        success: result?.ok,
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface.primary,
                borderBottomColor: colors.border.primary,
              },
            ]}
          >
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: `${colors.primary}20` },
              ]}
            >
              <Icon name="psychology" size={26} color={colors.primary} />
            </View>
            <View style={styles.title}>
              <Text style={[styles.heading, { color: colors.text.primary }]}>
                Connect AI
              </Text>
              <View style={styles.statusLine}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: colors.status.success },
                  ]}
                />
                <Text
                  style={[styles.statusText, { color: colors.text.secondary }]}
                >
                  {loading ? 'Thinking...' : 'Ready to help'}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.headerButton}
              onPress={() =>
                setLanguage(current =>
                  current === 'auto'
                    ? 'bn-BD'
                    : current === 'bn-BD'
                    ? 'en-US'
                    : 'auto',
                )
              }
              accessibilityLabel={`Speech language: ${
                language === 'bn-BD'
                  ? 'Bangla'
                  : language === 'en-US'
                  ? 'English'
                  : 'Auto'
              }`}
            >
              <Text style={[styles.language, { color: colors.primary }]}>
                {language === 'bn-BD'
                  ? 'বাংলা'
                  : language === 'en-US'
                  ? 'EN'
                  : 'Auto'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={clear}
              accessibilityLabel="Clear AI chat"
            >
              <Icon
                name="delete-outline"
                size={21}
                color={colors.text.secondary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.modeButton,
                {
                  backgroundColor: autoMode
                    ? `${colors.primary}18`
                    : colors.surface.secondary,
                },
              ]}
              onPress={() => setAutoMode(value => !value)}
              accessibilityLabel={`Auto mode ${autoMode ? 'on' : 'off'}`}
            >
              <Icon
                name={autoMode ? 'bolt' : 'touch-app'}
                size={15}
                color={autoMode ? colors.primary : colors.text.secondary}
              />
              <Text
                style={[
                  styles.modeText,
                  { color: autoMode ? colors.primary : colors.text.secondary },
                ]}
              >
                {autoMode ? 'Auto' : 'Manual'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={close}
              accessibilityLabel="Close AI Agent"
            >
              <Icon name="close" size={25} color={colors.text.primary} />
            </Pressable>
          </View>
          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              messages.length === 1 ? (
                <View style={styles.quickPromptWrap}>
                  <Text
                    style={[
                      styles.quickPromptLabel,
                      { color: colors.text.secondary },
                    ]}
                  >
                    Try asking
                  </Text>
                  <View style={styles.quickPrompts}>
                    {quickPrompts.map(prompt => (
                      <Pressable
                        key={prompt}
                        onPress={() => setInput(prompt)}
                        style={[
                          styles.quickPrompt,
                          {
                            borderColor: colors.border.primary,
                            backgroundColor: colors.surface.secondary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickPromptText,
                            { color: colors.text.primary },
                          ]}
                        >
                          {prompt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={{ color: colors.text.secondary }}>
                Ask the AI Agent anything about Connect.
              </Text>
            }
          />
          {pendingActions.length > 0 && (
            <View
              style={[
                styles.actionTray,
                {
                  backgroundColor: colors.surface.primary,
                  borderTopColor: colors.border.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionTrayTitle,
                  { color: colors.text.secondary },
                ]}
              >
                Suggested actions
              </Text>
              {pendingActions.map(action => (
                <Pressable
                  key={`${action.id || action.action}-${
                    action.targetName || ''
                  }`}
                  onPress={() => runPendingAction(action)}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.surface.secondary,
                      borderColor: colors.border.primary,
                    },
                  ]}
                >
                  <Icon name="play-arrow" size={18} color={colors.primary} />
                  <View style={styles.actionCardBody}>
                    <Text
                      style={[
                        styles.actionCardTitle,
                        { color: colors.text.primary },
                      ]}
                    >
                      {action.type || action.action}
                    </Text>
                    <Text
                      style={[
                        styles.actionCardSubtitle,
                        { color: colors.text.secondary },
                      ]}
                    >
                      {action.targetName ||
                        action.messageText ||
                        'Run this action'}
                    </Text>
                  </View>
                  <Text style={[styles.runText, { color: colors.primary }]}>
                    Run
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {interimInput ? (
            <Text style={[styles.interim, { color: colors.text.secondary }]}>
              {interimInput}
            </Text>
          ) : null}
          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.surface.primary,
                borderTopColor: colors.border.primary,
              },
            ]}
          >
            <Pressable
              style={[
                styles.iconButton,
                {
                  backgroundColor: transcribe.listening
                    ? `${colors.status.error}18`
                    : colors.surface.secondary,
                },
              ]}
              onPress={toggleVoice}
              disabled={loading || !transcribe.supported}
              accessibilityLabel={
                transcribe.listening ? 'Stop voice input' : 'Start voice input'
              }
            >
              <Icon
                name={transcribe.listening ? 'mic' : 'mic-none'}
                size={24}
                color={
                  transcribe.listening
                    ? colors.status.error
                    : colors.text.secondary
                }
              />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              multiline
              placeholder="Message Connect AI..."
              placeholderTextColor={colors.text.tertiary}
              style={[
                styles.input,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.surface.secondary,
                  borderColor: colors.border.primary,
                },
              ]}
              editable={!loading}
              onSubmitEditing={send}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={send}
              disabled={!input.trim() || loading}
              style={[
                styles.send,
                {
                  backgroundColor: colors.primary,
                  opacity: input.trim() && !loading ? 1 : 0.45,
                },
              ]}
            >
              <Icon name="arrow-upward" size={21} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
  heading: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2 },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },
  headerButton: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButton: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeText: { fontSize: 11, fontWeight: '700' },
  language: { fontSize: 11, fontWeight: '700' },
  messages: { padding: 16, paddingBottom: 20, gap: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userMessageRow: { justifyContent: 'flex-end' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageColumn: { maxWidth: '84%' },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 5 },
  agentBubble: { borderRadius: 18, borderBottomLeftRadius: 5 },
  messageText: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 10, marginTop: 4, marginHorizontal: 4 },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  quickPromptWrap: { marginTop: 18 },
  quickPromptLabel: { fontSize: 12, marginBottom: 9, fontWeight: '600' },
  quickPrompts: { gap: 8 },
  quickPrompt: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  quickPromptText: { fontSize: 13 },
  actionTray: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionTrayTitle: { fontSize: 12, fontWeight: '600', marginBottom: 7 },
  actionCard: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 7,
  },
  actionCardBody: { flex: 1 },
  actionCardTitle: { fontSize: 13, fontWeight: '700' },
  actionCardSubtitle: { fontSize: 11, marginTop: 2 },
  runText: { fontSize: 12, fontWeight: '700' },
  interim: {
    paddingHorizontal: 18,
    paddingBottom: 6,
    fontStyle: 'italic',
    fontSize: 12,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
export default AIAgentModal;
