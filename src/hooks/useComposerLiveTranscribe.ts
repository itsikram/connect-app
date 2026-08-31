import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../lib/config';

const TARGET_SAMPLE_RATE = 16000;
const STREAM_POLL_MS = 80;
const STREAM_GROW_WAIT_MS = 650;
const CHUNK_DURATION_MS = Platform.OS === 'ios' ? 240 : 300;
const SOCKET_TIMEOUT_MS = 8000;
const READY_TIMEOUT_MS = 1800;
const FINAL_FLUSH_MS = 320;
const PING_INTERVAL_MS = 15000;
const MIN_PCM_BYTES = 320;
const MIN_AAC_BYTES = 64;

type TranscribeHandlers = {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
};

export async function setChatRecordingAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

export async function restoreChatPlaybackAudioMode() {
  try {
    await Audio.setIsEnabledAsync(true);
  } catch {
    // ignore
  }
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // ignore
  }
}

export async function requestChatMicPermission(): Promise<boolean> {
  try {
    const current = await Audio.getPermissionsAsync();
    if (current.granted) return true;
    const next = await Audio.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

const toDeepgramLang = (langCode?: string) =>
  String(langCode || '')
    .toLowerCase()
    .startsWith('bn')
    ? 'bn'
    : 'en-US';

const usePcmStream = () => Platform.OS === 'ios';

const speechSocketUrl = (token: string) => {
  const base = String(config.SOCKET_BASE_URL || '').replace(/\/+$/, '');
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/speech';
  const cleanToken = String(token || '').replace(/^Bearer\s+/i, '');
  if (cleanToken) url.searchParams.set('token', cleanToken);
  return url.toString();
};

const openSpeechSocket = (socketUrl: string, onMessage: (event: any) => void) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(socketUrl);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = onMessage;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error('Speech socket connection timed out'));
    }, SOCKET_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
    };
    ws.onopen = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ws);
    };
    ws.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error('Unable to connect to speech server'));
    };
  });

const base64ToBytes = (base64: string) => {
  const binary = global.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return global.btoa(binary);
};

const stripWavHeader = (bytes: Uint8Array) => {
  if (bytes.length < 44) return bytes;
  const isRiff = bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70;
  const isWave = bytes[8] === 87 && bytes[9] === 65 && bytes[10] === 86 && bytes[11] === 69;
  if (!isRiff || !isWave) return bytes;
  for (let i = 12; i < bytes.length - 8; i += 1) {
    if (bytes[i] === 100 && bytes[i + 1] === 97 && bytes[i + 2] === 116 && bytes[i + 3] === 97) {
      const dataSize =
        bytes[i + 4] |
        (bytes[i + 5] << 8) |
        (bytes[i + 6] << 16) |
        (bytes[i + 7] << 24);
      const start = i + 8;
      const end = Math.min(bytes.length, start + Math.max(0, dataSize || bytes.length - start));
      return bytes.subarray(start, end);
    }
  }
  return bytes.subarray(44);
};

const PCM_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.aac',
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: TARGET_SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 96000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    sampleRate: TARGET_SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 128000,
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeSpeechText = (value: string) =>
  String(value || '').replace(/\s+/g, ' ').trim();

const isSameSpeechText = (a: string, b: string) =>
  normalizeSpeechText(a).toLowerCase() === normalizeSpeechText(b).toLowerCase();

const getFileSize = async (uri: string) => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      return info.size;
    }
  } catch {
    /* ignore */
  }
  return 0;
};

const sliceBytesToBase64 = (bytes: Uint8Array, position: number, length: number) => {
  if (position >= bytes.length || length <= 0) return '';
  return bytesToBase64(bytes.subarray(position, Math.min(bytes.length, position + length)));
};

const readFileSlice = async (uri: string, position: number, length: number) => {
  if (length <= 0) return '';

  try {
    const ranged = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });
    if (ranged) {
      const decoded = base64ToBytes(ranged);
      // Honored the byte range.
      if (decoded.length > 0 && decoded.length <= length + 16) {
        return ranged;
      }
      // Some platforms ignore position/length and return the whole file.
      if (decoded.length >= position + Math.min(length, 1)) {
        return sliceBytesToBase64(decoded, position, length);
      }
      if (decoded.length > length) {
        return bytesToBase64(decoded.subarray(0, length));
      }
    }
  } catch {
    /* fall through to a full read */
  }

  try {
    const all = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return sliceBytesToBase64(base64ToBytes(all), position, length);
  } catch {
    return '';
  }
};

export default function useComposerLiveTranscribe({
  onFinal,
  onInterim,
}: TranscribeHandlers = {}) {
  const [listening, setListening] = useState(false);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  const wantListenRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const loopPromiseRef = useRef<Promise<void> | null>(null);
  const sessionStartedRef = useRef(false);
  const readyResolverRef = useRef<(() => void) | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ignoreResultsRef = useRef(false);
  const usedStreamRef = useRef(false);
  const languageRef = useRef('en-US');
  const lastPartialRef = useRef('');
  const lastFinalRef = useRef('');

  onFinalRef.current = onFinal;
  onInterimRef.current = onInterim;

  const clearPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const stopCurrentRecording = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        /* ignore */
      }
    }
    try {
      return recording.getURI();
    } catch {
      return null;
    }
  }, []);

  const sendJson = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  const sendAudioBytes = useCallback(
    (bytes: Uint8Array) => {
      if (!bytes.length) return false;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        const buffer =
          bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
            ? bytes.buffer
            : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        ws.send(buffer);
        return true;
      } catch {
        return sendJson({
          type: 'audio',
          data: bytesToBase64(bytes),
        });
      }
    },
    [sendJson],
  );

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    sessionStartedRef.current = false;
    readyResolverRef.current = null;
    clearPing();
    if (!ws) return;
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }));
      }
    } catch {
      /* ignore */
    }
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }, [clearPing]);

  const handleSocketMessage = useCallback((event: any) => {
    let payload: any;
    try {
      payload = JSON.parse(typeof event.data === 'string' ? event.data : '');
    } catch {
      return;
    }
    if (payload?.type === 'ready') {
      readyResolverRef.current?.();
      readyResolverRef.current = null;
      return;
    }
    if (payload?.type === 'error') {
      wantListenRef.current = false;
      setListening(false);
      return;
    }
    if (ignoreResultsRef.current) return;

    const emitFinal = (text: string) => {
      const finalText = normalizeSpeechText(text);
      if (!finalText) return;
      if (isSameSpeechText(finalText, lastFinalRef.current)) return;
      lastFinalRef.current = finalText;
      lastPartialRef.current = '';
      onFinalRef.current?.(finalText);
    };

    if (payload?.type === 'partial') {
      const partial = normalizeSpeechText(payload.text || '');
      if (!partial) return;
      lastPartialRef.current = partial;
      if (payload.isFinal) {
        emitFinal(partial);
      } else {
        onInterimRef.current?.(partial);
      }
      return;
    }
    if (payload?.type === 'final' || payload?.type === 'utterance-end') {
      emitFinal(payload.text || lastPartialRef.current);
    }
  }, []);

  const waitForReady = useCallback(async () => {
    await Promise.race([
      new Promise<void>((resolve) => {
        readyResolverRef.current = resolve;
      }),
      sleep(READY_TIMEOUT_MS),
    ]);
    readyResolverRef.current = null;
  }, []);

  const startSpeechSession = useCallback(
    (language: string) => {
      if (sessionStartedRef.current) return true;
      const pcm = usePcmStream();
      const started = sendJson({
        type: 'start',
        language,
        mimeType: pcm ? 'audio/l16' : 'audio/aac',
        encoding: pcm ? 'linear16' : '',
        sampleRate: TARGET_SAMPLE_RATE,
        chunkDurationMs: STREAM_POLL_MS,
      });
      if (!started) return false;
      sessionStartedRef.current = true;
      waitForReady();
      return true;
    },
    [sendJson, waitForReady],
  );

  const sendRecordedUri = useCallback(
    async (uri: string, language: string, stripHeader: boolean) => {
      startSpeechSession(language);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) return;
      if (usePcmStream()) {
        const pcm = stripHeader ? stripWavHeader(base64ToBytes(base64)) : base64ToBytes(base64);
        sendAudioBytes(pcm);
        return;
      }
      sendJson({
        type: 'audio',
        data: base64,
      });
    },
    [sendAudioBytes, sendJson, startSpeechSession],
  );

  const startFreshRecording = useCallback(async () => {
    const leftover = await stopCurrentRecording();
    if (leftover) {
      try {
        await FileSystem.deleteAsync(leftover, { idempotent: true });
      } catch {
        /* ignore */
      }
    }
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(PCM_RECORDING_OPTIONS);
    recordingRef.current = recording;
    await recording.startAsync();
    return recording.getURI();
  }, [stopCurrentRecording]);

  const streamGrowingFile = useCallback(
    async (language: string) => {
      const uri = await startFreshRecording();
      if (!uri) return false;

      let offset = 0;
      let headerSkipped = false;
      let grew = false;
      const startedAt = Date.now();
      const pcm = usePcmStream();

      while (wantListenRef.current) {
        await sleep(STREAM_POLL_MS);
        const liveUri = recordingRef.current?.getURI() || uri;
        const size = await getFileSize(liveUri);
        const minBytes = pcm && !headerSkipped ? 64 : pcm ? MIN_PCM_BYTES : MIN_AAC_BYTES;
        if (size > offset + minBytes) {
          grew = true;
          const slice = await readFileSlice(liveUri, offset, size - offset);
          offset = size;
          if (!slice) continue;
          startSpeechSession(language);
          if (pcm) {
            let bytes = base64ToBytes(slice);
            if (!headerSkipped) {
              bytes = stripWavHeader(bytes);
              headerSkipped = true;
            }
            if (bytes.length) sendAudioBytes(bytes);
          } else {
            sendJson({ type: 'audio', data: slice });
          }
        } else if (!grew && Date.now() - startedAt > STREAM_GROW_WAIT_MS) {
          return false;
        }
      }

      if (!grew) return false;

      const stoppedUri = await stopCurrentRecording();
      const liveUri = stoppedUri || uri;
      const size = await getFileSize(liveUri);
      if (size > offset) {
        const slice = await readFileSlice(liveUri, offset, size - offset);
        if (slice) {
          if (pcm) {
            let bytes = base64ToBytes(slice);
            if (!headerSkipped) bytes = stripWavHeader(bytes);
            if (bytes.length) sendAudioBytes(bytes);
          } else {
            sendJson({ type: 'audio', data: slice });
          }
        }
      }
      if (stoppedUri) {
        try {
          await FileSystem.deleteAsync(stoppedUri, { idempotent: true });
        } catch {
          /* ignore */
        }
      }

      return true;
    },
    [sendAudioBytes, sendJson, startFreshRecording, startSpeechSession, stopCurrentRecording],
  );

  const streamPipelinedChunks = useCallback(
    async (language: string) => {
      await startFreshRecording();
      while (wantListenRef.current) {
        await sleep(CHUNK_DURATION_MS);
        const uri = await stopCurrentRecording();
        const starting = wantListenRef.current ? startFreshRecording() : Promise.resolve(null);
        if (uri) {
          sendRecordedUri(uri, language, true)
            .catch((error) => {
              console.error('Live transcription chunk failed:', error);
            })
            .finally(() => {
              FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            });
        }
        await starting;
      }
    },
    [sendRecordedUri, startFreshRecording, stopCurrentRecording],
  );

  const stop = useCallback(async (opts?: { discard?: boolean }) => {
    if (opts?.discard) ignoreResultsRef.current = true;
    wantListenRef.current = false;
    const pendingLoop = loopPromiseRef.current;
    if (pendingLoop) {
      try {
        await pendingLoop;
      } catch {
        /* ignore */
      }
    }
    loopPromiseRef.current = null;
    const lastUri = await stopCurrentRecording();
    if (lastUri && !opts?.discard && !usedStreamRef.current) {
      try {
        await sendRecordedUri(lastUri, languageRef.current, true);
      } catch {
        /* ignore */
      }
      try {
        await FileSystem.deleteAsync(lastUri, { idempotent: true });
      } catch {
        /* ignore */
      }
    } else if (lastUri) {
      try {
        await FileSystem.deleteAsync(lastUri, { idempotent: true });
      } catch {
        /* ignore */
      }
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendJson({ type: 'stop' });
      await sleep(FINAL_FLUSH_MS);
    }
    closeSocket();
    setListening(false);
    await restoreChatPlaybackAudioMode();
  }, [closeSocket, sendJson, sendRecordedUri, stopCurrentRecording]);

  const start = useCallback(
    async (langCode?: string) => {
      await stop();
      ignoreResultsRef.current = false;
      lastPartialRef.current = '';
      lastFinalRef.current = '';
      const granted = await requestChatMicPermission();
      if (!granted) return false;

      try {
        await setChatRecordingAudioMode();
        const token = (await AsyncStorage.getItem('authToken')) || '';
        const ws = await openSpeechSocket(speechSocketUrl(token), handleSocketMessage);
        wsRef.current = ws;
        ws.onerror = () => {
          wantListenRef.current = false;
        };
        ws.onclose = () => {
          wsRef.current = null;
          wantListenRef.current = false;
        };

        wantListenRef.current = true;
        sessionStartedRef.current = false;
        setListening(true);

        pingTimerRef.current = setInterval(() => {
          sendJson({ type: 'ping' });
        }, PING_INTERVAL_MS);

        const language = toDeepgramLang(langCode);
        languageRef.current = language;
        usedStreamRef.current = false;
        startSpeechSession(language);

        loopPromiseRef.current = (async () => {
          try {
            const streamed = await streamGrowingFile(language);
            usedStreamRef.current = streamed === true;
            if (wantListenRef.current && streamed === false) {
              await streamPipelinedChunks(language);
            }
          } catch (error) {
            console.error('Live transcription stream failed:', error);
            if (wantListenRef.current) {
              try {
                await streamPipelinedChunks(language);
              } catch (fallbackError) {
                console.error('Live transcription fallback failed:', fallbackError);
                wantListenRef.current = false;
              }
            }
          } finally {
            sendJson({ type: 'stop' });
            setListening(false);
          }
        })();

        return true;
      } catch (error) {
        console.error('Live transcription failed:', error);
        await stop();
        return false;
      }
    },
    [handleSocketMessage, sendJson, startSpeechSession, stop, streamGrowingFile, streamPipelinedChunks],
  );

  useEffect(
    () => () => {
      wantListenRef.current = false;
      stopCurrentRecording();
      closeSocket();
    },
    [closeSocket, stopCurrentRecording],
  );

  return {
    listening,
    start,
    stop,
    supported: true,
  };
}
