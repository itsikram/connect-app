/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, useColorScheme, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './src/theme/colors';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import Home from './src/screens/Home';
import Message from './src/screens/Message';
import Menu from './src/screens/Menu';

const Tab = createBottomTabNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  console.log('isDarkMode', isDarkMode)

  return (
    <PaperProvider>
      <AuthProvider>
        <SafeAreaView style={{ 
          flex: 1, 
          backgroundColor: isDarkMode ? '#000' : colors.background.light 
        }}>
          <NavigationContainer >
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <AuthContext.Consumer>
              {({ user }) => (
                <Tab.Navigator
                  initialRouteName={user ? 'Home' : 'Login'}
                  screenOptions={({ route }) => ({
                    tabBarIcon: ({ color, size }) => {
                      let iconName: string;

                      if (route.name === 'Home') {
                        iconName = 'home';
                      } else if (route.name === 'Message') {
                        iconName = 'message';
                      } else if (route.name === 'Menu') {
                        iconName = 'menu';
                      } else if (route.name === 'Login') {
                        iconName = 'login';
                      } else if (route.name === 'Register') {
                        iconName = 'person-add';
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
                        name="Message" 
                        component={Message} 
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
            </AuthContext.Consumer>
          </NavigationContainer>
        </SafeAreaView>
      </AuthProvider>
    </PaperProvider>
  );
}

export default App;
