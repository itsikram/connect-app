import { navigate as navigateWithQueue } from '../lib/navigationService';

export type AgentActionName =
  | 'NAVIGATE'
  | 'SEARCH_USERS'
  | 'VIEW_PROFILE'
  | 'OPEN_CHAT'
  | 'SEND_MESSAGE'
  | 'START_AUDIO_CALL'
  | 'START_VIDEO_CALL'
  | 'END_CALL'
  | 'SEARCH_VIDEO'
  | 'PLAY_VIDEO'
  | 'SEARCH_YOUTUBE'
  | 'DOWNLOAD_YOUTUBE'
  | 'FOLLOW_USER'
  | 'UNFOLLOW_USER'
  | 'BLOCK_USER'
  | 'UNBLOCK_USER'
  | 'OPEN_SETTINGS'
  | 'CHANGE_SETTING'
  | 'CREATE_TASK'
  | 'VIEW_TASKS'
  | 'UPDATE_TASK'
  | 'CREATE_AUTO_REPLY_RULE'
  | 'OPEN_LUDO'
  | 'INVITE_LUDO_PLAYER'
  | 'CREATE_NOTE'
  | 'CREATE_EVENT'
  | 'CREATE_HABIT'
  | 'CREATE_POST'
  | 'DELETE_TASK'
  | 'ADD_CONNECT'
  | 'REMOVE_CONNECT'
  | 'ACCEPT_CONNECT_REQUEST'
  | 'DECLINE_CONNECT_REQUEST'
  | 'QUERY_APP_DATA'
  | 'navigate_home'
  | 'navigate_connects'
  | 'navigate_videos'
  | 'navigate_message'
  | 'navigate_menu'
  | 'navigate_profile'
  | 'navigate_settings'
  | 'navigate_tasks'
  | 'navigate_camera'
  | 'navigate_gallery'
  | 'navigate_video_library'
  | 'navigate_downloads'
  | 'navigate_media_player'
  | 'navigate_facebook'
  | 'navigate_youtube'
  | 'navigate_vpn_browser'
  | 'navigate_cricbuzz'
  | 'navigate_maps'
  | 'navigate_contacts'
  | 'navigate_notes'
  | 'navigate_fitness'
  | 'navigate_wallet'
  | 'navigate_subscriptions'
  | 'navigate_calendar'
  | 'navigate_drive'
  | 'navigate_mail'
  | 'navigate_photos'
  | 'start_ludo'
  | 'start_chess'
  | 'start_voice_input'
  | 'stop_voice_input'
  | 'speak_text'
  | 'stop_speaking'
  | 'logout'
  | 'clear_agent_chat';

export type AgentActionIntent = {
  action: AgentActionName;
  id?: string;
  type?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  parameters?: Record<string, unknown>;
  targetName?: string;
  targetRoute?: string;
  searchQuery?: string;
  messageText?: string;
};

export type ParsedAgentIntent = {
  type?: 'action' | 'question' | 'response' | 'mixed';
  message?: string;
  speak?: boolean;
  requires_confirmation?: boolean;
  reply?: string;
  actions?: AgentActionIntent[];
  ask?: { field?: string; question?: string };
};

export type ParseAgentIntentResult =
  | { ok: true; intent: ParsedAgentIntent }
  | { ok: false; error: string; unsupportedActions?: string[] };

export type AgentActionDefinition = {
  name: AgentActionName;
  label: string;
  sensitive?: boolean;
  /** Irreversible or high-impact: always confirmed, even in Auto mode. */
  destructive?: boolean;
  /** Parameter hint shown to the model in the action catalog prompt. */
  params?: string;
};

// Keep this list in sync with the routes and controls exposed by App.tsx/Menu.tsx.
// [name, label, sensitive?, destructive?, parameter hint for the model]
const ACTIONS: readonly [AgentActionName, string, boolean?, boolean?, string?][] = [
  ['NAVIGATE', 'Navigate', false, false, 'route (screen name), params?'],
  ['SEARCH_USERS', 'Find users', false, false, 'query'],
  ['VIEW_PROFILE', 'View profile', false, false, 'userName | userId ("me" = own profile)'],
  ['OPEN_CHAT', 'Open chat', false, false, 'userName | userId'],
  ['SEND_MESSAGE', 'Send message', true, false, 'userName | userId, message'],
  ['START_AUDIO_CALL', 'Start audio call', true, false, 'userName | userId'],
  ['START_VIDEO_CALL', 'Start video call', true, false, 'userName | userId'],
  ['END_CALL', 'End call', true, false, 'userName | userId'],
  ['SEARCH_VIDEO', 'Search videos', false, false, 'query (Connect videos)'],
  ['PLAY_VIDEO', 'Play video', false, false, 'videoId'],
  ['SEARCH_YOUTUBE', 'Search YouTube', false, false, 'query'],
  ['DOWNLOAD_YOUTUBE', 'Download YouTube video', true, false, 'query | url | videoId, audioOnly?, quality?'],
  ['FOLLOW_USER', 'Follow user', true, false, 'userName | userId'],
  ['UNFOLLOW_USER', 'Unfollow user', true, false, 'userName | userId'],
  ['BLOCK_USER', 'Block user', true, true, 'userName | userId'],
  ['UNBLOCK_USER', 'Unblock user', true, false, 'userName | userId'],
  ['ADD_CONNECT', 'Send connect request', true, false, 'userName | userId'],
  ['REMOVE_CONNECT', 'Remove connect', true, true, 'userName | userId'],
  ['ACCEPT_CONNECT_REQUEST', 'Accept connect request', true, false, 'userName? (omit = newest request)'],
  ['DECLINE_CONNECT_REQUEST', 'Decline connect request', true, false, 'userName? (omit = newest request)'],
  ['OPEN_SETTINGS', 'Open settings'],
  ['CHANGE_SETTING', 'Change setting', true, false, 'setting, value'],
  ['CREATE_TASK', 'Create task', true, false, 'text'],
  ['VIEW_TASKS', 'View tasks'],
  ['UPDATE_TASK', 'Edit task', true, false, 'taskQuery | taskId, text?, completed?'],
  ['DELETE_TASK', 'Delete task', true, true, 'taskQuery | taskId'],
  ['CREATE_NOTE', 'Create note', true, false, 'content, title?'],
  ['CREATE_EVENT', 'Add calendar event', true, false, 'title, date (YYYY-MM-DD), time? (HH:mm)'],
  ['CREATE_HABIT', 'Create habit', true, false, 'name'],
  ['CREATE_POST', 'Publish post', true, false, 'caption, publish? (false = open composer draft)'],
  ['QUERY_APP_DATA', 'Look up my data', false, false, 'dataType: tasks|notes|notifications|connects|requests|events|habits|profile, query?'],
  ['CREATE_AUTO_REPLY_RULE', 'Set automatic reply', true, false, 'triggerUserName, replyText'],
  ['OPEN_LUDO', 'Open Ludo'],
  ['INVITE_LUDO_PLAYER', 'Invite Ludo player', true, false, 'userName | userId'],
  ['navigate_home', 'Open Home'],
  ['navigate_connects', 'Open Connects'],
  ['navigate_videos', 'Open Videos'],
  ['navigate_message', 'Open Messages'],
  ['navigate_menu', 'Open Menu'],
  ['navigate_profile', 'Open profile'],
  ['navigate_settings', 'Open Settings'],
  ['navigate_tasks', 'Open Tasks'],
  ['navigate_notes', 'Open Notes'],
  ['navigate_fitness', 'Open Fitness'],
  ['navigate_wallet', 'Open Wallet'],
  ['navigate_subscriptions', 'Open Subscriptions'],
  ['navigate_calendar', 'Open Calendar'],
  ['navigate_drive', 'Open Google Drive'],
  ['navigate_mail', 'Open Gmail'],
  ['navigate_photos', 'Open Google Photos'],
  ['navigate_camera', 'Open Camera'],
  ['navigate_gallery', 'Open Gallery'],
  ['navigate_video_library', 'Open Video Library'],
  ['navigate_downloads', 'Open Downloads'],
  ['navigate_media_player', 'Open Media Player'],
  ['navigate_facebook', 'Open Facebook'],
  ['navigate_youtube', 'Open YouTube'],
  ['navigate_vpn_browser', 'Open VPN Browser'],
  ['navigate_cricbuzz', 'Open Cricbuzz'],
  ['navigate_maps', 'Open Maps'],
  ['navigate_contacts', 'Open Contacts'],
  ['start_ludo', 'Start Ludo'],
  ['start_chess', 'Start Chess'],
  ['start_voice_input', 'Start voice input'],
  ['stop_voice_input', 'Stop voice input'],
  ['speak_text', 'Read text aloud', false, false, 'messageText'],
  ['stop_speaking', 'Stop speaking'],
  ['logout', 'Log out', true, true],
  ['clear_agent_chat', 'Clear agent chat', true, true],
];

export const AGENT_ACTION_CATALOG: readonly AgentActionDefinition[] =
  ACTIONS.map(([name, label, sensitive, destructive, params]) => ({
    name,
    label,
    sensitive,
    destructive,
    params,
  }));

export const getAgentActionLabel = (name: string) =>
  AGENT_ACTION_CATALOG.find(definition => definition.name === name)?.label ||
  name.replace(/_/g, ' ').toLowerCase();

const PROMPT_HIDDEN_ACTIONS = new Set<AgentActionName>([
  'start_voice_input',
  'stop_voice_input',
  'stop_speaking',
]);

/**
 * Compact, model-facing description of every action the mobile app can run.
 * Injected into the system prompt so the model only plans real actions.
 */
export const describeAgentActionsForPrompt = () =>
  AGENT_ACTION_CATALOG.filter(
    definition => !PROMPT_HIDDEN_ACTIONS.has(definition.name),
  )
    .map(definition =>
      definition.params
        ? `${definition.name}(${definition.params}): ${definition.label}`
        : `${definition.name}: ${definition.label}`,
    )
    .join('\n');

const definitionByName = new Map(
  AGENT_ACTION_CATALOG.map(definition => [definition.name, definition]),
);
const ACTION_ALIASES: Record<string, AgentActionName> = {
  LUDU: 'OPEN_LUDO',
  OPEN_LUDU: 'OPEN_LUDO',
  START_LUDU: 'start_ludo',
  OPEN_LUDO_GAME: 'OPEN_LUDO',
  START_LUDO_GAME: 'start_ludo',
  INVITE_LUDU: 'INVITE_LUDO_PLAYER',
  INVITE_LUDU_PLAYER: 'INVITE_LUDO_PLAYER',
  CALL: 'START_AUDIO_CALL',
  AUDIO_CALL: 'START_AUDIO_CALL',
  START_AUDIO: 'START_AUDIO_CALL',
  START_CALL: 'START_AUDIO_CALL',
  MAKE_CALL: 'START_AUDIO_CALL',
  CALL_USER: 'START_AUDIO_CALL',
  VIDEO_CALL: 'START_VIDEO_CALL',
  START_VIDEO_CALLING: 'START_VIDEO_CALL',
  START_VIDEO: 'START_VIDEO_CALL',
  OPEN_PROFILE: 'VIEW_PROFILE',
  PROFILE: 'VIEW_PROFILE',
  OPEN_MESSAGES: 'navigate_message',
  FOLLOW: 'FOLLOW_USER',
  UNFOLLOW: 'UNFOLLOW_USER',
  BLOCK: 'BLOCK_USER',
  UNBLOCK: 'UNBLOCK_USER',
  ADD_TASK: 'CREATE_TASK',
  CREATE_TODO: 'CREATE_TASK',
  LIST_TASKS: 'VIEW_TASKS',
  SHOW_TASKS: 'VIEW_TASKS',
  EDIT_TASK: 'UPDATE_TASK',
  COMPLETE_TASK: 'UPDATE_TASK',
  AUTO_REPLY: 'CREATE_AUTO_REPLY_RULE',
  SEARCH_YT: 'SEARCH_YOUTUBE',
  YOUTUBE_SEARCH: 'SEARCH_YOUTUBE',
  DOWNLOAD_YT: 'DOWNLOAD_YOUTUBE',
  YOUTUBE_DOWNLOAD: 'DOWNLOAD_YOUTUBE',
  INVITE_LUDO: 'INVITE_LUDO_PLAYER',
  INVITE_LUDO_FRIEND: 'INVITE_LUDO_PLAYER',
  INVITE_FRIEND_TO_LUDO: 'INVITE_LUDO_PLAYER',
  ADD_NOTE: 'CREATE_NOTE',
  NEW_NOTE: 'CREATE_NOTE',
  WRITE_NOTE: 'CREATE_NOTE',
  ADD_EVENT: 'CREATE_EVENT',
  CREATE_CALENDAR_EVENT: 'CREATE_EVENT',
  ADD_HABIT: 'CREATE_HABIT',
  NEW_POST: 'CREATE_POST',
  WRITE_POST: 'CREATE_POST',
  PUBLISH_POST: 'CREATE_POST',
  SHARE_POST: 'CREATE_POST',
  REMOVE_TASK: 'DELETE_TASK',
  SEND_CONNECT_REQUEST: 'ADD_CONNECT',
  ADD_FRIEND: 'ADD_CONNECT',
  UNFRIEND: 'REMOVE_CONNECT',
  DISCONNECT: 'REMOVE_CONNECT',
  ACCEPT_CONNECT: 'ACCEPT_CONNECT_REQUEST',
  ACCEPT_REQUEST: 'ACCEPT_CONNECT_REQUEST',
  DECLINE_CONNECT: 'DECLINE_CONNECT_REQUEST',
  DECLINE_REQUEST: 'DECLINE_CONNECT_REQUEST',
  QUERY_CONTENT: 'QUERY_APP_DATA',
  LOOKUP: 'QUERY_APP_DATA',
  GET_MY_DETAILS: 'QUERY_APP_DATA',
  OPEN_NOTES: 'navigate_notes',
  OPEN_FITNESS: 'navigate_fitness',
  OPEN_WALLET: 'navigate_wallet',
  OPEN_CALENDAR: 'navigate_calendar',
  OPEN_CHESS: 'start_chess',
  PLAY_CHESS: 'start_chess',
  PLAY_LUDO: 'start_ludo',
};
const allowedIntentKeys = new Set([
  'reply',
  'actions',
  'ask',
  'type',
  'message',
  'speak',
  'requires_confirmation',
]);
const allowedActionKeys = new Set([
  'action',
  'targetName',
  'targetRoute',
  'searchQuery',
  'messageText',
  'taskId',
  'taskQuery',
  'taskText',
  'triggerUserName',
  'replyText',
  'id',
  'type',
  'status',
  'parameters',
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asOptionalString = (value: unknown) =>
  value === undefined || value === null ? undefined : String(value);

const optionalText = (
  value: unknown,
  field: string,
  maxLength = 500,
): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${field} must be a string`);
  }

  return value;
};

/**
 * Parse the model's machine-readable intent while retaining strict schema and
 * action validation. Providers sometimes wrap otherwise valid JSON in fences
 * or a short preamble, so extract only the outer JSON object before validating.
 */
export function parseAgentIntent(value: string): ParseAgentIntentResult {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: 'Intent is empty.' };
  }

  let parsed: unknown;
  try {
    const source = value.trim();
    const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = (fenced ? fenced[1] : source).trim();
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('missing JSON object');
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return { ok: false, error: 'Intent does not contain valid JSON.' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Intent is not a JSON object.' };
  }
  // Models regularly add harmless extra fields; drop them instead of
  // rejecting an otherwise valid plan.
  parsed = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => allowedIntentKeys.has(key)),
  );
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Intent is not a JSON object.' };
  }

  try {
    const intent: ParsedAgentIntent = {};
    if (parsed.type !== undefined) {
      if (
        !['action', 'question', 'response', 'mixed'].includes(
          String(parsed.type),
        )
      ) {
        throw new Error('type must be action, question, response, or mixed');
      }
      intent.type = parsed.type as ParsedAgentIntent['type'];
    }
    if (parsed.message !== undefined)
      intent.message = optionalText(parsed.message, 'message', 4000);
    if (parsed.speak !== undefined) {
      if (typeof parsed.speak !== 'boolean')
        throw new Error('speak must be boolean');
      intent.speak = parsed.speak;
    }
    if (parsed.requires_confirmation !== undefined) {
      if (typeof parsed.requires_confirmation !== 'boolean')
        throw new Error('requires_confirmation must be boolean');
      intent.requires_confirmation = parsed.requires_confirmation;
    }
    if (parsed.reply !== undefined)
      intent.reply = optionalText(parsed.reply, 'reply', 4000);
    if (!intent.reply && intent.message) intent.reply = intent.message;

    if (parsed.ask !== undefined) {
      if (!isRecord(parsed.ask)) {
        throw new Error('ask must be an object');
      }
      intent.ask = {
        field: optionalText(asOptionalString(parsed.ask.field), 'ask.field', 80),
        question: optionalText(
          asOptionalString(parsed.ask.question),
          'ask.question',
          1000,
        ),
      };
    }

    if (parsed.actions !== undefined) {
      if (!Array.isArray(parsed.actions) || parsed.actions.length > 8) {
        throw new Error('actions must be an array of at most 8 items');
      }
      const unsupportedActions: string[] = [];
      const mappedActions = parsed.actions.map(rawAction => {
        if (!isRecord(rawAction)) {
          throw new Error('each action must be an object');
        }
        // Fold loose top-level fields (e.g. "query", "userName") into
        // parameters so the executor can still use them.
        const extraParameters = Object.fromEntries(
          Object.entries(rawAction).filter(
            ([key, entry]) =>
              !allowedActionKeys.has(key) && entry !== undefined && entry !== null,
          ),
        );
        const requestedAction = rawAction.action || rawAction.type;
        const actionKey = typeof requestedAction === 'string'
          ? requestedAction.trim().toUpperCase().replace(/[\s-]+/g, '_')
          : '';
        const catalogAction = typeof requestedAction === 'string'
          ? AGENT_ACTION_CATALOG.find(
              definition =>
                definition.name.toUpperCase().replace(/[\s-]+/g, '_') === actionKey,
            )?.name
          : undefined;
        const actionName = typeof requestedAction === 'string'
          ? ACTION_ALIASES[actionKey] || catalogAction || requestedAction
          : requestedAction;
        if (typeof actionName !== 'string')
          throw new Error('action.type is required');
        const definition = definitionByName.get(actionName as AgentActionName);
        if (!definition) unsupportedActions.push(actionName);
        const parameters =
          isRecord(rawAction.parameters) || Object.keys(extraParameters).length
            ? {
                ...extraParameters,
                ...(isRecord(rawAction.parameters) ? rawAction.parameters : {}),
              }
            : undefined;
        const status = [
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
        ].includes(String(rawAction.status))
          ? (rawAction.status as AgentActionIntent['status'])
          : undefined;
        return {
          id: optionalText(asOptionalString(rawAction.id), 'action.id', 120),
          type: optionalText(asOptionalString(rawAction.type), 'action.type', 80),
          status,
          parameters,
          action: actionName as AgentActionName,
          targetName: optionalText(
            asOptionalString(rawAction.targetName),
            'targetName',
            160,
          ),
          targetRoute: optionalText(
            asOptionalString(rawAction.targetRoute),
            'targetRoute',
            160,
          ),
          searchQuery: optionalText(
            asOptionalString(rawAction.searchQuery),
            'searchQuery',
            500,
          ),
          messageText: optionalText(
            asOptionalString(rawAction.messageText),
            'messageText',
            2000,
          ),
        };
      });
      // Run whatever is supported; only fail when nothing runnable and
      // nothing to say is left.
      intent.actions = mappedActions.filter(action =>
        definitionByName.has(action.action),
      );
      if (
        unsupportedActions.length &&
        !intent.actions.length &&
        !intent.reply &&
        !intent.ask?.question
      ) {
        return {
          ok: false,
          error: 'Intent requested an unsupported action.',
          unsupportedActions,
        };
      }
    }
    if (!intent.reply && !intent.ask && !intent.actions?.length) {
      throw new Error('Intent must contain reply, ask, or actions');
    }
    return { ok: true, intent };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid intent.',
    };
  }
}

export type MobileAgentActionAdapter = {
  resolveUser?: (
    query: string,
  ) => Promise<{ id: string; name?: string; profilePic?: string } | null>;
  navigate?: (
    route: string,
    params?: Record<string, unknown>,
  ) => void | Promise<void>;
  startLudo?: () => void | Promise<void>;
  inviteLudoPlayer?: (userId: string, userName?: string) => void | Promise<void>;
  startChess?: () => void | Promise<void>;
  startVoiceInput?: () => void | Promise<void>;
  stopVoiceInput?: () => void | Promise<void>;
  speakText?: (text: string) => void | Promise<void>;
  stopSpeaking?: () => void | Promise<void>;
  logout?: () => void | Promise<void>;
  clearAgentChat?: () => void | Promise<void>;
  startAudioCall?: (userId: string, channelName: string, userName?: string, profilePic?: string) => void | Promise<void>;
  startVideoCall?: (userId: string, channelName: string, userName?: string, profilePic?: string) => void | Promise<void>;
  endCall?: (userId: string, channelName?: string) => void | Promise<void>;
  changeSetting?: (setting: string, value: unknown) => void | Promise<void>;
  playVideo?: (videoId: string) => void | Promise<void>;
  searchVideo?: (query: string) => void | Promise<void>;
  searchYoutube?: (query: string) => void | Promise<void>;
  downloadYoutube?: (options: {
    query?: string;
    url?: string;
    videoId?: string;
    title?: string;
    thumbnail?: string;
    quality?: number;
    audioOnly?: boolean;
  }) => void | Promise<void>;
  followUser?: (userId: string) => void | Promise<void>;
  unfollowUser?: (userId: string) => void | Promise<void>;
  blockUser?: (userId: string) => void | Promise<void>;
  unblockUser?: (userId: string) => void | Promise<void>;
  sendMessage?: (userId: string, message: string) => void | Promise<void>;
  createTask?: (text: string) => void | Promise<void>;
  updateTask?: (taskId: string, values: { text?: string; completed?: boolean }) => void | Promise<void>;
  resolveTask?: (query: string) => Promise<{ id: string } | null>;
  createAutoReplyRule?: (triggerUserName: string, replyText: string) => void | Promise<void>;
  deleteTask?: (taskId: string) => void | Promise<void>;
  createNote?: (content: string, title?: string) => void | Promise<void>;
  createEvent?: (event: { title: string; date: string; time?: string }) => void | Promise<void>;
  createHabit?: (name: string) => void | Promise<void>;
  /** Returns true when the post was published, false when a draft was opened. */
  createPost?: (caption: string, publish: boolean) => boolean | Promise<boolean>;
  sendConnectRequest?: (userId: string) => void | Promise<void>;
  removeConnect?: (userId: string) => void | Promise<void>;
  /** Resolves the request by name (or newest) and returns the requester name. */
  respondConnectRequest?: (
    accept: boolean,
    userName?: string,
  ) => string | Promise<string>;
  /** Returns a short, human-readable summary of the requested data. */
  queryAppData?: (dataType: string, query?: string) => string | Promise<string>;
};

export type AgentActionResult = {
  action: string;
  label?: string;
  ok: boolean;
  message: string;
  cancelled?: boolean;
};

export type AgentActionExecutionOptions = {
  confirm?: (
    definition: AgentActionDefinition,
    action: AgentActionIntent,
  ) => Promise<boolean>;
  /** Skips confirmation for sensitive actions. Destructive ones still confirm. */
  skipConfirmation?: boolean;
  onActionStart?: (action: AgentActionIntent, index: number) => void;
  onResolvedUser?: (user: { id: string; name?: string; profilePic?: string }) => void;
};

export function createMobileAgentActionAdapter(
  overrides: MobileAgentActionAdapter = {},
): MobileAgentActionAdapter {
  return {
    navigate: (route, params) => navigateWithQueue(route, params),
    ...overrides,
  };
}

const navigationTargets: Partial<
  Record<AgentActionName, [string, Record<string, unknown>?]>
> = {
  navigate_home: ['Home'],
  navigate_connects: ['Connects'],
  navigate_videos: ['Videos'],
  // Explicitly target MessageList so the Message tab remains intact.
  navigate_message: ['Message', { screen: 'MessageList' }],
  navigate_menu: ['Menu'],
  navigate_profile: ['Menu', { screen: 'MyProfile' }],
  navigate_settings: ['Menu', { screen: 'Settings' }],
  navigate_tasks: ['Menu', { screen: 'Tasks' }],
  navigate_camera: ['Home', { screen: 'Camera' }],
  navigate_gallery: ['Home', { screen: 'Gallery' }],
  navigate_video_library: ['Menu', { screen: 'VideoLibrary' }],
  navigate_downloads: ['Menu', { screen: 'Downloads' }],
  navigate_media_player: ['Menu', { screen: 'MediaPlayer' }],
  navigate_facebook: ['Menu', { screen: 'Facebook' }],
  navigate_youtube: ['Menu', { screen: 'YouTube' }],
  navigate_vpn_browser: ['VpnBrowser'],
  navigate_cricbuzz: ['Menu', { screen: 'Cricbuzz' }],
  navigate_maps: ['Menu', { screen: 'GoogleMaps' }],
  navigate_contacts: ['Menu', { screen: 'GoogleContacts' }],
  navigate_notes: ['Menu', { screen: 'Notes' }],
  navigate_fitness: ['Menu', { screen: 'FitnessDashboard' }],
  navigate_wallet: ['Menu', { screen: 'Wallet' }],
  navigate_subscriptions: ['Menu', { screen: 'Subscriptions' }],
  navigate_calendar: ['Menu', { screen: 'GoogleCalendar' }],
  navigate_drive: ['Menu', { screen: 'GoogleDrive' }],
  navigate_mail: ['Menu', { screen: 'GoogleMail' }],
  navigate_photos: ['Menu', { screen: 'GooglePhotos' }],
};

const pickText = (...values: unknown[]) => {
  for (const value of values) {
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
};

const clip = (value: string, max = 60) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const getActionSuccessMessage = (
  action: AgentActionIntent,
  definition: AgentActionDefinition,
  resolvedUserName: string,
  parameters: Record<string, unknown>,
) => {
  const target = resolvedUserName || action.targetName || '';
  switch (action.action) {
    case 'OPEN_LUDO':
    case 'start_ludo':
      return 'Ludo is open and ready to play.';
    case 'INVITE_LUDO_PLAYER':
      return target
        ? `Ludo invitation sent to ${target}.`
        : 'Ludo invitation sent.';
    case 'SEND_MESSAGE':
      return target
        ? `Message sent to ${target}: "${String(parameters.message || action.messageText || '')}"`
        : 'Message sent.';
    case 'FOLLOW_USER':
      return target ? `You are now following ${target}.` : 'User followed.';
    case 'UNFOLLOW_USER':
      return target ? `You stopped following ${target}.` : 'User unfollowed.';
    case 'BLOCK_USER':
      return target ? `${target} was blocked.` : 'User blocked.';
    case 'UNBLOCK_USER':
      return target ? `${target} was unblocked.` : 'User unblocked.';
    case 'VIEW_PROFILE':
      return target ? `${target}'s profile is open.` : 'Profile is open.';
    case 'OPEN_CHAT':
      return target ? `Chat with ${target} is open.` : 'Chat is open.';
    case 'CREATE_TASK':
      return `Task created: ${String(parameters.text || parameters.taskText || action.messageText || '')}`;
    case 'UPDATE_TASK':
      return 'Task updated.';
    case 'SEARCH_USERS':
      return target ? `Found ${target}.` : 'User search completed.';
    case 'SEARCH_VIDEO':
    case 'SEARCH_YOUTUBE':
      return `Search completed for "${String(parameters.query || action.searchQuery || '')}".`;
    case 'PLAY_VIDEO':
      return 'Video playback started.';
    case 'DOWNLOAD_YOUTUBE':
      return 'YouTube download started.';
    case 'CHANGE_SETTING':
      return `Setting "${String(parameters.setting || parameters.name || '')}" was updated.`;
    case 'DELETE_TASK':
      return 'Task deleted.';
    case 'CREATE_NOTE':
      return `Note saved: "${clip(pickText(parameters.title, parameters.content, parameters.text, action.messageText))}"`;
    case 'CREATE_EVENT':
      return `Event added: "${clip(pickText(parameters.title, action.messageText))}" on ${pickText(parameters.date)}${parameters.time ? ` at ${String(parameters.time)}` : ''}.`;
    case 'CREATE_HABIT':
      return `Habit created: "${clip(pickText(parameters.name, action.messageText))}"`;
    case 'ADD_CONNECT':
      return target ? `Connect request sent to ${target}.` : 'Connect request sent.';
    case 'REMOVE_CONNECT':
      return target ? `${target} was removed from your connects.` : 'Connect removed.';
    default:
      return `${definition.label} completed.`;
  }
};

export async function executeAgentActions(
  actions: AgentActionIntent[] | undefined,
  adapter: MobileAgentActionAdapter,
  options: AgentActionExecutionOptions = {},
): Promise<AgentActionResult[]> {
  if (!actions?.length) return [];
  const results: AgentActionResult[] = [];

  for (const [index, action] of actions.entries()) {
    const definition = definitionByName.get(action.action);
    if (!definition) {
      results.push({
        action: action.action,
        ok: false,
        message: 'This action is not supported.',
      });
      continue;
    }
    const needsConfirmation =
      definition.destructive ||
      (definition.sensitive && !options.skipConfirmation);
    if (needsConfirmation) {
      const confirmed = options.confirm
        ? await options.confirm(definition, action)
        : false;
      if (!confirmed) {
        results.push({
          action: action.action,
          label: definition.label,
          ok: false,
          cancelled: true,
          message: `${definition.label} cancelled.`,
        });
        continue;
      }
    }
    options.onActionStart?.(action, index);

    try {
      const parameters = action.parameters || {};
      const requestedName = String(
        parameters.userName || action.targetName || '',
      ).trim().toLowerCase();
      if (
        action.action === 'VIEW_PROFILE' &&
        ['me', 'my profile', 'myself', 'নিজের প্রোফাইল', 'আমার প্রোফাইল'].includes(
          requestedName,
        )
      ) {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        await adapter.navigate('Menu', { screen: 'MyProfile' });
        results.push({
          action: action.action,
          label: definition.label,
          ok: true,
          message: 'Your profile is open.',
        });
        continue;
      }
      // Actions that report their own outcome text.
      let customMessage = '';
      const canonicalNavigation: Partial<Record<AgentActionName, string>> = {
        NAVIGATE: String(parameters.route || action.targetRoute || ''),
        OPEN_SETTINGS: 'Settings',
      };
      const target =
        navigationTargets[action.action] ||
        (canonicalNavigation[action.action]
          ? [canonicalNavigation[action.action], undefined]
          : undefined);
      const requiresUser = [
        'VIEW_PROFILE',
        'OPEN_CHAT',
        'FOLLOW_USER',
        'UNFOLLOW_USER',
        'BLOCK_USER',
        'UNBLOCK_USER',
        'SEND_MESSAGE',
        'START_AUDIO_CALL',
        'START_VIDEO_CALL',
        'INVITE_LUDO_PLAYER',
        'END_CALL',
        'ADD_CONNECT',
        'REMOVE_CONNECT',
      ].includes(action.action);
      let resolvedUserId = String(parameters.userId || parameters.profileId || '');
      let resolvedUserName = String(parameters.userName || action.targetName || '');
      let resolvedProfilePic =
        String(
          parameters.profilePic ||
            parameters.profilePicture ||
            parameters.avatar ||
            '',
        ).trim() || undefined;
      if (requiresUser && !resolvedUserId && resolvedUserName && adapter.resolveUser) {
        const resolved = await adapter.resolveUser(resolvedUserName);
        resolvedUserId = resolved?.id || '';
        resolvedUserName = resolved?.name || resolvedUserName;
        resolvedProfilePic = resolved?.profilePic;
        if (resolved?.id) options.onResolvedUser?.(resolved);
      }
      if (requiresUser && !resolvedUserId)
        throw new Error('I could not uniquely resolve that person.');
      if (action.action === 'OPEN_LUDO') {
        if (!adapter.startLudo)
          throw new Error('Ludo is unavailable on this device.');
        await adapter.startLudo();
      } else if (action.action === 'INVITE_LUDO_PLAYER') {
        if (!adapter.inviteLudoPlayer)
          throw new Error('Ludo invitations are unavailable.');
        await adapter.inviteLudoPlayer(resolvedUserId, resolvedUserName);
      } else if (action.action === 'END_CALL') {
        if (!adapter.endCall) throw new Error('Call controls are unavailable.');
        await adapter.endCall(resolvedUserId, String(parameters.channelName || '') || undefined);
      } else if (action.action === 'CHANGE_SETTING') {
        const setting = String(parameters.setting || parameters.name || '').trim();
        if (!setting) throw new Error('Tell me which setting to change.');
        if (!adapter.changeSetting) throw new Error('Settings controls are unavailable.');
        await adapter.changeSetting(setting, parameters.value);
      } else if (action.action === 'START_AUDIO_CALL' || action.action === 'START_VIDEO_CALL') {
        let userId = resolvedUserId;
        let resolvedName = resolvedUserName;
        // The model may provide an ID without the avatar. Resolve by name as
        // well so outgoing call overlays can receive the callee's picture.
        if (resolvedName && adapter.resolveUser && !resolvedProfilePic) {
          if (!userId) {
            const resolved = await adapter.resolveUser(resolvedName);
            userId = resolved?.id || '';
            resolvedName = resolved?.name || resolvedName;
            resolvedProfilePic = resolved?.profilePic;
            if (resolved?.id) options.onResolvedUser?.(resolved);
          } else {
            // The id is authoritative. Only borrow the name/photo when the
            // name lookup points at that same person; a spoken "Mom" must
            // never pull in some other user's name and picture.
            try {
              const resolved = await adapter.resolveUser(resolvedName);
              if (resolved?.id === userId) {
                resolvedName = resolved.name || resolvedName;
                resolvedProfilePic = resolved.profilePic;
                options.onResolvedUser?.(resolved);
              }
            } catch {
              // Keep the id; the call screen looks the person up by id.
            }
          }
        }
        if (!userId) throw new Error('I need the person’s resolved user ID before starting the call.');
        const channelName = String(parameters.channelName || userId);
        const userName = resolvedName;
        if (action.action === 'START_AUDIO_CALL') {
          if (!adapter.startAudioCall) throw new Error('Audio calling is unavailable.');
          await adapter.startAudioCall(userId, channelName, userName, resolvedProfilePic);
        } else {
          if (!adapter.startVideoCall) throw new Error('Video calling is unavailable.');
          await adapter.startVideoCall(userId, channelName, userName, resolvedProfilePic);
        }
      } else if (action.action === 'FOLLOW_USER' || action.action === 'UNFOLLOW_USER' ||
        action.action === 'BLOCK_USER' || action.action === 'UNBLOCK_USER') {
        const handler = {
          FOLLOW_USER: adapter.followUser,
          UNFOLLOW_USER: adapter.unfollowUser,
          BLOCK_USER: adapter.blockUser,
          UNBLOCK_USER: adapter.unblockUser,
        }[action.action];
        if (!handler) throw new Error('This user action is unavailable.');
        await handler(resolvedUserId);
      } else if (action.action === 'SEND_MESSAGE') {
        const message = String(parameters.message || action.messageText || '');
        if (!message.trim()) throw new Error('The message cannot be empty.');
        if (!adapter.sendMessage) throw new Error('Messaging is unavailable.');
        await adapter.sendMessage(resolvedUserId, message);
      } else if (action.action === 'SEARCH_USERS') {
        const query = String(
          parameters.query || action.searchQuery || action.targetName || '',
        ).trim();
        if (!query || !adapter.resolveUser)
          throw new Error('Tell me the name of the person to search for.');
        const match = await adapter.resolveUser(query);
        if (!match) throw new Error('I could not find one unique matching user.');
      } else if (action.action === 'PLAY_VIDEO') {
        const videoId = String(parameters.videoId || parameters.watchId || action.id || '');
        if (!videoId) throw new Error('I need the video ID before playing it.');
        if (!adapter.playVideo) throw new Error('Video playback is unavailable.');
        await adapter.playVideo(videoId);
      } else if (action.action === 'SEARCH_VIDEO') {
        const query = String(parameters.query || action.searchQuery || '').trim();
        if (!query) throw new Error('Tell me what video to search for.');
        if (!adapter.searchVideo) throw new Error('Video search is unavailable.');
        await adapter.searchVideo(query);
      } else if (action.action === 'SEARCH_YOUTUBE') {
        const query = String(parameters.query || action.searchQuery || '').trim();
        if (!query) throw new Error('Tell me what YouTube video to search for.');
        if (!adapter.searchYoutube) throw new Error('YouTube search is unavailable.');
        await adapter.searchYoutube(query);
      } else if (action.action === 'DOWNLOAD_YOUTUBE') {
        const downloadOptions = {
          query: String(parameters.query || action.searchQuery || '').trim() || undefined,
          url: String(parameters.url || '').trim() || undefined,
          videoId: String(parameters.videoId || parameters.youtubeId || '').trim() || undefined,
          title: String(parameters.title || action.targetName || '').trim() || undefined,
          thumbnail: String(parameters.thumbnail || '').trim() || undefined,
          quality: parameters.quality === undefined ? undefined : Number(parameters.quality),
          audioOnly: parameters.audioOnly === undefined ? undefined : Boolean(parameters.audioOnly),
        };
        if (!downloadOptions.query && !downloadOptions.url && !downloadOptions.videoId) {
          throw new Error('Tell me the YouTube video name or link to download.');
        }
        if (!adapter.downloadYoutube) throw new Error('YouTube download is unavailable.');
        await adapter.downloadYoutube(downloadOptions);
      } else if (action.action === 'CREATE_TASK') {
        const text = String(parameters.text || parameters.taskText || action.messageText || '').trim();
        if (!text) throw new Error('Tell me what the task should say.');
        if (!adapter.createTask) throw new Error('Task creation is unavailable.');
        await adapter.createTask(text);
      } else if (action.action === 'VIEW_TASKS') {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        await adapter.navigate('Menu', { screen: 'Tasks' });
      } else if (action.action === 'UPDATE_TASK') {
        let taskId = String(parameters.taskId || parameters.id || action.id || '').trim();
        const taskQuery = String(parameters.taskQuery || parameters.taskText || '').trim();
        if (!taskId && taskQuery && adapter.resolveTask) {
          taskId = String((await adapter.resolveTask(taskQuery))?.id || '');
        }
        const text = parameters.text === undefined && (parameters.taskText === undefined || !parameters.taskId)
          ? undefined
          : String(parameters.text || parameters.taskText || '').trim();
        const completed = parameters.completed === undefined
          ? undefined
          : Boolean(parameters.completed);
        if (!taskId) throw new Error('I need the task ID to edit that task.');
        if (text === undefined && completed === undefined)
          throw new Error('Tell me what to change in the task.');
        if (!adapter.updateTask) throw new Error('Task editing is unavailable.');
        await adapter.updateTask(taskId, { text, completed });
      } else if (action.action === 'CREATE_AUTO_REPLY_RULE') {
        const trigger = String(
          parameters.triggerUserName || parameters.userName || action.targetName || '',
        ).trim();
        const reply = String(
          parameters.replyText || parameters.messageText || parameters.message || '',
        ).trim();
        if (!trigger || !reply)
          throw new Error('Tell me who to reply to and what to say.');
        if (!adapter.createAutoReplyRule)
          throw new Error('Automatic replies are unavailable.');
        await adapter.createAutoReplyRule(trigger, reply);
      } else if (action.action === 'DELETE_TASK') {
        let taskId = pickText(parameters.taskId, parameters.id);
        const taskQuery = pickText(
          parameters.taskQuery,
          parameters.taskText,
          parameters.text,
          action.searchQuery,
          action.messageText,
        );
        if (!taskId && taskQuery && adapter.resolveTask) {
          taskId = String((await adapter.resolveTask(taskQuery))?.id || '');
        }
        if (!taskId) throw new Error('I could not find exactly one matching task.');
        if (!adapter.deleteTask) throw new Error('Task deletion is unavailable.');
        await adapter.deleteTask(taskId);
      } else if (action.action === 'CREATE_NOTE') {
        const content = pickText(
          parameters.content,
          parameters.text,
          parameters.note,
          action.messageText,
          action.searchQuery,
        );
        if (!content) throw new Error('Tell me what the note should say.');
        if (!adapter.createNote) throw new Error('Notes are unavailable.');
        await adapter.createNote(content, pickText(parameters.title) || undefined);
      } else if (action.action === 'CREATE_EVENT') {
        const title = pickText(parameters.title, parameters.name, action.messageText);
        const date = pickText(parameters.date);
        if (!title) throw new Error('Tell me what the event is called.');
        if (!/^\d{4}-\d{2}-\d{2}/.test(date))
          throw new Error('Tell me which day the event is on.');
        if (!adapter.createEvent) throw new Error('Calendar is unavailable.');
        await adapter.createEvent({
          title,
          date: date.slice(0, 10),
          time: pickText(parameters.time) || undefined,
        });
      } else if (action.action === 'CREATE_HABIT') {
        const name = pickText(parameters.name, parameters.title, action.messageText);
        if (!name) throw new Error('Tell me which habit to track.');
        if (!adapter.createHabit) throw new Error('Habits are unavailable.');
        await adapter.createHabit(name);
      } else if (action.action === 'CREATE_POST') {
        const caption = pickText(
          parameters.caption,
          parameters.text,
          parameters.content,
          action.messageText,
          action.searchQuery,
        );
        if (!adapter.createPost) throw new Error('Posting is unavailable.');
        const publish = Boolean(caption) && parameters.publish !== false;
        const published = await adapter.createPost(caption, publish);
        customMessage = published
          ? `Posted: "${clip(caption, 120)}"`
          : caption
          ? `Draft ready — review it and tap Post: "${clip(caption, 120)}"`
          : 'The post composer is open.';
      } else if (action.action === 'ADD_CONNECT' || action.action === 'REMOVE_CONNECT') {
        const handler =
          action.action === 'ADD_CONNECT'
            ? adapter.sendConnectRequest
            : adapter.removeConnect;
        if (!handler) throw new Error('Connect actions are unavailable.');
        await handler(resolvedUserId);
      } else if (
        action.action === 'ACCEPT_CONNECT_REQUEST' ||
        action.action === 'DECLINE_CONNECT_REQUEST'
      ) {
        if (!adapter.respondConnectRequest)
          throw new Error('Connect requests are unavailable.');
        const accept = action.action === 'ACCEPT_CONNECT_REQUEST';
        const requester = await adapter.respondConnectRequest(
          accept,
          pickText(parameters.userName, action.targetName) || undefined,
        );
        customMessage = accept
          ? `You are now connected with ${requester}.`
          : `Declined ${requester}'s connect request.`;
      } else if (action.action === 'QUERY_APP_DATA') {
        if (!adapter.queryAppData) throw new Error('Data lookup is unavailable.');
        customMessage = await adapter.queryAppData(
          pickText(parameters.dataType, parameters.type, action.searchQuery) ||
            'profile',
          pickText(parameters.query) || undefined,
        );
      } else if (target) {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        const params = action.action === 'NAVIGATE'
          ? (parameters.params as Record<string, unknown> | undefined)
          : target[1];
        await adapter.navigate(target[0], params);
      } else if (action.action === 'VIEW_PROFILE' || action.action === 'OPEN_CHAT') {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        await adapter.navigate(
          action.action === 'VIEW_PROFILE' ? 'ConnectProfile' : 'Message',
          action.action === 'VIEW_PROFILE'
            ? { connectId: resolvedUserId }
            : { screen: 'SingleMessage', connectId: resolvedUserId, profileId: resolvedUserId },
        );
      } else if (action.action === 'speak_text') {
        const text = String(
          parameters.messageText || action.messageText || '',
        ).trim();
        if (!adapter.speakText || !text)
          throw new Error('No text was provided to read.');
        await adapter.speakText(text);
      } else {
        const handler = {
          start_ludo: adapter.startLudo,
          start_chess: adapter.startChess,
          start_voice_input: adapter.startVoiceInput,
          stop_voice_input: adapter.stopVoiceInput,
          stop_speaking: adapter.stopSpeaking,
          logout: adapter.logout,
          clear_agent_chat: adapter.clearAgentChat,
        }[action.action];
        if (!handler)
          throw new Error('This feature is unavailable on this device.');
        await handler();
      }
      results.push({
        action: action.action,
        label: definition.label,
        ok: true,
        message:
          customMessage ||
          getActionSuccessMessage(
            action,
            definition,
            resolvedUserName,
            parameters,
          ),
      });
    } catch (error) {
      results.push({
        action: action.action,
        label: definition.label,
        ok: false,
        message: error instanceof Error ? error.message : 'Action failed.',
      });
    }
  }
  return results;
}
