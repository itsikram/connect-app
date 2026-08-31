import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from './constants';

interface GameHeaderProps {
  gameStarted: boolean;
  playWithComputer: boolean;
  gameId: string | null;
  onStartGame: () => void;
  onResetGame: () => void;
  onExitGame: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  gameStarted,
  playWithComputer,
  gameId,
  onStartGame,
  onResetGame,
  onExitGame,
}) => {
  const showExit = Boolean(gameId) || gameStarted;
  const subtitle = gameStarted
    ? gameId
      ? 'Online match'
      : playWithComputer
        ? 'Vs computer'
        : 'Local match'
    : 'Ready to play';

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <View style={styles.markGrid}>
            <View style={[styles.markCell, { backgroundColor: '#E53935' }]} />
            <View style={[styles.markCell, { backgroundColor: '#43A047' }]} />
            <View style={[styles.markCell, { backgroundColor: '#1E88E5' }]} />
            <View style={[styles.markCell, { backgroundColor: '#FDD835' }]} />
          </View>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.title} numberOfLines={1}>Ludo Classic</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {!gameStarted ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onStartGame}>
            <Text style={styles.btnPrimaryText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={onResetGame}>
            <Text style={styles.btnDangerText}>Restart</Text>
          </TouchableOpacity>
        )}
        {showExit && (
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onExitGame}>
            <Text style={styles.btnGhostText}>Leave</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(12, 18, 25, 0.88)',
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGrid: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  markCell: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.muted,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: THEME.accent,
  },
  btnPrimaryText: {
    color: '#06241f',
    fontWeight: '700',
    fontSize: 13,
  },
  btnGhost: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  btnGhostText: {
    color: THEME.text,
    fontWeight: '700',
    fontSize: 13,
  },
  btnDanger: {
    backgroundColor: 'rgba(232, 93, 93, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232, 93, 93, 0.4)',
  },
  btnDangerText: {
    color: '#ffc9c9',
    fontWeight: '700',
    fontSize: 13,
  },
});
