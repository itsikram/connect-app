import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useCallMinimize } from '../contexts/CallMinimizeContext';
import { useTheme } from '../contexts/ThemeContext';

export const MINIMIZED_CALL_BAR_HEIGHT = 64;
export const MINIMIZED_CALL_BAR_TOP_GAP = 10;

const MinimizedCallBar: React.FC = () => {
  const { minimizedCalls, restoreCall } = useCallMinimize();
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const currentCall = minimizedCalls[0];

  if (!currentCall) {
    return null;
  }

  const formatDuration = (seconds: number = 0): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const topOffset = insets.top + MINIMIZED_CALL_BAR_TOP_GAP;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          backgroundColor: themeColors.primary,
          top: topOffset,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.callInfo}
        onPress={() => restoreCall(currentCall.id)}
        activeOpacity={0.8}
      >
        <View style={styles.leftSection}>
          {currentCall.callerProfilePic ? (
            <Image
              source={{ uri: currentCall.callerProfilePic }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.gray[600] }]}>
              <Icon name="person" size={20} color="white" />
            </View>
          )}

          <View style={styles.callDetails}>
            <Text style={styles.callerName} numberOfLines={1}>
              {currentCall.callerName}
            </Text>
            <Text style={styles.callStatus}>
              {currentCall.type === 'video' ? 'Video Call' : 'Audio Call'} • {formatDuration(currentCall.duration)}
            </Text>
          </View>
        </View>

        <View style={styles.controls} onStartShouldSetResponder={() => true}>
          {currentCall.onToggleMute && (
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: currentCall.isMuted ? themeColors.status.error : 'rgba(255,255,255,0.2)' }]}
              onPress={currentCall.onToggleMute}
            >
              <Icon
                name={currentCall.isMuted ? 'mic-off' : 'mic'}
                size={16}
                color="white"
              />
            </TouchableOpacity>
          )}

          {currentCall.type === 'video' && currentCall.onToggleCamera && (
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: currentCall.isCameraOn ? 'rgba(255,255,255,0.2)' : themeColors.status.error }]}
              onPress={currentCall.onToggleCamera}
            >
              <Icon
                name={currentCall.isCameraOn ? 'videocam' : 'videocam-off'}
                size={16}
                color="white"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: themeColors.status.error }]}
            onPress={currentCall.onEnd}
          >
            <Icon name="call-end" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    zIndex: 10000,
    elevation: 20,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
    minHeight: MINIMIZED_CALL_BAR_HEIGHT,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callDetails: {
    flex: 1,
  },
  callerName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  callStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default MinimizedCallBar;
