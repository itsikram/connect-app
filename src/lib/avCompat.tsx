import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import {
  AudioQuality,
  RecordingPresets,
  IOSOutputFormat,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync as setExpoAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';
import AudioModuleNative from 'expo-audio/build/AudioModule';
import { useVideoPlayer, VideoView } from 'expo-video';
import { isExpoGo } from './expoGo';

const toLegacyStatus = (status: any) => ({
  ...status,
  isLoaded: Boolean(status?.isLoaded),
  positionMillis: Math.round(Number(status?.currentTime || 0) * 1000),
  durationMillis: Math.round(Number(status?.duration || 0) * 1000),
  isPlaying: Boolean(status?.playing),
  isLooping: Boolean(status?.loop),
  isMuted: Boolean(status?.muted),
  shouldPlay: Boolean(status?.playing),
});

class LegacySound {
  private player: any;
  private subscription: { remove: () => void } | null = null;

  constructor(source: any = null) {
    this.player = createAudioPlayer(source);
  }

  static async createAsync(source: any, initialStatus: any = {}, onStatusUpdate?: (status: any) => void) {
    const sound = new LegacySound(source);
    sound.setOnPlaybackStatusUpdate(onStatusUpdate || null);
    sound.applyStatus(initialStatus);
    return { sound, status: await sound.waitUntilLoaded() };
  }

  async loadAsync(source: any, initialStatus: any = {}) {
    this.player.replace(source);
    this.applyStatus(initialStatus);
    return this.getStatusAsync();
  }

  applyStatus(status: any = {}) {
    if (typeof status.isLooping === 'boolean') this.player.loop = status.isLooping;
    if (typeof status.isMuted === 'boolean') this.player.muted = status.isMuted;
    if (typeof status.volume === 'number') this.player.volume = status.volume;
    if (typeof status.rate === 'number') this.player.playbackRate = status.rate;
    if (typeof status.shouldPlay === 'boolean') {
      if (status.shouldPlay) this.player.play();
      else this.player.pause();
    }
  }

  async getStatusAsync() {
    return toLegacyStatus(this.player.currentStatus);
  }

  async waitUntilLoaded(timeoutMs = 15000) {
    const currentStatus = this.player.currentStatus;
    if (currentStatus?.isLoaded) return toLegacyStatus(currentStatus);
    if (currentStatus?.error) throw new Error(currentStatus.error);

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      const subscription = this.player.addListener('playbackStatusUpdate', (status: any) => {
        if (settled) return;
        if (status?.isLoaded) {
          settled = true;
          clearTimeout(timeout);
          subscription.remove();
          resolve(toLegacyStatus(status));
        } else if (status?.error) {
          settled = true;
          clearTimeout(timeout);
          subscription.remove();
          reject(new Error(status.error));
        }
      });
      timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscription.remove();
        reject(new Error('Timed out while loading audio'));
      }, timeoutMs);
    });
  }

  async playAsync() { this.player.play(); return this.getStatusAsync(); }
  async pauseAsync() { this.player.pause(); return this.getStatusAsync(); }
  async stopAsync() { this.player.pause(); this.player.currentTime = 0; return this.getStatusAsync(); }
  async unloadAsync() { this.player.remove(); }
  async setPositionAsync(positionMillis: number) { await this.player.seekTo(positionMillis / 1000); return this.getStatusAsync(); }
  async setIsLoopingAsync(value: boolean) { this.player.loop = value; return this.getStatusAsync(); }
  async setIsMutedAsync(value: boolean) { this.player.muted = value; return this.getStatusAsync(); }
  async setVolumeAsync(value: number) { this.player.volume = value; return this.getStatusAsync(); }
  async setRateAsync(value: number) { this.player.playbackRate = value; return this.getStatusAsync(); }

  setOnPlaybackStatusUpdate(callback: ((status: any) => void) | null) {
    this.subscription?.remove();
    this.subscription = callback
      ? this.player.addListener('playbackStatusUpdate', (status: any) => callback(toLegacyStatus(status)))
      : null;
  }
}

class LegacyRecording {
  private recorder: any;

  constructor(options: any = RecordingPresets.HIGH_QUALITY) {
    this.recorder = new AudioModuleNative.AudioRecorder(options || RecordingPresets.HIGH_QUALITY);
  }

  static async createAsync(options: any = RecordingPresets.HIGH_QUALITY, onStatusUpdate?: (status: any) => void, _progressUpdateInterval?: number) {
    const recording = new LegacyRecording(options);
    recording.setOnRecordingStatusUpdate(onStatusUpdate || null);
    await recording.recorder.prepareToRecordAsync();
    recording.recorder.record();
    return { recording, status: recording.getStatus() };
  }

  getStatus() {
    const status = this.recorder.getStatus();
    return {
      ...status,
      isLoaded: true,
      isRecording: Boolean(status?.isRecording),
      uri: status?.url || this.recorder.uri,
    };
  }

  async prepareToRecordAsync(options?: any) {
    await this.recorder.prepareToRecordAsync(options);
    return this.getStatus();
  }

  async startAsync() { this.recorder.record(); return this.getStatus(); }
  async stopAndUnloadAsync() { await this.recorder.stop(); return this.getStatus(); }
  getURI() { return this.recorder.uri; }
  setOnRecordingStatusUpdate(callback: ((status: any) => void) | null) {
    this.recorder.removeAllListeners?.('recordingStatusUpdate');
    if (callback) {
      this.recorder.addListener('recordingStatusUpdate', () => callback(this.getStatus()));
    }
  }
}

export const InterruptionModeIOS = { MixWithOthers: 'mixWithOthers', DoNotMix: 'doNotMix', DuckOthers: 'duckOthers' } as const;
export const InterruptionModeAndroid = { DuckOthers: 'duckOthers', DoNotMix: 'doNotMix', MixWithOthers: 'mixWithOthers' } as const;

export const Audio = {
  Sound: LegacySound,
  Recording: LegacyRecording,
  RecordingOptionsPresets: RecordingPresets,
  requestPermissionsAsync: requestRecordingPermissionsAsync,
  getPermissionsAsync: getRecordingPermissionsAsync,
  setIsEnabledAsync: setIsAudioActiveAsync,
  setAudioModeAsync: async (mode: any) => setExpoAudioModeAsync({
    allowsRecording: mode.allowsRecording ?? mode.allowsRecordingIOS,
    playsInSilentMode: mode.playsInSilentMode ?? mode.playsInSilentModeIOS,
    shouldPlayInBackground: mode.shouldPlayInBackground ?? mode.staysActiveInBackground,
    shouldRouteThroughEarpiece: mode.shouldRouteThroughEarpiece ?? mode.playThroughEarpieceAndroid,
    interruptionMode: mode.interruptionMode || mode.interruptionModeAndroid || mode.interruptionModeIOS,
  }),
  IOSAudioQuality: AudioQuality,
  AndroidOutputFormat: { MPEG4: 'mpeg4', AAC_ADTS: 'aac_adts' },
  AndroidAudioEncoder: { AAC: 'aac' },
  IOSOutputFormat: { MPEG4AAC: 'aac ', LINEARPCM: 'lpcm' },
};

export const ResizeMode = { CONTAIN: 'contain', COVER: 'cover', STRETCH: 'fill' } as const;
export const supportsNativeVideoBackgroundPlayback = true;

export const Video = forwardRef<any, any>(function LegacyVideo(props, ref) {
  const {
    source,
    resizeMode,
    useNativeControls,
    isMuted,
    isLooping,
    shouldPlay,
    staysActiveInBackground = true,
    showNowPlayingNotification = true,
    onPlaybackStatusUpdate,
    ...viewProps
  } = props;
  const player = useVideoPlayer(source, (created: any) => {
    created.loop = Boolean(isLooping);
    created.muted = Boolean(isMuted);
    if (shouldPlay) created.play();
  });

  useEffect(() => {
    player.loop = Boolean(isLooping);
    player.muted = Boolean(isMuted);
    if (shouldPlay) player.play(); else player.pause();
  }, [
    player,
    isLooping,
    isMuted,
    shouldPlay,
  ]);

  useEffect(() => {
    // Expo Go cannot apply this app's expo-video config plugin, so its shared
    // client does not include the playback service binder.
    if (isExpoGo()) return undefined;

    // Configure the playback service after the native player is attached to the
    // React context; configuring it during player construction can bind too early.
    const timer = setTimeout(() => {
      player.staysActiveInBackground = staysActiveInBackground;
      player.showNowPlayingNotification = showNowPlayingNotification;
    }, 250);
    return () => clearTimeout(timer);
  }, [player, staysActiveInBackground, showNowPlayingNotification]);

  useEffect(() => {
    if (!onPlaybackStatusUpdate) return undefined;
    const subscription = player.addListener('statusChange', () => onPlaybackStatusUpdate({
      isLoaded: player.status === 'readyToPlay',
      isPlaying: player.playing,
      positionMillis: player.currentTime * 1000,
      durationMillis: player.duration * 1000,
      isLooping: player.loop,
      isMuted: player.muted,
    }));
    return () => subscription.remove();
  }, [player, onPlaybackStatusUpdate]);

  useImperativeHandle(ref, () => ({
    playAsync: async () => { player.play(); },
    pauseAsync: async () => { player.pause(); },
    setPositionAsync: async (milliseconds: number) => { player.currentTime = milliseconds / 1000; },
    getStatusAsync: async () => ({ isLoaded: player.status === 'readyToPlay', isPlaying: player.playing, positionMillis: player.currentTime * 1000, durationMillis: player.duration * 1000 }),
  }), [player]);

  return <VideoView {...viewProps} player={player} nativeControls={Boolean(useNativeControls)} contentFit={resizeMode || 'contain'} />;
});

export type AVPlaybackStatus = any;
export { getRecordingPermissionsAsync, requestRecordingPermissionsAsync };

export namespace Audio {
  export type Sound = LegacySound;
  export type Recording = LegacyRecording;
  export type RecordingOptions = any;
  export type AVPlaybackStatus = any;
  export type AVPlaybackStatusToSet = any;
}
