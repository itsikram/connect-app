import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Platform, BackHandler, TextInput, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import FloatingBackButton from '../components/FloatingBackButton';
import WebView from 'react-native-webview-proxy';
import { getPresetById } from '../config/vpnConfig';

const DEFAULT_URL = 'https://www.google.com';

const VpnBrowserScreen = () => {
  const { colors: themeColors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [url, setUrl] = useState<string>(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_URL);
  const [proxyHost, setProxyHost] = useState<string>('');
  const [proxyPort, setProxyPort] = useState<string>('');
  const [excludedDomain, setExcludedDomain] = useState<string>('');

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

  const webSource = useMemo(() => {
    const normalizedUrl = inputUrl.trim().length === 0 ? DEFAULT_URL : inputUrl.trim();
    const finalUrl = /^(http|https):\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;
    const hasProxy = proxyHost.trim().length > 0 && proxyPort.trim().length > 0;
    return hasProxy
      ? { uri: finalUrl, proxy: { uri: proxyHost.trim(), port: proxyPort.trim(), excludedDomain: excludedDomain.trim() || undefined } }
      : { uri: finalUrl };
  }, [inputUrl, proxyHost, proxyPort, excludedDomain]);

  const onGoPress = () => {
    setUrl(prev => {
      // trigger reload by changing state dependency
      return webSource.uri;
    });
  };

  const applyNetherlandsPreset = () => {
    const preset = getPresetById('nl');
    if (!preset) return;
    if (preset.host) setProxyHost(preset.host);
    if (preset.port) setProxyPort(preset.port);
    if (preset.excludedDomain) setExcludedDomain(preset.excludedDomain);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={themeColors.background.primary}
        translucent={false}
      />

      <View style={[styles.controlsContainer, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.surface.secondary }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: themeColors.text.secondary }]}>URL</Text>
          <TextInput
            style={[styles.input, { color: themeColors.text.primary, borderColor: themeColors.surface.secondary }]}
            placeholder="Enter URL"
            placeholderTextColor={themeColors.text.secondary + '99'}
            value={inputUrl}
            onChangeText={setInputUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={onGoPress}
          />
          <TouchableOpacity style={[styles.goBtn, { backgroundColor: themeColors.primary }]} onPress={onGoPress}>
            <Text style={[styles.goBtnText, { color: '#fff' }]}>Go</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: themeColors.text.secondary }]}>Proxy</Text>
          <TextInput
            style={[styles.inputSmall, { color: themeColors.text.primary, borderColor: themeColors.surface.secondary }]}
            placeholder="host (e.g. 10.0.2.2)"
            placeholderTextColor={themeColors.text.secondary + '99'}
            value={proxyHost}
            onChangeText={setProxyHost}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.inputTiny, { color: themeColors.text.primary, borderColor: themeColors.surface.secondary }]}
            placeholder="port"
            placeholderTextColor={themeColors.text.secondary + '99'}
            value={proxyPort}
            onChangeText={setProxyPort}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numeric"
            maxLength={5}
          />
          <TouchableOpacity style={[styles.presetBtn, { borderColor: themeColors.primary }]} onPress={applyNetherlandsPreset}>
            <Text style={[styles.presetBtnText, { color: themeColors.primary }]}>NL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: themeColors.text.secondary }]}>Exclude</Text>
          <TextInput
            style={[styles.input, { color: themeColors.text.primary, borderColor: themeColors.surface.secondary }]}
            placeholder="Excluded domain (optional)"
            placeholderTextColor={themeColors.text.secondary + '99'}
            value={excludedDomain}
            onChangeText={setExcludedDomain}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <WebView
        ref={webViewRef}
        source={webSource as any}
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
        userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36"
        originWhitelist={["*"]}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
        onError={(e) => {
          console.warn('WebView error', e.nativeEvent);
        }}
        onHttpError={(e) => {
          console.warn('WebView HTTP error', e.nativeEvent);
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
  controlsContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    width: 60,
    fontSize: 12,
    marginRight: 6,
  },
  input: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  inputSmall: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  inputTiny: {
    width: 80,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  goBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  presetBtn: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});

export default VpnBrowserScreen;


