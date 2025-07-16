import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import theme from '../theme/theme';
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
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const bottomBarBg = isDarkMode ? '#242526' : theme.colors.background.light;
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
        navigation.navigate('Home');
      } else {
        Toast.show({
          type: 'error',
          text1: result.error || 'Login failed. Please try again.'
        });
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? theme.colors.background.dark : theme.colors.background.light }]}>
      <Logo size="large" />
      <Text style={[styles.title, { color: theme.colors.primary }]}>Login</Text>
      <PaperTextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, { backgroundColor: bottomBarBg }]}
        error={!!error && error.toLowerCase().includes('email')}
        theme={{ colors: { primary: theme.colors.primary } }}
      />
      <PaperTextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={[styles.input, { backgroundColor: bottomBarBg }]}
        error={!!error && error.toLowerCase().includes('password')}
        theme={{ colors: { primary: theme.colors.primary } }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} style={[styles.button, { backgroundColor: theme.colors.primary }]} labelStyle={{ color: '#fff' }}>
        Login
      </Button>
      <Button mode="text" onPress={() => navigation.navigate('Register')} style={styles.link} labelStyle={{ color: theme.colors.text.light }}>
        <Text style={{ color: theme.colors.text.light }}>Don't have an account? </Text>
        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Signup</Text>
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
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    marginBottom: 0,
    textAlign: 'center',
  },
  input: {
    width: 280,
    marginBottom: theme.spacing.md,
    color: theme.colors.primary,
  },
  button: {
    width: 280,
    marginBottom: theme.spacing.sm,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    color: theme.colors.text.light,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  link: {
    color: theme.colors.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing.md,
    alignSelf: 'center',
  },
  error: {
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
  },
});

export default LoginScreen;

