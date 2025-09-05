import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import Video from 'react-native-video';

interface IncomingCallParams {
  callerId: string;
  callerName: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
}

const IncomingCall: React.FC = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute();
  const { answerVideoCall, answerAudioCall, endVideoCall, endAudioCall, on, off } = useSocket();
  const [playRingtone, setPlayRingtone] = useState(true);

  const safeGoBack = () => {
    try {
      if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
        (navigation as any).goBack();
      } else {
        (navigation as any).navigate('Message', { screen: 'MessageList' });
      }
    } catch (e) {}
  };

  const params = route.params as unknown as IncomingCallParams;
  const { callerId, callerName, callerProfilePic, channelName, isAudio } = params || {} as IncomingCallParams;

  useEffect(() => {
    if (!callerId || !channelName) {
      navigation.goBack();
    }
  }, [callerId, channelName, navigation]);

  const title = useMemo(() => (isAudio ? 'Incoming Audio Call' : 'Incoming Video Call'), [isAudio]);

  const onAccept = () => {
    if (!callerId || !channelName) {
      console.warn('IncomingCall: Missing required parameters for call acceptance', { callerId, channelName });
      return;
    }
    
    console.log('IncomingCall: Accepting call', { callerId, channelName, isAudio, callerName });
    setPlayRingtone(false);
    if (isAudio) {
      answerAudioCall(callerId, channelName);
    } else {
      answerVideoCall(callerId, channelName);
    }
    
    // Navigate back - call components are now global and will show automatically
    safeGoBack();
  };

  const onDecline = () => {
    if (!callerId) return;
    setPlayRingtone(false);
    if (isAudio) {
      endAudioCall(callerId);
    } else {
      endVideoCall(callerId);
    }
    safeGoBack();
  };

  // Close this screen if the remote cancels/ends before we accept
  useEffect(() => {
    const handleEnd = () => {
      setPlayRingtone(false);
      safeGoBack();
    };
    const handleAccepted = () => {
      setPlayRingtone(false);
      safeGoBack();
    };

    on('videoCallEnd', handleEnd);
    on('audioCallEnd', handleEnd);
    on('agora-call-accepted', handleAccepted);

    return () => {
      off('videoCallEnd', handleEnd);
      off('audioCallEnd', handleEnd);
      off('agora-call-accepted', handleAccepted);
    };
  }, [on, off, navigation]);

  // Ensure ringtone stops on unmount
  useEffect(() => {
    return () => setPlayRingtone(false);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={themeColors.background.primary} />
      {/* Ringtone player */}
      {playRingtone && (
        <Video
          source={require('../assets/ringtones/my_awesome_ringtone.mp3')}
          paused={!playRingtone}
          repeat
          muted={false}
          playInBackground
          ignoreSilentSwitch="ignore"
          volume={1.0}
          style={{ width: 0, height: 0 }}
        />
      )}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 18, color: themeColors.text.primary, marginBottom: 24 }}>{title}</Text>

        {callerProfilePic ? (
          <Image source={{ uri: callerProfilePic }} style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 16 }} />
        ) : (
          <View style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 16, backgroundColor: themeColors.gray[600], alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person" size={72} color={themeColors.text.secondary} />
          </View>
        )}

        <Text style={{ fontSize: 22, fontWeight: '600', color: themeColors.text.primary, marginBottom: 6 }}>
          {callerName || 'Unknown Caller'}
        </Text>
        <Text style={{ fontSize: 14, color: themeColors.text.secondary, marginBottom: 40 }}>
          {isAudio ? 'Audio call' : 'Video call'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 24 }}>
          <TouchableOpacity
            onPress={onDecline}
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.status.error, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="call-end" size={28} color={'white'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onAccept}
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.status.success, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="call" size={28} color={'white'} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default IncomingCall;


