import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  BackHandler,
  Linking,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractYouTubeVideoId } from '../lib/ytDownload';
import {
  YoutubeDownloadBanner,
  YoutubeDownloadSheet,
  useBackgroundDownloadJobs,
  useBackgroundDownloadToasts,
} from '../components/YoutubeDownloadUI';

type PageVideo = {
  url: string;
  videoId: string | null;
  title: string;
};

const YOUTUBE_RED = '#FF0000';

const adBlockerJS = `
  (function() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && (
        url.includes('doubleclick.net') ||
        url.includes('googleads') ||
        url.includes('googlesyndication') ||
        url.includes('googletagmanager')
      )) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return originalFetch.apply(this, args);
    };
  })();
  true;
`;

const ytPageInfoJS = `
  (function() {
    function getVideoInfo() {
      var href = location.href || '';
      var id = null;
      var title = '';
      try {
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical && canonical.href) href = canonical.href;
      } catch (e) {}
      try {
        var u = new URL(href);
        id = u.searchParams.get('v');
        if (!id) {
          var m = u.pathname.match(/\\/(shorts|embed|live)\\/([^/?]+)/);
          if (m) id = m[2];
        }
        if (!id && u.hostname.indexOf('youtu.be') !== -1) {
          id = u.pathname.replace(/^\\//, '').split('/')[0];
        }
      } catch (e) {}
      try {
        if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.videoDetails) {
          if (!id) id = window.ytInitialPlayerResponse.videoDetails.videoId;
          title = window.ytInitialPlayerResponse.videoDetails.title || '';
        }
      } catch (e) {}
      try {
        if (!title) {
          var og = document.querySelector('meta[property="og:title"]');
          if (og) title = og.getAttribute('content') || '';
        }
      } catch (e) {}
      if (!title) title = document.title || '';
      title = String(title).replace(/\\s*-\\s*YouTube\\s*$/i, '').trim();
      return { url: href, videoId: id, title: title };
    }
    function post() {
      try {
        var info = getVideoInfo();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'yt-nav', url: info.url, videoId: info.videoId, title: info.title }));
      } catch (e) {}
    }
    post();
    setInterval(post, 1500);
    window.addEventListener('yt-navigate-finish', post);
    document.addEventListener('visibilitychange', post);
  })();
  true;
`;

const YouTubeScreen = () => {
  // Downloads run in the background; there is no blocking progressState modal.
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://m.youtube.com');
  const [pageVideo, setPageVideo] = useState<PageVideo>({
    url: 'https://m.youtube.com',
    videoId: null,
    title: '',
  });
  const [optionsVisible, setOptionsVisible] = useState(false);
  const jobs = useBackgroundDownloadJobs();
  const activeJobs = jobs.filter((job) => job.status === 'running');

  const hasVideo = !!pageVideo.videoId;

  const textPrimary = themeColors.text.primary;
  const textSecondary = themeColors.text.secondary;
  const surface = themeColors.surface.primary;
  const background = themeColors.background.primary;
  const border = themeColors.border.primary;
  const primary = themeColors.primary;

  const updatePageVideo = useCallback((url: string, videoId?: string | null, title?: string) => {
    const id = videoId || extractYouTubeVideoId(url);
    setCurrentUrl(url);
    setPageVideo((prev) => {
      const nextTitle = title || prev.title;
      if (prev.url === url && prev.videoId === id && prev.title === nextTitle) return prev;
      return { url, videoId: id, title: nextTitle };
    });
  }, []);

  const handleGoBack = useCallback(() => {
    if (optionsVisible) {
      setOptionsVisible(false);
      return true;
    }
    if (webViewRef.current && canGoBack) {
      webViewRef.current.goBack();
      return true;
    }
    navigation.goBack();
    return true;
  }, [canGoBack, navigation, optionsVisible]);

  const handleGoForward = () => {
    if (webViewRef.current && canGoForward) {
      webViewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleHome = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.location.href = "https://m.youtube.com"; true;');
    }
    setPageVideo({ url: 'https://m.youtube.com', videoId: null, title: '' });
  };

  const handleAppHome = () => {
    (navigation as any).getParent()?.navigate('Home');
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    return () => backHandler.remove();
  }, [handleGoBack]);

  useBackgroundDownloadToasts(jobs);

  const openDownloadOptions = () => {
    const videoId = pageVideo.videoId || extractYouTubeVideoId(currentUrl);
    if (!videoId) {
      Alert.alert('Open a video first', 'Play or open a YouTube video, then tap download.');
      return;
    }
    setOptionsVisible(true);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: background,
        },
        webView: {
          flex: 1,
        },
        navigationBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: surface,
          borderBottomWidth: 1,
          borderBottomColor: border,
          zIndex: 20,
        },
        navButton: {
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginRight: 4,
        },
        downloadButton: {
          marginLeft: 'auto',
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
      }),
    [background, border, insets.top, isDarkMode, primary, surface, textPrimary, textSecondary, themeColors],
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={background}
        translucent={false}
      />

      <View style={styles.navigationBar}>
        <TouchableOpacity style={styles.navButton} onPress={handleGoBack} disabled={!canGoBack && !optionsVisible}>
          <Icon name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={handleGoForward} disabled={!canGoForward}>
          <Icon name="arrow-forward" size={24} color={canGoForward ? textPrimary : textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={handleRefresh}>
          <Icon name="refresh" size={24} color={textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={handleHome}>
          <Icon name="public" size={24} color={textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={handleAppHome}>
          <Icon name="home" size={24} color={textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.downloadButton}
          onPress={openDownloadOptions}
        >
          {activeJobs.length > 0 ? (
            <ActivityIndicator size="small" color={YOUTUBE_RED} />
          ) : (
            <Icon name="download" size={24} color={hasVideo ? YOUTUBE_RED : textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://m.youtube.com' }}
          style={styles.webView}
          javaScriptEnabled={true}
          injectedJavaScriptBeforeContentLoaded={adBlockerJS}
          injectedJavaScript={`${adBlockerJS}\n${ytPageInfoJS}`}
          domStorageEnabled={true}
          cacheEnabled={true}
          cacheMode={Platform.OS === 'android' ? 'LOAD_DEFAULT' : undefined}
          incognito={false}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          pullToRefreshEnabled={Platform.OS === 'android'}
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
          setSupportMultipleWindows={false}
          allowFileAccess={true}
          geolocationEnabled={false}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="compatibility"
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
          userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          originWhitelist={['*']}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            setCanGoForward(navState.canGoForward);
            if (navState.url) updatePageVideo(navState.url);
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data?.type === 'yt-nav') {
                updatePageVideo(data.url || currentUrl, data.videoId, data.title);
              }
            } catch (_) {}
          }}
          onFileDownload={({ nativeEvent }) => {
            const { downloadUrl } = nativeEvent;
            if (downloadUrl) {
              Linking.openURL(downloadUrl).catch(() => {});
            }
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
        />

        <YoutubeDownloadBanner jobs={jobs} />
      </View>

      <YoutubeDownloadSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        videoId={pageVideo.videoId || extractYouTubeVideoId(currentUrl)}
        title={pageVideo.title}
      />
    </View>
  );
};

export default YouTubeScreen;
