import React, { useEffect, useRef, useState } from 'react';
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
  Dimensions,
} from 'react-native';
import WebView from 'react-native-webview';
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
  
  const screenWidth = Dimensions.get('window').width;
  
  const handleDownload = async () => {
    try {
      const url = currentUrl;
      if (!url) {
        Alert.alert('Error', 'No video URL available');
        return;
      }
      
      await downloadVideoAndSave(url);
      Alert.alert('Success', 'Video downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download video');
    }
  };

  const handleGoBack = () => {
    if (webViewRef.current && canGoBack) {
      webViewRef.current.goBack();
      return true;
    } else {
      navigation.goBack();
      return true;
    }
  };

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
      webViewRef.current.injectJavaScript('window.location.href = "https://m.youtube.com"');
    }
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    return () => backHandler.remove();
  }, [canGoBack]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: (themeColors.background as any)?.primary || themeColors.background || '#fff',
    },
    webView: {
      flex: 1,
      height: '100%',
    },
    navigationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: (themeColors.surface as any)?.primary || themeColors.surface || '#f5f5f5',
      borderBottomWidth: 1,
      borderBottomColor: (themeColors.border as any) || '#e0e0e0',
    },
    navButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    downloadButton: {
      marginLeft: 'auto',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    navButtonText: {
      color: (themeColors.text as any)?.primary || themeColors.text || '#000',
      fontSize: 16,
    },
  });

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
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={(themeColors.background as any)?.primary || themeColors.background || '#fff'}
        translucent={false}
      />
      
      <View style={styles.navigationBar}>
        <TouchableOpacity style={styles.navButton} onPress={handleGoBack} disabled={!canGoBack}>
          <Icon name="arrow-back" size={24} color={(themeColors.text as any)?.primary || themeColors.text || '#000'} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={handleGoForward} disabled={!canGoForward}>
          <Icon name="arrow-forward" size={24} color={(themeColors.text as any)?.primary || themeColors.text || '#000'} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={handleRefresh}>
          <Icon name="refresh" size={24} color={(themeColors.text as any)?.primary || themeColors.text || '#000'} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={handleHome}>
          <Icon name="home" size={24} color={(themeColors.text as any)?.primary || themeColors.text || '#000'} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
          <Icon name="download" size={24} color={(themeColors.text as any)?.primary || themeColors.text || '#000'} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://m.youtube.com' }}
          style={styles.webView}
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
        />
      </View>
    </SafeAreaView>
  );
};

export default YouTubeScreen;
