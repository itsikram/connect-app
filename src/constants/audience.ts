export const AUDIENCE_PUBLIC = 1;
export const AUDIENCE_FRIENDS = 2;
export const AUDIENCE_ONLY_ME = 3;

export const AUDIENCE_OPTIONS = [
  {
    value: AUDIENCE_PUBLIC,
    label: 'Public',
    icon: 'public',
    desc: 'Anyone can see this post',
  },
  {
    value: AUDIENCE_FRIENDS,
    label: 'Friends',
    icon: 'people',
    desc: 'Only your friends can see this post',
  },
  {
    value: AUDIENCE_ONLY_ME,
    label: 'Only Me',
    icon: 'lock',
    desc: 'Only you can see this post',
  },
] as const;

export type AudienceValue = (typeof AUDIENCE_OPTIONS)[number]['value'];

export const getAudienceOption = (audience?: number | null) =>
  AUDIENCE_OPTIONS.find((option) => option.value === Number(audience)) || AUDIENCE_OPTIONS[2];
