import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, BackHandler, Linking, TouchableOpacity, Text, Alert } from 'react-native';
import WebView from 'react-native-webview-proxy';
import { useTheme } from '../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingBackButton from '../components/FloatingBackButton';
import axios from 'axios';
import { downloadVideoAndSave } from '../lib/downloads';

const YouTubeScreen = () => {
  const { colors: themeColors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://m.youtube.com');
  const progressPollRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [canGoBack]);

  const adBlockerJS = `
    (function() {
      try {
        // 1) Conservative network filter: only obvious ad domains
        var adDomains = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com'];
        function isAdDomain(url) {
          if (!url) return false;
          try {
            var u = new URL(url, location.href);
            return adDomains.some(function(d){ return u.hostname === d || u.hostname.endsWith('.' + d); });
          } catch (_) { return false; }
        }

        var originalFetch = window.fetch;
        window.fetch = function() {
          try {
            var req = arguments[0];
            var url = typeof req === 'string' ? req : (req && req.url);
            if (isAdDomain(url)) {
              return Promise.resolve(new Response('', { status: 204 }));
            }
          } catch (_) {}
          return originalFetch.apply(this, arguments);
        };

        // 2) Minimal CSS to hide YouTube's own ad overlays without touching layout containers
        var css = '\\
          .ytp-ad-module, .video-ads, .ytp-ad-player-overlay, .ytp-ad-overlay-slot,\\
          .ytp-ad-text-overlay, .ytp-ad-image-overlay, .ytd-display-ad-renderer,\\
          #player-ads, #masthead-ad, .ytd-video-masthead-ad-v3-renderer {\\
            display: none !important; visibility: hidden !important; opacity: 0 !important;\\
          }';
        var style = document.createElement('style');
        style.appendChild(document.createTextNode(css));
        (document.head || document.documentElement).appendChild(style);

        // 3) Auto-click skip button when available. Do NOT force playback rate or seek to avoid UI glitches
        function trySkip() {
          try {
            var skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
            if (skip) skip.click();
          } catch (_) {}
        }

        var observer = new MutationObserver(trySkip);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setInterval(trySkip, 800);
        document.addEventListener('DOMContentLoaded', trySkip);
      } catch (_) {}
    })();
  `;

  const buildDownloadUrl = (youtubeUrl: string) => {
    console.log('youtubeUrl', youtubeUrl);
    try {
      const normalized = (youtubeUrl || '').replace('m.youtube.com', 'www.youtube.com');
      const encoded = encodeURIComponent(normalized);
      return `https://yt-dl-tyyw.onrender.com/download?url=${encoded}&ext=mp4&height=480&disposition=inline&link_only=true`;
    } catch (e) {
      return 'https://yt-dl-tyyw.onrender.com';
    }
  };

  const openInWebView = (url: string) => {
    console.log('url', url);
    // Clear existing poll if any
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }

    // Start polling progress URL until completed, then start download and stop polling
    progressPollRef.current = setInterval(() => {
      axios.get(url)
        .then((res: any) => {
          const status = res?.data?.status;
          const fileUrl: string | undefined = res?.data?.file_url;
          console.log('status', status);
          if (status === 'completed' && typeof fileUrl === 'string' && /(\.mp4)(\b|\?|$)/i.test(fileUrl)) {
            console.log('file download url', fileUrl);
            // Stop polling first
            if (progressPollRef.current) {
              clearInterval(progressPollRef.current);
              progressPollRef.current = null;
            }
            // Trigger in-app download
            downloadVideoAndSave(fileUrl)
              .then((path) => {
                console.log('Saved to', path);
                try { Alert.alert('Downloaded', `Saved to\n${path}`); } catch (e) {}
              })
              .catch(() => {
                // Fallback to opening externally
                Linking.openURL(fileUrl).catch(() => {});
              });
          }
        })
        .catch((err: any) => {
          console.log('progress poll error', err?.message || err);
        });
    }, 2000);
  };

  const startDownload = async () => {
    const requestUrl = buildDownloadUrl(currentUrl);

    const withNoCache = (url: string) => url + (url.indexOf('?') === -1 ? '?' : '&') + `_ts=${Date.now()}`;
    const tryFetch = async (): Promise<any | null> => {
      try {
        const res = await fetch(withNoCache(requestUrl), { headers: { Accept: 'application/json' } });
        return await res.json();
      } catch (_) { return null; }
    };

    // Poll until status becomes 'accepted' (progress_url becomes available)
    let progressUrl: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const json: any = await tryFetch();
      if (json && json.status === 'accepted' && typeof json.progress_url === 'string' && json.progress_url.length > 0) {
        progressUrl = json.progress_url;
        break;
      }
      await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
    }

    openInWebView(progressUrl || requestUrl);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <StatusBar 
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={themeColors.background.primary}
        translucent={false}
      />
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://m.youtube.com' }}
        style={styles.webview}
        javaScriptEnabled={true}
        injectedJavaScriptBeforeContentLoaded={adBlockerJS}
        injectedJavaScript={adBlockerJS}
        domStorageEnabled={true}
        cacheEnabled={true}
        cacheMode={Platform.OS === 'android' ? 'LOAD_DEFAULT' : undefined}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        pullToRefreshEnabled={Platform.OS === 'android'}
        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        setSupportMultipleWindows={false}
        allowFileAccess={true}
        geolocationEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        originWhitelist={["*"]}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
          setCanGoForward(navState.canGoForward);
          if (navState.url) setCurrentUrl(navState.url);
        }}
        onFileDownload={({ nativeEvent }) => {
          const { downloadUrl } = nativeEvent;
          if (downloadUrl) {
            Linking.openURL(downloadUrl).catch(() => {
              // no-op if cannot open
            });
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent);
        }}
      />
      <View pointerEvents="box-none" style={styles.topRightContainer}>
        <TouchableOpacity
          onPress={startDownload}
          style={[styles.fab, { backgroundColor: themeColors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>⇩</Text>
        </TouchableOpacity>
      </View>
      <FloatingBackButton />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  topRightContainer: {
    position: 'absolute',
    top: 100,
    right: 10,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
  },
});

export default YouTubeScreen;
