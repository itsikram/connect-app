import { navigate as navigateWithQueue } from '../lib/navigationService';

export type AgentActionName =
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
  targetName?: string;
  targetRoute?: string;
  searchQuery?: string;
  messageText?: string;
};

export type ParsedAgentIntent = {
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

export const AGENT_ACTION_CATALOG: readonly AgentActionDefinition[] = ACTIONS.map(([name, label, sensitive]) => ({
  name,
  label,
  sensitive,
}));

const definitionByName = new Map(AGENT_ACTION_CATALOG.map((definition) => [definition.name, definition]));
const allowedIntentKeys = new Set(['reply', 'actions', 'ask']);
const allowedActionKeys = new Set(['action', 'targetName', 'targetRoute', 'searchQuery', 'messageText']);
const allowedAskKeys = new Set(['field', 'question']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>) =>
  Object.keys(value).every((key) => allowed.has(key));

const optionalText = (value: unknown, field: string, maxLength = 500): string | undefined => {
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
    if (parsed.reply !== undefined) intent.reply = optionalText(parsed.reply, 'reply', 4000);

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
      intent.actions = parsed.actions.map((rawAction) => {
        if (!isRecord(rawAction) || !hasOnlyKeys(rawAction, allowedActionKeys)) {
          throw new Error('action contains unsupported fields');
        }
        if (typeof rawAction.action !== 'string') throw new Error('action.action is required');
        const definition = definitionByName.get(rawAction.action as AgentActionName);
        if (!definition) unsupportedActions.push(rawAction.action);
        return {
          action: rawAction.action as AgentActionName,
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
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid intent.' };
  }
}

export type MobileAgentActionAdapter = {
  navigate?: (route: string, params?: Record<string, unknown>) => void | Promise<void>;
  startLudo?: () => void | Promise<void>;
  startChess?: () => void | Promise<void>;
  startVoiceInput?: () => void | Promise<void>;
  stopVoiceInput?: () => void | Promise<void>;
  speakText?: (text: string) => void | Promise<void>;
  stopSpeaking?: () => void | Promise<void>;
  logout?: () => void | Promise<void>;
  clearAgentChat?: () => void | Promise<void>;
};

export type AgentActionResult = {
  action: string;
  ok: boolean;
  message: string;
  cancelled?: boolean;
};

export type AgentActionExecutionOptions = {
  confirm?: (definition: AgentActionDefinition) => Promise<boolean>;
};

export function createMobileAgentActionAdapter(
  overrides: MobileAgentActionAdapter = {},
): MobileAgentActionAdapter {
  return {
    navigate: (route, params) => navigateWithQueue(route, params),
    ...overrides,
  };
}

const navigationTargets: Partial<Record<AgentActionName, [string, Record<string, unknown>?]>> = {
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
      results.push({ action: action.action, ok: false, message: 'This action is not supported.' });
      continue;
    }
    if (definition.sensitive) {
      const confirmed = options.confirm ? await options.confirm(definition) : false;
      if (!confirmed) {
        results.push({ action: action.action, ok: false, cancelled: true, message: 'Action cancelled.' });
        continue;
      }
    }

    try {
      const target = navigationTargets[action.action];
      if (target) {
        if (!adapter.navigate) throw new Error('Navigation is unavailable.');
        await adapter.navigate(target[0], target[1]);
      } else if (action.action === 'speak_text') {
        if (!adapter.speakText || !action.messageText) throw new Error('No text was provided to read.');
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
        if (!handler) throw new Error('This feature is unavailable on this device.');
        await handler();
      }
      results.push({ action: action.action, ok: true, message: `${definition.label} completed.` });
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
