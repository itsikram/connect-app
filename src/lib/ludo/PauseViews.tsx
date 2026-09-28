import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from './constants';
import type { LocalSave } from './savedGames';
import { getSaveProgress } from './savedGames';

export interface PauseInfo {
  profileId?: string;
  name?: string;
  at?: number;
  local?: boolean;
  pending?: boolean;
}

interface PausedOverlayProps {
  pause: PauseInfo | null;
  isMine: boolean;
  canResume: boolean;
  onlineMode: boolean;
  resumeDenied: boolean;
  onResume: () => void;
  onSaveAndExit: () => void;
}

/**
 * Shown over the board while a match is paused. Online, only the host can
 * resume (their device runs the turn logic); everyone can save and exit and
 * pick the game up later from "Saved games".
 */
export const PausedOverlay: React.FC<PausedOverlayProps> = ({
  pause,
  isMine,
  canResume,
  onlineMode,
  resumeDenied,
  onResume,
  onSaveAndExit,
}) => {
  if (!pause) return null;
  const who = isMine ? 'You' : pause.name || 'A player';
  const subtitle = onlineMode
    ? canResume
      ? "Everyone's progress is saved. Resume when you're all ready."
      : 'Progress is saved. The host resumes the match.'
    : 'Your progress is saved on this device.';
  return (
    <View style={styles.overlay} testID="ludo-paused">
      <View style={styles.card}>
        <Text style={styles.icon}>⏸</Text>
        <Text style={styles.title}>Game paused</Text>
        <Text style={styles.by}>{pause.pending ? 'Pausing…' : `${who} paused the game`}</Text>
        <Text style={styles.copy}>{subtitle}</Text>
        {resumeDenied ? <Text style={styles.note}>Only the host can resume.</Text> : null}
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
            <Text style={styles.copy}>Waiting for the host…</Text>
          )}
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onSaveAndExit} testID="ludo-save-exit">
            <Text style={styles.btnGhostText}>Save & exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export interface SavedOnlineGame {
  gameId: string;
  paused?: boolean;
  isOnline?: boolean;
  playerCount?: number;
  lastPlayers?: any;
}

interface SavedGamesPanelProps {
  localSaves: LocalSave[];
  onlineGames: SavedOnlineGame[];
  maxSteps: number;
  onStartNew: () => void;
  onResumeLocal: (save: LocalSave) => void;
  onDeleteLocal: (save: LocalSave) => void;
  onResumeOnline: (game: SavedOnlineGame) => void;
  onRefresh: () => void;
}

const onlineStatus = (game: SavedOnlineGame) => {
  if (game.paused || game.lastPlayers?.paused) return 'Paused';
  return game.lastPlayers?.gameStarted ? 'In progress' : 'Waiting';
};

/** Menu shown when no board is open: start a game or resume a saved one. */
export const SavedGamesPanel: React.FC<SavedGamesPanelProps> = ({
  localSaves,
  onlineGames,
  maxSteps,
  onStartNew,
  onResumeLocal,
  onDeleteLocal,
  onResumeOnline,
  onRefresh,
}) => (
  <View style={styles.panel} testID="ludo-saved-games">
    <Text style={styles.panelTitle}>Ludo Classic</Text>
    <Text style={styles.copy}>Start a new match or pick up a saved one.</Text>
    <View style={styles.panelActions}>
      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onStartNew} testID="ludo-start-new">
        <Text style={styles.btnPrimaryText}>Start new game</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onRefresh}>
        <Text style={styles.btnGhostText}>Refresh</Text>
      </TouchableOpacity>
    </View>

    {localSaves.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved games</Text>
        {localSaves.map((save) => {
          const turnName = save.players?.[save.currentPlayer]?.name || 'Player';
          const savedAt = new Date(save.savedAt || Date.now());
          return (
            <View key={save.id} style={styles.row}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => onResumeLocal(save)}
                testID={`ludo-saved-${save.id}`}
              >
                <Text style={styles.rowIcon}>{save.playWithComputer ? '🤖' : '🎲'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {save.playWithComputer ? 'Vs computer' : 'Local match'} ·{' '}
                    {save.selectedPlayerCount || save.players.length} players
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {getSaveProgress(save, maxSteps)}% done · {turnName}'s turn ·{' '}
                    {savedAt.toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.cta}>{save.paused ? 'Paused · Resume' : 'Resume'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.delete}
                onPress={() => onDeleteLocal(save)}
                accessibilityLabel="Delete saved game"
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    )}

    {onlineGames.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Online games</Text>
        {onlineGames.map((game) => (
          <TouchableOpacity
            key={game.gameId}
            style={[styles.row, styles.rowMain]}
            onPress={() => onResumeOnline(game)}
            testID={`ludo-online-${game.gameId}`}
          >
            <Text style={styles.rowIcon}>🌐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                Game #{String(game.gameId).slice(-6)}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {game.playerCount || game.lastPlayers?.players?.length || 2} players · {onlineStatus(game)}
              </Text>
            </View>
            <Text style={styles.cta}>Resume</Text>
          </TouchableOpacity>
        ))}
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
  note: { marginTop: 8, fontSize: 13, color: THEME.warn },
  actions: { marginTop: 14, alignSelf: 'stretch', gap: 8 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
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
