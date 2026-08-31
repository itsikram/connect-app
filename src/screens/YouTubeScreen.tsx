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
  Modal,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../contexts/ToastContext';
import {
  QUALITY_OPTIONS,
  extractYouTubeVideoId,
  getStageLabel,
  isYouTubeVideoUrl,
  toWatchUrl,
  youtubeThumbnailUrl,
} from '../lib/ytDownload';
import {
  BackgroundDownloadJob,
  cancelBackgroundDownload,
  dismissBackgroundDownload,
  startBackgroundYoutubeDownload,
  subscribeBackgroundDownloads,
} from '../lib/ytDownloadManager';

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
  const { showSuccess, showError, showInfo } = useToast();
  const webViewRef = useRef<WebView>(null);
  const notifiedJobsRef = useRef<Set<string>>(new Set());
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://m.youtube.com');
  const [pageVideo, setPageVideo] = useState<PageVideo>({
    url: 'https://m.youtube.com',
    videoId: null,
    title: '',
  });
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(1080);
  const [audioOnly, setAudioOnly] = useState(false);
  const [postAsWatch, setPostAsWatch] = useState(false);
  const [jobs, setJobs] = useState<BackgroundDownloadJob[]>([]);

  const hasVideo = !!pageVideo.videoId;
  const activeJobs = jobs.filter((job) => job.status === 'running');
  const bannerJob = jobs[0];

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

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    return () => backHandler.remove();
  }, [handleGoBack]);

  useEffect(() => {
    return subscribeBackgroundDownloads(setJobs);
  }, []);

  useEffect(() => {
    jobs.forEach((job) => {
      if (job.status === 'running') return;
      if (notifiedJobsRef.current.has(job.id)) return;
      notifiedJobsRef.current.add(job.id);
      if (job.status === 'completed') {
        const toastTitle = job.title.length > 48 ? `${job.title.slice(0, 45)}…` : job.title;
        showSuccess(
          job.watchPosted
            ? `Posted to Watch: ${toastTitle}`
            : `Saved to ${Platform.OS === 'ios' ? 'Photos' : 'Gallery'}: ${toastTitle}`,
        );
      } else if (job.status === 'failed') {
        showError(job.error || 'Download failed');
      }
    });
  }, [jobs, showError, showSuccess]);

  const openDownloadOptions = () => {
    const videoId = pageVideo.videoId || extractYouTubeVideoId(currentUrl);
    if (!videoId) {
      Alert.alert('Open a video first', 'Play or open a YouTube video, then tap download.');
      return;
    }
    setOptionsVisible(true);
  };

  const queueDownload = () => {
    const videoId = pageVideo.videoId || extractYouTubeVideoId(currentUrl);
    const watchUrl = videoId ? toWatchUrl(videoId) : null;
    if (!videoId || !watchUrl || !isYouTubeVideoUrl(watchUrl)) {
      Alert.alert('Open a video first', 'Play or open a YouTube video, then tap download.');
      return;
    }

    try {
      startBackgroundYoutubeDownload({
        url: watchUrl,
        title: pageVideo.title || `YouTube ${videoId}`,
        quality: selectedQuality,
        audioOnly,
        postAsWatch,
      });
      setOptionsVisible(false);
      showInfo(audioOnly ? 'Audio download started in the background' : 'Download started in the background');
    } catch (error: any) {
      showError(error?.message || 'Could not start download');
    }
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
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: surface,
          borderBottomWidth: 1,
          borderBottomColor: border,
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
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 28,
          maxHeight: '88%',
        },
        sheetHandle: {
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: border,
          marginBottom: 14,
        },
        sheetTitle: {
          color: textPrimary,
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 12,
        },
        videoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        },
        thumb: {
          width: 96,
          height: 54,
          borderRadius: 8,
          backgroundColor: border,
        },
        videoMeta: {
          flex: 1,
          marginLeft: 12,
        },
        videoTitle: {
          color: textPrimary,
          fontSize: 15,
          fontWeight: '600',
        },
        videoSub: {
          color: textSecondary,
          fontSize: 12,
          marginTop: 4,
        },
        sectionLabel: {
          color: textSecondary,
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 8,
          textTransform: 'uppercase',
        },
        qualityRow: {
          borderWidth: 1,
          borderColor: border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        qualityRowActive: {
          borderColor: primary,
          backgroundColor: isDarkMode ? 'rgba(0,212,255,0.12)' : 'rgba(0,212,255,0.08)',
        },
        qualityLabel: {
          color: textPrimary,
          fontSize: 14,
        },
        checkRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
        },
        checkLabel: {
          color: textPrimary,
          fontSize: 14,
          marginLeft: 10,
          flex: 1,
        },
        checkHint: {
          color: textSecondary,
          fontSize: 12,
          marginLeft: 34,
          marginBottom: 8,
        },
        actions: {
          flexDirection: 'row',
          marginTop: 16,
        },
        actionBtn: {
          flex: 1,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cancelBtn: {
          backgroundColor: isDarkMode ? themeColors.surface.secondary : themeColors.background.secondary,
          marginRight: 8,
        },
        confirmBtn: {
          backgroundColor: YOUTUBE_RED,
          marginLeft: 8,
          flexDirection: 'row',
        },
        actionText: {
          color: textPrimary,
          fontWeight: '700',
        },
        confirmText: {
          color: '#fff',
          fontWeight: '700',
          marginLeft: 6,
        },
        bannerWrap: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 20,
        },
        banner: {
          backgroundColor: surface,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: border,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        bannerRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        bannerTextWrap: {
          flex: 1,
          marginHorizontal: 10,
        },
        bannerTitle: {
          color: textPrimary,
          fontSize: 13,
          fontWeight: '700',
        },
        bannerSub: {
          color: textSecondary,
          fontSize: 11,
          marginTop: 2,
        },
        barTrack: {
          height: 4,
          borderRadius: 2,
          backgroundColor: border,
          overflow: 'hidden',
          marginTop: 8,
        },
        barFill: {
          height: 4,
          borderRadius: 2,
          backgroundColor: primary,
        },
        bannerBtn: {
          paddingHorizontal: 8,
          paddingVertical: 6,
        },
      }),
    [background, border, isDarkMode, primary, surface, textPrimary, textSecondary, themeColors],
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

        {bannerJob ? (
          <View style={styles.bannerWrap} pointerEvents="box-none">
            <View style={styles.banner}>
              <View style={styles.bannerRow}>
                {bannerJob.status === 'running' ? (
                  <ActivityIndicator size="small" color={YOUTUBE_RED} />
                ) : (
                  <Icon
                    name={bannerJob.status === 'completed' ? 'check-circle' : bannerJob.status === 'failed' ? 'error' : 'download'}
                    size={22}
                    color={bannerJob.status === 'failed' ? (themeColors.status?.error || '#FF4444') : themeColors.status?.success || '#00C851'}
                  />
                )}
                <View style={styles.bannerTextWrap}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (bannerJob.status === 'completed') {
                        (navigation as any).navigate('Downloads');
                      }
                    }}
                  >
                  <Text style={styles.bannerTitle} numberOfLines={1}>
                    {bannerJob.status === 'completed'
                      ? 'Saved in background'
                      : bannerJob.status === 'failed'
                        ? 'Download failed'
                        : activeJobs.length > 1
                          ? `${activeJobs.length} downloads in background`
                          : 'Downloading in background'}
                  </Text>
                  <Text style={styles.bannerSub} numberOfLines={1}>
                    {bannerJob.status === 'failed'
                      ? bannerJob.error || bannerJob.title
                      : `${bannerJob.title} · ${getStageLabel(bannerJob.stage)} · ${Math.round(bannerJob.progress)}%`}
                  </Text>
                  </TouchableOpacity>
                </View>
                {bannerJob.status === 'running' ? (
                  <TouchableOpacity style={styles.bannerBtn} onPress={() => cancelBackgroundDownload(bannerJob.id)}>
                    <Icon name="close" size={20} color={textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.bannerBtn} onPress={() => dismissBackgroundDownload(bannerJob.id)}>
                    <Icon name="close" size={20} color={textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {bannerJob.status !== 'failed' ? (
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(bannerJob.progress, 3)}%` }]} />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <Modal visible={optionsVisible} transparent animationType="slide" onRequestClose={() => setOptionsVisible(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOptionsVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Download video</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.videoRow}>
                {pageVideo.videoId ? (
                  <Image source={{ uri: youtubeThumbnailUrl(pageVideo.videoId) }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumb} />
                )}
                <View style={styles.videoMeta}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {pageVideo.title || 'YouTube video'}
                  </Text>
                  <Text style={styles.videoSub} numberOfLines={1}>
                    {pageVideo.videoId ? `youtube.com/watch?v=${pageVideo.videoId}` : currentUrl}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Quality</Text>
              {QUALITY_OPTIONS.map((option) => {
                const active = selectedQuality === option.value && !audioOnly;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.qualityRow, active && styles.qualityRowActive, audioOnly && { opacity: 0.45 }]}
                    disabled={audioOnly}
                    onPress={() => setSelectedQuality(option.value)}
                  >
                    <Text style={styles.qualityLabel}>{option.label}</Text>
                    {active ? <Icon name="check" size={20} color={primary} /> : null}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => {
                  const next = !audioOnly;
                  setAudioOnly(next);
                  if (next) setPostAsWatch(false);
                }}
              >
                <Icon
                  name={audioOnly ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={audioOnly ? primary : textSecondary}
                />
                <Text style={styles.checkLabel}>Audio only (high quality MP3)</Text>
              </TouchableOpacity>
              <Text style={styles.checkHint}>Extracts just the audio track at the best available quality.</Text>

              <TouchableOpacity
                style={[styles.checkRow, audioOnly && { opacity: 0.45 }]}
                disabled={audioOnly}
                onPress={() => setPostAsWatch((prev) => !prev)}
              >
                <Icon
                  name={postAsWatch && !audioOnly ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={postAsWatch && !audioOnly ? primary : textSecondary}
                />
                <Text style={styles.checkLabel}>Post as Watch</Text>
              </TouchableOpacity>
              <Text style={styles.checkHint}>
                {audioOnly
                  ? 'Audio-only downloads are saved to your device and are not posted to Watch.'
                  : postAsWatch
                    ? 'Also upload the video to Watch after it finishes.'
                    : 'Save to your device only (not posted to Watch).'}
              </Text>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setOptionsVisible(false)}>
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={queueDownload}>
                <Icon name={audioOnly ? 'audiotrack' : 'download'} size={18} color="#fff" />
                <Text style={styles.confirmText}>{audioOnly ? 'Download audio' : 'Download'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default YouTubeScreen;
