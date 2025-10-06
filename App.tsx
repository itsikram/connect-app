/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { NavigationContainer, useNavigation, useRoute, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, useColorScheme, SafeAreaView, ActivityIndicator, View, Alert } from 'react-native';
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

import Tts from 'react-native-tts';
import { addNotifications } from './src/reducers/notificationReducer';
import api, { userAPI } from './src/lib/api';
import FloatingButton from './src/components/FloatingButton';
import { ensureOverlayPermission, startSystemOverlay } from './src/lib/overlay';

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
    </Stack.Navigator>
  );
}

// Tab bar component that checks for Ludo game state
function TabBarWithLudoCheck(props: any) {
  const { isLudoGameActive } = useLudoGame();
  const { isChessGameActive } = useChessGame();
  
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
  if (routeName === 'SingleMessage' || routeName === 'SinglePost' || routeName === 'SingleVideo' || routeName === 'EditPost') {
    return null;
  }
  
  const tabs = props.user ? [
    { name: 'Home', icon: 'home', label: 'Home', component: HomeStack, color: '#4CAF50', haptic: true },
    { name: 'Videos', icon: 'play-circle', label: 'Videos', component: VideosStack, color: '#FF9800', haptic: true },
    { name: 'Friends', icon: 'people', label: 'Friends', component: FriendsStack, color: '#2196F3', haptic: true },
    { name: 'Message', icon: 'message', label: 'Message', component: MessageStack, color: '#9C27B0', haptic: true },
    { name: 'Menu', icon: 'menu', label: 'Menu', component: MenuStack, color: '#607D8B', haptic: true },
  ] : [
    { name: 'Login', icon: 'login', label: 'Login', component: LoginScreen, color: '#4CAF50' },
    { name: 'Register', icon: 'person-add', label: 'Register', component: RegisterScreen, color: '#2196F3' },
  ];
  return <ProfessionalTabBar {...props} tabs={tabs} />;
}

// Navigation container wrapper with a global top progress bar
function AppWithTopProgress() {
  const progressRef = React.useRef<TopNavigationProgressRef>(null);
  const readyRef = React.useRef(false);
  const navigationRef = React.useRef<any>(null);

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
      }}
      onStateChange={() => {
        if (readyRef.current) {
          progressRef.current?.trigger();
        }
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
  const [screen, setScreen] = React.useState<string>('');
  const [activeIncomingCall, setActiveIncomingCall] = React.useState<{
    callerId: string;
    channelName: string;
    isAudio: boolean;
  } | null>(null);
  const incomingCallTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentScreenRef = React.useRef<string>('');
  const callEndDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCallEndingRef = React.useRef<boolean>(false);
  const dispatch = useDispatch();

  React.useEffect(() => {
    // Optional: set default language and speech rate
    Tts.setDefaultLanguage('en-US');
    Tts.setDefaultRate(0.5); // speed: 0.1 - 1.0
    Tts.voices().then(voices => console.log(voices));
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
      // Check if there's already an active incoming call
      if (activeIncomingCall) {
        console.log('🚫 Ignoring incoming video call - already have active incoming call:', activeIncomingCall);
        return;
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
        }
      });
    };
    const handleIncomingAudio = ({ from, channelName, callerName, callerProfilePic }: any) => {
      // Check if there's already an active incoming call
      if (activeIncomingCall) {
        console.log('🚫 Ignoring incoming audio call - already have active incoming call:', activeIncomingCall);
        return;
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

        // Reset the flag after a longer delay to prevent rapid re-triggering
        setTimeout(() => {
          isCallEndingRef.current = false;
        }, 3000); // 3 seconds delay
      }, 500); // 500ms debounce - increased from 100ms
    };

    const handleCallAccepted = () => {
      console.log('📞 Call accepted, clearing active incoming call state');
      setActiveIncomingCall(null);
      // Clear timeout if it exists
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
    };

    on('agora-incoming-video-call', handleIncomingVideo);
    on('agora-incoming-audio-call', handleIncomingAudio);
    on('videoCallEnd', handleCallEnd);
    on('audioCallEnd', handleCallEnd);
    on('agora-call-accepted', handleCallAccepted);

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

      Tts.speak(message);
      console.log('message', message)
    }

    on('newNotification', handleNewNotification)

    on('speak_message', handleSpeakMessage)

    return () => {
      off('bumpUser',handleBumpUser)
      off('newMessageToUser',handleNewMessage)
      off('newNotification', handleNewNotification)
      off('speak_message', handleSpeakMessage)
      off('agora-incoming-video-call', handleIncomingVideo)
      off('agora-incoming-audio-call', handleIncomingAudio)
      off('videoCallEnd', handleCallEnd)
      off('audioCallEnd', handleCallEnd)
      off('agora-call-accepted', handleCallAccepted)
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
            <NotificationSetup navigation={navigation} />
            {/* Request required permissions on app start */}
            <PermissionsInitializer user={user} />
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
  const isDarkMode = useColorScheme() === 'dark';

  console.log('isDarkMode', isDarkMode)

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
