/**
 * Fallback used when Agora native modules are missing (Expo Go, web, or
 * a build that did not compile react-native-agora).
 */
import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

export const AGORA_UNAVAILABLE_MESSAGE =
  'Voice and video calls are not available in Expo Go or the web browser. Use a development build (npx expo run:ios / run:android).';

export enum ChannelProfile {
  Communication = 0,
  LiveBroadcasting = 1,
  Game = 2,
}

export enum VideoRenderMode {
  Hidden = 1,
  Fit = 2,
  Adaptive = 3,
}

type SurfaceProps = {
  style?: StyleProp<ViewStyle>;
  uid?: number;
  channelId?: string;
  renderMode?: number;
  zOrderMediaOverlay?: boolean;
  mirrorMode?: number;
};

const SurfaceView = ({ style }: SurfaceProps) => React.createElement(View, { style });

export const RtcLocalView = { SurfaceView };
export const RtcRemoteView = { SurfaceView };

class RtcEngine {
  static async create(_appId: string): Promise<RtcEngine> {
    throw new Error(AGORA_UNAVAILABLE_MESSAGE);
  }

  addListener(_event: string, _cb: (...args: any[]) => void) {
    return { remove: () => {} };
  }

  removeAllListeners() {}

  async destroy() {}
  async leaveChannel() {}
  async joinChannel(..._args: any[]) {
    throw new Error(AGORA_UNAVAILABLE_MESSAGE);
  }
  async disableVideo() {}
  async enableVideo() {}
  async enableAudio() {}
  async enableLocalVideo(_enabled: boolean) {}
  async muteLocalAudioStream(_muted: boolean) {}
  async muteLocalVideoStream(_muted: boolean) {}
  async muteRemoteAudioStream(_uid: number, _muted: boolean) {}
  async muteAllRemoteAudioStreams(_muted: boolean) {}
  async setChannelProfile(_profile: number) {}
  async setEnableSpeakerphone(_enabled: boolean) {}
  async switchCamera() {}
  async startPreview() {}
  async stopPreview() {}
  async renewToken(_token: string) {}
  async startScreenCapture(_config?: any) {}
  async stopScreenCapture() {}
}

export default RtcEngine;
