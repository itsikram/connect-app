export const REACT_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;

export type ReactType = (typeof REACT_TYPES)[number];

export const REACT_LIST: { key: ReactType; label: string; emoji: string }[] = [
  { key: 'like', label: 'Like', emoji: '👍' },
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'haha', label: 'Haha', emoji: '😆' },
  { key: 'wow', label: 'Wow', emoji: '😮' },
  { key: 'sad', label: 'Sad', emoji: '😢' },
  { key: 'angry', label: 'Angry', emoji: '😡' },
];

export const getReactEmoji = (type?: string) =>
  REACT_LIST.find((item) => item.key === String(type || '').toLowerCase())?.emoji || '👍';

export const getReactLabel = (type?: string) =>
  REACT_LIST.find((item) => item.key === String(type || '').toLowerCase())?.label || 'Like';

export const sameProfileId = (a: any, b: any) =>
  String(a?._id || a || '') === String(b?._id || b || '');

export const profileDisplayName = (profile: any) => {
  if (!profile) return 'User';
  const fromUser = [profile.user?.firstName, profile.user?.surname].filter(Boolean).join(' ').trim();
  return profile.fullName || profile.displayName || fromUser || 'User';
};

export const uniqueReactCount = (reacts: any[] = []) => {
  const seen = new Set<string>();
  reacts.forEach((react) => {
    const id = String(react?.profile?._id || react?.profile || '');
    if (id) seen.add(id);
  });
  return seen.size;
};
