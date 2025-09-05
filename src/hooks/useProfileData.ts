import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setProfile } from '../reducers/profileReducer';
import { userAPI } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Accept either a profileId string or a profile object with _id
export const useProfileData = (profileOrId: string | { _id?: string } | null) => {
  const dispatch = useDispatch();

  const fetchProfileData = async () => {
    try {
      const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?._id || null;
      if (!profileId) return;
      
      // Get the stored profile data from AsyncStorage first
      const storedProfile = await AsyncStorage.getItem('user');
      if (storedProfile) {
        const userData = JSON.parse(storedProfile);
        if (userData.profile) {
          // Dispatch stored profile data immediately
          dispatch(setProfile(userData.profile));
        }
      }

      // Fetch fresh profile data from API
      const response = await userAPI.getProfile(profileId);
      if (response.data) {
        // Update Redux store with fresh data
        dispatch(setProfile(response.data));
        
        // Update stored user data with fresh profile
        const currentUser = await AsyncStorage.getItem('user');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          userData.profile = response.data;
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      // If API call fails, we still have the stored data in Redux
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [typeof profileOrId === 'string' ? profileOrId : profileOrId?._id]);

  return { fetchProfileData };
};
