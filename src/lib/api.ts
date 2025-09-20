import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

// Type definitions
interface LoginData {
  email: string;
  password: string;
}

interface SignupData {
  email: string;
  password: string;
  name?: string;
  [key: string]: any;
}

interface GoogleSignInData {
  googleId: string;
  email: string;
  name: string;
  photo?: string;
  familyName?: string;
  givenName?: string;
  idToken: string;
}

interface PasswordChangeData {
  oldPassword: string;
  newPassword: string;
}

interface AuthResponse {
  accessToken: string;
  user?: any;
  message?: string;
}

interface DebugAuthResult {
  user: string | null;
  token: string | null;
  error?: string;
}

// Helper function to check if token exists and has valid format
const isValidToken = (token: string | null): boolean => {
  if (!token) return false;

  // Check if token has the expected JWT format (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log('❌ Invalid token format - not a JWT token');
    return false;
  }

  console.log('✅ Token format looks valid');
  return true;
};

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: config.API_TIMEOUT,
  headers: {
    "User-Agent": "MyCustomUserAgent",
    "Access-Control-Allow-Origin": "*",
  }
});

console.log('API Base URL:', config.API_BASE_URL);
console.log('API Timeout:', config.API_TIMEOUT);

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (token && isValidToken(token)) {
        if (!config.headers) {
          config.headers = {};
        }
        config.headers.Authorization = token;
      } else {
        if (token && !isValidToken(token)) {
          await AsyncStorage.multiRemove(['authToken', 'user']);
        }
      }
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Clear stored auth data
        await AsyncStorage.multiRemove(['authToken', 'user']);
        // You can redirect to login screen here if needed
        console.log('Session expired, please login again');
      } catch (storageError) {
        console.error('Error clearing auth data:', storageError);
      }
    }

    // Handle JWT verification errors (500 status with JWT error)
    if (error.response?.status === 500 && (error.response?.data as any)?.message?.includes('JsonWebTokenError')) {
      console.log('🚨 JWT verification failed - token may be expired or invalid');
      try {
        // Clear stored auth data
        await AsyncStorage.multiRemove(['authToken', 'user']);
        console.log('🗑️ Cleared invalid token from storage');
      } catch (storageError) {
        console.error('Error clearing auth data:', storageError);
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      console.error('Network error details:', {
        code: error.code,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout
        }
      });
      // You can show a network error message to the user
    }

    return Promise.reject(error);
  },
);

// API service methods
export const authAPI = {
  login: (email: string, password: string): Promise<AxiosResponse<AuthResponse>> => 
    api.post('/auth/login', { email, password }),

  signup: (userData: SignupData): Promise<AxiosResponse<AuthResponse>> => 
    api.post('/auth/signup', userData),

  googleSignIn: (googleData: GoogleSignInData): Promise<AxiosResponse<AuthResponse>> => 
    api.post('/auth/google-signin', googleData),

  logout: (): Promise<AxiosResponse> => api.post('/auth/logout'),

  refreshToken: (): Promise<AxiosResponse<AuthResponse>> => api.post('/auth/refresh'),
};

export const userAPI = {
  getProfile: (profileOrUser: any): Promise<AxiosResponse> => {
    const profileId = typeof profileOrUser === 'string'
      ? profileOrUser
      : (profileOrUser?._id || profileOrUser?.profile?._id);

    return api.get(`profile/?profileId=${profileId}`);
  },
  // checkProfile: (profileId: string): Promise<AxiosResponse> => 
  //   api.post(`profile/check`, { profileId }),

  updateProfile: (userData: any): Promise<AxiosResponse> => 
    api.post('profile', userData),

  changePassword: (passwordData: PasswordChangeData): Promise<AxiosResponse> =>
    api.post('user/change-password', passwordData),
};

export const chatAPI = {
  getChatList: (profileId: string): Promise<AxiosResponse> => 
    api.get(`/message/chatList?profileId=${profileId}`),
};

// Push notification API methods
export const pushAPI = {
  registerToken: (token: string, authToken?: string): Promise<AxiosResponse> =>
    api.post('/notification/token/register', { token }, authToken ? { headers: { Authorization: authToken } } : {}),
  unregisterToken: (token: string, authToken?: string): Promise<AxiosResponse> =>
    api.post('/notification/token/unregister', { token }, authToken ? { headers: { Authorization: authToken } } : {}),
  sendTest: (payload: { title?: string; body?: string; data?: Record<string, string> }, authToken?: string): Promise<AxiosResponse> =>
    api.post('/notification/send-test', payload || {}, authToken ? { headers: { Authorization: authToken } } : {}),
};


export const friendAPI = {
  getFriendList: (profileId: string): Promise<AxiosResponse> => 
    api.get(`/friend/getFriends?profileId=${profileId}`),
  getFriendRequest: (profileId: string): Promise<AxiosResponse> => 
    api.get(`/friend/getRequest?profileId=${profileId}`),
  getFriendSuggestions: (profileId: string): Promise<AxiosResponse> => 
    api.get(`/friend/getSuggetions?profileId=${profileId}`),
  sendFriendRequest: (profileId: string): Promise<AxiosResponse> => 
    api.post(`/friend/sendRequest?profileId=${profileId}`),
  acceptFriendRequest: (profileId: string): Promise<AxiosResponse> => 
    api.post(`/friend/reqAccept`, { profile: profileId }),
  deleteFriendRequest: (profileId: string): Promise<AxiosResponse> => 
    api.post(`/friend/reqDelete`, { profile: profileId }),
  removeFriend: (profileId: string): Promise<AxiosResponse> => 
    api.post(`/friend/removeFriend?profileId=${profileId}`),
  blockUser: (friendId: string): Promise<AxiosResponse> => 
    api.post('/friend/block', { friendId }),
  unblockUser: (friendId: string): Promise<AxiosResponse> => 
    api.post('/friend/unblock', { friendId }),
};

export const storyAPI = {
  getAllStories: (): Promise<AxiosResponse> => 
    api.get('/story/'),
  getSingleStory: (storyId: string): Promise<AxiosResponse> => 
    api.get(`/story/single?storyId=${storyId}`),
  createStory: (storyData: FormData): Promise<AxiosResponse> => 
    api.post('/story/create', storyData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  deleteStory: (storyId: string): Promise<AxiosResponse> => 
    api.post('/story/delete', { storyId }),
};

// Debug function to check stored tokens
export const debugAuth = async (): Promise<DebugAuthResult> => {
  try {
    const [userData, token] = await AsyncStorage.multiGet(['user', 'authToken']);
    console.log('🔍 Debug Auth Storage:');
    console.log('👤 User data:', userData[1] ? 'Found' : 'Not found');
    console.log('🔑 Token:', token[1] ? `${token[1].substring(0, 50)}...` : 'Not found');

    if (token[1]) {
      console.log('🔍 Token validation:', isValidToken(token[1]));
      console.log('📏 Token length:', token[1].length);
    }

    return { user: userData[1], token: token[1] };
  } catch (error) {
    console.error('❌ Error debugging auth:', error);
    return { user: null, token: null, error: (error as Error).message };
  }
};

// Generic API methods
export const apiService = {
  get: (url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> => 
    api.get(url, config),
  post: (url: string, data: any = {}, config: AxiosRequestConfig = {}): Promise<AxiosResponse> => 
    api.post(url, data, config),
  put: (url: string, data: any = {}, config: AxiosRequestConfig = {}): Promise<AxiosResponse> => 
    api.put(url, data, config),
  delete: (url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> => 
    api.delete(url, config),
  patch: (url: string, data: any = {}, config: AxiosRequestConfig = {}): Promise<AxiosResponse> => 
    api.patch(url, data, config),
};

// Export the configured axios instance
export default api;
