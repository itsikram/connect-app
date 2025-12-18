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
      'use strict';
      try {
        // Comprehensive ad domain blocking list
        var adDomains = [
          'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
          'googleads.g.doubleclick.net', 'pagead2.googlesyndication.com', 'tpc.googlesyndication.com',
          'adclick.g.doubleclick.net', 'partner.googleadservices.com', 'ad.doubleclick.net',
          'www.googletagservices.com', 'googletagservices.com', 'googletagmanager.com',
          'www.googletagmanager.com', 'analytics.google.com', 'www-google-analytics.l.google.com',
          'www.google-analytics.com', 'google-analytics.com', 'stats.g.doubleclick.net',
          'googleads.g.doubleclick.net', 'pagead.l.doubleclick.net', 'ads.youtube.com',
          'youtubeads.g.doubleclick.net', 'ade.googlesyndication.com', 'syndication.twitter.com',
          'platform.twitter.com', 'ads-twitter.com', 'facebook.com/tr', 'connect.facebook.net',
          'www.facebook.com/tr', 'analytics.tiktok.com', 'analytics.snapchat.com',
          'adsystem.amazon.com', 'c.amazon-adsystem.com', 'aax-us-east.amazon-adsystem.com',
          'media-amazon.com', 'fls-na.amazon.com', 's.amazon-adsystem.com',
          'adsafeprotected.com', 'advertising.com', 'advertisingnetworks.com',
          'advertising.yahoo.com', 'ads.yahoo.com', 'advertising.yahooinc.com',
          'moatads.com', 'moatpixel.com', 'chartbeat.net', 'scorecardresearch.com',
          'quantserve.com', 'outbrain.com', 'taboola.com', 'criteo.com', 'rubiconproject.com',
          'pubmatic.com', 'openx.net', 'indexexchange.com', 'adsrvr.org', 'adsystem.com',
          'adnxs.com', 'casalemedia.com', 'lijit.com', '1rx.io', '33across.com',
          '2mdn.net', '3lift.com', 'adform.net', 'adtechus.com', 'adtilt.com',
          'advertising.com', 'advertisingnetworks.com', 'advertising.yahoo.com'
        ];

        // URL patterns that indicate ads
        var adPatterns = [
          /\/ad[s]?[\/]?/i, /\/adsystem[s]?/i, /\/advertising/i, /\/pagead/i,
          /\/doubleclick/i, /\/googleadservices/i, /\/googlesyndication/i,
          /\/adservice/i, /\/adserver/i, /\/adtech/i, /\/adtag/i, /\/adform/i,
          /\/prebid/i, /\/adsafeprotected/i, /\/moat/i, /\/scorecardresearch/i,
          /\/quantserve/i, /\/chartbeat/i, /\/analytics/i, /\/tracking/i,
          /\/pixel/i, /\/beacon/i, /\/trk/i, /\/track/i
        ];

        function isAdUrl(url) {
          if (!url || typeof url !== 'string') return false;
          try {
            var u = new URL(url, location.href);
            var hostname = u.hostname.toLowerCase();
            var pathname = u.pathname.toLowerCase();
            
            // Check against ad domains
            if (adDomains.some(function(d) { 
              return hostname === d || hostname.endsWith('.' + d); 
            })) {
              return true;
            }
            
            // Check against ad patterns in URL
            if (adPatterns.some(function(p) { 
              return p.test(url) || p.test(pathname) || p.test(hostname); 
            })) {
              return true;
            }
            
            // Check query parameters
            var searchParams = u.searchParams;
            var adParams = ['ad', 'ads', 'adid', 'ad_id', 'adurl', 'ad_url', 'advert', 
                          'advertising', 'adformat', 'adformat', 'adtype', 'ad_type',
                          'adsize', 'ad_size', 'adv', 'advertising', 'campaign', 'utm_source'];
            for (var i = 0; i < adParams.length; i++) {
              if (searchParams.has(adParams[i])) {
                return true;
              }
            }
            
            return false;
          } catch (_) { 
            // If URL parsing fails, check if URL string contains ad patterns
            return adPatterns.some(function(p) { return p.test(url); });
          }
        }

        // Block fetch requests
        var originalFetch = window.fetch;
        window.fetch = function() {
          try {
            var req = arguments[0];
            var url = typeof req === 'string' ? req : (req && req.url);
            if (url && isAdUrl(url)) {
              console.log('[AdBlocker] Blocked fetch:', url);
              return Promise.resolve(new Response('', { status: 204, statusText: 'No Content' }));
            }
          } catch (_) {}
          return originalFetch.apply(this, arguments);
        };

        // Block XMLHttpRequest
        var originalXHROpen = XMLHttpRequest.prototype.open;
        var originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function() {
          var url = arguments[1];
          if (url && isAdUrl(url)) {
            console.log('[AdBlocker] Blocked XHR:', url);
            this._blocked = true;
            return;
          }
          return originalXHROpen.apply(this, arguments);
        };
        
        XMLHttpRequest.prototype.send = function() {
          if (this._blocked) {
            return;
          }
          return originalXHRSend.apply(this, arguments);
        };

        // Block resource loading (images, scripts, etc.)
        var originalAppendChild = Element.prototype.appendChild;
        Element.prototype.appendChild = function() {
          var node = arguments[0];
          if (node && node.tagName) {
            var src = node.src || node.href || '';
            if (src && isAdUrl(src)) {
              console.log('[AdBlocker] Blocked resource:', src);
              return node; // Return node but don't actually append
            }
          }
          return originalAppendChild.apply(this, arguments);
        };

        // Comprehensive CSS to hide all YouTube ad elements
        var css = '\\n' +
          '/* Video player ads */\\n' +
          '.ytp-ad-module, .video-ads, .ytp-ad-player-overlay, .ytp-ad-overlay-slot,\\n' +
          '.ytp-ad-text-overlay, .ytp-ad-image-overlay, .ytp-ad-overlay-container,\\n' +
          '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container,\\n' +
          '#player-ads, #masthead-ad, .ytd-video-masthead-ad-v3-renderer,\\n' +
          '.ytd-display-ad-renderer, ytd-display-ad-renderer,\\n' +
          '/* In-stream ads */\\n' +
          '.ytp-ad-module__container, .ytp-ad-module__video-content,\\n' +
          '.ytp-ad-skip-button-container, .ytp-ad-skip-button,\\n' +
          '.ytp-ad-skip-button-modern, .ytp-ad-overlay-close-button,\\n' +
          '.ytp-ad-overlay, .ytp-ad-text, .ytp-ad-action-interstitial,\\n' +
          '/* Banner ads */\\n' +
          '.ytd-banner-promo-renderer, ytd-banner-promo-renderer,\\n' +
          '.ytd-promoted-sparkles-web-renderer, ytd-promoted-sparkles-web-renderer,\\n' +
          '.ytd-promoted-video-renderer, ytd-promoted-video-renderer,\\n' +
          '.ytd-in-feed-ad-layout-renderer, ytd-in-feed-ad-layout-renderer,\\n' +
          '/* Sidebar ads */\\n' +
          '.ytd-watch-next-secondary-results-renderer ytd-compact-promoted-video-renderer,\\n' +
          'ytd-compact-promoted-video-renderer,\\n' +
          '.ytd-promoted-sparkles-text-search-renderer, ytd-promoted-sparkles-text-search-renderer,\\n' +
          '/* Ad containers */\\n' +
          '[class*="ad"], [id*="ad"], [class*="Ad"], [id*="Ad"],\\n' +
          '[class*="promo"], [id*="promo"], [class*="sponsor"], [id*="sponsor"],\\n' +
          '.ad-container, .ad-div, .ad-wrapper, .adsbygoogle,\\n' +
          '.ad-banner, .ad-banner-container, .advertisement,\\n' +
          '/* YouTube specific ad classes */\\n' +
          '.ytp-ad-progress, .ytp-ad-progress-list, .ytp-ad-progress-list-item,\\n' +
          '.ytp-ad-overlay-image, .ytp-ad-overlay-close-button,\\n' +
          '.ytp-ad-overlay-ad-info-button-container,\\n' +
          'ytd-ad-slot-renderer, ytd-display-ad-renderer,\\n' +
          'ytd-compact-promoted-video-renderer, ytd-promoted-sparkles-web-renderer,\\n' +
          'ytd-promoted-sparkles-text-search-renderer,\\n' +
          'ytd-in-feed-ad-layout-renderer, ytd-search-pyv-renderer {\\n' +
          '  display: none !important;\\n' +
          '  visibility: hidden !important;\\n' +
          '  opacity: 0 !important;\\n' +
          '  height: 0 !important;\\n' +
          '  width: 0 !important;\\n' +
          '  position: absolute !important;\\n' +
          '  pointer-events: none !important;\\n' +
          '  z-index: -9999 !important;\\n' +
          '}\\n' +
          '/* Hide ad indicators */\\n' +
          '.ytp-ad-text, .ytp-ad-message, .ytp-ad-duration-remaining {\\n' +
          '  display: none !important;\\n' +
          '}\\n';
        
        var style = document.createElement('style');
        style.id = 'youtube-adblocker-style';
        style.appendChild(document.createTextNode(css));
        if (document.head) {
          document.head.appendChild(style);
        } else {
          document.documentElement.appendChild(style);
        }

        // Aggressive ad skipping
        function skipAds() {
          try {
            // Skip button for video ads
            var skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container .ytp-ad-skip-button');
            if (skipBtn && skipBtn.offsetParent !== null) {
              skipBtn.click();
              console.log('[AdBlocker] Clicked skip button');
            }

            // Close overlay ads
            var closeBtn = document.querySelector('.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container');
            if (closeBtn && closeBtn.offsetParent !== null) {
              closeBtn.click();
              console.log('[AdBlocker] Closed ad overlay');
            }

            // Try to skip by seeking (last resort)
            var video = document.querySelector('video');
            if (video && video.duration && !video.paused) {
              // If ad is playing, try to skip to end
              var adModule = document.querySelector('.ytp-ad-module');
              if (adModule && adModule.offsetParent !== null) {
                // Only seek if we detect an ad is actually playing
                try {
                  video.currentTime = video.duration - 0.1;
                } catch (_) {}
              }
            }

            // Remove ad containers from DOM
            var adSelectors = [
              '.ytp-ad-module', '.video-ads', '.ytp-ad-player-overlay',
              '.ytd-display-ad-renderer', 'ytd-display-ad-renderer',
              'ytd-compact-promoted-video-renderer', 'ytd-promoted-sparkles-web-renderer',
              '.ytd-banner-promo-renderer', 'ytd-banner-promo-renderer'
            ];
            adSelectors.forEach(function(selector) {
              try {
                var elements = document.querySelectorAll(selector);
                elements.forEach(function(el) {
                  if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                  }
                });
              } catch (_) {}
            });
          } catch (e) {
            console.error('[AdBlocker] Error in skipAds:', e);
          }
        }

        // MutationObserver for dynamically added ads
        var observer = new MutationObserver(function() {
          skipAds();
        });
        
        if (document.documentElement) {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id']
          });
        }

        // Periodically skip ads
        setInterval(skipAds, 500);
        
        // Run on DOM ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', skipAds);
        } else {
          skipAds();
        }

        // Run when page becomes visible
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
            skipAds();
          }
        });

        console.log('[AdBlocker] YouTube ad blocker initialized');
      } catch (e) {
        console.error('[AdBlocker] Initialization error:', e);
      }
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
    // Use longer interval to reduce CPU usage and network requests
    progressPollRef.current = setInterval(() => {
      axios.get(url)
        .then((res: any) => {
          const status = res?.data?.status;
          const fileUrl: string | undefined = res?.data?.file_url;
          if (status === 'completed' && typeof fileUrl === 'string' && /(\.mp4)(\b|\?|$)/i.test(fileUrl)) {
            // Stop polling first
            if (progressPollRef.current) {
              clearInterval(progressPollRef.current);
              progressPollRef.current = null;
            }
            // Trigger in-app download
            downloadVideoAndSave(fileUrl)
              .then((path) => {
                try { Alert.alert('Downloaded', `Saved to\n${path}`); } catch (e) {}
              })
              .catch(() => {
                // Fallback to opening externally
                Linking.openURL(fileUrl).catch(() => {});
              });
          }
        })
        .catch((err: any) => {
          // Reduce error logging frequency
          if (__DEV__) {
            console.log('progress poll error', err?.message || err);
          }
        });
    }, 3000); // Increased from 2000ms to 3000ms to reduce CPU usage
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
        geolocationEnabled={false}
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

