import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { authAPI } from '../lib/api';

// Configure Google Sign-In
// IMPORTANT: Replace with your actual web client ID from Google Cloud Console
GoogleSignin.configure({
  webClientId: '560231541864-igg3lvikjeii27kd0qoj6drm7jgkh9u6.apps.googleusercontent.com', // Web client ID from Google Cloud Console
  offlineAccess: true,
  hostedDomain: '',
  forceCodeForRefreshToken: true,
});

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  photo?: string | null;
  familyName?: string | null;
  givenName?: string | null;
}

export interface GoogleSignInResult {
  success: boolean;
  user?: any;
  error?: string;
}

class GoogleAuthService {
  /**
   * Check if Google Play Services are available (Android only)
   */
  async hasPlayServices(): Promise<boolean> {
    try {
      const hasPlayServices = await GoogleSignin.hasPlayServices();
      return hasPlayServices;
    } catch (error) {
      console.error('Google Play Services check failed:', error);
      return false;
    }
  }

  /**
   * Sign in with Google
   */
  async signIn(): Promise<GoogleSignInResult> {
    try {
      // Check if Google Play Services are available (Android)
      const hasPlayServices = await this.hasPlayServices();
      if (!hasPlayServices) {
        return {
          success: false,
          error: 'Google Play Services are not available'
        };
      }

      // Sign in with Google
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo.data) {
        return {
          success: false,
          error: 'Failed to get user information from Google'
        };
      }

      const { user } = userInfo.data;
      
      // Prepare user data for our backend
      const googleUser: GoogleUser = {
        id: user.id,
        email: user.email,
        name: user.name || `${user.givenName || ''} ${user.familyName || ''}`.trim(),
        photo: user.photo,
        familyName: user.familyName,
        givenName: user.givenName,
      };

      // Send Google user data to our backend for authentication
      try {
        const response = await authAPI.googleSignIn({
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          photo: googleUser.photo || undefined,
          familyName: googleUser.familyName || undefined,
          givenName: googleUser.givenName || undefined,
          idToken: userInfo.data.idToken || '',
        });

        return {
          success: true,
          user: response.data
        };
      } catch (backendError: any) {
        console.error('Backend authentication failed:', backendError);
        
        // If backend authentication fails, sign out from Google
        await this.signOut();
        
        return {
          success: false,
          error: backendError?.response?.data?.message || 'Authentication failed'
        };
      }

    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      
      let errorMessage = 'Sign-in failed. Please try again.';
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign-in was cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign-in is already in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services are not available';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
      console.log('Successfully signed out from Google');
    } catch (error) {
      console.error('Google Sign-Out error:', error);
    }
  }

  /**
   * Check if user is currently signed in to Google
   */
  async isSignedIn(): Promise<boolean> {
    try {
      const userInfo = await GoogleSignin.getCurrentUser();
      return userInfo !== null;
    } catch (error) {
      console.error('Error checking Google sign-in status:', error);
      return false;
    }
  }

  /**
   * Get current signed-in user from Google
   */
  async getCurrentUser(): Promise<GoogleUser | null> {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      if (userInfo.data && userInfo.data.user) {
        const { user } = userInfo.data;
        return {
          id: user.id,
          email: user.email,
          name: user.name || `${user.givenName || ''} ${user.familyName || ''}`.trim(),
          photo: user.photo || null,
          familyName: user.familyName || null,
          givenName: user.givenName || null,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting current Google user:', error);
      return null;
    }
  }

  /**
   * Revoke access and sign out
   */
  async revokeAccess(): Promise<void> {
    try {
      await GoogleSignin.revokeAccess();
      console.log('Successfully revoked Google access');
    } catch (error) {
      console.error('Error revoking Google access:', error);
    }
  }
}

export const googleAuthService = new GoogleAuthService();
export { GoogleSigninButton };
