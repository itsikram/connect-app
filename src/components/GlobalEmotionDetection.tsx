import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSettings } from '../contexts/SettingsContext';
import BackgroundEmotionCamera from './BackgroundEmotionCamera';

/**
 * Global Emotion Detection Component
 * Automatically starts face detection when user opens the app
 * Uses settings to determine if emotion sharing is enabled
 */
const GlobalEmotionDetection: React.FC = () => {
  const profile = useSelector((state: RootState) => state.profile);
  const { settings } = useSettings();
  const [isEnabled, setIsEnabled] = useState(false);

  // Enable emotion detection based on settings and profile availability
  useEffect(() => {
    const shouldEnable = settings.isShareEmotion === true && !!profile?._id;
    setIsEnabled(shouldEnable);
    
    console.log('🎭 Global emotion detection state check:', {
      isShareEmotion: settings.isShareEmotion,
      hasProfile: !!profile?._id,
      profileId: profile?._id,
      shouldEnable
    });
    
    if (shouldEnable) {
      console.log('✅ Global emotion detection ENABLED for user:', profile._id);
      console.log('✅ Background camera will start automatically');
    } else {
      console.log('❌ Global emotion detection DISABLED');
      console.log('💡 To enable: Go to Settings > Message Settings > Share Emotions');
    }
  }, [settings.isShareEmotion, profile?._id]);

  // Don't render anything if not enabled or no profile
  if (!isEnabled || !profile?._id) {
    return null;
  }

  // Use a generic friendId for global detection (can be updated based on current context)
  // For now, we'll use the profile ID itself as a placeholder
  const globalFriendId = 'global-detection';

  return (
    <BackgroundEmotionCamera
      profileId={profile._id}
      friendId={globalFriendId}
      isEnabled={isEnabled}
      detectionInterval={2000} // Check every 2 seconds for emotion changes
    />
  );
};

export default GlobalEmotionDetection;
