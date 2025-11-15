import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, BackHandler, Linking, TouchableOpacity, Text, Alert, Image, Dimensions } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import WebView from 'react-native-webview-proxy';
import { useTheme } from '../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { downloadVideoAndSave } from '../lib/downloads';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

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
  
  // Check if current URL is a YouTube video
  const isVideoPage = currentUrl && (currentUrl.includes('/watch?v=') || currentUrl.includes('/shorts/'));
  
  // Draggable FAB position
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const fabSize = 40;
  const menuWidth = 170;
  
  // Use shared values for constants that are used in worklets
  const screenWidthShared = useSharedValue(screenWidth);
  const fabSizeShared = useSharedValue(fabSize);
  const menuWidthShared = useSharedValue(menuWidth);
  
  const translateX = useSharedValue(screenWidth - fabSize - 10);
  const translateY = useSharedValue(screenHeight * 0.52 - fabSize / 2);
  const isDragging = useSharedValue(false);
  const [fabSide, setFabSide] = useState<'left' | 'right'>('right'); // Track which side FAB is on
  
  // Update shared values when dimensions change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      screenWidthShared.value = window.width;
      const newFabSize = 40;
      fabSizeShared.value = newFabSize;
    });
    return () => subscription?.remove();
  }, []);

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

  const goToHome = () => {
    setIsMenuOpen(false);
    try {
      // Navigate to app home screen
      (navigation as any).navigate('Home');
    } catch (error) {
      console.warn('Navigation error:', error);
    }
  };

  // Pan gesture handler for draggable FAB
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  
  const toggleMenu = () => {
    setIsMenuOpen(v => !v);
  };

  // Update fabSide when position changes
  const updateFabSide = (x: number) => {
    const centerX = screenWidth / 2;
    setFabSide(x >= centerX ? 'right' : 'left');
  };

  const dragThreshold = 20;
  const startDragDistance = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startDragDistance.value = 0;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const distance = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      startDragDistance.value = distance;

      // Only start dragging if moved more than threshold
      if (distance > dragThreshold) {
        if (!isDragging.value) {
          isDragging.value = true;
          runOnJS(setIsMenuOpen)(false);
        }
        
        const newX = startX.value + e.translationX;
        const newY = startY.value + e.translationY;
        
        // Constrain to screen bounds (accounting for safe areas)
        const maxX = screenWidth - fabSize;
        const maxY = screenHeight - fabSize;
        translateX.value = Math.max(10, Math.min(maxX - 10, newX));
        translateY.value = Math.max(10, Math.min(maxY - 10, newY));
        
        // Update side tracking
        runOnJS(updateFabSide)(translateX.value);
      }
    })
    .onFinalize(() => {
      // Use onFinalize to ensure it always runs
      const wasDragging = isDragging.value;
      const moveDistance = startDragDistance.value;
      
      // If movement was less than threshold and we weren't dragging, treat as tap
      if (moveDistance < dragThreshold && !wasDragging) {
        runOnJS(toggleMenu)();
      }
      
      if (wasDragging) {
        isDragging.value = false;
        // Snap to nearest edge
        const centerX = screenWidth / 2;
        if (translateX.value < centerX) {
          translateX.value = withSpring(10);
          runOnJS(updateFabSide)(10);
        } else {
          translateX.value = withSpring(screenWidth - fabSize - 10);
          runOnJS(updateFabSide)(screenWidth - fabSize - 10);
        }
      }
      startDragDistance.value = 0;
    });

  const composedGesture = panGesture;

  const animatedFabStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  // Determine menu alignment based on FAB position
  const animatedMenuStyle = useAnimatedStyle(() => {
    'worklet';
    const centerX = screenWidthShared.value / 2;
    const isOnRight = translateX.value >= centerX;
    // When FAB is on right: menu appears to the left (negative offset)
    // Menu container right edge should align with FAB's left edge
    // When FAB is on left: menu appears to the right (positive offset)
    // Menu container left edge should align with FAB's right edge
    const gap = 10;
    const menuOffset = isOnRight ? -(menuWidthShared.value + gap) : (fabSizeShared.value + gap);
    
    return {
      transform: [
        { translateX: translateX.value + menuOffset },
        { translateY: translateY.value },
      ],
    };
  });

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

      {/* Draggable FAB with app logo */}
      <View pointerEvents="box-none" style={styles.fabContainer}>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <TouchableOpacity 
              style={styles.fullScreenBackdrop} 
              activeOpacity={1} 
              onPress={() => setIsMenuOpen(false)}
            />
            {/* Menu positioned relative to FAB */}
            <Animated.View style={[
              styles.menuContainer,
              fabSide === 'right' ? styles.menuContainerRight : styles.menuContainerLeft,
              animatedMenuStyle
            ]}>
              <View style={[styles.menuCard, { backgroundColor: themeColors.surface?.primary || '#1c1c1e', borderColor: themeColors.surface?.secondary || 'rgba(255,255,255,0.08)' }]}>

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
                {isVideoPage && (
                <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setIsMenuOpen(false); setShowQualityPicker(true); }}
                activeOpacity={0.85}
              >
                <Icon name="download" size={18} color={themeColors.text?.primary || '#fff'} />
                <Text style={[styles.menuItemText, { color: themeColors.text?.primary || '#fff' }]}>Download</Text>
              </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={goToHome}
                  activeOpacity={0.85}
                >
                  <Icon name="home" size={18} color={themeColors.text?.primary || '#fff'} />
                  <Text style={[styles.menuItemText, { color: themeColors.text?.primary || '#fff' }]}>Home</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </>
        )}

        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.fabWrapper, animatedFabStyle]}>
            <Animated.View
              style={[styles.fabMain, { backgroundColor: themeColors.primary, opacity: fabOpacity }]}
            >
              <Image source={require('../assets/images/logo.png')} style={styles.fabLogoImg} resizeMode="contain" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
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
  downloadButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    right: 10,
    zIndex: 998,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  fabContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none', zIndex: 1000 },
  fabWrapper: { position: 'absolute', width: 40, height: 40 },
  fabMain: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  fabLogo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  fabLogoImg: { width: 38, height: 38 },
  fullScreenBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 999 },
  menuContainer: { position: 'absolute', width: 170, zIndex: 1001 },
  menuContainerRight: { alignItems: 'flex-end' },
  menuContainerLeft: { alignItems: 'flex-start' },
  menuCard: { borderRadius: 12, borderWidth: 1, paddingVertical: 6, width: 170, elevation: 8 },
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

