import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useChessGame } from '../contexts/ChessGameContext';
import { Chess } from 'chess.js';
import { unicodeForPiece } from '../lib/chessEngine';
import { Emitter } from 'react-native-particles';

const BOARD_SIZE = 8;
const FILES = ['a','b','c','d','e','f','g','h'];

const ChessGame: React.FC = () => {
  const { colors: themeColors } = useTheme();
  const { setChessGameActive } = useChessGame();

  const [engine] = React.useState(() => new Chess());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [legalTargets, setLegalTargets] = React.useState<string[]>([]);
  const [fenVersion, setFenVersion] = React.useState(0); // force re-render on engine change
  const [promotionFromTo, setPromotionFromTo] = React.useState<{from: string; to: string} | null>(null);

  const turnColor = engine.turn();
  const gameOver = engine.isGameOver();
  const inCheck = engine.isCheck();

  const handleSquarePress = (square: string) => {
    if (promotionFromTo) return; // wait for promotion choice

    if (selected === square) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    const piece = engine.get(square as any);

    // If selecting own piece, show legal moves
    if (piece && piece.color === turnColor) {
      const moves = engine.moves({ square: square as any, verbose: true }) as any[];
      setSelected(square);
      setLegalTargets(moves.map(m => m.to));
      return;
    }

    // If clicking a legal target from previously selected
    if (selected && legalTargets.includes(square)) {
      const moves = engine.moves({ square: selected as any, verbose: true }) as any[];
      const move = moves.find(m => m.to === square);
      if (!move) return;

      // Handle promotion: ask user if promotion exists or if it's a pawn reaching last rank
      const needsPromotion = move.promotion || (move.piece === 'p' && (square.endsWith('8') || square.endsWith('1')));
      if (needsPromotion) {
        setPromotionFromTo({ from: selected, to: square });
        return;
      }

      engine.move({ from: selected as any, to: square as any, promotion: undefined as any });
      setSelected(null);
      setLegalTargets([]);
      setFenVersion(v => v + 1);
      return;
    }

    // Otherwise clear selection
    setSelected(null);
    setLegalTargets([]);
  };

  const doPromote = (piece: 'q'|'r'|'b'|'n') => {
    if (!promotionFromTo) return;
    engine.move({ from: promotionFromTo.from as any, to: promotionFromTo.to as any, promotion: piece });
    setPromotionFromTo(null);
    setSelected(null);
    setLegalTargets([]);
    setFenVersion(v => v + 1);
  };

  const undo = () => {
    engine.undo();
    setSelected(null);
    setLegalTargets([]);
    setFenVersion(v => v + 1);
  };

  const reset = () => {
    engine.reset();
    setSelected(null);
    setLegalTargets([]);
    setFenVersion(v => v + 1);
  };

  const renderSquare = (row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    const square = `${FILES[col]}${row + 1}`; // a1 bottom-left in our mapping
    const piece = engine.get(square as any) as any;
    const isSelected = selected === square;
    const isTarget = legalTargets.includes(square);

    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        activeOpacity={0.8}
        onPress={() => handleSquarePress(square)}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            aspectRatio: 1,
            backgroundColor: isSelected
              ? '#BACA2B'
              : isTarget
              ? '#B3C3A8'
              : isDark
              ? '#769656'
              : '#EEEED2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {piece && (
            <Text style={{ fontSize: 32 }}>
              {unicodeForPiece(piece.type, piece.color)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRow = (row: number) => {
    // chess.js uses ranks 1..8 bottom to top for white viewpoint; we'll render 0..7 but map rank = row+1
    return (
      <View key={`row-${row}`} style={styles.row}>
        {new Array(BOARD_SIZE).fill(null).map((_, col) => renderSquare(row, col))}
      </View>
    );
  };

  const { width, height } = Dimensions.get('window');

  return (
    <View style={styles.bg} key={`fen-${fenVersion}`}>
      <View style={StyleSheet.absoluteFillObject}>
        <Emitter
          numberOfParticles={80}
          emissionRate={3}
          interval={150}
          particleLife={5000}
          direction={-90}
          spread={360}
          speed={3}
          gravity={0.15}
          fromPosition={() => ({ x: Math.random() * width, y: height })}
          infiniteLoop={true}
          autoStart={true}
          width={width}
          height={height}
        >
          <View style={{ width: 6, height: 6, backgroundColor: '#FFFFFF', borderRadius: 3, opacity: 0.9 }} />
        </Emitter>
      </View>
      <View style={[styles.container]}> 
        <View style={styles.topBar}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>Chess</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: themeColors.surface.primary }]} onPress={undo}>
            <Text style={{ color: themeColors.text.primary }}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: themeColors.surface.primary }]} onPress={reset}>
            <Text style={{ color: themeColors.text.primary }}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: themeColors.surface.primary }]} onPress={() => setChessGameActive(false)}>
            <Text style={{ color: themeColors.text.primary }}>Close</Text>
          </TouchableOpacity>
        </View>
        </View>

        <Text style={{ textAlign: 'center', marginBottom: 8, color: themeColors.text.secondary }}>
        {gameOver
          ? engine.isCheckmate()
            ? 'Checkmate'
            : engine.isStalemate()
            ? 'Stalemate'
            : engine.isThreefoldRepetition()
            ? 'Threefold repetition'
            : engine.isInsufficientMaterial()
            ? 'Draw by insufficient material'
            : 'Draw'
          : `${turnColor === 'w' ? 'White' : 'Black'} to move${inCheck ? ' (check)' : ''}`}
        </Text>

        <View style={styles.board}>
        {/* Render ranks 8..1 top to bottom for standard board orientation */}
        {new Array(BOARD_SIZE)
          .fill(null)
          .map((_, idx) => BOARD_SIZE - 1 - idx)
          .map(row => renderRow(row))}
        </View>

        <Modal transparent visible={!!promotionFromTo} animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: themeColors.surface.primary }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text.primary }]}>Choose promotion</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {(['q','r','b','n'] as const).map(p => (
                  <TouchableOpacity key={p} style={styles.promoBtn} onPress={() => doPromote(p)}>
                    <Text style={{ fontSize: 18 }}>{p.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
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
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '80%',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  promoBtn: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});

export default ChessGame;


