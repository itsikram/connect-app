import React, { useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  Image,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // Android 15+ draws this full-bleed screen under the system bars; keep the
  // form clear of them (older Android reports 0 for the navigation bar).
  const insets = useSafeAreaInsets();
  const androidBarsPadding =
    Platform.OS === 'android'
      ? { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }
      : null;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [faceLoginMode, setFaceLoginMode] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const passwordRef = useRef<TextInput>(null);
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

  const fieldBg = isDarkMode ? 'rgba(10,10,11,0.72)' : 'rgba(255,255,255,0.72)';
  const altBg = isDarkMode ? 'rgba(30,31,32,0.75)' : 'rgba(255,255,255,0.72)';
  const fieldBorder = (field: 'email' | 'password') => {
    if (error.toLowerCase().includes(field)) return themeColors.status.error;
    if (focusedField === field) return themeColors.primary;
    return themeColors.border.secondary;
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
        style={[
          styles.background,
          { backgroundColor: isDarkMode ? '#0A0A0B' : '#F7FAFF' },
        ]}
        fadeDuration={0}
        resizeMode="cover"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[styles.container, androidBarsPadding]}
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
                  { backgroundColor: fieldBg, borderColor: fieldBorder('email') },
                ]}>
                  <Icon name="mail-outline" size={20} color={focusedField === 'email' ? themeColors.primary : themeColors.text.secondary} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    submitBehavior="submit"
                    accessibilityLabel="Email address"
                    placeholder="Email address"
                    placeholderTextColor={themeColors.text.tertiary}
                    selectionColor={themeColors.primary}
                    style={[styles.nativeInput, { color: themeColors.text.primary }]}
                  />
                </View>
                <View style={[
                  styles.input,
                  { backgroundColor: fieldBg, borderColor: fieldBorder('password') },
                ]}>
                  <Icon name="lock-closed-outline" size={20} color={focusedField === 'password' ? themeColors.primary : themeColors.text.secondary} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    ref={passwordRef}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                    accessibilityLabel="Password"
                    placeholder="Password"
                    placeholderTextColor={themeColors.text.tertiary}
                    selectionColor={themeColors.primary}
                    style={[styles.nativeInput, { color: themeColors.text.primary }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(value => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={12}
                  >
                    <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={themeColors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
            {error ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <Icon name="alert-circle" size={16} color={themeColors.status.error} />
                <Text style={[styles.error, { color: themeColors.status.error }]}>{error}</Text>
              </View>
            ) : null}
            {!faceLoginMode ? (
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                style={[styles.loginButton, { backgroundColor: themeColors.primary, shadowColor: themeColors.primary }, isLoading && styles.disabledButton]}
              >
                {isLoading ? (
                  <View style={styles.loadingContent}>
                    <ActivityIndicator size="small" color={themeColors.onPrimary} />
                    <Text style={[styles.loginButtonText, { color: themeColors.onPrimary }]}>Logging in…</Text>
                  </View>
                ) : (
                  <Text style={[styles.loginButtonText, { color: themeColors.onPrimary }]}>Log in</Text>
                )}
              </TouchableOpacity>
            ) : (
              <FaceCapture
                onCapture={handleFaceLogin}
                disabled={isLoading}
                frameCount={15}
                captureIntervalMs={50}
              />
            )}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: themeColors.border.secondary }]} />
              <Text style={[styles.dividerText, { color: themeColors.text.secondary }]}>
                {faceLoginMode ? 'OR' : 'OR CONTINUE WITH'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: themeColors.border.secondary }]} />
            </View>
            {!faceLoginMode ? (
              <TouchableOpacity
                style={[styles.altButton, { borderColor: themeColors.border.secondary, backgroundColor: altBg }]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <Image
                  source={require('../assets/icons/google-logo.png')}
                  style={styles.altIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.altButtonText, { color: themeColors.text.primary }]}>Continue with Google</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setError('');
                setFaceLoginMode(value => !value);
              }}
              disabled={isLoading}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={[styles.altButton, { borderColor: themeColors.border.secondary, backgroundColor: altBg }]}
            >
              <Icon
                name={faceLoginMode ? 'key-outline' : 'scan-outline'}
                size={20}
                color={themeColors.primary}
                style={styles.altIconGlyph}
              />
              <Text style={[styles.altButtonText, { color: themeColors.text.primary }]}>
                {faceLoginMode ? 'Use email and password' : 'Log in with Face'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
              style={styles.link}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={[styles.linkText, { color: themeColors.text.secondary }]}>Don’t have an account? </Text>
              <Text style={[styles.linkAction, { color: themeColors.primary }]}>Sign up</Text>
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
    maxWidth: 440,
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
    height: 56,
    borderWidth: 1.5,
    borderColor: '#BCE4FF',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  nativeInput: {
    flex: 1,
    color: '#1B315C',
    fontSize: 16,
    marginLeft: 12,
    paddingVertical: 0,
  },
  loginButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  error: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 22,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  altButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  altIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  altIconGlyph: {
    marginRight: 10,
  },
  altButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 14,
    paddingVertical: 8,
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
