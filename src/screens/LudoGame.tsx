import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width * 0.9, height * 0.6);
const CELL_SIZE = BOARD_SIZE / 15;

interface Position {
  x: number;
  y: number;
}

interface Piece {
  id: number;
  color: string;
  position: Position;
  isHome: boolean;
  isInPlay: boolean;
  steps: number;
}

interface Player {
  id: number;
  name: string;
  color: string;
  pieces: Piece[];
  isActive: boolean;
}

const LudoGame = () => {
  const { colors: themeColors } = useTheme();
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [canRollDice, setCanRollDice] = useState(true);

  // Exact colors from the image
  const colors = ['#FF0000', '#0000FF', '#FFFF00', '#00FF00'];
  const playerNames = ['Red', 'Blue', 'Yellow', 'Green'];
  const playerEmojis = ['🔴', '🔵', '🟡', '🟢'];

  // Animation refs
  const diceAnimation = useRef(new Animated.Value(0)).current;
  const pieceAnimations = useRef(Array(4).fill(null).map(() => new Animated.Value(0))).current;

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const newPlayers: Player[] = [];
    for (let i = 0; i < 4; i++) {
      const pieces: Piece[] = [];
      for (let j = 0; j < 4; j++) {
        pieces.push({
          id: j,
          color: colors[i],
          position: { x: 0, y: 0 },
          isHome: true,
          isInPlay: false,
          steps: 0,
        });
      }
      newPlayers.push({
        id: i,
        name: playerNames[i],
        color: colors[i],
        pieces,
        isActive: i === 0,
      });
    }
    setPlayers(newPlayers);
  };

  const rollDice = () => {
    if (!canRollDice || diceRolling) return;
    
    setDiceRolling(true);
    setCanRollDice(false);
    
    // Animate dice rolling
    Animated.sequence([
      Animated.timing(diceAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(diceAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(diceAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(diceAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const value = Math.floor(Math.random() * 6) + 1;
      setDiceValue(value);
      setDiceRolling(false);
      
      // Check if player can move any piece
      const currentPlayerData = players[currentPlayer];
      const canMove = currentPlayerData.pieces.some(piece => 
        piece.isInPlay || (piece.isHome && value === 6)
      );
      
      if (!canMove) {
        // Pass turn to next player
        setTimeout(() => {
          setCurrentPlayer((prev) => (prev + 1) % 4);
          setDiceValue(0);
          setCanRollDice(true);
        }, 1500);
      }
    });
  };

  const movePiece = (pieceId: number) => {
    if (diceValue === 0) return;
    
    const currentPlayerData = players[currentPlayer];
    const piece = currentPlayerData.pieces[pieceId];
    
    if (piece.isHome && diceValue === 6) {
      // Move piece out of home
      const updatedPlayers = [...players];
      updatedPlayers[currentPlayer].pieces[pieceId] = {
        ...piece,
        isHome: false,
        isInPlay: true,
        steps: 1,
      };
      setPlayers(updatedPlayers);
      setDiceValue(0);
      setCanRollDice(true);
    } else if (piece.isInPlay) {
      // Move piece on board
      const newSteps = piece.steps + diceValue;
      if (newSteps <= 57) { // Total steps to complete the game
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayer].pieces[pieceId] = {
          ...piece,
          steps: newSteps,
        };
        setPlayers(updatedPlayers);
        
        // Check for win
        if (newSteps === 57) {
          setWinner(currentPlayerData);
          Alert.alert('🎉 Game Over!', `${currentPlayerData.name} wins!`);
        } else {
          setDiceValue(0);
          setCanRollDice(true);
        }
      }
    }
    
    // If not a 6, pass turn to next player
    if (diceValue !== 6) {
      setTimeout(() => {
        setCurrentPlayer((prev) => (prev + 1) % 4);
        setDiceValue(0);
        setCanRollDice(true);
      }, 1000);
    }
  };

  const startGame = () => {
    setGameStarted(true);
    setCurrentPlayer(0);
    setDiceValue(0);
    setWinner(null);
    setCanRollDice(true);
    setDiceRolling(false);
  };

  const resetGame = () => {
    setGameStarted(false);
    setWinner(null);
    setDiceValue(0);
    setCurrentPlayer(0);
    setCanRollDice(true);
    setDiceRolling(false);
    initializeGame();
  };

  const renderBoard = () => {
    const board: React.JSX.Element[] = [];
    
    // Geometric Ludo board design matching the image
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        let cellColor = '#FFFFFF';
        let borderColor = '#000000';
        let isSpecial = false;
        
        // Center 3x3 area (finish area)
        if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
          cellColor = '#FFFFFF';
          borderColor = '#000000';
          isSpecial = true;
        }
        // Main playing paths (cross pattern)
        else if (
          (row === 7 && col >= 1 && col <= 13) || // Horizontal path
          (col === 7 && row >= 1 && row <= 13) // Vertical path
        ) {
          cellColor = '#FFFFFF';
          borderColor = '#000000';
          isSpecial = true;
        }
        // Start squares (colored squares on paths)
        else if (
          (row === 7 && col === 1) || // Red start
          (row === 1 && col === 7) || // Blue start  
          (row === 7 && col === 13) || // Yellow start
          (row === 13 && col === 7) // Green start
        ) {
          // Color based on position
          if (row === 7 && col === 1) cellColor = '#FF0000'; // Red start
          else if (row === 1 && col === 7) cellColor = '#0000FF'; // Blue start
          else if (row === 7 && col === 13) cellColor = '#FFFF00'; // Yellow start
          else if (row === 13 && col === 7) cellColor = '#00FF00'; // Green start
          borderColor = '#000000';
          isSpecial = true;
        }
        // Home columns (colored paths to center)
        else if (
          // Red home column (horizontal, right side)
          (row === 7 && col >= 2 && col <= 5) ||
          // Blue home column (vertical, bottom side)
          (col === 7 && row >= 2 && row <= 5) ||
          // Yellow home column (horizontal, left side)
          (row === 7 && col >= 9 && col <= 12) ||
          // Green home column (vertical, top side)
          (col === 7 && row >= 9 && row <= 12)
        ) {
          // Color based on position
          if (row === 7 && col >= 2 && col <= 5) cellColor = '#FF0000'; // Red column
          else if (col === 7 && row >= 2 && row <= 5) cellColor = '#0000FF'; // Blue column
          else if (row === 7 && col >= 9 && col <= 12) cellColor = '#FFFF00'; // Yellow column
          else if (col === 7 && row >= 9 && row <= 12) cellColor = '#00FF00'; // Green column
          borderColor = '#000000';
          isSpecial = true;
        }
        // Red home area (bottom-left)
        else if (row >= 9 && row <= 13 && col >= 1 && col <= 5) {
          cellColor = '#FF0000';
          borderColor = '#000000';
        }
        // Blue home area (top-left)
        else if (row >= 1 && row <= 5 && col >= 1 && col <= 5) {
          cellColor = '#0000FF';
          borderColor = '#000000';
        }
        // Yellow home area (top-right)
        else if (row >= 1 && row <= 5 && col >= 9 && col <= 13) {
          cellColor = '#FFFF00';
          borderColor = '#000000';
        }
        // Green home area (bottom-right)
        else if (row >= 9 && row <= 13 && col >= 9 && col <= 13) {
          cellColor = '#00FF00';
          borderColor = '#000000';
        }
        
        board.push(
          <View
            key={`${row}-${col}`}
            style={[
              styles.cell,
              {
                backgroundColor: cellColor,
                borderColor: borderColor,
                left: col * CELL_SIZE,
                top: row * CELL_SIZE,
                borderWidth: 1,
              },
            ]}
          />
        );
      }
    }
    
    // Add white token containers in home areas
    const tokenContainers = [
      // Blue home area (top-left)
      {x: 2, y: 2, width: 2, height: 2},
      // Yellow home area (top-right)  
      {x: 11, y: 2, width: 2, height: 2},
      // Red home area (bottom-left)
      {x: 2, y: 11, width: 2, height: 2},
      // Green home area (bottom-right)
      {x: 11, y: 11, width: 2, height: 2},
    ];
    
    tokenContainers.forEach((container, index) => {
      board.push(
        <View
          key={`container-${index}`}
          style={[
            styles.tokenContainer,
            {
              backgroundColor: '#FFFFFF',
              borderColor: '#000000',
              left: container.x * CELL_SIZE,
              top: container.y * CELL_SIZE,
              width: container.width * CELL_SIZE,
              height: container.height * CELL_SIZE,
            },
          ]}
        />
      );
    });
    
    return board;
  };

  const renderPieces = () => {
    const pieces: React.JSX.Element[] = [];
    
    players.forEach((player, playerIndex) => {
      player.pieces.forEach((piece, pieceIndex) => {
        let x, y;
        
        if (piece.isHome) {
          // Position pieces in white containers within home areas
          const homePositions = [
            // Blue (top-left) - in white container
            [{x: 2.5, y: 2.5}, {x: 3.5, y: 2.5}, {x: 2.5, y: 3.5}, {x: 3.5, y: 3.5}],
            // Yellow (top-right) - in white container
            [{x: 11.5, y: 2.5}, {x: 12.5, y: 2.5}, {x: 11.5, y: 3.5}, {x: 12.5, y: 3.5}],
            // Red (bottom-left) - in white container
            [{x: 2.5, y: 11.5}, {x: 3.5, y: 11.5}, {x: 2.5, y: 12.5}, {x: 3.5, y: 12.5}],
            // Green (bottom-right) - in white container
            [{x: 11.5, y: 11.5}, {x: 12.5, y: 11.5}, {x: 11.5, y: 12.5}, {x: 12.5, y: 12.5}],
          ];
          
          const pos = homePositions[playerIndex][pieceIndex];
          x = pos.x * CELL_SIZE;
          y = pos.y * CELL_SIZE;
        } else if (piece.isInPlay) {
          // Calculate position on the board path
          const pathPositions = [
            // Starting positions for each color
            {x: 7, y: 1}, // Red start
            {x: 1, y: 7}, // Blue start
            {x: 7, y: 13}, // Yellow start
            {x: 13, y: 7}, // Green start
          ];
          
          const startPos = pathPositions[playerIndex];
          x = startPos.x * CELL_SIZE;
          y = startPos.y * CELL_SIZE;
          
          // Move along the path based on steps
          if (piece.steps > 0) {
            // This is a simplified path calculation
            // In a real implementation, you'd follow the exact Ludo path
            x += (piece.steps * CELL_SIZE) % (BOARD_SIZE - CELL_SIZE);
          }
        }
        
        pieces.push(
          <Animated.View
            key={`${playerIndex}-${pieceIndex}`}
            style={[
              styles.piece,
              {
                backgroundColor: piece.color,
                left: x,
                top: y,
                transform: [
                  {
                    scale: pieceAnimations[pieceIndex] ? pieceAnimations[pieceIndex].interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2],
                    }) : 1,
                  },
                ],
              },
            ]}
          >
            <Text style={styles.pieceNumber}>{pieceIndex + 1}</Text>
          </Animated.View>
        );
      });
    });
    
    return pieces;
  };

  const renderPlayerArea = (player: Player, index: number) => {
    const isCurrentPlayer = index === currentPlayer;
    const piecesInPlay = player.pieces.filter(p => p.isInPlay).length;
    const piecesAtHome = player.pieces.filter(p => p.isHome).length;
    
    return (
      <View
        key={player.id}
        style={[
          styles.playerArea,
          {
            backgroundColor: isCurrentPlayer ? '#2a1a3a' : '#1a2332',
            borderColor: isCurrentPlayer ? player.color : '#2a2a2a',
          },
        ]}
      >
        <View style={styles.playerHeader}>
          <Text style={styles.playerEmoji}>{playerEmojis[index]}</Text>
          <View style={styles.playerInfo}>
            <Text style={[styles.playerName, { color: player.color }]}>
              {player.name}
            </Text>
            <Text style={styles.playerStats}>
              {piecesInPlay} in play • {piecesAtHome} at home
            </Text>
          </View>
          {isCurrentPlayer && (
            <View style={[styles.activeIndicator, { backgroundColor: player.color }]}>
              <Text style={styles.activeText}>TURN</Text>
            </View>
          )}
        </View>
        
        <View style={styles.piecesContainer}>
          {player.pieces.map((piece, pieceIndex) => (
            <TouchableOpacity
              key={pieceIndex}
              style={[
                styles.pieceButton,
                {
                  backgroundColor: piece.color,
                  opacity: piece.isHome ? 0.6 : 1,
                  borderColor: isCurrentPlayer && diceValue > 0 ? '#FFF' : 'transparent',
                  borderWidth: isCurrentPlayer && diceValue > 0 ? 2 : 0,
                },
              ]}
              onPress={() => {
                if (isCurrentPlayer && diceValue > 0) {
                  movePiece(pieceIndex);
                }
              }}
              disabled={!isCurrentPlayer || diceValue === 0}
            >
              <Text style={styles.pieceText}>{pieceIndex + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (winner) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#0f1419' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
        <View style={styles.winnerContainer}>
          <Animated.View style={styles.winnerIcon}>
            <Icon name="emoji-events" size={100} color="#FFD700" />
          </Animated.View>
          <Text style={styles.winnerText}>
            🎉 {winner.name} Wins! 🎉
          </Text>
          <Text style={styles.winnerSubtext}>
            Congratulations on your victory!
          </Text>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: winner.color }]} onPress={resetGame}>
            <Icon name="refresh" size={20} color="white" />
            <Text style={styles.resetButtonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0f1419' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1419" />

      <ScrollView>
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="gamepad" size={24} color="#FFD700" />
          <Text style={styles.title}>Connect Ludo</Text>
        </View>
        {!gameStarted ? (
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Icon name="play-arrow" size={20} color="white" />
            <Text style={styles.startButtonText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.menuButton} onPress={resetGame}>
            <Icon name="refresh" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {gameStarted && (
        <>
          <View style={styles.gameInfo}>
            <View style={styles.currentPlayerInfo}>
              <Text style={styles.currentPlayerLabel}>Current Turn</Text>
              <View style={[styles.currentPlayerBadge, { backgroundColor: players[currentPlayer]?.color }]}>
                <Text style={styles.currentPlayerEmoji}>{playerEmojis[currentPlayer]}</Text>
                <Text style={styles.currentPlayerName}>{players[currentPlayer]?.name}</Text>
              </View>
            </View>
            
            <View style={styles.diceContainer}>
              <Animated.View
                style={[
                  styles.dice,
                  {
                    transform: [
                      {
                        rotate: diceAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity 
                  style={styles.diceButton} 
                  onPress={rollDice} 
                  disabled={!canRollDice || diceRolling}
                >
                  {diceValue > 0 ? (
                    <Text style={styles.diceText}>{diceValue}</Text>
                  ) : (
                    <Icon name="casino" size={30} color="white" />
                  )}
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.diceLabel}>
                {diceRolling ? 'Rolling...' : canRollDice ? 'Tap to Roll' : 'Move a Piece'}
              </Text>
            </View>
          </View>

          <View style={styles.boardContainer}>
            <View style={styles.board}>
              {renderBoard()}
              {renderPieces()}
            </View>
          </View>

          <View style={styles.playersContainer}>
            {players.map((player, index) => renderPlayerArea(player, index))}
          </View>
        </>
      )}
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1a2332',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 10,
  },
  startButton: {
    backgroundColor: '#00AA00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  menuButton: {
    backgroundColor: '#4444FF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1a2332',
    marginBottom: 10,
  },
  currentPlayerInfo: {
    flex: 1,
  },
  currentPlayerLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 5,
  },
  currentPlayerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  currentPlayerEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  currentPlayerName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  diceContainer: {
    alignItems: 'center',
  },
  dice: {
    width: 70,
    height: 70,
    backgroundColor: '#FFD700',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  diceButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  diceLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  boardContainer: {
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    position: 'relative',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: '#000000',
  },
  cell: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
  },
  tokenContainer: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  piece: {
    position: 'absolute',
    width: CELL_SIZE * 0.7,
    height: CELL_SIZE * 0.7,
    borderRadius: CELL_SIZE * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 2,
    borderColor: 'white',
  },
  pieceNumber: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  playersContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playerArea: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 2,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  playerStats: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  activeIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
  },
  piecesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pieceButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  pieceText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  winnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  winnerIcon: {
    marginBottom: 20,
  },
  winnerText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
  },
  winnerSubtext: {
    fontSize: 18,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default LudoGame;
