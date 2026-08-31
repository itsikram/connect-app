import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { PLAYER_EMOJIS, PLAYER_LETTERS, THEME } from './constants';
import type { LudoInvite, Player } from './types';
import ProfileImage from '../../components/ProfileImage';

interface WinnerModalProps {
  winner: Player | null;
  gameEnded: boolean;
  onContinueGame: () => void;
  onEndGame: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({
  winner,
  gameEnded,
  onContinueGame,
  onEndGame,
}) => {
  if (!winner) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.glow, { backgroundColor: winner.color || THEME.accent }]} />
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.title}>{winner.name} Wins!</Text>
          <Text style={styles.muted}>Congratulations on your victory!</Text>
          <View style={styles.actions}>
            {!gameEnded && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: winner.color || THEME.accent }]}
                onPress={onContinueGame}
              >
                <Text style={styles.btnDark}>Continue Game</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={onEndGame}>
              <Text style={styles.btnDangerText}>End Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface GameEndedScreenProps {
  winners: Player[];
  onResetGame: () => void;
}

export const GameEndedScreen: React.FC<GameEndedScreenProps> = ({ winners, onResetGame }) => (
  <View style={styles.ended}>
    <Text style={styles.trophyLg}>🏆</Text>
    <Text style={styles.title}>Game Complete!</Text>
    <Text style={styles.muted}>All players have finished!</Text>
    {winners.map((w, i) => (
      <View key={String(w.id)} style={[styles.row, { backgroundColor: w.color }]}>
        <Text style={styles.rowText}>#{i + 1}</Text>
        <Text style={[styles.rowText, { flex: 1 }]}>{w.name}</Text>
        <Text style={styles.rowText}>{PLAYER_LETTERS[w.id] || PLAYER_EMOJIS[w.id]}</Text>
      </View>
    ))}
    <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 18 }]} onPress={onResetGame}>
      <Text style={styles.btnDark}>Play Again</Text>
    </TouchableOpacity>
  </View>
);

interface IncomingInviteModalProps {
  inviteRequest: LudoInvite | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingInviteModal: React.FC<IncomingInviteModalProps> = ({
  inviteRequest,
  onAccept,
  onDecline,
}) => {
  if (!inviteRequest) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth: 400 }]}>
          <View style={styles.inviteHead}>
            {inviteRequest.avatar ? (
              <ProfileImage uri={inviteRequest.avatar} pixelSize={96} style={styles.inviteAvatar} />
            ) : (
              <View style={styles.inviteAvatarFallback}>
                <Text style={styles.btnDark}>L</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { textAlign: 'left', fontSize: 18 }]}>Game Invite</Text>
              <Text style={[styles.muted, { textAlign: 'left' }]}>
                {inviteRequest.name || 'A friend'} invited you to play Ludo
              </Text>
            </View>
          </View>
          <Text style={[styles.muted, { textAlign: 'left', marginBottom: 14 }]}>
            Players: {inviteRequest.playerCount} · Slot #{(inviteRequest.slotIndex ?? 0) + 1}
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onDecline}>
              <Text style={{ color: THEME.text, fontWeight: '700' }}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onAccept}>
              <Text style={styles.btnDark}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface PlayerDockProps {
  currentPlayer?: Player;
  turnHint: string;
  renderPlayerOrder: number[];
  players: Player[];
  currentPlayerIndex: number;
  soundsEnabled: boolean;
  onToggleSounds: () => void;
  onOpenPlayerEditor?: (idx: number) => void;
}

export const PlayerDock: React.FC<PlayerDockProps> = ({
  currentPlayer,
  turnHint,
  renderPlayerOrder,
  players,
  currentPlayerIndex,
  soundsEnabled,
  onToggleSounds,
  onOpenPlayerEditor,
}) => (
  <View style={styles.dock}>
    <Text style={styles.dockLabel}>Current Turn</Text>
    <View style={[styles.turn, { backgroundColor: currentPlayer?.color || THEME.accent }]}>
      {currentPlayer?.avatar ? (
        <ProfileImage uri={currentPlayer.avatar} pixelSize={80} style={styles.turnAvatar} />
      ) : (
        <View style={[styles.turnAvatar, { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
      )}
      <Text style={styles.turnName} numberOfLines={1}>
        {currentPlayer?.name || 'Player'}
      </Text>
      <Text style={styles.turnHint}>{turnHint}</Text>
    </View>
    <View style={styles.chips}>
      {renderPlayerOrder.map((idx) => {
        const p = players[idx];
        if (!p) return null;
        return (
          <TouchableOpacity
            key={`pbtn-${idx}`}
            style={[
              styles.chip,
              { backgroundColor: p.color },
              idx === currentPlayerIndex && styles.chipActive,
            ]}
            onPress={() => onOpenPlayerEditor?.(idx)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Edit ${p.name || 'player'}`}
          >
            {p.avatar ? (
              <ProfileImage uri={p.avatar} pixelSize={64} style={styles.chipImg} />
            ) : (
              <Text style={styles.chipLetter}>{PLAYER_LETTERS[idx] || 'P'}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
    <TouchableOpacity
      style={[styles.tool, soundsEnabled && styles.toolOn]}
      onPress={onToggleSounds}
    >
      <Text style={styles.toolLabel}>{soundsEnabled ? 'Sound On' : 'Sound Off'}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 16, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.bgPanel,
    borderWidth: 1,
    borderColor: THEME.borderStrong,
    borderRadius: THEME.radius,
    padding: 22,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    top: 18,
    opacity: 0.35,
  },
  trophy: { fontSize: 44, marginBottom: 8 },
  trophyLg: { fontSize: 56, marginBottom: 8 },
  title: {
    color: THEME.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  muted: { color: THEME.muted, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  actions: { width: '100%', gap: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flex: 1,
  },
  btnPrimary: { backgroundColor: THEME.accent },
  btnDark: { color: '#06241f', fontWeight: '800' },
  btnDanger: {
    backgroundColor: 'rgba(232, 93, 93, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232, 93, 93, 0.4)',
  },
  btnDangerText: { color: '#ffc9c9', fontWeight: '800' },
  btnGhost: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  ended: {
    flex: 1,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  row: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowText: { color: '#06241f', fontWeight: '800' },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, width: '100%' },
  inviteAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: THEME.accent },
  inviteAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dock: {
    width: '100%',
    backgroundColor: THEME.bgPanel,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: THEME.radius,
    padding: 12,
    gap: 10,
  },
  dockLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: THEME.muted,
    fontWeight: '700',
  },
  turn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  turnAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
  turnName: { flex: 1, color: '#fff', fontWeight: '700' },
  turnHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipActive: { borderColor: '#fff', borderWidth: 3 },
  chipImg: { width: 36, height: 36, borderRadius: 18 },
  chipLetter: { color: '#06241f', fontWeight: '800' },
  tool: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolOn: { borderColor: THEME.accent },
  toolLabel: { color: THEME.text, fontWeight: '700', fontSize: 12 },
});
