import { ImageURISource, Platform } from 'react-native';

export const DEFAULT_PROFILE_ASSET = require('../assets/images/default-profile-pic.png');

export const isGoogleHostedImage = (url?: string | null) =>
  typeof url === 'string' && /googleusercontent\.com|ggpht\.com/i.test(url);

export const sanitizeProfileImageUrl = (url?: string | null, size?: number) => {
  if (!url || typeof url !== 'string') return url || '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!isGoogleHostedImage(trimmed)) return trimmed;

  let next = trimmed.split('#')[0].split('?')[0];
  if (size) {
    if (/=s\d+/i.test(next)) {
      next = next.replace(/=s\d+(-[a-z]+)?/i, (_match, suffix) => `=s${size}${suffix || ''}`);
    } else {
      next = `${next}=s${size}-c`;
    }
  }
  return next;
};

export const getProfileImageSource = (url?: string | null, size?: number): ImageURISource | undefined => {
  const uri = sanitizeProfileImageUrl(url, size);
  if (!uri) return undefined;

  if (isGoogleHostedImage(uri)) {
    // iOS Image does not send a Referer by default; adding one can 403 Google's CDN.
    if (Platform.OS === 'ios') {
      return { uri, cache: 'force-cache' };
    }
    if (Platform.OS === 'android') {
      return {
        uri,
        headers: {
          Referer: 'https://lh3.googleusercontent.com/',
        },
      };
    }
    return { uri };
  }

  return { uri };
};

export const googleImageWebProps =
  Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as const) : {};
