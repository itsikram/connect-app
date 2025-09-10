import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, userAPI } from '../lib/api';
import { registerTokenWithServer, unregisterTokenWithServer, listenForegroundMessages, listenTokenRefresh } from '../lib/push';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileData = async (profileId) => {
    try {
      console.log('Fetching profile data for profileId:', profileId);
      const response = await userAPI.getProfile(profileId);
      console.log('Profile API response:', response);
      
      if (response.data) {
        // Update stored user data with fresh profile
        console.log('Profile data received:', response.data);
        const currentUser = await AsyncStorage.getItem('user');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          userData.profile = response.data;
          await AsyncStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        }
      } else {
        console.log('No profile data in response');
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      console.error('Error response:', error.response);
      // If API call fails, we still have the stored data
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      console.log('🔐 Attempting login with email:', email);
      const response = await authAPI.login(email, password);
      console.log('✅ Login response received');
      console.log('📊 Login response data:', response.data);
      
      const { accessToken: token, firstName, surname, user_id, profile } = response.data;

      // Defensive: check all required fields
      if (!firstName || !surname || !user_id || !profile) {
        console.error('❌ Missing required fields:', { firstName, surname, user_id, profile });
        throw new Error('Invalid user data received from server.');
      }
      
      console.log('👤 User data extracted:', { firstName, surname, user_id, profile });
      console.log('🔑 Token received:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      
      const userData = { firstName, surname, user_id, profile };

      await AsyncStorage.multiSet([
        ['user', JSON.stringify(userData)],
        ['authToken', token]
      ]);
      
      console.log('💾 Data stored in AsyncStorage successfully');
      
      // Verify token was stored
      const storedToken = await AsyncStorage.getItem('authToken');
      console.log('🔍 Stored token verification:', storedToken ? `${storedToken.substring(0, 20)}...` : 'NO TOKEN FOUND');

      setUser(userData);
      
      // Register push token after login
      try {
        await registerTokenWithServer();
      } catch (e) { }

      // Fetch fresh profile data after login (ensure it is an ID)
      const profileId = typeof profile === 'string' ? profile : profile?._id;
      if (profileId) {
        console.log('📥 Fetching profile data for profile ID:', profileId);
        await fetchProfileData(profileId);
      }
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('❌ Login failed:', error);
      console.error('📡 Error response:', error.response);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please try again.';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await authAPI.signup(userData);
      const { user: newUser, token } = response.data;
      
      // Store user data and token
      await AsyncStorage.multiSet([
        ['user', JSON.stringify(newUser)],
        ['authToken', token]
      ]);
      
      setUser(newUser);
      
      // Fetch fresh profile data after registration
      if (newUser.user_id) {
        await fetchProfileData(newUser.user_id);
      }
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      try { await unregisterTokenWithServer(); } catch (e) {}
      // Clear stored data regardless of API call success
      await AsyncStorage.multiRemove(['user', 'authToken']);
      setUser(null);
    }
  };

  const checkUser = async () => {
    try {
      console.log('🔍 Checking for existing user session...');
      const [userData, token] = await AsyncStorage.multiGet(['user', 'authToken']);
      
      console.log('📱 Stored user data:', userData[1] ? 'Found' : 'Not found');
      console.log('🔑 Stored token:', token[1] ? `${token[1].substring(0, 20)}...` : 'Not found');
      
      if (userData[1] && token[1]) {
        const parsedUser = JSON.parse(userData[1]);
        console.log('✅ User session found:', parsedUser);
        setUser(parsedUser);
        
        // Ensure push token is registered even on cold start with existing session
        try { await registerTokenWithServer(); } catch (e) {}

        // Fetch fresh profile data when app starts with existing user
        const profileId = typeof parsedUser.profile === 'string' ? parsedUser.profile : parsedUser.profile?._id || parsedUser.user_id;
        if (profileId) {
          console.log('📥 Fetching fresh profile data for profile:', profileId);
          await fetchProfileData(profileId);
        }
      } else {
        console.log('ℹ️ No existing user session found');
      }
    } catch (error) {
      console.error('❌ Error checking user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
    // push listeners
    const unsubMsg = listenForegroundMessages();
    const unsubToken = listenTokenRefresh();
    return () => {
      try { unsubMsg && unsubMsg(); } catch (e) {}
      try { unsubToken && unsubToken(); } catch (e) {}
    };
  }, []);

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
    fetchProfileData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
