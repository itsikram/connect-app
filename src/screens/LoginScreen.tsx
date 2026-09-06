import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  TextInput,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import Logo from '../components/Logo';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../contexts/AuthContext';
// import { GoogleSigninButton } from '@react-native-google-signin/google-signin'; // Temporarily disabled due to ViewManagerDelegate error
import Icon from 'react-native-vector-icons/Ionicons';
import KeyboardSafeView from '../components/KeyboardSafeView';
import FaceCapture from '../components/FaceCapture';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
};

const LoginScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [faceLoginMode, setFaceLoginMode] = useState(false);
  const { isDarkMode, colors: themeColors } = useTheme();
  const { login, faceLogin, googleSignIn, isLoading } = useContext(AuthContext);

  const handleFaceLogin = async (frames: string[]) => {
    setError('');
    const result = await faceLogin(frames);
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Face login successful!' });
      setFaceLoginMode(false);
    } else {
      setError(result.error || 'Could not verify your face. Please try again.');
      Toast.show({ type: 'error', text1: result.error || 'Face login failed.' });
    }
  };

  const validate = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Invalid email address');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    setError('');
    return true;
  };

  const handleLogin = async () => {
    if (validate()) {
      setError('');
      const result = await login(email.trim(), password);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Login successful!',
        });
      } else {
        setError(result.error || 'Login failed. Please try again.');
        Toast.show({
          type: 'error',
          text1: result.error || 'Login failed. Please try again.',
        });
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      const result = await googleSignIn();
      console.log('Google sign-in result:', result);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Google sign-in successful!',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: result.error || 'Google sign-in failed. Please try again.',
        });
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google sign-in failed. Please try again.',
      });
    }
  };

  return (
    <KeyboardSafeView>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <ImageBackground
        source={
          isDarkMode
            ? require('../assets/images/login-registrasion-bg-dark.png')
            : require('../assets/images/login-registrasion-bg.png')
        }
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.container}
        >
          <View style={styles.content}>
            <Logo size="xlarge" />
            <Text style={[styles.brandTitle, { color: themeColors.primary }]}>Connect</Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
              Connect with people, share moments{'\n'}and be part of our community.
            </Text>
            {!faceLoginMode ? (
              <>
                <View style={[
                  styles.input,
                  { backgroundColor: isDarkMode ? 'rgba(10,10,11,0.72)' : 'rgba(255,255,255,0.42)', borderColor: themeColors.border.secondary },
                  error.toLowerCase().includes('email') && { borderColor: themeColors.status.error },
                ]}>
                  <Icon name="mail-outline" size={29} color={themeColors.primary} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email address"
                    placeholderTextColor={themeColors.text.tertiary}
                    style={[styles.nativeInput, { color: themeColors.text.primary }]}
                  />
                </View>
                <View style={[
                  styles.input,
                  { backgroundColor: isDarkMode ? 'rgba(10,10,11,0.72)' : 'rgba(255,255,255,0.42)', borderColor: themeColors.border.secondary },
                  error.toLowerCase().includes('password') && { borderColor: themeColors.status.error },
                ]}>
                  <Icon name="lock-closed-outline" size={29} color={themeColors.primary} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Password"
                    placeholderTextColor={themeColors.text.tertiary}
                    style={[styles.nativeInput, { color: themeColors.text.primary }]}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(value => !value)} accessibilityLabel="Toggle password visibility">
                    <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={30} color={themeColors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
            {error ? <Text style={[styles.error, { color: themeColors.status.error }]}>{error}</Text> : null}
            {!faceLoginMode ? (
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                style={[styles.loginButton, { backgroundColor: themeColors.primary }, isLoading && styles.disabledButton]}
              >
                {isLoading ? (
                  <View style={styles.loadingContent}>
                    <ActivityIndicator size="small" color={themeColors.text.inverse} />
                    <Text style={[styles.loginButtonText, { color: themeColors.text.inverse }]}>Logging in...</Text>
                  </View>
                ) : (
                  <View style={styles.actionContent}>
                    <Text style={[styles.loginButtonText, { color: themeColors.text.inverse }]}>Login</Text>
                    <Text style={[styles.arrow, { color: themeColors.text.inverse }]}>→</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setError('');
                setFaceLoginMode(value => !value);
              }}
              disabled={isLoading}
              activeOpacity={0.85}
              style={[styles.faceButton, { borderColor: themeColors.primary, backgroundColor: isDarkMode ? 'rgba(10,10,11,0.55)' : 'rgba(255,255,255,0.5)' }]}
            >
              <Icon name="scan-outline" size={32} color={themeColors.primary} />
              <Text style={[styles.faceButtonText, { color: themeColors.text.primary }]}>{faceLoginMode ? 'Use password login' : 'Log in with Face'}</Text>
            </TouchableOpacity>
            {faceLoginMode ? <FaceCapture onCapture={handleFaceLogin} disabled={isLoading} /> : null}
            {!faceLoginMode ? (
              <>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: themeColors.border.secondary }]} />
                  <Text style={[styles.dividerText, { color: themeColors.text.secondary }]}>OR</Text>
                  <View style={[styles.dividerLine, { backgroundColor: themeColors.border.secondary }]} />
                </View>
                <TouchableOpacity
                  style={[styles.googleButton, { borderColor: themeColors.border.secondary, backgroundColor: isDarkMode ? 'rgba(30,31,32,0.75)' : 'rgba(255,255,255,0.56)' }]}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.googleMark}>G</Text>
                  <Text style={[styles.googleButtonText, { color: themeColors.text.primary }]}>Continue with Google</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
              style={styles.link}
            >
              <Text style={[styles.linkText, { color: themeColors.text.secondary }]}>Don’t have an account? </Text>
              <Text style={[styles.linkAction, { color: themeColors.primary }]}>Sign up →</Text>
            </TouchableOpacity>
            <Toast />
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardSafeView>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 650,
    alignSelf: 'center',
  },
  brandTitle: {
    color: '#08B9EA',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#536B98',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 60,
    borderWidth: 2,
    borderColor: '#BCE4FF',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#E55353',
  },
  nativeInput: {
    flex: 1,
    color: '#1B315C',
    fontSize: 17,
    marginLeft: 14,
    paddingVertical: 0,
  },
  loginButton: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    backgroundColor: '#08B9EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 12,
    shadowColor: '#08B9EA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  arrow: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 30,
    marginLeft: 14,
    fontWeight: '300',
  },
  faceButton: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#08B9EA',
    backgroundColor: 'rgba(255,255,255,0.5)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  faceButtonText: {
    color: '#172B55',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  error: {
    color: '#C62828',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#D9E2EF',
  },
  dividerText: {
    color: '#536B98',
    marginHorizontal: 18,
    fontSize: 17,
    fontWeight: '500',
  },
  googleButton: {
    width: '100%',
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#D8E3EF',
    backgroundColor: 'rgba(255,255,255,0.56)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  googleMark: {
    color: '#4285F4',
    fontSize: 28,
    fontWeight: '800',
    marginRight: 16,
  },
  googleButtonText: {
    color: '#172B55',
    fontSize: 18,
    fontWeight: '700',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: '#536B98',
    fontSize: 16,
  },
  linkAction: {
    color: '#08B9EA',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default LoginScreen;
