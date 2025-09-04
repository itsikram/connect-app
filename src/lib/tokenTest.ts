import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { AxiosResponse, AxiosError } from 'axios';

// Type definitions
interface TokenStorageResult {
  hasToken: boolean;
  hasUser: boolean;
  error?: string;
}

interface APITestResult {
  success: boolean;
  response?: AxiosResponse;
  error?: string;
}

interface ClearDataResult {
  success: boolean;
  error?: string;
}

interface RefreshTokenResult {
  success: boolean;
  newToken?: string;
  message?: string;
  error?: string;
}

// Utility functions to test token functionality
export const tokenTest = {
  // Check if token exists in storage
  checkTokenStorage: async (): Promise<TokenStorageResult> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const user = await AsyncStorage.getItem('user');
      
      console.log('🔍 Token Test Results:');
      console.log('🔑 Token exists:', !!token);
      console.log('👤 User exists:', !!user);
      
      if (token) {
        console.log('🔑 Token preview:', `${token.substring(0, 20)}...`);
        console.log('🔑 Token length:', token.length);
      }
      
      if (user) {
        const userData = JSON.parse(user);
        console.log('👤 User data:', userData);
      }
      
      return { hasToken: !!token, hasUser: !!user };
    } catch (error) {
      console.error('❌ Error checking token storage:', error);
      return { hasToken: false, hasUser: false, error: (error as Error).message };
    }
  },

  // Test API call with current token
  testAPICall: async (): Promise<APITestResult> => {
    try {
      console.log('🧪 Testing API call with current token...');
      
      // Try to make a simple API call
      const response = await api.get('/profile');
      
      console.log('✅ API call successful!');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', response.data);
      
      return { success: true, response };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('❌ API call failed:', error);
      console.error('📡 Error response:', axiosError.response);
      
      if (axiosError.response) {
        console.error('📡 Status:', axiosError.response.status);
        console.error('📡 Data:', axiosError.response.data);
      }
      
      return { success: false, error: axiosError.message, response: axiosError.response };
    }
  },

  // Clear all stored data (useful for testing)
  clearAllData: async (): Promise<ClearDataResult> => {
    try {
      await AsyncStorage.multiRemove(['user', 'authToken']);
      console.log('🗑️ All stored data cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Simulate token refresh (if you have a refresh endpoint)
  refreshToken: async (): Promise<RefreshTokenResult> => {
    try {
      console.log('🔄 Attempting token refresh...');
      const response = await api.post('/auth/refresh');
      
      if (response.data.accessToken) {
        await AsyncStorage.setItem('authToken', response.data.accessToken);
        console.log('✅ Token refreshed successfully');
        return { success: true, newToken: response.data.accessToken };
      } else {
        console.log('⚠️ No new token in refresh response');
        return { success: false, message: 'No new token received' };
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
};

export default tokenTest;
