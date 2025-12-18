import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Image,
  TextInput,
  ScrollView,
  FlatList,
  ImageBackground,
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
import { useSocket } from '../contexts/SocketContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Logo from '../components/Logo';
import { Emitter } from 'react-native-particles';
import api, { friendAPI } from '../lib/api';
import config from '../lib/config';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

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
  avatar?: string;
  profileId?: string;
}

const LudoGameSVG = () => {
  const { colors: themeColors } = useTheme();
  const { setLudoGameActive } = useLudoGame();
  const { emit, isConnected } = useSocket();
  const myProfile = useSelector((state: RootState) => state.profile);
  
  // Use remote URL if provided, otherwise fall back to bundled asset
  const backgroundImageSource = config.LUDU_BACKGROUND_URL.startsWith('http')
    ? { uri: config.LUDU_BACKGROUND_URL }
    : require('../assets/images/ludu-background.png');

  // Precomputed board paths to avoid re-creating large arrays on every call
  const PATHS: Record<number, { x: number; y: number }[]> = useMemo(() => ({
    0: [
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
      { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }
    ],
    1: [
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
      { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }, { x: 7, y: 7 }
    ],
    2: [
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
      { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }, { x: 7, y: 7 }
    ],
    3: [
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
      { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 7 }
    ]
  }), []);
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
  const [onlineMode, setOnlineMode] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<any[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [friendList, setFriendList] = useState<any[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Additional state variables from web version
  const [gameId, setGameId] = useState<string | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [invitedStatusByFriendId, setInvitedStatusByFriendId] = useState<{[key: string]: string}>({});
  const [invitedSlotByFriendId, setInvitedSlotByFriendId] = useState<{[key: string]: number}>({});
  const [incomingInviteRequest, setIncomingInviteRequest] = useState<any>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());
  const [inviteCopied, setInviteCopied] = useState(false);
  
  // Refs to avoid re-binding socket listeners on every state change (matching web version)
  const playersRef = useRef<Player[]>([]);
  const currentPlayerRef = useRef(0);
  const selectedPlayerCountRef = useRef(4);
  const winnersRef = useRef<Player[]>([]);
  const maxStepsRef = useRef(59);
  const lastDiceValueRef = useRef(0);
  const diceValueRef = useRef(0);
  const gameStartedRef = useRef(false);
  const gameEndedRef = useRef(false);
  const myPlayerIndexRef = useRef(0);
  const autoStartTriggeredRef = useRef(false);
  const lastLocalDiceRollTimeRef = useRef(0);
  const currentPlayerUpdatedFromServerRef = useRef(false);
  const lastBroadcastRef = useRef(0);
  const recentMovesRef = useRef(new Map<string, { toSteps: number; timestamp: number; isCapture?: boolean; isMoveOutOfHome?: boolean }>());
  const lastTurnAdvanceTimeRef = useRef(0);
  const invitedStatusByFriendIdRef = useRef<{[key: string]: string}>({});
  const invitedSlotByFriendIdRef = useRef<{[key: string]: number}>({});
  const inviteTimestampsRef = useRef<{[key: string]: number}>({});
  const inviteHandlersAttachedRef = useRef(false);
  const lastInviterRef = useRef<any>(null);
  const savedGameStateRef = useRef<any>(null);
  const hasProcessedReconnectionStateRef = useRef(false);
  const lastRollTimeRef = useRef(0);
  const isRollingRef = useRef(false);
  const isMovingRef = useRef(false);
  const isAutoMovingRef = useRef(false);
  const moveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Original Ludo colors
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  const playerNames = ['Red', 'Green', 'Blue', 'Yellow'];
  const playerEmojis = ['🔴', '🟢', '🔵', '🟡'];

  // Use exact path length as the true max steps (prevents overruns near home)
  const maxSteps = useMemo(() => {
    const len0 = Array.isArray(PATHS?.[0]) ? PATHS[0].length : 59;
    return (typeof len0 === 'number' && len0 > 0) ? len0 : 59;
  }, [PATHS]);

  // Rendering order to match dice sequence (web parity)
  const renderPlayerOrder = useMemo(() => {
    return selectedPlayerCount === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, selectedPlayerCount);
  }, [selectedPlayerCount]);

  // Safe zones - cannot capture here. Includes entry squares and start squares.
  const SAFE_CELLS = useMemo(() => {
    const cells: Array<[number, number]> = [
      [1, 6],
      [8, 1],
      [6, 13],
      [13, 8],
      [7, 13],
      [13, 7],
      [7, 2],
      [2, 7],
    ];
    return new Set(cells.map(([x, y]) => `${x},${y}`));
  }, []);

  // Turn order helper (web parity)
  const getNextActivePlayer = React.useCallback((fromIndex: number) => {
    const baseOrder = selectedPlayerCount === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, selectedPlayerCount);
    if (baseOrder.length === 0) return fromIndex;
    let idx = baseOrder.indexOf(fromIndex);
    if (idx === -1) idx = 0;
    let attempts = 0;
    while (attempts < baseOrder.length) {
      idx = (idx + 1) % baseOrder.length;
      const candidate = baseOrder[idx];
      const playerWon = winners.some(w => w.id === candidate);
      if (!playerWon) return candidate;
      attempts++;
    }
    return fromIndex;
  }, [selectedPlayerCount, winners]);

  // Get position on path for a given player and steps (must be defined before use in cellOccupancy)
  const getPositionOnPath = (playerIndex: number, steps: number) => {
    const path = PATHS[playerIndex as keyof typeof PATHS];
    if (!path || steps <= 0 || steps > path.length) {
      return { x: 7, y: 7 };
    }
    return path[steps - 1];
  };

  // Compute overlapping tokens in the same board cell for better visibility (web parity)
  const cellOccupancy = useMemo(() => {
    const map = new Map<string, { playerIndex: number; pieceIndex: number }[]>();
    players.forEach((player, playerIndex) => {
      player.pieces.forEach((piece, pieceIndex) => {
        if (piece.isInPlay || piece.steps === maxSteps) {
          const pos = getPositionOnPath(playerIndex, piece.steps);
          const key = `${pos.x},${pos.y}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({ playerIndex, pieceIndex });
        }
      });
    });
    return map;
  }, [players]);

  // Sync refs with state (matching web version)
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { selectedPlayerCountRef.current = selectedPlayerCount; }, [selectedPlayerCount]);
  useEffect(() => { winnersRef.current = winners; }, [winners]);
  useEffect(() => { maxStepsRef.current = maxSteps; }, [maxSteps]);
  useEffect(() => { diceValueRef.current = diceValue; }, [diceValue]);
  useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);
  useEffect(() => { gameEndedRef.current = gameEnded; }, [gameEnded]);
  useEffect(() => { myPlayerIndexRef.current = myPlayerIndex; }, [myPlayerIndex]);
  useEffect(() => { invitedStatusByFriendIdRef.current = invitedStatusByFriendId; }, [invitedStatusByFriendId]);
  useEffect(() => { invitedSlotByFriendIdRef.current = invitedSlotByFriendId; }, [invitedSlotByFriendId]);

  const getOverlapOffset = (count: number, index: number) => {
    const delta = CELL_SIZE * 0.35;
    if (count <= 1) return { dx: 0, dy: 0 };
    if (count === 2) {
      return { dx: index === 0 ? -delta / 2 : delta / 2, dy: 0 };
    }
    if (count === 3) {
      const positions = [
        { dx: -delta / 2, dy: -delta / 2 },
        { dx: delta / 2, dy: -delta / 2 },
        { dx: 0, dy: delta / 2 },
      ];
      return positions[index] || { dx: 0, dy: 0 };
    }
    const grid = [
      { dx: -delta / 2, dy: -delta / 2 },
      { dx: delta / 2, dy: -delta / 2 },
      { dx: -delta / 2, dy: delta / 2 },
      { dx: delta / 2, dy: delta / 2 },
    ];
    return grid[index % 4];
  };

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

  useEffect(() => {
    if (showPlayerSelection && myProfile?._id) {
      friendAPI.getFriendList(myProfile._id)
        .then(res => setFriendList(Array.isArray(res.data) ? res.data : []))
        .catch(() => setFriendList([]));
    }
  }, [showPlayerSelection, myProfile?._id]);

  const onChangeFriendSearch = (text: string) => {
    setFriendSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoadingSearch(true);
        const res = await api.get(`/search?input=${encodeURIComponent(text)}`);
        setSearchResults(res.data?.users || []);
      } catch (_) {
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  const initializeGame = (playerCount: number = selectedPlayerCount) => {
    const newPlayers: Player[] = [];
    const names: string[] = [];
    const avatars: (string | undefined)[] = [];
    const ids: (string | undefined)[] = [];
    names[0] = myProfile?.fullName || playerNames[0];
    avatars[0] = myProfile?.profilePic;
    ids[0] = myProfile?._id;
    for (let i = 1; i < playerCount; i++) {
      const f = selectedFriends[i - 1];
      names[i] = f?.fullName || playerNames[i];
      avatars[i] = f?.profilePic;
      ids[i] = f?._id;
    }
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
        name: names[i] || playerNames[i],
        color: colors[i],
        pieces,
        isActive: i === 0,
        avatar: avatars[i],
        profileId: ids[i],
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

  // Helper to set dice value and update ref immediately (matching web version)
  const setDiceValueImmediate = (value: number) => {
    setDiceValue(value);
    diceValueRef.current = value;
    lastDiceValueRef.current = value;
  };

  // Get playable pieces for a player given a dice value (matching web version)
  const getPlayablePieces = React.useCallback((playerIndex: number, diceVal: number) => {
    const playerData = players[playerIndex];
    if (!playerData || !Array.isArray(playerData.pieces)) return [];
    const playable: number[] = [];
    playerData.pieces.forEach((piece, pieceIndex) => {
      if (piece.isHome && diceVal === 6) {
        playable.push(pieceIndex);
      } else if (piece.isInPlay && piece.steps + diceVal <= maxSteps) {
        playable.push(pieceIndex);
      }
    });
    return playable;
  }, [players, maxSteps]);

  const rollDice = () => {
    // Prevent multiple rolls - check multiple conditions
    if (waitingForPlayers) return;
    if (!canRollDice || diceRolling) return;
    if (isRollingRef.current) return; // Additional guard
    
    // CRITICAL: Use refs to ensure we check the most current values (avoid stale closures)
    // Only the current player can roll dice in online mode
    if (onlineMode) {
      const currentMyPlayerIndex = myPlayerIndexRef.current;
      const currentPlayerIndex = currentPlayerRef.current;
      if (currentMyPlayerIndex !== currentPlayerIndex) {
        // Not the current player's turn - prevent roll
        return;
      }
      if (diceValueRef.current > 0) {
        // Already have a dice value, wait for move
        return;
      }
    }
    
    // Prevent rapid successive rolls
    const timeSinceLastRoll = Date.now() - lastRollTimeRef.current;
    if (timeSinceLastRoll < 500) return; // Minimum 500ms between rolls
    
    // CRITICAL: Double-check conditions right before setting flags (prevent race conditions)
    // Re-check canRollDice and diceValue one more time after potential state updates
    if (!canRollDice || diceRolling || isRollingRef.current) return;
    if (diceValueRef.current > 0 || diceValue > 0) return;
    if (onlineMode && myPlayerIndexRef.current !== currentPlayerRef.current) return;
    
    // Set rolling flags immediately to prevent duplicate rolls
    isRollingRef.current = true;
    setDiceRolling(true);
    setCanRollDice(false);
    lastRollTimeRef.current = Date.now();

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
      // Set dice value and broadcast
      setDiceValueImmediate(value);
      lastDiceValueRef.current = value;
      lastLocalDiceRollTimeRef.current = Date.now();
      setDiceRolling(false);
      isRollingRef.current = false;

      const currentPlayerData = players[currentPlayer];
      const playablePieces = getPlayablePieces(currentPlayer, value);

      if (playablePieces.length === 0) {
        // No moves available - advance turn
        setTimeout(() => {
          const nextPlayer = getNextActivePlayer(currentPlayer);
          setCurrentPlayer(nextPlayer);
          currentPlayerRef.current = nextPlayer;
          lastTurnAdvanceTimeRef.current = Date.now();
          setDiceValueImmediate(0);
          lastLocalDiceRollTimeRef.current = 0;
          setCanRollDice(true);
        }, 400);
      } else if (playablePieces.length === 1) {
        // Only one playable piece - move it automatically
        isAutoMovingRef.current = true;
        setCanRollDice(false);
        setTimeout(() => {
          if (diceValueRef.current === value && currentPlayerRef.current === currentPlayer) {
            movePiece(playablePieces[0]);
          } else {
            isAutoMovingRef.current = false;
            setCanRollDice(true);
          }
        }, 200);
      } else {
        // Multiple pieces are playable - allow user to choose
        // Start stroke animations for movable pieces
        currentPlayerData.pieces.forEach((piece, pieceIndex) => {
          const globalPieceIndex = currentPlayer * 4 + pieceIndex;
          const canMovePiece = (piece.isHome && value === 6) || 
                               (piece.isInPlay && piece.steps + value <= maxSteps);
          if (canMovePiece) {
            startTokenStrokeAnimation(globalPieceIndex);
          }
        });
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
          useNativeDriver: true,
        }),
        Animated.timing(tokenPositionAnimations[pieceId].translateY, {
          toValue: targetY,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Move to next step
        animateStep(currentStep + 1);
      });
    };

    // Start the step-by-step animation
    animateStep(1);
  };


  const isSafePosition = (_playerIndex: number, position: { x: number; y: number }) => {
    return SAFE_CELLS.has(`${position.x},${position.y}`);
  };

  const checkForCapture = (movingPlayerIndex: number, newPosition: { x: number; y: number }, movingPieceNewSteps?: number) => {
    const srcPlayers = playersRef.current && Array.isArray(playersRef.current) && playersRef.current.length > 0 ? playersRef.current : players;
    const captured: { playerIndex: number; pieceIndex: number }[] = [];
    
    // Count tokens per player at the target position (including the moving player)
    const tokensAtPosition = new Map<number, number>(); // playerIndex -> count
      
    srcPlayers.forEach((player, playerIndex) => {
      let count = 0;
      player.pieces.forEach((piece) => {
        if (piece.isInPlay) {
          if (piece.steps >= maxSteps) return; // Skip finished pieces
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
            count++;
          }
        }
      });
      if (count > 0) {
        tokensAtPosition.set(playerIndex, count);
      }
    });
    
    // Explicitly ensure the moving piece is counted at the new position
    // This handles cases where state hasn't updated yet or the piece isn't in state
    if (typeof movingPieceNewSteps === 'number' && movingPieceNewSteps > 0 && movingPieceNewSteps < maxSteps) {
      const movingPiecePosition = getPositionOnPath(movingPlayerIndex, movingPieceNewSteps);
      if (movingPiecePosition.x === newPosition.x && movingPiecePosition.y === newPosition.y) {
        // Check if the moving piece is already counted in the state
        const movingPlayer = srcPlayers[movingPlayerIndex];
        let alreadyCounted = false;
        if (movingPlayer && Array.isArray(movingPlayer.pieces)) {
          alreadyCounted = movingPlayer.pieces.some(piece => {
            if (piece.isInPlay && piece.steps === movingPieceNewSteps) {
              const pos = getPositionOnPath(movingPlayerIndex, piece.steps);
              return pos.x === newPosition.x && pos.y === newPosition.y;
            }
            return false;
          });
        }
        // Only add if not already counted
        if (!alreadyCounted) {
          const currentCount = tokensAtPosition.get(movingPlayerIndex) || 0;
          tokensAtPosition.set(movingPlayerIndex, currentCount + 1);
        }
      }
    }
    
    // Get the moving player's token count at the new position
    const movingPlayerTokenCount = tokensAtPosition.get(movingPlayerIndex) || 0;
    
    // Check captures for each opponent
    tokensAtPosition.forEach((count, playerIndex) => {
      if (playerIndex === movingPlayerIndex) return; // Skip the moving player
      
      const player = srcPlayers[playerIndex];
      
      // Find the first piece at this position to check if it's safe
      let firstPieceAtPosition: { x: number; y: number } | null = null;
      for (const piece of player.pieces) {
        if (piece.isInPlay && piece.steps < maxSteps) {
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
            firstPieceAtPosition = piecePosition;
            break;
          }
        }
      }
      
      // Skip safe positions
      if (firstPieceAtPosition && isSafePosition(playerIndex, firstPieceAtPosition)) return;
      
      // Rule 1: If moving player has 2+ tokens and opponent has 2 tokens, capture both opponent tokens
      if (movingPlayerTokenCount >= 2 && count === 2) {
        // Capture both opponent tokens
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps);
            if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
              captured.push({ playerIndex, pieceIndex });
          }
        }
      });
      }
      // Rule 2: If moving player has 1 token and opponent has 1 token, capture the opponent's token
      else if (movingPlayerTokenCount === 1 && count === 1) {
        // Capture the single opponent token
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps);
            if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
              captured.push({ playerIndex, pieceIndex });
            }
          }
        });
      }
      // If moving player has 2+ tokens and opponent has only 1 token, capture the single token
      else if (movingPlayerTokenCount >= 2 && count === 1) {
        // Moving player has double tokens, can capture single opponent token
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps);
            if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
              captured.push({ playerIndex, pieceIndex });
            }
          }
        });
      }
      // If opponent has 2+ tokens and moving player has 1 token, opponent is safe (no capture)
    });
    
    return captured;
  };

  // Check for captures when a token moves AWAY from a position (rule 2: friend moves token away)
  const checkForCaptureAfterMoveAway = (movingPlayerIndex: number, oldPosition: { x: number; y: number }) => {
    const srcPlayers = playersRef.current && Array.isArray(playersRef.current) && playersRef.current.length > 0 ? playersRef.current : players;
    const captured: { playerIndex: number; pieceIndex: number }[] = [];
    
    // Count tokens per player at the old position (after the move)
    const tokensAtPosition = new Map<number, number>(); // playerIndex -> count
    
    srcPlayers.forEach((player, playerIndex) => {
      let count = 0;
      player.pieces.forEach((piece) => {
        if (piece.isInPlay) {
          if (piece.steps >= maxSteps) return; // Skip finished pieces
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
            count++;
          }
        }
      });
      if (count > 0) {
        tokensAtPosition.set(playerIndex, count);
      }
    });
    
    // Check if any player now has a single token that should be captured
    tokensAtPosition.forEach((count, playerIndex) => {
      if (playerIndex === movingPlayerIndex) {
        // Check if moving player left behind tokens that can capture others
        if (count >= 2) {
          // Moving player has 2+ tokens left, can capture single tokens of others
          srcPlayers.forEach((opponent, opponentIndex) => {
            if (opponentIndex === playerIndex) return;
            const opponentCount = tokensAtPosition.get(opponentIndex) || 0;
            if (opponentCount === 1) {
              // Capture the single opponent token
              opponent.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay && piece.steps < maxSteps) {
                  const piecePosition = getPositionOnPath(opponentIndex, piece.steps);
                  if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
                    const position = getPositionOnPath(opponentIndex, piece.steps);
                    if (!isSafePosition(opponentIndex, position)) {
                      captured.push({ playerIndex: opponentIndex, pieceIndex });
                    }
                  }
                }
              });
            }
          });
        }
      } else {
        // Check if this player's single token should be captured by remaining tokens
        if (count === 1) {
          const movingPlayerRemainingCount = tokensAtPosition.get(movingPlayerIndex) || 0;
          if (movingPlayerRemainingCount >= 2) {
            // Moving player left 2+ tokens, can capture this single token
            const player = srcPlayers[playerIndex];
            player.pieces.forEach((piece, pieceIndex) => {
              if (piece.isInPlay && piece.steps < maxSteps) {
                const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
                  const position = getPositionOnPath(playerIndex, piece.steps);
                  if (!isSafePosition(playerIndex, position)) {
                    captured.push({ playerIndex, pieceIndex });
                  }
                }
              }
            });
          }
        }
      }
    });
    
    return captured;
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
      setPlayers(prev => {
        const updated = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
        updated[playerIndex].pieces[pieceIndex] = {
          ...capturedPiece,
          isHome: true,
          isInPlay: false,
          steps: 0,
        };
        // Update ref immediately to ensure state is synchronized
        playersRef.current = updated;
        return updated;
      });
      
      // Clear capture animation state
      setCaptureAnimations(prev => {
        const newState = { ...prev };
        delete newState[captureKey];
        return newState;
      });
    });
  };

  const movePiece = (pieceId: number) => {
    // Prevent multiple moves from a single dice roll - check moving flag
    // But allow automatic moves to proceed (they set isAutoMovingRef instead)
    if (isMovingRef.current && !isAutoMovingRef.current) {
      return;
    }
    
    // Always prefer ref value when available (prevents move from being blocked due to state sync issues)
    // The ref is updated immediately, while state updates are async
    const effectiveDiceValue = (diceValueRef.current > 0) ? diceValueRef.current : diceValue;
    
    if (effectiveDiceValue === 0) {
      return;
    }
    
    // Double-check: if dice value ref is 0, don't allow move (prevents race conditions)
    if (diceValueRef.current === 0 && diceValue === 0) {
      return;
    }
    
    // In online mode, only allow moves if it's the current player's turn
    if (onlineMode && myPlayerIndexRef.current !== currentPlayerRef.current) {
      return;
    }
    
    const rolledNow = effectiveDiceValue;
    const currentPlayerData = players[currentPlayer];
    if (!currentPlayerData) {
      return;
    }
    const piece = currentPlayerData.pieces[pieceId];
    if (!piece) {
      return;
    }

    // Validate the move
    if (piece.isHome && effectiveDiceValue !== 6) return;
    if (piece.isInPlay && piece.steps + effectiveDiceValue > maxSteps) return;
    
    // Set moving flag to prevent duplicate moves
    isMovingRef.current = true;
    // Clear auto-moving flag since we're now executing the move
    isAutoMovingRef.current = false;
    
    // CRITICAL: Reset dice value IMMEDIATELY to prevent multiple moves from same roll
    setDiceValueImmediate(0);
    lastLocalDiceRollTimeRef.current = 0;

    // Stop stroke animations for ALL current player's pieces
    currentPlayerData.pieces.forEach((_, pieceIndex) => {
      const globalIdx = currentPlayer * 4 + pieceIndex;
      stopTokenStrokeAnimation(globalIdx);
    });

    const globalPieceIndex = currentPlayer * 4 + pieceId;

    if (piece.isHome && effectiveDiceValue === 6) {
      // Move out
      const pieceKey = `${currentPlayer}-${pieceId}`;
      recentMovesRef.current.set(pieceKey, { toSteps: 1, timestamp: Date.now(), isMoveOutOfHome: true });
      
      const updated = players.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
      updated[currentPlayer].pieces[pieceId] = {
        ...piece,
        isHome: false,
        isInPlay: true,
        steps: 1,
      };
      setPlayers(updated);
      // Update ref immediately to ensure protection logic sees the new state
      playersRef.current = updated;
      
      // Keep move protected for 5 seconds (longer for moves out of home to prevent reverts)
      setTimeout(() => {
        const tracked = recentMovesRef.current.get(pieceKey);
        // Only delete if the move hasn't been updated (e.g., by a capture or further move)
        if (tracked && tracked.toSteps === 1) {
          recentMovesRef.current.delete(pieceKey);
        }
      }, 5000);

      // Animate piece moving out
      const startPosition = getPositionOnPath(currentPlayer, 1);
      const startX = startPosition.x * CELL_SIZE;
      const startY = startPosition.y * CELL_SIZE;

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
        // Capture at start position
        const newPosition = getPositionOnPath(currentPlayer, 1);
        const capturedPieces = checkForCapture(currentPlayer, newPosition, 1);
        capturedPieces.forEach(({ playerIndex, pieceIndex }) => {
          // Track capture to prevent it from being overwritten
          const captureKey = `${playerIndex}-${pieceIndex}`;
          recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
          captureToken(playerIndex, pieceIndex);
        });

        isMovingRef.current = false; // Reset moving flag
        isAutoMovingRef.current = false; // Clear auto-moving flag
        // Reset dice value so player can roll again (since it's a 6, they get another turn)
        setDiceValueImmediate(0);
        lastLocalDiceRollTimeRef.current = 0;
        setCanRollDice(true); // keep turn on 6
      });
    } else if (piece.isInPlay) {
      const oldSteps = piece.steps;
      const oldPosition = getPositionOnPath(currentPlayer, oldSteps);
      const newSteps = piece.steps + effectiveDiceValue;

      if (newSteps <= maxSteps) {
        // Track this move
        const pieceKey = `${currentPlayer}-${pieceId}`;
        recentMovesRef.current.set(pieceKey, { toSteps: newSteps, timestamp: Date.now() });
        
        // Capture the current player index to avoid stale closure
        const movingPlayerIndex = currentPlayer;
        
        // Capture rolledNow value before animation to avoid closure issues
        const capturedRolledValue = rolledNow;
        
        // CRITICAL: Update state and ref immediately so UI shows the move and protection logic sees it
        // This prevents broadcasts from overwriting the move before animation completes
        setPlayers(prev => {
          const updated = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
          updated[movingPlayerIndex].pieces[pieceId].steps = newSteps;
          updated[movingPlayerIndex].pieces[pieceId].isHome = false;
          updated[movingPlayerIndex].pieces[pieceId].isInPlay = newSteps > 0 && newSteps < maxSteps;
          // Update ref immediately to ensure protection logic sees the new state
          playersRef.current = updated;
          return updated;
        });
        
        // Animate the visual movement (state is already at target, animation provides visual feedback)
        animateTokenMovement(globalPieceIndex, oldSteps, newSteps, currentPlayer, () => {
          // After animation, run capture/win checks
          let updatedState: Player[] | null = null;
          setPlayers(prev => {
            const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
            updatedPlayers[movingPlayerIndex].pieces[pieceId].steps = newSteps;
            updatedPlayers[movingPlayerIndex].pieces[pieceId].isHome = false;
            updatedPlayers[movingPlayerIndex].pieces[pieceId].isInPlay = newSteps > 0 && newSteps < maxSteps;
            // Update ref immediately to ensure broadcasts use current state
            playersRef.current = updatedPlayers;
            updatedState = updatedPlayers; // Capture for use in broadcast
            return updatedPlayers;
          });
          
          // Keep move protected for 2 seconds after completion
          setTimeout(() => {
            recentMovesRef.current.delete(pieceKey);
          }, 2000);

          let didCapture = false;
          if (newSteps < maxSteps) {
            const newPosition = getPositionOnPath(movingPlayerIndex, newSteps);
            
            // Check for captures at the new position
            // Pass newSteps to ensure the moving piece is counted correctly
            const capturedPieces = checkForCapture(movingPlayerIndex, newPosition, newSteps);
            didCapture = Array.isArray(capturedPieces) && capturedPieces.length > 0;
            capturedPieces.forEach(({ playerIndex, pieceIndex }) => {
              // Track capture to prevent it from being overwritten
              const captureKey = `${playerIndex}-${pieceIndex}`;
              recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
              captureToken(playerIndex, pieceIndex);
            });
            
            // Check for captures at the old position (when token moves away)
            // This handles the case where friend has double tokens and moves one away,
            // leaving a single token that should be captured
            if (oldSteps > 0 && oldSteps < maxSteps) {
              const capturedAfterMoveAway = checkForCaptureAfterMoveAway(movingPlayerIndex, oldPosition);
              if (capturedAfterMoveAway.length > 0) {
                didCapture = true; // Count this as a capture for turn purposes
                capturedAfterMoveAway.forEach(({ playerIndex, pieceIndex }) => {
                  // Track capture to prevent it from being overwritten
                  const captureKey = `${playerIndex}-${pieceIndex}`;
                  recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
                  captureToken(playerIndex, pieceIndex);
                });
              }
            }
          }

          if (newSteps === maxSteps) {
            setPlayers(prev => {
              const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
              const finishedCount = updatedPlayers[movingPlayerIndex].pieces.filter(p => p.steps === maxSteps).length;
            if (finishedCount === 4) {
                const winnerPlayer = updatedPlayers[movingPlayerIndex];
                const newWinners = [...winners, winnerPlayer];
              setWinners(newWinners);
                setWinner(winnerPlayer);
              setShowWinnerModal(true);
              startWinnerCelebration();
                const remainingPlayers = updatedPlayers.filter((_, idx) => idx < selectedPlayerCount);
              if (newWinners.length >= remainingPlayers.length - 1) {
                setGameEnded(true);
              }
              }
              playersRef.current = updatedPlayers; // Update ref
              updatedState = updatedPlayers; // Update captured state
              return updatedPlayers;
            });
          }

          // Verify final state before completing
          const finalState = playersRef.current[movingPlayerIndex]?.pieces[pieceId];
          
          // If state doesn't match, force update one more time
          if (finalState?.steps !== newSteps) {
            setPlayers(prev => {
              const corrected = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
              corrected[movingPlayerIndex].pieces[pieceId].steps = newSteps;
              corrected[movingPlayerIndex].pieces[pieceId].isHome = false;
              corrected[movingPlayerIndex].pieces[pieceId].isInPlay = newSteps > 0 && newSteps < maxSteps;
              playersRef.current = corrected; // Update ref
              updatedState = corrected; // Update captured state
              return corrected;
            });
          }
          
          isMovingRef.current = false; // Reset moving flag
          isAutoMovingRef.current = false; // Clear auto-moving flag
          
          // Determine if player should keep turn: rolled 6 OR captured a token
          // CRITICAL: Use the captured rolled value to avoid closure issues
          const rolledValue = typeof capturedRolledValue === 'number' ? capturedRolledValue : 0;
          const isSix = rolledValue === 6;
          const hasCapture = didCapture === true;
          const keepTurn = isSix || hasCapture;
          
          // CRITICAL: Always reset dice value first (regardless of keepTurn)
          setDiceValueImmediate(0);
          lastLocalDiceRollTimeRef.current = 0;
          
          if (keepTurn) {
            // Player keeps turn (rolled 6 or captured) - don't advance
            setCanRollDice(true);
          } else {
            // CRITICAL: Advance to next player - this MUST happen for non-6, non-capture moves
            const nextPlayer = getNextActivePlayer(movingPlayerIndex);
            
            // Force update current player and ref immediately - use both setState and direct ref update
            setCurrentPlayer(nextPlayer);
            currentPlayerRef.current = nextPlayer; // Update ref immediately to prevent race conditions
            lastTurnAdvanceTimeRef.current = Date.now(); // Track when we advanced the turn locally
            setCanRollDice(true);
          }
        });
      } else {
        // Invalid move, reset flags
        isMovingRef.current = false;
        isAutoMovingRef.current = false;
      }
    } else {
      // Invalid move, reset flags
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
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
    // Notify invited friends (soft invite event)
    if (onlineMode && selectedFriends.length > 0 && isConnected) {
      try {
        const invitedIds = selectedFriends.map(f => f._id).filter(Boolean);
        emit('ludo_invite', {
          from: myProfile?._id,
          to: invitedIds,
          game: 'ludo',
          timestamp: Date.now(),
        });
      } catch (_) {}
    }
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

  const renderLudoBoard = useMemo(() => {
    return (
      <Svg width={BOARD_SIZE} height={BOARD_SIZE} viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}>
        {/* Main board background */}
        <Rect
          x="0"
          y="0"
          width={BOARD_SIZE}
          height={BOARD_SIZE}
          fill="#FFFFFF"
          stroke="#111111"
          strokeWidth="2"
          rx="10"
          ry="10"
        />

        {Array.from({ length: 15 }, (_: any, row: number) =>
          Array.from({ length: 15 }, (_: any, col: number) => {
            let fillColor = "#FFFFFF";
            let strokeColor = "#e5e7eb";
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

        {/* Inner white squares in home areas with pips (web parity) */}
        {/* Red home inner */}
        <Rect 
          x={CELL_SIZE * 1} 
          y={CELL_SIZE * 1} 
          width={CELL_SIZE * 4} 
          height={CELL_SIZE * 4} 
          fill="#FFFFFF" 
          stroke="#1f2937" 
          strokeWidth="1.5" 
        />
        {/* Red pips */}
        {(() => {
          const cx = (1 + 2) * CELL_SIZE;
          const cy = (1 + 2) * CELL_SIZE;
          const r = CELL_SIZE * 0.30;
          const gap = CELL_SIZE * 0.45;
          const pts = [[-gap,-gap],[gap,-gap],[-gap,gap],[gap,gap]];
          return pts.map((o, i) => (
            <Circle key={`pip-red-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={r} fill="#FF0000" stroke="#000" strokeWidth={2} />
          ));
        })()}
        {/* Green home inner */}
        <Rect x={CELL_SIZE * 10} y={CELL_SIZE * 1} width={CELL_SIZE * 4} height={CELL_SIZE * 4} fill="#FFFFFF" stroke="#1f2937" strokeWidth="1.5" />
        {(() => {
          const cx = (10 + 2) * CELL_SIZE;
          const cy = (1 + 2) * CELL_SIZE;
          const r = CELL_SIZE * 0.30;
          const gap = CELL_SIZE * 0.45;
          const pts = [[-gap,-gap],[gap,-gap],[-gap,gap],[gap,gap]];
          return pts.map((o, i) => (
            <Circle key={`pip-green-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={r} fill="#00FF00" stroke="#000" strokeWidth={2} />
          ));
        })()}
        {/* Blue home inner */}
        <Rect x={CELL_SIZE * 1} y={CELL_SIZE * 10} width={CELL_SIZE * 4} height={CELL_SIZE * 4} fill="#FFFFFF" stroke="#1f2937" strokeWidth="1.5" />
        {(() => {
          const cx = (1 + 2) * CELL_SIZE;
          const cy = (10 + 2) * CELL_SIZE;
          const r = CELL_SIZE * 0.30;
          const gap = CELL_SIZE * 0.45;
          const pts = [[-gap,-gap],[gap,-gap],[-gap,gap],[gap,gap]];
          return pts.map((o, i) => (
            <Circle key={`pip-blue-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={r} fill="#0000FF" stroke="#000" strokeWidth={2} />
          ));
        })()}
        {/* Yellow home inner */}
        <Rect x={CELL_SIZE * 10} y={CELL_SIZE * 10} width={CELL_SIZE * 4} height={CELL_SIZE * 4} fill="#FFFFFF" stroke="#1f2937" strokeWidth="1.5" />
        {(() => {
          const cx = (10 + 2) * CELL_SIZE;
          const cy = (10 + 2) * CELL_SIZE;
          const r = CELL_SIZE * 0.30;
          const gap = CELL_SIZE * 0.45;
          const pts = [[-gap,-gap],[gap,-gap],[-gap,gap],[gap,gap]];
          return pts.map((o, i) => (
            <Circle key={`pip-yellow-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={r} fill="#FFFF00" stroke="#000" strokeWidth={2} />
          ));
        })()}

        {/* Start squares - always show all four */}
        {/* Red start (row 13, column 7) - bottom of left vertical path */}
        <Rect
          x={CELL_SIZE * 7}
          y={CELL_SIZE * 13}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FF0000"
          stroke="#1f2937"
          strokeWidth="1.5"
        />

        {/* Green start (row 7, column 13) - right of top horizontal path */}
        <Rect
          x={CELL_SIZE * 13}
          y={CELL_SIZE * 7}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#00FF00"
          stroke="#1f2937"
          strokeWidth="1.5"
        />

        {/* Blue start (row 2, column 7) - top of right vertical path */}
        <Rect
          x={CELL_SIZE * 7}
          y={CELL_SIZE * 2}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#0000FF"
          stroke="#1f2937"
          strokeWidth="1.5"
        />

        {/* Yellow start (row 7, column 2) - left of bottom horizontal path */}
        <Rect
          x={CELL_SIZE * 2}
          y={CELL_SIZE * 7}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FFFF00"
          stroke="#1f2937"
          strokeWidth="1.5"
        />

        {/* Colored home columns (single width towards center) */}
        {[1, 2, 3, 4, 5].map((r) => (
          <Rect key={`green-col-${r}`} x={CELL_SIZE * 7} y={CELL_SIZE * r} width={CELL_SIZE} height={CELL_SIZE} fill="#00FF00" stroke="#1f2937" strokeWidth="1" />
        ))}
        {[9, 10, 11, 12, 13].map((c) => (
          <Rect key={`yellow-row-${c}`} x={CELL_SIZE * c} y={CELL_SIZE * 7} width={CELL_SIZE} height={CELL_SIZE} fill="#FFFF00" stroke="#1f2937" strokeWidth="1" />
        ))}
        {[9, 10, 11, 12].map((r) => (
          <Rect key={`blue-col-${r}`} x={CELL_SIZE * 7} y={CELL_SIZE * r} width={CELL_SIZE} height={CELL_SIZE} fill="#0000FF" stroke="#1f2937" strokeWidth="1" />
        ))}
        {[1, 2, 3, 4, 5].map((c) => (
          <Rect key={`red-row-${c}`} x={CELL_SIZE * c} y={CELL_SIZE * 7} width={CELL_SIZE} height={CELL_SIZE} fill="#FF0000" stroke="#1f2937" strokeWidth="1" />
        ))}


        {/* Center 3x3 backdrop left as white; pinwheel below draws the colored triangles */}

        {/* Entry highlight cells (web parity) */}
        <Rect x={CELL_SIZE * 1} y={CELL_SIZE * 6} width={CELL_SIZE} height={CELL_SIZE} fill="#FF0000" stroke="#000" strokeWidth="1" />
        <Rect x={CELL_SIZE * 8} y={CELL_SIZE * 1} width={CELL_SIZE} height={CELL_SIZE} fill="#00FF00" stroke="#000" strokeWidth="1" />
        <Rect x={CELL_SIZE * 6} y={CELL_SIZE * 13} width={CELL_SIZE} height={CELL_SIZE} fill="#0000FF" stroke="#000" strokeWidth="1" />
        <Rect x={CELL_SIZE * 13} y={CELL_SIZE * 8} width={CELL_SIZE} height={CELL_SIZE} fill="#FFFF00" stroke="#000" strokeWidth="1" />

        {/* Safe positions - first cell of each home column (cannot be captured) */}
        {/* Red safe position */}
        <Rect
          x={CELL_SIZE * 1}
          y={CELL_SIZE * 6}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FF0000"
          stroke="#374151"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        {/* Green safe position */}
        <Rect
          x={CELL_SIZE * 8}
          y={CELL_SIZE * 1}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#00FF00"
          stroke="#374151"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        {/* Blue safe position */}
        <Rect
          x={CELL_SIZE * 6}
          y={CELL_SIZE * 13}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#0000FF"
          stroke="#374151"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        {/* Yellow safe position */}
        <Rect
          x={CELL_SIZE * 13}
          y={CELL_SIZE * 8}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FFFF00"
          stroke="#374151"
          strokeWidth="2"
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
  }, [BOARD_SIZE]);

  const renderTokens = useMemo(() => {
    const maxSteps = 59;
    return (
      <View style={StyleSheet.absoluteFillObject}>
        {renderPlayerOrder.map((playerIndex: number) =>
          players[playerIndex]?.pieces.map((piece: Piece, pieceIndex: number) => {
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
              const pos = getPositionOnPath(playerIndex, piece.steps);
              const key = `${pos.x},${pos.y}`;
              const group = cellOccupancy.get(key) || [];
              const idxInGroup = group.findIndex((g: { playerIndex: number; pieceIndex: number }) => g.playerIndex === playerIndex && g.pieceIndex === pieceIndex);
              const { dx, dy } = getOverlapOffset(group.length, idxInGroup);
              
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
                      { translateX: dx },
                      { translateY: dy },
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
                        {/* inner ring */}
                        <View style={{ position: 'absolute', left: 4, top: 4, right: 4, bottom: 4, borderRadius: (tokenSize/2)-4, borderWidth: 3, borderColor: '#ffffff22' }} />
                        {/* glossy highlight */}
                        <View style={{ position: 'absolute', left: tokenSize*0.14, top: tokenSize*0.12, width: tokenSize*0.55, height: tokenSize*0.55, borderRadius: (tokenSize*0.55)/2, backgroundColor: '#ffffff', opacity: 0.15 }} />
                      {players[playerIndex]?.avatar ? (
                        <>
                          <Image
                            source={{ uri: players[playerIndex].avatar as string }}
                            style={{
                              width: tokenSize * 0.8,
                              height: tokenSize * 0.8,
                              borderRadius: (tokenSize * 0.8) / 2,
                            }}
                          />
                        </>
                      ) : (
                        piece.steps === maxSteps ? (
                          <Text style={{
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: 20,
                          }}>
                            ✓
                          </Text>
                        ) : null
                      )}
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
                        {/* inner ring */}
                        <View style={{ position: 'absolute', left: 4, top: 4, right: 4, bottom: 4, borderRadius: (tokenSize/2)-4, borderWidth: 3, borderColor: '#ffffff22' }} />
                        {/* glossy highlight */}
                        <View style={{ position: 'absolute', left: tokenSize*0.14, top: tokenSize*0.12, width: tokenSize*0.55, height: tokenSize*0.55, borderRadius: (tokenSize*0.55)/2, backgroundColor: '#ffffff', opacity: 0.15 }} />
                        {players[playerIndex]?.avatar ? (
                          <>
                            <Image
                              source={{ uri: players[playerIndex].avatar as string }}
                              style={{
                                width: tokenSize * 0.8,
                                height: tokenSize * 0.8,
                                borderRadius: (tokenSize * 0.8) / 2,
                              }}
                            />
                          </>
                        ) : (
                          <Text style={{
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: 16,
                          }}>
                            {''}
                          </Text>
                        )}
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
                      {players[playerIndex]?.avatar ? (
                        <>
                          <Image
                            source={{ uri: players[playerIndex].avatar as string }}
                            style={{
                              width: tokenSize * 0.8,
                              height: tokenSize * 0.8,
                              borderRadius: (tokenSize * 0.8) / 2,
                            }}
                          />
                        </>
                      ) : (
                        <Text style={{
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: 16,
                        }}>
                          {''}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              }
            }
          })
        )}

        {/* Animated stroke overlays for movable tokens - only for current player */}
        {players.map((player: Player, playerIndex: number) =>
          player.pieces.map((piece: Piece, pieceIndex: number) => {
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
        {players.map((player: Player, playerIndex: number) =>
          player.pieces.map((piece: Piece, pieceIndex: number) => {
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
  }, [renderPlayerOrder, players, currentPlayer, selectedPlayerCount, diceValue, captureAnimations, cellOccupancy, tokenPositionAnimations, tokenNativeScaleAnimations, tokenNativeOpacityAnimations]);

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
              <Text style={styles.pieceText}>{''}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (gameEnded) {
    return (
      <ImageBackground source={backgroundImageSource} style={styles.bg} resizeMode="cover">
        <View style={StyleSheet.absoluteFillObject}>
          <Emitter
            numberOfParticles={40}
            emissionRate={2}
            interval={220}
            particleLife={4500}
            direction={-90}
            spread={360}
            speed={2}
            gravity={0.12}
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
      </ImageBackground>
    );
  }

  if (showPlayerSelection) {
    return (
      <ImageBackground source={backgroundImageSource} style={styles.bg} resizeMode="cover">
        <View style={StyleSheet.absoluteFillObject}>
          <Emitter
            numberOfParticles={40}
            emissionRate={2}
            interval={220}
            particleLife={4500}
            direction={-90}
            spread={360}
            speed={2}
            gravity={0.12}
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
            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
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

            {/* Online toggle and friend picker */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.playerCountLabel, { fontWeight: '700' }]}>Play Online with Friends</Text>
                <TouchableOpacity onPress={() => setOnlineMode(!onlineMode)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: onlineMode ? '#29B1A9' : 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: 'white', fontWeight: '600' }}>{onlineMode ? 'On' : 'Off'}</Text>
                </TouchableOpacity>
              </View>
              {onlineMode && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Icon name="search" size={18} color="#FFD700" />
                    <TextInput
                      placeholder="Search friends by name..."
                      placeholderTextColor="#B0B0B0"
                      value={friendSearchQuery}
                      onChangeText={onChangeFriendSearch}
                      style={{ flex: 1, color: 'white', paddingVertical: 4 }}
                    />
                  </View>
                  <FlatList
                    data={(friendSearchQuery ? searchResults : friendList) as any[]}
                    keyExtractor={(item: any) => item?._id || String(item?.id) || Math.random().toString()}
                    renderItem={({ item: f }: { item: any }) => {
                      const isSelected = selectedFriends.some(sf => sf._id === f._id);
                      return (
                        <TouchableOpacity onPress={() => {
                          setSelectedFriends(prev => {
                            if (isSelected) return prev.filter(p => p._id !== f._id);
                            const next = [...prev, f];
                            return next.slice(0, Math.max(0, selectedPlayerCount - 1));
                          });
                        }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#333' }}>
                              {f?.profilePic ? (
                                <Image source={{ uri: f.profilePic }} style={{ width: 28, height: 28 }} />
                              ) : null}
                            </View>
                            <Text style={{ color: 'white', fontSize: 14 }}>{f?.fullName || 'Unknown'}</Text>
                          </View>
                          <Icon name={isSelected ? 'check-circle' : 'radio-button-unchecked'} size={18} color={isSelected ? '#29B1A9' : '#888'} />
                        </TouchableOpacity>
                      );
                    }}
                    style={{ maxHeight: 220, marginTop: 8 }}
                    nestedScrollEnabled={true}
                    initialNumToRender={10}
                    windowSize={7}
                    ListEmptyComponent={loadingSearch ? (
                      <Text style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>Searching...</Text>
                    ) : null}
                  />
                  <Text style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>
                    Selected: {selectedFriends.length} / {Math.max(0, selectedPlayerCount - 1)}
                  </Text>
                </View>
              )}
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
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImageSource} style={styles.bg} resizeMode="cover">
      <View style={StyleSheet.absoluteFillObject}>
        <Emitter
          numberOfParticles={40}
          emissionRate={2}
          interval={220}
          particleLife={4500}
          direction={-90}
          spread={360}
          speed={2}
          gravity={0.12}
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

              {/* Dice moved to board center overlay */}
            </View>
          </View>

          <View style={styles.boardContainer}>
            <View style={styles.boardWrapper}>
              <View style={styles.board}>
                {renderLudoBoard}
                {renderTokens}
                {/* Centered dice overlay (web parity) */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50, pointerEvents: canRollDice ? 'auto' : 'none' }}>
                  <TouchableOpacity onPress={rollDice} disabled={!canRollDice || diceRolling} activeOpacity={0.8}>
                    <View style={{ width: 108, height: 108, alignItems: 'center', justifyContent: 'center' }}>
                      {(!diceRolling && canRollDice && diceValue === 0) ? (
                        players[currentPlayer]?.avatar ? (
                          <Image source={{ uri: players[currentPlayer].avatar as string }} style={{ width: 80, height: 80, borderRadius: 40, resizeMode: 'cover', backgroundColor: 'transparent', borderWidth: 3, borderColor: players[currentPlayer]?.color || '#FFD700' }} />
                        ) : (
                          <Icon name="casino" size={80} color={players[currentPlayer]?.color || '#FFD700'} />
                        )
                      ) : (
                        <View style={{ width: 108, height: 108, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: players[currentPlayer]?.color || '#FFD700', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }}>
                          {renderDiceDots(diceValue > 0 ? diceValue : 1)}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
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
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 20, 25, 0.6)',
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
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(26, 35, 50, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  currentPlayerInfo: {
    flex: 1,
  },
  currentPlayerLabel: {
    fontSize: 11,
    color: '#B0B0B0',
    marginBottom: 4,
    marginTop: 0,
  },
  currentPlayerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginRight: 10,
    shadowOffset: { width: 0, height: 1 },
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
    fontSize: 14,
    marginRight: 6,
  },
  currentPlayerName: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
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
    maxHeight: '80%',
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

