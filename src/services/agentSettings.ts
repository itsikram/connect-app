/**
 * Maps what people say ("dark mode", "read receipts off", "বাংলা ভাষা") to a
 * real Connect setting key and a valid value, so the AI agent can change a
 * setting directly instead of only opening the Settings screen.
 */

type SettingKind =
  | { type: 'boolean' }
  | { type: 'enum'; values: Record<string, string[]> }
  | { type: 'number'; min: number; max: number };

type SettingDefinition = {
  key: string;
  label: string;
  aliases: string[];
  kind: SettingKind;
  /** Extra keys that must always carry the same value. */
  mirrors?: string[];
};

const VISIBILITY: Record<string, string[]> = {
  public: ['public', 'everyone', 'all', 'sobai', 'সবাই', 'পাবলিক'],
  friends: ['friends', 'connects', 'connections', 'friend', 'বন্ধু', 'কানেক্ট'],
  private: ['private', 'only me', 'me', 'nobody', 'no one', 'none', 'শুধু আমি', 'প্রাইভেট'],
};

const TONES: Record<string, string[]> = {
  '1': ['1', 'one', 'first', 'default'],
  '2': ['2', 'two', 'second'],
  '3': ['3', 'three', 'third'],
  '4': ['4', 'four', 'fourth'],
  '5': ['5', 'five', 'fifth'],
};

const bool = { type: 'boolean' } as const;

export const AGENT_SETTINGS: SettingDefinition[] = [
  {
    key: 'themeMode',
    label: 'Theme',
    aliases: ['theme', 'theme mode', 'appearance', 'color theme', 'mode', 'থিম'],
    kind: {
      type: 'enum',
      values: {
        default: ['default', 'system', 'auto', 'automatic', 'ডিফল্ট'],
        dark: ['dark', 'dark mode', 'night', 'night mode', 'black', 'ডার্ক', 'অন্ধকার'],
        light: ['light', 'light mode', 'day', 'white', 'লাইট'],
        blue: ['blue', 'নীল'],
        green: ['green', 'সবুজ'],
        purple: ['purple', 'violet', 'বেগুনি'],
      },
    },
  },
  {
    key: 'language',
    label: 'Language',
    aliases: ['language', 'app language', 'lang', 'ভাষা'],
    kind: {
      type: 'enum',
      values: {
        eng: ['eng', 'en', 'english', 'en-us', 'ইংরেজি', 'ইংলিশ'],
        bn: ['bn', 'bangla', 'bengali', 'bn-bd', 'বাংলা'],
      },
    },
  },
  {
    key: 'showIsTyping',
    label: 'Typing status',
    aliases: ['show typing', 'typing status', 'show is typing', 'is typing', 'typing'],
    kind: bool,
    mirrors: ['showTyping'],
  },
  { key: 'typingIndicators', label: 'Typing indicators', aliases: ['typing indicator', 'typing indicators'], kind: bool },
  { key: 'readReceipts', label: 'Read receipts', aliases: ['read receipt', 'read receipts', 'seen', 'seen status', 'seen receipts'], kind: bool },
  { key: 'messagePreview', label: 'Message preview', aliases: ['message preview', 'message previews', 'preview'], kind: bool },
  { key: 'autoSaveDrafts', label: 'Auto-save drafts', aliases: ['auto save drafts', 'autosave drafts', 'save drafts', 'drafts'], kind: bool },
  { key: 'isShareEmotion', label: 'Share emotion', aliases: ['share emotion', 'emotion sharing', 'face mode', 'share face mode', 'emotion'], kind: bool },
  { key: 'isShareLocation', label: 'Share location', aliases: ['share location', 'location sharing', 'location', 'লোকেশন'], kind: bool },
  {
    key: 'postVisibility',
    label: 'Post visibility',
    aliases: ['post visibility', 'post privacy', 'who can see my posts', 'posts'],
    kind: { type: 'enum', values: VISIBILITY },
  },
  {
    key: 'connectRequestVisibility',
    label: 'Connect request visibility',
    aliases: ['connect request visibility', 'who can send connect requests', 'connect request privacy', 'requests'],
    kind: { type: 'enum', values: VISIBILITY },
  },
  {
    key: 'timelinePostVisibility',
    label: 'Timeline post visibility',
    aliases: ['timeline post visibility', 'timeline visibility', 'timeline privacy', 'timeline'],
    kind: { type: 'enum', values: VISIBILITY },
  },
  { key: 'connectRequestReceived', label: 'Connect request notifications', aliases: ['connect request notification', 'connect request received', 'request notifications'], kind: bool },
  { key: 'connectRequestAccepted', label: 'Request accepted notifications', aliases: ['connect request accepted', 'request accepted notification', 'accepted notifications'], kind: bool },
  { key: 'newMessageReceived', label: 'Message notifications', aliases: ['message notification', 'message notifications', 'new message notification', 'new message received'], kind: bool },
  { key: 'newConnectPost', label: 'Post notifications', aliases: ['post notification', 'post notifications', 'new connect post', 'new post notification'], kind: bool },
  { key: 'newConnectStory', label: 'Story notifications', aliases: ['story notification', 'story notifications', 'new connect story'], kind: bool },
  { key: 'newConnectWatch', label: 'Video notifications', aliases: ['watch notification', 'video notification', 'video notifications', 'new connect watch'], kind: bool },
  { key: 'connectRequestReceivedEmail', label: 'Connect request emails', aliases: ['connect request email', 'request email', 'connect request received email'], kind: bool },
  { key: 'connectRequestAcceptedEmail', label: 'Request accepted emails', aliases: ['connect request accepted email', 'accepted email'], kind: bool },
  { key: 'newMessageReceivedEmail', label: 'Message emails', aliases: ['message email', 'message emails', 'new message email'], kind: bool },
  { key: 'newConnectPostEmail', label: 'Post emails', aliases: ['post email', 'post emails', 'new connect post email'], kind: bool },
  { key: 'newConnectStoryEmail', label: 'Story emails', aliases: ['story email', 'story emails', 'new connect story email'], kind: bool },
  { key: 'newConnectWatchEmail', label: 'Video emails', aliases: ['watch email', 'video email', 'video emails', 'new connect watch email'], kind: bool },
  {
    key: 'timeFormat',
    label: 'Time format',
    aliases: ['time format', 'clock', 'clock format'],
    kind: {
      type: 'enum',
      values: {
        '12h': ['12h', '12', '12 hour', '12-hour', 'am pm', 'am/pm'],
        '24h': ['24h', '24', '24 hour', '24-hour', 'military'],
      },
    },
  },
  {
    key: 'dateFormat',
    label: 'Date format',
    aliases: ['date format'],
    kind: {
      type: 'enum',
      values: {
        'MM/DD/YYYY': ['mm/dd/yyyy', 'us', 'american', 'month first'],
        'DD/MM/YYYY': ['dd/mm/yyyy', 'day first', 'european', 'british', 'bangladesh'],
        'YYYY-MM-DD': ['yyyy-mm-dd', 'iso', 'year first'],
      },
    },
  },
  { key: 'ringtone', label: 'Ringtone', aliases: ['ringtone', 'call ringtone', 'ring tone', 'রিংটোন'], kind: { type: 'enum', values: TONES } },
  { key: 'notificationSound', label: 'Notification sound', aliases: ['notification sound', 'notification tone'], kind: { type: 'enum', values: TONES } },
  { key: 'messageSound', label: 'Message sound', aliases: ['message sound', 'message tone'], kind: { type: 'enum', values: TONES } },
  { key: 'vibrationEnabled', label: 'Vibration', aliases: ['vibration', 'vibrate', 'ভাইব্রেশন'], kind: bool },
  { key: 'silentMode', label: 'Silent mode', aliases: ['silent mode', 'silent', 'mute', 'do not disturb', 'dnd', 'সাইলেন্ট'], kind: bool },
  { key: 'volumeLevel', label: 'Volume', aliases: ['volume', 'volume level', 'sound level', 'ভলিউম'], kind: { type: 'number', min: 0, max: 100 } },
];

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFC')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compact = (value: unknown) => normalize(value).replace(/\s+/g, '');

const TRUE_WORDS = ['true', 'on', 'yes', 'enable', 'enabled', 'show', 'allow', 'turn on', 'start', '1', 'চালু', 'অন', 'হ্যাঁ'];
const FALSE_WORDS = ['false', 'off', 'no', 'disable', 'disabled', 'hide', 'block', 'turn off', 'stop', '0', 'বন্ধ', 'অফ', 'না'];

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalize(value);
  if (TRUE_WORDS.includes(text)) return true;
  if (FALSE_WORDS.includes(text)) return false;
  return null;
};

export const findAgentSetting = (name: unknown): SettingDefinition | null => {
  const raw = String(name ?? '').trim();
  if (!raw) return null;
  // Exact key first ("readReceipts"), then spoken aliases.
  const byKey = AGENT_SETTINGS.find(
    definition =>
      definition.key === raw ||
      compact(definition.key) === compact(raw) ||
      definition.mirrors?.some(mirror => compact(mirror) === compact(raw)),
  );
  if (byKey) return byKey;
  const needle = normalize(raw)
    .replace(/^(my|the|app|আমার)\s+/, '')
    .replace(/\s+(setting|settings|option)$/, '');
  return (
    AGENT_SETTINGS.find(definition =>
      definition.aliases.some(alias => normalize(alias) === needle),
    ) ||
    AGENT_SETTINGS.find(definition =>
      definition.aliases.some(
        alias => normalize(alias).length > 3 && needle.includes(normalize(alias)),
      ),
    ) ||
    null
  );
};

export type ResolvedAgentSetting = {
  key: string;
  label: string;
  value: string | number | boolean;
  /** Every key to write, including mirrored keys. */
  updates: Record<string, string | number | boolean>;
  /** Spoken form of the new value. */
  display: string;
};

/**
 * Resolves a setting name and requested value. `currentValue` lets "toggle"
 * flip a boolean. Throws a user-facing error for unknown settings or values.
 */
export const resolveAgentSetting = (
  name: unknown,
  value: unknown,
  currentValue?: unknown,
): ResolvedAgentSetting => {
  let definition = findAgentSetting(name);
  if (!definition && toBoolean(value) !== false) {
    // "dark mode: on" names the value instead of the setting.
    const spoken = normalize(name).replace(/\s+(setting|settings)$/, '');
    definition =
      AGENT_SETTINGS.find(
        candidate =>
          candidate.kind.type === 'enum' &&
          Object.values(candidate.kind.values).some(words =>
            words.some(word => normalize(word) === spoken),
          ),
      ) || null;
    if (definition) value = spoken;
  }
  if (!definition) {
    throw new Error(
      `I can't change "${String(name ?? '')}" yet. Try theme, language, read receipts, notifications, privacy, sounds or volume.`,
    );
  }
  const { kind } = definition;
  let next: string | number | boolean;
  let display: string;
  if (kind.type === 'boolean') {
    const text = normalize(value);
    const flipped =
      value === undefined || value === null || text === '' || text === 'toggle' || text === 'switch'
        ? !toBoolean(currentValue)
        : null;
    const parsed = flipped ?? toBoolean(value);
    if (parsed === null) {
      throw new Error(`Should ${definition.label.toLowerCase()} be on or off?`);
    }
    next = parsed;
    display = parsed ? 'on' : 'off';
  } else if (kind.type === 'number') {
    const text = normalize(value);
    const current = Number(currentValue);
    const base = Number.isFinite(current) ? current : 50;
    let parsed: number;
    if (['max', 'maximum', 'full', 'highest'].includes(text)) parsed = kind.max;
    else if (['min', 'minimum', 'lowest', 'mute', 'zero'].includes(text)) parsed = kind.min;
    else if (['up', 'higher', 'louder', 'increase', 'more'].includes(text)) parsed = base + 20;
    else if (['down', 'lower', 'quieter', 'decrease', 'less'].includes(text)) parsed = base - 20;
    else parsed = Number(text.replace(/%$/, ''));
    if (!Number.isFinite(parsed)) {
      throw new Error(`What should ${definition.label.toLowerCase()} be set to (0–100)?`);
    }
    next = Math.round(Math.min(kind.max, Math.max(kind.min, parsed)));
    display = `${next}%`;
  } else {
    const findOption = (text: string) =>
      Object.entries(kind.values).find(
        ([key, words]) =>
          normalize(key) === text || words.some(word => normalize(word) === text),
      );
    // "dark mode": "on" names the option in the setting name itself.
    const match =
      findOption(normalize(value)) ||
      (toBoolean(value) === true
        ? findOption(normalize(name).replace(/\s+(setting|settings)$/, ''))
        : undefined);
    if (!match) {
      const options = Object.keys(kind.values).join(', ');
      throw new Error(`${definition.label} can be: ${options}.`);
    }
    next = match[0];
    display = match[1][0] === match[0] ? match[0] : match[1][0];
    if (definition.key === 'language') display = next === 'bn' ? 'Bangla' : 'English';
  }
  const updates: Record<string, string | number | boolean> = { [definition.key]: next };
  definition.mirrors?.forEach(mirror => {
    updates[mirror] = next;
  });
  return { key: definition.key, label: definition.label, value: next, updates, display };
};

/** Short model-facing list of every changeable setting and its values. */
export const describeAgentSettingsForPrompt = () =>
  AGENT_SETTINGS.map(definition => {
    const { kind } = definition;
    const values =
      kind.type === 'boolean'
        ? 'true|false'
        : kind.type === 'number'
        ? `${kind.min}-${kind.max}`
        : Object.keys(kind.values).join('|');
    return `${definition.key}=${values}`;
  }).join(', ');
