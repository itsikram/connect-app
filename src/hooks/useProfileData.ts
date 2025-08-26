import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setProfile } from '../reducers/profileReducer';
import { userAPI } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useProfileData = (userId: string | null) => {
  const dispatch = useDispatch();

  const fetchProfileData = async () => {
    try {
      if (!userId) return;
      
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
      const response = await userAPI.getProfile(userId);
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
  }, [userId]);

  return { fetchProfileData };
};
