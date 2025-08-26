import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { TextInput as PaperTextInput, Button } from 'react-native-paper';
import Logo from '../components/Logo';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../contexts/AuthContext';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { colors: themeColors } = useTheme();
  const bottomBarBg = themeColors.surface.secondary;
  const { login } = useContext(AuthContext);

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
        error={!!error && error.toLowerCase().includes('email')}
        theme={{ colors: { primary: themeColors.primary } }}
      />
      <PaperTextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={[styles.input, { backgroundColor: bottomBarBg }]}
        error={!!error && error.toLowerCase().includes('password')}
        theme={{ colors: { primary: themeColors.primary } }}
      />
      {error ? <Text style={[styles.error, { color: themeColors.status.error }]}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} style={[styles.button, { backgroundColor: themeColors.primary }]} labelStyle={{ color: themeColors.text.inverse }}>
        <Text style={{ color: themeColors.text.inverse }}>Login</Text>
      </Button>
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
});

export default LoginScreen;

