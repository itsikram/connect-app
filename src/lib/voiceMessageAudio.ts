import { Audio } from './avCompat';
import * as FileSystem from 'expo-file-system/legacy';

const NATIVE_EXT = /\.(mp3|m4a|aac|mp4|wav)(?:\?|$)/i;
const INCOMPATIBLE_EXT = /\.(webm|ogg|oga|opus)(?:\?|$)/i;
const CLOUDINARY_UPLOAD =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/)(video|raw|image)\/upload\/(.+)$/i;

export const isAudioAttachmentUrl = (url?: string) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    NATIVE_EXT.test(lower) ||
    INCOMPATIBLE_EXT.test(lower) ||
    lower.includes('/audio/') ||
    (/\/(?:video|raw)\/upload\//i.test(lower) && /voice[-_]/i.test(lower)) ||
    lower.includes('voice-')
  );
};

const extensionFromUri = (uri: string) => {
  const path = String(uri || '').split('?')[0];
  const match = path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
};

const simpleHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const rewriteCloudinaryToFormat = (url: string, format: string) => {
  const match = url.match(CLOUDINARY_UPLOAD);
  if (!match) return url;
  const [, prefix, , rest] = match;
  const queryIndex = rest.indexOf('?');
  const path = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
  const query = queryIndex >= 0 ? rest.slice(queryIndex) : '';
  const withoutExt = path.replace(/\.[a-z0-9]+$/i, '');
  return `${prefix}video/upload/f_${format},q_auto/${withoutExt}.${format}${query}`;
};

export const toNativePlayableAudioUrls = (url: string): string[] => {
  const urls: string[] = [];
  const add = (value?: string) => {
    if (value && !urls.includes(value)) urls.push(value);
  };

  if (!url) return urls;

  const isCloudinary = CLOUDINARY_UPLOAD.test(url);
  const alreadyNative = NATIVE_EXT.test(url) && !INCOMPATIBLE_EXT.test(url);

  if (alreadyNative) {
    add(url);
    return urls;
  }

  if (isCloudinary) {
    add(rewriteCloudinaryToFormat(url, 'mp3'));
    add(rewriteCloudinaryToFormat(url, 'mp4'));
    add(rewriteCloudinaryToFormat(url, 'm4a'));
    add(url.replace(/\/(raw|image)\/upload\//i, '/video/upload/'));
    const cloudRoot = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+)/i)?.[1];
    if (cloudRoot) {
      add(`${cloudRoot}/video/fetch/f_mp3/${url}`);
    }
  }

  add(url);
  return urls;
};

const loadSoundFromUri = async (
  uri: string,
  initialStatus: Audio.AVPlaybackStatusToSet,
  onPlaybackStatusUpdate?: (status: Audio.AVPlaybackStatus) => void,
) => {
  const ext = extensionFromUri(uri) || 'mp3';
  const { sound, status } = await Audio.Sound.createAsync(
    {
      uri,
      overrideFileExtensionAndroid: ext,
    },
    initialStatus,
    onPlaybackStatusUpdate,
  );

  if (!status.isLoaded) {
    try {
      await sound.unloadAsync();
    } catch {
      /* ignore */
    }
    throw new Error(status.error || `Failed to load audio: ${uri}`);
  }

  return sound;
};

const downloadToCache = async (uri: string) => {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('Audio cache is unavailable');
  const ext = extensionFromUri(uri) || 'mp3';
  const dest = `${cacheDir}voice-${simpleHash(uri)}.${ext}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists && 'size' in info && (info.size || 0) > 0) {
    return dest;
  }
  const result = await FileSystem.downloadAsync(uri, dest);
  if (result.status !== 200) {
    throw new Error(`Audio download failed (${result.status})`);
  }
  return result.uri;
};

export const createPlayableVoiceSound = async (
  url: string,
  initialStatus: Audio.AVPlaybackStatusToSet = { shouldPlay: true, volume: 1, isLooping: false },
  onPlaybackStatusUpdate?: (status: Audio.AVPlaybackStatus) => void,
): Promise<Audio.Sound> => {
  const candidates = toNativePlayableAudioUrls(url);
  let lastError: unknown;

  for (const uri of candidates) {
    try {
      return await loadSoundFromUri(uri, initialStatus, onPlaybackStatusUpdate);
    } catch (error) {
      lastError = error;
    }
  }

  for (const uri of candidates) {
    try {
      const localUri = await downloadToCache(uri);
      return await loadSoundFromUri(localUri, initialStatus, onPlaybackStatusUpdate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Could not play this voice message.');
};
