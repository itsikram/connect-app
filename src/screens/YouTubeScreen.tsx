import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, BackHandler, Linking, TouchableOpacity, Text, Alert, Image } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import WebView from 'react-native-webview-proxy';
import { useTheme } from '../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { downloadVideoAndSave } from '../lib/downloads';

const YouTubeScreen = () => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://m.youtube.com');
  const progressPollRef = useRef<any>(null);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [fabOpacity, setFabOpacity] = useState(0.3);
  const fabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Manage FAB opacity when menu toggles
    if (isMenuOpen) {
      setFabOpacity(1.0);
      if (fabTimerRef.current) {
        clearTimeout(fabTimerRef.current);
      }
      fabTimerRef.current = setTimeout(() => {
        setFabOpacity(0.3);
        fabTimerRef.current = null;
      }, 5000);
    } else {
      // When menu closes, ensure opacity returns to the resting state
      if (fabTimerRef.current) {
        clearTimeout(fabTimerRef.current);
        fabTimerRef.current = null;
      }
      setFabOpacity(0.3);
    }
    return () => {
      if (fabTimerRef.current) {
        clearTimeout(fabTimerRef.current);
        fabTimerRef.current = null;
      }
    };
  }, [isMenuOpen]);

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

  const buildDownloadUrl = (youtubeUrl: string, height: number) => {
    console.log('youtubeUrl', youtubeUrl);
    try {
      const normalized = (youtubeUrl || '').replace('m.youtube.com', 'www.youtube.com');
      const encoded = encodeURIComponent(normalized);
      return `https://yt-dl-tyyw.onrender.com/download?url=${encoded}&ext=mp4&height=${height}&disposition=inline&link_only=true`;
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

  const startDownload = async (height: number) => {
    // Notify user immediately
    try {
      await notifee.requestPermission();
      const channelId = await notifee.createChannel({ id: 'downloads', name: 'Downloads', importance: AndroidImportance.LOW });
      await notifee.displayNotification({
        id: `dl-start-${Date.now()}`,
        title: 'Download starting',
        body: `${height}p — preparing...`,
        android: { channelId, onlyAlertOnce: true },
      });
    } catch (_) {}

    const requestUrl = buildDownloadUrl(currentUrl, height);

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
      {/* Single FAB with app logo */}
      <View pointerEvents="box-none" style={styles.fabContainer}>
        {isMenuOpen && (
          <View pointerEvents="box-none" style={styles.menuOverlay}>
            <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setIsMenuOpen(false)} />
            <View style={[styles.menuCard, { backgroundColor: themeColors.surface?.primary || '#1c1c1e', borderColor: themeColors.surface?.secondary || 'rgba(255,255,255,0.08)' }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setIsMenuOpen(false); setShowQualityPicker(true); }}
                activeOpacity={0.85}
              >
                <Icon name="download" size={18} color={themeColors.text?.primary || '#fff'} />
                <Text style={[styles.menuItemText, { color: themeColors.text?.primary || '#fff' }]}>Download</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  if (canGoBack && webViewRef.current) {
                    webViewRef.current.goBack();
                  } else {
                    try { (navigation as any).goBack(); } catch (_) {}
                  }
                }}
                activeOpacity={0.85}
              >
                <Icon name="arrow-back" size={18} color={themeColors.text?.primary || '#fff'} />
                <Text style={[styles.menuItemText, { color: themeColors.text?.primary || '#fff' }]}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setIsMenuOpen(v => !v)}
          style={[styles.fabMain, { backgroundColor: themeColors.primary, opacity: fabOpacity }]}
          activeOpacity={0.9}
        >
          <Image source={require('../assets/images/logo.png')} style={styles.fabLogoImg} resizeMode="contain" />
        </TouchableOpacity>
      </View>
      {showQualityPicker && (
        <View pointerEvents="box-none" style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowQualityPicker(false)} />
          <View style={[styles.sheet, { backgroundColor: themeColors.surface?.primary || '#222' }]}> 
            <Text style={[styles.sheetTitle, { color: themeColors.text?.primary || '#fff' }]}>Choose resolution</Text>
            {[144, 240, 360, 480, 720, 1080].map(h => (
              <TouchableOpacity key={h} style={styles.sheetItem} onPress={() => { setShowQualityPicker(false); startDownload(h); }}>
                <Text style={[styles.sheetItemText, { color: themeColors.text?.primary || '#fff' }]}>{h}p</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
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
  fabContainer: { position: 'absolute', bottom: '48%', right: 10 },
  fabMain: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  fabLogo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  fabLogoImg: { width: 38, height: 38 },
  menuOverlay: { position: 'absolute', left: -16, right: -16, bottom: -16, top: -16 },
  menuBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'transparent' },
  menuCard: { position: 'absolute', right: 0, bottom: 0, borderRadius: 12, borderWidth: 1, paddingVertical: 6, width: 170 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  menuItemText: { marginLeft: 10, fontSize: 14, fontWeight: '600' },
  sheetOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  sheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 10,
    paddingTop: 6,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sheetItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default YouTubeScreen;

