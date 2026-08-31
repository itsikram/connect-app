import { Platform } from 'react-native';

/** Matches ProfessionalTabBar container `bottom` so overlays can sit in the same slot. */
export const TAB_BAR_BOTTOM_OFFSET = Platform.OS === 'ios' ? -30 : 30;
