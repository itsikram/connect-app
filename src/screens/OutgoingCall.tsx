import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';

interface OutgoingCallParams {
  calleeId: string;
  calleeName: string;
  calleeProfilePic?: string;
  channelName: string;
  isAudio: boolean;
}

const OutgoingCall: React.FC = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute();
  const { startVideoCall, startAudioCall, endVideoCall, endAudioCall, on, off } = useSocket();

  const safeGoBack = () => {
    try {
      if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
        (navigation as any).goBack();
      } else {
        (navigation as any).navigate('Message', { screen: 'MessageList' });
      }
    } catch (e) {}
  };

  const params = route.params as unknown as OutgoingCallParams;
  const { calleeId, calleeName, calleeProfilePic, channelName, isAudio } = params || {} as OutgoingCallParams;

  useEffect(() => {
    if (!calleeId || !channelName) {
      console.warn('OutgoingCall: Missing required parameters', { calleeId, channelName });
      navigation.goBack();
      return;
    }
    
    console.log('OutgoingCall: Initiating call', { calleeId, channelName, isAudio });
    // Initiate call once when screen opens
    if (isAudio) {
      startAudioCall(calleeId, channelName);
    } else {
      startVideoCall(calleeId, channelName);
    }
  }, [calleeId, channelName, isAudio, startAudioCall, startVideoCall]);

  // Close this screen once the peer accepts or ends the call
  useEffect(() => {
    const handleAccepted = () => { safeGoBack(); };
    const handleEnd = () => { safeGoBack(); };

    on('agora-call-accepted', handleAccepted);
    on(isAudio ? 'audioCallEnd' : 'videoCallEnd', handleEnd);

    return () => {
      off('agora-call-accepted', handleAccepted);
      off(isAudio ? 'audioCallEnd' : 'videoCallEnd', handleEnd);
    };
  }, [on, off, navigation, isAudio]);

  const title = useMemo(() => (isAudio ? 'Calling (Audio)' : 'Calling (Video)'), [isAudio]);

  const onCancel = () => {
    if (!calleeId) return;
    if (isAudio) {
      endAudioCall(calleeId);
    } else {
      endVideoCall(calleeId);
    }
    safeGoBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background.primary} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 18, color: themeColors.text.primary, marginBottom: 24 }}>{title}</Text>

        {calleeProfilePic ? (
          <Image source={{ uri: calleeProfilePic }} style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 16 }} />
        ) : (
          <View style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 16, backgroundColor: themeColors.gray[600], alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person" size={72} color={themeColors.text.secondary} />
          </View>
        )}

        <Text style={{ fontSize: 22, fontWeight: '600', color: themeColors.text.primary, marginBottom: 6 }}>
          {calleeName || 'Unknown User'}
        </Text>
        <Text style={{ fontSize: 14, color: themeColors.text.secondary, marginBottom: 40 }}>
          {isAudio ? 'Audio call' : 'Video call'}
        </Text>

        <TouchableOpacity
          onPress={onCancel}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.status.error, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="call-end" size={28} color={'white'} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OutgoingCall;


