/**
 * Web never has Agora native modules. Keep this file so Metro does not even
 * resolve react-native-agora on web.
 */
export {
  default,
  AGORA_UNAVAILABLE_MESSAGE,
  ChannelProfile,
  RtcLocalView,
  RtcRemoteView,
  VideoRenderMode,
} from './agoraStub';

export const isAgoraAvailable = false;
