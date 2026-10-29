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
  publishAudio?: boolean;
};

export type AgoraEngineEvent =
  | { type: 'ready' }
  | { type: 'joined' }
  | { type: 'preview-ready' }
  | { type: 'left' }
  | { type: 'user-joined'; uid: number }
  | { type: 'user-published'; uid: number; mediaType: string }
  | { type: 'user-unpublished'; uid: number; mediaType?: string }
  | { type: 'user-left'; uid: number; reason?: string }
  | { type: 'local-rect'; shown: boolean; x: number; y: number; width: number; height: number }
  | { type: 'engine-reset' }
  | { type: 'network-quality'; uplink: number; downlink: number }
  | { type: 'connection-state'; state: string; reason?: string }
  | { type: 'token-will-expire' }
  | { type: 'audio-enabled' }
  | { type: 'video-published' }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string };

export type AgoraWebEngineHandle = {
  join: (payload: AgoraJoinPayload) => void;
  preview: (isAudio: boolean) => void;
  leave: () => void;
  muteAudio: (muted: boolean) => void;
  enableAudio: () => void;
  resumeAudio: () => void;
  muteVideo: (muted: boolean) => void;
  switchCamera: () => void;
  republish?: () => void;
  renewToken: (token: string) => void;
  /** Drags my small camera view (gesture deltas from where the drag began). */
  dragLocal: (phase: 'start' | 'move' | 'end', dx?: number, dy?: number) => void;
};

// Loading the WebView and the Agora SDK takes a second or more; doing it
// while nobody is calling (shortly after the app opens) means an incoming or
// outgoing call connects straight away instead of waiting for it.
const PREWARM_DELAY_MS = 3000;

type Props = {
  visible: boolean;
  isAudio: boolean;
  /**
   * Audio sessions only: render the WebView fully visible (it sits behind the
   * call screen, which covers it). iOS can suspend microphone capture in a
   * WKWebView it does not consider visible; the working video call keeps its
   * WebView fully visible, so the audio call now does the same while its UI
   * is on screen.
   */
  foreground?: boolean;
  /** Load the engine ahead of the first call and keep it between calls. */
  prewarm?: boolean;
  onEvent?: (event: AgoraEngineEvent) => void;
  style?: ViewStyle;
};

const AgoraWebEngine = forwardRef<AgoraWebEngineHandle, Props>(function AgoraWebEngine(
  { visible, isAudio, foreground = false, prewarm = false, onEvent, style },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<any[]>([]);
  const onEventRef = useRef(onEvent);
  const [keptAlive, setKeptAlive] = useState(false);
  // Bumped to replace a WebView whose page process died.
  const [instance, setInstance] = useState(0);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (visible) setKeptAlive(true);
  }, [visible]);

  useEffect(() => {
    if (!prewarm) return undefined;
    const timer = setTimeout(() => setKeptAlive(true), PREWARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [prewarm]);

  // The OS killed the page (memory pressure, or the app sat in the
  // background). The Agora session died with it: load a fresh page; its
  // "ready" event lets the call screen join again and resume the call.
  const onPageGone = useCallback(() => {
    readyRef.current = false;
    pendingRef.current = [];
    setInstance((n) => n + 1);
    onEventRef.current?.({ type: 'engine-reset' });
  }, []);

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
    enableAudio: () => inject({ type: 'enableAudio' }),
    resumeAudio: () => inject({ type: 'resumeAudio' }),
    muteVideo: (muted) => inject({ type: 'muteVideo', muted }),
    switchCamera: () => inject({ type: 'switchCamera' }),
    republish: () => inject({ type: 'republish' }),
    renewToken: (token) => inject({ type: 'renewToken', token }),
    dragLocal: (phase, dx = 0, dy = 0) => inject({ type: 'dragLocal', phase, dx, dy }),
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

  // Not in a call: keep the loaded page parked in a 1pt box.
  const idle = !visible;
  // In a call but not on screen (behind the app, or a minimized call): full
  // size but transparent, so iOS keeps the microphone/camera running.
  const hide = !idle && !foreground;

  return (
    <View
      style={[styles.wrap, style, hide && styles.hiddenAudio, idle && styles.idle]}
      // An audio WebView never takes touches, even when fully visible.
      pointerEvents={idle || hide || isAudio ? 'none' : 'auto'}
      collapsable={false}
    >
      <WebView
        key={instance}
        ref={webViewRef}
        source={{ html: AGORA_WEB_HTML, baseUrl: 'https://download.agora.io/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsFullscreenVideo
        mixedContentMode="always"
        androidLayerType={isAudio ? 'software' : 'hardware'}
        style={styles.webview}
        onMessage={onMessage}
        onContentProcessDidTerminate={onPageGone}
        onRenderProcessGone={onPageGone}
        onError={(e) => onEventRef.current?.({ type: 'error', message: e.nativeEvent.description })}
        onHttpError={(e) => onEventRef.current?.({ type: 'error', message: `http ${e.nativeEvent.statusCode}` })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  hiddenAudio: {
    position: 'absolute',
    // Keep WKWebView attached to a full on-screen surface. iOS may suspend
    // microphone capture for a tiny or completely off-screen WebView.
    right: 0,
    bottom: 0,
    left: 0,
    top: 0,
    opacity: 0.01,
    overflow: 'hidden',
  },
  idle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: undefined,
    bottom: undefined,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default AgoraWebEngine;
