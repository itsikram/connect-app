import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, ImageBackground, Image, TextInput, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Logo from '../components/Logo';
import { useTheme } from '../contexts/ThemeContext';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../contexts/AuthContext';
import KeyboardSafeView from '../components/KeyboardSafeView';
import Icon from 'react-native-vector-icons/Ionicons';

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'contact', label: 'Contact' },
  { key: 'security', label: 'Security' },
];

type RootStackParamList = {
  Home: undefined;
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
  const { colors: themeColors, isDarkMode } = useTheme();
  const { googleSignIn, register } = useContext(AuthContext);

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
      
      const result = await register(body);

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Account created successfully!',
          text2: 'Welcome to Connect',
        });
      } else {
        const errorMsg = result.error || 'Registration failed. Please try again.';
        setError(errorMsg);
        Toast.show({
          type: 'error',
          text1: 'Registration Failed',
          text2: errorMsg,
        });
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

  const fieldStyle = (field: string) => [
    styles.input,
    { backgroundColor: isDarkMode ? 'rgba(10,10,11,0.72)' : 'rgba(255,255,255,0.42)', borderColor: fieldErrors[field] ? themeColors.status.error : themeColors.border.secondary },
  ];
  const textInputStyle = { color: themeColors.text.primary };

  return (
    <KeyboardSafeView>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <ImageBackground
        source={isDarkMode ? require('../assets/images/login-registrasion-bg-dark.png') : require('../assets/images/login-registrasion-bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.container}>
          <View style={styles.content}>
            <Logo size="xlarge" />
            <Text style={[styles.title, { color: themeColors.text.primary }]}>Create Your <Text style={{ color: themeColors.primary }}>Account</Text></Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>Join our community and start connecting{'\n'}with amazing people.</Text>

            <View style={[styles.tabs, { backgroundColor: isDarkMode ? 'rgba(30,31,32,0.78)' : 'rgba(255,255,255,0.6)' }]}>
              {TABS.map((item, index) => (
                <TouchableOpacity key={item.key} onPress={() => handleTabPress(index)} style={[styles.tab, tab === index && { backgroundColor: themeColors.primary }]} activeOpacity={0.85}>
                  <Text style={[styles.tabText, { color: tab === index ? themeColors.text.inverse : themeColors.text.secondary }]}>{index + 1}. {item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={[styles.error, { color: themeColors.status.error }]}>{error}</Text> : null}
            {tab === 0 && (
              <View style={styles.tabContent}>
                <View style={styles.row}>
                  {(['firstName', 'surname'] as const).map((field) => (
                    <View key={field} style={[fieldStyle(field), styles.halfInput]}>
                      <Icon name="person-outline" size={24} color={themeColors.primary} />
                      <TextInput value={formData[field]} onChangeText={(value) => handleFieldChange(field, value)} autoCapitalize="words" placeholder={field === 'firstName' ? 'First name' : 'Surname'} placeholderTextColor={themeColors.text.tertiary} style={[styles.nativeInput, textInputStyle]} />
                    </View>
                  ))}
                </View>
                <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.firstName || fieldErrors.surname || ' '}</Text>
                <TouchableOpacity onPress={handleNext} style={[styles.actionButton, { backgroundColor: themeColors.primary }]}><Text style={[styles.actionText, { color: themeColors.text.inverse }]}>Next Step  →</Text></TouchableOpacity>
              </View>
            )}
            {tab === 1 && (
              <View style={styles.tabContent}>
                <View style={fieldStyle('email')}><Icon name="mail-outline" size={24} color={themeColors.primary} /><TextInput value={formData.email} onChangeText={(value) => handleFieldChange('email', value)} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={themeColors.text.tertiary} style={[styles.nativeInput, textInputStyle]} /></View>
                <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.email || ' '}</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[
                    fieldStyle('DOB'),
                    {
                      backgroundColor: isDarkMode
                        ? 'rgba(10,10,11,0.72)'
                        : 'rgba(255,255,255,0.42)',
                    },
                  ]}
                >
                  <Icon name="calendar-outline" size={24} color={themeColors.primary} />
                  <Text
                    style={[
                      styles.dateText,
                      {
                        color: formData.DOB
                          ? themeColors.text.primary
                          : themeColors.text.tertiary,
                      },
                    ]}
                  >
                    {formData.DOB ? formData.DOB.toLocaleDateString() : 'Date of birth'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={formData.DOB || new Date(2000, 0, 1)}
                    mode="date"
                    display="default"
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    accentColor={themeColors.primary}
                    onChange={(_, date) => {
                      setShowDatePicker(false);
                      if (date) handleFieldChange('DOB', date);
                    }}
                    maximumDate={new Date()}
                  />
                )}
                <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.DOB || ' '}</Text>
                <View style={[styles.genderRow, fieldErrors.gender && { borderColor: themeColors.status.error }]}>
                  <Icon name="male-female-outline" size={24} color={themeColors.primary} />
                  {(['male', 'female', 'other'] as const).map((value) => <TouchableOpacity key={value} onPress={() => handleFieldChange('gender', value)} style={[styles.genderOption, formData.gender === value && { backgroundColor: `${themeColors.primary}22` }]}><Text style={{ color: themeColors.text.primary }}>{value[0].toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}
                </View>
                <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors.gender || ' '}</Text>
                <View style={styles.actionRow}><TouchableOpacity onPress={handleBack}><Text style={[styles.secondaryAction, { color: themeColors.primary }]}>← Back</Text></TouchableOpacity><TouchableOpacity onPress={handleNext} style={[styles.actionButton, styles.nextButton, { backgroundColor: themeColors.primary }]}><Text style={[styles.actionText, { color: themeColors.text.inverse }]}>Next Step  →</Text></TouchableOpacity></View>
              </View>
            )}
            {tab === 2 && (
              <View style={styles.tabContent}>
                {(['password', 'confirmPassword'] as const).map((field) => (
                  <React.Fragment key={field}>
                    <View style={fieldStyle(field)}><Icon name="lock-closed-outline" size={24} color={themeColors.primary} /><TextInput value={formData[field]} onChangeText={(value) => handleFieldChange(field, value)} secureTextEntry={field === 'password' ? !showPassword : !showConfirmPassword} placeholder={field === 'password' ? 'Password' : 'Confirm password'} placeholderTextColor={themeColors.text.tertiary} style={[styles.nativeInput, textInputStyle]} /><TouchableOpacity onPress={() => field === 'password' ? setShowPassword(value => !value) : setShowConfirmPassword(value => !value)}><Icon name={(field === 'password' ? showPassword : showConfirmPassword) ? 'eye-off-outline' : 'eye-outline'} size={26} color={themeColors.text.secondary} /></TouchableOpacity></View>
                    <Text style={[styles.fieldError, { color: themeColors.status.error }]}>{fieldErrors[field] || ' '}</Text>
                  </React.Fragment>
                ))}
                <View style={styles.actionRow}><TouchableOpacity onPress={handleBack} disabled={isLoading}><Text style={[styles.secondaryAction, { color: themeColors.primary }]}>← Back</Text></TouchableOpacity><TouchableOpacity onPress={handleRegister} disabled={isLoading} style={[styles.actionButton, styles.nextButton, { backgroundColor: themeColors.primary, opacity: isLoading ? 0.7 : 1 }]}>{isLoading ? <View style={styles.loadingContent}><ActivityIndicator size="small" color={themeColors.text.inverse} /><Text style={[styles.actionText, { color: themeColors.text.inverse }]}>Signing up...</Text></View> : <Text style={[styles.actionText, { color: themeColors.text.inverse }]}>Create Account  →</Text>}</TouchableOpacity></View>
              </View>
            )}

            <View style={styles.divider}><View style={[styles.dividerLine, { backgroundColor: themeColors.border.secondary }]} /><Text style={[styles.dividerText, { color: themeColors.text.secondary }]}>OR</Text><View style={[styles.dividerLine, { backgroundColor: themeColors.border.secondary }]} /></View>
            <TouchableOpacity onPress={handleGoogleSignIn} disabled={isLoading} style={[styles.googleButton, { borderColor: themeColors.border.secondary, backgroundColor: isDarkMode ? 'rgba(30,31,32,0.75)' : 'rgba(255,255,255,0.56)' }]}>
              <Image
                source={require('../assets/icons/google-logo.png')}
                style={styles.googleLogo}
                resizeMode="contain"
                accessibilityLabel="Google logo"
              />
              <Text style={[styles.googleText, { color: themeColors.text.primary }]}>Sign up with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading} style={styles.loginLink}><Text style={{ color: themeColors.text.secondary }}>Already have an account? </Text><Text style={{ color: themeColors.primary, fontWeight: '700' }}>Login</Text></TouchableOpacity>
            <Toast />
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardSafeView>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 650,
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  tabs: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 22,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabContent: {
    width: '100%',
  },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    width: '100%',
    height: 58,
    borderWidth: 2,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  halfInput: { flex: 1 },
  nativeInput: { flex: 1, fontSize: 16, marginLeft: 12, paddingVertical: 0 },
  dateText: { flex: 1, fontSize: 16, marginLeft: 12 },
  genderRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: 18, minHeight: 58, paddingHorizontal: 14, gap: 6 },
  genderOption: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12 },
  actionButton: { width: '100%', minHeight: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  nextButton: { flex: 1, marginTop: 0 },
  actionText: { fontSize: 17, fontWeight: '700' },
  secondaryAction: { fontSize: 16, fontWeight: '700', paddingHorizontal: 8 },
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
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  error: {
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  fieldError: {
    fontSize: 11,
    minHeight: 15,
    marginBottom: 3,
    width: '100%',
    textAlign: 'left',
    fontWeight: '500',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
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
    marginVertical: 16,
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
    height: 58,
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  googleLogo: { width: 28, height: 28, marginRight: 16 },
  googleText: { fontSize: 17, fontWeight: '700' },
  loginLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

export default RegisterScreen;
