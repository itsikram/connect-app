import * as React from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

declare global {
  function alert(message?: any): void;
}

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

export default function RegisterScreen() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleRegister = () => {
    // TODO: Implement registration logic
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    alert(`Registered with Username: ${username}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      <Button title="Register" onPress={handleRegister} />
      <Button title="Back to Login" onPress={() => navigation.navigate('Login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    width: 250,
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  passwordContainer: {
    width: 250,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
}); 