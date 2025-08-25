/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, useColorScheme, SafeAreaView, ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './src/theme/colors';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import Home from './src/screens/Home';
import Message from './src/screens/Message';
import Menu from './src/screens/Menu';
import Friends from './src/screens/Friends';
// Redux Provider and store
import { Provider } from 'react-redux';
import store from './src/store';
// Profile data hook
import { useProfileData } from './src/hooks/useProfileData';
import SingleMessage from './src/screens/SingleMessage';
import Videos from './src/screens/Videos';
// Socket context
import { SocketProvider } from './src/contexts/SocketContext';

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

// Component to handle profile data fetching
function AppContent() {
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
      <NavigationContainer >
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#000' : colors.background.light }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
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
              headerShown: false,
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
                  options={{
                    tabBarLabel: 'Message',
                  }}
                />

                <Tab.Screen 
                  name="Menu" 
                  component={Menu} 
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
      </NavigationContainer>
    </SafeAreaView>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  console.log('isDarkMode', isDarkMode)

  return (
    <Provider store={store}>
      <PaperProvider>
        <AuthProvider>
          <SocketProvider>
            <AppContent />
          </SocketProvider>
        </AuthProvider>
      </PaperProvider>
    </Provider>
  );
}

export default App;
