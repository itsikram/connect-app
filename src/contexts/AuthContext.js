import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, userAPI, clearTokenCache } from '../lib/api';
import { registerTokenWithServer, unregisterTokenWithServer, listenForegroundMessages, listenTokenRefresh } from '../lib/push';
import { googleAuthService } from '../services/googleAuth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistAuthResponse = async (responseData) => {
    const token = responseData?.accessToken;
    if (!token) {
      throw new Error('Invalid login response: no access token received.');
    }

    const userData = { ...responseData };
    await AsyncStorage.multiSet([
      ['user', JSON.stringify(userData)],
      ['authToken', token],
    ]);
    clearTokenCache();
    setUser(userData);

    return userData;
  };

  const updateUser = async (updates) => {
    const stored = await AsyncStorage.getItem('user');
    const currentUser = stored ? JSON.parse(stored) : user || {};
    const nextUser = { ...currentUser, ...updates };
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

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
      
      const userData = await persistAuthResponse(response.data);
      const { profile, user_id } = userData;
      
      // Register push token after login
      try {
        await registerTokenWithServer();
      } catch (e) { }

      // Fetch fresh profile data after login (ensure it is an ID)
      const profileId = typeof profile === 'string' ? profile : profile?._id || user_id;
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

  const faceLogin = async (frames) => {
    try {
      setIsLoading(true);
      const response = await authAPI.faceLogin({ frames });
      const userData = await persistAuthResponse(response.data);
      const { profile, user_id } = userData;

      try {
        await registerTokenWithServer();
      } catch (error) {
        console.warn('Push token registration after face login failed:', error.message);
      }

      const profileId = typeof profile === 'string' ? profile : profile?._id || user_id;
      if (profileId) await fetchProfileData(profileId);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Face login failed:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Face login failed. Please try again.',
      };
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

  const googleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 Attempting Google sign-in...');
      
      const result = await googleAuthService.signIn();
      
      if (result.success && result.user) {
        console.log('✅ Google sign-in successful');
        
        const { accessToken: token, firstName, surname, user_id, profile } = result.user;
        
        // Defensive: check all required fields
        if (!firstName || !surname || !user_id || !profile) {
          console.error('❌ Missing required fields from Google sign-in:', { firstName, surname, user_id, profile });
          throw new Error('Invalid user data received from server.');
        }
        
        console.log('👤 Google user data extracted:', { firstName, surname, user_id, profile });
        console.log('🔑 Token received:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        
        const userData = { firstName, surname, user_id, profile };
        
        await AsyncStorage.multiSet([
          ['user', JSON.stringify(userData)],
          ['authToken', token]
        ]);
        
        console.log('💾 Google user data stored in AsyncStorage successfully');
        
        setUser(userData);
        
        // Register push token after Google sign-in
        try {
          await registerTokenWithServer();
        } catch (e) { }
        
        // Fetch fresh profile data after Google sign-in
        const profileId = typeof profile === 'string' ? profile : profile?._id;
        if (profileId) {
          console.log('📥 Fetching profile data for Google user profile ID:', profileId);
          await fetchProfileData(profileId);
        }
        
        return { success: true, user: userData };
      } else {
        console.error('❌ Google sign-in failed:', result.error);
        return { success: false, error: result.error || 'Google sign-in failed' };
      }
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      const errorMessage = error.message || 'Google sign-in failed. Please try again.';
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
      try { 
        await unregisterTokenWithServer(); 
        await googleAuthService.signOut(); // Sign out from Google as well
      } catch (e) {}
      // Clear stored data regardless of API call success
      clearTokenCache(); // Clear token cache
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
        console.log('🔄 Setting user state...');
        setUser(parsedUser);
        console.log('✅ User state set successfully');
        
        // Set loading to false immediately after setting user
        console.log('🔄 Setting isLoading to false (user found)...');
        setIsLoading(false);
        console.log('✅ isLoading set to false (user found)');
        
        // Do async operations in background without blocking
        Promise.all([
          // Ensure push token is registered even on cold start with existing session
          (async () => {
            try { 
              console.log('📱 Registering push token...');
              await registerTokenWithServer(); 
              console.log('✅ Push token registered successfully');
            } catch (e) {
              console.log('⚠️ Push token registration failed:', e.message);
            }
          })(),
          
          // Fetch fresh profile data when app starts with existing user
          (async () => {
            const profileId = typeof parsedUser.profile === 'string' ? parsedUser.profile : parsedUser.profile?._id || parsedUser.user_id;
            if (profileId) {
              console.log('📥 Fetching fresh profile data for profile:', profileId);
              try {
                await fetchProfileData(profileId);
                console.log('✅ Profile data fetched successfully');
              } catch (e) {
                console.log('⚠️ Profile data fetch failed:', e.message);
              }
            }
          })()
        ]).catch(e => {
          console.log('⚠️ Background operations failed:', e.message);
        });
      } else {
        console.log('ℹ️ No existing user session found');
        console.log('🔄 Setting isLoading to false (no user)...');
        setIsLoading(false);
        console.log('✅ isLoading set to false (no user)');
      }
    } catch (error) {
      console.error('❌ Error checking user:', error);
      console.log('🔄 Setting isLoading to false (error)...');
      setIsLoading(false);
      console.log('✅ isLoading set to false (error)');
    }
  };

  useEffect(() => {
    console.log('🚀 AuthContext useEffect - Starting initialization...');
    console.log('🚀 AuthContext useEffect - Current isLoading state:', isLoading);
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
    faceLogin,
    register,
    googleSignIn,
    logout,
    updateUser,
    fetchProfileData,
  };

  // Debug value changes
  React.useEffect(() => {
    console.log('🔄 AuthContext value changed - user:', user ? 'Present' : 'Null', 'isLoading:', isLoading);
  }, [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
