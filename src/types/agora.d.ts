declare module 'react-native-agora' {
  import React from 'react';
  import { ViewProps } from 'react-native';

  export interface RtcEngine {
    create: (appId: string) => Promise<RtcEngine>;
    joinChannel: (token: string, channelId: string, uid: number) => Promise<void>;
    leaveChannel: () => Promise<void>;
    destroy: () => Promise<void>;
    enableVideo: () => Promise<void>;
    disableVideo: () => Promise<void>;
    enableAudio: () => Promise<void>;
    disableAudio: () => Promise<void>;
    muteLocalAudioStream: (muted: boolean) => Promise<void>;
    muteLocalVideoStream: (muted: boolean) => Promise<void>;
    setClientRole: (role: number) => Promise<void>;
    startPreview: () => Promise<void>;
    stopPreview: () => Promise<void>;
    switchCamera: () => Promise<void>;
    setEnableSpeakerphone: (enabled: boolean) => Promise<void>;
    on: (event: string, callback: Function) => void;
    off: (event: string, callback: Function) => void;
  }

  export const RtcLocalView: {
    SurfaceView: React.ComponentType<{
      style?: any;
      channelId?: string;
      renderMode?: number;
      zOrderMediaOverlay?: boolean;
      mirrorMode?: number;
    }>;
  };

  export const RtcRemoteView: {
    SurfaceView: React.ComponentType<{
      style?: any;
      uid: number;
      channelId?: string;
      renderMode?: number;
      zOrderMediaOverlay?: boolean;
    }>;
  };

  export enum VideoRenderMode {
    Hidden = 1,
    Fit = 2,
    Adaptive = 3,
    Fill = 4,
  }

  export enum ChannelProfile {
    Communication = 0,
    LiveBroadcasting = 1,
    Game = 2,
  }
}
