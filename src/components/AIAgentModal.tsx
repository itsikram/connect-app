import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import Modal from './SystemBarsModal';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { AuthContext } from '../contexts/AuthContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useChessGame } from '../contexts/ChessGameContext';
import { useSocket } from '../contexts/SocketContext';
import useComposerLiveTranscribe, {
  mergeTranscriptText,
  restoreChatPlaybackAudioMode,
} from '../hooks/useComposerLiveTranscribe';
import {
  clearAgentChat,
  fetchAIProviderStatus,
  fetchLatestAgentChat,
  saveAgentChat,
  streamAgentReply,
  AIProvider,
  AIProviderStatus,
} from '../services/aiAgentService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AgentActionDefinition,
  AgentActionResult,
  createMobileAgentActionAdapter,
  executeAgentActions,
  getAgentActionLabel,
  parseAgentIntent,
} from '../services/agentActionCatalog';
import { Audio } from '../lib/avCompat';
import { isCallBusy } from '../lib/callSession';
import {
  AgentSpeechLanguage,
  createAgentSpeechController,
  detectAgentSpeechLanguage,
} from '../services/agentSpeechService';
import { AgentMessage } from '../types/aiAgent';
import {
  isAgentSpeaking,
  isLikelyAgentEcho,
  onAgentSpeakingChange,
  waitForAgentSilence,
} from '../services/agentEcho';
import { findRelation, matchRelationConnects } from '../services/agentRelations';
import { AgentActionIntent } from '../services/agentActionCatalog';
import { RootState } from '../store';
import api, { connectAPI, profileAPI, userAPI } from '../lib/api';
import { emitStartAudioCall, emitStartVideoCall } from '../lib/callEvents';
import { navigate as navigateWithQueue } from '../lib/navigationService';
import { extractYouTubeVideoId, toWatchUrl } from '../lib/ytDownload';
import { startBackgroundYoutubeDownload } from '../lib/ytDownloadManager';

interface Props {
  visible: boolean;
  onClose: () => void;
  autoStartVoiceLanguage?: AgentSpeechLanguage | null;
  voiceStartRequest?: number;
  restoreRequest?: number;
}
const id = () => `${Date.now()}-${Math.random()}`;
const welcome = (): AgentMessage => ({
  id: id(),
  type: 'agent',
  timestamp: new Date().toISOString(),
  content:
    'Hi! I am Connect AI Agent. Ask me to search, navigate, or help with Connect.',
});
const AI_PROVIDER_STORAGE_KEY = '@connect/ai-provider';
// Hands-free conversation ends after this long without speech.
const VOICE_INACTIVITY_TIMEOUT_MS = 90_000;
const providerLabels: Record<AIProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  cursor: 'Cursor',
  grok: 'Grok',
  groq: 'Groq Cloud',
  ollama: 'Ollama (Local)',
};

const normalizeConnectName = (value: unknown) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let index = 1; index <= left.length; index += 1) {
    const current = [index];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[index - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
};

const getNameSimilarity = (query: string, candidate: string) => {
  if (!query || !candidate) return 0;
  const queryTokens = query.split(' ').filter(Boolean);
  const candidateTokens = candidate.split(' ').filter(Boolean);
  const sharedTokens = queryTokens.filter(token =>
    candidateTokens.includes(token),
  ).length;
  const tokenDice =
    (2 * sharedTokens) /
    Math.max(1, queryTokens.length + candidateTokens.length);
  const containsScore =
    candidate.includes(query) || query.includes(candidate)
      ? Math.min(query.length, candidate.length) /
        Math.max(query.length, candidate.length)
      : 0;
  const editScore =
    1 -
    levenshteinDistance(query, candidate) /
      Math.max(query.length, candidate.length);
  const bestTokenEdit = Math.max(
    0,
    ...queryTokens.flatMap(queryToken =>
      candidateTokens.map(
        candidateToken =>
          1 -
          levenshteinDistance(queryToken, candidateToken) /
            Math.max(queryToken.length, candidateToken.length),
      ),
    ),
  );
  return Math.max(tokenDice, containsScore, editScore, bestTokenEdit);
};

const getConnectDisplayName = (connect: Record<string, unknown>) => {
  const user =
    connect.user && typeof connect.user === 'object'
      ? (connect.user as Record<string, unknown>)
      : {};
  if (connect.fullName) return String(connect.fullName);
  if (user.fullName) return String(user.fullName);
  const full = `${user.firstName || connect.firstName || ''} ${
    user.surname || connect.surname || ''
  }`.trim();
  return String(
    full ||
      connect.username ||
      connect.displayName ||
      user.displayName ||
      connect.nickname ||
      user.nickname ||
      connect.name ||
      user.name ||
      user.username ||
      'Unknown',
  );
};

// Spoken names often carry a relation/honorific ("রহিম ভাই", "Rina apu").
const HONORIFICS = new Set([
  'ভাই', 'ভাইয়া', 'ভাইজান', 'আপা', 'আপু', 'দা', 'দাদা', 'দিদি', 'সাহেব',
  'স্যার', 'ম্যাডাম', 'মামা', 'চাচা', 'খালা', 'bhai', 'vai', 'bhaiya',
  'vaiya', 'apa', 'apu', 'da', 'dada', 'didi', 'saheb', 'sir', 'madam',
  'mama', 'chacha', 'khala',
]);
const stripHonorifics = (value: string) => {
  const words = value.split(' ').filter(Boolean);
  const kept = words.filter(word => !HONORIFICS.has(word));
  return (kept.length ? kept : words).join(' ');
};

type ProfileChoice = NonNullable<AgentMessage['profileChoices']>[number];

const SPOKEN_ORDINALS: Array<[RegExp, number]> = [
  [/\b(first|1st|number one|prothom|prothomjon)\b|প্রথম|এক নম্বর|১ নম্বর/i, 0],
  [/\b(second|2nd|number two|ditiyo|ditiyojon)\b|দ্বিতীয়|দুই নম্বর|২ নম্বর/i, 1],
  [/\b(third|3rd|number three|tritiyo)\b|তৃতীয়|তিন নম্বর|৩ নম্বর/i, 2],
  [/\b(fourth|4th|number four)\b|চতুর্থ|চার নম্বর|৪ নম্বর/i, 3],
  [/\b(fifth|5th|number five)\b|পঞ্চম|পাঁচ নম্বর|৫ নম্বর/i, 4],
  [/\b(last|shesh)\b|শেষ(?:ের)?(?:জন)?/i, -1],
];

/**
 * Lets a voice user answer "which person?" out loud: by position ("the
 * second one", "দ্বিতীয়জন") or by a name part only one choice has.
 */
const matchSpokenChoice = (
  text: string,
  choices: ProfileChoice[],
): ProfileChoice | null => {
  if (!choices.length) return null;
  for (const [pattern, index] of SPOKEN_ORDINALS) {
    if (pattern.test(text)) {
      return choices[index < 0 ? choices.length - 1 : index] || null;
    }
  }
  const tokensOf = (choice: ProfileChoice) =>
    normalizeConnectName(`${choice.name} ${choice.username || ''}`).split(' ');
  const spoken = normalizeConnectName(text).split(' ').filter(Boolean);
  const hits = choices.filter(choice =>
    tokensOf(choice).some(
      token =>
        token.length >= 3 &&
        spoken.includes(token) &&
        choices.filter(other => tokensOf(other).includes(token)).length === 1,
    ),
  );
  return hits.length === 1 ? hits[0] : null;
};

// After these, the phone plays video/audio: hands-free listening pauses so the
// agent does not transcribe the media (or itself) as new commands.
const MEDIA_ACTIONS = new Set([
  'PLAY_VIDEO',
  'SEARCH_VIDEO',
  'SEARCH_YOUTUBE',
  'DOWNLOAD_YOUTUBE',
  'navigate_videos',
  'navigate_media_player',
  'navigate_youtube',
  'navigate_facebook',
  'navigate_video_library',
  'navigate_downloads',
]);

// Phrases that end a hands-free conversation.
const STOP_CONVERSATION =
  /^(stop|stop listening|bye|goodbye|that'?s all|thank you,? that'?s all|nothing else|থামো|থামুন|থাক|বিদায়|আর কিছু না|আর কিছু লাগবে না|আপাতত এটুকুই|bas|thik ache bye|ar kichu na)[.!।\s]*$/i;

const JSON_ESCAPES: Record<string, string> = {
  n: ' ',
  t: ' ',
  r: '',
  '"': '"',
  '\\': '\\',
  '/': '/',
};

/**
 * Pulls the user-facing "message"/"reply" out of a JSON plan while it is
 * still streaming, so the agent can start talking before the plan is done.
 */
const extractStreamingReply = (partialJson: string) => {
  const match = partialJson.match(
    /"(?:message|reply)"\s*:\s*"((?:[^"\\]|\\.)*)/,
  );
  if (!match) return '';
  return match[1]
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, (_, char) => JSON_ESCAPES[char] ?? char)
    .replace(/\\$/, '');
};

const toList = (
  data: unknown,
  keys: string[],
): Array<Record<string, unknown>> => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = toList(value, keys);
      if (nested.length) return nested;
    }
  }
  return [];
};

const bulletList = (items: string[], max = 8) => {
  const shown = items.slice(0, max).map(item => `• ${item}`);
  if (items.length > max) shown.push(`…and ${items.length - max} more`);
  return shown.join('\n');
};

const matchesQuery = (text: string, query?: string) =>
  !query || text.toLowerCase().includes(query.trim().toLowerCase());

/** Loads the user's own data and turns it into a short chat-ready summary. */
const summarizeAppData = async (
  rawType: string,
  query: string | undefined,
  profile: unknown,
  knownConnects: Array<{ name: string; username?: string }>,
): Promise<string> => {
  const type = rawType.trim().toLowerCase().replace(/s$/, '');
  const ownProfile = (profile || {}) as Record<string, unknown>;
  const ownId = String(ownProfile._id || '');

  if (type === 'task' || type === 'todo') {
    const tasks = toList((await api.get('/tasks')).data, ['tasks']).filter(
      task => matchesQuery(String(task.text || ''), query),
    );
    if (!tasks.length) return 'You have no matching tasks.';
    const open = tasks.filter(task => !task.completed);
    return `You have ${open.length} open of ${tasks.length} tasks:\n${bulletList(
      tasks.map(task => `${task.completed ? '✓' : '○'} ${String(task.text || '')}`),
    )}`;
  }
  if (type === 'note') {
    const notes = toList((await api.get('/notes')).data, ['notes']).filter(note =>
      matchesQuery(`${note.title || ''} ${note.content || ''}`, query),
    );
    if (!notes.length) return 'You have no matching notes.';
    return `You have ${notes.length} notes:\n${bulletList(
      notes.map(note => String(note.title || note.content || 'Untitled')),
    )}`;
  }
  if (type === 'notification') {
    const items = toList(
      (await api.get('/notification', { params: { receverId: ownId, limit: 20 } }))
        .data,
      ['notifications', 'data'],
    );
    if (!items.length) return 'You have no notifications.';
    const unseen = items.filter(item => !item.isSeen).length;
    return `${unseen} unread of ${items.length} recent notifications:\n${bulletList(
      items.map(item => String(item.text || item.message || item.title || '')),
      6,
    )}`;
  }
  if (type === 'request') {
    const requests = toList(
      (await connectAPI.getConnectRequest(ownId)).data,
      ['requests', 'data'],
    );
    if (!requests.length) return 'You have no pending connect requests.';
    return `You have ${requests.length} connect requests:\n${bulletList(
      requests.map(request => getConnectDisplayName(request)),
    )}`;
  }
  if (type === 'connect' || type === 'friend') {
    const connects = knownConnects.filter(connect =>
      matchesQuery(`${connect.name} ${connect.username || ''}`, query),
    );
    if (!connects.length) return 'No matching connects found.';
    return `You have ${connects.length} connects${query ? ` matching "${query}"` : ''}:\n${bulletList(
      connects.map(connect => connect.name),
      10,
    )}`;
  }
  if (type === 'event' || type === 'calendar') {
    const events = toList((await api.get('/calendar')).data, ['events']).filter(
      event => matchesQuery(String(event.title || ''), query),
    );
    if (!events.length) return 'You have no calendar events.';
    return `You have ${events.length} events:\n${bulletList(
      events.map(event => {
        const date = event.date ? new Date(String(event.date)) : null;
        const when =
          date && !Number.isNaN(date.getTime())
            ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
            : '';
        return `${String(event.title || '')}${when ? ` — ${when}` : ''}${event.time ? ` ${String(event.time)}` : ''}`;
      }),
    )}`;
  }
  if (type === 'habit') {
    const habits = toList((await api.get('/habits')).data, ['habits']);
    if (!habits.length) return 'You are not tracking any habits yet.';
    return `You are tracking ${habits.length} habits:\n${bulletList(
      habits.map(habit => `${String(habit.name || '')}${habit.streak ? ` — ${String(habit.streak)} day streak` : ''}`),
    )}`;
  }
  const details = [
    `Name: ${getConnectDisplayName(ownProfile)}`,
    ownProfile.username ? `Username: @${String(ownProfile.username)}` : '',
    ownProfile.bio ? `Bio: ${String(ownProfile.bio)}` : '',
    `Connects: ${knownConnects.length}`,
  ].filter(Boolean);
  return details.join('\n');
};

const isMachineReadableIntent = (value: string) => {
  const trimmed = value.trimStart();
  return trimmed.startsWith('{') || /^```(?:json)?\b/i.test(trimmed);
};

const getActionSpeechText = (action: AgentActionIntent) => {
  const parameters = action.parameters || {};
  const target = String(
    parameters.userName ||
      action.targetName ||
      parameters.query ||
      action.searchQuery ||
      '',
  ).trim();
  const withTarget = (prefix: string, fallback: string) =>
    target ? `${prefix} ${target}` : fallback;

  switch (action.action) {
    case 'START_AUDIO_CALL':
      return withTarget('Calling', 'Starting an audio call');
    case 'START_VIDEO_CALL':
      return withTarget('Starting a video call with', 'Starting a video call');
    case 'END_CALL':
      return 'Ending the call';
    case 'SEND_MESSAGE':
      return withTarget('Sending a message to', 'Sending the message');
    case 'OPEN_CHAT':
      return withTarget('Opening chat with', 'Opening the chat');
    case 'VIEW_PROFILE':
      return withTarget('Opening the profile of', 'Opening the profile');
    case 'SEARCH_USERS':
      return withTarget('Searching for', 'Searching for users');
    case 'FOLLOW_USER':
      return withTarget('Following', 'Following the user');
    case 'UNFOLLOW_USER':
      return withTarget('Unfollowing', 'Unfollowing the user');
    case 'BLOCK_USER':
      return withTarget('Blocking', 'Blocking the user');
    case 'UNBLOCK_USER':
      return withTarget('Unblocking', 'Unblocking the user');
    case 'INVITE_LUDO_PLAYER':
      return target
        ? `Inviting ${target} to Ludo`
        : 'Inviting the player to Ludo';
    case 'OPEN_LUDO':
    case 'start_ludo':
      return 'Starting Ludo';
    case 'start_chess':
      return 'Starting Chess';
    case 'SEARCH_VIDEO':
    case 'SEARCH_YOUTUBE':
      return withTarget('Searching for', 'Searching for a video');
    case 'PLAY_VIDEO':
      return 'Playing the video';
    case 'DOWNLOAD_YOUTUBE':
      return 'Downloading the video';
    case 'OPEN_SETTINGS':
    case 'navigate_settings':
      return 'Opening settings';
    case 'CREATE_TASK':
      return 'Creating the task';
    case 'VIEW_TASKS':
    case 'navigate_tasks':
      return 'Opening your tasks';
    case 'UPDATE_TASK':
      return 'Updating the task';
    case 'CREATE_AUTO_REPLY_RULE':
      return 'Setting an automatic reply';
    case 'CHANGE_SETTING':
      return `Changing ${String(
        parameters.setting || parameters.name || 'the setting',
      )}`;
    case 'NAVIGATE':
      return `Opening ${String(
        parameters.route || action.targetRoute || 'the requested page',
      )}`;
    case 'navigate_home':
      return 'Opening Home';
    case 'navigate_connects':
      return 'Opening Connects';
    case 'navigate_videos':
      return 'Opening Videos';
    case 'navigate_message':
      return 'Opening Messages';
    case 'navigate_menu':
      return 'Opening Menu';
    case 'navigate_profile':
      return 'Opening your profile';
    case 'navigate_camera':
      return 'Opening Camera';
    case 'navigate_gallery':
      return 'Opening Gallery';
    case 'navigate_video_library':
      return 'Opening your video library';
    case 'navigate_downloads':
      return 'Opening your downloads';
    case 'navigate_media_player':
      return 'Opening the media player';
    case 'navigate_facebook':
      return 'Opening Facebook';
    case 'navigate_youtube':
      return 'Opening YouTube';
    case 'navigate_vpn_browser':
      return 'Opening the VPN browser';
    case 'navigate_cricbuzz':
      return 'Opening Cricbuzz';
    case 'navigate_maps':
      return 'Opening Maps';
    case 'navigate_contacts':
      return 'Opening Contacts';
    case 'speak_text':
      return '';
    case 'logout':
      return 'Logging you out';
    case 'clear_agent_chat':
      return 'Clearing the chat';
    default:
      return `Opening ${action.action.replace(/_/g, ' ').toLowerCase()}`;
  }
};

const getIntentSpeechText = (actions: AgentActionIntent[]) =>
  actions.map(getActionSpeechText).filter(Boolean).join('. ');

const AIAgentModal: React.FC<Props> = ({
  visible,
  onClose,
  autoStartVoiceLanguage,
  voiceStartRequest = 0,
  restoreRequest = 0,
}) => {
  const { colors } = useTheme();
  const { logout, user } = React.useContext(AuthContext);
  const profile = useSelector((state: RootState) => state.profile);
  const { settings } = useSettings();
  const profileContext = React.useMemo(
    () => ({
      ...(user?.profile && typeof user.profile === 'object'
        ? user.profile
        : {}),
      ...(profile && typeof profile === 'object' ? profile : {}),
    }),
    [profile, user?.profile],
  );
  const { setLudoGameActive, requestLudoInvite } = useLudoGame();
  const { setChessGameActive } = useChessGame();
  const {
    startAudioCall,
    startVideoCall,
    sendMessage: socketSendMessage,
    endAudioCall,
    endVideoCall,
    on: socketOn,
    off: socketOff,
  } = useSocket();
  const [messages, setMessages] = React.useState<AgentMessage[]>([welcome()]);
  const [input, setInput] = React.useState('');
  const [language, setLanguage] = React.useState<AgentSpeechLanguage>('auto');
  const defaultSpeechLanguage: Exclude<AgentSpeechLanguage, 'auto'> =
    settings.language === 'bn' ? 'bn-BD' : 'en-US';
  const speechLanguage: Exclude<AgentSpeechLanguage, 'auto'> =
    language === 'auto' ? defaultSpeechLanguage : language;
  // Auto listens for Bangla and English together (the server's Gemini pass
  // detects the language), so it is passed through instead of being pinned.
  const listenLanguage: AgentSpeechLanguage = language;
  const [loading, setLoading] = React.useState(false);
  const [autoMode, setAutoMode] = React.useState(true);
  const [pendingActions, setPendingActions] = React.useState<
    AgentActionIntent[]
  >([]);
  const knownConnectsRef = React.useRef<
    Array<{
      id: string;
      name: string;
      username?: string;
      bio?: string;
      profilePic?: string;
      relationshipTypes?: string[];
      gender?: string;
    }>
  >([]);
  const [voiceConversation, setVoiceConversation] = React.useState(false);
  const [voiceTranscript, setVoiceTranscript] = React.useState('');
  const [speechEnabled, setSpeechEnabled] = React.useState(false);
  const [voiceLanguageMenuOpen, setVoiceLanguageMenuOpen] =
    React.useState(false);
  const [providerStatus, setProviderStatus] =
    React.useState<AIProviderStatus | null>(null);
  const [selectedProvider, setSelectedProvider] =
    React.useState<AIProvider>('gemini');
  const [providerMenuOpen, setProviderMenuOpen] = React.useState(false);
  const [autoActionRunning, setAutoActionRunning] = React.useState(false);
  const [runningActionLabel, setRunningActionLabel] = React.useState('');
  // True while the agent's voice is playing (drives the Stop button).
  const [agentTalking, setAgentTalking] = React.useState(isAgentSpeaking());
  React.useEffect(() => onAgentSpeakingChange(setAgentTalking), []);
  // True while the server re-checks the last utterance with Gemini.
  const [voiceRefining, setVoiceRefining] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const openLudo = React.useCallback(() => {
    navigateWithQueue('Menu');
    setLudoGameActive(true);
  }, [setLudoGameActive]);
  const inviteLudoPlayer = React.useCallback(
    (userId: string, userName?: string) => {
      if (!userId) throw new Error('I could not resolve the Ludo player.');
      navigateWithQueue('Menu');
      requestLudoInvite({ id: userId, name: userName });
    },
    [requestLudoInvite],
  );
  const voiceStartKeyRef = React.useRef<string | null>(null);
  const voiceStartInFlightRef = React.useRef(false);
  const listeningPromptShownRef = React.useRef(false);
  const voiceInputBaseRef = React.useRef('');
  const voiceInactivityTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const updateAutoActionRunning = React.useCallback((running: boolean) => {
    setAutoActionRunning(running);
  }, []);
  const autoReplyRulesRef = React.useRef<
    Array<{ userId: string; userName: string; replyText: string }>
  >([]);
  const miniPosition = React.useRef(
    new Animated.ValueXY({ x: 0, y: 0 }),
  ).current;
  const miniOffset = React.useRef({ x: 0, y: 0 });
  const miniSize = React.useRef({ width: 0, height: 0 });
  const miniPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          miniPosition.setOffset(miniOffset.current);
          miniPosition.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_, gesture) => {
          miniPosition.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          miniPosition.flattenOffset();
          // Keep the pill fully on screen after a drag.
          const { width: screenW, height: screenH } = Dimensions.get('window');
          const { width: pillW, height: pillH } = miniSize.current;
          const baseTop = screenH / 2 - pillH / 2;
          const clamp = (v: number, min: number, max: number) =>
            Math.min(Math.max(v, min), Math.max(min, max));
          const next = {
            x: clamp(miniOffset.current.x + gesture.dx, 8 - 16, screenW - pillW - 8 - 16),
            y: clamp(miniOffset.current.y + gesture.dy, 56 - baseTop, screenH - pillH - 96 - baseTop),
          };
          miniOffset.current = next;
          Animated.spring(miniPosition, {
            toValue: next,
            useNativeDriver: false,
            friction: 7,
          }).start();
        },
      }),
    [miniPosition],
  );
  const sendRef = React.useRef<(textOverride?: string) => void>(() => {});
  const speechControllerRef = React.useRef<ReturnType<
    typeof createAgentSpeechController
  > | null>(null);
  const requestRef = React.useRef<AbortController | null>(null);
  const ambiguityRef = React.useRef<AgentMessage['profileChoices']>(undefined);
  const ambiguousActionRef = React.useRef<AgentActionIntent | null>(null);
  const ambiguityChoicesRef = React.useRef<ProfileChoice[]>([]);
  // Language of the user's latest request; drives dialogs and speech.
  const lastReplyLanguageRef = React.useRef<Exclude<AgentSpeechLanguage, 'auto'>>(
    'en-US',
  );
  const generationRef = React.useRef(0);
  const agentMemoryRef = React.useRef<{
    activeUser?: { id?: string; name?: string };
    activeProfile?: { id?: string; name?: string };
    activeConversation?: { userId?: string; name?: string };
    knownConnects?: Array<{
      id: string;
      name: string;
      username?: string;
      bio?: string;
      profilePic?: string;
    }>;
  }>({});
  const listRef = React.useRef<FlatList<AgentMessage>>(null);
  const clearChat = React.useCallback(async () => {
    await clearAgentChat();
    setMessages([welcome()]);
  }, []);
  const resolveUser = React.useCallback(
    async (query: string) => {
      const profileId = String(
        (profile as Record<string, unknown> | null)?._id || '',
      );
      if (!profileId) return null;
      const normalizedQuery = stripHonorifics(normalizeConnectName(
        query.normalize('NFC').replace(/\u200c|\u200d/g, ''),
      ));
      const searchQueries = Array.from(
        new Set(
          [
            normalizedQuery,
            normalizedQuery.replace(/(কে|কো|এর|র|তে|কে)$/u, '').trim(),
          ].filter(Boolean),
        ),
      );
      const connectMap = new Map<string, Record<string, unknown>>();
      for (const searchQuery of searchQueries) {
        const response = await api.get('/search', {
          params: { input: searchQuery },
        });
        const data: unknown = response.data;
        const dataRecord =
          data && typeof data === 'object'
            ? (data as Record<string, unknown>)
            : {};
        const searchPayload =
          dataRecord.data && typeof dataRecord.data === 'object'
            ? (dataRecord.data as Record<string, unknown>)
            : dataRecord;
        const users = Array.isArray(searchPayload.users)
          ? searchPayload.users
          : [];
        users.forEach((user: Record<string, unknown>) => {
          const userId = String(user._id || user.userId || '');
          if (userId) connectMap.set(userId, user);
        });
      }
      const connects: Array<Record<string, unknown>> = [
        ...new Map(
          [...knownConnectsRef.current, ...connectMap.values()].map(connect => [
            String(
              (connect as Record<string, unknown>).id ||
                (connect as Record<string, unknown>)._id ||
                '',
            ),
            connect,
          ]),
        ).values(),
      ].map(connect => connect as Record<string, unknown>);
      const normalizedNeedle = normalizeConnectName(
        searchQueries[searchQueries.length - 1],
      );
      if (normalizedNeedle.replace(/\s/g, '').length < 3) return null;
      const scored = connects
        .map((connect: Record<string, unknown>) => {
          const nestedUser =
            connect.user && typeof connect.user === 'object'
              ? (connect.user as Record<string, unknown>)
              : {};
          const fields = [
            nestedUser.firstName,
            connect.firstName,
            nestedUser.surname,
            connect.surname,
            `${nestedUser.firstName || connect.firstName || ''} ${
              nestedUser.surname || connect.surname || ''
            }`,
            nestedUser.displayName,
            connect.displayName,
            nestedUser.nickname,
            connect.nickname,
            connect.banglaName,
            nestedUser.username,
            connect.username,
            connect.name,
            nestedUser.name,
            connect.fullName,
            nestedUser.fullName,
          ]
            .map(value => normalizeConnectName(value))
            .filter(Boolean);
          const queryTokens = normalizedNeedle.split(' ').filter(Boolean);
          let score = 0;
          for (const candidate of fields) {
            if (candidate === normalizedNeedle) {
              score = Math.max(score, 1);
              continue;
            }
            const candidateTokens = candidate.split(' ').filter(Boolean);
            if (queryTokens.length === 1) {
              const token = queryTokens[0];
              if (candidateTokens.some(value => value === token))
                score = Math.max(score, 1);
              else if (
                candidateTokens.some(
                  value =>
                    value.startsWith(token) &&
                    token.length / value.length >= 0.8,
                )
              )
                score = Math.max(score, 0.98);
              else if (
                candidateTokens.some(
                  value =>
                    value.includes(token) &&
                    Math.abs(value.length - token.length) <= 1,
                )
              )
                score = Math.max(
                  score,
                  candidateTokens.some(value => value === token) ? 0.98 : 0.9,
                );
            } else {
              if (candidate.includes(normalizedNeedle))
                score = Math.max(score, 0.99);
              const tokenMatches = queryTokens.filter(token =>
                candidateTokens.includes(token),
              ).length;
              if (tokenMatches > 0)
                score = Math.max(
                  score,
                  0.85 + (tokenMatches / queryTokens.length) * 0.1,
                );
            }
            if (score < 0.85)
              score = Math.max(
                score,
                getNameSimilarity(normalizedNeedle, candidate) >= 0.6
                  ? getNameSimilarity(normalizedNeedle, candidate)
                  : 0,
              );
          }
          return { connect, score };
        })
        .filter(item => item.score >= 0.4)
        .sort((a, b) => b.score - a.score);
      if (!scored.length) return null;
      const bestScore = scored[0].score;
      const matches = scored.filter(item => item.score === bestScore);
      if (matches.length > 1) {
        const names = matches
          .slice(0, 5)
          .map(item => getConnectDisplayName(item.connect));
        const ambiguity = new Error(
          `I found multiple relevant people: ${names.join(
            ', ',
          )}. Which one should I use?`,
        ) as Error & {
          profileChoices?: Array<{
            id: string;
            name: string;
            username?: string;
            profilePic?: string;
          }>;
        };
        ambiguity.profileChoices = matches.slice(0, 5).map(item => {
          const nested =
            item.connect.user && typeof item.connect.user === 'object'
              ? (item.connect.user as Record<string, unknown>)
              : {};
          return {
            id: String(
              item.connect._id ||
                item.connect.id ||
                item.connect.userId ||
                nested._id ||
                nested.id,
            ),
            name: getConnectDisplayName(item.connect),
            username:
              String(item.connect.username || nested.username || '') ||
              undefined,
            profilePic:
              String(
                item.connect.profilePic ||
                  item.connect.profilePicture ||
                  nested.profilePic ||
                  nested.profilePicture ||
                  nested.avatar ||
                  '',
              ) || undefined,
          };
        });
        throw ambiguity;
      }
      const match = matches[0].connect;
      const nestedUser =
        match.user && typeof match.user === 'object'
          ? (match.user as Record<string, unknown>)
          : {};
      const id = match._id || match.userId || nestedUser._id || nestedUser.id;
      if (!id) return null;
      const displayName = getConnectDisplayName(match);
      return {
        id: String(id),
        name: String(displayName),
        profilePic:
          String(
            match.profilePic ||
              match.profilePicture ||
              match.avatar ||
              nestedUser.profilePic ||
              nestedUser.profilePicture ||
              nestedUser.avatar ||
              '',
          ) || undefined,
      };
    },
    [profile],
  );

  React.useEffect(() => {
    const ownId = String(
      (profile as Record<string, unknown> | null)?._id || '',
    );
    if (!ownId) return;
    api
      .get('/connects/getConnects', { params: { profile: ownId } })
      .then(response => {
        const raw = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.connects)
          ? response.data.connects
          : Array.isArray(response.data?.data?.connects)
          ? response.data.data.connects
          : Array.isArray(response.data?.friends)
          ? response.data.friends
          : Array.isArray(response.data?.data?.friends)
          ? response.data.data.friends
          : [];
        knownConnectsRef.current = raw
          .map((item: Record<string, unknown>) => {
            const nested =
              item.user && typeof item.user === 'object'
                ? (item.user as Record<string, unknown>)
                : {};
            const id = item._id || item.userId || nested._id || nested.id;
            const name =
              item.fullName ||
              item.name ||
              nested.fullName ||
              nested.name ||
              item.username ||
              nested.username;
            return {
              id: String(id || ''),
              name: String(name || ''),
              username:
                String(item.username || nested.username || '') || undefined,
              bio: String(item.bio || nested.bio || '') || undefined,
              profilePic:
                String(
                  item.profilePic ||
                    item.profilePicture ||
                    item.avatar ||
                    nested.profilePic ||
                    nested.profilePicture ||
                    nested.avatar ||
                    '',
                ) || undefined,
              relationshipTypes: Array.isArray(item.relationshipTypes)
                ? item.relationshipTypes
                : [],
              gender: String(item.gender || nested.gender || '') || undefined,
            };
          })
          .filter(item => item.id && item.name);
        agentMemoryRef.current.knownConnects = knownConnectsRef.current;
      })
      .catch(error => {
        if (__DEV__)
          console.warn('[AI] Failed to load connect context:', error);
      });
  }, [profile]);

  React.useEffect(() => {
    const ownId = String(
      (profile as Record<string, unknown> | null)?._id || '',
    );
    if (!ownId) return;
    const key = `@connect/ai-auto-replies/${ownId}`;
    AsyncStorage.getItem(key)
      .then(value => {
        if (!value) return;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) autoReplyRulesRef.current = parsed;
        } catch (error) {
          if (__DEV__)
            console.warn('[AI] Invalid automatic reply rules:', error);
        }
      })
      .catch(error => {
        if (__DEV__)
          console.warn('[AI] Failed to load automatic reply rules:', error);
      });
  }, [profile]);

  const callAdapter = React.useMemo(() => {
    /**
     * The real name and photo of the person being called, looked up by id.
     * The spoken name ("mom", "আম্মু") is only a last resort: the call screen
     * must show who is actually being called.
     */
    const getCalleeIdentity = async (
      userId: string,
      spokenName?: string,
      profilePic?: string,
    ): Promise<{ name?: string; profilePic?: string }> => {
      const known = knownConnectsRef.current.find(connect => connect.id === userId);
      let name = known?.name;
      let picture = profilePic || known?.profilePic;
      if (!name || !picture) {
        try {
          const response = await userAPI.getProfile(userId);
          const data =
            response.data && typeof response.data === 'object'
              ? (response.data as Record<string, unknown>)
              : {};
          const nestedProfile =
            data.profile && typeof data.profile === 'object'
              ? (data.profile as Record<string, unknown>)
              : {};
          const record = Object.keys(nestedProfile).length ? nestedProfile : data;
          const fetchedName = getConnectDisplayName(record);
          if (!name && fetchedName && fetchedName !== 'Unknown') name = fetchedName;
          picture =
            picture ||
            String(
              data.profilePic ||
                data.profilePicture ||
                data.avatar ||
                nestedProfile.profilePic ||
                nestedProfile.profilePicture ||
                nestedProfile.avatar ||
                '',
            ).trim() ||
            undefined;
        } catch (error) {
          if (__DEV__) console.warn('[AI] Failed to load callee profile:', error);
        }
      }
      const spoken = String(spokenName || '').trim();
      return {
        name: name || (spoken && !findRelation(spoken) ? spoken : undefined) || spoken || undefined,
        profilePic: picture,
      };
    };
    return {
      resolveUser: async (query: string) => {
        const normalized = query.trim().toLowerCase();
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        const ownName = String(
          (profile as Record<string, unknown> | null)?.fullName ||
            (profile as Record<string, unknown> | null)?.username ||
            user?.profile?.fullName ||
            'My profile',
        );
        if (
          [
            'me',
            'my profile',
            'myself',
            'নিজের প্রোফাইল',
            'আমার প্রোফাইল',
          ].includes(normalized) &&
          ownId
        ) {
          return { id: ownId, name: ownName };
        }
        if (
          ['him', 'her', 'them', 'ওকে', 'তাকে', 'ওর', 'তার'].includes(
            normalized,
          )
        ) {
          const active = agentMemoryRef.current.activeUser;
          if (active?.id) return { id: active.id, name: active.name };
        }
        // "my mom", "আম্মু", "baba", "my wife": use the relationship tags on
        // the user's connects, never a name search (which could find a
        // stranger called "Momin").
        const related = matchRelationConnects(query, knownConnectsRef.current);
        if (related) {
          if (related.matches.length === 1) {
            const match = related.matches[0];
            return { id: match.id, name: match.name, profilePic: match.profilePic };
          }
          if (related.matches.length > 1) {
            const ambiguity = new Error(
              `Which ${related.relation.label} do you mean?`,
            ) as Error & { profileChoices?: ProfileChoice[] };
            ambiguity.profileChoices = related.matches.slice(0, 5).map(match => ({
              id: match.id,
              name: match.name,
              profilePic: match.profilePic,
            }));
            throw ambiguity;
          }
          throw new Error(
            `I couldn't find your ${related.relation.label} in your connects. Open their profile, set the relationship (for example Parent), or tell me their name.`,
          );
        }
        return resolveUser(query);
      },
      startAudioCall: async (
        userId: string,
        channelName: string,
        userName?: string,
        profilePic?: string,
      ) => {
        setMinimized(true);
        const callee = await getCalleeIdentity(userId, userName, profilePic);
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        const effectiveChannel =
          channelName === userId && ownId ? `${ownId}-${userId}` : channelName;
        emitStartAudioCall({
          to: userId,
          channelName: effectiveChannel,
          calleeName: callee.name,
          calleeProfilePic: callee.profilePic,
        });
        startAudioCall(userId, effectiveChannel);
      },
      startVideoCall: async (
        userId: string,
        channelName: string,
        userName?: string,
        profilePic?: string,
      ) => {
        setMinimized(true);
        const callee = await getCalleeIdentity(userId, userName, profilePic);
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        const effectiveChannel =
          channelName === userId && ownId ? `${ownId}-${userId}` : channelName;
        emitStartVideoCall({
          to: userId,
          channelName: effectiveChannel,
          calleeName: callee.name,
          calleeProfilePic: callee.profilePic,
        });
        startVideoCall(userId, effectiveChannel);
      },
      followUser: async (userId: string) => {
        await profileAPI.follow(userId);
      },
      unfollowUser: async (userId: string) => {
        await profileAPI.unfollow(userId);
      },
      blockUser: async (userId: string) => {
        await connectAPI.blockUser(userId);
      },
      unblockUser: async (userId: string) => {
        await connectAPI.unblockUser(userId);
      },
      sendMessage: async (userId: string, message: string) => {
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        if (!ownId) throw new Error('You must be signed in to send messages.');
        const room = [ownId, userId].sort().join('_');
        socketSendMessage(room, ownId, userId, message);
      },
      endCall: (userId: string, channelName?: string) => {
        if (!userId)
          throw new Error('I could not resolve the call participant.');
        endAudioCall(userId, channelName, 'end');
        endVideoCall(userId, channelName, 'end');
      },
      changeSetting: (setting: string, value: unknown) =>
        navigateWithQueue('Menu', { screen: 'Settings', setting, value }),
      createTask: async (text: string) => {
        const response = await api.post('/tasks', { text });
        if (!response.data?.success)
          throw new Error('I could not create that task.');
      },
      resolveTask: async (query: string) => {
        const response = await api.get('/tasks');
        const tasks = Array.isArray(response.data?.tasks)
          ? response.data.tasks
          : [];
        const needle = query.trim().toLowerCase();
        const matches = tasks.filter((task: Record<string, unknown>) =>
          String(task.text || '')
            .toLowerCase()
            .includes(needle),
        );
        return matches.length === 1 && matches[0]?._id
          ? { id: String(matches[0]._id) }
          : null;
      },
      updateTask: async (
        taskId: string,
        values: { text?: string; completed?: boolean },
      ) => {
        const response = await api.put(
          `/tasks/${encodeURIComponent(taskId)}`,
          values,
        );
        if (!response.data?.success)
          throw new Error('I could not update that task.');
      },
      createAutoReplyRule: async (
        triggerUserName: string,
        replyText: string,
      ) => {
        const resolved = await resolveUser(triggerUserName);
        if (!resolved)
          throw new Error('I could not uniquely resolve that connect.');
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        if (!ownId)
          throw new Error('You must be signed in to save an automatic reply.');
        const rules = autoReplyRulesRef.current.filter(
          rule => rule.userId !== resolved.id,
        );
        rules.push({
          userId: resolved.id,
          userName: resolved.name || triggerUserName,
          replyText,
        });
        autoReplyRulesRef.current = rules;
        await AsyncStorage.setItem(
          `@connect/ai-auto-replies/${ownId}`,
          JSON.stringify(rules),
        );
      },
      deleteTask: async (taskId: string) => {
        await api.delete(`/tasks/${encodeURIComponent(taskId)}`);
      },
      createNote: async (content: string, title?: string) => {
        await api.post('/notes', { title: (title || content).slice(0, 80), content });
      },
      createEvent: async (event: { title: string; date: string; time?: string }) => {
        await api.post('/calendar', event);
      },
      createHabit: async (name: string) => {
        await api.post('/habits', { name, color: '#22C55E' });
      },
      createPost: async (caption: string, publish: boolean) => {
        const openDraft = () => {
          setMinimized(true);
          navigateWithQueue('Home', {
            screen: 'HomeMain',
            params: { composerCaption: caption },
          });
        };
        if (!publish || !caption) {
          openDraft();
          return false;
        }
        try {
          const form = new FormData();
          form.append('caption', caption);
          form.append('photos', '');
          form.append('gallery', JSON.stringify([]));
          form.append('type', 'post');
          form.append('feelings', '');
          form.append('location', '');
          form.append('audience', '3');
          await api.post('/post/create', form);
          return true;
        } catch (error) {
          if (__DEV__) console.warn('[AI] Direct post failed, opening draft:', error);
          openDraft();
          return false;
        }
      },
      sendConnectRequest: async (userId: string) => {
        await connectAPI.sendConnectRequest(userId, []);
      },
      removeConnect: async (userId: string) => {
        await connectAPI.disconnect(userId);
      },
      respondConnectRequest: async (accept: boolean, userName?: string) => {
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        const response = await connectAPI.getConnectRequest(ownId);
        const requests = toList(response.data, ['requests', 'data']);
        if (!requests.length)
          throw new Error('You have no pending connect requests.');
        const needle = stripHonorifics(normalizeConnectName(userName));
        const target = needle
          ? requests.find(request =>
              normalizeConnectName(getConnectDisplayName(request)).includes(needle),
            )
          : requests[0];
        if (!target)
          throw new Error(`No pending connect request from "${userName}".`);
        const requesterId = String(
          target._id || (target.user as Record<string, unknown>)?._id || '',
        );
        if (accept) await connectAPI.acceptConnectRequest(requesterId, []);
        else await connectAPI.deleteConnectRequest(requesterId);
        return getConnectDisplayName(target);
      },
      queryAppData: (dataType: string, query?: string) =>
        summarizeAppData(dataType, query, profile, knownConnectsRef.current),
    };
  }, [
    onClose,
    profile,
    requestLudoInvite,
    resolveUser,
    startAudioCall,
    startVideoCall,
    socketSendMessage,
    endAudioCall,
    endVideoCall,
  ]);

  React.useEffect(() => {
    const handleIncomingMessage = (payload: unknown) => {
      const data =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : {};
      const message =
        data.updatedMessage && typeof data.updatedMessage === 'object'
          ? (data.updatedMessage as Record<string, unknown>)
          : data;
      const ownId = String(
        (profile as Record<string, unknown> | null)?._id || '',
      );
      const senderId = String(message.senderId || message.sender || '');
      const text = String(message.message || '').trim();
      if (!ownId || !senderId || senderId === ownId || !text) return;
      const rule = autoReplyRulesRef.current.find(
        item => item.userId === senderId,
      );
      if (!rule) return;
      const room = [ownId, senderId].sort().join('_');
      socketSendMessage(room, ownId, senderId, rule.replyText);
    };
    socketOn('newMessageToUser', handleIncomingMessage);
    socketOn('newMessage', handleIncomingMessage);
    return () => {
      socketOff('newMessageToUser', handleIncomingMessage);
      socketOff('newMessage', handleIncomingMessage);
    };
  }, [profile, socketOff, socketOn, socketSendMessage]);
  const voiceAutoSendTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const speakLineRef = React.useRef<(text: string) => Promise<void>>(
    async () => {},
  );
  const clearVoiceAutoSend = React.useCallback(() => {
    if (voiceAutoSendTimerRef.current) {
      clearTimeout(voiceAutoSendTimerRef.current);
      voiceAutoSendTimerRef.current = null;
    }
  }, []);

  const transcribe = useComposerLiveTranscribe({
    onFinal: (text, meta) => {
      // Never treat the agent's own voice as a new command.
      if (isLikelyAgentEcho(text)) return;
      resetVoiceInactivityTimer();
      const next = mergeTranscriptText(voiceInputBaseRef.current, text);
      voiceInputBaseRef.current = next;
      setInput(next);
      setVoiceTranscript(next);
      if (!voiceConversation) return;
      clearVoiceAutoSend();
      // A Gemini-checked final already marks the end of a spoken sentence,
      // so act on it quickly; rough finals wait for a possible continuation.
      voiceAutoSendTimerRef.current = setTimeout(
        () => {
          voiceAutoSendTimerRef.current = null;
          sendRef.current(voiceInputBaseRef.current || next);
        },
        meta?.refined ? 450 : 1200,
      );
    },
    onRefining: active => setVoiceRefining(active),
    onInterim: text => {
      if (isLikelyAgentEcho(text)) return;
      const next = mergeTranscriptText(voiceInputBaseRef.current, text);
      setInput(next);
      setVoiceTranscript(next);
    },
  });
  const { listening, stop: stopTranscription } = transcribe;

  const clearVoiceInactivityTimer = React.useCallback(() => {
    if (voiceInactivityTimerRef.current) {
      clearTimeout(voiceInactivityTimerRef.current);
      voiceInactivityTimerRef.current = null;
    }
  }, []);

  const resetVoiceInactivityTimer = React.useCallback(() => {
    clearVoiceInactivityTimer();
    if (!listening) return;
    voiceInactivityTimerRef.current = setTimeout(() => {
      voiceInactivityTimerRef.current = null;
      setVoiceConversation(false);
      setVoiceLanguageMenuOpen(false);
      void stopTranscription({ discard: true }).then(() =>
        speakLineRef.current(
          lastReplyLanguageRef.current === 'bn-BD'
            ? 'আমি একটু বিরতি নিচ্ছি। দরকার হলে মাইক চাপুন।'
            : "I'll pause for now. Tap the mic when you need me.",
        ),
      );
    }, VOICE_INACTIVITY_TIMEOUT_MS);
  }, [clearVoiceInactivityTimer, listening, stopTranscription]);

  React.useEffect(() => {
    if (listening) {
      resetVoiceInactivityTimer();
    } else {
      clearVoiceInactivityTimer();
    }
    return clearVoiceInactivityTimer;
  }, [clearVoiceInactivityTimer, listening, resetVoiceInactivityTimer]);

  React.useEffect(() => {
    return () => clearVoiceAutoSend();
  }, [clearVoiceAutoSend]);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;
    Promise.all([
      fetchAIProviderStatus(),
      AsyncStorage.getItem(AI_PROVIDER_STORAGE_KEY),
    ])
      .then(([status, saved]) => {
        if (!active) return;
        setProviderStatus(status);
        const savedProvider = saved as AIProvider | null;
        const available = (Object.keys(providerLabels) as AIProvider[]).find(
          provider =>
            status.enabled[provider] !== false && status.configured[provider],
        );
        const savedIsAvailable =
          savedProvider &&
          status.enabled[savedProvider] !== false &&
          status.configured[savedProvider];
        const next = savedIsAvailable
          ? savedProvider
          : available || status.defaultProvider || 'gemini';
        setSelectedProvider(next);
      })
      .catch(error => console.warn('Failed to load AI providers', error));
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
    if (!visible) setMinimized(false);
    if (!visible) listeningPromptShownRef.current = false;
  }, [visible]);

  React.useEffect(() => {
    if (visible) setMinimized(false);
  }, [restoreRequest, visible]);

  const chooseProvider = React.useCallback((provider: AIProvider) => {
    setSelectedProvider(provider);
    setProviderMenuOpen(false);
    AsyncStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider).catch(error =>
      console.warn('Failed to save AI provider', error),
    );
  }, []);

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
    clearVoiceAutoSend();
    requestRef.current?.abort();
    transcribe.stop({ discard: true }).catch(() => {});
    speechControllerRef.current?.stop().catch(() => {});
    setLoading(false);
    onClose();
  };

  /** Cuts off whatever the agent is doing: thinking, speaking or acting. */
  const interruptAgent = () => {
    generationRef.current += 1;
    clearVoiceAutoSend();
    requestRef.current?.abort();
    speechControllerRef.current?.stop().catch(() => {});
    setLoading(false);
    setRunningActionLabel('');
    updateAutoActionRunning(false);
    setMessages(previous =>
      previous
        .filter(item => !(item.streaming && !item.content && !item.actionResults))
        .map(item => (item.streaming ? { ...item, streaming: false } : item)),
    );
  };

  /**
   * The Stop button. In a hands-free conversation the agent then listens
   * straight away, like a person who stops talking when interrupted.
   */
  const stopGenerating = () => {
    interruptAgent();
    if (voiceConversation && !transcribe.listening && !isCallBusy()) {
      void startListening(
        listenLanguage,
        { skipStop: true },
        { immediate: true },
      ).then(started => {
        if (!started) setVoiceConversation(false);
      });
    }
  };

  /** Speaks one line (voice output on), pausing the mic while talking. */
  const speakLine = async (text: string) => {
    if (!speechEnabled || !text.trim()) return;
    await transcribe.stop({ discard: true });
    await restoreChatPlaybackAudioMode();
    await speechControllerRef.current?.stop().catch(() => {});
    const speaker = createAgentSpeechController(
      detectAgentSpeechLanguage(text),
      { onSpeechStart: () => transcribe.stop({ discard: true }) },
    );
    speechControllerRef.current = speaker;
    speaker.update(text);
    await speaker.finish();
  };
  speakLineRef.current = speakLine;

  const confirmAgentAction = (
    definition: AgentActionDefinition,
    action: AgentActionIntent,
  ) =>
    new Promise<boolean>(resolve => {
      const parameters = action.parameters || {};
      const detail = [
        parameters.userName || action.targetName,
        parameters.message || parameters.caption || parameters.content ||
          parameters.text || action.messageText,
      ]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join(' · ');
      const bangla = lastReplyLanguageRef.current === 'bn-BD';
      // Read the question aloud for users who cannot read the dialog.
      void speakLine(
        bangla
          ? `${detail ? `${detail} — ` : ''}এই কাজটি করব? করতে চাইলে হ্যাঁ চাপুন।`
          : `${definition.label}${detail ? ` for ${detail}` : ''}. Should I do it? Tap Yes to confirm.`,
      );
      Alert.alert(
        definition.label,
        bangla
          ? `এই কাজটি করব?${detail ? `\n\n${detail.slice(0, 220)}` : ''}`
          : `Allow the agent to run this?${detail ? `\n\n${detail.slice(0, 220)}` : ''}`,
        [
          { text: bangla ? 'না' : 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: bangla ? 'হ্যাঁ, করুন' : 'Yes',
            style: definition.destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

  /**
   * Turns raw action results (data lookups, failures) into a short, natural
   * reply in the user's language, like a person reporting back.
   */
  const narrateResults = async (
    request: string,
    results: AgentActionResult[],
    replyLanguage: Exclude<AgentSpeechLanguage, 'auto'>,
    signal: AbortSignal,
  ) => {
    const lines = results
      .map(result => `${result.label || result.action}: ${result.ok ? 'done' : result.cancelled ? 'cancelled' : 'failed'} — ${result.message}`)
      .join('\n');
    const raw = await streamAgentReply(
      `I asked: "${request}"\nThe app ran these actions:\n${lines}\nReport back to me naturally in ${replyLanguage === 'bn-BD' ? 'Bangla' : 'English'} in one or two short spoken sentences, mentioning the important items. Do not plan any new actions.`,
      [],
      () => undefined,
      signal,
      undefined,
      {
        provider: selectedProvider,
        model: providerStatus?.models[selectedProvider],
        preferredLanguage: replyLanguage === 'bn-BD' ? 'bn' : 'eng',
      },
    );
    const parsed = parseAgentIntent(raw);
    return (parsed.ok ? parsed.intent.reply || '' : isMachineReadableIntent(raw) ? '' : raw).trim();
  };

  // One adapter for every execution path (auto-run, Run buttons, profile
  // choices) so an action behaves the same no matter how it was triggered.
  const buildAdapter = (
    shouldSpeak: boolean,
    replyLanguage: Exclude<AgentSpeechLanguage, 'auto'>,
  ) =>
    createMobileAgentActionAdapter({
      ...callAdapter,
      resolveUser: async (query: string) => {
        try {
          return await callAdapter.resolveUser(query);
        } catch (error) {
          const choices = (
            error as Error & {
              profileChoices?: AgentMessage['profileChoices'];
            }
          ).profileChoices;
          if (choices?.length) ambiguityRef.current = choices;
          throw error;
        }
      },
      navigate: (route, params) => {
        setMinimized(true);
        const routeAliases: Record<string, string> = {
          messages: 'Message',
          message: 'Message',
          home: 'Home',
          friends: 'Connects',
          videos: 'Videos',
          menu: 'Menu',
          profile: 'Menu',
          settings: 'Menu',
          tasks: 'Menu',
          task: 'Menu',
        };
        const normalizedRoute =
          routeAliases[String(route).trim().toLowerCase()] || route;
        const normalizedParams =
          String(route).trim().toLowerCase() === 'messages' ||
          String(route).trim().toLowerCase() === 'message'
            ? { screen: 'MessageList', ...(params || {}) }
            : String(route).trim().toLowerCase() === 'profile'
            ? { screen: 'MyProfile', ...(params || {}) }
            : String(route).trim().toLowerCase() === 'settings'
            ? { screen: 'Settings', ...(params || {}) }
            : ['tasks', 'task'].includes(String(route).trim().toLowerCase())
            ? { screen: 'Tasks', ...(params || {}) }
            : params;
        const ownId = String(
          (profile as Record<string, unknown> | null)?._id || '',
        );
        const connectId = String(
          (normalizedParams as Record<string, unknown> | undefined)
            ?.connectId || '',
        );
        if (
          normalizedRoute === 'ConnectProfile' &&
          ownId &&
          connectId === ownId
        ) {
          return navigateWithQueue('Menu', { screen: 'MyProfile' });
        }
        return navigateWithQueue(normalizedRoute, normalizedParams);
      },
      playVideo: videoId => {
        setMinimized(true);
        return navigateWithQueue('Videos', {
          screen: 'SingleWatch',
          params: { watchId: videoId },
        });
      },
      searchVideo: async (query: string) => {
        const response = await api.get('/search', {
          params: { input: query },
        });
        const data = response.data as {
          videos?: Array<Record<string, unknown>>;
        };
        const video = Array.isArray(data?.videos) ? data.videos[0] : null;
        const videoId = String(video?._id || video?.id || '');
        if (!videoId) throw new Error('I could not find a matching video.');
        setMinimized(true);
        await navigateWithQueue('Videos', {
          screen: 'SingleWatch',
          params: { watchId: videoId },
        });
      },
      searchYoutube: async (query: string) => {
        setMinimized(true);
        await navigateWithQueue('Menu', {
          screen: 'MediaPlayer',
          params: { searchQuery: query },
        });
      },
      downloadYoutube: async (options: {
        query?: string;
        url?: string;
        videoId?: string;
        title?: string;
        thumbnail?: string;
        quality?: number;
        audioOnly?: boolean;
      }) => {
        setMinimized(true);
        let url =
          options.url ||
          (options.videoId ? toWatchUrl(options.videoId) : null);
        let title = options.title;
        let thumbnail = options.thumbnail;
        if (!url && options.query) {
          const response = await api.get('/yt-download/youtube/search', {
            params: { q: options.query, maxResults: 1, _ts: Date.now() },
          });
          const result = Array.isArray(response.data?.items)
            ? response.data.items[0]
            : null;
          url = String(result?.url || '').trim() || null;
          title = title || String(result?.title || '').trim() || undefined;
          thumbnail =
            thumbnail ||
            String(result?.thumbnail || '').trim() ||
            undefined;
        }
        if (!url || !extractYouTubeVideoId(url)) {
          throw new Error('I could not find a downloadable YouTube video.');
        }
        const job = startBackgroundYoutubeDownload({
          url,
          title: title || `YouTube ${extractYouTubeVideoId(url)}`,
          quality: options.quality || 1080,
          audioOnly: options.audioOnly,
        });
        await navigateWithQueue('Menu', {
          screen: 'MediaPlayer',
          params: {
            playUrl: url,
            playTitle: title,
            playPoster: thumbnail,
            autoplay: true,
          },
        });
        if (!job) throw new Error('Could not start the YouTube download.');
      },
      startLudo: openLudo,
      inviteLudoPlayer,
      endCall: callAdapter.endCall,
      changeSetting: callAdapter.changeSetting,
      startChess: () => setChessGameActive(true),
      startVoiceInput: async () => {
        await startListening(listenLanguage);
      },
      stopVoiceInput: async () => {
        await transcribe.stop();
      },
      speakText: async value => {
        if (shouldSpeak) {
          await transcribe.stop({ discard: true });
          await restoreChatPlaybackAudioMode();
          const reader = createAgentSpeechController(replyLanguage, {
            onSpeechStart: () => transcribe.stop({ discard: true }),
          });
          reader.update(value, replyLanguage);
          await reader.finish();
          speechControllerRef.current = reader;
        }
      },
      stopSpeaking: () => speechControllerRef.current?.stop(),
      logout,
      clearAgentChat: clearChat,
    });

  const send = async (textOverride?: string) => {
    clearVoiceAutoSend();
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    // In Auto, answer (and speak) in the language the user just used.
    const replyLanguage: Exclude<AgentSpeechLanguage, 'auto'> =
      language === 'auto' ? detectAgentSpeechLanguage(text) : speechLanguage;
    lastReplyLanguageRef.current = replyLanguage;
    transcribe.stop({ discard: true }).catch(() => {});
    setVoiceRefining(false);
    const echoUser = () => {
      voiceInputBaseRef.current = '';
      setInput('');
      setVoiceTranscript('');
      setMessages(previous => [
        ...previous,
        { id: id(), type: 'user', content: text, timestamp: new Date().toISOString() },
      ]);
    };

    // "Stop / bye / থামো" ends a hands-free conversation politely.
    if (voiceConversation && STOP_CONVERSATION.test(text)) {
      echoUser();
      setVoiceConversation(false);
      await transcribe.stop({ discard: true });
      const goodbye =
        replyLanguage === 'bn-BD'
          ? 'ঠিক আছে। দরকার হলে আবার ডাকবেন।'
          : 'Okay. Call me whenever you need me.';
      setMessages(previous => [
        ...previous,
        { id: id(), type: 'agent', content: goodbye, timestamp: new Date().toISOString() },
      ]);
      await speakLine(goodbye);
      return;
    }

    // Answering "which person?" out loud runs the waiting action directly.
    const waitingAction = ambiguousActionRef.current;
    const spokenChoice =
      waitingAction && ambiguityChoicesRef.current.length
        ? matchSpokenChoice(text, ambiguityChoicesRef.current)
        : null;
    if (spokenChoice) {
      echoUser();
      await chooseProfileForAction(spokenChoice);
      return;
    }
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
    voiceInputBaseRef.current = '';
    setInput('');
    setMessages(previous => [...previous, user, stream]);
    setLoading(true);
    const controller = new AbortController();
    const speechController = createAgentSpeechController(replyLanguage, {
      onSpeechStart: () => transcribe.stop({ discard: true }),
    });
    const shouldSpeak = speechEnabled;
    let callActionStarted = false;
    let mediaStarted = false;
    if (shouldSpeak) {
      await transcribe.stop({ discard: true });
      await restoreChatPlaybackAudioMode();
    }
    await speechControllerRef.current?.stop().catch(() => {});
    speechControllerRef.current = speechController;
    requestRef.current = controller;
    try {
      const rawReply = await streamAgentReply(
        text,
        // `text` is appended by streamAgentReply itself; send only prior turns.
        messages.filter(item => !item.streaming && item.content.trim()),
        next => {
          if (generation !== generationRef.current) return;
          const machineReadable = isMachineReadableIntent(next);
          // For JSON plans, show and speak the "message" as it streams so the
          // agent starts talking before the whole plan has arrived.
          const visible = machineReadable ? extractStreamingReply(next) : next;
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id ? { ...item, content: visible } : item,
            ),
          );
          if (shouldSpeak && visible)
            speechController.update(visible, replyLanguage);
        },
        controller.signal,
        profileContext,
        {
          provider: selectedProvider,
          model: providerStatus?.models[selectedProvider],
          memory: agentMemoryRef.current,
          preferredLanguage:
            language === 'auto'
              ? replyLanguage === 'bn-BD'
                ? 'bn'
                : 'eng'
              : settings.language === 'bn'
              ? 'bn'
              : 'eng',
        },
      );
      if (generation !== generationRef.current) return;

      const parsed = parseAgentIntent(rawReply);
      if (parsed.ok) {
        const intent = parsed.intent;
        const contextualAction = intent.actions?.find(
          action =>
            action.targetName ||
            action.parameters?.userName ||
            action.parameters?.userId ||
            action.parameters?.profileId,
        );
        if (contextualAction) {
          const parameters = contextualAction.parameters || {};
          const idValue =
            String(parameters.userId || parameters.profileId || '') ||
            undefined;
          const nameValue =
            String(parameters.userName || contextualAction.targetName || '') ||
            undefined;
          agentMemoryRef.current = {
            ...agentMemoryRef.current,
            activeUser: { id: idValue, name: nameValue },
            activeProfile: { id: idValue, name: nameValue },
            activeConversation:
              contextualAction.action === 'OPEN_CHAT' ||
              contextualAction.action === 'SEND_MESSAGE'
                ? { userId: idValue, name: nameValue }
                : agentMemoryRef.current.activeConversation,
          };
        }
        const visibleReply = intent.actions?.length
          ? intent.reply ||
            (replyLanguage === 'bn-BD'
              ? 'ঠিক আছে, কাজটি করছি।'
              : 'Got it. I’m taking care of that now.')
          : intent.reply || intent.ask?.question || '';
        if (visibleReply) {
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id ? { ...item, content: visibleReply } : item,
            ),
          );
          if (shouldSpeak && isMachineReadableIntent(rawReply)) {
            // Usually already spoken while streaming; update() skips repeats.
            speechController.update(visibleReply, replyLanguage);
          }
        }
        const adapter = buildAdapter(shouldSpeak, replyLanguage);
        if (!autoMode && intent.actions?.length) {
          setPendingActions(intent.actions);
          if (shouldSpeak) speechController.finish();
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
        const startsCall = Boolean(
          intent.actions?.some(
            action =>
              action.action === 'START_AUDIO_CALL' ||
              action.action === 'START_VIDEO_CALL',
          ),
        );
        callActionStarted = startsCall;
        if (startsCall) {
          setVoiceConversation(false);
          await transcribe.stop({ discard: true });
          await restoreChatPlaybackAudioMode();
        }
        if (autoMode && intent.actions?.length) {
          updateAutoActionRunning(true);
          // Paint the compact overlay before starting potentially slow action work.
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        const results = await executeAgentActions(intent.actions, adapter, {
          // Sensitive actions always require an explicit confirmation, including
          // manual mode. Auto mode intentionally executes actions without a
          // confirmation prompt.
          // Auto mode skips confirmation for sensitive actions; destructive
          // ones (block, remove connect, delete, logout) always confirm.
          skipConfirmation: autoMode,
          onResolvedUser: resolved => {
            agentMemoryRef.current = {
              ...agentMemoryRef.current,
              activeUser: resolved,
              activeProfile: resolved,
            };
          },
          onActionStart: action =>
            setRunningActionLabel(getAgentActionLabel(action.action)),
          confirm: async (definition, action) => {
            // Let the spoken reply finish before asking.
            if (shouldSpeak) await speechController.finish();
            return confirmAgentAction(definition, action);
          },
        });
        if (ambiguityRef.current?.length) {
          const profileChoices = ambiguityRef.current;
          ambiguityRef.current = undefined;
          ambiguousActionRef.current =
            intent.actions?.find(
              action =>
                action.targetName ||
                action.parameters?.userName ||
                action.parameters?.userId,
            ) || null;
          ambiguityChoicesRef.current = profileChoices;
          setPendingActions([]);
          const numbered = profileChoices
            .map((choice, index) => `${index + 1}. ${choice.name}`)
            .join(', ');
          const question =
            replyLanguage === 'bn-BD'
              ? `একাধিক মানুষ পেয়েছি: ${numbered}। কাকে বোঝাচ্ছেন? নাম বা নম্বর বলুন।`
              : `I found a few people: ${numbered}. Who did you mean? Say the name or number.`;
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id
                ? { ...item, content: question, profileChoices }
                : item,
            ),
          );
          if (shouldSpeak) speechController.update(question, replyLanguage);
          return;
        }
        if (!startsCall) updateAutoActionRunning(false);
        const failed = results.filter(result => !result.ok);
        const completed = results.filter(result => result.ok);
        if (startsCall && failed.length) {
          updateAutoActionRunning(false);
        } else if (startsCall && autoMode && completed.length) {
          updateAutoActionRunning(false);
        }
        const outcome = failed.length
          ? failed.map(result => result.message).join(' ')
          : completed.length
          ? completed.map(result => result.message).join(' ')
          : '';
        // Data lookups and real failures get a natural spoken report-back in
        // the user's language instead of an English status line.
        const needsReport = results.some(
          result =>
            (result.ok && result.action === 'QUERY_APP_DATA') ||
            (!result.ok && !result.cancelled),
        );
        if (needsReport && generation === generationRef.current) {
          const report = await narrateResults(
            text,
            results,
            replyLanguage,
            controller.signal,
          ).catch(() => '');
          if (report && generation === generationRef.current) {
            setMessages(previous => [
              ...previous,
              {
                id: id(),
                type: 'agent',
                content: report,
                timestamp: new Date().toISOString(),
              },
            ]);
            if (shouldSpeak) speechController.update(`${visibleReply} ${report}`, replyLanguage);
          } else if (shouldSpeak && failed.length) {
            speechController.update(`${visibleReply} ${outcome}`, replyLanguage);
          }
        }
        setRunningActionLabel('');
        mediaStarted = results.some(
          result => result.ok && MEDIA_ACTIONS.has(result.action),
        );
        if (results.length) {
          // The reply stays as the lead line; each action gets a ✓/✗ card.
          setMessages(previous =>
            previous.map(item =>
              item.id === stream.id
                ? {
                    ...item,
                    content: visibleReply,
                    success: failed.length === 0,
                    actionResults: results,
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
                  content:
                    replyLanguage === 'bn-BD'
                      ? 'দুঃখিত, এই কাজটি এখনো মোবাইল অ্যাপে করা যায় না।'
                      : "Sorry, I can't do that in the mobile app yet.",
                }
              : item,
          ),
        );
      } else if (isMachineReadableIntent(rawReply)) {
        setMessages(previous =>
          previous.map(item =>
            item.id === stream.id
              ? {
                  ...item,
                  content:
                    'I could not understand the agent response. Please try again.',
                }
              : item,
          ),
        );
      }
      if (shouldSpeak) speechController.finish();
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
      if (shouldSpeak) {
        speechController.update(
          error?.message || 'Sorry, the AI Agent is unavailable.',
          replyLanguage,
        );
      }
    } finally {
      updateAutoActionRunning(false);
      setRunningActionLabel('');
      if (generation === generationRef.current) setLoading(false);
      if (
        voiceConversation &&
        !callActionStarted &&
        !mediaStarted &&
        generation === generationRef.current
      ) {
        if (shouldSpeak) {
          await speechController.finish();
        }
        const started = await startListening(listenLanguage);
        if (!started) setVoiceConversation(false);
      } else if (voiceConversation && mediaStarted) {
        // Media is playing now; tap the mic to talk again.
        setVoiceConversation(false);
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
  const playMicrophoneStartCue = React.useCallback(async () => {
    let sound:
      | Awaited<ReturnType<typeof Audio.Sound.createAsync>>['sound']
      | null = null;
    try {
      await restoreChatPlaybackAudioMode();
      const result = await Audio.Sound.createAsync(
        require('../assets/sounds/ludo/buttonClick.wav'),
        { shouldPlay: true, volume: 0.35 },
      );
      sound = result.sound;
      await new Promise<void>(resolve => setTimeout(resolve, 180));
    } catch (error) {
      if (__DEV__) console.warn('[AI] Failed to play microphone cue:', error);
    } finally {
      if (sound) {
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
      }
    }
  }, []);

  const startListening = React.useCallback(
    async (
      language: AgentSpeechLanguage,
      options?: Parameters<typeof transcribe.start>[1],
      { immediate = false }: { immediate?: boolean } = {},
    ) => {
      if (immediate) {
        // The user tapped the mic / shook the phone: listen right now. Any
        // agent speech was just cut off, so only a tiny tail is needed, and a
        // short vibration replaces the (blocking) start sound.
        Vibration.vibrate(30);
        await waitForAgentSilence(120, 1500);
        return transcribe.start(language, options);
      }
      // Automatic turn-taking: open the mic only once the agent has finished
      // talking and the speaker has gone quiet, so its own voice is not
      // recorded; the cue tells the user it is their turn.
      await waitForAgentSilence();
      await playMicrophoneStartCue();
      return transcribe.start(language, options);
    },
    [playMicrophoneStartCue, transcribe],
  );

  const selectVoiceLanguage = React.useCallback(
    async (nextLanguage: AgentSpeechLanguage) => {
      setLanguage(nextLanguage);
      setVoiceLanguageMenuOpen(false);
      if (!transcribe.supported) {
        setVoiceConversation(false);
        Alert.alert(
          'Microphone unavailable',
          'Allow microphone access and try again.',
        );
        return;
      }
      setVoiceConversation(true);
      setVoiceTranscript('');
      await speechControllerRef.current?.stop().catch(() => {});
      const started = await startListening(
        nextLanguage,
        { skipStop: true },
        { immediate: true },
      );
      if (!started) {
        setVoiceConversation(false);
        Alert.alert(
          'Microphone unavailable',
          'Allow microphone access and try again.',
        );
      }
    },
    [startListening, transcribe],
  );

  React.useEffect(() => {
    if (!visible || !autoStartVoiceLanguage) {
      voiceStartKeyRef.current = null;
      return;
    }
    const voiceStartKey = `${voiceStartRequest}:${autoStartVoiceLanguage}`;
    if (voiceStartKeyRef.current === voiceStartKey) return;
    voiceStartKeyRef.current = voiceStartKey;
    setLanguage(autoStartVoiceLanguage);
    setMinimized(true);
    setVoiceConversation(true);
    setVoiceTranscript('');
    setSpeechEnabled(true);
    setVoiceLanguageMenuOpen(false);
    void (async () => {
      if (isCallBusy()) {
        setVoiceConversation(false);
        return;
      }
      if (voiceStartInFlightRef.current || transcribe.listening) return;
      voiceStartInFlightRef.current = true;
      try {
        await speechControllerRef.current?.stop();
        // Shake-to-talk: start transcribing at once.
        const started = await startListening(
          autoStartVoiceLanguage,
          { skipStop: true },
          { immediate: true },
        );
        if (!started) setVoiceConversation(false);
      } finally {
        voiceStartInFlightRef.current = false;
      }
    })();
  }, [
    autoStartVoiceLanguage,
    startListening,
    transcribe,
    visible,
    voiceStartRequest,
  ]);

  const toggleVoice = async () => {
    if (!transcribe.listening && isCallBusy()) {
      Alert.alert(
        'Voice input unavailable',
        'Voice input is unavailable during an audio, video, or live voice session.',
      );
      return;
    }
    if (transcribe.listening) {
      setVoiceConversation(false);
      setVoiceLanguageMenuOpen(false);
      await transcribe.stop();
      return;
    }
    if (voiceStartInFlightRef.current) return;
    voiceStartInFlightRef.current = true;
    // Tapping the mic while the agent thinks or talks interrupts it.
    if (loading) interruptAgent();
    await speechControllerRef.current?.stop().catch(() => {});
    setVoiceConversation(true);
    setVoiceTranscript('');
    // Voice in -> voice out: a spoken conversation is answered out loud.
    setSpeechEnabled(true);
    let started = false;
    try {
      started = await startListening(
        listenLanguage,
        { skipStop: true },
        { immediate: true },
      );
    } finally {
      voiceStartInFlightRef.current = false;
    }
    if (!started) {
      setVoiceConversation(false);
      setVoiceLanguageMenuOpen(false);
      Alert.alert(
        'Microphone unavailable',
        'Allow microphone access and try again.',
      );
    }
  };
  const toggleSpeech = async () => {
    const nextEnabled = !speechEnabled;
    setSpeechEnabled(nextEnabled);
    if (!nextEnabled) {
      await speechControllerRef.current?.stop();
      return;
    }

    if (voiceConversation && !transcribe.listening) {
      if (isCallBusy()) {
        setVoiceConversation(false);
        return;
      }
      const started = await startListening(
        listenLanguage,
        { skipStop: true },
        { immediate: true },
      );
      if (!started) setVoiceConversation(false);
    }
  };
  const restoreAndListen = async () => {
    if (isCallBusy()) {
      setVoiceConversation(false);
      return;
    }
    setMinimized(false);
    setSpeechEnabled(true);
    if (transcribe.listening) {
      setVoiceConversation(true);
      setVoiceTranscript('');
      return;
    }
    setVoiceConversation(true);
    await speechControllerRef.current?.stop().catch(() => {});
    const started = await startListening(
      listenLanguage,
      { skipStop: true },
      { immediate: true },
    );
    if (!started) setVoiceConversation(false);
  };
  const capabilities: Array<{
    icon: React.ComponentProps<typeof Icon>['name'];
    title: string;
    prompt: string;
    tint: string;
  }> = [
    { icon: 'chat', title: 'Messages', prompt: 'Open my messages', tint: '#3B82F6' },
    { icon: 'videocam', title: 'Calls', prompt: 'Start a video call', tint: '#10B981' },
    { icon: 'edit', title: 'Post', prompt: 'Create a post with a funny caption', tint: '#F59E0B' },
    { icon: 'task-alt', title: 'Tasks', prompt: 'What are my open tasks?', tint: '#8B5CF6' },
    { icon: 'ondemand-video', title: 'YouTube', prompt: 'Search YouTube for lo-fi music', tint: '#EF4444' },
    { icon: 'sports-esports', title: 'Games', prompt: 'Start a Ludo game', tint: '#14B8A6' },
    { icon: 'event-note', title: 'Plan', prompt: 'Add an event tomorrow at 10:00: team meeting', tint: '#EC4899' },
    { icon: 'notifications', title: 'Updates', prompt: 'Any new notifications?', tint: '#0EA5E9' },
  ];

  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(
    null,
  );
  const copyMessage = React.useCallback(async (item: AgentMessage) => {
    const text = [
      item.content,
      ...(item.actionResults || []).map(result => result.message),
    ]
      .filter(Boolean)
      .join('\n');
    if (!text.trim()) return;
    try {
      await Clipboard.setStringAsync(text);
      setCopiedMessageId(item.id);
      setTimeout(
        () => setCopiedMessageId(current => (current === item.id ? null : current)),
        1500,
      );
    } catch (error) {
      if (__DEV__) console.warn('[AI] Copy failed:', error);
    }
  }, []);

  const renderActionResults = (results: NonNullable<AgentMessage['actionResults']>) => (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.primary,
        },
      ]}
    >
      {results.map((result, index) => {
        const tone = result.ok
          ? colors.status.success
          : result.cancelled
          ? colors.text.tertiary
          : colors.status.error;
        return (
          <View
            key={`${result.action}-${index}`}
            style={[
              styles.resultRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border.primary,
              },
            ]}
          >
            <Icon
              name={result.ok ? 'check-circle' : result.cancelled ? 'block' : 'error'}
              size={18}
              color={tone}
              style={styles.resultIcon}
            />
            <View style={styles.resultBody}>
              <Text style={[styles.resultLabel, { color: tone }]}>
                {result.label || getAgentActionLabel(result.action)}
              </Text>
              <Text
                selectable
                style={[styles.resultText, { color: colors.text.primary }]}
              >
                {result.message}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderMessage = ({ item, index }: { item: AgentMessage; index: number }) => {
    const isUser = item.type === 'user';
    const isLast = index === messages.length - 1;
    const hasResults = Boolean(item.actionResults?.length);
    const showBubble = Boolean(item.content) || (item.streaming && !hasResults);
    const choiceIcon: React.ComponentProps<typeof Icon>['name'] =
      item.choiceAction === 'START_VIDEO_CALL'
        ? 'videocam'
        : item.choiceAction === 'START_AUDIO_CALL'
        ? 'call'
        : item.choiceAction === 'SEND_MESSAGE' || item.choiceAction === 'OPEN_CHAT'
        ? 'chat'
        : item.choiceAction === 'INVITE_LUDO_PLAYER'
        ? 'sports-esports'
        : 'arrow-forward';
    return (
      <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
        {!isUser && (
          <LinearGradient
            colors={[colors.primary, '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Icon name="auto-awesome" size={14} color="#fff" />
          </LinearGradient>
        )}
        <Pressable
          style={[styles.messageColumn, isUser && styles.userMessageColumn]}
          onLongPress={() => {
            void copyMessage(item);
          }}
          delayLongPress={350}
        >
          {showBubble ? (
            <View
              style={[
                styles.bubble,
                isUser
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : [
                      styles.agentBubble,
                      {
                        backgroundColor: colors.surface.secondary,
                        borderColor: colors.border.primary,
                      },
                    ],
              ]}
            >
              {item.streaming && !item.content ? (
                runningActionLabel && isLast ? (
                  <View style={styles.runningRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.runningText, { color: colors.text.secondary }]}>
                      {runningActionLabel}…
                    </Text>
                  </View>
                ) : (
                  <TypingDots color={colors.text.secondary} />
                )
              ) : (
                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? '#fff' : colors.text.primary },
                  ]}
                >
                  {item.content}
                </Text>
              )}
            </View>
          ) : null}
          {hasResults ? renderActionResults(item.actionResults!) : null}
          {item.profileChoices?.length ? (
            <View style={styles.profileChoices}>
              {item.profileChoices.map(choice => (
                <Pressable
                  key={choice.id}
                  onPress={() => {
                    void chooseProfileForAction(choice);
                  }}
                  style={({ pressed }) => [
                    styles.profileChoice,
                    {
                      backgroundColor: colors.surface.secondary,
                      borderColor: colors.border.primary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {choice.profilePic ? (
                    <Image
                      source={{ uri: choice.profilePic }}
                      style={styles.profileChoiceImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.profileChoicePlaceholder,
                        { backgroundColor: `${colors.primary}20` },
                      ]}
                    >
                      <Icon name="person" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.profileChoiceText}>
                    <Text
                      numberOfLines={1}
                      style={[styles.profileChoiceName, { color: colors.text.primary }]}
                    >
                      {choice.name}
                    </Text>
                    {choice.username ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.profileChoiceUsername,
                          { color: colors.text.secondary },
                        ]}
                      >
                        @{choice.username}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.profileChoiceAction,
                      { backgroundColor: `${colors.primary}18` },
                    ]}
                  >
                    <Icon name={choiceIcon} size={17} color={colors.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text
            style={[
              styles.time,
              isUser && styles.userTime,
              { color: copiedMessageId === item.id ? colors.primary : colors.text.tertiary },
            ]}
          >
            {copiedMessageId === item.id
              ? 'Copied'
              : new Date(item.timestamp).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={[colors.primary, '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroOrb}
      >
        <Icon name="auto-awesome" size={30} color="#fff" />
      </LinearGradient>
      <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
        {settings.language === 'bn' ? 'কী করতে পারি?' : 'What can I do for you?'}
      </Text>
      <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
        {settings.language === 'bn'
          ? 'বলুন বা লিখুন — আমি Connect-এ কাজগুলো করে দেব।'
          : 'Type or speak — I can run actions across Connect for you.'}
      </Text>
      <Pressable
        onPress={() => {
          void toggleVoice();
        }}
        disabled={!transcribe.supported}
        style={({ pressed }) => [
          styles.heroTalk,
          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={bn ? 'কথা বলতে চাপুন' : 'Tap to talk'}
      >
        <LinearGradient
          colors={[colors.primary, '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroTalkCircle}
        >
          <Icon name="mic" size={44} color="#fff" />
        </LinearGradient>
        <Text style={[styles.heroTalkLabel, { color: colors.text.primary }]}>
          {bn ? 'কথা বলতে চাপুন' : 'Tap to talk'}
        </Text>
        <Text style={[styles.heroTalkHint, { color: colors.text.secondary }]}>
          {bn
            ? 'বাংলা বা ইংরেজি — যেভাবে খুশি বলুন'
            : 'Speak in Bangla or English'}
        </Text>
      </Pressable>
      <View style={styles.capabilityGrid}>
        {capabilities.map(capability => (
          <Pressable
            key={capability.title}
            onPress={() => {
              void send(capability.prompt);
            }}
            disabled={loading}
            style={({ pressed }) => [
              styles.capabilityCard,
              {
                backgroundColor: colors.surface.secondary,
                borderColor: colors.border.primary,
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.capabilityIcon,
                { backgroundColor: `${capability.tint}1F` },
              ]}
            >
              <Icon name={capability.icon} size={18} color={capability.tint} />
            </View>
            <Text style={[styles.capabilityTitle, { color: colors.text.primary }]}>
              {capability.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.capabilityPrompt, { color: colors.text.secondary }]}
            >
              {capability.prompt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const isFreshChat =
    messages.length <= 1 && messages.every(item => item.type !== 'user');
  const bn = settings.language === 'bn';
  const voicePhase: {
    label: string;
    hint: string;
    color: string;
    icon: React.ComponentProps<typeof Icon>['name'];
    busy: boolean;
  } = runningActionLabel
    ? {
        label: bn ? 'কাজ করছি…' : 'Doing it…',
        hint: runningActionLabel,
        color: colors.primary,
        icon: 'bolt',
        busy: true,
      }
    : voiceRefining
    ? {
        label: bn ? 'বুঝছি…' : 'Understanding…',
        hint: bn ? 'আপনার কথা ঠিকভাবে লিখছি' : 'Getting your words right',
        color: colors.status.warning,
        icon: 'graphic-eq',
        busy: true,
      }
    : loading
    ? {
        label: bn ? 'ভাবছি…' : 'Thinking…',
        hint: bn ? 'এক মুহূর্ত' : 'One moment',
        color: colors.status.warning,
        icon: 'auto-awesome',
        busy: true,
      }
    : transcribe.listening
    ? {
        label: bn ? 'শুনছি… বলুন' : 'Listening… go ahead',
        hint: bn
          ? 'যেমন: "রহিমকে ভিডিও কল দাও"'
          : 'For example: "Video call Rahim"',
        color: colors.status.error,
        icon: 'mic',
        busy: false,
      }
    : {
        label: bn ? 'মাইক বন্ধ' : 'Mic paused',
        hint: bn ? 'আবার বলতে মাইক চাপুন' : 'Tap the mic to talk again',
        color: colors.text.secondary,
        icon: 'mic-none',
        busy: false,
      };
  const statusTone = loading
    ? colors.status.warning
    : transcribe.listening
    ? colors.status.error
    : colors.status.success;
  const statusLabel = runningActionLabel
    ? `Running · ${runningActionLabel}`
    : voiceRefining
    ? 'Understanding your voice…'
    : loading
    ? 'Thinking…'
    : transcribe.listening
    ? 'Listening…'
    : voiceConversation
    ? 'Hands-free voice mode'
    : autoMode
    ? 'Auto-runs actions'
    : 'Asks before acting';

  const runPendingAction = async (action: AgentActionIntent) => {
    const startsCall =
      action.action === 'START_AUDIO_CALL' ||
      action.action === 'START_VIDEO_CALL';
    let mediaStarted = false;
    try {
      const adapter = buildAdapter(speechEnabled, lastReplyLanguageRef.current);
      updateAutoActionRunning(true);
      setRunningActionLabel(getAgentActionLabel(action.action));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (startsCall) {
        setVoiceConversation(false);
        await transcribe.stop({ discard: true });
        await restoreChatPlaybackAudioMode();
      }
      // Tapping Run / picking a person is the confirmation for sensitive
      // actions; destructive ones still ask.
      const results = await executeAgentActions([action], adapter, {
        skipConfirmation: true,
        confirm: confirmAgentAction,
      });
      mediaStarted = results.some(
        result => result.ok && MEDIA_ACTIONS.has(result.action),
      );
      setPendingActions(previous => previous.filter(item => item !== action));
      if (ambiguityRef.current?.length) {
        const profileChoices = ambiguityRef.current;
        ambiguityRef.current = undefined;
        ambiguousActionRef.current = action;
        ambiguityChoicesRef.current = profileChoices;
        const question = `I found a few people: ${profileChoices
          .map((choice, index) => `${index + 1}. ${choice.name}`)
          .join(', ')}. Who did you mean?`;
        setMessages(previous => [
          ...previous,
          {
            id: id(),
            type: 'agent',
            content: question,
            timestamp: new Date().toISOString(),
            profileChoices,
          },
        ]);
        await speakLine(question);
        return;
      }
      const message = results.map(result => result.message).join(' ');
      setMessages(previous => [
        ...previous,
        {
          id: id(),
          type: 'action-result',
          content: '',
          timestamp: new Date().toISOString(),
          success: results.every(result => result.ok),
          actionResults: results,
        },
      ]);
      if (!startsCall) await speakLine(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setMessages(previous => [
        ...previous,
        {
          id: id(),
          type: 'action-result',
          content: message,
          timestamp: new Date().toISOString(),
          success: false,
        },
      ]);
      await speakLine(message);
    } finally {
      updateAutoActionRunning(false);
      setRunningActionLabel('');
      // Keep a hands-free conversation going after a tap or spoken choice.
      if (voiceConversation && mediaStarted) {
        setVoiceConversation(false);
      } else if (voiceConversation && !startsCall && !isCallBusy()) {
        const started = await startListening(listenLanguage);
        if (!started) setVoiceConversation(false);
      }
    }
  };
  const chooseProfileForAction = async (choice: ProfileChoice) => {
    const action = ambiguousActionRef.current;
    if (!action) return;
    ambiguousActionRef.current = null;
    ambiguityChoicesRef.current = [];
    await runPendingAction({
      ...action,
      parameters: {
        ...(action.parameters || {}),
        userId: choice.id,
        userName: choice.name,
      },
      targetName: choice.name,
    });
  };

  const availableProviders = providerStatus
    ? (Object.keys(providerLabels) as AIProvider[]).filter(
        provider =>
          providerStatus.enabled[provider] !== false &&
          providerStatus.configured[provider],
      )
    : [];
  const describePendingAction = (action: AgentActionIntent) => {
    const parameters = action.parameters || {};
    return (
      [
        parameters.userName || action.targetName,
        parameters.message ||
          parameters.caption ||
          parameters.content ||
          parameters.text ||
          parameters.title ||
          parameters.name ||
          action.messageText,
        parameters.query || action.searchQuery,
        parameters.date,
      ]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join(' · ') || 'Tap Run to continue'
    );
  };
  const runAllPendingActions = async () => {
    for (const action of [...pendingActions]) {
      // Sequential on purpose: later actions may depend on earlier ones.
      await runPendingAction(action);
    }
  };

  return (
    <>
      {visible && !minimized && (
        <Modal
          animationType="slide"
          onRequestClose={close}
          statusBarTranslucent={false}
        >
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
                <LinearGradient
                  colors={[colors.primary, '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.headerIcon}
                >
                  <Icon name="auto-awesome" size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.title}>
                  <Text style={[styles.heading, { color: colors.text.primary }]}>
                    Connect AI
                  </Text>
                  <View style={styles.statusLine}>
                    <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
                    <Text
                      numberOfLines={1}
                      style={[styles.statusText, { color: colors.text.secondary }]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: autoMode
                        ? `${colors.primary}1F`
                        : colors.surface.secondary,
                    },
                  ]}
                  onPress={() => setAutoMode(value => !value)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: autoMode }}
                  accessibilityLabel={`Auto-run actions ${autoMode ? 'on' : 'off'}`}
                  hitSlop={6}
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
                    {autoMode ? 'Auto' : 'Ask'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.headerButton,
                    speechEnabled && { backgroundColor: `${colors.primary}18` },
                  ]}
                  onPress={() => {
                    void toggleSpeech();
                  }}
                  accessibilityLabel={speechEnabled ? 'Turn speaking off' : 'Turn speaking on'}
                  hitSlop={4}
                >
                  <Icon
                    name={speechEnabled ? 'volume-up' : 'volume-off'}
                    size={20}
                    color={speechEnabled ? colors.primary : colors.text.secondary}
                  />
                </Pressable>
                <Pressable
                  style={styles.headerButton}
                  onPress={() => setMinimized(true)}
                  accessibilityLabel="Minimize AI Agent"
                  hitSlop={4}
                >
                  <Icon name="minimize" size={20} color={colors.text.secondary} />
                </Pressable>
                <Pressable
                  style={styles.headerButton}
                  onPress={close}
                  accessibilityLabel="Close AI Agent"
                  hitSlop={4}
                >
                  <Icon name="close" size={22} color={colors.text.primary} />
                </Pressable>
              </View>
              <View
                style={[
                  styles.toolbar,
                  {
                    backgroundColor: colors.surface.primary,
                    borderBottomColor: colors.border.primary,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setProviderMenuOpen(value => !value)}
                  disabled={!availableProviders.length}
                  style={[
                    styles.toolbarChip,
                    { backgroundColor: colors.surface.secondary },
                  ]}
                  accessibilityLabel="Select AI provider"
                >
                  <Icon name="psychology" size={15} color={colors.primary} />
                  <Text style={[styles.toolbarChipText, { color: colors.text.primary }]}>
                    {providerLabels[selectedProvider]}
                  </Text>
                  {availableProviders.length > 1 ? (
                    <Icon
                      name={providerMenuOpen ? 'expand-less' : 'expand-more'}
                      size={16}
                      color={colors.text.secondary}
                    />
                  ) : null}
                </Pressable>
                <View style={styles.flex} />
                <Pressable
                  onPress={clear}
                  disabled={isFreshChat || loading}
                  style={[
                    styles.toolbarChip,
                    {
                      backgroundColor: colors.surface.secondary,
                      opacity: isFreshChat || loading ? 0.45 : 1,
                    },
                  ]}
                  accessibilityLabel="Clear AI chat"
                >
                  <Icon name="delete-outline" size={15} color={colors.text.secondary} />
                  <Text style={[styles.toolbarChipText, { color: colors.text.secondary }]}>
                    Clear
                  </Text>
                </Pressable>
              </View>
              {providerMenuOpen && availableProviders.length > 0 && (
                <View
                  style={[
                    styles.providerMenu,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.primary,
                    },
                  ]}
                >
                  {availableProviders.map(provider => (
                    <Pressable
                      key={provider}
                      onPress={() => chooseProvider(provider)}
                      style={({ pressed }) => [
                        styles.providerOption,
                        pressed && { backgroundColor: colors.surface.secondary },
                      ]}
                    >
                      <Icon
                        name={
                          selectedProvider === provider
                            ? 'radio-button-checked'
                            : 'radio-button-unchecked'
                        }
                        size={18}
                        color={
                          selectedProvider === provider
                            ? colors.primary
                            : colors.text.tertiary
                        }
                      />
                      <Text
                        style={[styles.providerOptionText, { color: colors.text.primary }]}
                      >
                        {providerLabels[provider]}
                      </Text>
                      {providerStatus?.models[provider] ? (
                        <Text
                          numberOfLines={1}
                          style={[styles.providerModel, { color: colors.text.tertiary }]}
                        >
                          {String(providerStatus.models[provider]).split('/').pop()}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
              <FlatList
                ref={listRef}
                style={styles.flex}
                contentContainerStyle={[
                  styles.messages,
                  isFreshChat && styles.messagesEmpty,
                ]}
                data={isFreshChat ? [] : messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onContentSizeChange={() =>
                  listRef.current?.scrollToEnd({ animated: true })
                }
                ListEmptyComponent={renderEmptyState}
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
                  <View style={styles.actionTrayHeader}>
                    <Text style={[styles.actionTrayTitle, { color: colors.text.secondary }]}>
                      {pendingActions.length === 1
                        ? 'Ready to run'
                        : `${pendingActions.length} actions ready`}
                    </Text>
                    <View style={styles.actionTrayButtons}>
                      <Pressable
                        onPress={() => setPendingActions([])}
                        hitSlop={6}
                        accessibilityLabel="Dismiss suggested actions"
                      >
                        <Text style={[styles.actionTrayLink, { color: colors.text.secondary }]}>
                          Dismiss
                        </Text>
                      </Pressable>
                      {pendingActions.length > 1 ? (
                        <Pressable
                          onPress={() => {
                            void runAllPendingActions();
                          }}
                          disabled={autoActionRunning}
                          hitSlop={6}
                          accessibilityLabel="Run all suggested actions"
                        >
                          <Text style={[styles.actionTrayLink, { color: colors.primary }]}>
                            Run all
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {pendingActions.map((action, index) => (
                    <View
                      key={`${action.id || action.action}-${index}`}
                      style={[
                        styles.actionCard,
                        {
                          backgroundColor: colors.surface.secondary,
                          borderColor: colors.border.primary,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.actionCardIcon,
                          { backgroundColor: `${colors.primary}1A` },
                        ]}
                      >
                        <Icon name="bolt" size={16} color={colors.primary} />
                      </View>
                      <View style={styles.actionCardBody}>
                        <Text style={[styles.actionCardTitle, { color: colors.text.primary }]}>
                          {getAgentActionLabel(action.action)}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.actionCardSubtitle,
                            { color: colors.text.secondary },
                          ]}
                        >
                          {describePendingAction(action)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          void runPendingAction(action);
                        }}
                        disabled={autoActionRunning}
                        style={({ pressed }) => [
                          styles.runButton,
                          {
                            backgroundColor: colors.primary,
                            opacity: autoActionRunning ? 0.5 : pressed ? 0.8 : 1,
                          },
                        ]}
                        accessibilityLabel={`Run ${getAgentActionLabel(action.action)}`}
                      >
                        <Icon name="play-arrow" size={16} color="#fff" />
                        <Text style={styles.runText}>Run</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {voiceConversation && voiceLanguageMenuOpen && (
                <View
                  style={[styles.voiceLanguageBar, { backgroundColor: colors.surface.primary }]}
                >
                  <Text style={[styles.voiceLanguageLabel, { color: colors.text.secondary }]}>
                    Voice
                  </Text>
                  {(['auto', 'bn-BD', 'en-US'] as AgentSpeechLanguage[]).map(option => (
                    <Pressable
                      key={option}
                      onPress={() => {
                        void selectVoiceLanguage(option);
                      }}
                      style={[
                        styles.voiceLanguageOption,
                        {
                          backgroundColor:
                            language === option
                              ? `${colors.primary}20`
                              : colors.surface.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.language,
                          {
                            color:
                              language === option ? colors.primary : colors.text.secondary,
                          },
                        ]}
                      >
                        {option === 'bn-BD' ? 'বাংলা' : option === 'en-US' ? 'English' : 'Auto'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {voiceConversation ? (
                <View
                  style={[
                    styles.voicePanel,
                    {
                      backgroundColor: colors.surface.secondary,
                      borderColor: colors.border.primary,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      void toggleVoice();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={voicePhase.label}
                    hitSlop={8}
                  >
                    <PulseMic
                      active={transcribe.listening}
                      color={voicePhase.color}
                      icon={voicePhase.icon}
                      busy={voicePhase.busy}
                    />
                  </Pressable>
                  <View style={styles.voicePanelText}>
                    <Text style={[styles.voicePhase, { color: voicePhase.color }]}>
                      {agentTalking && !voicePhase.busy
                        ? bn
                          ? 'বলছি…'
                          : 'Speaking…'
                        : voicePhase.label}
                    </Text>
                    <Text
                      numberOfLines={3}
                      style={[
                        styles.voiceTranscript,
                        {
                          color: voiceTranscript
                            ? colors.text.primary
                            : colors.text.tertiary,
                        },
                      ]}
                    >
                      {voiceTranscript || voicePhase.hint}
                    </Text>
                  </View>
                  {voicePhase.busy || agentTalking ? (
                    <Pressable
                      onPress={stopGenerating}
                      style={({ pressed }) => [
                        styles.voiceStop,
                        { backgroundColor: colors.status.error, opacity: pressed ? 0.8 : 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={bn ? 'থামান' : 'Stop'}
                      hitSlop={8}
                    >
                      <Icon name="stop" size={20} color="#fff" />
                      <Text style={styles.voiceStopText}>{bn ? 'থামান' : 'Stop'}</Text>
                    </Pressable>
                  ) : null}
                </View>
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
                        ? `${colors.status.error}1F`
                        : colors.surface.secondary,
                    },
                  ]}
                  onPress={toggleVoice}
                  onLongPress={() => setVoiceLanguageMenuOpen(value => !value)}
                  disabled={loading || !transcribe.supported}
                  accessibilityLabel={
                    transcribe.listening
                      ? 'Stop hands-free voice commands'
                      : 'Start hands-free voice commands'
                  }
                >
                  <Icon
                    name={transcribe.listening ? 'mic' : 'mic-none'}
                    size={22}
                    color={
                      transcribe.listening ? colors.status.error : colors.text.secondary
                    }
                  />
                </Pressable>
                <TextInput
                  value={input}
                  onChangeText={text => {
                    voiceInputBaseRef.current = text;
                    setInput(text);
                  }}
                  multiline
                  placeholder={
                    settings.language === 'bn'
                      ? 'কিছু জিজ্ঞেস করুন বা একটি কাজ বলুন…'
                      : 'Ask anything or tell me what to do…'
                  }
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
                  onSubmitEditing={() => {
                    void send();
                  }}
                  blurOnSubmit={false}
                  returnKeyType="send"
                />
                {loading || agentTalking || autoActionRunning ? (
                  <Pressable
                    onPress={stopGenerating}
                    style={[styles.send, { backgroundColor: colors.text.primary }]}
                    accessibilityLabel="Stop"
                  >
                    <Icon name="stop" size={20} color={colors.background.primary} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      void send();
                    }}
                    disabled={!input.trim()}
                    style={[
                      styles.send,
                      {
                        backgroundColor: colors.primary,
                        opacity: input.trim() ? 1 : 0.4,
                      },
                    ]}
                    accessibilityLabel="Send"
                  >
                    <Icon name="arrow-upward" size={21} color="#fff" />
                  </Pressable>
                )}
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      )}
      {visible && minimized && (
        <Animated.View
          {...miniPanResponder.panHandlers}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            miniSize.current = { width, height };
          }}
          style={[
            styles.agentMini,
            {
              transform: miniPosition.getTranslateTransform(),
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.primary,
            },
          ]}
        >
          <Pressable
            style={styles.agentMiniContent}
            onPress={restoreAndListen}
            accessibilityRole="button"
            accessibilityLabel="Restore AI Agent"
            hitSlop={4}
          >
            <LinearGradient
              colors={[colors.primary, '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.agentMiniOrb}
            >
              {autoActionRunning || loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="auto-awesome" size={18} color="#fff" />
              )}
            </LinearGradient>
            <View style={styles.agentMiniTextWrap}>
              <Text
                numberOfLines={1}
                style={[styles.agentMiniTitle, { color: colors.text.primary }]}
              >
                AI Agent
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.agentMiniStatus,
                  {
                    color: transcribe.listening
                      ? colors.status.error
                      : autoActionRunning || loading
                      ? colors.primary
                      : colors.text.secondary,
                  },
                ]}
              >
                {autoActionRunning
                  ? runningActionLabel || 'Running…'
                  : loading
                  ? 'Thinking…'
                  : transcribe.listening
                  ? voiceTranscript || 'Listening…'
                  : agentTalking
                  ? 'Speaking…'
                  : 'Tap to open'}
              </Text>
            </View>
          </Pressable>
          <View
            style={[styles.agentMiniDivider, { backgroundColor: colors.border.primary }]}
          />
          <View style={styles.agentMiniControls}>
            {loading || agentTalking || autoActionRunning ? (
              <Pressable
                style={[styles.agentMiniMic, { backgroundColor: colors.status.error }]}
                onPress={stopGenerating}
                accessibilityLabel="Stop"
                hitSlop={4}
              >
                <Icon name="stop" size={16} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.agentMiniMic,
                {
                  backgroundColor: transcribe.listening
                    ? `${colors.status.error}24`
                    : `${colors.primary}20`,
                },
              ]}
              onLongPress={() => setVoiceLanguageMenuOpen(value => !value)}
              onPress={toggleVoice}
              accessibilityLabel="Voice input"
              hitSlop={4}
            >
              <Icon
                name={transcribe.listening ? 'mic' : 'mic-none'}
                size={17}
                color={transcribe.listening ? colors.status.error : colors.primary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.agentMiniMic,
                {
                  backgroundColor: speechEnabled
                    ? `${colors.primary}20`
                    : colors.surface.secondary,
                },
              ]}
              onPress={() => {
                void toggleSpeech();
              }}
              accessibilityLabel={speechEnabled ? 'Turn speaking off' : 'Turn speaking on'}
              hitSlop={4}
            >
              <Icon
                name={speechEnabled ? 'volume-up' : 'volume-off'}
                size={17}
                color={speechEnabled ? colors.primary : colors.text.secondary}
              />
            </Pressable>
          </View>
          {voiceLanguageMenuOpen && minimized && (
            <View
              style={[
                styles.agentMiniLanguageMenu,
                {
                  backgroundColor: colors.surface.primary,
                  borderColor: colors.border.primary,
                },
              ]}
            >
              {(['auto', 'bn-BD', 'en-US'] as AgentSpeechLanguage[]).map(option => (
                <Pressable
                  key={`mini-${option}`}
                  onPress={() => {
                    setVoiceLanguageMenuOpen(false);
                    void selectVoiceLanguage(option);
                  }}
                  style={[
                    styles.agentMiniMenuOption,
                    {
                      backgroundColor:
                        language === option ? `${colors.primary}20` : colors.surface.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.language,
                      { color: language === option ? colors.primary : colors.text.secondary },
                    ]}
                  >
                    {option === 'bn-BD' ? 'বাংলা' : option === 'en-US' ? 'English' : 'Auto'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>
      )}
    </>
  );
};

/** Large mic badge; the ring breathes while listening or working. */
const PulseMic = ({
  active,
  busy,
  color,
  icon,
}: {
  active: boolean;
  busy: boolean;
  color: string;
  icon: React.ComponentProps<typeof Icon>['name'];
}) => {
  const pulse = React.useRef(new Animated.Value(0)).current;
  const animate = active || busy;
  React.useEffect(() => {
    if (!animate) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, pulse]);
  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: `${color}33`,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.12] }) },
            ],
          },
        ]}
      />
      <View style={[styles.pulseCore, { backgroundColor: color }]}>
        <Icon name={icon} size={26} color="#fff" />
      </View>
    </View>
  );
};

/** Three softly pulsing dots used while the agent is thinking. */
const TypingDots = ({ color }: { color: string }) => {
  const values = React.useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  React.useEffect(() => {
    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - index) * 150),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [values]);
  return (
    <View style={styles.typingDots} accessibilityLabel="Thinking">
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: value,
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, marginLeft: 4 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, flexShrink: 1 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButton: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeText: { fontSize: 12, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarChip: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  toolbarChipText: { fontSize: 12, fontWeight: '600' },
  providerMenu: {
    position: 'absolute',
    top: 102,
    left: 12,
    minWidth: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 6,
    zIndex: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  providerOptionText: { fontSize: 14, fontWeight: '600' },
  providerModel: { fontSize: 11, marginLeft: 'auto', maxWidth: 110 },
  language: { fontSize: 12, fontWeight: '700' },
  voiceLanguageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voiceLanguageLabel: { fontSize: 12, fontWeight: '600', marginRight: 2 },
  voiceLanguageOption: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10 },
  voicePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  voicePanelText: { flex: 1 },
  voiceStop: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voiceStopText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  voicePhase: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  voiceTranscript: { fontSize: 15, lineHeight: 21, marginTop: 3 },
  pulseWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 64, height: 64, borderRadius: 32 },
  pulseCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTalk: { alignItems: 'center', marginBottom: 22 },
  heroTalkCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  heroTalkLabel: { fontSize: 20, fontWeight: '800', marginTop: 12 },
  heroTalkHint: { fontSize: 13, marginTop: 3 },
  transcriptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  transcriptText: { flex: 1, fontSize: 13, fontStyle: 'italic' },
  messages: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 20, gap: 16 },
  messagesEmpty: { flexGrow: 1, justifyContent: 'center' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  userMessageRow: { justifyContent: 'flex-end' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageColumn: { maxWidth: '86%', flexShrink: 1 },
  userMessageColumn: { alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { borderRadius: 20, borderBottomRightRadius: 6 },
  agentBubble: {
    borderRadius: 20,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 10, marginTop: 4, marginHorizontal: 6 },
  userTime: { textAlign: 'right' },
  runningRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runningText: { fontSize: 13, fontWeight: '600' },
  resultCard: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  resultRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  resultIcon: { marginTop: 1 },
  resultBody: { flex: 1 },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  resultText: { fontSize: 14, lineHeight: 20 },
  profileChoices: { marginTop: 8, gap: 7 },
  profileChoice: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileChoiceImage: { width: 38, height: 38, borderRadius: 19 },
  profileChoicePlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileChoiceText: { flex: 1 },
  profileChoiceName: { fontSize: 14, fontWeight: '700' },
  profileChoiceUsername: { fontSize: 12, marginTop: 2 },
  profileChoiceAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 12 },
  heroOrb: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  capabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    width: '100%',
  },
  capabilityCard: {
    width: '48.5%',
    minHeight: 108,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  capabilityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  capabilityTitle: { fontSize: 14, fontWeight: '700' },
  capabilityPrompt: { fontSize: 12, lineHeight: 16, marginTop: 3 },
  actionTray: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionTrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionTrayTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  actionTrayButtons: { flexDirection: 'row', gap: 16 },
  actionTrayLink: { fontSize: 13, fontWeight: '700' },
  actionCard: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  actionCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardBody: { flex: 1 },
  actionCardTitle: { fontSize: 14, fontWeight: '700' },
  actionCardSubtitle: { fontSize: 12, marginTop: 2 },
  runButton: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  runText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentMini: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -28,
    maxWidth: 320,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  agentMiniContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  agentMiniOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentMiniTextWrap: { flexShrink: 1, minWidth: 64, maxWidth: 120 },
  agentMiniTitle: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  agentMiniStatus: { fontSize: 11, lineHeight: 14 },
  agentMiniDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
  agentMiniControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agentMiniMic: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentMiniLanguageMenu: {
    position: 'absolute',
    right: 8,
    top: 62,
    minWidth: 118,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  agentMiniMenuOption: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
});
export default AIAgentModal;
