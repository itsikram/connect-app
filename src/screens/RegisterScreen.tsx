import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TextInput as PaperTextInput, Button, RadioButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Logo from '../components/Logo';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI } from '../lib/api';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../contexts/AuthContext';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

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
    const errors = validateTab();
    const firstError = getFirstError(errors);
    
    if (firstError) { 
      setError(firstError);
      setFieldErrors(errors);
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
    <View style={[styles.container, { backgroundColor: themeColors.surface.primary }]}>
      <Logo size="large" />
      <Text style={[styles.title, { color: themeColors.primary }]}>Register</Text>
      {/* Tab headers - fixed width, centered, pill/rounded style */}
      <View style={styles.tabHeaderContainerOuter}>
        <View style={[styles.tabHeaderContainer, { backgroundColor: bottomBarBg }]}>
          {TABS.map((t, idx) => {
            const isActive = tab === idx;
            const isCompleted = isTabCompleted(idx);
            const pillStyle = [
              styles.tabHeaderPill,
              isActive && [styles.tabHeaderPillActive, { backgroundColor: themeColors.primary }],
              !isActive && isCompleted && [styles.tabHeaderPillCompleted, { backgroundColor: '#4CAF50' }]
            ];
            const textStyle = [
              styles.tabHeaderText, 
              { color: themeColors.primary }, 
              (isActive || isCompleted) && styles.tabHeaderTextActive, 
              (isActive || isCompleted) && { color: '#fff' }
            ];
            
            return (
              <TouchableOpacity
                key={t.key}
                style={pillStyle}
                onPress={() => handleTabPress(idx)}
                activeOpacity={0.8}
              >
                <Text style={textStyle}>
                  {isCompleted && !isActive ? '✓ ' : ''}{t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
            onChangeText={v => handleFieldChange('firstName', v)}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!fieldErrors.firstName}
            theme={{ colors: { primary: themeColors.primary } }}
            autoCapitalize="words"
          />
          {fieldErrors.firstName && (
            <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>
          )}
          
          <PaperTextInput
            mode="outlined"
            label="Surname"
            value={formData.surname}
            onChangeText={v => handleFieldChange('surname', v)}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!fieldErrors.surname}
            theme={{ colors: { primary: themeColors.primary } }}
            autoCapitalize="words"
          />
          {fieldErrors.surname && (
            <Text style={styles.fieldError}>{fieldErrors.surname}</Text>
          )}
          
          <Button 
            mode="contained" 
            onPress={handleNext} 
            style={[styles.button, { backgroundColor: themeColors.primary }]} 
            labelStyle={{ color: '#fff' }}
          >
            <Text style={{ color: '#fff' }}>Next</Text>
          </Button>
        </View>
      )}
      {tab === 1 && (
        <View style={styles.tabContent}>
          <PaperTextInput
            mode="outlined"
            label="Email Address"
            value={formData.email}
            onChangeText={v => handleFieldChange('email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!fieldErrors.email}
            theme={{ colors: { primary: themeColors.primary } }}
          />
          {fieldErrors.email && (
            <Text style={styles.fieldError}>{fieldErrors.email}</Text>
          )}
          
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[
              styles.datePickerButton, 
              { 
                backgroundColor: bottomBarBg, 
                borderColor: fieldErrors.DOB ? '#ff0000' : themeColors.primary,
                borderWidth: fieldErrors.DOB ? 2 : 1
              }
            ]}
          >
            <Text style={[
              styles.datePickerText, 
              { color: formData.DOB ? themeColors.text.primary : themeColors.text.secondary }
            ]}>
              {formData.DOB ? formData.DOB.toLocaleDateString() : 'Select Date of Birth'}
            </Text>
          </TouchableOpacity>
          {fieldErrors.DOB && (
            <Text style={styles.fieldError}>{fieldErrors.DOB}</Text>
          )}
          
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
            <Text style={[styles.radioLabel, { color: themeColors.text.primary }]}>Gender:</Text>
            <RadioButton.Group
              onValueChange={v => handleFieldChange('gender', v)}
              value={formData.gender}
            >
              <View style={styles.radioRow}>
                <View style={styles.radioOption}>
                  <RadioButton value="male" />
                  <Text style={[styles.radioText, { color: themeColors.text.secondary }]}>Male</Text>
                </View>
                <View style={styles.radioOption}>
                  <RadioButton value="female" />
                  <Text style={[styles.radioText, { color: themeColors.text.secondary }]}>Female</Text>
                </View>
                <View style={styles.radioOption}>
                  <RadioButton value="other" />
                  <Text style={[styles.radioText, { color: themeColors.text.secondary }]}>Other</Text>
                </View>
              </View>
            </RadioButton.Group>
          </View>
          {fieldErrors.gender && (
            <Text style={styles.fieldError}>{fieldErrors.gender}</Text>
          )}
          
          <Button 
            mode="contained" 
            onPress={handleNext} 
            style={[styles.button, { backgroundColor: themeColors.primary }]} 
            labelStyle={{ color: '#fff' }}
          >
            <Text style={{ color: '#fff' }}>Next</Text>
          </Button>
          <Button 
            mode="text" 
            onPress={handleBack} 
            style={[styles.button, { backgroundColor: 'transparent' }]} 
            labelStyle={{ color: themeColors.primary }}
          >
            <Text style={{ color: themeColors.primary }}>Back</Text>
          </Button>
        </View>
      )}
      {tab === 2 && (
        <View style={styles.tabContent}>
          <PaperTextInput
            mode="outlined"
            label="Password"
            value={formData.password}
            onChangeText={v => handleFieldChange('password', v)}
            secureTextEntry={!showPassword}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!fieldErrors.password}
            theme={{ colors: { primary: themeColors.primary } }}
            right={<PaperTextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(v => !v)} />}
          />
          {fieldErrors.password && (
            <Text style={styles.fieldError}>{fieldErrors.password}</Text>
          )}
          
          <PaperTextInput
            mode="outlined"
            label="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={v => handleFieldChange('confirmPassword', v)}
            secureTextEntry={!showConfirmPassword}
            style={[styles.input, { backgroundColor: bottomBarBg }]}
            error={!!fieldErrors.confirmPassword}
            theme={{ colors: { primary: themeColors.primary } }}
            right={<PaperTextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword(v => !v)} />}
          />
          {fieldErrors.confirmPassword && (
            <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
          )}
          
          {/* Password strength indicator */}
          {formData.password && (
            <View style={styles.passwordStrength}>
              <Text style={[styles.passwordStrengthTitle, { color: themeColors.text.secondary }]}>
                Password Requirements:
              </Text>
              <View style={styles.passwordRequirements}>
                <Text style={[
                  styles.passwordRequirement, 
                  { color: formData.password.length >= 8 ? '#4CAF50' : themeColors.text.secondary }
                ]}>
                  ✓ At least 8 characters
                </Text>
                <Text style={[
                  styles.passwordRequirement, 
                  { color: /[A-Za-z]/.test(formData.password) ? '#4CAF50' : themeColors.text.secondary }
                ]}>
                  ✓ Contains letters
                </Text>
                <Text style={[
                  styles.passwordRequirement, 
                  { color: /[0-9]/.test(formData.password) ? '#4CAF50' : themeColors.text.secondary }
                ]}>
                  ✓ Contains numbers
                </Text>
                <Text style={[
                  styles.passwordRequirement, 
                  { color: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? '#4CAF50' : themeColors.text.secondary }
                ]}>
                  ✓ Contains special characters
                </Text>
              </View>
            </View>
          )}
          
          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: themeColors.text.secondary }]} />
            <Text style={[styles.dividerText, { color: themeColors.text.secondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: themeColors.text.secondary }]} />
          </View>
          
          {/* Google Sign-In Button - Temporarily disabled for debugging */}
          
          {/* <GoogleSigninButton
            style={styles.googleButton}
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={handleGoogleSignIn}
          /> */}
         
          
          <Button 
            mode="contained" 
            onPress={handleRegister} 
            loading={isLoading}
            disabled={isLoading}
            style={[styles.button, { backgroundColor: themeColors.primary, opacity: isLoading ? 0.7 : 1 }]} 
            labelStyle={{ color: '#fff' }}
          >
            <Text style={{ color: '#fff' }}>
              {isLoading ? 'Creating Account...' : 'Register'}
            </Text>
          </Button>
          <Button 
            mode="text" 
            onPress={handleBack} 
            disabled={isLoading}
            style={[styles.button, { backgroundColor: 'transparent' }]} 
            labelStyle={{ color: themeColors.primary }}
          >
            <Text style={{ color: themeColors.primary }}>Back</Text>
          </Button>
        </View>
      )}
      <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.link} labelStyle={{ color: themeColors.text.secondary }}>
        <Text style={{ color: themeColors.text.secondary }}>Already have an account? </Text>
        <Text style={{ color: themeColors.primary, fontWeight: 'bold' }}>Signin</Text>
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
  tabHeaderContainerOuter: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 32,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabHeaderPill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 28,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabHeaderPillActive: {
    backgroundColor: '#29b1a9',
  },
  tabHeaderPillCompleted: {
    backgroundColor: '#4CAF50',
  },
  tabHeaderText: {
    color: '#29b1a9',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabHeaderTextActive: {
    color: '#fff',
  },
  tabContent: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: 280,
    marginBottom: 8,
  },
  button: {
    width: 280,
    marginBottom: 12,
    alignSelf: 'center',
    backgroundColor: '#29b1a9',
  },
  link: {
    color: '#29b1a9',
    fontSize: 14,
    marginTop: 16,
    alignSelf: 'center',
  },
  error: {
    color: '#ff0000',
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  fieldError: {
    color: '#ff0000',
    fontSize: 12,
    marginBottom: 16,
    marginTop: -4,
    width: 280,
    textAlign: 'left',
  },
  datePickerButton: {
    width: 280,
    minHeight: 56,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  datePickerText: {
    fontSize: 16,
  },
  radioGroup: {
    width: 280,
    marginBottom: 8,
  },
  radioGroupError: {
    borderColor: '#ff0000',
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: '500',
  },
  radioText: {
    fontSize: 14,
    marginLeft: 4,
  },
  passwordStrength: {
    width: 280,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  passwordStrengthTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordRequirements: {
    gap: 4,
  },
  passwordRequirement: {
    fontSize: 12,
    fontWeight: '500',
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
});

export default RegisterScreen;
