import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

/**
 * Select profile ID
 */
export const selectProfileId = createSelector(
  (state: RootState) => state.profile?._id,
  (profileId) => profileId
);

/**
 * Select normalized friend IDs array
 * Returns an array of string IDs from the friends list
 */
export const selectMyFriends = createSelector(
  (state: RootState) => {
    const list: any[] = (state.profile as any)?.friends || [];
    return list;
  },
  (friendsList) => {
    // Normalize to array of string ids
    return friendsList
      .map((f: any) => (typeof f === 'string' ? f : (f?._id || f?.id || null)))
      .filter((v: any) => typeof v === 'string' && v.length > 0);
  }
);
