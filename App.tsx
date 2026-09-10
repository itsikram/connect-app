/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { NavigationContainer, useNavigation, useRoute, getFocusedRouteNameFromRoute, useNavigationState } from '@react-navigation/native';
import { navigationRef, markNavigationReady } from './src/lib/navigationService';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, useColorScheme, ActivityIndicator, View, Alert, Platform, Linking, AppState, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProfessionalTabBar from './src/components/ProfessionalTabBar';
import { hideTabBarForChat, restoreTabBarAfterChat, useChatScreenChrome } from './src/lib/chatScreenChrome';
import { colors } from './src/theme/colors';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import { ThemeProvider, ThemeContext } from './src/contexts/ThemeContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { Provider as PaperProvider } from 'react-native-paper';
// Firebase removed for Expo compatibility
import Home from './src/screens/Home';
import Message from './src/screens/Message';
import Menu from './src/screens/Menu';
import YouTubeScreen from './src/screens/YouTubeScreen';
import FitnessOnboarding from './src/screens/FitnessOnboarding';
import FitnessDashboard from './src/screens/FitnessDashboard';
import FitnessMeal from './src/screens/FitnessMeal';
import FitnessConfirmation from './src/screens/FitnessConfirmation';
import FitnessWeight from './src/screens/FitnessWeight';
import FitnessProgress from './src/screens/FitnessProgress';
import FitnessReminders from './src/screens/FitnessReminders';
import FitnessCoach from './src/screens/FitnessCoach';
import FitnessRecommendations from './src/screens/FitnessRecommendations';
import Settings from './src/screens/Settings';
import Tasks from './src/screens/Tasks';
import Notes from './src/screens/Notes';
import MyProfile from './src/screens/MyProfile';
import Connects from './src/screens/Connects';
// Redux Provider and store
import { Provider, useSelector, useDispatch } from 'react-redux';
import store, { RootState } from './src/store';
// Profile data hook
import { useProfileData } from './src/hooks/useProfileData';
import SingleMessage from './src/screens/SingleMessage';
import ConnectProfile from './src/screens/ConnectProfile';
import Videos from './src/screens/Videos';
import SinglePost from './src/screens/SinglePost';
import SingleWatch from './src/screens/SingleWatch';
import EditPost from './src/screens/EditPost';
import AudioCall from './src/components/AudioCall';
import VideoCall from './src/components/VideoCall';
import LiveVoice from './src/components/LiveVoice';
import CameraScreen from './src/screens/CameraScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import GalleryPreview from './src/screens/GalleryPreview';
// Socket context
import { SocketProvider, useSocket } from './src/contexts/SocketContext';
import { ToastProvider, useToast } from './src/contexts/ToastContext';
import { UserToastProvider, useUserToast } from './src/contexts/UserToastContext';
import { ModernToastProvider } from './src/contexts/ModernToastContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { LudoGameProvider, useLudoGame } from './src/contexts/LudoGameContext';
import { ChessGameProvider, useChessGame } from './src/contexts/ChessGameContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import LoadingScreen from './src/components/LoadingScreen';
import FacebookHeader from './src/components/FacebookHeader';
import AIAgentModal from './src/components/AIAgentModal';
import { type AgentSpeechLanguage } from './src/services/agentSpeechService';
import { HeaderVisibilityProvider } from './src/contexts/HeaderVisibilityContext';
import { CallMinimizeProvider } from './src/contexts/CallMinimizeContext';
import MinimizedCallBar from './src/components/MinimizedCallBar';
import { WatchPipProvider } from './src/contexts/WatchPipContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import PaymentInstructionsScreen from './src/screens/PaymentInstructionsScreen';
import PaymentSubmissionScreen from './src/screens/PaymentSubmissionScreen';
import PaymentPendingConfirmationScreen from './src/screens/PaymentPendingConfirmationScreen';
import WalletScreen from './src/screens/WalletScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import WatchPipPlayer from './src/components/watch/WatchPipPlayer';
import TopNavigationProgress, { TopNavigationProgressRef } from './src/components/TopNavigationProgress';
import SwipeTabsOverlay from './src/components/SwipeTabsOverlay';
import PermissionsInitializer from './src/components/PermissionsInitializer';
import ExpoGoFallback from './src/components/ExpoGoFallback';
import { isAndroidExpoGo } from './src/lib/expoGo';

import * as Speech from 'expo-speech';
import { ensureSpeakMessageListener } from './src/lib/speakMessagePlayback';
import { addNotifications } from './src/reducers/notificationReducer';
import { addNewMessage } from './src/reducers/chatReducer';
import { setConnectOnline, setConnectOffline, setConnectLastSeen } from './src/reducers/presenceReducer';
import api, { connectAPI, userAPI } from './src/lib/api';
import ConnectCacheManager from './src/utils/connectCacheManager';
import FloatingButton from './src/components/FloatingButton';
// Background services removed for Expo compatibility
import UpdateModal from './src/components/UpdateModal';
// RNFS replaced with Expo FileSystem
import * as FileSystem from 'expo-file-system';
// Remote config removed for Expo compatibility
import { getRemoteConfig, subscribeRemoteConfig } from './src/lib/remoteConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ExpoGoSafeNotificationSetup = React.memo(() => {
  const [Setup, setSetup] = React.useState<React.ComponentType | null>(null);

  React.useEffect(() => {
    if (isAndroidExpoGo()) return;
    import('./src/components/NotificationSetup').then((module) => {
      setSetup(() => module.default);
    });
  }, []);

  return Setup ? <Setup /> : null;
});


// Stack navigator for Message tab
function MessageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="MessageList"
        component={Message}
        options={{
          headerShown: false,
          contentStyle: { flex: 1 },
        }}
      />
      <Stack.Screen
        name="SingleMessage"
        component={SingleMessage}
        options={{
          headerShown: false,
          contentStyle: { flex: 1, height: '100%' },
        }}
        listeners={({ navigation }) => ({
          transitionStart: (e) => {
            if (!e.data.closing) hideTabBarForChat(navigation);
          },
          beforeRemove: () => restoreTabBarAfterChat(navigation),
        })}
      />
      <Stack.Screen name="ConnectProfile" component={ConnectProfile} />
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="EditPost" component={EditPost} />
      <Stack.Screen name="SingleWatch" component={SingleWatch} />
      {/* Video calling screens removed for Expo compatibility */}
    </Stack.Navigator>
  );
}

// Stack navigator for Home tab
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={Home} />
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="SingleWatch" component={SingleWatch} />
      <Stack.Screen name="EditPost" component={EditPost} />
      <Stack.Screen name="ConnectProfile" component={ConnectProfile} />
      <Stack.Screen name="Camera" component={CameraScreen} />
      <Stack.Screen name="Gallery" component={GalleryScreen} />
      <Stack.Screen name="GalleryPreview" component={GalleryPreview} />
    </Stack.Navigator>
  );
}

// Stack navigator for Videos tab
function VideosStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VideosMain" component={Videos} />
      <Stack.Screen name="SingleVideo" component={SingleWatch} />
      <Stack.Screen name="SingleWatch" component={SingleWatch} />
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="EditPost" component={EditPost} />
      <Stack.Screen name="ConnectProfile" component={ConnectProfile} />
    </Stack.Navigator>
  );
}

// Stack navigator for Connects tab
function ConnectsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConnectsMain" component={Connects} />
      <Stack.Screen name="ConnectProfile" component={ConnectProfile} />
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="EditPost" component={EditPost} />
      <Stack.Screen name="SingleWatch" component={SingleWatch} />
    </Stack.Navigator>
  );
}

// Safe dynamic import wrapper for screens that might fail to load
const SafeScreen = React.memo(({ screenName, navigation, route, ...rest }: { screenName: string; navigation: any; route?: any } & Record<string, any>) => {
  const [ScreenComponent, setScreenComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadScreen = async () => {
      try {
        let component;
        switch (screenName) {
          case 'VideoLibrary':
            component = await import('./src/screens/VideoLibraryScreen');
            break;
          case 'Downloads':
            component = await import('./src/screens/DownloadsScreen');
            break;
          case 'MediaPlayer':
            component = await import('./src/screens/MediaPlayer');
            break;
          case 'Facebook':
            component = await import('./src/screens/FacebookScreen');
            break;
          case 'YouTube':
            component = await import('./src/screens/YouTubeScreen');
            break;
          case 'VpnBrowser':
            component = await import('./src/screens/VpnBrowserScreen');
            break;
          case 'Cricbuzz':
            component = await import('./src/screens/CricbuzzScreen');
            break;
          case 'GoogleMaps':
            component = await import('./src/screens/GoogleMapsScreen');
            break;
          case 'GoogleContacts':
            component = await import('./src/screens/GoogleContactsScreen');
            break;
          default:
            throw new Error(`Unknown screen: ${screenName}`);
        }
        setScreenComponent(() => component.default);
      } catch (err) {
        console.error(`Failed to load screen ${screenName}:`, err);
        setError(screenName);
      }
    };

    loadScreen();
  }, [screenName]);

  if (error) {
    return (
      <ExpoGoFallback 
        featureName={error} 
        onGoBack={() => navigation?.goBack()} 
      />
    );
  }

  if (!ScreenComponent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  return <ScreenComponent navigation={navigation} route={route} {...rest} />;
});

function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuHome" component={Menu} />
      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="EditPost" component={EditPost} />
      <Stack.Screen name="ConnectProfile" component={ConnectProfile} />
      <Stack.Screen name="SingleWatch" component={SingleWatch} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="Tasks" component={Tasks} />
      <Stack.Screen name="Notes" component={Notes} />
      <Stack.Screen name="FitnessOnboarding" component={FitnessOnboarding} />
      <Stack.Screen name="FitnessDashboard" component={FitnessDashboard} />
      <Stack.Screen name="FitnessMeal" component={FitnessMeal} />
      <Stack.Screen name="FitnessConfirmation" component={FitnessConfirmation} />
      <Stack.Screen name="FitnessWeight" component={FitnessWeight} />
      <Stack.Screen name="FitnessProgress" component={FitnessProgress} />
      <Stack.Screen name="FitnessReminders" component={FitnessReminders} />
      <Stack.Screen name="FitnessCoach" component={FitnessCoach} />
      <Stack.Screen name="FitnessRecommendations" component={FitnessRecommendations} />
      <Stack.Screen name="PaymentInstructions" component={PaymentInstructionsScreen} />
      <Stack.Screen name="PaymentSubmission" component={PaymentSubmissionScreen} />
      <Stack.Screen
        name="PaymentPendingConfirmation"
        component={PaymentPendingConfirmationScreen}
      />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionScreen} />
      <Stack.Screen name="VideoLibrary">
        {(props) => <SafeScreen {...props} screenName="VideoLibrary" />}
      </Stack.Screen>
      <Stack.Screen name="Downloads">
        {(props) => <SafeScreen {...props} screenName="Downloads" />}
      </Stack.Screen>
      <Stack.Screen name="MediaPlayer">
        {(props) => <SafeScreen {...props} screenName="MediaPlayer" />}
      </Stack.Screen>
      <Stack.Screen name="Facebook">
        {(props) => <SafeScreen {...props} screenName="Facebook" />}
      </Stack.Screen>
      <Stack.Screen name="YouTube" component={YouTubeScreen} />
      <Stack.Screen name="VpnBrowser">
        {(props) => <SafeScreen {...props} screenName="VpnBrowser" />}
      </Stack.Screen>
      <Stack.Screen name="Cricbuzz">
        {(props) => <SafeScreen {...props} screenName="Cricbuzz" />}
      </Stack.Screen>
      <Stack.Screen name="GoogleMaps">
        {(props) => <SafeScreen {...props} screenName="GoogleMaps" />}
      </Stack.Screen>
      <Stack.Screen name="GoogleContacts">
        {(props) => <SafeScreen {...props} screenName="GoogleContacts" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// Tab bar component that checks for Ludo game state
function getDeepestRouteName(state: any): string {
  let current = state;
  let name = '';
  while (current?.routes && typeof current.index === 'number' && current.routes[current.index]) {
    name = current.routes[current.index].name;
    current = current.routes[current.index].state;
  }
  return name;
}

function TabBarWithLudoCheck(props: any) {
  const { isLudoGameActive } = useLudoGame();
  const { isChessGameActive } = useChessGame();
  const unreadMessageCount = useSelector((state: RootState) => state.chat.unreadMessageCount);
  const chatScreenActive = useChatScreenChrome();
  
  // Debug navigation state
  React.useEffect(() => {
    console.log('🚀 TabBarWithLudoCheck - User state:', props.user ? 'Logged in' : 'Not logged in');
    console.log('🚀 TabBarWithLudoCheck - Ludo game active:', isLudoGameActive);
  }, [props.user, isLudoGameActive]);
  
  // Hide tab bar if Ludo or Chess game is active
  if (isLudoGameActive || isChessGameActive) {
    return null;
  }
  
  const routeName = getDeepestRouteName(props.state) || getFocusedRouteNameFromRoute(props.state.routes[props.state.index]) || '';
  
  // Hide tab bar for specific screens
  if (chatScreenActive || routeName === 'SingleMessage' || routeName === 'SinglePost' || routeName === 'SingleVideo' || routeName === 'SingleWatch' || routeName === 'EditPost' || routeName === 'Camera' || routeName === 'MediaPlayer' || routeName === 'Facebook' || routeName === 'YouTube' || routeName === 'Cricbuzz' || routeName === 'GoogleMaps' || routeName === 'GoogleContacts') {
    return null;
  }
  
  const tabs = props.user ? [
    // Order to match web header: Home, Connects, Videos, Message, Downloads/Menu
    { name: 'Home', icon: 'home', label: 'Home', component: HomeStack, color: '#4CAF50', haptic: false, iconSet: 'fa5', faStyle: 'regular' },
    { name: 'Connects', icon: 'user-friends', label: 'Connects', component: ConnectsStack, color: '#2196F3', haptic: false, iconSet: 'fa5', faStyle: 'regular' },
    { name: 'Videos', icon: 'play-circle', label: 'Videos', component: VideosStack, color: '#FF9800', haptic: false, iconSet: 'fa5', faStyle: 'regular' },
    { name: 'Message', icon: 'envelope', label: 'Message', component: MessageStack, color: '#9C27B0', haptic: false, iconSet: 'fa5', faStyle: 'regular', badge: unreadMessageCount },
    { name: 'Menu', icon: 'bars', label: 'Menu', component: MenuStack, color: '#607D8B', haptic: false, iconSet: 'fa5', faStyle: 'solid' },
  ] : [
    { name: 'Login', icon: 'login', label: 'Login', component: LoginScreen, color: '#4CAF50', iconSet: 'material' },
    { name: 'Register', icon: 'person-add', label: 'Register', component: RegisterScreen, color: '#2196F3', iconSet: 'material' },
    { name: 'Menu', icon: 'bars', label: 'Menu', component: MenuStack, color: '#607D8B', haptic: false, iconSet: 'fa5', faStyle: 'solid' },
  ];
  return <ProfessionalTabBar {...props} tabs={tabs} />;
}

// Navigation container wrapper with a global top progress bar
function AppWithTopProgress() {
  const progressRef = React.useRef<TopNavigationProgressRef>(null);
  const readyRef = React.useRef(false);
  const themeContext = React.useContext(ThemeContext);

  const applyStatusBarDefaults = React.useCallback(() => {
    try {
      const isDark = themeContext?.isDarkMode;
      const bg = themeContext?.colors?.background?.primary || '#000000';
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor(bg);
      }
    } catch (e) {}
  }, [themeContext?.isDarkMode, themeContext?.colors?.background?.primary]);

  const handleMenuNavigation = (screenName: string, params?: any) => {
    try {
      (navigationRef.current as any)?.navigate(screenName, params);
    } catch (e) {
      console.warn('Navigation error', e);
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        readyRef.current = true;
        applyStatusBarDefaults();
        markNavigationReady();
      }}
      onStateChange={() => {
        if (readyRef.current) {
          progressRef.current?.trigger();
        }
        // Enforce consistent, non-translucent status bar on every navigation change
        applyStatusBarDefaults();
      }}
    >
      <View style={{ flex: 1 }}>
        <TopNavigationProgress ref={progressRef} />
        <AppContent />
        {/* <SwipeTabsOverlay navigationRef={navigationRef} />
        <FloatingButton
          onPress={() => {
            console.log('Floating button pressed directly');
          }}
          menuOptions={[
            {
              id: 'home',
              icon: 'home',
              label: 'Home',
              onPress: () => handleMenuNavigation('Home'),
              color: '#4CAF50',
            },
            {
              id: 'message',
              icon: 'message',
              label: 'Messages',
              onPress: () => handleMenuNavigation('Message'),
              color: '#2196F3',
            },
            {
              id: 'camera',
              icon: 'camera-alt',
              label: 'Camera',
              onPress: () => handleMenuNavigation('Videos'),
              color: '#FF9800',
            },
            {
              id: 'profile',
              icon: 'person',
              label: 'Profile',
              onPress: () => handleMenuNavigation('Menu', { screen: 'MyProfile' }),
              color: '#9C27B0',
            },
            {
              id: 'overlay',
              icon: 'open-in-new',
              label: 'System Overlay',
              onPress: async () => {
                try {
                  const granted = await ensureOverlayPermission();
                  if (granted) {
                    await startSystemOverlay();
                  }
                } catch (e) {
                  console.warn('Overlay error', e);
                }
              },
              color: '#FF5722',
            },
          ]}
        /> */}
      </View>
    </NavigationContainer>
  );
}
async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      console.log('✅ Location permission granted');
    } else {
      console.log('❌ Location permission denied');
    }
  } catch (err) {
    console.warn('Error requesting location permission:', err);
  }
}

// Component to handle profile data fetching
function AppContent() {

  const { connect, isConnected, emit, on, off } = useSocket();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { showMessageToast, showNotificationToast } = useUserToast();
  const { showInfo } = useToast();
  const navigation = useNavigation();
  const themeContext = React.useContext(ThemeContext);
  const [screen, setScreen] = React.useState<string>('');
  const [activeIncomingCall, setActiveIncomingCall] = React.useState<{
    callerId: string;
    channelName: string;
    isAudio: boolean;
  } | null>(null);
  // Keep latest active incoming call in a ref to avoid stale closures in event handlers
  const activeIncomingCallRef = React.useRef<{
    callerId: string;
    channelName: string;
    isAudio: boolean;
  } | null>(null);
  React.useEffect(() => {
    activeIncomingCallRef.current = activeIncomingCall;
  }, [activeIncomingCall]);
  const incomingCallTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentScreenRef = React.useRef<string>('');
  const callEndDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCallEndingRef = React.useRef<boolean>(false);
  // After a call ends or is accepted, ignore any incoming-call events briefly to avoid ghost navigations
  const ignoreIncomingCallsUntilRef = React.useRef<number>(0);
  const dispatch = useDispatch();
  const [updateModalVisible, setUpdateModalVisible] = React.useState<boolean>(false);
  const [serverVersion, setServerVersion] = React.useState<string>('');
  const [apkUrl, setApkUrl] = React.useState<string>('');
  const [isDownloadingUpdate, setIsDownloadingUpdate] = React.useState<boolean>(false);

  const getCurrentAppVersion = React.useCallback((): string => {
    try {
      // Avoid TS JSON import issues by using require
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const appPackage = require('./package.json');
      return appPackage?.version || '0.0.0';
    } catch (e) {
      return '0.0.0';
    }
  }, []);

  const compareVersions = React.useCallback((a: string, b: string): number => {
    // Normalize like 1.2.3 vs 1.2.10; ignore non-numeric suffixes
    const toNums = (v: string) => (v || '')
      .split('.')
      .map(part => parseInt(String(part).replace(/[^0-9].*$/, ''), 10) || 0);
    const aa = toNums(a);
    const bb = toNums(b);
    const len = Math.max(aa.length, bb.length);
    for (let i = 0; i < len; i++) {
      const x = aa[i] || 0;
      const y = bb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }, []);

  // Helper functions to track update modal shows per day
  const getTodayDateString = React.useCallback((): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  // Check if we can show the modal and increment count atomically
  const checkAndIncrementUpdateModalCount = React.useCallback(async (): Promise<boolean> => {
    try {
      const storageKey = 'updateModalShowCount';
      const today = getTodayDateString();
      const stored = await AsyncStorage.getItem(storageKey);
      
      let count = 0;
      if (stored) {
        const data = JSON.parse(stored);
        if (data.date === today) {
          count = data.count || 0;
        }
      }

      // Check if shown less than 2 times today
      if (count < 2) {
        // Increment and save
        await AsyncStorage.setItem(storageKey, JSON.stringify({
          date: today,
          count: count + 1
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Error checking/incrementing update modal show count:', error);
      // On error, allow showing (fail open)
      return true;
    }
  }, [getTodayDateString]);

  // Consume remote config set by index.js (/connect) and decide update prompt
  React.useEffect(() => {
    const applyConfig = async (cfg: any) => {
      if (!cfg) return;
      const serverAppVersion: string = cfg?.appVersion || '';
      const serverIsNew: boolean = Boolean(cfg?.isNewVersionAvailable);
      const serverApkUrl: string = cfg?.apkUrl || '';

      setServerVersion(serverAppVersion);
      setApkUrl(serverApkUrl);

      if (Platform.OS === 'android' && serverApkUrl) {
        const currentVersion = getCurrentAppVersion();
        const newer = serverIsNew || (serverAppVersion && compareVersions(serverAppVersion, currentVersion) > 0);
        if (newer) {
          // Check if we can show the modal (max 2 times per day) and increment count atomically
          const canShow = await checkAndIncrementUpdateModalCount();
          if (canShow) {
            setUpdateModalVisible(true);
          }
        }
      }
    };

    try {
      const initial = getRemoteConfig();
      if (initial) applyConfig(initial);
    } catch (_) {}

    const unsubscribe = subscribeRemoteConfig((cfg) => applyConfig(cfg));
    return () => {
      try { unsubscribe && unsubscribe(); } catch (_) {}
    };
  }, [compareVersions, getCurrentAppVersion, checkAndIncrementUpdateModalCount]);

  const ensureStoragePermission = React.useCallback(async (): Promise<boolean> => {
    try {
      const MediaLibrary = await import('expo-media-library/legacy');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === 'granted';
    } catch (_) {
      return false;
    }
  }, []);

  const downloadAndInstallApk = React.useCallback(async () => {
    if (!apkUrl) return;
    if (Platform.OS !== 'android') {
      try { Linking.openURL(apkUrl); } catch (_) {}
      return;
    }

    const hasPerm = await ensureStoragePermission();
    if (!hasPerm) {
      try { Linking.openURL(apkUrl); } catch (_) {}
      return;
    }

    try {
      setIsDownloadingUpdate(true);
      const safeVersion = (serverVersion || 'latest').replace(/[^0-9A-Za-z._-]/g, '');
      const fileName = `Connect-${safeVersion}-${Date.now()}.apk`;
      const destPath = `file:///tmp/Connect/${fileName}`;

      const task = FileSystem.createDownloadResumable(
        apkUrl,
        destPath,
        {},
        (downloadProgressInfo) => {
          const progress = downloadProgressInfo.totalBytesWritten / downloadProgressInfo.totalBytesExpectedToWrite;
          console.log(`Download progress: ${Math.round(progress * 100)}%`);
        }
      );
      const result = await task.downloadAsync();
      if (result && result.status === 200) {
        try {
          await Linking.openURL(`file://${destPath}`);
        } catch (e) {
          // Fallback to open the original URL (browser/DM)
          try { await Linking.openURL(apkUrl); } catch (_) {}
        }
      } else {
        try { await Linking.openURL(apkUrl); } catch (_) {}
      }
    } catch (e) {
      try { await Linking.openURL(apkUrl); } catch (_) {}
    } finally {
      setIsDownloadingUpdate(false);
    }
  }, [apkUrl, serverVersion, ensureStoragePermission]);

  React.useEffect(() => {
    ensureSpeakMessageListener();
    const initializeTts = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        console.log('Available TTS voices:', voices.length);
      } catch (error) {
        console.error('❌ Error initializing TTS systems:', error);
      }
    };
    initializeTts();
  }, []);

  React.useEffect(() => {
    // Use navigation state to get current route
    const unsubscribe = navigation.addListener('state', () => {
      const currentRoute = navigation.getState()?.routes[navigation.getState()?.index || 0];
      const screenName = currentRoute?.name || '';
      console.log('🧭 Navigation state changed to:', screenName);
      setScreen(screenName);
      currentScreenRef.current = screenName;
    });
    
    return unsubscribe;
  }, [navigation]);

  // Stop background service when app is closed/terminated
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        // App is going to background - keep service running for notifications
        console.log('📱 App moved to background, keeping service running');
      } else if (nextAppState === 'active') {
        // App is active - service can continue running
        console.log('📱 App is active');
      }
    });

    // Cleanup: Stop background service when component unmounts (app is closed)
    return () => {
      subscription.remove();
      console.log('🛑 App closing, stopping background service...');
      // Background services removed for Expo compatibility
    };
  }, []);

  // Note: Notification events are now handled by the NotificationSetup component
  // to avoid duplicate listeners

  // Connect to socket when profile id becomes available; avoid depending on isConnected to prevent loops
  React.useEffect(() => {
    if (!myProfile?._id) {
      console.log('⏸️ Socket connection skipped: profile ID not available');
      return;
    }
    console.log('🔌 Attempting socket connection with profile ID:', myProfile._id);
    connect(myProfile._id)
      .then(() => {
        console.log('✅ Socket connected successfully in AppContent');
      })
      .catch((error) => {
        console.error('❌ Failed to connect socket in AppContent:', error);
        console.error('❌ Error details:', {
          message: error?.message,
          stack: error?.stack,
          profileId: myProfile._id
        });
        // Don't show alert immediately - socket will retry automatically
        // Alert.alert('Connection Error', 'Failed to connect to real-time service. The app will retry automatically.');
      });
  }, [myProfile?._id, connect]);

  // Fetch initial notifications
  React.useEffect(() => {
    if (myProfile?._id) {
      // emit('fetchNotifications', myProfile._id);
      api.get('/notification/').then((res) => {
        dispatch(addNotifications(res.data))
        console.log('notifications', res.data)
      })
    }
  }, [myProfile?._id, emit]);

  React.useEffect(() => {

    if (!isConnected) return;

    let handleBumpUser = (data: any) => {
      showMessageToast({
        userProfilePic: data.myProfileData.profilePic,
        fullName: data.myProfileData.fullName,
        message: `${data.myProfileData.fullName} bumped you`,
        onPress: () => {
          (navigation as any).navigate('Message', { 
            screen: 'SingleMessage',
            params: { connect: data.friendProfileData }
          })
        },
      })
    }

    on('bumpUser', handleBumpUser)

    // Incoming/outgoing audio and video calls are handled by the global
    // AudioCall and VideoCall overlays (same socket events as the web app).

    // Global online/offline presence listeners
    const handleConnectOnline = (data: any) => {
      const connectProfileId = data?.profileId || data?.id || data;
      if (connectProfileId) {
        dispatch(setConnectOnline(String(connectProfileId)));
      }
    };
    const handleConnectOffline = (data: any) => {
      const connectProfileId = data?.profileId || data?.id || data;
      if (connectProfileId) {
        dispatch(setConnectOffline(String(connectProfileId)));
      }
    };
    const handleIsActive = (isUserActive: boolean, lastLogin: Date, activeProfileId: string) => {
      if (!activeProfileId) return;
      if (isUserActive === true) {
        dispatch(setConnectOnline(String(activeProfileId)));
      } else {
        dispatch(setConnectOffline(String(activeProfileId)));
      }
      try {
        const iso = lastLogin ? new Date(lastLogin as any).toISOString() : undefined;
        dispatch(setConnectLastSeen({ profileId: String(activeProfileId), lastLogin: iso }));
      } catch (_) {}
    };
    on('friend_online', handleConnectOnline);
    on('friend_offline', handleConnectOffline);
    on('is_active', handleIsActive);

    // Handle connect location updates
    const handleConnectLocationUpdate = (data: any) => {
      const { profileId: connectProfileId, location } = data;
      if (connectProfileId && location) {
        console.log('📍 Connect location update received:', connectProfileId, location);
        // You can dispatch this to Redux or handle it as needed
        // For example, update connect location in Redux store
        // dispatch(updateConnectLocation({ profileId: connectProfileId, location }));
      }
    };
    on('friend_location_update', handleConnectLocationUpdate);

    const handleConnectCacheUpdate = async (data: any) => {
      if (!myProfile?._id || String(data?.profileId) !== String(myProfile._id)) return;
      const list = data?.list === 'requests' || data?.list === 'suggestions' ? data.list : null;
      if (!list) return;
      if (data.action === 'remove' && data.targetProfileId) {
        await ConnectCacheManager.removeProfile(myProfile._id, list, data.targetProfileId);
        return;
      }
      if (data.action === 'refresh') {
        const response = list === 'requests'
          ? await connectAPI.getConnectRequest(myProfile._id)
          : await connectAPI.getConnectSuggestions(myProfile._id);
        await ConnectCacheManager.setCached(myProfile._id, list, response.data);
      }
    };
    on('friendCacheUpdate', handleConnectCacheUpdate);

    let handleNewMessage = (data: any, allowToast = false) => {
      let {updatedMessage, senderName, senderPP, friendProfile} = data || {};
      updatedMessage = updatedMessage || data;
      if (!updatedMessage) return;

      try {
        const myId = String(myProfile?._id || '');
        const senderId = String(updatedMessage.senderId || friendProfile?._id || '');
        const receiverId = String(updatedMessage.receiverId || '');
        const chatId = senderId && senderId === myId ? receiverId : senderId;
        if (myId && chatId) {
          dispatch(addNewMessage({
            chatId,
            message: {
              _id: updatedMessage._id || String(Date.now()),
              room: updatedMessage.room || `${myId}_${chatId}`,
              senderId: updatedMessage.senderId || senderId,
              receiverId: updatedMessage.receiverId || receiverId || myId,
              message: updatedMessage.message || '',
              attachment: updatedMessage.attachment || false,
              reacts: updatedMessage.reacts || [],
              isSeen: Boolean(updatedMessage.isSeen),
              timestamp: updatedMessage.timestamp || new Date().toISOString(),
              __v: 0,
              messageType: updatedMessage.messageType,
              callType: updatedMessage.callType,
              callEvent: updatedMessage.callEvent,
            },
            currentUserId: myId,
          }));
        }
      } catch (_) { }

      const isOwn = String(updatedMessage?.senderId) === String(myProfile?._id);
      if (!allowToast || isOwn) return;

      if (currentScreenRef.current === 'MessageList' || currentScreenRef.current === 'SingleMessage') {
        return;
      }

      const preview = updatedMessage?.messageType === 'call'
        ? (updatedMessage.message || 'Call')
        : `${(updatedMessage?.message || '').substring(0, 40)}${(updatedMessage?.message || '').length > 40 ? '...' : ''}`;

      showMessageToast({
        userProfilePic: senderPP,
        fullName:  `${senderName || 'Someone'} messaged you`,
        message: preview,
        onPress: () => {
          (navigation as any).navigate('Message', { 
            screen: 'SingleMessage',
            params: { connect: friendProfile }
          })
        },
      })
    }

    const handleRoomMessage = (data: any) => handleNewMessage(data, false);
    const handleUserMessage = (data: any) => handleNewMessage(data, true);
    on('newMessage', handleRoomMessage);
    on('newMessageToUser', handleUserMessage);

    // Show toast on new notification
    let handleNewNotification = (notification: any) => {
      // Notifications are general; always show via notification-themed toast
      try {
        showNotificationToast({
          userProfilePic: notification.icon,
          fullName: notification.title || 'Notification',
          message: notification.text || 'You have a new notification',
          onPress: () => {
            // Navigate if a link implies a messages route
            if (notification.link) {
              // Best-effort: route by known segments
              const link: string = notification.link as string;
              if (link.includes('message')) {
                (navigation as any).navigate('Message');
              } else if (link.includes('profile')) {
                (navigation as any).navigate('Menu', { screen: 'MyProfile' });
              } else if (link.includes('connects')) {
                (navigation as any).navigate('Connects');
              } else {
                (navigation as any).navigate('Home');
              }
            }
          }
        });
      } catch (e) {
        // Fallback to basic toast if user toast is unavailable
        showInfo(notification.text || 'New notification');
      }
    }

    on('newNotification', handleNewNotification)

    return () => {
      off('bumpUser',handleBumpUser)
      off('newMessage', handleRoomMessage)
      off('newMessageToUser', handleUserMessage)
      off('newNotification', handleNewNotification)
      off('friend_online', handleConnectOnline)
      off('friend_offline', handleConnectOffline)
      off('is_active', handleIsActive)
      off('friend_location_update', handleConnectLocationUpdate)
      off('friendCacheUpdate', handleConnectCacheUpdate)
    }
  }, [isConnected, on, off, myProfile?._id])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
      if (callEndDebounceRef.current) {
        clearTimeout(callEndDebounceRef.current);
        callEndDebounceRef.current = null;
      }
    };
  }, []);

  const isDarkMode = useColorScheme() === 'dark';

  return (
    <AuthContext.Consumer>
      {(ctx: any) => {
        if (!ctx) {
          return null;
        }
        const { user, isInitializing } = ctx;
        return (
          <>
            <AppContentInner user={user} isInitializing={isInitializing} isDarkMode={isDarkMode} />
            {/* Initialize notifications */}
            <ExpoGoSafeNotificationSetup />
            {/* Request required permissions on app start */}
            <PermissionsInitializer user={user} />
            {myProfile?._id ? (
              <>
                <VideoCall myId={myProfile._id} />
                <AudioCall myId={myProfile._id} />
                <LiveVoice myId={myProfile._id} />
              </>
            ) : null}
            {/* Global update modal */}
            <UpdateModal
              visible={updateModalVisible}
              serverVersion={serverVersion}
              apkUrl={apkUrl}
              onDismiss={() => setUpdateModalVisible(false)}
              onDownload={downloadAndInstallApk}
            />
          </>
        );
      }}
    </AuthContext.Consumer>
  );
}

// Inner component that can use hooks
function AppContentInner({ user, isInitializing, isDarkMode }: { user: any, isInitializing: boolean, isDarkMode: boolean }) {
  const [aiAgentVisible, setAiAgentVisible] = React.useState(false);
  const [pendingAiVoiceLanguage, setPendingAiVoiceLanguage] = React.useState<AgentSpeechLanguage | null>(null);
  const [aiVoiceStartRequest, setAiVoiceStartRequest] = React.useState(0);
  const previousUserRef = React.useRef(user);

  React.useEffect(() => {
    if (!user || isInitializing) return undefined;

    Accelerometer.setUpdateInterval(100);
    let previous = { x: 0, y: 0, z: 0 };
    let lastShakeAt = 0;
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const delta = Math.sqrt(
        (x - previous.x) ** 2 +
        (y - previous.y) ** 2 +
        (z - previous.z) ** 2,
      );
      previous = { x, y, z };

      const now = Date.now();
      if (delta < 2.2 || now - lastShakeAt < 1500) return;
      lastShakeAt = now;
      setPendingAiVoiceLanguage('auto');
      setAiVoiceStartRequest(request => request + 1);
      setAiAgentVisible(true);
    });

    return () => subscription.remove();
  }, [isInitializing, user]);

  // Debug user state changes
  React.useEffect(() => {
    console.log('🔄 AppContentInner - User state changed:', user ? 'User logged in' : 'No user');
    console.log('🔄 AppContentInner - Initialization state:', isInitializing);
    console.log('🔄 AppContentInner - Will render:', isInitializing ? 'LoadingScreen' : 'Main App');
  }, [user, isInitializing]);

  React.useEffect(() => {
    const wasAuthenticated = Boolean(previousUserRef.current);
    previousUserRef.current = user;

    if (wasAuthenticated && !user) {
      // Wait for the unauthenticated navigator to mount before resetting to Login.
      const resetTimeout = setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      }, 0);

      return () => clearTimeout(resetTimeout);
    }
  }, [user]);

  // Always call hooks unconditionally; the hook internally no-ops without a valid id
  useProfileData(user?.profile || null);

  const deepestRoute = useNavigationState((state) => (state ? getDeepestRouteName(state) : ''));
  const isAuthScreen = deepestRoute === 'Login' || deepestRoute === 'Register';
  const chatScreenActive = useChatScreenChrome();
  const isChatThread = deepestRoute === 'SingleMessage' || chatScreenActive;
  const isMessageInbox = deepestRoute === 'MessageList';
  const isChatPage = isChatThread || isMessageInbox;
  // Never pad the app shell at the bottom — the tab bar and chat composer
  // handle that themselves. Inbox keeps top inset for the status bar only.
  const appSafeAreaEdges = isAuthScreen
    ? []
    : isChatThread
    ? []
    : isMessageInbox
      ? (Platform.OS === 'ios' ? (['top'] as const) : [])
      : (Platform.OS === 'ios' ? (['top', 'right', 'left'] as const) : []);

  return (
    <ThemeContext.Consumer>
      {(themeContext) => {
        if (!themeContext) return null;
        const { colors: themeColors, isDarkMode: themeIsDarkMode } = themeContext;
        return (
        <>
        <SafeAreaView
          edges={appSafeAreaEdges}
          style={{
            flex: 1,
            backgroundColor: themeIsDarkMode ? themeColors.background.primary : themeColors.background.primary
          }}
        >
            <StatusBar 
              barStyle={themeIsDarkMode ? 'light-content' : 'dark-content'}
              backgroundColor={isAuthScreen ? 'transparent' : themeColors.background.primary}
              translucent={isAuthScreen}
            />
            {isInitializing ? (
              <LoadingScreen message="Initializing app..." />
            ) : (
              <Tab.Navigator
                key={user ? 'authenticated' : 'anonymous'}
                initialRouteName={user ? 'Home' : 'Login'}
                tabBar={(props) => <TabBarWithLudoCheck {...props} user={user} />}
                safeAreaInsets={isChatPage ? { top: 0, right: 0, bottom: 0, left: 0 } : undefined}
                screenOptions={({ route }) => ({
                  tabBarStyle:
                    route.name === 'Login' || route.name === 'Register'
                      ? { display: 'none', height: 0 }
                      : undefined,
                  headerShown: route.name === 'Home' || route.name === 'Connects' || route.name === 'Videos',
                  header: route.name === 'Home' || route.name === 'Connects' || route.name === 'Videos'
                    ? () => (
                      <FacebookHeader
                        onOpenAIAgent={() => {
                          setPendingAiVoiceLanguage(null);
                          setAiAgentVisible(true);
                        }}
                        onLongPressAIAgent={() => {
                          setPendingAiVoiceLanguage('auto');
                          setAiVoiceStartRequest(request => request + 1);
                          setAiAgentVisible(true);
                        }}
                      />
                    )
                    : undefined,
                })}
              >
                {user ? (
                  <>
                    <Tab.Screen
                      name="Home"
                      component={HomeStack}
                      options={{
                        tabBarLabel: 'Home',
                      }}
                    />
                    <Tab.Screen
                      name="Connects"
                      component={ConnectsStack}
                      options={{
                        tabBarLabel: 'Connects',
                        headerShown: true,
                      }}
                    />
                    <Tab.Screen
                      name="Videos"
                      component={VideosStack}
                      options={{
                        tabBarLabel: 'Videos',
                        headerShown: true,
                      }}
                    />
                    <Tab.Screen
                      name="Message"
                      component={MessageStack}
                      options={({ route }) => {
                        const nested = getFocusedRouteNameFromRoute(route) ?? 'MessageList';
                        const hideTab = nested === 'SingleMessage' || (route.params as any)?.screen === 'SingleMessage';
                        return {
                          tabBarLabel: 'Message',
                          headerShown: false,
                          tabBarStyle: hideTab
                            ? { display: 'none', height: 0, position: 'absolute' }
                            : { position: 'absolute' },
                          safeAreaInsets: hideTab
                            ? { bottom: 0, top: 0, left: 0, right: 0 }
                            : { bottom: 0, left: 0, right: 0 },
                        };
                      }}
                    />

                    <Tab.Screen
                      name="Menu"
                      component={MenuStack}
                      options={({ route }) => {
                        const nested = getFocusedRouteNameFromRoute(route) ?? 'MenuHome';
                        const showHeader = nested === 'Settings';

                        return {
                          tabBarLabel: 'Menu',
                          headerShown: showHeader,
                          header: showHeader
                            ? () => (
                              <FacebookHeader
                                onOpenAIAgent={() => {
                                  setPendingAiVoiceLanguage(null);
                                  setAiAgentVisible(true);
                                }}
                                onLongPressAIAgent={() => {
                                  setPendingAiVoiceLanguage('auto');
                                  setAiVoiceStartRequest(request => request + 1);
                                  setAiAgentVisible(true);
                                }}
                              />
                            )
                            : undefined,
                        };
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Tab.Screen
                      name="Login"
                      component={LoginScreen}
                      options={{
                        tabBarLabel: 'Login',
                      }}
                    />
                    <Tab.Screen
                      name="Register"
                      component={RegisterScreen}
                      options={{
                        tabBarLabel: 'Register',
                      }}
                    />
                    <Tab.Screen
                      name="Menu"
                      component={MenuStack}
                      options={{
                        tabBarLabel: 'Menu',
                        headerShown: false,
                      }}
                    />
                  </>
                )}
              </Tab.Navigator>
            )}
            <WatchPipPlayer />
        </SafeAreaView>
        <MinimizedCallBar />
        <AIAgentModal
          visible={aiAgentVisible}
          autoStartVoiceLanguage={pendingAiVoiceLanguage}
          voiceStartRequest={aiVoiceStartRequest}
          onClose={() => {
            setAiAgentVisible(false);
            setPendingAiVoiceLanguage(null);
          }}
        />
        </>
        );
      }}
    </ThemeContext.Consumer>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark' || true;

  // Ensure Firebase is initialized when App component mounts
  React.useEffect(() => {
    try {
      // Firebase removed for Expo compatibility
      console.log('✅ Firebase disabled for Expo compatibility');
    } catch (error) {
      console.error('❌ Firebase not initialized in App component:', error);
      // Firebase should auto-initialize from google-services.json on Android
      // If it's not initialized, there might be a configuration issue
    }
  }, []);

  // Request location permission on app initialization
  React.useEffect(() => {
    requestLocationPermission();
  }, []);

  // Send HTTP request to yt-dl service on app start
  React.useEffect(() => {
    fetch('https://yt-dl-tyyw.onrender.com')
      .catch(() => {
        // Silently fail - fire and forget
      });
    fetch('https://emotion-detection-z1b2.onrender.com/')
      .catch(() => {
        // Silently fail - fire and forget
      });
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
        <Provider store={store}>
          <PaperProvider>
            <ThemeProvider>
              <FeatureFlagProvider>
                <AuthProvider>
                <SocketProvider>
                  <CallMinimizeProvider>
                    <ToastProvider>
                      <UserToastProvider>
                        <ModernToastProvider>
                          <SettingsProvider>
                            <LudoGameProvider>
                              <ChessGameProvider>
                                <HeaderVisibilityProvider>
                                  <WatchPipProvider>
                                    <AppWithTopProgress />
                                  </WatchPipProvider>
                                </HeaderVisibilityProvider>
                              </ChessGameProvider>
                            </LudoGameProvider>
                          </SettingsProvider>
                        </ModernToastProvider>
                      </UserToastProvider>
                    </ToastProvider>
                  </CallMinimizeProvider>
                </SocketProvider>
                </AuthProvider>
              </FeatureFlagProvider>
            </ThemeProvider>
          </PaperProvider>
        </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default App;
