import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateProfileField } from '../../reducers/profileReducer';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import api, { authAPI, clearTokenCache, userAPI } from '../../lib/api';
import {
  SettingsSectionHeader,
  SettingsField,
  SettingsInput,
  SettingsPrimaryButton,
  SettingsDangerButton,
  SettingsSecondaryButton,
} from './settingsUi';
import FaceCapture from '../FaceCapture';

const getProfileEmail = (profile: any) => {
  const user = profile?.user;
  if (!user || typeof user === 'string') return '';
  return user.email || '';
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const AccountSettings = () => {
  const { colors: themeColors } = useTheme();
  const { showSuccess, showError } = useToast();
  const dispatch = useDispatch();
  const { logout } = useContext(AuthContext);
  const currentProfile = useSelector((state: RootState) => state.profile);
  const currentEmail = getProfileEmail(currentProfile);
  const emailFetchAttempted = useRef(false);

  const [data, setData] = useState({
    userEmail: currentEmail,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [banglaName, setBanglaName] = useState(currentProfile?.banglaName || '');
  const [editEmail, setEditEmail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBangla, setIsSavingBangla] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);

  useEffect(() => {
    setBanglaName(currentProfile?.banglaName || '');
    if (!editEmail) {
      setData((prev) => ({ ...prev, userEmail: currentEmail }));
    }
  }, [currentProfile?.banglaName, currentEmail, editEmail]);

  useEffect(() => {
    if (currentEmail || !currentProfile?._id || emailFetchAttempted.current) return;
    emailFetchAttempted.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await userAPI.getProfile(currentProfile._id);
        const email = getProfileEmail(res.data);
        if (!cancelled && email) {
          dispatch(
            updateProfileField({
              field: 'user',
              value: {
                ...(typeof currentProfile.user === 'object' ? currentProfile.user : {}),
                ...(res.data?.user || {}),
              },
            })
          );
        }
      } catch (error) {
        console.error('Error loading account email:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentEmail, currentProfile?._id, dispatch]);

  const handleSaveBanglaName = async () => {
    const trimmedName = banglaName.trim();
    if (!trimmedName) {
      showError('Bengali name cannot be empty');
      return;
    }
    setIsSavingBangla(true);
    try {
      const res = await api.post('/profile/update/bangla-name', { banglaName: trimmedName });
      if (res.status === 200) {
        dispatch(updateProfileField({ field: 'banglaName', value: trimmedName }));
        showSuccess('Bengali name updated successfully');
      }
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update Bengali name');
    } finally {
      setIsSavingBangla(false);
    }
  };

  const handleFaceCapture = async (frames: string[]) => {
    setIsRegisteringFace(true);
    try {
      await authAPI.faceRegister({ frames });
      showSuccess('Face login registered successfully');
    } catch (error: any) {
      showError(
        error?.response?.data?.message ||
          'Could not register your face. Please blink naturally and try again.'
      );
    } finally {
      setIsRegisteringFace(false);
    }
  };

  const persistAuthPayload = async (payload: any, email?: string) => {
    if (!payload && !email) return;
    const stored = await AsyncStorage.getItem('user');
    const userData = stored ? JSON.parse(stored) : {};
    const savedEmail = email || payload?.email || userData.email;
    const nextProfile =
      payload?.profile && typeof payload.profile === 'object' && payload.profile._id
        ? payload.profile
        : userData.profile;
    const profileWithEmail =
      nextProfile && typeof nextProfile === 'object' && savedEmail
        ? {
            ...nextProfile,
            user: {
              ...(typeof nextProfile.user === 'object' ? nextProfile.user : {}),
              email: savedEmail,
            },
          }
        : nextProfile;

    const nextUser = {
      ...userData,
      firstName: payload?.firstName ?? userData.firstName,
      surname: payload?.surname ?? userData.surname,
      user_id: payload?.user_id ?? userData.user_id,
      profile: profileWithEmail,
      email: savedEmail,
    };
    const pairs: [string, string][] = [['user', JSON.stringify(nextUser)]];
    if (payload?.accessToken) {
      pairs.push(['authToken', payload.accessToken]);
      clearTokenCache();
    }
    await AsyncStorage.multiSet(pairs);
  };

  const applyEmailToProfile = (email: string) => {
    dispatch(
      updateProfileField({
        field: 'user',
        value: {
          ...(typeof currentProfile?.user === 'object' ? currentProfile.user : {}),
          email,
        },
      })
    );
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const nextEmail = String(data.userEmail || '').trim().toLowerCase();
      if (nextEmail && nextEmail !== currentEmail.toLowerCase()) {
        if (!isValidEmail(nextEmail)) {
          showError('Please enter a valid email address');
          return;
        }
        const emailChangeRes = await api.post('auth/changeEmail', { email: nextEmail });
        if (emailChangeRes.status === 200) {
          const savedEmail = emailChangeRes.data?.email || nextEmail;
          await persistAuthPayload(emailChangeRes.data, savedEmail);
          applyEmailToProfile(savedEmail);
          setData((prev) => ({ ...prev, userEmail: savedEmail }));
          setEditEmail(false);
          showSuccess('Email updated successfully');
          return;
        }
      }

      if (!data.newPassword && !data.confirmPassword && !data.currentPassword) {
        return;
      }

      if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
        showError('Please fill in all password fields');
        return;
      }

      if (data.newPassword.length < 6) {
        showError('New password must be at least 6 characters');
        return;
      }

      if (data.newPassword !== data.confirmPassword) {
        showError('Your new password and confirm password do not match');
        return;
      }

      const res = await api.post('auth/changePass', data);
      if (res.status === 400) {
        showError('Your current password is invalid');
        return;
      }
      if (res.status === 200 || res.status === 202) {
        await persistAuthPayload(res.data);
        showSuccess('Password updated successfully');
        setData((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      }
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update account settings');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Delete your account permanently? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const deletedAccountRes = await api.post('auth/delete');
              if (deletedAccountRes.status === 200) {
                showSuccess(deletedAccountRes.data?.message || 'Account deleted');
                await logout();
              }
            } catch (error: any) {
              showError(error?.response?.data?.message || 'Failed to delete account');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [logout, showError, showSuccess]);

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Account Settings"
        description="Manage your email, password, and Bengali name."
      />

      <View style={[styles.banglaBlock, { borderBottomColor: themeColors.border.primary }]}>
        <Text style={[styles.subTitle, { color: themeColors.text.primary }]}>Face Login</Text>
        <Text style={[styles.muted, { color: themeColors.text.secondary }]}>
          Register your face to sign in without a password. Blink naturally during capture.
        </Text>
        <FaceCapture onCapture={handleFaceCapture} disabled={isRegisteringFace} />
      </View>

      <View style={[styles.banglaBlock, { borderBottomColor: themeColors.border.primary }]}>
        <Text style={[styles.subTitle, { color: themeColors.text.primary }]}>Bengali Name (বাংলা নাম)</Text>
        <Text style={[styles.muted, { color: themeColors.text.secondary }]}>
          Add your name in Bengali script to make it easier for Bengali speakers to find you.
        </Text>
        <SettingsField label="Bengali Name">
          <SettingsInput
            value={banglaName}
            onChangeText={setBanglaName}
            placeholder="আপনার বাংলা নাম লিখুন"
          />
        </SettingsField>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <SettingsPrimaryButton
              title="Save Bengali Name"
              loadingTitle="Saving Bengali Name…"
              onPress={handleSaveBanglaName}
              loading={isSavingBangla}
              disabled={!banglaName.trim()}
            />
          </View>
          {banglaName ? (
            <SettingsSecondaryButton
              title="Clear"
              onPress={() => setBanglaName('')}
              disabled={isSavingBangla}
            />
          ) : null}
        </View>
      </View>

      <Text style={[styles.subTitle, { color: themeColors.text.primary }]}>Change Password & Email</Text>
      <SettingsField label="Email">
        <View style={styles.emailRow}>
          <View style={styles.emailInput}>
            <SettingsInput
              value={data.userEmail}
              onChangeText={(text) => setData((prev) => ({ ...prev, userEmail: text }))}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={editEmail}
            />
          </View>
          <TouchableOpacity
            style={[styles.editEmailBtn, { backgroundColor: themeColors.status.error }]}
            onPress={() => {
              setEditEmail((prev) => {
                if (prev) {
                  setData((current) => ({ ...current, userEmail: currentEmail }));
                }
                return !prev;
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={editEmail ? 'Cancel email edit' : 'Edit email'}
          >
            <Icon name={editEmail ? 'close' : 'edit'} size={16} color={themeColors.text.inverse} />
          </TouchableOpacity>
        </View>
      </SettingsField>
      <SettingsField label="Current Password">
        <SettingsInput
          value={data.currentPassword}
          onChangeText={(text) => setData((prev) => ({ ...prev, currentPassword: text }))}
          placeholder="Current Password"
          secureTextEntry
        />
      </SettingsField>
      <SettingsField label="New Password">
        <SettingsInput
          value={data.newPassword}
          onChangeText={(text) => setData((prev) => ({ ...prev, newPassword: text }))}
          placeholder="New Password"
          secureTextEntry
        />
      </SettingsField>
      <SettingsField label="Confirm Password">
        <SettingsInput
          value={data.confirmPassword}
          onChangeText={(text) => setData((prev) => ({ ...prev, confirmPassword: text }))}
          placeholder="Confirm Password"
          secureTextEntry
        />
      </SettingsField>

      <SettingsPrimaryButton title="Save Settings" onPress={handleSubmit} loading={isSaving} />
      <SettingsDangerButton
        title={isDeleting ? 'Deleting…' : 'Delete My Account'}
        onPress={deleteAccount}
        loading={isDeleting}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  banglaBlock: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowItem: {
    flexGrow: 1,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailInput: {
    flex: 1,
  },
  editEmailBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AccountSettings;
