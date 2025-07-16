import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TextInput as PaperTextInput, Button, RadioButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Logo from '../components/Logo';
import theme from '../theme/theme';
import { authAPI } from '../lib/api';
import Toast from 'react-native-toast-message';

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'contact', label: 'Contact' },
  { key: 'security', label: 'Security' },
];

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

const RegisterScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    email: '',
    DOB: null as Date | null,
    gender: '',
    password: '',
    confirmPassword: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const bottomBarBg = isDarkMode ? '#242526' : theme.colors.background.light;

  // Validation per tab
  const validateTab = () => {
    if (tab === 0) {
      if (!formData.firstName) return 'First Name is required';
      if (!/^[A-Za-z]+$/.test(formData.firstName)) return 'First Name must contain only letters';
      if (formData.firstName.length < 2) return 'First Name must be at least 2 characters';
      if (!formData.surname) return 'Surname is required';
      if (!/^[A-Za-z]+$/.test(formData.surname)) return 'Surname must contain only letters';
      if (formData.surname.length < 2) return 'Surname must be at least 2 characters';
    }
    if (tab === 1) {
      if (!formData.email) return 'Email is required';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email)) return 'Invalid email address';
      if (!formData.DOB) return 'Date of Birth is required';
      const now = new Date();
      const minAge = 13;
      const dob = formData.DOB;
      if (dob) {
        const age = now.getFullYear() - dob.getFullYear() - (now < new Date(dob.setFullYear(now.getFullYear())) ? 1 : 0);
        if (age < minAge) return 'You must be at least 13 years old';
      }
      if (!formData.gender) return 'Gender is required';
      if (!['male', 'female', 'other'].includes(formData.gender)) return 'Invalid gender selected';
    }
    if (tab === 2) {
      if (!formData.password) return 'Password is required';
      if (formData.password.length < 6) return 'Password must be at least 6 characters';
      if (!/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) return 'Password must contain at least one letter and one number';
      if (!formData.confirmPassword) return 'Confirm Password is required';
      if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    }
    return '';
  };

  const handleTabPress = (idx: number) => {
    setError('');
    setTab(idx);
  };

  const handleNext = () => {
    const err = validateTab();
    if (err) { setError(err); return; }
    setError('');
    setTab(tab + 1);
  };

  const handleBack = () => {
    setError('');
    setTab(tab - 1);
  };

  const handleRegister = async () => {
    for (let i = 0; i < TABS.length; i++) {
      setTab(i);
      const err = validateTab();
      if (err) { setError(err); return; }
    }
    setError('');
    try {
      const body = {
        firstName: formData.firstName,
        surname: formData.surname,
        email: formData.email,
        DOB: formData.DOB,
        gender: formData.gender,
        password: formData.password,
      };
      let signupResponse = await authAPI.signup(body);
      console.log('Registration successful!',signupResponse);
      if (signupResponse?.status === 201) {
        Toast.show({
          type: 'success',
          text1: 'Account creation successful'
        });
        navigation.navigate('Login');
      }
    } catch (e) {
      const err = e as any;
      let errorMsg = err?.response?.data?.message || err?.message || 'Registration failed. Please try again.';
      Toast.show({
        type: 'error',
        text1: errorMsg
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? theme.colors.background.dark : theme.colors.background.light }]}>
      <Logo size="large" />
      <Text style={[styles.title, { color: theme.colors.primary }]}>Register</Text>
      {/* Tab headers - fixed width, centered, pill/rounded style */}
      <View style={styles.tabHeaderContainerOuter}>
        <View style={[styles.tabHeaderPillBg, { backgroundColor: bottomBarBg }]}>
          {TABS.map((t, idx) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabHeaderPill, tab === idx && [styles.tabHeaderPillActive, { backgroundColor: isDarkMode ? theme.colors.primary : theme.colors.primaryLight }]]}
              onPress={() => handleTabPress(idx)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabHeaderText, { color: theme.colors.primary }, tab === idx && styles.tabHeaderTextActive, tab === idx && { color: '#fff' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {/* Tab contents */}
      {tab === 0 && (
        <View style={styles.tabContent}>
          <PaperTextInput
            mode="outlined"
            label="First Name"
            value={formData.firstName}
            onChangeText={v => setFormData(f => ({ ...f, firstName: v }))}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!error && error.toLowerCase().includes('first name')}
            theme={{ colors: { primary: theme.colors.primary } }}
          />
          <PaperTextInput
            mode="outlined"
            label="Surname"
            value={formData.surname}
            onChangeText={v => setFormData(f => ({ ...f, surname: v }))}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!error && error.toLowerCase().includes('surname')}
            theme={{ colors: { primary: theme.colors.primary } }}
          />
          <Button mode="contained" onPress={handleNext} style={[styles.button, { backgroundColor: theme.colors.primary }]} labelStyle={{ color: '#fff' }}>Next</Button>
        </View>
      )}
      {tab === 1 && (
        <View style={styles.tabContent}>
          <PaperTextInput
            mode="outlined"
            label="Email"
            value={formData.email}
            onChangeText={v => setFormData(f => ({ ...f, email: v }))}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!error && error.toLowerCase().includes('email')}
            theme={{ colors: { primary: theme.colors.primary } }}
          />
          <Button mode="outlined" color={theme.colors.primary} onPress={() => setShowDatePicker(true)} style={[styles.input, { backgroundColor: bottomBarBg, borderColor: theme.colors.primary, borderWidth: 1 }]} labelStyle={{ color: theme.colors.primary }}>
            {formData.DOB ? formData.DOB.toLocaleDateString() : 'Select Date of Birth'}
          </Button>
          {showDatePicker && (
            <DateTimePicker
              value={formData.DOB || new Date(2000, 0, 1)}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setFormData(f => ({ ...f, DOB: date }));
              }}
              maximumDate={new Date()}
            />
          )}
          <View style={styles.radioGroup}>
            <Text style={[styles.radioLabel, { color: theme.colors.text.light }]}>Gender:</Text>
            <RadioButton.Group
              onValueChange={v => setFormData(f => ({ ...f, gender: v }))}
              value={formData.gender}
            >
              <View style={styles.radioRow}>
                <RadioButton value="male" /><Text style={[styles.radioText, { color: theme.colors.text.light }]}>Male</Text>
                <RadioButton value="female" /><Text style={[styles.radioText, { color: theme.colors.text.light }]}>Female</Text>
                <RadioButton value="other" /><Text style={[styles.radioText, { color: theme.colors.text.light }]}>Other</Text>
              </View>
            </RadioButton.Group>
          </View>
          <Button mode="contained" onPress={handleNext} style={[styles.button, { backgroundColor: theme.colors.primary }]} labelStyle={{ color: '#fff' }}>Next</Button>
          <Button mode="text" onPress={handleBack} style={[styles.button, { backgroundColor: 'transparent' }]} labelStyle={{ color: theme.colors.primary }}>Back</Button>
        </View>
      )}
      {tab === 2 && (
        <View style={styles.tabContent}>
          <PaperTextInput
            mode="outlined"
            label="Password"
            value={formData.password}
            onChangeText={v => setFormData(f => ({ ...f, password: v }))}
            secureTextEntry={!showPassword}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!error && error.toLowerCase().includes('password') && !error.toLowerCase().includes('confirm')}
            theme={{ colors: { primary: theme.colors.primary } }}
            right={<PaperTextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(v => !v)} />}
          />
          <PaperTextInput
            mode="outlined"
            label="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={v => setFormData(f => ({ ...f, confirmPassword: v }))}
            secureTextEntry={!showConfirmPassword}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!error && error.toLowerCase().includes('confirm')}
            theme={{ colors: { primary: theme.colors.primary } }}
            right={<PaperTextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword(v => !v)} />}
          />
          <Button mode="contained" onPress={handleRegister} style={[styles.button, { backgroundColor: theme.colors.primary }]} labelStyle={{ color: '#fff' }}>Register</Button>
          <Button mode="text" onPress={handleBack} style={[styles.button, { backgroundColor: 'transparent' }]} labelStyle={{ color: theme.colors.primary }}>Back</Button>
        </View>
      )}
      <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.link} labelStyle={{ color: theme.colors.text.light }}>
        <Text style={{ color: theme.colors.text.light }}>Already have an account? </Text>
        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Signin</Text>
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
  tabHeaderContainer: {
    flexDirection: 'row',
    marginBottom: 5,
    alignSelf: 'center',
  },
  tabHeaderContainerOuter: {
    width: 320,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  tabHeaderPillBg: {
    flexDirection: 'row',
    borderRadius: 32,
    padding: 4,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabHeaderPill: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  tabHeaderPillActive: {
    backgroundColor: theme.colors.primary,
  },
  tabHeaderText: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabHeaderTextActive: {
    color: '#fff',
    fontWeight: 'bold',
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
  tabContent: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  radioGroup: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
    width: 280,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  radioLabel: {
    fontSize: theme.typography.body.fontSize,
    marginBottom: 4,
    color: theme.colors.primary,
  },
  radioText: {
    fontSize: theme.typography.body.fontSize,
    marginRight: 16,
    color: theme.colors.primary,
  },
});

export default RegisterScreen;
