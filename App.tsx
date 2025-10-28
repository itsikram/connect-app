/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { NavigationContainer, useNavigation, useRoute, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { navigationRef, markNavigationReady } from './src/lib/navigationService';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, useColorScheme, SafeAreaView, ActivityIndicator, View, Alert, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProfessionalTabBar from './src/components/ProfessionalTabBar';
import { colors } from './src/theme/colors';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import { ThemeProvider, ThemeContext } from './src/contexts/ThemeContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import Home from './src/screens/Home';
import Message from './src/screens/Message';
import Menu from './src/screens/Menu';
import Settings from './src/screens/Settings';
import MyProfile from './src/screens/MyProfile';
import Friends from './src/screens/Friends';
// Redux Provider and store
import { Provider, useSelector, useDispatch } from 'react-redux';
import store, { RootState } from './src/store';
// Profile data hook
import { useProfileData } from './src/hooks/useProfileData';
import SingleMessage from './src/screens/SingleMessage';
import FriendProfile from './src/screens/FriendProfile';
import Videos from './src/screens/Videos';
import SinglePost from './src/screens/SinglePost';
import SingleVideo from './src/screens/SingleVideo';
import EditPost from './src/screens/EditPost';
import IncomingCall from './src/screens/IncomingCall';
import OutgoingCall from './src/screens/OutgoingCall';
import VideoCall from './src/components/VideoCall';
import AudioCall from './src/components/AudioCall';
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
import { HeaderVisibilityProvider } from './src/contexts/HeaderVisibilityContext';
import { CallMinimizeProvider } from './src/contexts/CallMinimizeContext';
import MinimizedCallBar from './src/components/MinimizedCallBar';
import TopNavigationProgress, { TopNavigationProgressRef } from './src/components/TopNavigationProgress';
import SwipeTabsOverlay from './src/components/SwipeTabsOverlay';
import NotificationSetup from './src/components/NotificationSetup';
import PermissionsInitializer from './src/components/PermissionsInitializer';
import GlobalExpressionDetection from './src/components/GlobalExpressionDetection';

import Tts from 'react-native-tts';
import { addNotifications } from './src/reducers/notificationReducer';
import { addNewMessage } from './src/reducers/chatReducer';
import api, { userAPI } from './src/lib/api';
import FloatingButton from './src/components/FloatingButton';
import { ensureOverlayPermission, startSystemOverlay } from './src/lib/overlay';
import { backgroundTtsService } from './src/lib/backgroundTtsService';
import { backgroundServiceManager } from './src/lib/backgroundServiceManager';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigator for Message tab
function MessageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessageList" component={Message} />
      <Stack.Screen name="SingleMessage" component={SingleMessage} />
      <Stack.Screen name="FriendProfile" component={FriendProfile} />
      <Stack.Screen name="IncomingCall" component={IncomingCall} />
      <Stack.Screen name="OutgoingCall" component={OutgoingCall} />
    </Stack.Navigator>
  );
}

// Stack navigator for Home tab
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={Home} />
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="EditPost" component={EditPost} />
      <Stack.Screen name="FriendProfile" component={FriendProfile} />
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
      <Stack.Screen name="SingleVideo" component={SingleVideo} />
    </Stack.Navigator>
  );
}

// Stack navigator for Friends tab
function FriendsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FriendsMain" component={Friends} />
      <Stack.Screen name="FriendProfile" component={FriendProfile} />
    </Stack.Navigator>
  );
}

function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuHome" component={Menu} />
      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="EmotionFaceMesh" component={require('./src/screens/EmotionFaceMeshDemo').default} />
      <Stack.Screen name="MediaPlayer" component={require('./src/screens/MediaPlayer').default} />
    </Stack.Navigator>
  );
}

// Tab bar component that checks for Ludo game state
function TabBarWithLudoCheck(props: any) {
  const { isLudoGameActive } = useLudoGame();
  const { isChessGameActive } = useChessGame();
  const unreadMessageCount = useSelector((state: RootState) => state.chat.unreadMessageCount);
  
  // Debug navigation state
  React.useEffect(() => {
    console.log('🚀 TabBarWithLudoCheck - User state:', props.user ? 'Logged in' : 'Not logged in');
    console.log('🚀 TabBarWithLudoCheck - Ludo game active:', isLudoGameActive);
  }, [props.user, isLudoGameActive]);
  
  // Hide tab bar if Ludo or Chess game is active
  if (isLudoGameActive || isChessGameActive) {
    return null;
  }
  
  // Get the current route name to check if we're on screens that should hide tab bar
  const routeName = getFocusedRouteNameFromRoute(props.state.routes[props.state.index]) ?? '';
  
  // Hide tab bar for specific screens
  if (routeName === 'SingleMessage' || routeName === 'SinglePost' || routeName === 'SingleVideo' || routeName === 'EditPost' || routeName === 'Camera' || routeName === 'MediaPlayer') {
    return null;
  }
  
  const tabs = props.user ? [
    // Order to match web header: Home, Friends, Videos, Message, Downloads/Menu
    { name: 'Home', icon: 'home', label: 'Home', component: HomeStack, color: '#4CAF50', haptic: true, iconSet: 'fa5', faStyle: 'regular' },
    { name: 'Friends', icon: 'user-friends', label: 'Friends', component: FriendsStack, color: '#2196F3', haptic: true, iconSet: 'fa5', faStyle: 'regular' },
    { name: 'Videos', icon: 'play-circle', label: 'Videos', component: VideosStack, color: '#FF9800', haptic: true, iconSet: 'fa5', faStyle: 'regular' },
    { name: 'Message', icon: 'envelope', label: 'Message', component: MessageStack, color: '#9C27B0', haptic: true, iconSet: 'fa5', faStyle: 'regular', badge: unreadMessageCount },
    { name: 'Menu', icon: 'bars', label: 'Menu', component: MenuStack, color: '#607D8B', haptic: true, iconSet: 'fa5', faStyle: 'solid' },
  ] : [
    { name: 'Login', icon: 'login', label: 'Login', component: LoginScreen, color: '#4CAF50' },
    { name: 'Register', icon: 'person-add', label: 'Register', component: RegisterScreen, color: '#2196F3' },
    { name: 'Menu', icon: 'bars', label: 'Menu', component: MenuStack, color: '#607D8B', haptic: true, iconSet: 'fa5', faStyle: 'solid' },
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

  React.useEffect(() => {
    // Initialize both TTS systems
    const initializeTts = async () => {
      try {
        // Initialize main TTS
        Tts.setDefaultLanguage('en-US');
        Tts.setDefaultRate(0.5); // speed: 0.1 - 1.0
        Tts.voices().then(voices => console.log('Available TTS voices:', voices.length));
        
        // Initialize background TTS service
        await backgroundTtsService.initialize();
        
        // Initialize background service manager
        await backgroundServiceManager.initialize();
        
        console.log('✅ TTS systems and background services initialized successfully');
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

  // Note: Notification events are now handled by the NotificationSetup component
  // to avoid duplicate listeners

  // Connect to socket when profile id becomes available; avoid depending on isConnected to prevent loops
  React.useEffect(() => {
    if (!myProfile?._id) return;
    console.log('myProfile for socket', myProfile?._id);
    connect(myProfile._id)
      .then(() => {
        console.log('Socket connected successfully in SingleMessage component');
      })
      .catch((error) => {
        console.error('Failed to connect socket in SingleMessage component:', error);
        Alert.alert('Connection Error', 'Failed to connect to real-time service');
      });
  }, [myProfile?._id]);

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
            params: { friend: data.friendProfileData }
          })
        },
      })
    }

    on('bumpUser', handleBumpUser)

    // Navigate to IncomingCall screen on incoming video/audio call events
    const handleIncomingVideo = ({ from, channelName, callerName, callerProfilePic }: any) => {
      // Global guards to prevent ghost/duplicate navigations
      if (isCallEndingRef.current) {
        console.log('🚫 Ignoring incoming video call - call ending in progress');
        return;
      }
      if (Date.now() < ignoreIncomingCallsUntilRef.current) {
        console.log('🚫 Ignoring incoming video call - within cooldown window');
        return;
      }
      // If there's already an active incoming call, clear it first
      if (activeIncomingCallRef.current) {
        console.log('🔄 Clearing previous incoming call to show new video call:', activeIncomingCallRef.current);
        // Clear the existing timeout
        if (incomingCallTimeoutRef.current) {
          clearTimeout(incomingCallTimeoutRef.current);
          incomingCallTimeoutRef.current = null;
        }
        // Clear the active call state
        setActiveIncomingCall(null);
      }
      
      console.log('📞 New incoming video call from:', from);
      setActiveIncomingCall({ callerId: from, channelName, isAudio: false });
      
      // Set a timeout to automatically clear the active call state after 30 seconds
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
      }
      incomingCallTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Incoming call timeout - clearing active call state');
        setActiveIncomingCall(null);
      }, 30000); // 30 seconds timeout
      
      (navigation as any).navigate('Message', {
        screen: 'IncomingCall',
        params: {
        callerId: from,
        callerName: callerName || 'Unknown',
        callerProfilePic: callerProfilePic,
        channelName,
        isAudio: false,
        prevScreenId: currentScreenRef.current,
        }
      });
    };
    const handleIncomingAudio = ({ from, channelName, callerName, callerProfilePic }: any) => {
      // Global guards to prevent ghost/duplicate navigations
      if (isCallEndingRef.current) {
        console.log('🚫 Ignoring incoming audio call - call ending in progress');
        return;
      }
      if (Date.now() < ignoreIncomingCallsUntilRef.current) {
        console.log('🚫 Ignoring incoming audio call - within cooldown window');
        return;
      }
      // If there's already an active incoming call, clear it first
      if (activeIncomingCallRef.current) {
        console.log('🔄 Clearing previous incoming call to show new audio call:', activeIncomingCallRef.current);
        // Clear the existing timeout
        if (incomingCallTimeoutRef.current) {
          clearTimeout(incomingCallTimeoutRef.current);
          incomingCallTimeoutRef.current = null;
        }
        // Clear the active call state
        setActiveIncomingCall(null);
      }
      
      console.log('📞 New incoming audio call from:', from);
      setActiveIncomingCall({ callerId: from, channelName, isAudio: true });
      
      // Set a timeout to automatically clear the active call state after 30 seconds
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
      }
      incomingCallTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Incoming call timeout - clearing active call state');
        setActiveIncomingCall(null);
      }, 30000); // 30 seconds timeout
      
      (navigation as any).navigate('Message', {
        screen: 'IncomingCall',
        params: {
        callerId: from,
        callerName: callerName || 'Unknown',
        callerProfilePic: callerProfilePic,
        channelName,
        isAudio: true,
        prevScreenId: currentScreenRef.current,
        }
      });
    };

    // Handle call end events to clear active incoming call state
    const handleCallEnd = () => {
      // Prevent multiple calls to the same cleanup
      if (isCallEndingRef.current) {
        console.log('📞 Call end already in progress, ignoring duplicate event');
        return;
      }

      // Clear any existing debounce timeout
      if (callEndDebounceRef.current) {
        clearTimeout(callEndDebounceRef.current);
      }

      // Debounce the call end handling
      callEndDebounceRef.current = setTimeout(() => {
        console.log('📞 Call ended, clearing active incoming call state');
        isCallEndingRef.current = true;
        setActiveIncomingCall(null);
        
        // Clear timeout if it exists
        if (incomingCallTimeoutRef.current) {
          clearTimeout(incomingCallTimeoutRef.current);
          incomingCallTimeoutRef.current = null;
        }

        // Enforce non-translucent status bar after any call end to avoid overlay on header
        try {
          const bg = themeContext?.colors?.background?.primary || '#000000';
          const isDark = themeContext?.isDarkMode;
          if (Platform.OS === 'android') {
            StatusBar.setTranslucent(false);
            StatusBar.setBackgroundColor(bg);
          }
          StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
        } catch (e) {}

        // Start a short cooldown to ignore any late/duplicate incoming-call events
        ignoreIncomingCallsUntilRef.current = Date.now() + 4000; // 4s cooldown

        // Reset the flag after a longer delay to prevent rapid re-triggering
        setTimeout(() => {
          isCallEndingRef.current = false;
        }, 3000); // 3 seconds delay
      }, 500); // 500ms debounce - increased from 100ms
    };

    // Handle audio call end events
    const handleAudioCallEnd = (friendId: string) => {
      console.log('📞 Audio call ended from friend:', friendId);
      handleCallEnd();
    };

    // Handle video call end events  
    const handleVideoCallEnd = (friendId: string) => {
      console.log('📞 Video call ended from friend:', friendId);
      handleCallEnd();
    };

    const handleCallAccepted = () => {
      console.log('📞 Call accepted, clearing active incoming call state');
      setActiveIncomingCall(null);
      // Clear timeout if it exists
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
      // Briefly ignore any stray incoming-call events that might race the accept action
      ignoreIncomingCallsUntilRef.current = Date.now() + 2000; // 2s cooldown
    };

    on('incoming-video-call', handleIncomingVideo);
    on('incoming-audio-call', handleIncomingAudio);
    on('call-accepted', handleCallAccepted);
    
    // Listen to call end events to clear active incoming call state
    on('audio-call-ended', handleAudioCallEnd);
    on('video-call-ended', handleVideoCallEnd);

    let handleNewMessage = (data: any) => {
      let {updatedMessage, senderName, senderPP, chatPage, friendProfile} = data;

      if(currentScreenRef.current === 'MessageList' || currentScreenRef.current === 'SingleMessage'){
        return;
      }

      showMessageToast({
        userProfilePic: senderPP,
        fullName:  `${senderName} messaged you`,
        message: `${updatedMessage.message.substring(0, 40)}...`,
        onPress: () => {
          (navigation as any).navigate('Message', { 
            screen: 'SingleMessage',
            params: { friend: friendProfile }
          })
        },
      })

      // Update Redux chat state for unread badge
      try {
        if (myProfile?._id && friendProfile?._id && updatedMessage) {
          dispatch(addNewMessage({
            chatId: friendProfile._id,
            message: {
              _id: updatedMessage._id || String(Date.now()),
              room: updatedMessage.room || `${myProfile._id}_${friendProfile._id}`,
              senderId: updatedMessage.senderId || friendProfile._id,
              receiverId: updatedMessage.receiverId || myProfile._id,
              message: updatedMessage.message || '',
              attachment: updatedMessage.attachment || false,
              reacts: updatedMessage.reacts || [],
              isSeen: Boolean(updatedMessage.isSeen),
              timestamp: updatedMessage.timestamp || new Date().toISOString(),
              __v: 0,
            },
            currentUserId: myProfile._id,
          }));
        }
      } catch (_) { }
    }

    on('newMessageToUser', handleNewMessage)

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
              } else if (link.includes('friends')) {
                (navigation as any).navigate('Friends');
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

    let handleSpeakMessage = (message: any) => {
      // Use background TTS service for better reliability
      backgroundTtsService.speakMessage(message, { priority: 'normal', interrupt: false });
      console.log('🎤 Speaking message via background TTS service:', message)
    }

    on('newNotification', handleNewNotification)

    on('speak_message', handleSpeakMessage)

    return () => {
      off('bumpUser',handleBumpUser)
      off('newMessageToUser',handleNewMessage)
      off('newNotification', handleNewNotification)
      off('speak_message', handleSpeakMessage)
      off('incoming-video-call', handleIncomingVideo)
      off('incoming-audio-call', handleIncomingAudio)
      off('call-accepted', handleCallAccepted)
      off('audio-call-ended', handleAudioCallEnd)
      off('video-call-ended', handleVideoCallEnd)
    }
  }, [isConnected,on,off])

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
        const { user, isLoading } = ctx;
        return (
          <>
            <AppContentInner user={user} isLoading={isLoading} isDarkMode={isDarkMode} />
            {/* Initialize notifications */}
            <NotificationSetup />
            {/* Request required permissions on app start */}
            <PermissionsInitializer user={user} />
            {/* Global expression detection (MediaPipe-based) */}
            <GlobalExpressionDetection />
            {/* Global call components - rendered everywhere */}
            {myProfile?._id && (
              <>
                <VideoCall myId={myProfile._id} />
                <AudioCall myId={myProfile._id} />
              </>
            )}
          </>
        );
      }}
    </AuthContext.Consumer>
  );
}

// Inner component that can use hooks
function AppContentInner({ user, isLoading, isDarkMode }: { user: any, isLoading: boolean, isDarkMode: boolean }) {
  // Debug user state changes
  React.useEffect(() => {
    console.log('🔄 AppContentInner - User state changed:', user ? 'User logged in' : 'No user');
    console.log('🔄 AppContentInner - Loading state:', isLoading);
    console.log('🔄 AppContentInner - Will render:', isLoading ? 'LoadingScreen' : 'Main App');
  }, [user, isLoading]);

  // Always call hooks unconditionally; the hook internally no-ops without a valid id
  useProfileData(user?.profile || null);

  return (
    <ThemeContext.Consumer>
      {(themeContext) => {
        if (!themeContext) return null;
        const { colors: themeColors, isDarkMode: themeIsDarkMode } = themeContext;
        return (
        <SafeAreaView style={{
          flex: 1,
          backgroundColor: themeIsDarkMode ? themeColors.background.primary : themeColors.background.primary
        }}>
            <StatusBar 
              barStyle={themeIsDarkMode ? 'light-content' : 'dark-content'}
              backgroundColor={themeColors.background.primary}
              translucent={false}
            />
            {isLoading ? (
              <LoadingScreen message="Initializing app..." />
            ) : (
              <Tab.Navigator
                initialRouteName={user ? 'Home' : 'Login'}
                tabBar={(props) => <TabBarWithLudoCheck {...props} user={user} />}
                screenOptions={({ route }) => ({
                  headerShown: route.name === 'Home',
                  header: route.name === 'Home' ? () => <FacebookHeader /> : undefined,
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
                      name="Videos"
                      component={VideosStack}
                      options={{
                        tabBarLabel: 'Videos',
                        headerShown: false,
                      }}
                    />
                    <Tab.Screen
                      name="Friends"
                      component={FriendsStack}
                      options={{
                        tabBarLabel: 'Friends',
                        headerShown: false,
                      }}
                    />
                    <Tab.Screen
                      name="Message"
                      component={MessageStack}
                      options={({ route }) => ({
                        tabBarLabel: 'Message',
                        headerShown: false,
                      })}
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
            <MinimizedCallBar />
        </SafeAreaView>
        );
      }}
    </ThemeContext.Consumer>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark' || true;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <PaperProvider>
            <ThemeProvider>
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
                                  <AppWithTopProgress />
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
            </ThemeProvider>
          </PaperProvider>
        </Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default App;
