import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { TextInput as PaperTextInput, Button } from 'react-native-paper';
import Logo from '../components/Logo';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../contexts/AuthContext';
// import { GoogleSigninButton } from '@react-native-google-signin/google-signin'; // Temporarily disabled due to ViewManagerDelegate error
import Icon from 'react-native-vector-icons/Ionicons';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { colors: themeColors } = useTheme();
  const bottomBarBg = themeColors.surface.secondary;
  const { login, googleSignIn } = useContext(AuthContext);

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
      const result = await login(email, password);
      console.log('result',{email, password}, result);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Login successful!'
        });
        // navigation.navigate('Home'); // Removed, handled by tab navigator
      } else {
        Toast.show({
          type: 'error',
          text1: result.error || 'Login failed. Please try again.'
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
          text1: 'Google sign-in successful!'
        });
      } else {
        Toast.show({
          type: 'error',
          text1: result.error || 'Google sign-in failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google sign-in failed. Please try again.'
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <Logo size="large" />
      <Text style={[styles.title, { color: themeColors.primary }]}>Login</Text>
      <PaperTextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, { backgroundColor: bottomBarBg }]}
        textColor={themeColors.text.primary}
        error={!!error && error.toLowerCase().includes('email')}
        theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
      />
      <PaperTextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        style={[styles.input, { backgroundColor: bottomBarBg }]}
        textColor={themeColors.text.primary}
        error={!!error && error.toLowerCase().includes('password')}
        theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
        right={<PaperTextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(v => !v)} />}
      />
      {error ? <Text style={[styles.error, { color: themeColors.status.error }]}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} style={[styles.button, { backgroundColor: themeColors.primary }]} labelStyle={{ color: themeColors.text.inverse }}>
        <Text style={{ color: themeColors.text.inverse }}>Login</Text>
      </Button>
      
      {/* Divider */}
      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: themeColors.text.secondary }]} />
        <Text style={[styles.dividerText, { color: themeColors.text.secondary }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: themeColors.text.secondary }]} />
      </View>
      
      {/* Custom Google Sign-In Button - Fallback due to ViewManagerDelegate error */}
      <TouchableOpacity
        style={[styles.customGoogleButton, { backgroundColor: '#fff', borderColor: themeColors.text.secondary }]}
        onPress={handleGoogleSignIn}
        activeOpacity={0.8}
      >
        <Icon name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
        <Text style={[styles.googleButtonText, { color: '#000' }]}>Continue with Google</Text>
      </TouchableOpacity>
      
      <Button mode="text" onPress={() => navigation.navigate('Register')} style={styles.link} labelStyle={{ color: themeColors.text.secondary }}>
        <Text style={{ color: themeColors.text.secondary }}>Don't have an account? </Text>
        <Text style={{ color: themeColors.primary, fontWeight: 'bold' }}>Signup</Text>
      </Button>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: 280,
    marginBottom: 16, 
   },
  button: {
    width: 280,
    marginBottom: 12,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    fontSize: 14,
    marginTop: 16,
    alignSelf: 'center',
  },
  error: {
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: 280,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    width: 280,
    height: 48,
    marginBottom: 12,
  },
  customGoogleButton: {
    width: 280,
    height: 48,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LoginScreen;

