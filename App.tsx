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
import { colors } from './src/theme/colors';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
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
import { Provider, useSelector } from 'react-redux';
import store, { RootState } from './src/store';
// Profile data hook
import { useProfileData } from './src/hooks/useProfileData';
import SingleMessage from './src/screens/SingleMessage';
import Videos from './src/screens/Videos';
// Socket context
import { SocketProvider, useSocket } from './src/contexts/SocketContext';
import { ToastProvider, useToast } from './src/contexts/ToastContext';
import { UserToastProvider, useUserToast } from './src/contexts/UserToastContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import LoadingScreen from './src/components/LoadingScreen';
import FacebookHeader from './src/components/FacebookHeader';
import { HeaderVisibilityProvider } from './src/contexts/HeaderVisibilityContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigator for Message tab
function MessageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessageList" component={Message} />
      <Stack.Screen name="SingleMessage" component={SingleMessage} />
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

// Component to handle profile data fetching
function AppContent() {

  const { connect, isConnected, emit, on, off } = useSocket();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { showMessageToast } = useUserToast();
  const navigation = useNavigation();
  const [screen, setScreen] = React.useState<string>('');

  React.useEffect(() => {
    // Use navigation state to get current route
    const unsubscribe = navigation.addListener('state', () => {
      const currentRoute = navigation.getState()?.routes[navigation.getState()?.index || 0];
      setScreen(currentRoute?.name || '');
    });
    
    return unsubscribe;
  }, [navigation]);

  // Connect to socket when component mounts
  React.useEffect(() => {
    if (myProfile?._id && !isConnected) {
      console.log('myProfile for socket', myProfile?._id)
      connect(myProfile._id)
        .then(() => {
          console.log('Socket connected successfully in SingleMessage component');

        })
        .catch((error) => {
          console.error('Failed to connect socket in SingleMessage component:', error);
          Alert.alert('Connection Error', 'Failed to connect to real-time service');
        });
    }
  }, [myProfile?._id, isConnected, connect]);

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

    let handleNewMessage = (data: any) => {
      let {updatedMessage, senderName, senderPP, chatPage, friendProfile} = data;

      if(screen === 'MessageList' || screen === 'SingleMessage'){
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

    return () => {
      off('bumpUser',handleBumpUser)
      off('newMessageToUser',handleNewMessage)
    }
  }, [isConnected,on,off,screen])

  const isDarkMode = useColorScheme() === 'dark';

  return (
    <AuthContext.Consumer>
      {({ user, isLoading }) => (
        <AppContentInner user={user} isLoading={isLoading} isDarkMode={isDarkMode} />
      )}
    </AuthContext.Consumer>
  );
}

// Inner component that can use hooks
function AppContentInner({ user, isLoading, isDarkMode }: { user: any, isLoading: boolean, isDarkMode: boolean }) {
  // Use the profile data hook when user is available
  if (user && !isLoading) {
    useProfileData(user.user_id);
  }

  return (
    <SafeAreaView style={{
      flex: 1,
      backgroundColor: isDarkMode ? '#000' : colors.background.light
    }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {isLoading ? (
          <LoadingScreen message="Initializing app..." />
        ) : (
          <Tab.Navigator
            initialRouteName={user ? 'Home' : 'Login'}
            screenOptions={({ route }) => ({
              tabBarIcon: ({ color, size }) => {
                let iconName: string;

                if (route.name === 'Home') {
                  iconName = 'home';
                } else if (route.name === 'Videos') {
                  iconName = 'play-circle';
                } else if (route.name === 'Message') {
                  iconName = 'message';
                } else if (route.name === 'Menu') {
                  iconName = 'menu';
                } else if (route.name === 'Login') {
                  iconName = 'login';
                } else if (route.name === 'Register') {
                  iconName = 'person-add';
                } else if (route.name === 'Friends') {
                  iconName = 'people';
                } else {
                  iconName = 'help';
                }

                return <Icon name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.gray[500],
              tabBarStyle: {
                backgroundColor: isDarkMode ? '#242526' : colors.background.light,
                borderTopColor: isDarkMode ? colors.border.dark : colors.border.light,
                height: 60,
                paddingBottom: 8,
                paddingTop: 8,
              },
              headerShown: true,
              header: () => <FacebookHeader />,
            })}
          >
            {user ? (
              <>
                <Tab.Screen
                  name="Home"
                  component={Home}
                  options={{
                    tabBarLabel: 'Home',
                  }}
                />
                <Tab.Screen
                  name="Videos"
                  component={Videos}
                  options={{
                    tabBarLabel: 'Videos',
                  }}
                />
                <Tab.Screen
                  name="Friends"
                  component={Friends}
                  options={{
                    tabBarLabel: 'Friends',
                  }}
                />
                <Tab.Screen
                  name="Message"
                  component={MessageStack}
                  options={({ route }) => ({
                    tabBarLabel: 'Message',
                    headerShown: getFocusedRouteNameFromRoute(route as any) !== 'SingleMessage',
                  })}
                />

                <Tab.Screen
                  name="Menu"
                  component={MenuStack}
                  options={{
                    tabBarLabel: 'Menu',
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
    </SafeAreaView>
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
            <AuthProvider>
              <SocketProvider>
                <ToastProvider>
                  <UserToastProvider>
                    <HeaderVisibilityProvider>
                      <NavigationContainer>
                        <AppContent />
                      </NavigationContainer>
                    </HeaderVisibilityProvider>
                  </UserToastProvider>
                </ToastProvider>
              </SocketProvider>
            </AuthProvider>
          </PaperProvider>
        </Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default App;
