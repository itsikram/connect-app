import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../lib/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const response = await authAPI.login(email, password);
      console.log('response', response);
      const { accessToken: token, firstName, surname, user_id, profile } = response.data;

      // Defensive: check all required fields
      if (!firstName || !surname || !user_id || !profile) {
        throw new Error('Invalid user data received from server.');
      }
      const userData = { firstName, surname, user_id, profile };

      await AsyncStorage.multiSet([
        ['user', JSON.stringify(userData)],
        ['authToken', token]
      ]);

      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please try again.';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await authAPI.register(userData);
      const { user: newUser, token } = response.data;
      
      // Store user data and token
      await AsyncStorage.multiSet([
        ['user', JSON.stringify(newUser)],
        ['authToken', token]
      ]);
      
      setUser(newUser);
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
      // Clear stored data regardless of API call success
      await AsyncStorage.multiRemove(['user', 'authToken']);
      setUser(null);
    }
  };

  const checkUser = async () => {
    try {
      const [userData, token] = await AsyncStorage.multiGet(['user', 'authToken']);
      
      if (userData[1] && token[1]) {
        setUser(JSON.parse(userData[1]));
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
