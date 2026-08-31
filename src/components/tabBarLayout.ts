import { Platform } from 'react-native';

/** Matches ProfessionalTabBar container `bottom` so overlays can sit in the same slot. */
export const TAB_BAR_BOTTOM_OFFSET = 0;
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 64;
