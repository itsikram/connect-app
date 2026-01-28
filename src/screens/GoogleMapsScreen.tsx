import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, BackHandler, Linking } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingBackButton from '../components/FloatingBackButton';

const GoogleMapsScreen = () => {
  const { colors: themeColors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <StatusBar 
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={themeColors.background.primary}
        translucent={false}
      />
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://www.google.com/maps' }}
        style={styles.webview}
        javaScriptEnabled={true}
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
        // Use a modern Android mobile UA for better mobile layout
        userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        originWhitelist={["*"]}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
          setCanGoForward(navState.canGoForward);
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
});

export default GoogleMapsScreen;


