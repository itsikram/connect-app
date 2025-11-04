import RNFS from 'react-native-fs';

export const DOWNLOADS_DIR = `${RNFS.DocumentDirectoryPath}/downloads`;

export async function ensureDownloadsDir(): Promise<string> {
  try {
    const exists = await RNFS.exists(DOWNLOADS_DIR);
    if (!exists) {
      await RNFS.mkdir(DOWNLOADS_DIR);
    }
  } catch (_) {}
  return DOWNLOADS_DIR;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export async function downloadVideoAndSave(url: string, suggestedName?: string): Promise<string> {
  await ensureDownloadsDir();
  const urlObj = new URL(url);
  // Extract filename robustly even if URL ends with a trailing slash
  let path = urlObj.pathname || '';
  if (path.endsWith('/')) path = path.replace(/\/+$/, '');
  let candidate = path.split('/').pop() || '';
  try { candidate = decodeURIComponent(candidate); } catch (_) {}
  if (!/\.mp4(\b|$)/i.test(candidate)) {
    // Try to find any .mp4 occurrence within the path
    const match = decodeURIComponent(path).match(/([^\/]+\.mp4)(?:$|\/)/i);
    if (match && match[1]) candidate = match[1];
  }
  if (!candidate || !/\.mp4(\b|$)/i.test(candidate)) {
    candidate = `video-${Date.now()}.mp4`;
  }
  const baseName = sanitizeFileName(suggestedName || candidate);
  const toFile = `${DOWNLOADS_DIR}/${baseName}`;
  const result = await RNFS.downloadFile({ fromUrl: url, toFile, discretionary: true, background: true }).promise;
  if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
    return toFile;
  }
  throw new Error(`Download failed with status ${result.statusCode}`);
}

export async function listDownloads(): Promise<Array<{ name: string; path: string; size: number; mtime?: Date }>> {
  await ensureDownloadsDir();
  const entries = await RNFS.readDir(DOWNLOADS_DIR);
  const files = entries.filter(e => e.isFile() && /\.mp4$/i.test(e.name));
  return files.map(f => ({ name: f.name, path: f.path, size: f.size as any, mtime: f.mtime as any }));
}

export async function deleteDownload(path: string): Promise<void> {
  try { await RNFS.unlink(path); } catch (_) {}
}


