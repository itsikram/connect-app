/**
 * Loads react-native-agora only when the native modules are actually linked.
 * Expo Go and web do not include AgoraRtcEngineModule / AgoraRtcChannelModule;
 * importing the package there crashes at module eval (`module.prefix`).
 */
import { NativeModules } from 'react-native';
import StubRtcEngine, {
  AGORA_UNAVAILABLE_MESSAGE,
  ChannelProfile as StubChannelProfile,
  RtcLocalView as StubRtcLocalView,
  RtcRemoteView as StubRtcRemoteView,
  VideoRenderMode as StubVideoRenderMode,
} from './agoraStub';

export { AGORA_UNAVAILABLE_MESSAGE };

function loadNativeAgora(): any | null {
  try {
    const engineMod = NativeModules.AgoraRtcEngineModule;
    const channelMod = NativeModules.AgoraRtcChannelModule;
    if (!engineMod?.prefix || !channelMod?.prefix) {
      return null;
    }
    return require('react-native-agora');
  } catch (error) {
    console.warn('[agora] Native module unavailable; using stub.', error);
    return null;
  }
}

const nativeAgora = loadNativeAgora();

export const isAgoraAvailable = !!nativeAgora;
export const ChannelProfile = nativeAgora?.ChannelProfile ?? StubChannelProfile;
export const RtcLocalView = nativeAgora?.RtcLocalView ?? StubRtcLocalView;
export const RtcRemoteView = nativeAgora?.RtcRemoteView ?? StubRtcRemoteView;
export const VideoRenderMode = nativeAgora?.VideoRenderMode ?? StubVideoRenderMode;

const RtcEngine = nativeAgora?.default ?? nativeAgora ?? StubRtcEngine;
export default RtcEngine;
