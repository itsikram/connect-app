import { NativeModules, Platform } from 'react-native';

interface CallNotificationModule {
  openIncomingCallScreen(params: {
    callerId: string;
    callerName: string;
    callerProfilePic?: string;
    channelName: string;
    isAudio: boolean;
    autoAccept?: boolean;
  }): Promise<boolean>;
  bringAppToForeground(): Promise<boolean>;
}

const { CallNotificationModule } = NativeModules;

export const callNotificationBridge: CallNotificationModule = CallNotificationModule;

// Helper function to open incoming call screen using native module
export const openIncomingCallScreen = async (params: {
  callerId: string;
  callerName: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  autoAccept?: boolean;
}): Promise<boolean> => {
  if (Platform.OS !== 'android' || !callNotificationBridge) {
    console.warn('CallNotificationBridge not available on this platform');
    return false;
  }

  try {
    const result = await callNotificationBridge.openIncomingCallScreen(params);
    console.log('✅ Successfully opened incoming call screen via native bridge');
    return result;
  } catch (error) {
    console.error('❌ Error opening incoming call screen via native bridge:', error);
    return false;
  }
};

// Helper function to bring app to foreground
export const bringAppToForeground = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !callNotificationBridge) {
    console.warn('CallNotificationBridge not available on this platform');
    return false;
  }

  try {
    const result = await callNotificationBridge.bringAppToForeground();
    console.log('✅ Successfully brought app to foreground');
    return result;
  } catch (error) {
    console.error('❌ Error bringing app to foreground:', error);
    return false;
  }
};
