import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setProfile } from '../../reducers/profileReducer';
import { AuthContext } from '../../contexts/AuthContext';
import { useProfileData } from '../../hooks/useProfileData';
import { colors } from '../../theme/colors';

interface ProfileData {
  firstName: string;
  surname: string;
  nickname: string;
  username: string;
  displayName: string;
  presentAddress: string;
  permanentAddress: string;
  workPlaces: Array<{ name: string; designation: string }>;
  schools: Array<{ name: string; degree: string }>;
}

const ProfileSettings = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const dispatch = useDispatch();
  const { user } = useContext(AuthContext);
  
  // Get current profile data from Redux store
  const currentProfile = useSelector((state: RootState) => state.profile);
  
  // Use the profile data hook to fetch data
  const { fetchProfileData } = useProfileData(user?.profile || user?.user_id);
  
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    surname: '',
    nickname: '',
    username: '',
    displayName: '',
    presentAddress: '',
    permanentAddress: '',
    workPlaces: [{ name: '', designation: '' }],
    schools: [{ name: '', degree: '' }],
  });

  // Update local state when Redux store changes
  useEffect(() => {
    console.log('ProfileSettings: currentProfile from Redux:', currentProfile);
    console.log('ProfileSettings: user from AuthContext:', user);
    
    if (currentProfile && Object.keys(currentProfile).length > 0) {
      console.log('ProfileSettings: Setting profile data from Redux store');
      setProfileData(prev => ({
        ...prev,
        firstName: currentProfile.firstName || currentProfile.first_name || '',
        surname: currentProfile.surname || currentProfile.last_name || '',
        nickname: currentProfile.nickname || '',
        username: currentProfile.username || currentProfile.user_name || '',
        displayName: currentProfile.displayName || currentProfile.display_name || '',
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
        firstName: user.profile.firstName || user.profile.first_name || user.firstName || '',
        surname: user.profile.surname || user.profile.last_name || user.surname || '',
        nickname: user.profile.nickname || '',
        username: user.profile.username || user.profile.user_name || '',
        displayName: user.profile.displayName || user.profile.display_name || '',
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
    if (profileData.workPlaces.length > 1) {
      const newWorkPlaces = profileData.workPlaces.filter((_, i) => i !== index);
      setProfileData(prev => ({
        ...prev,
        workPlaces: newWorkPlaces,
      }));
    }
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

  const handleSave = () => {
    // Filter out empty entries
    const filteredData = {
      ...profileData,
      workPlaces: profileData.workPlaces.filter(wp => wp.name.trim() !== '' || wp.designation.trim() !== ''),
      schools: profileData.schools.filter(school => school.name.trim() !== '' || school.degree.trim() !== ''),
    };

    // Update Redux store
    dispatch(setProfile(filteredData));
    
    // Here you would typically make an API call to save the profile data
    Alert.alert('Success', 'Profile settings saved successfully!');
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
      <Text style={[styles.label, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
        {label}
      </Text>
      <View style={[styles.inputWrapper, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
        {icon && (
          <Icon 
            name={icon} 
            size={20} 
            color={isDarkMode ? colors.gray[400] : colors.gray[600]} 
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[
            styles.textInput,
            { 
              color: isDarkMode ? colors.text.light : colors.text.primary,
              paddingLeft: icon ? 40 : 16,
            }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? colors.gray[400] : colors.gray[500]}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  const renderSchoolItem = (school: { name: string; degree: string }, index: number) => (
    <View key={index} style={[styles.dynamicRow, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
      <View style={styles.dynamicRowHeader}>
        <Text style={[styles.itemTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          School {index + 1}
        </Text>
        {profileData.schools.length > 1 && (
          <TouchableOpacity 
            style={styles.removeButton} 
            onPress={() => removeSchool(index)}
          >
            <Icon name="remove-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
      {renderInputField('Degree', school.degree, (text) => handleSchoolChange(index, 'degree', text), 'Your Degree', 'school')}
      {renderInputField('School Name', school.name, (text) => handleSchoolChange(index, 'name', text), 'School Name', 'school')}
    </View>
  );

  const renderWorkplaceItem = (workplace: { name: string; designation: string }, index: number) => (
    <View key={index} style={[styles.dynamicRow, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
      <View style={styles.dynamicRowHeader}>
        <Text style={[styles.itemTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Workplace {index + 1}
        </Text>
        {profileData.workPlaces.length > 1 && (
          <TouchableOpacity 
            style={styles.removeButton} 
            onPress={() => removeWorkplace(index)}
          >
            <Icon name="remove-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
      {renderInputField('Designation', workplace.designation, (text) => handleWorkplaceChange(index, 'designation', text), 'Your Designation', 'work')}
      {renderInputField('Company Name', workplace.name, (text) => handleWorkplaceChange(index, 'name', text), 'Company Name', 'business')}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Profile Settings
        </Text>
      </View>

      {/* Basic Information */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Basic Information
        </Text>
        
        {renderInputField('First Name', profileData.firstName, (text) => handleInputChange('firstName', text), 'Enter First Name')}
        {renderInputField('Surname', profileData.surname, (text) => handleInputChange('surname', text), 'Enter Last Name')}
        {renderInputField('Username', profileData.username, (text) => handleInputChange('username', text), 'Enter Username', 'alternate-email')}
        {renderInputField('Nickname', profileData.nickname, (text) => handleInputChange('nickname', text), 'Enter Nickname')}
        {renderInputField('Display Name', profileData.displayName, (text) => handleInputChange('displayName', text), 'Enter Display Name')}
      </View>

      {/* Address Information */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Address Information
        </Text>
        
        {renderInputField('Present Address', profileData.presentAddress, (text) => handleInputChange('presentAddress', text), 'Enter Present Address', 'home')}
        {renderInputField('Permanent Address', profileData.permanentAddress, (text) => handleInputChange('permanentAddress', text), 'Enter Permanent Address', 'public')}
      </View>

      {/* Schools */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Education
        </Text>
        
        {profileData.schools.map((school, index) => renderSchoolItem(school, index))}
        
        <TouchableOpacity style={styles.addButton} onPress={addSchool}>
          <Icon name="add" size={20} color={colors.white} />
          <Text style={styles.addButtonText}>Add School</Text>
        </TouchableOpacity>
      </View>

      {/* Workplaces */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Work Experience
        </Text>
        
        {profileData.workPlaces.map((workplace, index) => renderWorkplaceItem(workplace, index))}
        
        <TouchableOpacity style={styles.addButton} onPress={addWorkplace}>
          <Icon name="add" size={20} color={colors.white} />
          <Text style={styles.addButtonText}>Add Workplace</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </TouchableOpacity>
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
    borderColor: '#E5E5EA',
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
  dynamicRow: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dynamicRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: colors.white,
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
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ProfileSettings;
