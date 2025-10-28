import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

/**
 * Select profile ID
 * Simple selector for profile ID
 */
export const selectProfileId = (state: RootState) => state.profile?._id;

/**
 * Base selector for friends array from profile
 */
const selectFriendsFromProfile = (state: RootState) => {
  return (state.profile as any)?.friends;
};

/**
 * Select normalized friend IDs array
 * Returns an array of string IDs from the friends list
 */
export const selectMyFriends = createSelector(
  selectFriendsFromProfile,
  (friendsList) => {
    if (!friendsList) return [];
    // Transform to array of string ids
    return friendsList
      .map((f: any) => (typeof f === 'string' ? f : (f?._id || f?.id || null)))
      .filter((v: any) => typeof v === 'string' && v.length > 0);
  },
  {
    memoizeOptions: {
      resultEqualityCheck: (a: string[], b: string[]) => {
        // Check if result arrays are equal
        if (a === b) return true;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }
    }
  }
);
