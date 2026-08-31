export const DEFAULT_CHAT_THEME_ID = 'classic';

export const DEFAULT_ACTION_EMOJI = '👍';

export const QUICK_REACTION_PRESETS = [
  '👍',
  '❤️',
  '🥰',
  '😘',
  '😂',
  '🔥',
  '😍',
  '💋',
  '👋',
  '✨',
];

export const ROMANTIC_EMOJI_TRIGGERS = [
  '❤️',
  '❤',
  '💕',
  '💖',
  '💗',
  '💓',
  '💞',
  '💘',
  '💝',
  '💟',
  '❣️',
  '❣',
  '😍',
  '🥰',
  '😘',
  '😗',
  '😙',
  '😚',
  '💋',
  '😻',
  '💑',
  '💏',
  '🫶',
  '🌹',
  '🥀',
  '💐',
  '💌',
  '💍',
  '💒',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🤍',
  '🤎',
  '🖤',
  '🫀',
  '❤️‍🔥',
  '❤️‍🩹',
];

export const LOVE_FALL_EMOJIS = ['❤️', '🥰', '😘', '💋', '💕', '😍', '🫶', '🌹'];

const ROMANTIC_WORDS = [
  'love',
  'loves',
  'loved',
  'loving',
  'lovely',
  'lover',
  'beloved',
  'luv',
  'ily',
  'ilu',
  'ilysm',
  'sweetheart',
  'sweetie',
  'darling',
  'honey',
  'babe',
  'bae',
  'baby',
  'cutie',
  'gorgeous',
  'handsome',
  'kiss',
  'kisses',
  'kissing',
  'hug',
  'hugs',
  'hugging',
  'crush',
  'soulmate',
  'wifey',
  'hubby',
  'xoxo',
  'muah',
  'mwah',
  'adore',
  'adores',
  'adored',
  'adorable',
  'romance',
  'romantic',
  'heart',
  'hearts',
  'forever',
  'angel',
  'precious',
  'dear',
  'cuddle',
  'cuddles',
  'cuddling',
  'smooch',
];

const ROMANTIC_PHRASES = [
  'love you',
  'love u',
  'love ya',
  'luv you',
  'luv u',
  'miss you',
  'miss u',
  'i miss you',
  'thinking of you',
  'thinking about you',
  'crazy about you',
  'mad about you',
  'my love',
  'my heart',
  'kiss me',
  'hug me',
  'want you',
  'need you',
  'you are beautiful',
  'you are cute',
  "you're beautiful",
  "you're cute",
  'date night',
  "can't wait to see you",
  'cant wait to see you',
];

const BANGLA_ROMANTIC = [
  'ভালোবাসি',
  'ভালবাসি',
  'ভালোবাসা',
  'ভালবাসা',
  'প্রেম',
  'জানু',
  'সোনা',
  'আদর',
  'চুমু',
  'প্রিয়',
  'প্রিয়',
  'valobashi',
  'valobasha',
  'valobasi',
  'bhalobashi',
  'bhalobasha',
  'jaanu',
  'jaan',
  'shona',
  'chumu',
  'priyo',
  'priya',
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ROMANTIC_WORD_PATTERN = new RegExp(
  `\\b(?:${ROMANTIC_WORDS.map(escapeRegExp).join('|')})\\b|${ROMANTIC_PHRASES.map(
    (phrase) => escapeRegExp(phrase).replace(/ /g, '\\s+'),
  ).join('|')}`,
  'i',
);

const ROMANTIC_CODE_POINTS = new Set([
  0x2764, 0x2665, 0x2661, 0x22c6, 0x1f495, 0x1f496, 0x1f497, 0x1f493, 0x1f49e,
  0x1f498, 0x1f49d, 0x1f49f, 0x2763, 0x1f60d, 0x1f970, 0x1f618, 0x1f617, 0x1f619,
  0x1f61a, 0x1f48b, 0x1f63b, 0x1f491, 0x1f48f, 0x1fac6, 0x1f339, 0x1f940, 0x1f490,
  0x1f48c, 0x1f48d, 0x1f492, 0x1f9e1, 0x1f49b, 0x1f49a, 0x1f499, 0x1f49c, 0x1f90d,
  0x1f90e, 0x1f5a4, 0x1fac0,
]);

const stripEmojiModifiers = (value: string) =>
  value.replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, '');

export const isRomanticMessage = (text: unknown) => {
  if (text == null) return false;
  const raw = String(text).normalize('NFC');
  if (!raw) return false;
  if (ROMANTIC_EMOJI_TRIGGERS.some((emoji) => raw.includes(emoji))) return true;

  const stripped = stripEmojiModifiers(raw);
  if (
    ROMANTIC_EMOJI_TRIGGERS.some((emoji) =>
      stripped.includes(stripEmojiModifiers(emoji)),
    )
  ) {
    return true;
  }

  for (const char of stripped) {
    const codePoint = char.codePointAt(0);
    if (codePoint && ROMANTIC_CODE_POINTS.has(codePoint)) return true;
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (ROMANTIC_WORD_PATTERN.test(normalized)) return true;
  if (BANGLA_ROMANTIC.some((word) => normalized.includes(word.toLowerCase()))) {
    return true;
  }
  return false;
};

export type WallpaperSource = 'theme' | 'global' | 'custom';

export interface FriendChatSettings {
  themeId: string;
  wallpaperSource: WallpaperSource;
  customBackground: string | null;
  actionEmoji: string;
  showBackgroundOverlay: boolean;
}

export interface ChatThemeColors {
  accent: string;
  accentStrong: string;
  sentBg: string;
  sentBorder: string;
  sentText: string;
  recvBg: string;
  recvBorder: string;
  recvText: string;
  overlay: string;
  meta: string;
  headerBg: string;
  footerBg: string;
  wallpaper: string[];
}

export interface ChatTheme {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  couple?: boolean;
  loveRain?: boolean;
  preview: { sent: string; recv: string; wallpaper: string };
  colors: ChatThemeColors;
}

export const DEFAULT_FRIEND_CHAT_SETTINGS: FriendChatSettings = {
  themeId: DEFAULT_CHAT_THEME_ID,
  wallpaperSource: 'global',
  customBackground: null,
  actionEmoji: DEFAULT_ACTION_EMOJI,
  showBackgroundOverlay: true,
};

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'classic',
    name: 'Classic Cyan',
    description: 'The original Connect look',
    isDark: true,
    preview: { sent: '#00d4ff', recv: '#3a4148', wallpaper: '#0b1a21' },
    colors: {
      accent: '#00d4ff',
      accentStrong: '#33e0ff',
      sentBg: 'rgba(0, 212, 255, 0.28)',
      sentBorder: 'rgba(0, 212, 255, 0.38)',
      sentText: '#ffffff',
      recvBg: 'rgba(255, 255, 255, 0.12)',
      recvBorder: 'rgba(255, 255, 255, 0.12)',
      recvText: '#ffffff',
      overlay: 'rgba(4, 10, 16, 0.42)',
      meta: 'rgba(255, 255, 255, 0.62)',
      headerBg: '#0c1820',
      footerBg: '#0c1820',
      wallpaper: ['#071018', '#0c1820', '#08141c'],
    },
  },
  {
    id: 'ocean',
    name: 'Midnight Ocean',
    description: 'Deep navy with electric blue',
    isDark: true,
    preview: { sent: '#38bdf8', recv: '#243044', wallpaper: '#0a1730' },
    colors: {
      accent: '#38bdf8',
      accentStrong: '#7dd3fc',
      sentBg: 'rgba(56, 189, 248, 0.32)',
      sentBorder: 'rgba(56, 189, 248, 0.42)',
      sentText: '#f0f9ff',
      recvBg: 'rgba(148, 163, 184, 0.16)',
      recvBorder: 'rgba(148, 163, 184, 0.18)',
      recvText: '#e8f1ff',
      overlay: 'rgba(3, 12, 28, 0.46)',
      meta: 'rgba(226, 232, 240, 0.62)',
      headerBg: '#0b1b33',
      footerBg: '#0b1b33',
      wallpaper: ['#06101f', '#0b1b33', '#071526'],
    },
  },
  {
    id: 'ember',
    name: 'Sunset Ember',
    description: 'Warm dusk with amber highlights',
    isDark: true,
    preview: { sent: '#fb923c', recv: '#3a2a28', wallpaper: '#1a0e0d' },
    colors: {
      accent: '#fb923c',
      accentStrong: '#fdba74',
      sentBg: 'rgba(251, 146, 60, 0.34)',
      sentBorder: 'rgba(251, 146, 60, 0.4)',
      sentText: '#fff7ed',
      recvBg: 'rgba(255, 237, 213, 0.1)',
      recvBorder: 'rgba(253, 186, 116, 0.16)',
      recvText: '#fff7ed',
      overlay: 'rgba(16, 6, 6, 0.48)',
      meta: 'rgba(254, 215, 170, 0.62)',
      headerBg: '#1c0f10',
      footerBg: '#1c0f10',
      wallpaper: ['#170b0a', '#1c0f10', '#14090b'],
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Soft mint over forest night',
    isDark: true,
    preview: { sent: '#34d399', recv: '#274037', wallpaper: '#0c1c16' },
    colors: {
      accent: '#34d399',
      accentStrong: '#6ee7b7',
      sentBg: 'rgba(52, 211, 153, 0.3)',
      sentBorder: 'rgba(52, 211, 153, 0.38)',
      sentText: '#ecfdf5',
      recvBg: 'rgba(167, 243, 208, 0.1)',
      recvBorder: 'rgba(167, 243, 208, 0.16)',
      recvText: '#ecfdf5',
      overlay: 'rgba(4, 16, 12, 0.46)',
      meta: 'rgba(167, 243, 208, 0.6)',
      headerBg: '#0c1c16',
      footerBg: '#0c1c16',
      wallpaper: ['#07140f', '#0c1c16', '#081410'],
    },
  },
  {
    id: 'velvet',
    name: 'Velvet',
    description: 'Plum night with rose gold',
    isDark: true,
    preview: { sent: '#e879f9', recv: '#3b2a44', wallpaper: '#160a1a' },
    colors: {
      accent: '#e879f9',
      accentStrong: '#f0abfc',
      sentBg: 'rgba(232, 121, 249, 0.3)',
      sentBorder: 'rgba(232, 121, 249, 0.38)',
      sentText: '#fdf4ff',
      recvBg: 'rgba(244, 232, 255, 0.1)',
      recvBorder: 'rgba(216, 180, 254, 0.18)',
      recvText: '#fae8ff',
      overlay: 'rgba(14, 6, 18, 0.48)',
      meta: 'rgba(233, 213, 255, 0.62)',
      headerBg: '#1a0d1f',
      footerBg: '#1a0d1f',
      wallpaper: ['#140816', '#1a0d1f', '#120814'],
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Quiet, professional slate',
    isDark: true,
    preview: { sent: '#94a3b8', recv: '#2b3238', wallpaper: '#14181c' },
    colors: {
      accent: '#cbd5e1',
      accentStrong: '#e2e8f0',
      sentBg: 'rgba(148, 163, 184, 0.32)',
      sentBorder: 'rgba(203, 213, 225, 0.32)',
      sentText: '#f8fafc',
      recvBg: 'rgba(255, 255, 255, 0.08)',
      recvBorder: 'rgba(255, 255, 255, 0.12)',
      recvText: '#f1f5f9',
      overlay: 'rgba(8, 10, 12, 0.4)',
      meta: 'rgba(226, 232, 240, 0.58)',
      headerBg: '#16181c',
      footerBg: '#16181c',
      wallpaper: ['#101114', '#16181c', '#0e1215'],
    },
  },
  {
    id: 'love',
    name: 'Sweetheart',
    description: 'Made for couples — hearts rain on love notes',
    couple: true,
    loveRain: true,
    isDark: true,
    preview: { sent: '#fb7185', recv: '#4a2432', wallpaper: '#1a0710' },
    colors: {
      accent: '#fb7185',
      accentStrong: '#fda4af',
      sentBg: 'rgba(251, 113, 133, 0.4)',
      sentBorder: 'rgba(251, 113, 133, 0.46)',
      sentText: '#fff1f2',
      recvBg: 'rgba(255, 228, 230, 0.12)',
      recvBorder: 'rgba(253, 164, 175, 0.2)',
      recvText: '#fff1f2',
      overlay: 'rgba(18, 4, 10, 0.38)',
      meta: 'rgba(254, 205, 211, 0.7)',
      headerBg: '#2a0c18',
      footerBg: '#2a0c18',
      wallpaper: ['#1a0710', '#2a0c18', '#14060d'],
    },
  },
];

export const getChatTheme = (themeId?: string | null): ChatTheme =>
  CHAT_THEMES.find((theme) => theme.id === themeId) || CHAT_THEMES[0];

export const normalizeFriendChatSettings = (
  raw: Partial<FriendChatSettings> | Record<string, any> = {},
): FriendChatSettings => {
  const themeId = CHAT_THEMES.some((theme) => theme.id === raw.themeId)
    ? raw.themeId
    : DEFAULT_CHAT_THEME_ID;
  const wallpaperSource: WallpaperSource = ['theme', 'global', 'custom'].includes(
    raw.wallpaperSource,
  )
    ? raw.wallpaperSource
    : raw.customBackground
      ? 'custom'
      : DEFAULT_FRIEND_CHAT_SETTINGS.wallpaperSource;

  return {
    themeId,
    wallpaperSource,
    customBackground: raw.customBackground || null,
    actionEmoji:
      typeof raw.actionEmoji === 'string' && raw.actionEmoji.trim()
        ? raw.actionEmoji
        : DEFAULT_ACTION_EMOJI,
    showBackgroundOverlay:
      raw.showBackgroundOverlay === false ||
      raw.showBackgroundOverlay === 'false'
        ? false
        : true,
  };
};

export type ResolvedWallpaper =
  | { type: 'image'; value: string; isDark: boolean | null }
  | { type: 'gradient'; value: string[]; isDark: boolean | null };

export const resolveChatWallpaper = (
  friendSettings: Partial<FriendChatSettings> | Record<string, any>,
  theme: ChatTheme,
  globalBackground?: string | null,
): ResolvedWallpaper => {
  const settings = normalizeFriendChatSettings(friendSettings);

  if (settings.wallpaperSource === 'custom' && settings.customBackground) {
    return { type: 'image', value: settings.customBackground, isDark: true };
  }

  if (settings.wallpaperSource === 'global' && globalBackground) {
    return { type: 'image', value: globalBackground, isDark: null };
  }

  return {
    type: 'gradient',
    value: theme.colors.wallpaper,
    isDark: theme.isDark,
  };
};
