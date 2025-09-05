import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';

interface AccountData {
  userEmail: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const AccountSettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  
  const [accountData, setAccountData] = useState<AccountData>({
    userEmail: 'user@example.com',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [editEmail, setEditEmail] = useState(false);

  const handleInputChange = (field: keyof AccountData, value: string) => {
    setAccountData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditEmail = () => {
    setEditEmail(!editEmail);
  };

  const handleSubmit = () => {
    if (accountData.newPassword && accountData.newPassword.length < 6) {
      showError('New password must be at least 6 characters long');
      return;
    }

    if (accountData.newPassword !== accountData.confirmPassword) {
      showError('New password and confirm password do not match');
      return;
    }

    if (accountData.newPassword && !accountData.currentPassword) {
      showError('Current password is required to change password');
      return;
    }

    showSuccess('Account settings updated successfully!');
    
    setAccountData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }));
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showSuccess('Your account has been deleted successfully.');
          },
        },
      ]
    );
  };

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    secureTextEntry: boolean = false,
    editable: boolean = true,
    icon?: string
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: themeColors.text.primary }]}>
        {label}
      </Text>
      <View style={[styles.inputWrapper, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
        {icon && (
          <Icon 
            name={icon} 
            size={20} 
            color={themeColors.gray[400]} 
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[
            styles.textInput,
            { 
              color: themeColors.text.primary,
              paddingLeft: icon ? 40 : 16,
            }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.gray[400]}
          secureTextEntry={secureTextEntry}
          editable={editable}
        />
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Account Settings
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Manage your account information and security
        </Text>
      </View>

      {/* Email Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Email Settings
        </Text>
        
        <View style={styles.emailContainer}>
          {renderInputField(
            'Email Address',
            accountData.userEmail,
            (text) => handleInputChange('userEmail', text),
            'Enter email address',
            false,
            editEmail,
            'email'
          )}
          
          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: editEmail ? themeColors.status.error : themeColors.secondary }]} 
            onPress={handleEditEmail}
          >
            <Icon name={editEmail ? 'close' : 'edit'} size={16} color={themeColors.text.inverse} />
            <Text style={[styles.editButtonText, { color: themeColors.text.inverse }]}>
              {editEmail ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Password Change */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Change Password
        </Text>
        
        {renderInputField(
          'Current Password',
          accountData.currentPassword,
          (text) => handleInputChange('currentPassword', text),
          'Enter current password',
          true,
          true,
          'lock'
        )}
        
        {renderInputField(
          'New Password',
          accountData.newPassword,
          (text) => handleInputChange('newPassword', text),
          'Enter new password',
          true,
          true,
          'lock-outline'
        )}
        
        {renderInputField(
          'Confirm New Password',
          accountData.confirmPassword,
          (text) => handleInputChange('confirmPassword', text),
          'Confirm new password',
          true,
          true,
          'lock-outline'
        )}
      </View>

      {/* Security Info */}
      <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
        <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
          Password Requirements
        </Text>
        <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
          • Minimum 6 characters{'\n'}
          • Include letters and numbers for better security{'\n'}
          • Avoid using personal information{'\n'}
          • Change your password regularly
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.primary }]} onPress={handleSubmit}>
          <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Save Changes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.deleteButton, { backgroundColor: themeColors.status.error }]} onPress={handleDeleteAccount}>
          <Icon name="delete-forever" size={20} color={themeColors.text.inverse} />
          <Text style={[styles.deleteButtonText, { color: themeColors.text.inverse }]}>Delete My Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    fontSize: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AccountSettings;
