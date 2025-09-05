import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setProfile } from '../../reducers/profileReducer';
import { AuthContext } from '../../contexts/AuthContext';
import { useProfileData } from '../../hooks/useProfileData';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../lib/api';

interface ProfileData {
  firstName: string;
  surname: string;
  nickname: string;
  username: string;
  displayName: string;
  bio: string;
  presentAddress: string;
  permanentAddress: string;
  workPlaces: Array<{ name: string; designation: string }>;
  schools: Array<{ name: string; degree: string }>;
}

const ProfileSettings = () => {
  const { colors: themeColors } = useTheme();
  const { updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const dispatch = useDispatch();
  const { user } = useContext(AuthContext);
  
  // Get current profile data from Redux store
  const currentProfile = useSelector((state: RootState) => state.profile);
  
  // Use the profile data hook to fetch data
  const { fetchProfileData } = useProfileData(user?.profile || user?.user_id);
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    surname: '',
    nickname: '',
    username: '',
    displayName: '',
    bio: '',
    presentAddress: '',
    permanentAddress: '',
    workPlaces: [{ name: '', designation: '' }],
    schools: [{ name: '', degree: '' }],
  });


  useEffect(() => {
    console.log('ProfileSettings: profileData', currentProfile);
  }, [currentProfile]);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Update local state when Redux store changes
  useEffect(() => {
    console.log('ProfileSettings: currentProfile from Redux:', currentProfile);
    console.log('ProfileSettings: user from AuthContext:', user);
    
    if (currentProfile && Object.keys(currentProfile).length > 0) {
      console.log('ProfileSettings: Setting profile data from Redux store');
      setProfileData(prev => ({
        ...prev,
        user: {
          ...currentProfile.user,
        },
        nickname: currentProfile.nickname || '',
        username: currentProfile.username || currentProfile.user_name || '',
        displayName: currentProfile.displayName || currentProfile.display_name || '',
        bio: currentProfile.bio || '',
        presentAddress: currentProfile.presentAddress || currentProfile.present_address || '',
        permanentAddress: currentProfile.permanentAddress || currentProfile.permanent_address || '',
        workPlaces: currentProfile.workPlaces && currentProfile.workPlaces.length > 0 
          ? currentProfile.workPlaces 
          : currentProfile.workplaces && currentProfile.workplaces.length > 0
          ? currentProfile.workplaces
          : [{ name: '', designation: '' }],
        schools: currentProfile.schools && currentProfile.schools.length > 0 
          ? currentProfile.schools 
          : currentProfile.education && currentProfile.education.length > 0
          ? currentProfile.education
          : [{ name: '', degree: '' }],
      }));
    } else if (user && user.profile) {
      console.log('ProfileSettings: Setting profile data from user.profile');
      setProfileData(prev => ({
        ...prev,
        user: {
          ...currentProfile.user,
        },
        firstName: user.profile.firstName || user.profile.first_name || user.firstName || '',
        surname: user.profile.surname || user.profile.last_name || user.surname || '',
        nickname: user.profile.nickname || '',
        username: user.profile.username || user.profile.user_name || '',
        displayName: user.profile.displayName || user.profile.display_name || '',
        bio: user.profile.bio || '',
        presentAddress: user.profile.presentAddress || user.profile.present_address || '',
        permanentAddress: user.profile.permanentAddress || user.profile.permanent_address || '',
        workPlaces: user.profile.workPlaces && user.profile.workPlaces.length > 0 
          ? user.profile.workPlaces 
          : user.profile.workplaces && user.profile.workplaces.length > 0
          ? user.profile.workplaces
          : [{ name: '', designation: '' }],
        schools: user.profile.schools && user.profile.schools.length > 0 
          ? user.profile.schools 
          : user.profile.education && user.profile.education.length > 0
          ? user.profile.education
          : [{ name: '', degree: '' }],
      }));
    } else {
      console.log('ProfileSettings: No profile data in Redux store or user object');
    }
  }, [currentProfile, user]);

  // Fetch profile data when component mounts
  useEffect(() => {
    if (user?.profile || user?.user_id) {
      fetchProfileData();
    }
  }, [user, fetchProfileData]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWorkplaceChange = (index: number, field: 'name' | 'designation', value: string) => {
    const newWorkPlaces = [...profileData.workPlaces];
    newWorkPlaces[index] = {
      ...newWorkPlaces[index],
      [field]: value,
    };
    setProfileData(prev => ({
      ...prev,
      workPlaces: newWorkPlaces,
    }));
  };

  const handleSchoolChange = (index: number, field: 'name' | 'degree', value: string) => {
    const newSchools = [...profileData.schools];
    newSchools[index] = {
      ...newSchools[index],
      [field]: value,
    };
    setProfileData(prev => ({
      ...prev,
      schools: newSchools,
    }));
  };

  const addWorkplace = () => {
    setProfileData(prev => ({
      ...prev,
      workPlaces: [...prev.workPlaces, { name: '', designation: '' }],
    }));
  };

  const addSchool = () => {
    setProfileData(prev => ({
      ...prev,
      schools: [...prev.schools, { name: '', degree: '' }],
    }));
  };

  const removeWorkplace = (index: number) => {
    Alert.alert(
      'Remove Workplace',
      'Are you sure you want to remove this workplace?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newWorkPlaces = profileData.workPlaces.filter((_, i) => i !== index);
            setProfileData(prev => ({
              ...prev,
              workPlaces: newWorkPlaces.length > 0 ? newWorkPlaces : [{ name: '', designation: '' }],
            }));
          },
        },
      ]
    );
  };

  const removeSchool = (index: number) => {
    if (profileData.schools.length > 1) {
      const newSchools = profileData.schools.filter((_, i) => i !== index);
      setProfileData(prev => ({
        ...prev,
        schools: newSchools,
      }));
    }
  };

  const handleSave = async () => {
    if (isSaving) return; // Prevent multiple saves
    
    // Filter out empty entries
    const filteredData = {
      ...profileData,
      workPlaces: profileData.workPlaces.filter(wp => wp.name.trim() !== '' || wp.designation.trim() !== ''),
      schools: profileData.schools.filter(school => school.name.trim() !== '' || school.degree.trim() !== ''),
    } as ProfileData & { workPlaces: Array<{ name: string; designation: string }>; schools: Array<{ name: string; degree: string }> };

    // Ensure at least one workplace entry exists
    if (filteredData.workPlaces.length === 0) {
      filteredData.workPlaces = [{ name: '', designation: '' }];
    }

    // Ensure at least one school entry exists
    if (filteredData.schools.length === 0) {
      filteredData.schools = [{ name: '', degree: '' }];
    }

    try {
      setIsSaving(true);
      // Make API call to save profile data
      const response = await api.post('/profile/update', filteredData);
      
      if (response.status === 200) {
        // Update Redux store with the response data
        dispatch(setProfile(response.data));
        // Update settings context
        await updateSettings(filteredData);
        showSuccess('Profile settings saved successfully!');
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

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon?: string,
    keyboardType: 'default' | 'email-address' | 'numeric' | 'phone-pad' = 'default'
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: themeColors.text.primary }]}>
        {label}
      </Text>
      <View style={[
        styles.inputWrapper,
        { 
          backgroundColor: themeColors.surface.secondary,
          borderColor: themeColors.border.primary,
        }
      ]}>
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
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  const renderSchoolItem = (school: { name: string; degree: string }, index: number) => (
    <View key={index} style={[
      styles.dynamicRow,
      { 
        backgroundColor: themeColors.surface.secondary,
        borderColor: themeColors.border.primary,
      }
    ]}>
      <View style={styles.dynamicRowHeader}>
        <Text style={[styles.itemTitle, { color: themeColors.text.primary }]}>
          School {index + 1}
        </Text>
        {profileData.schools.length > 1 && (
          <TouchableOpacity 
            style={styles.removeButton} 
            onPress={() => removeSchool(index)}
          >
            <Icon name="remove-circle" size={24} color={themeColors.status.error} />
          </TouchableOpacity>
        )}
      </View>
      {renderInputField('Degree', school.degree, (text) => handleSchoolChange(index, 'degree', text), 'Your Degree', 'school')}
      {renderInputField('School Name', school.name, (text) => handleSchoolChange(index, 'name', text), 'School Name', 'school')}
    </View>
  );

  const renderWorkplaceItem = (workplace: { name: string; designation: string }, index: number) => (
    <View key={index} style={[
      styles.dynamicRow,
      { 
        backgroundColor: themeColors.surface.secondary,
        borderColor: themeColors.border.primary,
      }
    ]}>
      <View style={styles.dynamicRowHeader}>
        <Text style={[styles.itemTitle, { color: themeColors.text.primary }]}>
          Workplace {index + 1}
        </Text>
        <TouchableOpacity 
          style={styles.removeButton} 
          onPress={() => removeWorkplace(index)}
        >
          <Icon name="remove-circle" size={24} color={themeColors.status.error} />
        </TouchableOpacity>
      </View>
      {renderInputField('Designation', workplace.designation, (text) => handleWorkplaceChange(index, 'designation', text), 'Your Designation', 'work')}
      {renderInputField('Company Name', workplace.name, (text) => handleWorkplaceChange(index, 'name', text), 'Company Name', 'business')}
    </View>
  );

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled={true}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Profile Settings
        </Text>
      </View>

      {/* Basic Information */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Basic Information
        </Text>
        
        {renderInputField('First Name', currentProfile.user.firstName, (text) => handleInputChange('firstName', text), 'Enter First Name')}
        {renderInputField('Surname', profileData.surname, (text) => handleInputChange('surname', text), 'Enter Last Name')}
        {renderInputField('Username', profileData.username, (text) => handleInputChange('username', text), 'Enter Username', 'alternate-email')}
        {renderInputField('Nickname', profileData.nickname, (text) => handleInputChange('nickname', text), 'Enter Nickname')}
        {renderInputField('Display Name', profileData.displayName, (text) => handleInputChange('displayName', text), 'Enter Display Name')}
        
        {/* Bio Field - Special handling for multiline */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: themeColors.text.primary }]}>
            Bio
          </Text>
          <View style={[
            styles.inputWrapper, 
            { 
              backgroundColor: themeColors.surface.secondary,
              borderColor: themeColors.border.primary,
            }
          ]}>
            <Icon 
              name="info" 
              size={20} 
              color={themeColors.gray[400]} 
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.textInput,
                styles.bioTextInput,
                { 
                  color: themeColors.text.primary,
                  paddingLeft: 40,
                  textAlignVertical: 'top',
                }
              ]}
              value={profileData.bio}
              onChangeText={(text) => handleInputChange('bio', text)}
              placeholder="Tell people about yourself..."
              placeholderTextColor={themeColors.gray[400]}
              multiline
              numberOfLines={4}
              maxLength={150}
            />
          </View>
          <Text style={[styles.characterCount, { color: themeColors.text.tertiary }]}>
            {profileData.bio.length}/150 characters
          </Text>
        </View>
      </View>

      {/* Address Information */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Address Information
        </Text>
        
        {renderInputField('Present Address', profileData.presentAddress, (text) => handleInputChange('presentAddress', text), 'Enter Present Address', 'home')}
        {renderInputField('Permanent Address', profileData.permanentAddress, (text) => handleInputChange('permanentAddress', text), 'Enter Permanent Address', 'public')}
      </View>

      {/* Schools */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Education
        </Text>
        
        {profileData.schools.map((school, index) => renderSchoolItem(school, index))}
        
        <TouchableOpacity style={[styles.addButton, { backgroundColor: themeColors.secondary }]} onPress={addSchool}>
          <Icon name="add" size={20} color={themeColors.text.inverse} />
          <Text style={[styles.addButtonText, { color: themeColors.text.inverse }]}>Add School</Text>
        </TouchableOpacity>
      </View>

      {/* Workplaces */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Work Experience
        </Text>
        
        {profileData.workPlaces.map((workplace, index) => renderWorkplaceItem(workplace, index))}
        
        <TouchableOpacity style={[styles.addButton, { backgroundColor: themeColors.secondary }]} onPress={addWorkplace}>
          <Icon name="add" size={20} color={themeColors.text.inverse} />
          <Text style={[styles.addButtonText, { color: themeColors.text.inverse }]}>Add Workplace</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={[
          styles.saveButton, 
          { backgroundColor: isSaving ? themeColors.gray[600] : themeColors.primary }
        ]} 
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <ActivityIndicator size="small" color={themeColors.text.inverse} style={{ marginRight: 8 }} />
            <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Saving...</Text>
          </>
        ) : (
          <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Save Settings</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputContainer: {
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
  bioTextInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    marginTop: 8,
    alignSelf: 'flex-end',
    fontStyle: 'italic',
  },
  dynamicRow: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dynamicRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ProfileSettings;
