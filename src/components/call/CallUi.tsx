import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProfileImage from '../ProfileImage';

// Shared WhatsApp / Messenger style pieces for the audio and video call screens.

export const CALL_COLORS = {
  background: '#0b141a',
  danger: '#ea0038',
  accept: '#25d366',
  control: 'rgba(255,255,255,0.16)',
  controlActive: '#ffffff',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.75)',
  warning: '#ffd166',
};

// How long the "Call ended" / "Declined" screen stays up before closing.
export const ENDED_SCREEN_MS = 1500;

export function formatCallDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function endedLabelFor(reason?: string): string {
  switch (reason) {
    case 'busy':
      return 'On another call';
    case 'declined':
    case 'rejected':
      return 'Declined';
    case 'timeout':
    case 'no_answer':
      return 'No answer';
    case 'failed':
      return 'Call failed';
    default:
      return 'Call ended';
  }
}

export type CallPhase = 'incoming' | 'outgoing' | 'connecting' | 'connected' | 'ended';

export function CallBackdrop({ uri }: { uri?: string | null }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ProfileImage uri={uri || undefined} pixelSize={120} blurRadius={40} style={[StyleSheet.absoluteFill, styles.backdropImage]} />
      <View style={[StyleSheet.absoluteFill, styles.backdropShade]} />
    </View>
  );
}

export function CallHeader({
  name,
  status,
  reconnecting,
  isVideo,
  compact,
}: {
  name: string;
  status: string;
  reconnecting?: boolean;
  isVideo?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={styles.header} pointerEvents="none">
      <View style={styles.captionRow}>
        <Icon name="lock" size={12} color={CALL_COLORS.muted} />
        <Text style={styles.caption}>Connect {isVideo ? 'video' : 'voice'} call</Text>
      </View>
      <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
        {name || 'Unknown'}
      </Text>
      <Text style={[styles.status, compact && styles.statusCompact, reconnecting && styles.statusWarning]}>
        {reconnecting ? 'Reconnecting…' : status}
      </Text>
    </View>
  );
}

export function CallAvatar({ uri, ringing }: { uri?: string | null; ringing?: boolean }) {
  return (
    <View style={[styles.avatarRing, ringing && styles.avatarRinging]}>
      {uri ? (
        <ProfileImage uri={uri} pixelSize={240} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={80} color="#fff" />
        </View>
      )}
    </View>
  );
}

export function CallControl({
  icon,
  label,
  onPress,
  active,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.control,
        active && styles.controlActive,
        danger && styles.controlDanger,
        disabled && styles.controlDisabled,
      ]}
    >
      <Icon name={icon} size={danger ? 30 : 26} color={active ? '#111b21' : '#fff'} />
    </TouchableOpacity>
  );
}

export function CallControlBar({ children }: { children: React.ReactNode }) {
  return <View style={styles.controlBar}>{children}</View>;
}

export function IncomingCallActions({
  isVideo,
  onAccept,
  onDecline,
}: {
  isVideo?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.incomingRow}>
      <View style={styles.incomingAction}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Decline"
          style={[styles.bigButton, { backgroundColor: CALL_COLORS.danger }]}
          onPress={onDecline}
          activeOpacity={0.8}
        >
          <Icon name="call-end" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.incomingLabel}>Decline</Text>
      </View>
      <View style={styles.incomingAction}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Accept"
          style={[styles.bigButton, { backgroundColor: CALL_COLORS.accept }]}
          onPress={onAccept}
          activeOpacity={0.8}
        >
          <Icon name={isVideo ? 'videocam' : 'call'} size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.incomingLabel}>Accept</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdropImage: { width: '100%', height: '100%', opacity: 0.55 },
  backdropShade: { backgroundColor: 'rgba(11,20,26,0.72)' },
  header: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  caption: { color: CALL_COLORS.muted, fontSize: 12 },
  name: { color: CALL_COLORS.text, fontSize: 28, fontWeight: '600', textAlign: 'center' },
  nameCompact: { fontSize: 20 },
  status: { color: CALL_COLORS.muted, fontSize: 16, marginTop: 6, fontVariant: ['tabular-nums'] },
  statusCompact: { fontSize: 14 },
  statusWarning: { color: CALL_COLORS.warning },
  avatarRing: {
    width: 164,
    height: 164,
    borderRadius: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRinging: { borderWidth: 6, borderColor: 'rgba(255,255,255,0.12)' },
  avatar: { width: 148, height: 148, borderRadius: 74 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a3942' },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 40,
    backgroundColor: 'rgba(20,30,36,0.78)',
  },
  control: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CALL_COLORS.control,
  },
  controlActive: { backgroundColor: CALL_COLORS.controlActive },
  controlDanger: { width: 64, height: 64, borderRadius: 32, backgroundColor: CALL_COLORS.danger },
  controlDisabled: { opacity: 0.4 },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 32,
  },
  incomingAction: { alignItems: 'center', gap: 10 },
  bigButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  incomingLabel: { color: CALL_COLORS.muted, fontSize: 14 },
});
