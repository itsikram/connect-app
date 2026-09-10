import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

/**
 * Select profile ID
 * Simple selector for profile ID
 */
export const selectProfileId = (state: RootState) => state.profile?._id;

/**
 * Base selector for connects array from profile
 */
const selectConnectsFromProfile = (state: RootState) => {
  const profile = state.profile as any;
  return profile?.connects ?? profile?.friends;
};

/**
 * Select normalized connect IDs array
 * Returns an array of string IDs from the connects list
 */
export const selectMyConnects = createSelector(
  selectConnectsFromProfile,
  (connectsList) => {
    if (!connectsList) return [];
    // Transform to array of string ids
    return connectsList
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
