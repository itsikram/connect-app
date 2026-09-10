import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { COLORS, PLAYER_LETTERS, THEME } from './constants';
import type { ConnectUser, Player } from './types';
import ProfileImage from '../../components/ProfileImage';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import VoiceTextInput from '../../components/VoiceTextInput';

interface PlayerSelectionModalProps {
  show: boolean;
  selectedPlayerCount: number;
  onlineMode: boolean;
  playWithComputer: boolean;
  connectSearchQuery: string;
  loadingSearch: boolean;
  searchResults: ConnectUser[];
  connectList: ConnectUser[];
  selectedConnects: ConnectUser[];
  invitedStatusByConnectId: Record<string, string>;
  players: Player[];
  myProfile?: { fullName?: string; profilePic?: string };
  onPlayerCountChange: (count: number) => void;
  onOnlineModeToggle: () => void;
  onPlayWithComputerToggle: () => void;
  onConnectSearchChange: (text: string) => void;
  onConnectSelect: (connect: ConnectUser, isSelected: boolean) => void;
  onInviteConnect: (connect: ConnectUser) => void;
  onAssignConnectOffline: (connect: ConnectUser) => void;
  onGetNextOpenSlot: () => number | null;
  onCancel: () => void;
  onConfirmPlayerCount: () => void;
}

export const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({
  show,
  selectedPlayerCount,
  onlineMode,
  playWithComputer,
  connectSearchQuery,
  loadingSearch,
  searchResults,
  connectList,
  selectedConnects,
  invitedStatusByConnectId,
  players,
  myProfile,
  onPlayerCountChange,
  onOnlineModeToggle,
  onPlayWithComputerToggle,
  onConnectSearchChange,
  onConnectSelect,
  onInviteConnect,
  onAssignConnectOffline,
  onGetNextOpenSlot,
  onCancel,
  onConfirmPlayerCount,
}) => {
  if (!show) return null;

  const maxConnectSlots = Math.max(0, selectedPlayerCount - 1);
  const connectProgressPct =
    maxConnectSlots > 0
      ? Math.min(100, Math.round((selectedConnects.length / maxConnectSlots) * 100))
      : 0;
  const visibleConnects = connectSearchQuery ? searchResults : connectList;
  const countDots = (count: number) =>
    count === 2 ? [0, 3] : count === 3 ? [0, 1, 2] : [0, 1, 3, 2];

  return (
    <Modal visible={show} animationType="fade" transparent>
      <KeyboardSafeView force>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <TouchableOpacity style={styles.close} onPress={onCancel}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
          <Text style={styles.icon}>🎲</Text>
          <Text style={styles.title}>Start New Game</Text>
          <Text style={styles.subtitle}>Set up your players and game mode to begin</Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Number of Players</Text>
            <View style={styles.choiceGrid}>
              {[2, 3, 4].map((count) => {
                const active = selectedPlayerCount === count;
                return (
                  <TouchableOpacity
                    key={count}
                    style={[styles.choice, active && styles.choiceActive]}
                    onPress={() => onPlayerCountChange(count)}
                  >
                    {active && <Text style={styles.check}>✓</Text>}
                    <View style={styles.dots}>
                      {countDots(count).map((idx) => (
                        <View
                          key={idx}
                          style={[styles.dot, { backgroundColor: COLORS[idx] }]}
                        />
                      ))}
                    </View>
                    <Text style={styles.choiceCount}>{count}</Text>
                    <Text style={styles.choiceLabel}>Players</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Game Mode</Text>
            <View style={styles.modeRow}>
              <View style={styles.modeInfo}>
                <Text style={styles.modeIcon}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>Play with Computer</Text>
                  <Text style={styles.modeDesc}>Empty seats are filled by CPU opponents</Text>
                </View>
              </View>
              <Switch
                value={playWithComputer}
                onValueChange={onPlayWithComputerToggle}
                trackColor={{ false: '#2a3a4c', true: THEME.accent }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.modeRow}>
              <View style={styles.modeInfo}>
                <Text style={styles.modeIcon}>🌐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>Play Online with Connects</Text>
                  <Text style={styles.modeDesc}>Invite connects to join remotely</Text>
                </View>
              </View>
              <Switch
                value={onlineMode}
                onValueChange={onOnlineModeToggle}
                disabled={playWithComputer}
                trackColor={{ false: '#2a3a4c', true: THEME.accent2 }}
                thumbColor="#fff"
              />
            </View>

            {(onlineMode || !playWithComputer) && (
              <>
                <Text style={styles.sectionTitle}>
                  {onlineMode ? 'Invite Connects' : 'Add Connects (optional)'}
                </Text>
                <View style={styles.search}>
                  <VoiceTextInput
                    style={styles.searchInput}
                    placeholder="Search connects by name..."
                    placeholderTextColor={THEME.muted}
                    value={connectSearchQuery}
                    onChangeText={onConnectSearchChange}
                  />
                </View>
                <View style={styles.connectList}>
                  {loadingSearch && (
                    <View style={styles.empty}>
                      <ActivityIndicator color={THEME.accent} />
                      <Text style={styles.emptyText}>Searching…</Text>
                    </View>
                  )}
                  {!loadingSearch && visibleConnects.length === 0 && (
                    <Text style={styles.emptyText}>
                      {connectSearchQuery ? 'No connects match your search' : 'No connects to show yet'}
                    </Text>
                  )}
                  {visibleConnects.map((f) => {
                    const isSelected = selectedConnects.some((sf) => sf._id === f._id);
                    const inviteStatus = invitedStatusByConnectId[f?._id];
                    const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
                    const isAssignedOffline =
                      !onlineMode &&
                      players.slice(1, maxPlayers).some(
                        (p) => p?.profileId && String(p.profileId) === String(f?._id),
                      );
                    const canAction = onlineMode
                      ? !inviteStatus && onGetNextOpenSlot() != null
                      : !isAssignedOffline && onGetNextOpenSlot() != null;
                    const initial = (f?.fullName || '?').trim().charAt(0).toUpperCase();
                    return (
                      <TouchableOpacity
                        key={f._id}
                        style={[styles.connect, isSelected && styles.connectSelected]}
                        onPress={() => onConnectSelect(f, isSelected)}
                      >
                        <View style={styles.connectLeft}>
                          {f?.profilePic ? (
                            <ProfileImage uri={f.profilePic} pixelSize={80} style={styles.avatar} />
                          ) : (
                            <View style={styles.avatarFallback}>
                              <Text style={styles.avatarLetter}>{initial}</Text>
                            </View>
                          )}
                          <Text style={styles.connectName} numberOfLines={1}>
                            {f?.fullName || 'Unknown'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.smallBtn,
                            inviteStatus === 'joined' ? styles.smallBtnGhost : styles.smallBtnPrimary,
                          ]}
                          disabled={!canAction}
                          onPress={() => (onlineMode ? onInviteConnect(f) : onAssignConnectOffline(f))}
                        >
                          <Text
                            style={
                              inviteStatus === 'joined'
                                ? styles.smallBtnGhostText
                                : styles.smallBtnPrimaryText
                            }
                          >
                            {onlineMode
                              ? inviteStatus === 'joined'
                                ? 'Joined ✓'
                                : inviteStatus === 'invited'
                                  ? 'Invited'
                                  : 'Invite'
                              : isAssignedOffline
                                ? 'Added ✓'
                                : 'Add'}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.progressLabel}>
                  <Text style={styles.progressText}>Connects selected</Text>
                  <Text style={styles.progressText}>
                    {selectedConnects.length} / {maxConnectSlots}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${connectProgressPct}%` }]} />
                </View>
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Seats</Text>
            {Array.from({ length: selectedPlayerCount }).map((_, i) => {
              const seat = players[i];
              const name =
                seat?.name ||
                (i === 0 ? myProfile?.fullName || 'You' : `Seat ${i + 1}`);
              return (
                <View key={`seat-${i}`} style={styles.seat}>
                  <View style={[styles.seatColor, { backgroundColor: COLORS[i === 1 && selectedPlayerCount === 2 ? 3 : i] }]} />
                  {seat?.avatar ? (
                    <ProfileImage uri={seat.avatar} pixelSize={80} style={styles.seatAvatar} />
                  ) : (
                    <View style={styles.seatAvatarFallback}>
                      <Text style={styles.avatarLetter}>{PLAYER_LETTERS[i] || 'P'}</Text>
                    </View>
                  )}
                  <Text style={styles.seatName} numberOfLines={1}>{name}</Text>
                  {seat?.isBot ? <Text style={styles.botBadge}>CPU</Text> : null}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.confirm} onPress={onConfirmPlayerCount}>
            <Text style={styles.confirmText}>Start Game</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardSafeView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 16, 0.78)',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: THEME.bgElevated,
    borderRadius: THEME.radius,
    borderWidth: 1,
    borderColor: THEME.borderStrong,
    maxHeight: '92%',
    padding: 18,
  },
  close: {
    position: 'absolute',
    right: 10,
    top: 8,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: THEME.muted, fontSize: 28, lineHeight: 30 },
  icon: { fontSize: 28, textAlign: 'center', marginTop: 6 },
  title: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    color: THEME.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: { maxHeight: 460 },
  sectionTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
  },
  choiceGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  choice: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  choiceActive: {
    borderColor: THEME.accent,
    backgroundColor: 'rgba(46, 196, 182, 0.12)',
  },
  check: { position: 'absolute', top: 6, right: 8, color: THEME.accent, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  choiceCount: { color: THEME.text, fontSize: 20, fontWeight: '800' },
  choiceLabel: { color: THEME.muted, fontSize: 11 },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  modeInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  modeIcon: { fontSize: 20 },
  modeTitle: { color: THEME.text, fontWeight: '700', fontSize: 14 },
  modeDesc: { color: THEME.muted, fontSize: 11, marginTop: 2 },
  search: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 8,
  },
  searchInput: {
    color: THEME.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  connectList: { gap: 6, marginBottom: 10 },
  empty: { alignItems: 'center', padding: 12, gap: 8 },
  emptyText: { color: THEME.muted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 10,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  connectSelected: { borderColor: THEME.accent },
  connectLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, minWidth: 0 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a3a4c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: THEME.text, fontWeight: '800', fontSize: 12 },
  connectName: { color: THEME.text, fontWeight: '600', flex: 1 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  smallBtnPrimary: { backgroundColor: THEME.accent },
  smallBtnPrimaryText: { color: '#06241f', fontWeight: '700', fontSize: 12 },
  smallBtnGhost: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  smallBtnGhostText: { color: THEME.text, fontWeight: '700', fontSize: 12 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: THEME.muted, fontSize: 12 },
  progressTrack: {
    height: 6,
    backgroundColor: THEME.surface,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: THEME.accent },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  seatColor: { width: 8, height: 8, borderRadius: 4 },
  seatAvatar: { width: 24, height: 24, borderRadius: 12 },
  seatAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2a3a4c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatName: { color: THEME.text, flex: 1, fontSize: 13 },
  botBadge: {
    color: THEME.accent2,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(62, 198, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  confirm: {
    marginTop: 12,
    backgroundColor: THEME.accent,
    borderRadius: 999,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#06241f', fontWeight: '800', fontSize: 15 },
});
