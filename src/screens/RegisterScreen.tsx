import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TextInput as PaperTextInput, Button, RadioButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Logo from '../components/Logo';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI } from '../lib/api';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../contexts/AuthContext';
import KeyboardSafeView from '../components/KeyboardSafeView';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { colors: themeColors } = useTheme();
  const bottomBarBg = themeColors.surface.secondary;
  const panelBg = themeColors.surface.elevated || themeColors.surface.primary;
  const { googleSignIn } = useContext(AuthContext);

  // Individual field validation
  const validateField = (fieldName: string, value: any) => {
    switch (fieldName) {
      case 'firstName':
        if (!value) return 'First Name is required';
        if (!/^[A-Za-z\s]+$/.test(value)) return 'First Name must contain only letters';
        if (value.length < 2) return 'First Name must be at least 2 characters';
        return '';
      case 'surname':
        if (!value) return 'Surname is required';
        if (!/^[A-Za-z\s]+$/.test(value)) return 'Surname must contain only letters';
        if (value.length < 2) return 'Surname must be at least 2 characters';
        return '';
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Invalid email address';
        return '';
      case 'DOB':
        if (!value) return 'Date of Birth is required';
        const now = new Date();
        const minAge = 13;
        const birthDate = new Date(value);
        const currentYear = now.getFullYear();
        const birthYear = birthDate.getFullYear();
        
        // Calculate age properly without mutating the original date
        let age = currentYear - birthYear;
        const currentMonth = now.getMonth();
        const birthMonth = birthDate.getMonth();
        
        // Adjust age if birthday hasn't occurred this year
        if (currentMonth < birthMonth || (currentMonth === birthMonth && now.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < minAge) return 'You must be at least 13 years old';
        return '';
      case 'gender':
        if (!value) return 'Gender is required';
        if (!['male', 'female', 'other'].includes(value)) return 'Invalid gender selected';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Za-z]/.test(value)) return 'Password must contain at least one letter';
        if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) return 'Password must contain at least one special character';
        return '';
      case 'confirmPassword':
        if (!value) return 'Confirm Password is required';
        if (value !== formData.password) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  };

  // Validation per tab
  const validateTab = (tabIndex: number = tab) => {
    const errors: Record<string, string> = {};
    
    if (tabIndex === 0) {
      const firstNameError = validateField('firstName', formData.firstName);
      const surnameError = validateField('surname', formData.surname);
      if (firstNameError) errors.firstName = firstNameError;
      if (surnameError) errors.surname = surnameError;
    }
    if (tabIndex === 1) {
      const emailError = validateField('email', formData.email);
      const dobError = validateField('DOB', formData.DOB);
      const genderError = validateField('gender', formData.gender);
      if (emailError) errors.email = emailError;
      if (dobError) errors.DOB = dobError;
      if (genderError) errors.gender = genderError;
    }
    if (tabIndex === 2) {
      const passwordError = validateField('password', formData.password);
      const confirmPasswordError = validateField('confirmPassword', formData.confirmPassword);
      if (passwordError) errors.password = passwordError;
      if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;
    }
    
    return errors;
  };

  // Get first error message from validation errors
  const getFirstError = (errors: Record<string, string>) => {
    const errorKeys = Object.keys(errors);
    return errorKeys.length > 0 ? errors[errorKeys[0]] : '';
  };

  // Check if tab is completed (valid)
  const isTabCompleted = (tabIndex: number) => {
    const errors = validateTab(tabIndex);
    return Object.keys(errors).length === 0;
  };

  const handleTabPress = (idx: number) => {
    setError('');
    setFieldErrors({});
    setTab(idx);
  };

  const handleNext = () => {
    const currentTabErrors = validateTab();
    const firstError = getFirstError(currentTabErrors);

    if (firstError) {
      setError(firstError);
      setFieldErrors(currentTabErrors);
      return;
    }

    if (tab === 0 && (!formData.firstName.trim() || !formData.surname.trim())) {
      const forcedErrors = {
        firstName: formData.firstName.trim() ? '' : 'First Name is required',
        surname: formData.surname.trim() ? '' : 'Surname is required',
      };
      const nextError = getFirstError(Object.fromEntries(Object.entries(forcedErrors).filter(([, value]) => value)));
      setError(nextError || 'Please complete the first step before continuing.');
      setFieldErrors({
        ...(formData.firstName.trim() ? {} : { firstName: 'First Name is required' }),
        ...(formData.surname.trim() ? {} : { surname: 'Surname is required' }),
      });
      return;
    }

    setError('');
    setFieldErrors({});
    setTab(tab + 1);
  };

  const handleBack = () => {
    setError('');
    setFieldErrors({});
    setTab(tab - 1);
  };

  // Real-time field validation
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(f => ({ ...f, [fieldName]: value }));
    
    // Clear field error when user starts typing
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
    
    // Clear general error if it exists
    if (error) {
      setError('');
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    
    // Validate all tabs
    let allErrors: Record<string, string> = {};
    let firstInvalidTab = -1;
    
    for (let i = 0; i < TABS.length; i++) {
      const tabErrors = validateTab(i);
      allErrors = { ...allErrors, ...tabErrors };
      
      if (Object.keys(tabErrors).length > 0 && firstInvalidTab === -1) {
        firstInvalidTab = i;
      }
    }
    
    if (Object.keys(allErrors).length > 0) {
      const firstError = getFirstError(allErrors);
      setError(firstError);
      setFieldErrors(allErrors);
      setTab(firstInvalidTab); // Navigate to first invalid tab
      setIsLoading(false);
      return;
    }
    
    setError('');
    setFieldErrors({});
    
    try {
      const body = {
        firstName: formData.firstName.trim(),
        surname: formData.surname.trim(),
        email: formData.email.toLowerCase().trim(),
        DOB: formData.DOB,
        gender: formData.gender,
        password: formData.password,
      };
      
      let signupResponse = await authAPI.signup(body);
      console.log('Registration successful!', signupResponse);
      
      if (signupResponse?.status === 201) {
        Toast.show({
          type: 'success',
          text1: 'Account created successfully!',
          text2: 'Please sign in with your new account'
        });
        navigation.navigate('Login');
      }
    } catch (e) {
      const err = e as any;
      let errorMsg = err?.response?.data?.message || err?.message || 'Registration failed. Please try again.';
      
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: errorMsg
      });
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
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
    <KeyboardSafeView nested>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.container, { backgroundColor: themeColors.background.primary }]}
      >
        <View style={[styles.shell, { backgroundColor: themeColors.background.primary }]}>
          <View style={[styles.glow, { backgroundColor: `${themeColors.primary}26` }]} />
          <View style={[styles.glowSecondary, { backgroundColor: `${themeColors.secondary}22` }]} />

          <View style={[styles.card, { backgroundColor: panelBg, borderColor: themeColors.border.primary }]}>
            <View style={styles.topSection}>
              <View style={[styles.brandWrap, { backgroundColor: `${themeColors.primary}18`, borderColor: `${themeColors.primary}44` }]}>
                <Logo size="large" />
              </View>
              <Text style={[styles.eyebrow, { color: themeColors.primary }]}>Welcome aboard</Text>
              <Text style={[styles.title, { color: themeColors.text.primary }]}>Create your account</Text>
              <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
                Join in a few steps and get started with your profile.
              </Text>
            </View>

            <View style={[styles.tabHeaderContainerOuter]}>
              <View style={[styles.tabHeaderContainer, { backgroundColor: bottomBarBg, borderColor: themeColors.border.primary }]}>
                {TABS.map((t, idx) => {
                  const isActive = tab === idx;
                  const isCompleted = isTabCompleted(idx);
                  const pillStyle = [
                    styles.tabHeaderPill,
                    isActive && [styles.tabHeaderPillActive, { backgroundColor: themeColors.primary }],
                    !isActive && isCompleted && [styles.tabHeaderPillCompleted, { backgroundColor: themeColors.status.success }],
                  ];
                  const textStyle = [
                    styles.tabHeaderText,
                    { color: isActive ? '#fff' : themeColors.text.secondary },
                    (isActive || isCompleted) && styles.tabHeaderTextActive,
                  ];

                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={pillStyle}
                      onPress={() => handleTabPress(idx)}
                      activeOpacity={0.8}
                    >
                      <Text style={textStyle}>
                        {isCompleted && !isActive ? '✓ ' : ''}
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {error ? <Text style={[styles.error, { color: themeColors.status.error }]}>{error}</Text> : null}

            {tab === 0 && (
              <View style={styles.tabContent}>
                <PaperTextInput
                  mode="outlined"
                  label="First Name"
                  value={formData.firstName}
                  onChangeText={(v) => handleFieldChange('firstName', v)}
                  style={[styles.input, { backgroundColor: bottomBarBg }]}
                  textColor={themeColors.text.primary}
                  error={!!fieldErrors.firstName}
                  theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
                  autoCapitalize="words"
                />
                {fieldErrors.firstName && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.firstName}</Text>}

                <PaperTextInput
                  mode="outlined"
                  label="Surname"
                  value={formData.surname}
                  onChangeText={(v) => handleFieldChange('surname', v)}
                  style={[styles.input, { backgroundColor: bottomBarBg }]}
                  textColor={themeColors.text.primary}
                  error={!!fieldErrors.surname}
                  theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
                  autoCapitalize="words"
                />
                {fieldErrors.surname && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.surname}</Text>}

                <Button
                  mode="contained"
                  onPress={handleNext}
                  style={[styles.button, { backgroundColor: themeColors.primary }]}
                  labelStyle={{ color: '#fff' }}
                >
                  <Text style={styles.buttonText}>Next</Text>
                </Button>
              </View>
            )}

            {tab === 1 && (
              <View style={styles.tabContent}>
                <PaperTextInput
                  mode="outlined"
                  label="Email Address"
                  value={formData.email}
                  onChangeText={(v) => handleFieldChange('email', v)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { backgroundColor: bottomBarBg }]}
                  textColor={themeColors.text.primary}
                  error={!!fieldErrors.email}
                  theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
                />
                {fieldErrors.email && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.email}</Text>}

                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[
                    styles.datePickerButton,
                    {
                      backgroundColor: bottomBarBg,
                      borderColor: fieldErrors.DOB ? themeColors.status.error : themeColors.border.primary,
                      borderWidth: fieldErrors.DOB ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.datePickerText, { color: formData.DOB ? themeColors.text.primary : themeColors.text.secondary }]}>
                    {formData.DOB ? formData.DOB.toLocaleDateString() : 'Select Date of Birth'}
                  </Text>
                </TouchableOpacity>
                {fieldErrors.DOB && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.DOB}</Text>}

                {showDatePicker && (
                  <DateTimePicker
                    value={formData.DOB || new Date(2000, 0, 1)}
                    mode="date"
                    display="default"
                    onChange={(_, date) => {
                      setShowDatePicker(false);
                      if (date) handleFieldChange('DOB', date);
                    }}
                    maximumDate={new Date()}
                  />
                )}

                <View style={[styles.radioGroup, fieldErrors.gender && styles.radioGroupError]}>
                  <Text style={[styles.radioLabel, { color: themeColors.text.primary }]}>Gender</Text>
                  <RadioButton.Group onValueChange={(v) => handleFieldChange('gender', v)} value={formData.gender}>
                    <View style={styles.radioRow}>
                      <View style={styles.radioOption}>
                        <RadioButton value="male" color={themeColors.primary} uncheckedColor={themeColors.border.primary} />
                        <Text style={[styles.radioText, { color: themeColors.text.secondary }]}>Male</Text>
                      </View>
                      <View style={styles.radioOption}>
                        <RadioButton value="female" color={themeColors.primary} uncheckedColor={themeColors.border.primary} />
                        <Text style={[styles.radioText, { color: themeColors.text.secondary }]}>Female</Text>
                      </View>
                      <View style={styles.radioOption}>
                        <RadioButton value="other" color={themeColors.primary} uncheckedColor={themeColors.border.primary} />
                        <Text style={[styles.radioText, { color: themeColors.text.secondary }]}>Other</Text>
                      </View>
                    </View>
                  </RadioButton.Group>
                </View>
                {fieldErrors.gender && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.gender}</Text>}

                <View style={styles.actionRow}>
                  <Button mode="text" onPress={handleBack} style={[styles.secondaryButton, { backgroundColor: 'transparent' }]} labelStyle={{ color: themeColors.primary }}>
                    <Text style={{ color: themeColors.primary }}>Back</Text>
                  </Button>
                  <Button mode="contained" onPress={handleNext} style={[styles.primaryButton, { backgroundColor: themeColors.primary }]} labelStyle={{ color: '#fff' }}>
                    <Text style={styles.buttonText}>Next</Text>
                  </Button>
                </View>
              </View>
            )}

            {tab === 2 && (
              <View style={styles.tabContent}>
                <PaperTextInput
                  mode="outlined"
                  label="Password"
                  value={formData.password}
                  onChangeText={(v) => handleFieldChange('password', v)}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { backgroundColor: bottomBarBg }]}
                  textColor={themeColors.text.primary}
                  error={!!fieldErrors.password}
                  theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
                  right={<PaperTextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword((v) => !v)} />}
                />
                {fieldErrors.password && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.password}</Text>}

                <PaperTextInput
                  mode="outlined"
                  label="Confirm Password"
                  value={formData.confirmPassword}
                  onChangeText={(v) => handleFieldChange('confirmPassword', v)}
                  secureTextEntry={!showConfirmPassword}
                  style={[styles.input, { backgroundColor: bottomBarBg }]}
                  textColor={themeColors.text.primary}
                  error={!!fieldErrors.confirmPassword}
                  theme={{ colors: { primary: themeColors.primary, text: themeColors.text.primary, onSurface: themeColors.text.primary } }}
                  right={<PaperTextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword((v) => !v)} />}
                />
                {fieldErrors.confirmPassword && <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.confirmPassword}</Text>}

                {formData.password && (
                  <View style={[styles.passwordStrength, { backgroundColor: `${themeColors.primary}08`, borderColor: `${themeColors.primary}22` }]}>
                    <Text style={[styles.passwordStrengthTitle, { color: themeColors.text.primary }]}>Password Requirements</Text>
                    <View style={styles.passwordRequirements}>
                      <Text style={[styles.passwordRequirement, { color: formData.password.length >= 8 ? themeColors.status.success : themeColors.text.secondary }]}>
                        ✓ At least 8 characters
                      </Text>
                      <Text style={[styles.passwordRequirement, { color: /[A-Za-z]/.test(formData.password) ? themeColors.status.success : themeColors.text.secondary }]}>
                        ✓ Contains letters
                      </Text>
                      <Text style={[styles.passwordRequirement, { color: /[0-9]/.test(formData.password) ? themeColors.status.success : themeColors.text.secondary }]}>
                        ✓ Contains numbers
                      </Text>
                      <Text style={[styles.passwordRequirement, { color: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? themeColors.status.success : themeColors.text.secondary }]}>
                        ✓ Contains special characters
                      </Text>
                    </View>
                  </View>
                )}

                <View style={[styles.divider, !formData.password && styles.dividerCompact]}>
                 <View style={[styles.dividerLine, { backgroundColor: themeColors.border.primary }]} />
                 <Text style={[styles.dividerText, { color: themeColors.text.secondary }]}>OR</Text>
                 <View style={[styles.dividerLine, { backgroundColor: themeColors.border.primary }]} />
                </View>

                <Button
                  mode="contained"
                  onPress={handleRegister}
                  loading={isLoading}
                  disabled={isLoading}
                  style={[styles.button, { backgroundColor: themeColors.primary, opacity: isLoading ? 0.7 : 1 }]}
                  labelStyle={{ color: '#fff' }}
                >
                  <Text style={styles.buttonText}>{isLoading ? 'Creating Account...' : 'Create account'}</Text>
                </Button>

                <Button mode="text" onPress={handleBack} disabled={isLoading} style={[styles.secondaryButton, { backgroundColor: 'transparent' }]} labelStyle={{ color: themeColors.primary }}>
                  <Text style={{ color: themeColors.primary }}>Back</Text>
                </Button>
              </View>
            )}

            <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.link} labelStyle={{ color: themeColors.text.secondary }}>
              <Text style={{ color: themeColors.text.secondary }}>Already have an account? </Text>
              <Text style={{ color: themeColors.primary, fontWeight: '700' }}>Sign in</Text>
            </Button>
            <Toast />
          </View>
        </View>
      </ScrollView>
    </KeyboardSafeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  shell: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    minHeight: '100%',
    paddingTop: 4,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: '12%',
    left: '-8%',
    opacity: 0.9,
  },
  glowSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: '-8%',
    bottom: '18%',
    opacity: 0.9,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  brandWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  tabHeaderContainerOuter: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  tabHeaderContainer: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabHeaderPill: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 14,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabHeaderPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  tabHeaderPillCompleted: {
    opacity: 0.9,
  },
  tabHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  tabHeaderTextActive: {
    color: '#fff',
  },
  tabContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  button: {
    width: '100%',
    marginTop: 8,
    borderRadius: 14,
    minHeight: 46,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    justifyContent: 'center',
  },
  secondaryButton: {
    minWidth: 84,
    minHeight: 46,
    borderRadius: 14,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  link: {
    marginTop: 18,
    alignSelf: 'center',
  },
  error: {
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  fieldError: {
    fontSize: 12,
    marginBottom: 10,
    marginTop: -2,
    width: '100%',
    textAlign: 'left',
    fontWeight: '500',
  },
  datePickerButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  datePickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  radioGroup: {
    width: '100%',
    marginBottom: 8,
    paddingVertical: 8,
  },
  radioGroupError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 28,
  },
  radioLabel: {
    fontSize: 15,
    marginBottom: 4,
    fontWeight: '600',
  },
  radioText: {
    fontSize: 14,
    marginLeft: 2,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  passwordStrength: {
    width: '100%',
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordStrengthTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  passwordRequirements: {
    gap: 3,
  },
  passwordRequirement: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  dividerCompact: {
    marginTop: 6,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  googleButton: {
    width: '100%',
    height: 48,
    marginBottom: 12,
  },
});

export default RegisterScreen;
