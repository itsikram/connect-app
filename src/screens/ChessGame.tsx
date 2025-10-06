import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useChessGame } from '../contexts/ChessGameContext';

const BOARD_SIZE = 8;

const ChessGame: React.FC = () => {
  const { colors: themeColors } = useTheme();
  const { setChessGameActive } = useChessGame();

  const renderSquare = (row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    return (
      <View
        key={`${row}-${col}`}
        style={{
          flex: 1,
          aspectRatio: 1,
          backgroundColor: isDark ? '#769656' : '#EEEED2',
        }}
      />
    );
  };

  const renderRow = (row: number) => {
    return (
      <View key={`row-${row}`} style={styles.row}>
        {new Array(BOARD_SIZE).fill(null).map((_, col) => renderSquare(row, col))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>Chess</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: themeColors.surface.primary }]} onPress={() => setChessGameActive(false)}>
          <Text style={{ color: themeColors.text.primary }}>Close</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.board}>
        {new Array(BOARD_SIZE).fill(null).map((_, row) => renderRow(row))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  board: {
    aspectRatio: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 3,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
});

export default ChessGame;


