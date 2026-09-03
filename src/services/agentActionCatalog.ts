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
  | 'FOLLOW_USER'
  | 'UNFOLLOW_USER'
  | 'BLOCK_USER'
  | 'UNBLOCK_USER'
  | 'OPEN_SETTINGS'
  | 'CHANGE_SETTING'
  | 'OPEN_LUDO'
  | 'INVITE_LUDO_PLAYER'
  | 'navigate_home'
  | 'navigate_friends'
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
};

// Keep this list in sync with the routes and controls exposed by App.tsx/Menu.tsx.
const ACTIONS: readonly [AgentActionName, string, boolean?][] = [
  ['NAVIGATE', 'Navigate'],
  ['SEARCH_USERS', 'Find users'],
  ['VIEW_PROFILE', 'View profile'],
  ['OPEN_CHAT', 'Open chat'],
  ['SEND_MESSAGE', 'Send message', true],
  ['START_AUDIO_CALL', 'Start audio call', true],
  ['START_VIDEO_CALL', 'Start video call', true],
  ['END_CALL', 'End call', true],
  ['SEARCH_VIDEO', 'Search videos'],
  ['PLAY_VIDEO', 'Play video'],
  ['FOLLOW_USER', 'Follow user', true],
  ['UNFOLLOW_USER', 'Unfollow user', true],
  ['BLOCK_USER', 'Block user', true],
  ['UNBLOCK_USER', 'Unblock user', true],
  ['OPEN_SETTINGS', 'Open settings'],
  ['CHANGE_SETTING', 'Change setting', true],
  ['OPEN_LUDO', 'Open Ludo'],
  ['INVITE_LUDO_PLAYER', 'Invite Ludo player', true],
  ['navigate_home', 'Open Home'],
  ['navigate_friends', 'Open Friends'],
  ['navigate_videos', 'Open Videos'],
  ['navigate_message', 'Open Messages'],
  ['navigate_menu', 'Open Menu'],
  ['navigate_profile', 'Open profile'],
  ['navigate_settings', 'Open Settings'],
  ['navigate_tasks', 'Open Tasks'],
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
  ['speak_text', 'Read text aloud'],
  ['stop_speaking', 'Stop speaking'],
  ['logout', 'Log out', true],
  ['clear_agent_chat', 'Clear agent chat', true],
];

export const AGENT_ACTION_CATALOG: readonly AgentActionDefinition[] =
  ACTIONS.map(([name, label, sensitive]) => ({
    name,
    label,
    sensitive,
  }));

const definitionByName = new Map(
  AGENT_ACTION_CATALOG.map(definition => [definition.name, definition]),
);
const ACTION_ALIASES: Record<string, AgentActionName> = {
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
  'id',
  'type',
  'status',
  'parameters',
]);
const allowedAskKeys = new Set(['field', 'question']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>) =>
  Object.keys(value).every(key => allowed.has(key));

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
 * Parse the only machine-readable format accepted from the model.
 * Markdown fences, unknown keys and unknown actions are deliberately rejected.
 */
export function parseAgentIntent(value: string): ParseAgentIntentResult {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: 'Intent is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value.trim());
  } catch {
    return { ok: false, error: 'Intent is not strict JSON.' };
  }
  if (!isRecord(parsed) || !hasOnlyKeys(parsed, allowedIntentKeys)) {
    return { ok: false, error: 'Intent contains unsupported fields.' };
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
      if (!isRecord(parsed.ask) || !hasOnlyKeys(parsed.ask, allowedAskKeys)) {
        throw new Error('ask contains unsupported fields');
      }
      intent.ask = {
        field: optionalText(parsed.ask.field, 'ask.field', 80),
        question: optionalText(parsed.ask.question, 'ask.question', 1000),
      };
    }

    if (parsed.actions !== undefined) {
      if (!Array.isArray(parsed.actions) || parsed.actions.length > 8) {
        throw new Error('actions must be an array of at most 8 items');
      }
      const unsupportedActions: string[] = [];
      intent.actions = parsed.actions.map(rawAction => {
        if (
          !isRecord(rawAction) ||
          !hasOnlyKeys(rawAction, allowedActionKeys)
        ) {
          throw new Error('action contains unsupported fields');
        }
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
        const parameters = isRecord(rawAction.parameters)
          ? rawAction.parameters
          : undefined;
        if (
          rawAction.status !== undefined &&
          !['pending', 'running', 'completed', 'failed', 'cancelled'].includes(
            String(rawAction.status),
          )
        ) {
          throw new Error('action.status is invalid');
        }
        return {
          id: optionalText(rawAction.id, 'action.id', 120),
          type: optionalText(rawAction.type, 'action.type', 80),
          status: rawAction.status as AgentActionIntent['status'],
          parameters,
          action: actionName as AgentActionName,
          targetName: optionalText(rawAction.targetName, 'targetName', 160),
          targetRoute: optionalText(rawAction.targetRoute, 'targetRoute', 160),
          searchQuery: optionalText(rawAction.searchQuery, 'searchQuery', 500),
          messageText: optionalText(rawAction.messageText, 'messageText', 2000),
        };
      });
      if (unsupportedActions.length) {
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
  ) => Promise<{ id: string; name?: string } | null>;
  navigate?: (
    route: string,
    params?: Record<string, unknown>,
  ) => void | Promise<void>;
  startLudo?: () => void | Promise<void>;
  startChess?: () => void | Promise<void>;
  startVoiceInput?: () => void | Promise<void>;
  stopVoiceInput?: () => void | Promise<void>;
  speakText?: (text: string) => void | Promise<void>;
  stopSpeaking?: () => void | Promise<void>;
  logout?: () => void | Promise<void>;
  clearAgentChat?: () => void | Promise<void>;
  startAudioCall?: (userId: string, channelName: string, userName?: string) => void | Promise<void>;
  startVideoCall?: (userId: string, channelName: string, userName?: string) => void | Promise<void>;
  followUser?: (userId: string) => void | Promise<void>;
  unfollowUser?: (userId: string) => void | Promise<void>;
  blockUser?: (userId: string) => void | Promise<void>;
  unblockUser?: (userId: string) => void | Promise<void>;
  sendMessage?: (userId: string, message: string) => void | Promise<void>;
};

export type AgentActionResult = {
  action: string;
  ok: boolean;
  message: string;
  cancelled?: boolean;
};

export type AgentActionExecutionOptions = {
  confirm?: (definition: AgentActionDefinition) => Promise<boolean>;
  skipConfirmation?: boolean;
  onResolvedUser?: (user: { id: string; name?: string }) => void;
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
  navigate_friends: ['Friends'],
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
  navigate_vpn_browser: ['Menu', { screen: 'VpnBrowser' }],
  navigate_cricbuzz: ['Menu', { screen: 'Cricbuzz' }],
  navigate_maps: ['Menu', { screen: 'GoogleMaps' }],
  navigate_contacts: ['Menu', { screen: 'GoogleContacts' }],
};

export async function executeAgentActions(
  actions: AgentActionIntent[] | undefined,
  adapter: MobileAgentActionAdapter,
  options: AgentActionExecutionOptions = {},
): Promise<AgentActionResult[]> {
  if (!actions?.length) return [];
  const results: AgentActionResult[] = [];

  for (const action of actions) {
    const definition = definitionByName.get(action.action);
    if (!definition) {
      results.push({
        action: action.action,
        ok: false,
        message: 'This action is not supported.',
      });
      continue;
    }
    if (definition.sensitive && !options.skipConfirmation) {
      const confirmed = options.confirm
        ? await options.confirm(definition)
        : false;
      if (!confirmed) {
        results.push({
          action: action.action,
          ok: false,
          cancelled: true,
          message: 'Action cancelled.',
        });
        continue;
      }
    }

    try {
      const parameters = action.parameters || {};
      const canonicalNavigation: Partial<Record<AgentActionName, string>> = {
        NAVIGATE: String(parameters.route || action.targetRoute || ''),
        OPEN_SETTINGS: 'Settings',
      };
      const target =
        navigationTargets[action.action] ||
        (canonicalNavigation[action.action]
          ? [canonicalNavigation[action.action], undefined]
          : undefined);
      const requiresUser = ['VIEW_PROFILE', 'OPEN_CHAT', 'FOLLOW_USER',
        'UNFOLLOW_USER', 'BLOCK_USER', 'UNBLOCK_USER', 'SEND_MESSAGE'].includes(action.action);
      let resolvedUserId = String(parameters.userId || parameters.profileId || '');
      let resolvedUserName = String(parameters.userName || action.targetName || '');
      if (requiresUser && !resolvedUserId && resolvedUserName && adapter.resolveUser) {
        const resolved = await adapter.resolveUser(resolvedUserName);
        resolvedUserId = resolved?.id || '';
        resolvedUserName = resolved?.name || resolvedUserName;
        if (resolved?.id) options.onResolvedUser?.(resolved);
      }
      if (requiresUser && !resolvedUserId)
        throw new Error('I could not uniquely resolve that person.');
      if (action.action === 'OPEN_LUDO') {
        if (!adapter.startLudo)
          throw new Error('Ludo is unavailable on this device.');
        await adapter.startLudo();
      } else if (action.action === 'START_AUDIO_CALL' || action.action === 'START_VIDEO_CALL') {
        let userId = resolvedUserId;
        let resolvedName = resolvedUserName;
        if (!userId && resolvedName && adapter.resolveUser) {
          const resolved = await adapter.resolveUser(resolvedName);
          userId = resolved?.id || '';
          resolvedName = resolved?.name || resolvedName;
        }
        if (!userId) throw new Error('I need the person’s resolved user ID before starting the call.');
        const channelName = String(parameters.channelName || userId);
        const userName = resolvedName;
        if (action.action === 'START_AUDIO_CALL') {
          if (!adapter.startAudioCall) throw new Error('Audio calling is unavailable.');
          await adapter.startAudioCall(userId, channelName, userName);
        } else {
          if (!adapter.startVideoCall) throw new Error('Video calling is unavailable.');
          await adapter.startVideoCall(userId, channelName, userName);
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
      } else if (target) {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        const params = action.action === 'NAVIGATE'
          ? (parameters.params as Record<string, unknown> | undefined)
          : target[1];
        await adapter.navigate(target[0], params);
      } else if (action.action === 'VIEW_PROFILE' || action.action === 'OPEN_CHAT') {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        await adapter.navigate(
          action.action === 'VIEW_PROFILE' ? 'FriendProfile' : 'Message',
          action.action === 'VIEW_PROFILE'
            ? { friendId: resolvedUserId }
            : { screen: 'SingleMessage', friendId: resolvedUserId, profileId: resolvedUserId },
        );
      } else if (action.action === 'speak_text') {
        if (!adapter.speakText || !action.messageText)
          throw new Error('No text was provided to read.');
        await adapter.speakText(action.messageText);
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
        ok: true,
        message: `${definition.label} completed.`,
      });
    } catch (error) {
      results.push({
        action: action.action,
        ok: false,
        message: error instanceof Error ? error.message : 'Action failed.',
      });
    }
  }
  return results;
}
