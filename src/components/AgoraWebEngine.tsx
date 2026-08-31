import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { AGORA_WEB_HTML } from '../lib/agoraWebHtml';

export type AgoraJoinPayload = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
  isAudio: boolean;
};

export type AgoraEngineEvent =
  | { type: 'ready' }
  | { type: 'joined' }
  | { type: 'preview-ready' }
  | { type: 'left' }
  | { type: 'user-published'; uid: number; mediaType: string }
  | { type: 'user-unpublished'; uid: number; mediaType?: string }
  | { type: 'user-left'; uid: number }
  | { type: 'network-quality'; uplink: number; downlink: number }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string };

export type AgoraWebEngineHandle = {
  join: (payload: AgoraJoinPayload) => void;
  preview: (isAudio: boolean) => void;
  leave: () => void;
  muteAudio: (muted: boolean) => void;
  muteVideo: (muted: boolean) => void;
  switchCamera: () => void;
};

type Props = {
  visible: boolean;
  isAudio: boolean;
  onEvent?: (event: AgoraEngineEvent) => void;
  style?: ViewStyle;
};

const AgoraWebEngine = forwardRef<AgoraWebEngineHandle, Props>(function AgoraWebEngine(
  { visible, isAudio, onEvent, style },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<any[]>([]);
  const onEventRef = useRef(onEvent);
  const [keptAlive, setKeptAlive] = useState(false);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (visible) setKeptAlive(true);
  }, [visible]);

  const inject = useCallback((cmd: Record<string, unknown>) => {
    const js = `window.__agoraHandle && window.__agoraHandle(${JSON.stringify(cmd)}); true;`;
    if (!readyRef.current) {
      pendingRef.current.push(cmd);
      return;
    }
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const flushPending = useCallback(() => {
    const queued = pendingRef.current;
    pendingRef.current = [];
    queued.forEach((cmd) => {
      const js = `window.__agoraHandle && window.__agoraHandle(${JSON.stringify(cmd)}); true;`;
      webViewRef.current?.injectJavaScript(js);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    join: (payload) => inject({ type: 'join', ...payload }),
    preview: (audioOnly) => inject({ type: 'preview', isAudio: audioOnly }),
    leave: () => inject({ type: 'leave' }),
    muteAudio: (muted) => inject({ type: 'muteAudio', muted }),
    muteVideo: (muted) => inject({ type: 'muteVideo', muted }),
    switchCamera: () => inject({ type: 'switchCamera' }),
  }), [inject]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as AgoraEngineEvent;
      if (data?.type === 'ready') {
        readyRef.current = true;
        flushPending();
      }
      onEventRef.current?.(data);
    } catch (error) {
      console.warn('AgoraWebEngine: failed to parse message', error);
    }
  }, [flushPending]);

  const mounted = visible || keptAlive;
  if (!mounted) {
    return null;
  }

  const hide = !visible || isAudio;

  return (
    <View style={[styles.wrap, hide && styles.hiddenAudio, style]} pointerEvents={hide ? 'none' : 'auto'} collapsable={false}>
      <WebView
        ref={webViewRef}
        source={{ html: AGORA_WEB_HTML, baseUrl: 'https://download.agora.io/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsFullscreenVideo
        mixedContentMode="always"
        androidLayerType={isAudio ? 'software' : 'hardware'}
        style={styles.webview}
        onMessage={onMessage}
        onError={(e) => onEventRef.current?.({ type: 'error', message: e.nativeEvent.description })}
        onHttpError={(e) => onEventRef.current?.({ type: 'error', message: `http ${e.nativeEvent.statusCode}` })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  hiddenAudio: {
    position: 'absolute',
    width: 64,
    height: 64,
    left: -200,
    top: 0,
    opacity: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default AgoraWebEngine;
