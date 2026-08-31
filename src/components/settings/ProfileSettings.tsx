import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setProfile } from '../../reducers/profileReducer';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import api, { userAPI } from '../../lib/api';
import {
  SettingsSectionHeader,
  SettingsField,
  SettingsInput,
  SettingsPrimaryButton,
  SettingsSecondaryButton,
} from './settingsUi';

const resolveProfileId = (user: any, currentProfile?: any) => {
  if (typeof currentProfile?._id === 'string' && currentProfile._id) return currentProfile._id;
  if (typeof user?.profile === 'string' && user.profile) return user.profile;
  if (typeof user?.profile?._id === 'string' && user.profile._id) return user.profile._id;
  if (typeof user?.user_id === 'string' && user.user_id) return user.user_id;
  return null;
};

interface ProfileData {
  firstName: string;
  surname: string;
  nickname: string;
  username: string;
  displayName: string;
  banglaName: string;
  presentAddress: string;
  permanentAddress: string;
  workPlaces: Array<{ name: string; designation: string }>;
  schools: Array<{ name: string; degree: string }>;
}

const emptyWorkplace = () => ({ name: '', designation: '' });
const emptySchool = () => ({ name: '', degree: '' });

const ProfileSettings = () => {
  const { colors: themeColors } = useTheme();
  const { showSuccess, showError } = useToast();
  const dispatch = useDispatch();
  const { user } = useContext(AuthContext);
  const currentProfile = useSelector((state: RootState) => state.profile);

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    surname: '',
    nickname: '',
    username: '',
    displayName: '',
    banglaName: '',
    presentAddress: '',
    permanentAddress: '',
    workPlaces: [emptyWorkplace()],
    schools: [emptySchool()],
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const profileId = resolveProfileId(user, currentProfile);
    if (!profileId) return;
    if (currentProfile?._id === profileId && currentProfile?.user) return;

    const fetchProfileData = async () => {
      try {
        const response = await userAPI.getProfile(profileId);
        if (response.data) {
          dispatch(setProfile(response.data));
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };
    fetchProfileData();
  }, [user, currentProfile?._id, currentProfile?.user, dispatch]);

  useEffect(() => {
    if (!currentProfile || Object.keys(currentProfile).length === 0) return;
    const schools = currentProfile.schools?.length
      ? currentProfile.schools
      : currentProfile.education?.length
        ? currentProfile.education
        : [emptySchool()];
    const workPlaces = currentProfile.workPlaces?.length
      ? currentProfile.workPlaces
      : currentProfile.workplaces?.length
        ? currentProfile.workplaces
        : [emptyWorkplace()];

    setProfileData({
      firstName: currentProfile.user?.firstName || currentProfile.user?.first_name || user?.firstName || '',
      surname: currentProfile.user?.surname || currentProfile.user?.last_name || user?.surname || '',
      nickname: currentProfile.nickname || '',
      username: currentProfile.username || currentProfile.user_name || '',
      displayName: currentProfile.displayName || currentProfile.display_name || '',
      banglaName: currentProfile.banglaName || '',
      presentAddress: currentProfile.presentAddress || currentProfile.present_address || '',
      permanentAddress: currentProfile.permanentAddress || currentProfile.permanent_address || '',
      workPlaces,
      schools,
    });
  }, [currentProfile?._id, user?.firstName, user?.surname]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSchoolChange = (index: number, field: 'name' | 'degree', value: string) => {
    const next = [...profileData.schools];
    next[index] = { ...next[index], [field]: value };
    setProfileData((prev) => ({ ...prev, schools: next }));
  };

  const handleWorkplaceChange = (index: number, field: 'name' | 'designation', value: string) => {
    const next = [...profileData.workPlaces];
    next[index] = { ...next[index], [field]: value };
    setProfileData((prev) => ({ ...prev, workPlaces: next }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    const filteredData = {
      ...profileData,
      workPlaces: profileData.workPlaces.filter((wp) => wp.name.trim() || wp.designation.trim()),
      schools: profileData.schools.filter((school) => school.name.trim() || school.degree.trim()),
    };
    try {
      setIsSaving(true);
      const response = await api.post('/profile/update', filteredData);
      if (response.status === 200) {
        dispatch(setProfile(response.data));
        showSuccess('Your Profile Updated Successfully');
      } else {
        showError('Failed to save profile settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showError('Failed to save profile settings. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Profile Settings"
        description="Update how your name and details appear on Connect."
      />

      <SettingsField label="First Name">
        <SettingsInput
          value={profileData.firstName}
          onChangeText={(text) => handleInputChange('firstName', text)}
          placeholder="Enter first name"
        />
      </SettingsField>
      <SettingsField label="Surname">
        <SettingsInput
          value={profileData.surname}
          onChangeText={(text) => handleInputChange('surname', text)}
          placeholder="Enter Last Name"
        />
      </SettingsField>
      <SettingsField label="Username">
        <SettingsInput
          value={profileData.username}
          onChangeText={(text) => handleInputChange('username', text)}
          placeholder="Enter Username"
          prefix="@"
          autoCapitalize="none"
        />
      </SettingsField>
      <SettingsField label="Nickname">
        <SettingsInput
          value={profileData.nickname}
          onChangeText={(text) => handleInputChange('nickname', text)}
          placeholder="Enter Nickname"
        />
      </SettingsField>
      <SettingsField label="Display Name">
        <SettingsInput
          value={profileData.displayName}
          onChangeText={(text) => handleInputChange('displayName', text)}
          placeholder="Enter Display Name"
        />
      </SettingsField>
      <SettingsField
        label="Bengali Name (বাংলা নাম)"
        help="Enter your name in Bengali script to help Bengali speakers find you easily."
      >
        <SettingsInput
          value={profileData.banglaName}
          onChangeText={(text) => handleInputChange('banglaName', text)}
          placeholder="আপনার বাংলা নাম লিখুন"
        />
      </SettingsField>
      <SettingsField label="Present Address">
        <SettingsInput
          value={profileData.presentAddress}
          onChangeText={(text) => handleInputChange('presentAddress', text)}
          placeholder="Enter Present Address"
          icon="home"
        />
      </SettingsField>
      <SettingsField label="Permanent Address">
        <SettingsInput
          value={profileData.permanentAddress}
          onChangeText={(text) => handleInputChange('permanentAddress', text)}
          placeholder="Enter Permanent Address"
          icon="public"
        />
      </SettingsField>

      <View style={[styles.groupCard, { borderColor: themeColors.border.primary, backgroundColor: themeColors.surface.secondary }]}>
        <Text style={[styles.groupTitle, { color: themeColors.text.primary }]}>Your Schools</Text>
        {profileData.schools.map((school, index) => (
          <View key={`school-${index}`} style={[styles.groupRow, { borderColor: themeColors.border.primary }]}>
            <SettingsField label="Degree">
              <SettingsInput
                value={school.degree || ''}
                onChangeText={(text) => handleSchoolChange(index, 'degree', text)}
                placeholder="Your Degree"
                icon="school"
              />
            </SettingsField>
            <SettingsField label="School Name">
              <SettingsInput
                value={school.name || ''}
                onChangeText={(text) => handleSchoolChange(index, 'name', text)}
                placeholder="School Name"
                icon="school"
              />
            </SettingsField>
          </View>
        ))}
        <SettingsSecondaryButton
          title={profileData.schools.length > 0 ? 'Add Another School' : 'Add School'}
          onPress={() => setProfileData((prev) => ({ ...prev, schools: [...prev.schools, emptySchool()] }))}
        />
      </View>

      <View style={[styles.groupCard, { borderColor: themeColors.border.primary, backgroundColor: themeColors.surface.secondary }]}>
        <Text style={[styles.groupTitle, { color: themeColors.text.primary }]}>Your Workplaces</Text>
        {profileData.workPlaces.map((workplace, index) => (
          <View key={`work-${index}`} style={[styles.groupRow, { borderColor: themeColors.border.primary }]}>
            <SettingsField label="Designation">
              <SettingsInput
                value={workplace.designation || ''}
                onChangeText={(text) => handleWorkplaceChange(index, 'designation', text)}
                placeholder="Your Designation"
                icon="work"
              />
            </SettingsField>
            <SettingsField label="Company Name">
              <SettingsInput
                value={workplace.name || ''}
                onChangeText={(text) => handleWorkplaceChange(index, 'name', text)}
                placeholder="Workplace Name"
                icon="business"
              />
            </SettingsField>
          </View>
        ))}
        <SettingsSecondaryButton
          title={profileData.workPlaces.length > 0 ? 'Add Another Workplace' : 'Add Workplace'}
          onPress={() => setProfileData((prev) => ({ ...prev, workPlaces: [...prev.workPlaces, emptyWorkplace()] }))}
        />
      </View>

      <SettingsPrimaryButton title="Save Settings" onPress={handleSave} loading={isSaving} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  groupRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
});

export default ProfileSettings;
