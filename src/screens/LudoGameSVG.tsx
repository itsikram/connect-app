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
  Modal,
  Easing,
} from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  G,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useLudoGame } from '../contexts/LudoGameContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Logo from '../components/Logo';
import { Emitter } from 'react-native-particles';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width * 0.85, height * 0.6);
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

const LudoGameSVG = () => {
  const { colors: themeColors } = useTheme();
  const { setLudoGameActive } = useLudoGame();
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winners, setWinners] = useState<Player[]>([]);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [canRollDice, setCanRollDice] = useState(true);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [captureAnimations, setCaptureAnimations] = useState<{[key: string]: boolean}>({});

  // Original Ludo colors
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  const playerNames = ['Red', 'Green', 'Blue', 'Yellow'];
  const playerEmojis = ['🔴', '🟢', '🔵', '🟡'];

  // Animation refs
  const diceAnimation = useRef(new Animated.Value(0)).current;
  const tokenStrokeAnimations = useRef(Array(16).fill(null).map(() => new Animated.Value(0))).current;
  const tokenPositionAnimations = useRef(Array(16).fill(null).map(() => ({
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0)
  }))).current;
  
  // Separate animated values for native driver animations (scale and opacity)
  const tokenNativeScaleAnimations = useRef(Array(16).fill(null).map(() => new Animated.Value(1))).current;
  const tokenNativeOpacityAnimations = useRef(Array(16).fill(null).map(() => new Animated.Value(1))).current;

  // Winner celebration animations
  const confettiAnimations = useRef(Array(50).fill(null).map(() => ({
    translateY: new Animated.Value(-100),
    translateX: new Animated.Value(0),
    rotate: new Animated.Value(0),
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }))).current;
  const winnerScaleAnimation = useRef(new Animated.Value(0)).current;
  const winnerRotationAnimation = useRef(new Animated.Value(0)).current;
  const winnerGlowAnimation = useRef(new Animated.Value(0)).current;
  const modalScaleAnimation = useRef(new Animated.Value(0)).current;
  const modalOpacityAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = (playerCount: number = selectedPlayerCount) => {
    const newPlayers: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
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
    
    // Initialize all token position animations to home positions
    newPlayers.forEach((player, playerIndex) => {
      player.pieces.forEach((piece, pieceIndex) => {
        const globalPieceIndex = playerIndex * 4 + pieceIndex;
        const homePositions = [
          // Red (top-left)
          [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
          // Green (top-right)
          [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
          // Blue (bottom-left)
          [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
          // Yellow (bottom-right)
          [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
        ];
        const pos = homePositions[playerIndex][pieceIndex];
        tokenPositionAnimations[globalPieceIndex].translateX.setValue(pos.x * CELL_SIZE);
        tokenPositionAnimations[globalPieceIndex].translateY.setValue(pos.y * CELL_SIZE);
      });
    });
  };

  const rollDice = () => {
    if (!canRollDice || diceRolling) return;

    setDiceRolling(true);
    setCanRollDice(false);

    // Animate dice rolling
    Animated.sequence([
      Animated.timing(diceAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(diceAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(diceAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(diceAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const value = Math.floor(Math.random() * 6) + 1;
      setDiceValue(value);
      setDiceRolling(false);

      // Check if player can move any piece
      const currentPlayerData = players[currentPlayer];
      const maxSteps = 59;
      const canMove = currentPlayerData.pieces.some(piece => {
        if (piece.isHome && value === 6) return true;
        if (piece.isInPlay && piece.steps + value <= maxSteps) return true;
        return false;
      });

      if (canMove) {
        // Start stroke animations for movable pieces
        currentPlayerData.pieces.forEach((piece, pieceIndex) => {
          const globalPieceIndex = currentPlayer * 4 + pieceIndex;
          const canMovePiece = (piece.isHome && value === 6) || 
                               (piece.isInPlay && piece.steps + value <= maxSteps);
          if (canMovePiece) {
            startTokenStrokeAnimation(globalPieceIndex);
          }
        });
      } else {
        // No valid moves, automatically pass turn
        setTimeout(() => {
          // Stop stroke animations only for current player's pieces
          currentPlayerData.pieces.forEach((piece, pieceIndex) => {
            const globalPieceIndex = currentPlayer * 4 + pieceIndex;
            stopTokenStrokeAnimation(globalPieceIndex);
          });
          
          // Find next player who hasn't won
          let nextPlayer = (currentPlayer + 1) % selectedPlayerCount;
          let attempts = 0;
          while (attempts < selectedPlayerCount) {
            const playerWon = winners.some(w => w.id === nextPlayer);
            if (!playerWon) break;
            nextPlayer = (nextPlayer + 1) % selectedPlayerCount;
            attempts++;
          }
          
          setCurrentPlayer(nextPlayer);
          setDiceValue(0);
          setCanRollDice(true);
        }, 1500);
      }
    });
  };

  const startTokenStrokeAnimation = (pieceId: number) => {
    const strokeAnimation = tokenStrokeAnimations[pieceId];
    const bounceAnimation = tokenNativeScaleAnimations[pieceId];
    const pulseAnimation = tokenNativeOpacityAnimations[pieceId];

    // Stroke animation (border effect)
    Animated.loop(
      Animated.sequence([
        Animated.timing(strokeAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(strokeAnimation, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Bounce animation (scale effect) - using native driver
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnimation, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse animation (opacity effect) - using native driver
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopTokenStrokeAnimation = (pieceId: number) => {
    tokenStrokeAnimations[pieceId].stopAnimation();
    tokenStrokeAnimations[pieceId].setValue(0);
    tokenNativeScaleAnimations[pieceId].stopAnimation();
    tokenNativeScaleAnimations[pieceId].setValue(1);
    tokenNativeOpacityAnimations[pieceId].stopAnimation();
    tokenNativeOpacityAnimations[pieceId].setValue(1);
  };

  const startWinnerCelebration = () => {
    // Reset all confetti animations
    confettiAnimations.forEach(confetti => {
      confetti.translateY.setValue(-100);
      confetti.translateX.setValue(Math.random() * width);
      confetti.rotate.setValue(0);
      confetti.scale.setValue(0);
      confetti.opacity.setValue(0);
    });

    // Animate confetti falling
    confettiAnimations.forEach((confetti, index) => {
      Animated.sequence([
        Animated.delay(index * 50),
        Animated.parallel([
          Animated.timing(confetti.translateY, {
            toValue: height + 100,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(confetti.translateX, {
            toValue: Math.random() * width + (Math.random() - 0.5) * 200,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(confetti.rotate, {
            toValue: Math.random() * 720,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(confetti.scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(confetti.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    // Winner icon animations
    Animated.parallel([
      Animated.spring(winnerScaleAnimation, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(winnerRotationAnimation, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(winnerRotationAnimation, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(winnerGlowAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(winnerGlowAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();

    // Modal entrance animation
    Animated.parallel([
      Animated.spring(modalScaleAnimation, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const continueGame = () => {
    setShowWinnerModal(false);
    setWinner(null);
    
    // Reset winner animations
    winnerScaleAnimation.setValue(0);
    winnerRotationAnimation.setValue(0);
    winnerGlowAnimation.setValue(0);
    modalScaleAnimation.setValue(0);
    modalOpacityAnimation.setValue(0);
    
    // Stop confetti
    confettiAnimations.forEach(confetti => {
      confetti.translateY.stopAnimation();
      confetti.translateX.stopAnimation();
      confetti.rotate.stopAnimation();
      confetti.scale.stopAnimation();
      confetti.opacity.stopAnimation();
    });

    // Find next player who hasn't won
    let nextPlayer = (currentPlayer + 1) % selectedPlayerCount;
    let attempts = 0;
    while (attempts < selectedPlayerCount) {
      const playerWon = winners.some(w => w.id === nextPlayer);
      if (!playerWon) break;
      nextPlayer = (nextPlayer + 1) % selectedPlayerCount;
      attempts++;
    }

    setCurrentPlayer(nextPlayer);
    setDiceValue(0);
    setCanRollDice(true);
  };

  const endGame = () => {
    setShowWinnerModal(false);
    setGameEnded(true);
    setWinner(null);
    
    // Reset all animations
    winnerScaleAnimation.setValue(0);
    winnerRotationAnimation.setValue(0);
    winnerGlowAnimation.setValue(0);
    modalScaleAnimation.setValue(0);
    modalOpacityAnimation.setValue(0);
    
    // Stop confetti
    confettiAnimations.forEach(confetti => {
      confetti.translateY.stopAnimation();
      confetti.translateX.stopAnimation();
      confetti.rotate.stopAnimation();
      confetti.scale.stopAnimation();
      confetti.opacity.stopAnimation();
    });
  };

  const animateTokenMovement = (pieceId: number, fromSteps: number, toSteps: number, playerIndex: number, onComplete?: () => void) => {
    const animationDuration = 300; // Duration for each step
    const steps = toSteps - fromSteps;
    
    if (steps <= 0) {
      onComplete?.();
      return;
    }

    const animateStep = (currentStep: number) => {
      if (currentStep > steps) {
        onComplete?.();
        return;
      }

      const targetSteps = fromSteps + currentStep;
      const targetPosition = getPositionOnPath(playerIndex, targetSteps);
      
      const targetX = targetPosition.x * CELL_SIZE;
      const targetY = targetPosition.y * CELL_SIZE;

      Animated.parallel([
        Animated.timing(tokenPositionAnimations[pieceId].translateX, {
          toValue: targetX,
          duration: animationDuration,
          useNativeDriver: false,
        }),
        Animated.timing(tokenPositionAnimations[pieceId].translateY, {
          toValue: targetY,
          duration: animationDuration,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Move to next step
        animateStep(currentStep + 1);
      });
    };

    // Start the step-by-step animation
    animateStep(1);
  };

  // Calculate position on the Ludo board path
  const getPositionOnPath = (playerIndex: number, steps: number) => {
    // Define the path positions for each player (52 main path + 5 home stretch + 1 finish = 58 total)
    const paths = {
      0: [ // Red player path (starting from bottom-left going up)
        // Starting position and main path (52 steps)
        { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
        { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
        { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
        { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
        { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
        { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
        { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
        { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
        { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
        { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
        { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
        { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
        // Home stretch (6 steps to center)
        { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }
      ],

      1: [ // Green player path (starting from top-right going down)
        // Starting position and main path (52 steps)
        { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
        { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
        { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
        { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
        { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
        { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
        { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
        { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
        { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
        { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
        { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
        { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
        // Home stretch (6 steps to center)
        { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }, { x: 7, y: 7 }
      ],

      2: [ // Blue player path (starting from bottom-left going right)
        // Starting position and main path (52 steps)
        { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
        { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
        { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
        { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
        { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
        { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
        { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
        { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
        { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
        { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
        { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
        { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
        // Home stretch (6 steps to center)
        { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }, { x: 7, y: 7 }
      ],

      3: [ // Yellow player path (starting from bottom-right going left)
        // Starting position and main path (52 steps)
        { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
        { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, 
        { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
        { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
        { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, 
        { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
        { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
        { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, 
        { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
        { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
        { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, 
        { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
        // Home stretch (6 steps to center)
        { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 7 }
      ]
    };

    const path = paths[playerIndex as keyof typeof paths];
    if (!path || steps <= 0 || steps > path.length) {
      return { x: 7, y: 7 }; // Return center position as fallback
    }

    return path[steps - 1];
  };

  const isSafePosition = (playerIndex: number, position: { x: number; y: number }) => {
    // Define safe positions (first cell of each player's home column)
    const safePositions = [
      // Red player safe position (first cell of red home column)
      { x: 1, y: 6 },
      // Green player safe position (first cell of green home column)  
      { x: 8, y: 1 },
      // Blue player safe position (first cell of blue home column)
      { x: 6, y: 13 },
      // Yellow player safe position (first cell of yellow home column)
      { x: 13, y: 8 },
    ];
    
    return safePositions[playerIndex] && 
           safePositions[playerIndex].x === position.x && 
           safePositions[playerIndex].y === position.y;
  };

  const checkForCapture = (movingPlayerIndex: number, newPosition: { x: number; y: number }) => {
    const capturedPieces: { playerIndex: number; pieceIndex: number }[] = [];
    
    // Check all other players' pieces for capture
    players.forEach((player, playerIndex) => {
      if (playerIndex === movingPlayerIndex) return; // Don't check against self
      
      player.pieces.forEach((piece, pieceIndex) => {
        if (piece.isInPlay) {
          // Pieces in home stretch (last 7 steps) cannot be captured
          if (piece.steps >= 52) return;
          
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          // Check if positions match (same cell)
          if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
            // Check if the piece being captured is in a safe position
            if (!isSafePosition(playerIndex, piecePosition)) {
              capturedPieces.push({ playerIndex, pieceIndex });
            }
          }
        }
      });
    });
    
    return capturedPieces;
  };

  const captureToken = (playerIndex: number, pieceIndex: number) => {
    const globalPieceIndex = playerIndex * 4 + pieceIndex;
    const capturedPiece = players[playerIndex].pieces[pieceIndex];
    const captureKey = `${playerIndex}-${pieceIndex}`;
    
    // Set capture animation state
    setCaptureAnimations(prev => ({ ...prev, [captureKey]: true }));
    
    // Get home position for the captured piece
    const homePositions = [
      // Red (top-left)
      [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
      // Green (top-right)
      [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
      // Blue (bottom-left)
      [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
      // Yellow (bottom-right)
      [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
    ];
    
    const homePos = homePositions[playerIndex][pieceIndex];
    const homeX = homePos.x * CELL_SIZE;
    const homeY = homePos.y * CELL_SIZE;
    
    // Create a dramatic capture animation sequence
    Animated.sequence([
      // First, make the token "jump" and scale up to show it's being captured
      Animated.parallel([
        Animated.timing(tokenNativeScaleAnimations[globalPieceIndex], {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tokenNativeOpacityAnimations[globalPieceIndex], {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // Then animate it back to home with a smooth curve
      Animated.parallel([
        Animated.timing(tokenPositionAnimations[globalPieceIndex].translateX, {
          toValue: homeX,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(tokenPositionAnimations[globalPieceIndex].translateY, {
          toValue: homeY,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(tokenNativeScaleAnimations[globalPieceIndex], {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(tokenNativeOpacityAnimations[globalPieceIndex], {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Update the piece state after animation
      const updatedPlayers = [...players];
      updatedPlayers[playerIndex].pieces[pieceIndex] = {
        ...capturedPiece,
        isHome: true,
        isInPlay: false,
        steps: 0,
      };
      setPlayers(updatedPlayers);
      
      // Clear capture animation state
      setCaptureAnimations(prev => {
        const newState = { ...prev };
        delete newState[captureKey];
        return newState;
      });
    });
  };

  const movePiece = (pieceId: number) => {
    if (diceValue === 0) return;

    const currentPlayerData = players[currentPlayer];
    const piece = currentPlayerData.pieces[pieceId];
    const maxSteps = 59;

    // Validate the move
    if (piece.isHome && diceValue !== 6) return;
    if (piece.isInPlay && piece.steps + diceValue > maxSteps) return;

    // Stop stroke animations for ALL current player's pieces
    currentPlayerData.pieces.forEach((_, pieceIndex) => {
      const globalIdx = currentPlayer * 4 + pieceIndex;
      stopTokenStrokeAnimation(globalIdx);
    });

    const globalPieceIndex = currentPlayer * 4 + pieceId;

    if (piece.isHome && diceValue === 6) {
      // Move piece out of home
      const startPosition = getPositionOnPath(currentPlayer, 1);
      const startX = startPosition.x * CELL_SIZE;
      const startY = startPosition.y * CELL_SIZE;

      // Animate piece moving out
      Animated.parallel([
        Animated.timing(tokenPositionAnimations[globalPieceIndex].translateX, {
          toValue: startX,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(tokenPositionAnimations[globalPieceIndex].translateY, {
          toValue: startY,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start(() => {
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayer].pieces[pieceId] = {
          ...piece,
          isHome: false,
          isInPlay: true,
          steps: 1,
        };
        setPlayers(updatedPlayers);

        // Check for captures at starting position
        const newPosition = getPositionOnPath(currentPlayer, 1);
        const capturedPieces = checkForCapture(currentPlayer, newPosition);
        capturedPieces.forEach(({ playerIndex, pieceIndex }) => {
          captureToken(playerIndex, pieceIndex);
        });

        setDiceValue(0);
        setCanRollDice(true);
        // Keep turn because rolled a 6
      });
    } else if (piece.isInPlay) {
      // Move piece on board with step-by-step animation
      const oldSteps = piece.steps;
      const newSteps = piece.steps + diceValue;
      const maxSteps = 59; // Total path length (52 main + 7 home stretch)

      if (newSteps <= maxSteps) {
        // Animate the movement step by step
        animateTokenMovement(globalPieceIndex, oldSteps, newSteps, currentPlayer, () => {
          // Animation completed, update the piece state
          const updatedPlayers = [...players];
          updatedPlayers[currentPlayer].pieces[pieceId] = {
            ...piece,
            steps: newSteps,
          };
          setPlayers(updatedPlayers);

          // Check for captures after movement (only if not at finish)
          if (newSteps < maxSteps) {
            const newPosition = getPositionOnPath(currentPlayer, newSteps);
            const capturedPieces = checkForCapture(currentPlayer, newPosition);
            
            // Capture any tokens that were landed on
            capturedPieces.forEach(({ playerIndex, pieceIndex }) => {
              captureToken(playerIndex, pieceIndex);
            });
          }

          // Check for win
          if (newSteps === maxSteps) {
            // Count how many pieces have finished
            const finishedCount = updatedPlayers[currentPlayer].pieces.filter(
              p => p.steps === maxSteps
            ).length;
            
            // Check if all 4 pieces have finished
            if (finishedCount === 4) {
              const newWinners = [...winners, currentPlayerData];
              setWinners(newWinners);
              setWinner(currentPlayerData);
              setShowWinnerModal(true);
              startWinnerCelebration();
              
              // Check if game should end
              const remainingPlayers = players.filter((_, index) => index < selectedPlayerCount);
              if (newWinners.length >= remainingPlayers.length - 1) {
                setGameEnded(true);
              }
              return;
            }
          }

          setDiceValue(0);

          // If not a 6, pass turn to next player
          if (diceValue !== 6) {
            setTimeout(() => {
              // Stop stroke animations for all pieces
              players.forEach((_, playerIndex) => {
                for (let i = 0; i < 4; i++) {
                  stopTokenStrokeAnimation(playerIndex * 4 + i);
                }
              });
              
              // Find next player who hasn't won
              let nextPlayer = (currentPlayer + 1) % selectedPlayerCount;
              let attempts = 0;
              while (attempts < selectedPlayerCount) {
                const playerWon = winners.some(w => w.id === nextPlayer);
                if (!playerWon) break;
                nextPlayer = (nextPlayer + 1) % selectedPlayerCount;
                attempts++;
              }
              
              setCurrentPlayer(nextPlayer);
              setCanRollDice(true);
            }, 500);
          } else {
            // Rolled a 6, keep the turn
            setCanRollDice(true);
          }
        });
      }
    }
  };

  const startGame = () => {
    setShowPlayerSelection(true);
  };

  const confirmPlayerCount = () => {
    setShowPlayerSelection(false);
    setGameStarted(true);
    setCurrentPlayer(0);
    setDiceValue(0);
    setWinner(null);
    setCanRollDice(true);
    setDiceRolling(false);
    initializeGame(selectedPlayerCount);
  };

  const resetGame = () => {
    // Stop all animations
    tokenStrokeAnimations.forEach((_, index) => {
      stopTokenStrokeAnimation(index);
    });
    setGameStarted(false);
    setWinner(null);
    setWinners([]);
    setGameEnded(false);
    setShowWinnerModal(false);
    setDiceValue(0);
    setCurrentPlayer(0);
    setCanRollDice(true);
    setDiceRolling(false);
    setShowPlayerSelection(false);
    setCaptureAnimations({});
    
    // Reset winner animations
    winnerScaleAnimation.setValue(0);
    winnerRotationAnimation.setValue(0);
    winnerGlowAnimation.setValue(0);
    modalScaleAnimation.setValue(0);
    modalOpacityAnimation.setValue(0);
    
    // Stop confetti
    confettiAnimations.forEach(confetti => {
      confetti.translateY.stopAnimation();
      confetti.translateX.stopAnimation();
      confetti.rotate.stopAnimation();
      confetti.scale.stopAnimation();
      confetti.opacity.stopAnimation();
    });
    
    initializeGame(selectedPlayerCount);
  };

  const closeGame = () => {
    setLudoGameActive(false);
  };

  const renderConfetti = () => {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {confettiAnimations.map((confetti, index) => (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: confetti.translateX,
              top: confetti.translateY,
              width: 8,
              height: 8,
              backgroundColor: colors[index % colors.length],
              borderRadius: 4,
              transform: [
                { rotate: confetti.rotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }) },
                { scale: confetti.scale },
              ],
              opacity: confetti.opacity,
            }}
          />
        ))}
      </View>
    );
  };

  const renderDiceDots = (value: number) => {
    const dotSize = 8;
    const diceSize = 60;
    const centerX = diceSize / 2;
    const centerY = diceSize / 2;
    const offset = 12;

    const dotPositions = {
      1: [{ x: centerX, y: centerY }],
      2: [
        { x: centerX - offset, y: centerY - offset },
        { x: centerX + offset, y: centerY + offset }
      ],
      3: [
        { x: centerX - offset, y: centerY - offset },
        { x: centerX, y: centerY },
        { x: centerX + offset, y: centerY + offset }
      ],
      4: [
        { x: centerX - offset, y: centerY - offset },
        { x: centerX + offset, y: centerY - offset },
        { x: centerX - offset, y: centerY + offset },
        { x: centerX + offset, y: centerY + offset }
      ],
      5: [
        { x: centerX - offset, y: centerY - offset },
        { x: centerX + offset, y: centerY - offset },
        { x: centerX, y: centerY },
        { x: centerX - offset, y: centerY + offset },
        { x: centerX + offset, y: centerY + offset }
      ],
      6: [
        { x: centerX - offset, y: centerY - offset },
        { x: centerX + offset, y: centerY - offset },
        { x: centerX - offset, y: centerY },
        { x: centerX + offset, y: centerY },
        { x: centerX - offset, y: centerY + offset },
        { x: centerX + offset, y: centerY + offset }
      ]
    };

    const positions = dotPositions[value as keyof typeof dotPositions] || [];

    return (
      <View style={{ width: diceSize, height: diceSize, position: 'relative' }}>
        {positions.map((pos, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: pos.x - dotSize / 2,
              top: pos.y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: '#1a1a2e',
            }}
          />
        ))}
      </View>
    );
  };

  const renderLudoBoard = () => {
    return (
      <Svg width={BOARD_SIZE} height={BOARD_SIZE} viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}>
        {/* Main board background */}
        <Rect
          x="0"
          y="0"
          width={BOARD_SIZE}
          height={BOARD_SIZE}
          fill="#FFFFFF"
          stroke="#000000"
          strokeWidth="2"
          rx="10"
          ry="10"
        />

        {/* Create 15x15 grid */}
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            let fillColor = "#FFFFFF";
            let strokeColor = "#f9f9f9";
            let strokeWidth = 1;

            // Home Areas (6x6 squares in corners) - always show all four
            // Red Home (Top-Left)
            if (row >= 0 && row <= 5 && col >= 0 && col <= 5) {
              fillColor = "#FF0000";
            }
            // Green Home (Top-Right)
            else if (row >= 0 && row <= 6 && col >= 9 && col <= 14) {
              fillColor = "#00FF00";
            }
            // Blue Home (Bottom-Left)
            else if (row >= 9 && row <= 14 && col >= 0 && col <= 5) {
              fillColor = "#0000FF";
            }
            // Yellow Home (Bottom-Right)
            else if (row >= 9 && row <= 14 && col >= 9 && col <= 14) {
              fillColor = "#FFFF00";
            }
            // Main playing paths (cross pattern)
            else if (
              (row === 7 && col >= 0 && col <= 14) || // Horizontal path
              (row === 8 && col >= 0 && col <= 14) || // Horizontal path
              (col === 7 && row >= 0 && row <= 14) || // Vertical path
              (col === 8 && row >= 0 && row <= 14) // Vertical path
            ) {
              fillColor = "#FFFFFF";
            }
            // Outer path around the board edges
            else if (
              (row === 0 && col >= 0 && col <= 14) || // Top edge
              (row === 14 && col >= 0 && col <= 14) || // Bottom edge
              (col === 0 && row >= 0 && row <= 14) || // Left edge
              (col === 14 && row >= 0 && row <= 14) // Right edge
            ) {
              fillColor = "#FFFFFF";
            }
            // Connecting paths from outer edge to home columns
            else if (
              // Path from top edge to blue home column
              (row >= 1 && row <= 5 && col === 7) ||
              // Path from right edge to green home column  
              (col >= 10 && col <= 14 && row === 7) ||
              // Path from bottom edge to red home column
              (row >= 10 && row <= 14 && col === 7) ||
              // Path from left edge to yellow home column
              (col >= 1 && col <= 5 && row === 7)
            ) {
              fillColor = "#FFFFFF";
            }
            // Center finish area (3x3)
            else if (row >= 7 && row <= 9 && col >= 7 && col <= 9) {
              fillColor = "#FFFFFF";
            }

            return (
              <Rect
                key={`cell-${row}-${col}`}
                x={col * CELL_SIZE}
                y={row * CELL_SIZE}
                width={CELL_SIZE}
                height={CELL_SIZE}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          })
        )}

        {/* Token Containers in home areas - always show all four */}
        {/* Red Token Container (Top-Left) */}
        <Rect
          x={CELL_SIZE * 1.5}
          y={CELL_SIZE * 1.5}
          width={CELL_SIZE * 3}
          height={CELL_SIZE * 3}
          fill="#29B1A9"
          stroke="#000000"
          strokeWidth="2"
          rx="8"
          ry="8"
        />

        {/* Green Token Container (Top-Right) */}
        <Rect
          x={CELL_SIZE * 10.5}
          y={CELL_SIZE * 1.5}
          width={CELL_SIZE * 3}
          height={CELL_SIZE * 3}
          fill="#29B1A9"
          stroke="#000000"
          strokeWidth="2"
          rx="8"
          ry="8"
        />

        {/* Blue Token Container (Bottom-Left) */}
        <Rect
          x={CELL_SIZE * 1.5}
          y={CELL_SIZE * 10.5}
          width={CELL_SIZE * 3}
          height={CELL_SIZE * 3}
          fill="#29B1A9"
          stroke="#000000"
          strokeWidth="2"
          rx="8"
          ry="8"
        />

        {/* Yellow Token Container (Bottom-Right) */}
        <Rect
          x={CELL_SIZE * 10.5}
          y={CELL_SIZE * 10.5}
          width={CELL_SIZE * 3}
          height={CELL_SIZE * 3}
          fill="#29B1A9"
          stroke="gray"
          strokeWidth="2"
          rx="8"
          ry="8"
        />

        {/* Start squares - always show all four */}
        {/* Red start (row 13, column 7) - bottom of left vertical path */}
        <Rect
          x={CELL_SIZE * 7}
          y={CELL_SIZE * 13}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FF0000"
          stroke="#000000"
          strokeWidth="2"
        />

        {/* Green start (row 7, column 13) - right of top horizontal path */}
        <Rect
          x={CELL_SIZE * 13}
          y={CELL_SIZE * 7}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#00FF00"
          stroke="#000000"
          strokeWidth="2"
        />

        {/* Blue start (row 2, column 7) - top of right vertical path */}
        <Rect
          x={CELL_SIZE * 7}
          y={CELL_SIZE * 2}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#0000FF"
          stroke="#000000"
          strokeWidth="2"
        />

        {/* Yellow start (row 7, column 2) - left of bottom horizontal path */}
        <Rect
          x={CELL_SIZE * 2}
          y={CELL_SIZE * 7}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FFFF00"
          stroke="#000000"
          strokeWidth="2"
        />

        {/* Home columns leading to center - 3 squares wide each - always show all four */}
        {/* Blue home column (rows 9-14, columns 6-8) - left vertical path */}
        {[9, 10, 11, 12, 13, 14].map((i) =>
          [6, 7, 8].map((j) => (
            <Rect
              key={`blue-col-${i}-${j}`}
              x={CELL_SIZE * j}
              y={CELL_SIZE * i}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="#0000FF"
              stroke="#000000"
              strokeWidth="1"
            />
          ))
        )}

        {/* Yellow home column (rows 6-8, columns 9-14) - bottom horizontal path */}
        {[6, 7, 8].map((i) =>
          [9, 10, 11, 12, 13, 14].map((j) => (
            <Rect
              key={`yellow-col-${i}-${j}`}
              x={CELL_SIZE * j}
              y={CELL_SIZE * i}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="#FFFF00"
              stroke="#000000"
              strokeWidth="1"
            />
          ))
        )}

        {/* Green home column (rows 1-6, columns 6-8) - right vertical path */}
        {[0, 1, 2, 3, 4, 5].map((i) =>
          [6, 7, 8].map((j) => (
            <Rect
              key={`green-col-${i}-${j}`}
              x={CELL_SIZE * j}
              y={CELL_SIZE * i}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="#00FF00"
              stroke="#000000"
              strokeWidth="1"
            />
          ))
        )}

        {/* Red home column (rows 6-8, columns 1-6) - top horizontal path */}
        {[6, 7, 8].map((i) =>
          [0, 1, 2, 3, 4, 5].map((j) => (
            <Rect
              key={`red-col-${i}-${j}`}
              x={CELL_SIZE * j}
              y={CELL_SIZE * i}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="#FF0000"
              stroke="#000000"
              strokeWidth="1"
            />
          ))
        )}


        {[6, 7, 8].map((i) =>
          [6, 7, 8].map((j) => (
            <Rect
              key={`red-green-${i}-${j}`}
              x={CELL_SIZE * j}
              y={CELL_SIZE * i}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="#29B1A9"
              stroke="#29B1A9"
              strokeWidth="1"
            />
          ))
        )}

        {/* Safe positions - first cell of each home column (cannot be captured) */}
        {/* Red safe position */}
        <Rect
          x={CELL_SIZE * 1}
          y={CELL_SIZE * 6}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FF0000"
          stroke="#000000"
          strokeWidth="3"
          strokeDasharray="5,5"
        />
        {/* Green safe position */}
        <Rect
          x={CELL_SIZE * 8}
          y={CELL_SIZE * 1}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#00FF00"
          stroke="#000000"
          strokeWidth="3"
          strokeDasharray="5,5"
        />
        {/* Blue safe position */}
        <Rect
          x={CELL_SIZE * 6}
          y={CELL_SIZE * 13}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#0000FF"
          stroke="#000000"
          strokeWidth="3"
          strokeDasharray="5,5"
        />
        {/* Yellow safe position */}
        <Rect
          x={CELL_SIZE * 13}
          y={CELL_SIZE * 8}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FFFF00"
          stroke="#000000"
          strokeWidth="3"
          strokeDasharray="5,5"
        />

        {/* Center triangular finish areas (3x3 center: rows 7-9, columns 7-9) - always show all four */}
        {/* Top triangle: Yellow - pointing downwards */}
        <Path
          d={`M ${CELL_SIZE * 9} ${CELL_SIZE * 7} L ${CELL_SIZE * 9} ${CELL_SIZE * 8} L ${CELL_SIZE * 8} ${CELL_SIZE * 7.5} Z`}
          fill="#FFFF00"
          strokeWidth="1"
        />
        {/* Right triangle: Green - pointing leftwards */}
        <Path
          d={`M ${CELL_SIZE * 7} ${CELL_SIZE * 6} L ${CELL_SIZE * 8} ${CELL_SIZE * 6} L ${CELL_SIZE * 7.5} ${CELL_SIZE * 7} Z`}
          fill="#00FF00"
          strokeWidth="1"
        />
        {/* Bottom triangle: Red - pointing upwards */}
        <Path
          d={`M ${CELL_SIZE * 6} ${CELL_SIZE * 7} L ${CELL_SIZE * 6} ${CELL_SIZE * 8} L ${CELL_SIZE * 7} ${CELL_SIZE * 7.5} Z`}
          fill="#FF0000"
          strokeWidth="1"
        />
        {/* Left triangle: Blue - pointing rightwards */}
        <Path
          d={`M ${CELL_SIZE * 7} ${CELL_SIZE * 9} L ${CELL_SIZE * 8} ${CELL_SIZE * 9} L ${CELL_SIZE * 7.5} ${CELL_SIZE * 8} Z`}
          fill="#0000FF"
          strokeWidth="1"
        />
      </Svg>
    );
  };

  const renderTokens = () => {
    const maxSteps = 59;
    return (
      <View style={StyleSheet.absoluteFillObject}>
        {players.map((player, playerIndex) =>
          player.pieces.map((piece, pieceIndex) => {
            const tokenSize = CELL_SIZE * 0.9;
            const globalPieceIndex = playerIndex * 4 + pieceIndex;
            const isCurrentPlayer = playerIndex === currentPlayer;
            const isActivePlayer = playerIndex < selectedPlayerCount;
            const canMove = isCurrentPlayer && diceValue > 0 && 
                           ((piece.isHome && diceValue === 6) || 
                            (piece.isInPlay && piece.steps + diceValue <= maxSteps));

            let staticX = 0;
            let staticY = 0;
            let useAnimation = false;

            if (piece.isHome) {
              // Position in token containers
              const homePositions = [
                // Red (top-left)
                [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
                // Green (top-right)
                [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
                // Blue (bottom-left)
                [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
                // Yellow (bottom-right)
                [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
              ];

              const pos = homePositions[playerIndex][pieceIndex];
              staticX = pos.x * CELL_SIZE;
              staticY = pos.y * CELL_SIZE;
            } else if (piece.isInPlay) {
              // Use animated position for pieces in play
              useAnimation = true;
            }

            if (useAnimation) {
              const captureKey = `${playerIndex}-${pieceIndex}`;
              const isBeingCaptured = captureAnimations[captureKey];
              
              // Render animated token with enhanced animations - separated into two layers
              return (
                <Animated.View
                  key={`animated-token-${playerIndex}-${pieceIndex}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: tokenSize,
                    height: tokenSize,
                    zIndex: isBeingCaptured ? 20 : 10,
                    transform: [
                      {
                        translateX: tokenPositionAnimations[globalPieceIndex].translateX,
                      },
                      {
                        translateY: tokenPositionAnimations[globalPieceIndex].translateY,
                      },
                    ],
                  }}
                >
                  <Animated.View
                    style={{
                      width: tokenSize,
                      height: tokenSize,
                      transform: [
                        {
                          scale: tokenNativeScaleAnimations[globalPieceIndex],
                        },
                      ],
                      opacity: tokenNativeOpacityAnimations[globalPieceIndex],
                    }}
                  >
                    <View
                      style={{
                        width: tokenSize,
                        height: tokenSize,
                        borderRadius: tokenSize / 2,
                        backgroundColor: piece.color,
                        borderWidth: isBeingCaptured ? 6 : piece.steps === maxSteps ? 5 : 4,
                        borderColor: isBeingCaptured ? '#FF4444' : piece.steps === maxSteps ? '#FFD700' : '#FFFFFF',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: isBeingCaptured ? '#FF4444' : piece.steps === maxSteps ? '#FFD700' : piece.color,
                        shadowOffset: { width: 0, height: isBeingCaptured ? 8 : piece.steps === maxSteps ? 8 : 6 },
                        shadowOpacity: isBeingCaptured ? 0.8 : piece.steps === maxSteps ? 1 : 0.4,
                        shadowRadius: isBeingCaptured ? 12 : piece.steps === maxSteps ? 12 : 8,
                        elevation: isBeingCaptured ? 12 : piece.steps === maxSteps ? 10 : 8,
                        opacity: isActivePlayer ? 1 : 0.3,
                      }}
                    >
                      <Text style={{
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: piece.steps === maxSteps ? 20 : 16,
                      }}>
                        {piece.steps === maxSteps ? '✓' : pieceIndex + 1}
                      </Text>
                      {isBeingCaptured && (
                        <View style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: '#FF4444',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Text style={{
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}>!</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                </Animated.View>
              );
            } else {
              // Render static token with conditional animations for movable pieces
              const shouldAnimate = isCurrentPlayer && diceValue > 0 && (piece.isHome && diceValue === 6);
              
              if (shouldAnimate) {
                return (
                  <View
                    key={`static-animated-token-${playerIndex}-${pieceIndex}`}
                    style={{
                      position: 'absolute',
                      left: staticX,
                      top: staticY,
                      width: tokenSize,
                      height: tokenSize,
                      zIndex: 10,
                    }}
                  >
                    <Animated.View
                      style={{
                        width: tokenSize,
                        height: tokenSize,
                        transform: [
                          {
                            scale: tokenNativeScaleAnimations[globalPieceIndex],
                          },
                        ],
                        opacity: tokenNativeOpacityAnimations[globalPieceIndex],
                      }}
                    >
                      <View
                        style={{
                          width: tokenSize,
                          height: tokenSize,
                          borderRadius: tokenSize / 2,
                          backgroundColor: piece.color,
                          borderWidth: 4,
                          borderColor: '#FFFFFF',
                          justifyContent: 'center',
                          alignItems: 'center',
                          shadowColor: '#000',
                          shadowOffset: { width: 2, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 3,
                          elevation: 5,
                        }}
                      >
                        <Text style={{
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: 16,
                        }}>
                          {pieceIndex + 1}
                        </Text>
                      </View>
                    </Animated.View>
                  </View>
                );
              } else {
                return (
                  <View
                    key={`static-token-${playerIndex}-${pieceIndex}`}
                    style={{
                      position: 'absolute',
                      left: staticX,
                      top: staticY,
                      width: tokenSize,
                      height: tokenSize,
                      zIndex: 10,
                    }}
                  >
                    <View
                      style={{
                        width: tokenSize,
                        height: tokenSize,
                        borderRadius: tokenSize / 2,
                        backgroundColor: piece.color,
                        borderWidth: 4,
                        borderColor: '#FFFFFF',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: piece.color,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        elevation: 8,
                        opacity: isActivePlayer ? 1 : 0.3,
                      }}
                    >
                      <Text style={{
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 16,
                      }}>
                        {pieceIndex + 1}
                      </Text>
                    </View>
                  </View>
                );
              }
            }
          })
        )}

        {/* Animated stroke overlays for movable tokens - only for current player */}
        {players.map((player, playerIndex) =>
          player.pieces.map((piece, pieceIndex) => {
            const tokenSize = CELL_SIZE * 0.9;
            const globalPieceIndex = playerIndex * 4 + pieceIndex;
            const isCurrentPlayer = playerIndex === currentPlayer;
            const isActivePlayer = playerIndex < selectedPlayerCount;
            const canMove = isCurrentPlayer && diceValue > 0 && 
                           ((piece.isHome && diceValue === 6) || 
                            (piece.isInPlay && piece.steps + diceValue <= maxSteps));

            // Only show stroke animation for current player's movable pieces
            if (!isCurrentPlayer || !canMove || !isActivePlayer) return null;

            let x = 0;
            let y = 0;

            if (piece.isHome) {
              // Position in token containers
              const homePositions = [
                // Red (top-left)
                [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
                // Green (top-right)
                [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
                // Blue (bottom-left)
                [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
                // Yellow (bottom-right)
                [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
              ];

              const pos = homePositions[playerIndex][pieceIndex];
              x = pos.x * CELL_SIZE;
              y = pos.y * CELL_SIZE;
            } else if (piece.isInPlay) {
              // Calculate position on the board path using the proper path
              const position = getPositionOnPath(playerIndex, piece.steps);
              x = position.x * CELL_SIZE;
              y = position.y * CELL_SIZE;
            }

            return (
              <Animated.View
                key={`stroke-${playerIndex}-${pieceIndex}`}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: tokenSize,
                  height: tokenSize,
                  borderRadius: tokenSize / 2,
                  borderWidth: tokenStrokeAnimations[globalPieceIndex].interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, 6],
                  }),
                  borderColor: '#FFD700',
                  opacity: tokenStrokeAnimations[globalPieceIndex].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                }}
              />
            );
          })
        )}

        {/* Clickable overlays for tokens */}
        {players.map((player, playerIndex) =>
          player.pieces.map((piece, pieceIndex) => {
            const tokenSize = CELL_SIZE * 0.9;
            const globalPieceIndex = playerIndex * 4 + pieceIndex;
            const isCurrentPlayer = playerIndex === currentPlayer;
            const isActivePlayer = playerIndex < selectedPlayerCount;
            const canMove = isCurrentPlayer && diceValue > 0;

            if (piece.isInPlay) {
              // For pieces in play, use animated position
              return (
                <Animated.View
                  key={`touchable-animated-${playerIndex}-${pieceIndex}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: tokenSize,
                    height: tokenSize,
                    zIndex: 15,
                    transform: [
                      {
                        translateX: tokenPositionAnimations[globalPieceIndex].translateX,
                      },
                      {
                        translateY: tokenPositionAnimations[globalPieceIndex].translateY,
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    style={{
                      width: tokenSize,
                      height: tokenSize,
                      borderRadius: tokenSize / 2,
                      backgroundColor: 'transparent',
                    }}
                    onPress={() => {
                      if (canMove && isActivePlayer) {
                        movePiece(pieceIndex);
                      }
                    }}
                    disabled={!canMove || !isActivePlayer}
                    activeOpacity={canMove && isActivePlayer ? 0.7 : 1}
                  />
                </Animated.View>
              );
            } else {
              // For pieces at home, use static position
              const homePositions = [
                // Red (top-left)
                [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
                // Green (top-right)
                [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
                // Blue (bottom-left)
                [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
                // Yellow (bottom-right)
                [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
              ];

              const pos = homePositions[playerIndex][pieceIndex];
              const x = pos.x * CELL_SIZE;
              const y = pos.y * CELL_SIZE;

              return (
                <TouchableOpacity
                  key={`touchable-static-${playerIndex}-${pieceIndex}`}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: tokenSize,
                    height: tokenSize,
                    borderRadius: tokenSize / 2,
                    backgroundColor: 'transparent',
                    zIndex: 15,
                  }}
                  onPress={() => {
                    if (canMove) {
                      movePiece(pieceIndex);
                    }
                  }}
                  disabled={!canMove}
                  activeOpacity={canMove ? 0.7 : 1}
                />
              );
            }
          })
        )}
      </View>
    );
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

  if (gameEnded) {
    return (
      <View style={styles.bg}>
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
        <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" />
        <View style={styles.winnerContainer}>
          <Animated.View style={[styles.winnerIcon, {
            transform: [
              { scale: winnerScaleAnimation },
              { rotate: winnerRotationAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }) },
            ],
          }]}>
            <Icon name="emoji-events" size={100} color="#FFD700" />
          </Animated.View>
          <Text style={styles.winnerText}>
            🎉 Game Complete! 🎉
          </Text>
          <Text style={styles.winnerSubtext}>
            All players have finished!
          </Text>
          <View style={styles.winnersList}>
            {winners.map((winner, index) => (
              <View key={winner.id} style={[styles.winnerItem, { backgroundColor: winner.color }]}>
                <Text style={styles.winnerRank}>#{index + 1}</Text>
                <Text style={styles.winnerName}>{winner.name}</Text>
                <Text style={styles.winnerEmoji}>{playerEmojis[winner.id]}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: '#00AA00' }]} onPress={resetGame}>
            <Icon name="refresh" size={20} color="white" />
            <Text style={styles.resetButtonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </View>
    );
  }

  if (showPlayerSelection) {
    return (
      <View style={styles.bg}>
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
        <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" />
        <View style={styles.playerSelectionContainer}>
          <View style={styles.playerSelectionModal}>
            <View style={styles.modalHeader}>
              <Icon name="group" size={32} color="#FFD700" />
              <Text style={styles.modalTitle}>Select Players</Text>
              <Text style={styles.modalSubtitle}>Choose how many players will join the game</Text>
            </View>

            <View style={styles.playerCountOptions}>
              {[2, 3, 4].map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.playerCountOption,
                    selectedPlayerCount === count && styles.playerCountOptionSelected
                  ]}
                  onPress={() => setSelectedPlayerCount(count)}
                >
                  <View style={styles.playerCountInfo}>
                    <Text style={[
                      styles.playerCountNumber,
                      selectedPlayerCount === count && styles.playerCountNumberSelected
                    ]}>
                      {count}
                    </Text>
                    <Text style={[
                      styles.playerCountLabel,
                      selectedPlayerCount === count && styles.playerCountLabelSelected
                    ]}>
                      {count === 2 ? 'Two Players' : count === 3 ? 'Three Players' : 'Four Players'}
                    </Text>
                  </View>
                  <View style={styles.playerCountPreview}>
                    {Array.from({ length: count }, (_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.playerPreviewDot,
                          { backgroundColor: colors[index] }
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPlayerSelection(false)}
              >
                <Icon name="close" size={20} color="white" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: '#00AA00' }]}
                onPress={confirmPlayerCount}
              >
                <Icon name="play-arrow" size={20} color="white" />
                <Text style={styles.confirmButtonText}>Start Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
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
      <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" />
      <View style={styles.backgroundGradient} />
      <View style={styles.backgroundPattern} />

      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleContainer}>
              <Icon name="gamepad" size={28} color="#FFD700" />
              <Text style={styles.title}>Ludo Classic</Text>
              <View style={styles.titleGlow} />
            </View>
          </View>
          <View style={styles.headerRight}>
            {!gameStarted ? (
              <TouchableOpacity style={styles.startButton} onPress={startGame}>
                <View style={styles.buttonGradient}>
                  <Icon name="play-arrow" size={22} color="white" />
                  <Text style={styles.startButtonText}>Start</Text>
                </View>
                <View style={styles.buttonGlow} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuButton} onPress={resetGame}>
                <View style={styles.buttonGradient}>
                  <Icon name="refresh" size={22} color="white" />
                </View>
                <View style={styles.buttonGlow} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={closeGame}>
              <View style={styles.buttonGradient}>
                <Icon name="close" size={24} color="white" />
              </View>
              <View style={styles.buttonGlow} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {gameStarted && (
        <>
          <View style={styles.gameInfoContainer}>
            <View style={styles.gameInfo}>
              <View style={styles.currentPlayerInfo}>
                <Text style={styles.currentPlayerLabel}>Current Turn</Text>
                <View style={[styles.currentPlayerBadge, { backgroundColor: players[currentPlayer]?.color }]}>
                  <Text style={styles.currentPlayerEmoji}>{playerEmojis[currentPlayer]}</Text>
                  <Text style={styles.currentPlayerName}>{players[currentPlayer]?.name}</Text>
                  <View style={styles.badgeGlow} />
                </View>
              </View>

              <View style={styles.diceContainer}>
                <Animated.View
                  style={[
                    styles.dice,
                    {
                      backgroundColor: players[currentPlayer]?.color,
                      transform: [
                        {
                          rotate: diceAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                        {
                          scale: diceRolling ? 1.1 : 1,
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
                    <View style={styles.diceInner}>
                      {diceValue > 0 ? (
                        renderDiceDots(diceValue)
                      ) : (
                        <Icon name="casino" size={65} color="white" />
                      )}
                    </View>
                    <View style={styles.diceGlow} />
                  </TouchableOpacity>
                </Animated.View>
                <Text style={styles.diceLabel}>
                  {diceRolling ? 'Rolling...' : canRollDice ? 'Tap to Roll' : 'Move a Piece'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.boardContainer}>
            <View style={styles.boardWrapper}>
              <View style={styles.board}>
                {renderLudoBoard()}
                {renderTokens()}
              </View>
              <View style={styles.boardGlow} />
            </View>
          </View>

          {/* App Logo below the board */}
          <View style={styles.logoContainer}>
            <Logo size="medium" />
          </View>

          <View style={styles.playersContainer}>
            {/* {players.map((player, index) => renderPlayerArea(player, index))} */}
          </View>

          {/* Confetti overlay */}
          {showWinnerModal && renderConfetti()}

          {/* Winner Modal */}
          <Modal
            visible={showWinnerModal}
            transparent={true}
            animationType="none"
            onRequestClose={() => {}}
          >
            <Animated.View style={[
              styles.modalOverlay,
              {
                opacity: modalOpacityAnimation,
              }
            ]}>
              <Animated.View style={[
                styles.winnerModal,
                {
                  transform: [{ scale: modalScaleAnimation }],
                }
              ]}>
                <View style={styles.winnerModalContent}>
                  <Animated.View style={[
                    styles.winnerModalIcon,
                    {
                      transform: [
                        { scale: winnerScaleAnimation },
                        { rotate: winnerRotationAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }) },
                      ],
                    }
                  ]}>
                    <Icon name="emoji-events" size={80} color="#FFD700" />
                    <Animated.View style={[
                      styles.winnerGlow,
                      {
                        opacity: winnerGlowAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                        transform: [{
                          scale: winnerGlowAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.2],
                          }),
                        }],
                      }
                    ]} />
                  </Animated.View>

                  <Text style={styles.winnerModalTitle}>
                    🎉 {winner?.name} Wins! 🎉
                  </Text>
                  <Text style={styles.winnerModalSubtitle}>
                    Congratulations on your victory!
                  </Text>

                  <View style={styles.winnerModalActions}>
                    {!gameEnded && (
                      <TouchableOpacity 
                        style={[styles.continueButton, { backgroundColor: winner?.color }]} 
                        onPress={continueGame}
                      >
                        <Icon name="play-arrow" size={20} color="white" />
                        <Text style={styles.continueButtonText}>Continue Game</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={[styles.endGameButton, { backgroundColor: '#FF4444' }]} 
                      onPress={endGame}
                    >
                      <Icon name="stop" size={20} color="white" />
                      <Text style={styles.endGameButtonText}>End Game</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          </Modal>
        </>
      )}
    </SafeAreaView>
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
    backgroundColor: '#0f1419',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f1419',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 10,
    backgroundColor: 'rgba(26, 35, 50, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  titleGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 15,
    zIndex: -1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 12,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: -1,
  },
  startButton: {
    position: 'relative',
    backgroundColor: '#00AA00',
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#00AA00',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  menuButton: {
    position: 'relative',
    backgroundColor: '#4444FF',
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#4444FF',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  closeButton: {
    position: 'relative',
    backgroundColor: '#FF4444',
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#FF4444',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  gameInfoContainer: {
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 20,
    backgroundColor: 'rgba(26, 35, 50, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  currentPlayerInfo: {
    flex: 1,
  },
  currentPlayerLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 5,
    marginTop: -35,
  },
  currentPlayerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    marginRight: 15,
    shadowOffset: { width: 0, height: 3 },
    position: 'relative',
  },
  badgeGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: -1,
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
    width: 80,
    height: 80,
    backgroundColor: '#29B1A9',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#29B1A9',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    position: 'relative',
  },
  diceInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  diceGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 23,
    backgroundColor: 'rgba(41, 177, 169, 0.3)',
    zIndex: -1,
  },
  diceButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  boardContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  boardWrapper: {
    position: 'relative',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    position: 'relative',
    borderRadius: 15,
    overflow: 'hidden',
  },
  boardGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    zIndex: -1,
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
  playerSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  playerSelectionModal: {
    backgroundColor: 'rgba(26, 35, 50, 0.95)',
    borderRadius: 25,
    padding: 35,
    width: '100%',
    maxWidth: 400,
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 10,
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  playerCountOptions: {
    marginBottom: 30,
  },
  playerCountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 25,
    marginBottom: 20,
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  playerCountOptionSelected: {
    backgroundColor: 'rgba(42, 26, 58, 0.9)',
    borderColor: '#FFD700',
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  playerCountInfo: {
    flex: 1,
  },
  playerCountNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginBottom: 5,
  },
  playerCountNumberSelected: {
    color: '#FFD700',
  },
  playerCountLabel: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  playerCountLabelSelected: {
    color: 'white',
  },
  playerCountPreview: {
    flexDirection: 'row',
    gap: 8,
  },
  playerPreviewDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    backgroundColor: '#FF4444',
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  // Winner Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerModal: {
    backgroundColor: 'rgba(26, 35, 50, 0.95)',
    borderRadius: 25,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  winnerModalContent: {
    alignItems: 'center',
  },
  winnerModalIcon: {
    marginBottom: 20,
    position: 'relative',
  },
  winnerGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    zIndex: -1,
  },
  winnerModalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  winnerModalSubtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
  },
  winnerModalActions: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  continueButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  endGameButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  endGameButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  // Winners List Styles
  winnersList: {
    width: '100%',
    marginBottom: 30,
  },
  winnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  winnerRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 15,
    minWidth: 30,
  },
  winnerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  winnerEmoji: {
    fontSize: 20,
  },
});

export default LudoGameSVG;

