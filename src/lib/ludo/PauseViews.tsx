import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from './constants';
import type { GameSummary, LudoInvite } from './types';

export interface PauseInfo {
  profileId?: string;
  name?: string;
  at?: number;
  pending?: boolean;
}

interface PausedOverlayProps {
  pause: PauseInfo | null;
  isMine: boolean;
  canResume: boolean;
  onlineMode: boolean;
  onResume: () => void;
  onSaveAndExit: () => void;
}

/**
 * Shown over the board while a match is paused. The server keeps the game
 * (and every seat) saved; any player in it can resume, and everyone can save
 * and exit and pick the game up later from "Your games".
 */
export const PausedOverlay: React.FC<PausedOverlayProps> = ({
  pause,
  isMine,
  canResume,
  onlineMode,
  onResume,
  onSaveAndExit,
}) => {
  if (!pause) return null;
  const who = isMine ? 'You' : pause.name || 'A player';
  const subtitle = onlineMode
    ? canResume
      ? "Everyone's progress is saved. Resume when you're all ready."
      : 'Progress is saved. A player resumes the match.'
    : 'Your progress is saved. Resume any time.';
  return (
    <View style={styles.overlay} testID="ludo-paused">
      <View style={styles.card}>
        <Text style={styles.icon}>⏸</Text>
        <Text style={styles.title}>Game paused</Text>
        <Text style={styles.by}>{pause.pending ? 'Pausing…' : `${who} paused the game`}</Text>
        <Text style={styles.copy}>{subtitle}</Text>
        <View style={styles.actions}>
          {canResume ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, pause.pending && styles.btnDisabled]}
              onPress={onResume}
              disabled={Boolean(pause.pending)}
              testID="ludo-resume"
            >
              <Text style={styles.btnPrimaryText}>▶ Resume</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.copy}>Waiting for a player to resume…</Text>
          )}
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onSaveAndExit} testID="ludo-save-exit">
            <Text style={styles.btnGhostText}>Save & exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

interface GamesPanelProps {
  games: GameSummary[];
  invites: LudoInvite[];
  connected: boolean;
  onStartNew: () => void;
  onResume: (game: GameSummary) => void;
  onRemove: (game: GameSummary) => void;
  onRefresh: () => void;
  onAcceptInvite: (invite: LudoInvite) => void;
  onDeclineInvite: (invite: LudoInvite) => void;
}

const statusOf = (game: GameSummary) => {
  if (game.paused) return 'Paused';
  if (game.status === 'lobby') return 'Waiting';
  return 'In progress';
};

const labelOf = (game: GameSummary) => {
  if (game.mode === 'computer') return 'Vs computer';
  if (game.mode === 'local') return 'Pass & play';
  const others = (game.players || [])
    .filter((p) => p.seat !== game.mySeat && p.kind === 'human')
    .map((p) => p.name)
    .filter(Boolean);
  return others.join(', ') || 'Online match';
};

/** Menu shown when no board is open: start a game, resume one, answer invites. */
export const GamesPanel: React.FC<GamesPanelProps> = ({
  games,
  invites,
  connected,
  onStartNew,
  onResume,
  onRemove,
  onRefresh,
  onAcceptInvite,
  onDeclineInvite,
}) => (
  <View style={styles.panel} testID="ludo-your-games">
    <Text style={styles.panelTitle}>Ludo Classic</Text>
    <Text style={styles.copy}>
      Play the computer, pass and play, or invite connects online. Every game is saved — pause any time and pick it
      up later on any device.
    </Text>
    <View style={styles.panelActions}>
      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onStartNew} testID="ludo-start-new">
        <Text style={styles.btnPrimaryText}>Start new game</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onRefresh}>
        <Text style={styles.btnGhostText}>Refresh</Text>
      </TouchableOpacity>
    </View>
    {!connected && <Text style={styles.copy}>Connecting to the game server…</Text>}

    {invites.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invitations</Text>
        {invites.map((invite) => (
          <View key={`${invite.gameId}-${invite.inviteId || ''}`} style={[styles.row, styles.rowMain]}>
            <Text style={styles.rowIcon}>🎲</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {invite.name || 'A connect'} invited you
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {invite.playerCount || 2} players{invite.reinvite ? ' · come back to your seat' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onDeclineInvite(invite)} style={styles.smallBtn}>
              <Text style={styles.btnGhostText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onAcceptInvite(invite)}
              style={[styles.smallBtn, styles.btnPrimary]}
              testID={`ludo-invite-accept-${invite.gameId}`}
            >
              <Text style={styles.btnPrimaryText}>Join</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )}

    {games.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your games</Text>
        {games.map((game) => {
          const turn = game.players?.[game.currentPlayer];
          return (
            <View key={game.gameId} style={styles.row}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => onResume(game)}
                testID={`ludo-game-${game.gameId}`}
              >
                <Text style={styles.rowIcon}>{game.mode === 'computer' ? '🤖' : game.mode === 'local' ? '🎲' : '🌐'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {labelOf(game)} · {game.playerCount} players
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {game.progress || 0}% done
                    {turn && game.status === 'playing' ? ` · ${turn.name}'s turn` : ''}
                    {game.updatedAt ? ` · ${new Date(game.updatedAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <Text style={styles.cta}>{statusOf(game)} · Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.delete}
                onPress={() => onRemove(game)}
                accessibilityLabel={game.isHost ? 'Delete game' : 'Leave game'}
                testID={`ludo-game-remove-${game.gameId}`}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 120,
    elevation: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(8, 14, 20, 0.66)',
  },
  card: {
    width: '100%',
    maxWidth: 300,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.borderStrong,
    backgroundColor: THEME.bgPanel,
    alignItems: 'center',
  },
  icon: { fontSize: 28, marginBottom: 4, color: THEME.text },
  title: { fontSize: 20, fontWeight: '800', color: THEME.text },
  by: { marginTop: 4, fontWeight: '600', color: THEME.accent },
  copy: { marginTop: 6, fontSize: 13, color: THEME.muted, textAlign: 'center' },
  actions: { marginTop: 14, alignSelf: 'stretch', gap: 8 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: THEME.accent },
  btnPrimaryText: { color: '#06241f', fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  btnGhost: { borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.surface },
  btnGhostText: { color: THEME.text, fontWeight: '700' },
  panel: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, gap: 4 },
  panelTitle: { fontSize: 22, fontWeight: '800', color: THEME.text, textAlign: 'center' },
  panelActions: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12 },
  section: { marginTop: 18, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: THEME.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  rowIcon: { fontSize: 20 },
  rowTitle: { color: THEME.text, fontWeight: '700' },
  rowSub: { color: THEME.muted, fontSize: 12, marginTop: 2 },
  cta: { color: THEME.accent, fontWeight: '800', fontSize: 12 },
  delete: {
    width: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232, 93, 93, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: THEME.danger, fontSize: 16 },
});
