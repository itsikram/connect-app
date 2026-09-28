import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  StatusBar,
  Animated,
  Easing,
  Image,
  ScrollView,
  Share,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useSocket } from '../contexts/SocketContext';
import api, { connectAPI } from '../lib/api';
import config from '../lib/config';
import { RootState } from '../store';
import ProfileImage from '../components/ProfileImage';
import {
  BOARD_CELLS,
  COLORS,
  DICE_ROLL_ANIMATION_MS,
  DICE_RESULT_DISPLAY_MS,
  DICE_MIN_VISIBLE_MS,
  CENTER_DICE_CELLS,
  FINISHED_TOKEN_BAND_CELLS,
  FINISHED_TOKEN_SIZE_CELLS,
  FINISHED_TOKEN_GAP_CELLS,
  HOME_POSITIONS,
  PLAYER_NAMES,
  ROLL_UNLOCK_DELAY_MS,
  STEP_DURATION_MS,
  THEME,
  TURN_TRANSITION_DELAY_MS,
} from '../lib/ludo/constants';
import { adjustHexColor } from '../lib/ludo/colorUtils';
import { Dice3D } from '../lib/ludo/DiceSVG';
import { GameBoard } from '../lib/ludo/GameBoard';
import { GameHeader } from '../lib/ludo/GameHeader';
import { PausedOverlay, SavedGamesPanel } from '../lib/ludo/PauseViews';
import type { PauseInfo, SavedOnlineGame } from '../lib/ludo/PauseViews';
import {
  createLocalSaveId,
  listLocalSaves,
  removeLocalSave,
  upsertLocalSave,
} from '../lib/ludo/savedGames';
import type { LocalSave } from '../lib/ludo/savedGames';
import {
  GameEndedScreen,
  IncomingInviteModal,
  PlayerDock,
  WinnerModal,
} from '../lib/ludo/GameOverlays';
import {
  applyPieceLifecycle,
  clonePlayers,
  countOccupiedLobbySeats,
  generateGameId,
  getBoardSeatIndex,
  getRenderPlayerOrder,
  getTokenOffset,
  isHumanLudoProfileId,
  isLobbySeatOccupied,
} from '../lib/ludo/helpers';
import {
  checkForCapture,
  checkForCaptureAfterMoveAway,
  getMaxSteps,
  getNextActivePlayer as nextActivePlayer,
  getPieceSteps,
  getPlayablePieces as findPlayablePieces,
  getPositionOnPath,
  pickSmartBotPiece,
} from '../lib/ludo/gameLogic';
import { PlayerSelectionModal } from '../lib/ludo/PlayerSelectionModal';
import { PlayerEditorModal } from '../lib/ludo/PlayerEditorModal';
import { useLudoAudio } from '../lib/ludo/useLudoAudio';
import { useConnectionHealth } from '../lib/ludo/useConnectionHealth';
import { FunFxLayer, createBurst, type FxBurst } from '../lib/ludo/FunFxLayer';
import type { ConnectUser, GameSnapshot, LudoInvite, Player } from '../lib/ludo/types';

const CONNECT_LOGO = require('../assets/images/logo.png');
const TOKEN_STEP_ANIMATION_MS = 300;

const LudoGameSVG = () => {
  const {
    setLudoGameActive,
    pendingLudoInvite,
    consumeLudoInvite,
  } = useLudoGame();
  const { emit, on, off, isConnected } = useSocket();
  const myProfile = useSelector((state: RootState) => state.profile);

  const win = Dimensions.get('window');
  const isCompact = win.width <= 768;
  const padding = Math.min(20, Math.max(8, win.width * 0.04));
  const chrome = isCompact ? 210 : 230;
  const availableW = Math.max(200, win.width - padding * 2);
  const availableH = Math.max(200, win.height - chrome);
  const BOARD_SIZE = Math.round(
    Math.max(
      Math.min(isCompact ? 280 : 300, availableW),
      Math.min(isCompact ? 520 : 600, Math.min(availableW, availableH, isCompact ? 520 : 600)),
    ),
  );
  const CELL_SIZE = BOARD_SIZE / BOARD_CELLS;
  const tokenSize = Math.max(12, Math.round(CELL_SIZE * 0.88));
  const boardTokenSize = tokenSize;
  const finishedTokenSize = Math.max(9, Math.round(CELL_SIZE * FINISHED_TOKEN_SIZE_CELLS));
  const maxSteps = useMemo(() => getMaxSteps(), []);

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [canRollDice, setCanRollDice] = useState(true);
  const [showPlayerSelection, setShowPlayerSelection] = useState(true);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winners, setWinners] = useState<Player[]>([]);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [consecutiveSixes, setConsecutiveSixes] = useState<Record<number, number>>({});
  const [onlineMode, setOnlineMode] = useState(false);
  const [playWithComputer, setPlayWithComputer] = useState(false);
  const [selectedConnects, setSelectedConnects] = useState<ConnectUser[]>([]);
  const [connectSearchQuery, setConnectSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConnectUser[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [connectList, setConnectList] = useState<ConnectUser[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [invitedStatusByConnectId, setInvitedStatusByConnectId] = useState<Record<string, string>>({});
  const [invitedSlotByConnectId, setInvitedSlotByConnectId] = useState<Record<string, number>>({});
  const [incomingInviteRequest, setIncomingInviteRequest] = useState<LudoInvite | null>(null);
  const [diceSpin, setDiceSpin] = useState(0);
  const { soundsEnabled, playSound: playAudio, toggleSounds } = useLudoAudio();

  // Fun effects: comic pop-ups over the board plus a board shake/wiggle.
  // Tied to sounds (like the web game) so every event gets both, and the
  // visuals still play with the sound turned off.
  const [fxBursts, setFxBursts] = useState<FxBurst[]>([]);
  const boardShake = useRef(new Animated.Value(0)).current;
  const boardBounce = useRef(new Animated.Value(0)).current;
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotionRef.current = Boolean(enabled);
      })
      .catch(() => {});
  }, []);
  const removeFxBurst = useCallback((id: string) => {
    setFxBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);
  const triggerFx = useCallback(
    (kind: string) => {
      const burst = createBurst(kind, Math.min(1, Math.max(0.7, win.width / 520)));
      if (burst) setFxBursts((prev) => [...prev.slice(-3), burst]);
      if (reduceMotionRef.current) return;
      if (kind === 'capture' || kind === 'threeSixes') {
        boardShake.setValue(0);
        Animated.timing(boardShake, {
          toValue: 1,
          duration: 480,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      } else if (kind === 'rolledSix' || kind === 'win') {
        boardBounce.setValue(0);
        Animated.timing(boardBounce, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }
    },
    [boardShake, boardBounce, win.width],
  );
  const playSound = useCallback(
    (soundType: string) => {
      triggerFx(soundType);
      playAudio(soundType);
    },
    [triggerFx, playAudio],
  );
  const connectionHealth = useConnectionHealth(onlineMode && Boolean(gameId), isConnected, emit);
  // Online actions sent over a dead or very slow link arrive late or not at
  // all, so the board waits until the connection is usable again.
  const connectionReady = !onlineMode || !gameId || connectionHealth === 'ok';
  const connectionReadyRef = useRef(connectionReady);
  connectionReadyRef.current = connectionReady;
  const [showPlayerEditor, setShowPlayerEditor] = useState(false);
  const [editingPlayerIndex, setEditingPlayerIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [tokenAnimation, setTokenAnimation] = useState<{
    key: string;
    translateX: Animated.Value;
    translateY: Animated.Value;
    hop: Animated.Value;
  } | null>(null);

  const playersRef = useRef(players);
  const currentPlayerRef = useRef(currentPlayer);
  const selectedPlayerCountRef = useRef(selectedPlayerCount);
  const winnersRef = useRef(winners);
  const maxStepsRef = useRef(maxSteps);
  const diceValueRef = useRef(diceValue);
  const gameStartedRef = useRef(gameStarted);
  const gameEndedRef = useRef(gameEnded);
  const myPlayerIndexRef = useRef(myPlayerIndex);
  const consecutiveSixesRef = useRef(consecutiveSixes);
  const playWithComputerRef = useRef(playWithComputer);
  const gameIdRef = useRef(gameId);
  const onlineModeRef = useRef(onlineMode);
  const latestSnapshotVersionRef = useRef(0);
  const lastRollTimeRef = useRef(0);
  const lastLocalDiceRollTimeRef = useRef(0);
  const isRollingRef = useRef(false);
  const isMovingRef = useRef(false);
  const isAutoMovingRef = useRef(false);
  const diceResultVisibleUntilRef = useRef(0);

  // Pause & save. Online, the server owns the pause (any player can pause,
  // the host resumes). Offline games are saved on this device.
  const [gamePaused, setGamePaused] = useState<PauseInfo | null>(null);
  const gamePausedRef = useRef<PauseInfo | null>(null);
  const applyPauseState = useCallback((pause: PauseInfo | null) => {
    gamePausedRef.current = pause;
    setGamePaused(pause);
  }, []);
  const [resumeDenied, setResumeDenied] = useState(false);
  const [localSaves, setLocalSaves] = useState<LocalSave[]>([]);
  const [onlineSavedGames, setOnlineSavedGames] = useState<SavedOnlineGame[]>([]);
  const localSaveIdRef = useRef<string | null>(null);

  // Display-only copy of the last landed roll. Game logic clears diceValue as
  // soon as a piece moves or the turn passes; this keeps the face visible for
  // DICE_MIN_VISIBLE_MS so every player sees the same number, and online
  // nobody can roll again until it has passed.
  const [heldRoll, setHeldRoll] = useState<{ value: number; player: number } | null>(null);
  const heldRollRef = useRef<{ value: number; player: number } | null>(null);
  const diceHoldUntilRef = useRef(0);
  const heldRollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownRollRef = useRef({ value: 0, at: 0 });

  // source "roll" = a real roll event (always wins); "sync" = a value that
  // arrived through a snapshot, which must not replace a roll being shown.
  const showRolledValue = useCallback(
    (value: number, player: number, source: 'roll' | 'sync' = 'roll') => {
      if (!Number.isInteger(value) || value < 1 || value > 6) return;
      const now = Date.now();
      const holdActive = heldRollRef.current && now < diceHoldUntilRef.current;
      if (source === 'sync') {
        if (holdActive) return;
        // Snapshots repeat the current roll until a piece moves; that roll was
        // already shown, so don't restart the hold (and the roll lock).
        const last = lastShownRollRef.current;
        if (last.value === value && now - last.at < 10000) return;
      }
      lastShownRollRef.current = { value, at: now };
      const held = { value, player };
      heldRollRef.current = held;
      setHeldRoll(held);
      diceHoldUntilRef.current = now + DICE_MIN_VISIBLE_MS;
      if (heldRollTimerRef.current) clearTimeout(heldRollTimerRef.current);
      heldRollTimerRef.current = setTimeout(() => {
        heldRollRef.current = null;
        setHeldRoll(null);
      }, DICE_MIN_VISIBLE_MS);
    },
    [],
  );

  useEffect(
    () => () => {
      if (heldRollTimerRef.current) clearTimeout(heldRollTimerRef.current);
    },
    [],
  );
  const moveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const botActingRef = useRef(false);
  const botActingPlayerIndexRef = useRef<number | null>(null);
  const botTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentMovesRef = useRef(new Map<string, { toSteps: number; timestamp: number; isCapture?: boolean }>());
  // Guest only: set after sending our own move until the host's next snapshot
  // confirms it, so a late pre-move dice snapshot cannot re-enable that roll.
  const pendingOwnMoveRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newGameDraftIdRef = useRef<string | null>(null);
  const autoStartLudoInviteRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const diceRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { selectedPlayerCountRef.current = selectedPlayerCount; }, [selectedPlayerCount]);
  useEffect(() => { winnersRef.current = winners; }, [winners]);
  useEffect(() => { maxStepsRef.current = maxSteps; }, [maxSteps]);
  useEffect(() => { diceValueRef.current = diceValue; }, [diceValue]);
  useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);
  useEffect(() => { gameEndedRef.current = gameEnded; }, [gameEnded]);
  useEffect(() => { myPlayerIndexRef.current = myPlayerIndex; }, [myPlayerIndex]);
  useEffect(() => { consecutiveSixesRef.current = consecutiveSixes; }, [consecutiveSixes]);
  useEffect(() => { playWithComputerRef.current = playWithComputer; }, [playWithComputer]);
  useEffect(() => { gameIdRef.current = gameId; }, [gameId]);
  useEffect(() => { onlineModeRef.current = onlineMode; }, [onlineMode]);

  const setDiceValueImmediate = useCallback((value: number) => {
    setDiceValue(value);
    diceValueRef.current = value;
    if (value === 0) diceResultVisibleUntilRef.current = 0;
    else showRolledValue(value, currentPlayerRef.current, 'sync');
  }, [showRolledValue]);

  const setCurrentPlayerImmediate = useCallback((value: number) => {
    setCurrentPlayer(value);
    currentPlayerRef.current = value;
  }, []);

  const renderPlayerOrder = useMemo(
    () => getRenderPlayerOrder(selectedPlayerCount),
    [selectedPlayerCount],
  );

  const isMyTurn = useMemo(() => {
    if (!onlineMode && !playWithComputer) {
      return !players[currentPlayer]?.isBot;
    }
    return currentPlayer === myPlayerIndex;
  }, [onlineMode, playWithComputer, currentPlayer, myPlayerIndex, players]);

  const initializeGame = useCallback((
    playerCount = selectedPlayerCount,
    friends: ConnectUser[] = selectedConnects,
  ) => {
    const newPlayers: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
      const boardSeatIndex = getBoardSeatIndex(i, playerCount);
      const connect = i > 0 ? friends[i - 1] : undefined;
      const pieces = Array.from({ length: 4 }).map((_, j) => ({
        id: j,
        color: COLORS[boardSeatIndex],
        position: { x: 0, y: 0 },
        isHome: true,
        isInPlay: false,
        steps: 0,
      }));
      newPlayers.push({
        id: i,
        name:
          i === 0
            ? myProfile?.fullName || 'You'
            : connect?.fullName || PLAYER_NAMES[boardSeatIndex],
        color: COLORS[boardSeatIndex],
        pieces,
        isActive: i === 0,
        avatar: i === 0 ? myProfile?.profilePic : connect?.profilePic,
        cover:
          i === 0
            ? myProfile?.coverPic || (myProfile as any)?.cover
            : connect?.coverPic || connect?.cover,
        profileId: i === 0 ? myProfile?._id || 'local' : connect?._id,
      });
    }
    playersRef.current = newPlayers;
    setPlayers(newPlayers);
    const sixes: Record<number, number> = {};
    for (let i = 0; i < playerCount; i++) sixes[i] = 0;
    setConsecutiveSixes(sixes);
    consecutiveSixesRef.current = sixes;
  }, [selectedPlayerCount, selectedConnects, myProfile]);

  useEffect(() => {
    // An online guest's seats come from the host's snapshots; rebuilding them
    // here would wipe a lobby snapshot when its player count is applied.
    const isOnlineGuest = onlineModeRef.current && myPlayerIndexRef.current !== 0;
    if (!gameStartedRef.current && !isOnlineGuest) {
      initializeGame(selectedPlayerCount, selectedConnects);
    }
    // Only rebuild seats when the player count changes. Connect assigns update seats directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerCount]);

  useEffect(() => {
    if ((showPlayerSelection || showPlayerEditor) && myProfile?._id) {
      connectAPI.getConnectList(myProfile._id)
        .then((res) => setConnectList(Array.isArray(res.data) ? res.data : []))
        .catch(() => setConnectList([]));
    }
  }, [showPlayerSelection, showPlayerEditor, myProfile?._id]);

  const onChangeConnectSearch = (text: string) => {
    setConnectSearchQuery(text);
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
      } catch {
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  const persistAndBroadcastGameState = useCallback((actionType: string) => {
    if (myPlayerIndexRef.current !== 0 || !onlineModeRef.current || !gameIdRef.current) return;
    const snapshot: GameSnapshot = {
      gameId: gameIdRef.current,
      players: playersRef.current,
      currentPlayer: currentPlayerRef.current,
      diceValue: diceValueRef.current,
      gameStarted: gameStartedRef.current,
      gameEnded: gameEndedRef.current,
      winners: winnersRef.current,
      selectedPlayerCount: selectedPlayerCountRef.current,
      consecutiveSixes: consecutiveSixesRef.current,
      playersSeq: Date.now(),
      lastActionType: actionType,
    };
    latestSnapshotVersionRef.current = snapshot.playersSeq || 0;
    emit('ludo:players', snapshot);
    api.post('/ludo/save', snapshot).catch(() => null);
  }, [emit]);

  const getPlayablePieces = useCallback((playerIndex: number, diceVal: number) => {
    return findPlayablePieces(
      playerIndex,
      diceVal,
      playersRef.current,
      maxStepsRef.current || maxSteps,
    );
  }, [maxSteps]);

  const isBotPlayerIndex = useCallback((playerIndex: number) => {
    return Boolean(playersRef.current?.[playerIndex]?.isBot);
  }, []);

  const advanceTurnForPlayer = useCallback((fromPlayer: number, actionType = 'turn_advance') => {
    // In an online match only the host moves the turn on. A guest acting on
    // its own timers can overtake the host's snapshots and then disagree
    // about whose turn it is, so it simply waits for the host's update.
    if (onlineModeRef.current && myPlayerIndexRef.current !== 0) return;
    // Ignore timers that fire after the turn has already moved on.
    if (currentPlayerRef.current !== fromPlayer) return;
    const nextPlayer = nextActivePlayer(
      fromPlayer,
      selectedPlayerCountRef.current,
      playersRef.current,
      winnersRef.current,
    );
    playSound('turnChange');
    setCurrentPlayerImmediate(nextPlayer);
    setDiceValueImmediate(0);
    lastLocalDiceRollTimeRef.current = 0;
    if (myPlayerIndexRef.current === 0 && onlineModeRef.current && gameIdRef.current) {
      persistAndBroadcastGameState(actionType);
    }
    setTimeout(() => {
      if (
        (!onlineModeRef.current || myPlayerIndexRef.current === currentPlayerRef.current) &&
        !isMovingRef.current &&
        currentPlayerRef.current === nextPlayer &&
        diceValueRef.current === 0
      ) {
        setCanRollDice(true);
      }
    }, 200);
  }, [playSound, persistAndBroadcastGameState, setCurrentPlayerImmediate, setDiceValueImmediate]);

  const resolveWinnerStateForPlayer = useCallback((updatedPlayers: Player[], playerIndex: number) => {
    const playerPieces = updatedPlayers?.[playerIndex]?.pieces || [];
    const finishedCount = playerPieces.filter((p) => p.steps === maxStepsRef.current).length;
    if (finishedCount !== 4) {
      return { didFinish: false, winners: winnersRef.current, gameEnded: gameEndedRef.current };
    }
    const winnerPlayer = updatedPlayers[playerIndex];
    const existingWinners = winnersRef.current || [];
    const alreadyWinner = existingWinners.some((w) => String(w.id) === String(winnerPlayer?.id));
    const nextWinners = alreadyWinner ? existingWinners : [...existingWinners, winnerPlayer];
    if (!alreadyWinner) {
      setWinners(nextWinners);
      winnersRef.current = nextWinners;
      setWinner(winnerPlayer);
      setShowWinnerModal(true);
      playSound('win');
    }
    const remainingPlayers = updatedPlayers.filter((_, idx) => idx < selectedPlayerCountRef.current);
    const nextGameEnded = nextWinners.length >= remainingPlayers.length - 1;
    if (nextGameEnded) {
      setGameEnded(true);
      gameEndedRef.current = true;
      // Announce the result right away rather than with the next turn update,
      // so the others see it even if the host leaves the moment it wins.
      if (myPlayerIndexRef.current === 0 && onlineModeRef.current && gameIdRef.current) {
        setTimeout(() => persistAndBroadcastGameState('game_ended'), 0);
      }
    }
    return { didFinish: true, winners: nextWinners, gameEnded: nextGameEnded };
  }, [playSound, persistAndBroadcastGameState]);

  const animateTokenMovement = (
    playerIndex: number,
    pieceIndex: number,
    toSteps: number,
    fromSteps: number,
    onComplete: () => void,
  ) => {
    const stepsToGo = toSteps - fromSteps;
    if (stepsToGo <= 0) {
      onComplete();
      return;
    }
    const finalPosition = getPositionOnPath(playerIndex, toSteps, selectedPlayerCountRef.current);
    const finalX = finalPosition.x * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
    const finalY = finalPosition.y * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
    const points = Array.from({ length: stepsToGo + 1 }, (_, index) => {
      const steps = fromSteps + index;
      if (steps <= 0) {
        const seat = getBoardSeatIndex(playerIndex, selectedPlayerCountRef.current);
        const home = HOME_POSITIONS[seat][pieceIndex];
        return {
          x: home.x * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2,
          y: home.y * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2,
        };
      }
      const position = getPositionOnPath(playerIndex, steps, selectedPlayerCountRef.current);
      return {
        x: position.x * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2,
        y: position.y * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2,
      };
    });
    const translateX = new Animated.Value(points[0].x - finalX);
    const translateY = new Animated.Value(points[0].y - finalY);
    // 0 → 1 → 0 on every square: the token hops up, grows, and lands.
    const hop = new Animated.Value(0);
    const animationKey = `token-${playerIndex}-${pieceIndex}`;
    setTokenAnimation({ key: animationKey, translateX, translateY, hop });

    // A springy "boing" per square (leaving home already has its own sound).
    const boingTimers =
      fromSteps > 0
        ? points.slice(1).map((_, step) =>
            setTimeout(() => playAudio('pieceMove'), step * TOKEN_STEP_ANIMATION_MS),
          )
        : [];

    Animated.sequence(
      points.slice(1).map((point) =>
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: point.x - finalX,
            duration: TOKEN_STEP_ANIMATION_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: point.y - finalY,
            duration: TOKEN_STEP_ANIMATION_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(hop, {
              toValue: 1,
              duration: TOKEN_STEP_ANIMATION_MS * 0.45,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(hop, {
              toValue: 0,
              duration: TOKEN_STEP_ANIMATION_MS * 0.55,
              easing: Easing.bounce,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),
    ).start(() => {
      // Always finish the move, even if the animation was interrupted;
      // otherwise the turn would never complete.
      boingTimers.forEach(clearTimeout);
      setTokenAnimation((current) => (current?.key === animationKey ? null : current));
      onComplete();
    });
  };

  // Socket handlers are bound once; they reach the latest version via this ref.
  const animateTokenMovementRef = useRef(animateTokenMovement);
  animateTokenMovementRef.current = animateTokenMovement;

  const movePiece = (pieceId: number) => {
    if (gamePausedRef.current) {
      // Keep the roll; the piece can be moved once the game resumes.
      isAutoMovingRef.current = false;
      return;
    }
    if (isMovingRef.current && !isAutoMovingRef.current) return;
    if (!connectionReadyRef.current) {
      // Keep the roll; the piece can be moved once the connection is back.
      isAutoMovingRef.current = false;
      return;
    }
    const effectiveDiceValue = diceValueRef.current > 0 ? diceValueRef.current : diceValue;
    const abortMove = (opts?: { skipTurnIfNoMoves?: boolean }) => {
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      if (!opts?.skipTurnIfNoMoves) return;
      const diceVal = diceValueRef.current > 0 ? diceValueRef.current : diceValue;
      const stuckPlayer = currentPlayerRef.current;
      const remaining = getPlayablePieces(stuckPlayer, diceVal);
      if (remaining.length === 0 && diceVal > 0) {
        setTimeout(() => advanceTurnForPlayer(stuckPlayer), TURN_TRANSITION_DELAY_MS);
      }
    };
    if (effectiveDiceValue === 0 || (diceValueRef.current === 0 && diceValue === 0)) {
      abortMove();
      return;
    }
    const resultWaitMs = diceResultVisibleUntilRef.current - Date.now();
    if (resultWaitMs > 0) {
      setTimeout(() => movePiece(pieceId), resultWaitMs);
      return;
    }

    if (onlineMode || playWithComputerRef.current || isBotPlayerIndex(currentPlayerRef.current)) {
      const currentSeatIsBot = isBotPlayerIndex(currentPlayerRef.current);
      const isBotActingForCurrentPlayer = Boolean(
        botActingRef.current &&
        botActingPlayerIndexRef.current === currentPlayerRef.current &&
        currentSeatIsBot,
      );
      if (currentSeatIsBot && !isBotActingForCurrentPlayer) {
        abortMove();
        return;
      }
      if (!isBotActingForCurrentPlayer && myPlayerIndexRef.current !== currentPlayerRef.current) {
        abortMove();
        return;
      }
    }

    const rolledDiceValue = effectiveDiceValue;
    const actingPlayerIndex = currentPlayerRef.current;
    const currentPlayersForMove = playersRef.current;
    const currentPlayerData = currentPlayersForMove[actingPlayerIndex];
    if (!currentPlayerData) {
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      return;
    }
    const piece = currentPlayerData.pieces[pieceId];
    if (!piece) {
      abortMove();
      return;
    }
    const pieceSteps = getPieceSteps(piece);
    if (pieceSteps <= 0 && effectiveDiceValue !== 6) {
      abortMove({ skipTurnIfNoMoves: true });
      return;
    }
    if (pieceSteps > 0 && pieceSteps + effectiveDiceValue > maxSteps) {
      abortMove({ skipTurnIfNoMoves: true });
      return;
    }

    isMovingRef.current = true;
    isAutoMovingRef.current = false;
    const moveTimerId = setTimeout(() => {}, 0);
    moveTimersRef.current.push(moveTimerId);
    setDiceValueImmediate(0);
    lastLocalDiceRollTimeRef.current = 0;
    const playerCount = selectedPlayerCountRef.current;

    const finishTurn = (movingPlayerIndex: number, keepTurn: boolean, didCapture: boolean) => {
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      moveTimersRef.current = moveTimersRef.current.filter((t) => t !== moveTimerId);
      const shouldDeferDiceResetToHost = onlineModeRef.current;
      if (!shouldDeferDiceResetToHost) {
        setDiceValueImmediate(0);
        isRollingRef.current = false;
      }
      const isTurnAuthorityLocal = !onlineModeRef.current || myPlayerIndexRef.current === 0;
      if (isTurnAuthorityLocal) {
        if (keepTurn) {
          setTimeout(() => {
            if (
              (!onlineModeRef.current || myPlayerIndexRef.current === currentPlayerRef.current) &&
              !isMovingRef.current &&
              currentPlayerRef.current === movingPlayerIndex &&
              diceValueRef.current === 0
            ) {
              setCanRollDice(true);
            }
          }, ROLL_UNLOCK_DELAY_MS);
          if (myPlayerIndexRef.current === 0 && onlineModeRef.current && gameIdRef.current) {
            persistAndBroadcastGameState('keep_turn_after_move');
          }
        } else {
          // The turn passes on shortly; no roll may start in between.
          setCanRollDice(false);
          setTimeout(() => {
            const nextPlayer = nextActivePlayer(
              movingPlayerIndex,
              selectedPlayerCountRef.current,
              playersRef.current,
              winnersRef.current,
            );
            playSound('turnChange');
            setCurrentPlayerImmediate(nextPlayer);
            if (myPlayerIndexRef.current === 0 && onlineModeRef.current && gameIdRef.current) {
              persistAndBroadcastGameState('turn_advance_after_move');
            }
            setTimeout(() => {
              if (
                (!onlineModeRef.current || myPlayerIndexRef.current === currentPlayerRef.current) &&
                !isMovingRef.current &&
                currentPlayerRef.current === nextPlayer &&
                diceValueRef.current === 0
              ) {
                setCanRollDice(true);
              }
            }, ROLL_UNLOCK_DELAY_MS);
          }, TURN_TRANSITION_DELAY_MS);
        }
      } else if (pendingOwnMoveRef.current) {
        // Wait for the host's snapshot to decide who plays next.
        setCanRollDice(false);
        isRollingRef.current = true;
      } else {
        // The host's snapshot for this move already arrived while the token
        // was animating; honour it instead of locking the dice.
        isRollingRef.current = false;
        setCanRollDice(
          gameStartedRef.current &&
            !gameEndedRef.current &&
            diceValueRef.current === 0 &&
            currentPlayerRef.current === myPlayerIndexRef.current,
        );
      }
      void didCapture;
    };

    if (pieceSteps <= 0 && effectiveDiceValue === 6) {
      playSound('pieceOut');
      const movingPlayerIndex = actingPlayerIndex;
      const movedPlayers = clonePlayers(playersRef.current);
      movedPlayers[movingPlayerIndex].pieces[pieceId] = applyPieceLifecycle(
        { ...movedPlayers[movingPlayerIndex].pieces[pieceId], ...piece },
        1,
        maxSteps,
      );
      playersRef.current = movedPlayers;
      const newPosition = getPositionOnPath(movingPlayerIndex, 1, playerCount);
      const capturedPieces = checkForCapture(movingPlayerIndex, newPosition, 1, movedPlayers, maxSteps, playerCount);
      const finalCaptures = Array.isArray(capturedPieces) ? capturedPieces : [];
      const didCaptureOnMoveOut = finalCaptures.length > 0;
      const finalPlayers = clonePlayers(movedPlayers);
      finalCaptures.forEach(({ playerIndex, pieceIndex }) => {
        if (finalPlayers[playerIndex]?.pieces?.[pieceIndex]) {
          finalPlayers[playerIndex].pieces[pieceIndex] = applyPieceLifecycle(
            { ...finalPlayers[playerIndex].pieces[pieceIndex] },
            0,
            maxSteps,
          );
        }
      });
      setPlayers(finalPlayers);
      playersRef.current = finalPlayers;
      if (didCaptureOnMoveOut) playSound('capture');
      if (onlineMode && gameIdRef.current) {
        if (myPlayerIndexRef.current !== 0) pendingOwnMoveRef.current = true;
        emit('ludo:move', {
          gameId: gameIdRef.current,
          by: myProfile?._id,
          playerIndex: movingPlayerIndex,
          pieceIndex: pieceId,
          toSteps: 1,
          fromSteps: 0,
          rolled: 6,
          captures: finalCaptures,
        });
      }
      animateTokenMovement(movingPlayerIndex, pieceId, 1, 0, () => {
        const keepTurn = rolledDiceValue === 6 || didCaptureOnMoveOut;
        finishTurn(movingPlayerIndex, keepTurn, didCaptureOnMoveOut);
      });
      return;
    }

    if (pieceSteps > 0) {
      const movingPlayerIndex = actingPlayerIndex;
      const oldSteps = pieceSteps;
      const oldPosition = getPositionOnPath(movingPlayerIndex, oldSteps, playerCount);
      const newSteps = pieceSteps + effectiveDiceValue;
      if (newSteps > maxSteps) {
        abortMove({ skipTurnIfNoMoves: true });
        return;
      }
      const movedPlayers = clonePlayers(playersRef.current);
      movedPlayers[movingPlayerIndex].pieces[pieceId] = applyPieceLifecycle(
        { ...movedPlayers[movingPlayerIndex].pieces[pieceId] },
        newSteps,
        maxSteps,
      );
      playersRef.current = movedPlayers;
      let finalCaptures: { playerIndex: number; pieceIndex: number }[] = [];
      if (newSteps < maxSteps) {
        const newPosition = getPositionOnPath(movingPlayerIndex, newSteps, playerCount);
        const capturedPieces = checkForCapture(
          movingPlayerIndex,
          newPosition,
          newSteps,
          movedPlayers,
          maxSteps,
          playerCount,
        );
        if (Array.isArray(capturedPieces)) finalCaptures.push(...capturedPieces);
        if (oldSteps > 0 && oldSteps < maxSteps) {
          const capturedAfterMoveAway = checkForCaptureAfterMoveAway(
            movingPlayerIndex,
            oldPosition,
            movedPlayers,
            maxSteps,
            playerCount,
          );
          if (Array.isArray(capturedAfterMoveAway)) finalCaptures.push(...capturedAfterMoveAway);
        }
      }
      const deduped = new Map<string, { playerIndex: number; pieceIndex: number }>();
      finalCaptures.forEach((c) => deduped.set(`${c.playerIndex}-${c.pieceIndex}`, c));
      finalCaptures = Array.from(deduped.values());
      const didCapture = finalCaptures.length > 0;
      const finalPlayers = clonePlayers(movedPlayers);
      finalCaptures.forEach(({ playerIndex, pieceIndex }) => {
        if (finalPlayers[playerIndex]?.pieces?.[pieceIndex]) {
          finalPlayers[playerIndex].pieces[pieceIndex] = applyPieceLifecycle(
            { ...finalPlayers[playerIndex].pieces[pieceIndex] },
            0,
            maxSteps,
          );
        }
      });
      setPlayers(finalPlayers);
      playersRef.current = finalPlayers;
      if (didCapture) playSound('capture');
      if (onlineMode && gameIdRef.current) {
        if (myPlayerIndexRef.current !== 0) pendingOwnMoveRef.current = true;
        emit('ludo:move', {
          gameId: gameIdRef.current,
          by: myProfile?._id,
          playerIndex: movingPlayerIndex,
          pieceIndex: pieceId,
          toSteps: newSteps,
          fromSteps: oldSteps,
          rolled: rolledDiceValue,
          captures: finalCaptures,
        });
      }
      animateTokenMovement(movingPlayerIndex, pieceId, newSteps, oldSteps, () => {
        if (newSteps === maxSteps) {
          setPlayers((prev) => {
            const updatedPlayers = clonePlayers(prev);
            resolveWinnerStateForPlayer(updatedPlayers, movingPlayerIndex);
            playersRef.current = updatedPlayers;
            return updatedPlayers;
          });
        }
        const keepTurn = rolledDiceValue === 6 || didCapture;
        finishTurn(movingPlayerIndex, keepTurn, didCapture);
      });
    }
  };

  const rollDice = (controlledValue: number | null = null) => {
    if (waitingForPlayers || !connectionReadyRef.current) return;
    if (gamePausedRef.current) return;
    // Let everyone see the previous roll before the next one starts. Bots
    // retry through scheduleBotTurn; the dice button stays disabled meanwhile.
    if (onlineMode && Date.now() < diceHoldUntilRef.current) return;
    const isBotTurn = !onlineMode && playersRef.current[currentPlayerRef.current]?.isBot;
    const isBotActingForCurrentPlayer = Boolean(
      botActingRef.current &&
      botActingPlayerIndexRef.current === currentPlayerRef.current &&
      isBotPlayerIndex(currentPlayerRef.current),
    );
    if (!isBotActingForCurrentPlayer && isBotTurn) return;
    if (!isBotActingForCurrentPlayer && (!canRollDice || isRollingRef.current)) return;
    if (isMovingRef.current || isAutoMovingRef.current) return;

    if (onlineMode || playWithComputerRef.current || isBotPlayerIndex(currentPlayerRef.current)) {
      const currentSeatIsBot = isBotPlayerIndex(currentPlayerRef.current);
      if (currentSeatIsBot && !isBotActingForCurrentPlayer) return;
      if (!isBotActingForCurrentPlayer && myPlayerIndexRef.current !== currentPlayerRef.current) return;
      if (diceValueRef.current > 0) return;
    }

    const timeSinceLastRoll = Date.now() - lastRollTimeRef.current;
    const isCpuRoll = isBotActingForCurrentPlayer || (playWithComputerRef.current && !onlineMode && playersRef.current[currentPlayerRef.current]?.isBot);
    if (!isCpuRoll && timeSinceLastRoll < 1000) return;
    if (diceValueRef.current > 0 || diceValue > 0) return;

    isRollingRef.current = true;
    setCanRollDice(false);
    lastRollTimeRef.current = Date.now();
    if (!gameStarted) {
      setGameStarted(true);
      gameStartedRef.current = true;
    }
    playSound('diceRoll');
    const value =
      Number.isInteger(controlledValue) && (controlledValue as number) >= 1 && (controlledValue as number) <= 6
        ? (controlledValue as number)
        : Math.floor(Math.random() * 6) + 1;
    const currentRollPlayer = currentPlayerRef.current;
    const animationDuration = onlineMode ? 700 : DICE_ROLL_ANIMATION_MS;
    setDiceSpin(value);
    diceRotate.setValue(0);
    Animated.timing(diceRotate, {
      toValue: 1,
      duration: animationDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      // The turn can move on while the dice animates (e.g. a snapshot or the
      // end of the previous move). A roll for a seat that is no longer playing
      // would be rejected by the server and leave this board holding a dice
      // for someone else, so drop it.
      if (currentPlayerRef.current !== currentRollPlayer || gameEndedRef.current) {
        isRollingRef.current = false;
        return;
      }
      showRolledValue(value, currentRollPlayer);
      const currentSixCount = consecutiveSixesRef.current[currentRollPlayer] || 0;
      if (value === 6) {
        const newSixCount = currentSixCount + 1;
        setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: newSixCount }));
        consecutiveSixesRef.current[currentRollPlayer] = newSixCount;
        if (newSixCount >= 3) {
          setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: 0 }));
          consecutiveSixesRef.current[currentRollPlayer] = 0;
          setDiceValueImmediate(value);
          diceResultVisibleUntilRef.current = Date.now() + DICE_RESULT_DISPLAY_MS;
          isRollingRef.current = false;
          playSound('threeSixes');
          if (onlineMode && gameIdRef.current) {
            emit('ludo:roll', {
              gameId: gameIdRef.current,
              value,
              by: myProfile?._id,
              currentPlayer: currentPlayerRef.current,
              reachedSixLimit: true,
            });
          }
          setTimeout(() => {
            advanceTurnForPlayer(currentRollPlayer, 'three_consecutive_sixes');
          }, DICE_RESULT_DISPLAY_MS);
          return;
        }
      } else if (currentSixCount > 0) {
        setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: 0 }));
        consecutiveSixesRef.current[currentRollPlayer] = 0;
      }

      setDiceValueImmediate(value);
      diceResultVisibleUntilRef.current = Date.now() + DICE_RESULT_DISPLAY_MS;
      lastLocalDiceRollTimeRef.current = Date.now();
      isRollingRef.current = false;
      if (value === 6) playSound('rolledSix');
      if (onlineMode && gameIdRef.current) {
        emit('ludo:roll', {
          gameId: gameIdRef.current,
          value,
          by: myProfile?._id,
          currentPlayer: currentPlayerRef.current,
        });
      }
      if (onlineMode && myPlayerIndexRef.current === 0 && gameIdRef.current) {
        persistAndBroadcastGameState('dice_roll');
      }
      const playablePieces = getPlayablePieces(currentPlayerRef.current, value);
      if (playablePieces.length === 0) {
        setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: 0 }));
        consecutiveSixesRef.current[currentRollPlayer] = 0;
        setTimeout(
          () => advanceTurnForPlayer(currentRollPlayer, 'turn_advance_no_playable_move'),
          DICE_RESULT_DISPLAY_MS,
        );
      } else if (playablePieces.length === 1) {
        const isCpuTurnNow =
          playWithComputerRef.current &&
          !onlineMode &&
          playersRef.current[currentPlayerRef.current]?.isBot;
        if (isCpuTurnNow) return;
        isAutoMovingRef.current = true;
        setCanRollDice(false);
        setTimeout(() => {
          if (diceValueRef.current === value && currentPlayerRef.current === currentRollPlayer) {
            movePiece(playablePieces[0]);
          } else {
            isAutoMovingRef.current = false;
            if (!onlineMode) setCanRollDice(true);
          }
        }, DICE_RESULT_DISPLAY_MS);
      }
    }, animationDuration);
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 450, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const canControlBots = onlineMode
      ? myPlayerIndexRef.current === 0 && Boolean(gameId)
      : playWithComputer || playersRef.current.some((player) => player?.isBot);
    if (!canControlBots || !gameStarted || gameEnded || gamePaused || waitingForPlayers || !connectionReady) return;
    const cp = currentPlayerRef.current;
    const player = playersRef.current[cp];
    if (!player?.isBot) {
      botActingRef.current = false;
      botActingPlayerIndexRef.current = null;
      return;
    }
    if (botTurnTimerRef.current) clearTimeout(botTurnTimerRef.current);
    const scheduleBotTurn = (delay = 900) => {
      botTurnTimerRef.current = setTimeout(() => {
        botTurnTimerRef.current = null;
        const playerIndex = currentPlayerRef.current;
        if (
          !gameStartedRef.current ||
          gameEndedRef.current ||
          gamePausedRef.current ||
          !playersRef.current[playerIndex]?.isBot
        ) return;
        if (isMovingRef.current || isAutoMovingRef.current || isRollingRef.current) {
          scheduleBotTurn(250);
          return;
        }
        botActingRef.current = true;
        botActingPlayerIndexRef.current = playerIndex;
        try {
          if (diceValueRef.current === 0) {
            rollDice();
            if (!isRollingRef.current && diceValueRef.current === 0) scheduleBotTurn(250);
            return;
          }
          const playable = getPlayablePieces(playerIndex, diceValueRef.current);
          if (playable.length === 0) {
            advanceTurnForPlayer(playerIndex);
            return;
          }
          const pick =
            playable.length === 1
              ? playable[0]
              : pickSmartBotPiece(
                  playable,
                  playerIndex,
                  playersRef.current,
                  diceValueRef.current,
                  maxStepsRef.current || maxSteps,
                  selectedPlayerCountRef.current,
                );
          movePiece(pick);
          if (!isMovingRef.current && diceValueRef.current > 0) scheduleBotTurn(250);
        } finally {
          setTimeout(() => {
            if (botActingPlayerIndexRef.current === playerIndex) {
              botActingRef.current = false;
              botActingPlayerIndexRef.current = null;
            }
          }, 2000);
        }
      }, delay);
    };
    scheduleBotTurn();
    return () => {
      if (botTurnTimerRef.current) {
        clearTimeout(botTurnTimerRef.current);
        botTurnTimerRef.current = null;
      }
    };
  }, [
    playWithComputer,
    players,
    onlineMode,
    gameId,
    myPlayerIndex,
    gameStarted,
    gameEnded,
    waitingForPlayers,
    currentPlayer,
    diceValue,
    canRollDice,
    maxSteps,
    connectionReady,
    gamePaused,
  ]);

  useEffect(() => {
    if (!gameStarted || gameEnded || waitingForPlayers) return;
    const botTurn = playersRef.current[currentPlayer]?.isBot;
    if (
      !botTurn &&
      diceValue === 0 &&
      !isRollingRef.current &&
      !isMovingRef.current &&
      !isAutoMovingRef.current &&
      isMyTurn
    ) {
      setCanRollDice(true);
    }
  }, [gameStarted, gameEnded, waitingForPlayers, diceValue, currentPlayer, isMyTurn]);

  const applyRemoteSnapshot = useCallback((payload: GameSnapshot) => {
    if (!payload || String(payload.gameId) !== String(gameIdRef.current)) return;
    const pausedFlag = (payload as any).paused;
    if (typeof pausedFlag === 'boolean') {
      const incomingPause: PauseInfo | null = pausedFlag
        ? {
            profileId: (payload as any).pausedBy?.profileId,
            name: (payload as any).pausedBy?.name,
            at: (payload as any).pausedAt,
          }
        : null;
      if (
        Boolean(incomingPause) !== Boolean(gamePausedRef.current) ||
        (incomingPause && gamePausedRef.current?.pending)
      ) {
        applyPauseState(incomingPause);
        if (!incomingPause) setResumeDenied(false);
      }
    }
    const snapshotVersion = Math.max(
      Number(payload.playersSeq || 0),
      Number(payload.stateVersion || 0),
    );
    const isHost = myPlayerIndexRef.current === 0;
    if (!isHost && pendingOwnMoveRef.current) {
      // The host may have sent its dice snapshot just before our move reached
      // it. Applying it would restore the used dice value and allow a second move.
      const isPreMoveDiceSnapshot =
        payload.currentPlayer === myPlayerIndexRef.current &&
        Number(payload.diceValue || 0) > 0 &&
        String(payload.lastActionType || '') === 'dice_roll';
      if (isPreMoveDiceSnapshot) return;
      pendingOwnMoveRef.current = false;
    }
    const isStaleOrOwn = snapshotVersion > 0 && snapshotVersion <= latestSnapshotVersionRef.current;
    if (isStaleOrOwn || (isHost && gameStartedRef.current)) {
      // The host is the authority for turn, dice and match start. What it
      // receives is its own echo or a server re-broadcast of an older snapshot
      // with a seat change; applying either would roll the host back. Only
      // take the seat details (buffered accepts, online/offline flags).
      if (isHost && Array.isArray(payload.players)) {
        let changed = false;
        const merged = playersRef.current.map((seat, index) => {
          const incoming = payload.players[index];
          if (!seat || !incoming) return seat;
          const next = { ...seat, isOffline: incoming.isOffline, offlineSince: incoming.offlineSince };
          if (
            index > 0 &&
            isHumanLudoProfileId(incoming.profileId) &&
            String(incoming.profileId) !== String(seat.profileId || '')
          ) {
            Object.assign(next, {
              profileId: incoming.profileId,
              name: incoming.name || seat.name,
              avatar: incoming.avatar || seat.avatar,
              cover: incoming.cover || seat.cover,
              isBot: false,
              isActive: true,
            });
          }
          if (
            next.profileId !== seat.profileId ||
            Boolean(next.isOffline) !== Boolean(seat.isOffline)
          ) {
            changed = true;
          }
          return next;
        });
        if (changed) {
          playersRef.current = merged;
          setPlayers(merged);
        }
      }
      return;
    }
    if (snapshotVersion > 0) {
      latestSnapshotVersionRef.current = snapshotVersion;
    }
    if (Array.isArray(payload.players)) {
      playersRef.current = payload.players;
      setPlayers(payload.players);
      // The server may seat a guest somewhere other than the invited slot.
      if (!isHost && myProfile?._id) {
        const mySeat = payload.players.findIndex(
          (seat) => String(seat?.profileId || '') === String(myProfile._id),
        );
        if (mySeat > 0 && mySeat !== myPlayerIndexRef.current) {
          myPlayerIndexRef.current = mySeat;
          setMyPlayerIndex(mySeat);
        }
      }
    }
    if (typeof payload.currentPlayer === 'number') {
      setCurrentPlayerImmediate(payload.currentPlayer);
    }
    if (typeof payload.diceValue === 'number') {
      setDiceValueImmediate(payload.diceValue);
    }
    if (typeof payload.gameStarted === 'boolean') {
      setGameStarted(payload.gameStarted);
      gameStartedRef.current = payload.gameStarted;
    }
    if (typeof payload.gameEnded === 'boolean') {
      setGameEnded(payload.gameEnded);
      gameEndedRef.current = payload.gameEnded;
    }
    if (Array.isArray(payload.winners)) {
      // A new winner announced by the host: celebrate on this screen too.
      if (payload.winners.length > (winnersRef.current?.length || 0)) {
        playSound('win');
        setWinner(payload.winners[payload.winners.length - 1]);
        setShowWinnerModal(true);
      }
      setWinners(payload.winners);
      winnersRef.current = payload.winners;
    }
    if (typeof payload.selectedPlayerCount === 'number') {
      setSelectedPlayerCount(payload.selectedPlayerCount);
    }
    isRollingRef.current = false;
    isMovingRef.current = false;
    isAutoMovingRef.current = false;
    setCanRollDice(
      Boolean(
        payload.gameStarted &&
        !payload.gameEnded &&
        payload.diceValue === 0 &&
        payload.currentPlayer === myPlayerIndexRef.current,
      ),
    );
    if (typeof payload.gameStarted === 'boolean') {
      setWaitingForPlayers(!payload.gameStarted && !payload.gameEnded);
    }
  }, [myProfile?._id, setCurrentPlayerImmediate, setDiceValueImmediate, playSound, applyPauseState]);

  useEffect(() => {
    const onPlayers = (payload: GameSnapshot) => applyRemoteSnapshot(payload);
    const onPaused = (payload: any) => {
      if (String(payload?.gameId || '') !== String(gameIdRef.current)) return;
      const wasPaused = Boolean(gamePausedRef.current) && !gamePausedRef.current?.pending;
      applyPauseState({
        profileId: payload?.pausedBy?.profileId,
        name: payload?.pausedBy?.name,
        at: payload?.pausedAt,
      });
      if (!wasPaused) playSound('turnChange');
    };
    const onResumed = (payload: any) => {
      if (String(payload?.gameId || '') !== String(gameIdRef.current)) return;
      if (!gamePausedRef.current) return;
      applyPauseState(null);
      setResumeDenied(false);
      playSound('pieceOut');
    };
    const onResumeDenied = (payload: any) => {
      if (String(payload?.gameId || '') !== String(gameIdRef.current)) return;
      setResumeDenied(true);
    };
    const onGames = (data: any) => {
      const list: SavedOnlineGame[] = (Array.isArray(data?.games) ? data.games : []).filter(
        (game: SavedOnlineGame) =>
          game?.gameId &&
          !game.lastPlayers?.gameEnded &&
          !game.lastPlayers?.winner &&
          Boolean(game.lastPlayers?.gameStarted),
      );
      setOnlineSavedGames(list);
    };
    const onAccepted = (payload: any) => {
      if (String(payload?.gameId || '') !== String(gameIdRef.current)) return;
      const connect = payload?.connect;
      const slotIndex = Number(payload?.slotIndex);
      if (!connect?._id || !Number.isInteger(slotIndex) || slotIndex < 1) return;
      if (String(connect._id) === String(myProfile?._id || '') && myPlayerIndexRef.current !== 0) {
        myPlayerIndexRef.current = slotIndex;
        setMyPlayerIndex(slotIndex);
      }
      setPlayers((prev) => {
        const copy = clonePlayers(prev);
        if (!copy[slotIndex]) return prev;
        copy[slotIndex] = {
          ...copy[slotIndex],
          name: connect.fullName || copy[slotIndex].name,
          avatar: connect.profilePic || copy[slotIndex].avatar,
          cover: connect.coverPic || connect.cover || copy[slotIndex].cover,
          profileId: String(connect._id),
          isActive: true,
          isOffline: false,
        };
        playersRef.current = copy;
        return copy;
      });
      emit('ludo:players:get', { gameId: gameIdRef.current });
    };
    const onGameRemoved = (payload: any) => {
      if (String(payload?.gameId || '') !== String(gameIdRef.current)) return;
      setWaitingForPlayers(false);
      setGameId(null);
      gameIdRef.current = null;
      setOnlineMode(false);
      setLudoGameActive(false);
    };
    const onInvite = (payload: LudoInvite) => {
      if (!payload?.gameId) return;
      if (String(payload.to || '') !== String(myProfile?._id || '')) return;
      setIncomingInviteRequest({
        ...payload,
        from: payload.from || payload.by,
      });
    };
    const onRoll = (payload: any) => {
      if (!onlineModeRef.current || String(payload?.gameId) !== String(gameIdRef.current)) return;
      if (String(payload?.by) === String(myProfile?._id)) return;
      const value = Number(payload?.value);
      if (!Number.isInteger(value) || value < 1 || value > 6) return;
      const rollingPlayer =
        typeof payload?.currentPlayer === 'number' ? payload.currentPlayer : currentPlayerRef.current;
      setCurrentPlayerImmediate(rollingPlayer);
      showRolledValue(value, rollingPlayer);
      setDiceValueImmediate(value);
      setDiceSpin(value);
      diceResultVisibleUntilRef.current = Date.now() + DICE_RESULT_DISPLAY_MS;
      isRollingRef.current = false;
      // Everyone hears (and sees) the other players' rolls too.
      if (payload?.reachedSixLimit) playSound('threeSixes');
      else if (value === 6) playSound('rolledSix');
      else playAudio('diceRoll');

      // Only the host publishes the resulting turn state; everyone else waits
      // for its ludo:players snapshot.
      if (myPlayerIndexRef.current !== 0) return;
      const sixCount = consecutiveSixesRef.current[rollingPlayer] || 0;
      const nextSixCount = value === 6 ? sixCount + 1 : 0;
      consecutiveSixesRef.current = { ...consecutiveSixesRef.current, [rollingPlayer]: nextSixCount };
      if (payload?.reachedSixLimit || nextSixCount >= 3) {
        consecutiveSixesRef.current = { ...consecutiveSixesRef.current, [rollingPlayer]: 0 };
        setConsecutiveSixes(consecutiveSixesRef.current);
        setTimeout(() => advanceTurnForPlayer(rollingPlayer, 'three_consecutive_sixes'), DICE_RESULT_DISPLAY_MS);
        return;
      }
      setConsecutiveSixes(consecutiveSixesRef.current);
      if (getPlayablePieces(rollingPlayer, value).length === 0) {
        setTimeout(() => {
          if (currentPlayerRef.current === rollingPlayer && diceValueRef.current === value) {
            advanceTurnForPlayer(rollingPlayer, 'turn_advance_no_playable_move');
          }
        }, DICE_RESULT_DISPLAY_MS);
        return;
      }
      persistAndBroadcastGameState('dice_roll');
    };
    const onMove = (payload: any) => {
      if (!onlineModeRef.current || String(payload?.gameId) !== String(gameIdRef.current)) return;
      if (String(payload?.by) === String(myProfile?._id)) return;
      if (typeof payload?.toSteps !== 'number') return;
      const pIdx = Number(payload.playerIndex);
      const pcIdx = Number(payload.pieceIndex);
      const captures: { playerIndex: number; pieceIndex: number }[] = Array.isArray(payload.captures)
        ? payload.captures
        : [];
      const copy = clonePlayers(playersRef.current);
      if (copy[pIdx]?.pieces?.[pcIdx]) {
        copy[pIdx].pieces[pcIdx] = applyPieceLifecycle(
          { ...copy[pIdx].pieces[pcIdx] },
          payload.toSteps,
          maxStepsRef.current,
        );
      }
      captures.forEach((c) => {
        if (copy[c.playerIndex]?.pieces?.[c.pieceIndex]) {
          copy[c.playerIndex].pieces[c.pieceIndex] = applyPieceLifecycle(
            { ...copy[c.playerIndex].pieces[c.pieceIndex] },
            0,
            maxStepsRef.current,
          );
        }
      });
      playersRef.current = copy;
      setPlayers(copy);
      // Show the other player's token hopping along instead of teleporting.
      const fromSteps = Number(payload.fromSteps);
      if (Number.isFinite(fromSteps) && payload.toSteps > fromSteps) {
        if (fromSteps <= 0) playSound('pieceOut');
        animateTokenMovementRef.current?.(pIdx, pcIdx, payload.toSteps, Math.max(0, fromSteps), () => {});
      }
      if (captures.length > 0) playSound('capture');

      if (myPlayerIndexRef.current !== 0) return;
      const { didFinish } = resolveWinnerStateForPlayer(copy, pIdx);
      const keepTurn = !didFinish && (Number(payload.rolled) === 6 || captures.length > 0);
      setDiceValueImmediate(0);
      lastLocalDiceRollTimeRef.current = 0;
      if (keepTurn) {
        persistAndBroadcastGameState('keep_turn_after_remote_move');
        return;
      }
      setTimeout(() => {
        advanceTurnForPlayer(pIdx, 'turn_advance_after_remote_move');
      }, TURN_TRANSITION_DELAY_MS);
    };
    // Host only: keep the match moving when a player drops out. A player who
    // left is replaced by a computer; an offline player's turns are skipped
    // until they reconnect.
    const isActiveHostedGame = (payload: any) =>
      onlineModeRef.current &&
      myPlayerIndexRef.current === 0 &&
      String(payload?.gameId || '') === String(gameIdRef.current || '') &&
      gameStartedRef.current &&
      !gameEndedRef.current;
    const findSeat = (profileId: unknown) =>
      playersRef.current.findIndex(
        (seat, index) => index > 0 && String(seat?.profileId || '') === String(profileId || ''),
      );
    const onPlayerLeft = (payload: any) => {
      if (!isActiveHostedGame(payload) || !payload?.profileId) return;
      const seatIndex = findSeat(payload.profileId);
      if (seatIndex <= 0) return;
      const copy = clonePlayers(playersRef.current);
      copy[seatIndex] = {
        ...copy[seatIndex],
        name: `Computer ${seatIndex}`,
        avatar: undefined,
        cover: undefined,
        profileId: `bot-${seatIndex}`,
        isBot: true,
        isActive: true,
        isOffline: false,
        offlineSince: undefined,
      };
      playersRef.current = copy;
      setPlayers(copy);
      persistAndBroadcastGameState('player_left_replaced_by_bot');
    };
    const setSeatOffline = (payload: any, offline: boolean) => {
      if (
        !onlineModeRef.current ||
        !payload?.profileId ||
        String(payload?.gameId || '') !== String(gameIdRef.current || '') ||
        String(payload.profileId) === String(myProfile?._id || '')
      ) {
        return;
      }
      // Everyone shows who is reconnecting (including the host, seat 0).
      const seatIndex = playersRef.current.findIndex(
        (seat) => String(seat?.profileId || '') === String(payload.profileId),
      );
      if (seatIndex < 0 || Boolean(playersRef.current[seatIndex]?.isOffline) === offline) return;
      const copy = clonePlayers(playersRef.current);
      copy[seatIndex] = {
        ...copy[seatIndex],
        isOffline: offline,
        offlineSince: offline ? Date.now() : undefined,
      };
      playersRef.current = copy;
      setPlayers(copy);
      // Only the host moves the game on.
      if (!isActiveHostedGame(payload) || seatIndex === 0) return;
      if (offline && currentPlayerRef.current === seatIndex) {
        advanceTurnForPlayer(seatIndex, 'turn_advance_player_offline');
        return;
      }
      persistAndBroadcastGameState(offline ? 'player_offline' : 'player_online');
    };
    const onPlayerOffline = (payload: any) => setSeatOffline(payload, true);
    const onPlayerOnline = (payload: any) => setSeatOffline(payload, false);
    const onInvites = (data: any) => {
      const list: LudoInvite[] = (data?.invites || []).filter(
        (invite: LudoInvite) => String(invite?.gameId || '') !== String(gameIdRef.current || ''),
      );
      setIncomingInviteRequest(list[0] || null);
    };
    on('ludo:players', onPlayers);
    on('ludo:accepted', onAccepted);
    on('ludo:game:removed', onGameRemoved);
    on('ludo:invite', onInvite);
    on('ludo:invites', onInvites);
    on('ludo:roll', onRoll);
    on('ludo:move', onMove);
    on('ludo:player:left', onPlayerLeft);
    on('ludo:player:offline', onPlayerOffline);
    on('ludo:player:online', onPlayerOnline);
    on('ludo:paused', onPaused);
    on('ludo:resumed', onResumed);
    on('ludo:resume:denied', onResumeDenied);
    on('ludo:games', onGames);
    return () => {
      off('ludo:paused', onPaused);
      off('ludo:resumed', onResumed);
      off('ludo:resume:denied', onResumeDenied);
      off('ludo:games', onGames);
      off('ludo:player:left', onPlayerLeft);
      off('ludo:player:offline', onPlayerOffline);
      off('ludo:player:online', onPlayerOnline);
      off('ludo:players', onPlayers);
      off('ludo:accepted', onAccepted);
      off('ludo:game:removed', onGameRemoved);
      off('ludo:invite', onInvite);
      off('ludo:invites', onInvites);
      off('ludo:roll', onRoll);
      off('ludo:move', onMove);
    };
  }, [
    on,
    off,
    emit,
    applyRemoteSnapshot,
    myProfile?._id,
    setDiceValueImmediate,
    setCurrentPlayerImmediate,
    setLudoGameActive,
    advanceTurnForPlayer,
    getPlayablePieces,
    persistAndBroadcastGameState,
    resolveWinnerStateForPlayer,
    playSound,
    playAudio,
  ]);

  useEffect(() => {
    if (!isConnected || !onlineMode || !gameId) return;
    emit('ludo:join', { gameId });
    emit('ludo:players:get', { gameId });
    // After a reconnect the host republishes its authoritative board so any
    // update the others missed while it was away reaches them.
    if (myPlayerIndexRef.current !== 0 || !gameStartedRef.current) return;
    const timer = setTimeout(() => persistAndBroadcastGameState('host_resync'), 300);
    return () => clearTimeout(timer);
  }, [isConnected, onlineMode, gameId, emit, persistAndBroadcastGameState]);

  // Host: start the online match as soon as every seat has a player or bot.
  useEffect(() => {
    if (
      !onlineMode ||
      !gameId ||
      myPlayerIndex !== 0 ||
      !waitingForPlayers ||
      gameStarted ||
      gameEnded
    ) {
      return;
    }
    if (countOccupiedLobbySeats(players, selectedPlayerCount) < selectedPlayerCount) return;
    const timer = setTimeout(() => {
      gameStartedRef.current = true;
      currentPlayerRef.current = 0;
      diceValueRef.current = 0;
      setGameStarted(true);
      setCurrentPlayer(0);
      setDiceValue(0);
      setWaitingForPlayers(false);
      setCanRollDice(true);
      persistAndBroadcastGameState('game_auto_start_after_accept');
    }, 150);
    return () => clearTimeout(timer);
  }, [
    onlineMode,
    gameId,
    myPlayerIndex,
    waitingForPlayers,
    gameStarted,
    gameEnded,
    players,
    selectedPlayerCount,
    persistAndBroadcastGameState,
  ]);

  const getNextOpenSlot = useCallback(() => {
    const max = Math.max(2, Math.min(4, selectedPlayerCount));
    for (let i = 1; i < max; i++) {
      const p = players[i];
      if (!p) return i;
      if (!p.profileId && !p.isBot) return i;
    }
    return null;
  }, [players, selectedPlayerCount]);

  const assignConnectOffline = (connect: ConnectUser) => {
    const slot = getNextOpenSlot();
    if (slot == null) return;
    setPlayers((prev) => {
      const copy = clonePlayers(prev);
      if (!copy[slot]) return prev;
      copy[slot].name = connect.fullName || copy[slot].name;
      copy[slot].avatar = connect.profilePic;
      copy[slot].cover = connect.coverPic || connect.cover;
      copy[slot].profileId = connect._id;
      copy[slot].isBot = false;
      playersRef.current = copy;
      return copy;
    });
    setSelectedConnects((prev) => (prev.some((p) => p._id === connect._id) ? prev : [...prev, connect]));
  };

  const closePlayerEditor = () => {
    setShowPlayerEditor(false);
    setEditingPlayerIndex(null);
    setEditName('');
    setEditAvatarUrl('');
  };

  const openPlayerEditor = (playerIndex: number) => {
    if (playerIndex == null || playerIndex < 0 || playerIndex >= players.length) return;
    if (showPlayerSelection) setShowPlayerSelection(false);
    setEditingPlayerIndex(playerIndex);
    setEditName(players[playerIndex]?.name || '');
    setEditAvatarUrl(players[playerIndex]?.avatar || '');
    setShowPlayerEditor(true);
    playSound('buttonClick');
  };

  const assignConnectToSlot = (connect: ConnectUser, slotIndex: number) => {
    if (!connect?._id || typeof slotIndex !== 'number' || slotIndex < 0) return;
    setPlayers((prev) => {
      const copy = clonePlayers(prev);
      if (!copy[slotIndex]) return prev;
      copy[slotIndex].name = connect.fullName || copy[slotIndex].name;
      copy[slotIndex].avatar = connect.profilePic || copy[slotIndex].avatar;
      copy[slotIndex].cover = connect.coverPic || connect.cover || copy[slotIndex].cover;
      copy[slotIndex].profileId = connect._id;
      copy[slotIndex].isBot = false;
      copy[slotIndex].isActive = true;
      copy[slotIndex].isOffline = false;
      playersRef.current = copy;
      return copy;
    });
    setSelectedConnects((prev) => {
      const already = prev.some((p) => String(p?._id) === String(connect._id));
      if (already) return prev;
      return [...prev, connect].slice(0, Math.max(0, selectedPlayerCount - 1));
    });
  };

  const replacePlayerWithBot = (playerIndex: number | null) => {
    const seatIndex = Number(playerIndex);
    const hadActiveGameId = Boolean(gameIdRef.current || gameId);
    const activeGameId =
      gameIdRef.current ||
      gameId ||
      (onlineMode ? newGameDraftIdRef.current || generateGameId() : null);
    if (
      myPlayerIndexRef.current !== 0 ||
      !Number.isInteger(seatIndex) ||
      seatIndex <= 0 ||
      seatIndex >= selectedPlayerCountRef.current ||
      isRollingRef.current ||
      isMovingRef.current ||
      isAutoMovingRef.current ||
      (onlineMode && !activeGameId)
    ) {
      return;
    }
    if (onlineMode && !hadActiveGameId && activeGameId) {
      newGameDraftIdRef.current = activeGameId;
      gameIdRef.current = activeGameId;
      setGameId(activeGameId);
    }
    const sourcePlayers = playersRef.current;
    const replacedPlayer = sourcePlayers[seatIndex];
    if (!replacedPlayer || replacedPlayer.isBot) return;
    const replacedProfileId = replacedPlayer.profileId ? String(replacedPlayer.profileId) : null;
    const nextPlayers = sourcePlayers.map((player, index) =>
      index === seatIndex
        ? {
            ...player,
            name: `Computer ${seatIndex}`,
            avatar: undefined,
            cover: undefined,
            profileId: `bot-${seatIndex}`,
            isBot: true,
            isActive: true,
            isOffline: false,
            pieces: Array.isArray(player.pieces) ? player.pieces.map((piece) => ({ ...piece })) : [],
          }
        : player,
    );
    playersRef.current = nextPlayers;
    setPlayers(nextPlayers);
    if (replacedProfileId) {
      setInvitedStatusByConnectId((prev) => {
        const next = { ...prev };
        delete next[replacedProfileId];
        return next;
      });
      setInvitedSlotByConnectId((prev) => {
        const next = { ...prev };
        delete next[replacedProfileId];
        return next;
      });
      setSelectedConnects((prev) =>
        prev.filter((connect) => String(connect?._id || '') !== replacedProfileId),
      );
    }
    if (onlineMode && hadActiveGameId && activeGameId) {
      emit('ludo:replace:bot', { gameId: activeGameId, playerIndex: seatIndex });
      setTimeout(() => persistAndBroadcastGameState('player_replace_bot'), 0);
    }
    closePlayerEditor();
  };

  const copyInviteLink = async (slotIndex?: number) => {
    try {
      const gid = newGameDraftIdRef.current || gameIdRef.current || generateGameId();
      newGameDraftIdRef.current = gid;
      gameIdRef.current = gid;
      if (gameId !== gid) setGameId(gid);
      const payload = {
        type: 'ludo_invite',
        by: myProfile?._id || 'anon',
        name: myProfile?.fullName || 'Player',
        avatar: myProfile?.profilePic,
        ts: Date.now(),
        gameId: gid,
        playerCount: selectedPlayerCount,
        slotIndex: typeof slotIndex === 'number' ? slotIndex : editingPlayerIndex,
      };
      const token = typeof btoa === 'function'
        ? btoa(JSON.stringify(payload))
        : encodeURIComponent(JSON.stringify(payload));
      const origin = String(config.SOCKET_BASE_URL || '').replace(/\/$/, '');
      const url = `${origin}/?ludoInvite=${encodeURIComponent(token)}`;
      const result = await Share.share({
        message: `${myProfile?.fullName || 'A connect'} invited you to play Ludo on Connect.\n${url}`,
        url,
        title: 'Ludo Invitation',
      });
      if (result.action !== Share.dismissedAction) {
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      }
    } catch {
      setInviteCopied(false);
    }
  };

  const savePlayerEditor = () => {
    if (editingPlayerIndex == null) return;
    setPlayers((prev) => {
      const copy = clonePlayers(prev);
      if (copy[editingPlayerIndex]) {
        if (editName.trim()) copy[editingPlayerIndex].name = editName.trim();
        if (editAvatarUrl.trim()) copy[editingPlayerIndex].avatar = editAvatarUrl.trim();
      }
      playersRef.current = copy;
      return copy;
    });
    if (myPlayerIndexRef.current === 0 && onlineModeRef.current && gameIdRef.current) {
      persistAndBroadcastGameState('player_edit');
    }
    closePlayerEditor();
  };

  const inviteConnect = (connect: ConnectUser) => {
    if (!connect?._id) return;
    setOnlineMode(true);
    const gid = newGameDraftIdRef.current || generateGameId();
    newGameDraftIdRef.current = gid;
    gameIdRef.current = gid;
    if (gameId !== gid) setGameId(gid);
    const slot = getNextOpenSlot();
    if (slot == null) return;
    setPlayers((prev) => {
      const copy = clonePlayers(prev);
      if (!copy[slot]) return prev;
      copy[slot].name = connect.fullName || copy[slot].name;
      copy[slot].avatar = connect.profilePic;
      copy[slot].cover = connect.coverPic || connect.cover;
      copy[slot].isBot = false;
      playersRef.current = copy;
      return copy;
    });
    setInvitedStatusByConnectId((prev) => ({ ...prev, [String(connect._id)]: 'invited' }));
    setInvitedSlotByConnectId((prev) => ({ ...prev, [String(connect._id)]: slot }));
    setSelectedConnects((prev) => (prev.some((p) => p._id === connect._id) ? prev : [...prev, connect]));
    emit('ludo:invite', {
      to: connect._id,
      gameId: gid,
      by: myProfile?._id,
      from: myProfile?._id,
      name: myProfile?.fullName || 'Player',
      avatar: myProfile?.profilePic,
      playerCount: selectedPlayerCount,
      slotIndex: slot,
    });
  };

  const confirmPlayerCount = () => {
    playSound('buttonClick');
    const newOnlineGameId = onlineMode ? newGameDraftIdRef.current || generateGameId() : null;
    if (onlineMode) {
      gameIdRef.current = newOnlineGameId;
      newGameDraftIdRef.current = null;
      setGameId(newOnlineGameId);
    }
    setShowPlayerSelection(false);
    setCurrentPlayer(0);
    setDiceValueImmediate(0);
    setWinner(null);
    const invitedSlots = new Set(
      selectedConnects.map((f, idx) => invitedSlotByConnectId[String(f._id)] ?? idx + 1),
    );
    setPlayers((prev) => {
      const max = Math.max(2, Math.min(4, selectedPlayerCount));
      const next: Player[] = [];
      for (let i = 0; i < max; i++) {
        const prevSeat = prev?.[i];
        const boardSeatIndex = getBoardSeatIndex(i, selectedPlayerCount);
        const pieces = Array.from({ length: 4 }).map((_, j) => ({
          id: j,
          color: COLORS[boardSeatIndex],
          position: { x: 0, y: 0 },
          isHome: true,
          isInPlay: false,
          steps: 0,
        }));
        next.push({
          id: i,
          name: prevSeat?.name || (i === 0 ? myProfile?.fullName || 'You' : PLAYER_NAMES[boardSeatIndex]),
          color: COLORS[boardSeatIndex],
          pieces,
          isActive: i === 0 || Boolean(prevSeat?.isBot),
          avatar: prevSeat?.avatar || (i === 0 ? myProfile?.profilePic : undefined),
          cover: prevSeat?.cover || (i === 0 ? myProfile?.coverPic : undefined),
          profileId: i === 0 ? myProfile?._id || 'local' : onlineMode ? undefined : prevSeat?.profileId,
          isBot: prevSeat?.isBot || false,
        });
      }
      if (playWithComputer && !onlineMode) {
        for (let i = 1; i < next.length; i++) {
          const seat = next[i];
          const hasHumanConnect = isHumanLudoProfileId(seat?.profileId);
          if (!hasHumanConnect) {
            next[i] = { ...seat, name: `Computer ${i}`, isBot: true, profileId: `bot-${i}` };
          }
        }
      }
      if (onlineMode) {
        // Seats nobody was invited to are played by the computer, so the match
        // starts the moment every invited connect accepts.
        for (let i = 1; i < next.length; i++) {
          if (!invitedSlots.has(i) && !next[i].isBot) {
            next[i] = {
              ...next[i],
              name: `Computer ${i}`,
              avatar: undefined,
              cover: undefined,
              isBot: true,
              isActive: true,
              profileId: `bot-${i}`,
            };
          }
        }
      }
      playersRef.current = next;
      return next;
    });
    // Online matches start once every seat is filled (see the auto-start effect).
    const startNow = !(onlineMode && myProfile?._id && newOnlineGameId);
    setGameStarted(startNow);
    gameStartedRef.current = startNow;
    setCanRollDice(startNow);
    if (onlineMode && myProfile?._id && newOnlineGameId) {
      latestSnapshotVersionRef.current = 0;
      setWaitingForPlayers(true);
      emit('ludo:join', { gameId: newOnlineGameId });
      selectedConnects.forEach((f, idx) => {
        const slot = invitedSlotByConnectId[String(f._id)] ?? idx + 1;
        emit('ludo:invite', {
          to: f._id,
          gameId: newOnlineGameId,
          by: myProfile._id,
          from: myProfile._id,
          name: myProfile.fullName,
          avatar: myProfile.profilePic,
          playerCount: selectedPlayerCount,
          slotIndex: slot,
        });
      });
      setTimeout(() => persistAndBroadcastGameState('game_create'), 250);
    }
  };

  useEffect(() => {
    if (pendingLudoInvite?.id && !autoStartLudoInviteRef.current) {
      if (pendingLudoInvite.gameId) {
        const acceptedInvite = pendingLudoInvite;
        const acceptedGameId = acceptedInvite.gameId;
        const acceptedSlot = Number.isInteger(acceptedInvite.slotIndex)
          ? Number(acceptedInvite.slotIndex)
          : 1;

        autoStartLudoInviteRef.current = true;
        setOnlineMode(true);
        setGameId(acceptedGameId);
        gameIdRef.current = acceptedGameId;
        setSelectedPlayerCount(Number(acceptedInvite.playerCount) || 4);
        setMyPlayerIndex(acceptedSlot);
        myPlayerIndexRef.current = acceptedSlot;
        setShowPlayerSelection(false);
        // The host's ludo:players snapshot decides when the match has started.
        setGameStarted(false);
        gameStartedRef.current = false;
        latestSnapshotVersionRef.current = 0;
        setWaitingForPlayers(true);
        consumeLudoInvite();
        emit('ludo:join', { gameId: acceptedGameId });
        emit('ludo:accept', {
          gameId: acceptedGameId,
          slotIndex: acceptedSlot,
          by: myProfile?._id,
          connect: {
            fullName: myProfile?.fullName,
            profilePic: myProfile?.profilePic,
            coverPic: myProfile?.coverPic,
          },
        });
        emit('ludo:players:get', { gameId: acceptedGameId });
        // The flag only drives the host auto-start below; a guest must not
        // carry it into a later lobby of its own.
        autoStartLudoInviteRef.current = false;
        return;
      }

      const connect: ConnectUser = {
        _id: pendingLudoInvite.id,
        fullName: pendingLudoInvite.name,
        profilePic: pendingLudoInvite.profilePic,
        coverPic: pendingLudoInvite.coverPic,
      };
      autoStartLudoInviteRef.current = true;
      consumeLudoInvite();
      inviteConnect(connect);
      return;
    }
    if (autoStartLudoInviteRef.current && selectedConnects.length) {
      autoStartLudoInviteRef.current = false;
      confirmPlayerCount();
    }
  }, [pendingLudoInvite, selectedConnects, consumeLudoInvite, emit, myProfile?._id, myProfile?.fullName, myProfile?.profilePic, myProfile?.coverPic]);

  const resetLocalGameState = useCallback(() => {
    moveTimersRef.current.forEach((timer) => clearTimeout(timer));
    moveTimersRef.current = [];
    if (botTurnTimerRef.current) {
      clearTimeout(botTurnTimerRef.current);
      botTurnTimerRef.current = null;
    }
    isRollingRef.current = false;
    isMovingRef.current = false;
    isAutoMovingRef.current = false;
    setTokenAnimation(null);
    botActingRef.current = false;
    botActingPlayerIndexRef.current = null;
    autoStartLudoInviteRef.current = false;
    latestSnapshotVersionRef.current = 0;
    recentMovesRef.current.clear();
    pendingOwnMoveRef.current = false;
    gameIdRef.current = null;
    newGameDraftIdRef.current = null;
    onlineModeRef.current = false;
    gameStartedRef.current = false;
    gameEndedRef.current = false;
    currentPlayerRef.current = 0;
    myPlayerIndexRef.current = 0;
    diceValueRef.current = 0;
    playersRef.current = [];
    winnersRef.current = [];
    setGameId(null);
    setOnlineMode(false);
    setPlayWithComputer(false);
    setGameStarted(false);
    setGameEnded(false);
    setCurrentPlayer(0);
    setMyPlayerIndex(0);
    setDiceValueImmediate(0);
    setPlayers([]);
    setConsecutiveSixes({});
    setWinner(null);
    setWinners([]);
    setWaitingForPlayers(false);
    setCanRollDice(false);
    setShowWinnerModal(false);
    setSelectedConnects([]);
    setInvitedStatusByConnectId({});
    setInvitedSlotByConnectId({});
    setIncomingInviteRequest(null);
    consumeLudoInvite();
  }, [consumeLudoInvite, setDiceValueImmediate]);

  // ------------------------------------------------------------------
  // Pause & save for later
  // ------------------------------------------------------------------
  const refreshSavedGames = useCallback(() => {
    listLocalSaves(myProfile?._id).then(setLocalSaves).catch(() => null);
    if (myProfile?._id) emit('ludo:games:get', {});
  }, [myProfile?._id, emit]);

  useEffect(() => {
    refreshSavedGames();
  }, [refreshSavedGames, isConnected]);

  // Opening Ludo with saved games shows the menu (resume or start new)
  // instead of going straight to the new-game dialog. Decided once, and only
  // while nothing else (a game, an invite, the user) has taken over.
  const menuDecidedRef = useRef(false);
  const hasSavedGames = localSaves.length > 0 || onlineSavedGames.length > 0;
  useEffect(() => {
    if (menuDecidedRef.current || !hasSavedGames) return;
    menuDecidedRef.current = true;
    if (gameStartedRef.current || waitingForPlayers || pendingLudoInvite?.id || gameIdRef.current) return;
    setShowPlayerSelection(false);
  }, [hasSavedGames, waitingForPlayers, pendingLudoInvite?.id]);

  const buildLocalSave = useCallback(
    (paused: boolean): LocalSave => ({
      id: localSaveIdRef.current as string,
      paused,
      players: JSON.parse(JSON.stringify(playersRef.current || [])),
      currentPlayer: currentPlayerRef.current || 0,
      // A roll that is still animating is not kept; the turn re-rolls.
      diceValue: isRollingRef.current ? 0 : diceValueRef.current || 0,
      selectedPlayerCount: selectedPlayerCountRef.current,
      playWithComputer: Boolean(playWithComputerRef.current),
      consecutiveSixes: { ...(consecutiveSixesRef.current || {}) },
      winners: JSON.parse(JSON.stringify(winnersRef.current || [])),
    }),
    [],
  );

  // Offline games save themselves as they are played, so closing the app
  // mid-game loses nothing; a finished game drops out of the list.
  useEffect(() => {
    if (onlineMode || !gameStarted) return;
    if (gameEnded) {
      if (localSaveIdRef.current) {
        const id = localSaveIdRef.current;
        localSaveIdRef.current = null;
        removeLocalSave(id).then(refreshSavedGames);
      }
      return;
    }
    if (!Array.isArray(players) || players.length === 0) return;
    if (!localSaveIdRef.current) localSaveIdRef.current = createLocalSaveId();
    upsertLocalSave(myProfile?._id, buildLocalSave(Boolean(gamePausedRef.current)));
  }, [onlineMode, gameStarted, gameEnded, players, currentPlayer, diceValue, winners, gamePaused, myProfile?._id, buildLocalSave, refreshSavedGames]);

  const pauseDisabled = isRollingRef.current || isMovingRef.current || isAutoMovingRef.current;

  const pauseGame = () => {
    if (!gameStartedRef.current || gameEndedRef.current || gamePausedRef.current) return;
    playSound('buttonClick');
    const myName = myProfile?.fullName || playersRef.current?.[myPlayerIndexRef.current]?.name;
    if (onlineModeRef.current && gameIdRef.current) {
      applyPauseState({ profileId: myProfile?._id, name: myName, at: Date.now(), pending: true });
      emit('ludo:pause', { gameId: gameIdRef.current, name: myName });
      return;
    }
    applyPauseState({ profileId: myProfile?._id, name: myName, at: Date.now(), local: true });
  };

  const resumeGame = () => {
    playSound('buttonClick');
    if (onlineModeRef.current && gameIdRef.current) {
      setResumeDenied(false);
      emit('ludo:resume', { gameId: gameIdRef.current });
      return;
    }
    applyPauseState(null);
  };

  // Close the board but keep the game: online the seat is kept (and the
  // match stays paused), offline the game stays in this device's saves.
  const saveAndExitGame = () => {
    playSound('buttonClick');
    const gid = gameIdRef.current;
    if (onlineModeRef.current && gid) {
      if (!gamePausedRef.current) emit('ludo:pause', { gameId: gid, name: myProfile?.fullName });
      emit('ludo:board:closed', { gameId: gid });
    } else if (localSaveIdRef.current) {
      upsertLocalSave(myProfile?._id, buildLocalSave(true));
    }
    localSaveIdRef.current = null;
    applyPauseState(null);
    setResumeDenied(false);
    resetLocalGameState();
    initializeGame(selectedPlayerCountRef.current || selectedPlayerCount, []);
    setShowPlayerSelection(false);
    setTimeout(refreshSavedGames, 300);
  };

  const resumeLocalGame = (save: LocalSave) => {
    if (!save?.players?.length) return;
    playSound('buttonClick');
    resetLocalGameState();
    const count = [2, 3, 4].includes(save.selectedPlayerCount) ? save.selectedPlayerCount : save.players.length;
    setSelectedPlayerCount(count);
    selectedPlayerCountRef.current = count;
    setPlayWithComputer(Boolean(save.playWithComputer));
    playWithComputerRef.current = Boolean(save.playWithComputer);
    const restoredPlayers = JSON.parse(JSON.stringify(save.players));
    playersRef.current = restoredPlayers;
    setPlayers(restoredPlayers);
    const turn = Number.isInteger(save.currentPlayer) ? save.currentPlayer : 0;
    setCurrentPlayerImmediate(turn);
    setConsecutiveSixes(save.consecutiveSixes || {});
    consecutiveSixesRef.current = { ...(save.consecutiveSixes || {}) };
    setWinners(save.winners || []);
    winnersRef.current = save.winners || [];
    const dice = Number(save.diceValue) || 0;
    setDiceValueImmediate(dice);
    localSaveIdRef.current = save.id;
    applyPauseState(null);
    setShowPlayerSelection(false);
    setGameStarted(true);
    gameStartedRef.current = true;
    setCanRollDice(dice === 0);
    setLudoGameActive(true);
  };

  const deleteLocalSave = (save: LocalSave) => {
    Alert.alert('Delete saved game?', "It can't be recovered.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (localSaveIdRef.current === save.id) localSaveIdRef.current = null;
          removeLocalSave(save.id).then(refreshSavedGames);
        },
      },
    ]);
  };

  // Rejoin a saved/paused online match. The board comes from the server's
  // snapshot (rebuilt from the database if the match isn't live).
  const resumeOnlineGame = (game: SavedOnlineGame) => {
    if (!game?.gameId || !myProfile?._id) return;
    playSound('buttonClick');
    resetLocalGameState();
    const seats = Array.isArray(game.lastPlayers?.players) ? game.lastPlayers.players : [];
    const mySeat = seats.findIndex((seat: any) => String(seat?.profileId || '') === String(myProfile._id));
    const seatIndex = mySeat >= 0 ? mySeat : 0;
    setOnlineMode(true);
    onlineModeRef.current = true;
    setGameId(game.gameId);
    gameIdRef.current = game.gameId;
    setMyPlayerIndex(seatIndex);
    myPlayerIndexRef.current = seatIndex;
    const count = Number(game.lastPlayers?.selectedPlayerCount) || seats.length || 2;
    setSelectedPlayerCount(count);
    selectedPlayerCountRef.current = count;
    applyPauseState(
      game.paused || game.lastPlayers?.paused
        ? {
            profileId: game.lastPlayers?.pausedBy?.profileId,
            name: game.lastPlayers?.pausedBy?.name,
            at: game.lastPlayers?.pausedAt,
          }
        : null,
    );
    setShowPlayerSelection(false);
    // gameStarted stays false until the snapshot arrives, so it is applied
    // in full (a started host would otherwise keep its own empty board).
    setWaitingForPlayers(true);
    setLudoGameActive(true);
    emit('ludo:join', { gameId: game.gameId });
    emit('ludo:players:get', { gameId: game.gameId });
  };

  const startNewGame = () => {
    localSaveIdRef.current = null;
    applyPauseState(null);
    if (gameIdRef.current) {
      emit('ludo:leave', {
        gameId: gameIdRef.current,
        profileId: myProfile?._id,
        playerIndex: myPlayerIndexRef.current,
      });
    }
    resetLocalGameState();
    initializeGame(selectedPlayerCount, []);
    setShowPlayerSelection(true);
  };

  const exitGame = () => {
    Alert.alert(
      'Leave game?',
      onlineMode
        ? 'Leave this game? Your progress will be removed. To finish it later, use Pause → Save & exit instead.'
        : 'Leave this board? This game will not be saved. To finish it later, use Pause → Save & exit instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            if (gameIdRef.current) {
              emit('ludo:leave', {
                gameId: gameIdRef.current,
                profileId: myProfile?._id,
                playerIndex: myPlayerIndexRef.current,
              });
              api.post('/ludo/leave', { gameId: gameIdRef.current }).catch(() => null);
            } else if (localSaveIdRef.current) {
              const id = localSaveIdRef.current;
              localSaveIdRef.current = null;
              removeLocalSave(id).then(refreshSavedGames);
            }
            applyPauseState(null);
            resetLocalGameState();
            setLudoGameActive(false);
          },
        },
      ],
    );
  };

  const acceptIncomingInvite = () => {
    const payload = incomingInviteRequest;
    if (!payload?.gameId) return;
    setOnlineMode(true);
    setGameId(payload.gameId);
    gameIdRef.current = payload.gameId;
    setSelectedPlayerCount(Number(payload.playerCount) || 4);
    setMyPlayerIndex(Number(payload.slotIndex) || 1);
    myPlayerIndexRef.current = Number(payload.slotIndex) || 1;
    setShowPlayerSelection(false);
    setGameStarted(false);
    gameStartedRef.current = false;
    latestSnapshotVersionRef.current = 0;
    setWaitingForPlayers(true);
    emit('ludo:join', { gameId: payload.gameId });
    emit('ludo:accept', {
      gameId: payload.gameId,
      slotIndex: payload.slotIndex,
      by: myProfile?._id,
      connect: {
        fullName: myProfile?.fullName,
        profilePic: myProfile?.profilePic,
        coverPic: myProfile?.coverPic,
      },
    });
    emit('ludo:players:get', { gameId: payload.gameId });
    setIncomingInviteRequest(null);
  };

  const cellOccupancy = useMemo(() => {
    const occupancy = new Map<string, { playerIndex: number; pieceIndex: number }[]>();
    renderPlayerOrder.forEach((playerIndex) => {
      const player = players[playerIndex];
      if (!player) return;
      player.pieces.forEach((piece, pieceIndex) => {
        const steps = getPieceSteps(piece);
        if (steps <= 0 || steps >= maxSteps) return;
        const pos = getPositionOnPath(playerIndex, steps, selectedPlayerCount);
        const key = `${pos.x},${pos.y}`;
        if (!occupancy.has(key)) occupancy.set(key, []);
        occupancy.get(key)!.push({ playerIndex, pieceIndex });
      });
    });
    return occupancy;
  }, [players, renderPlayerOrder, maxSteps, selectedPlayerCount]);

  const effectiveCurrentPlayer = currentPlayerRef.current ?? currentPlayer;
  const effectiveDiceForUi = diceValueRef.current || diceValue || 0;
  const diceForDisplay = heldRoll?.value || effectiveDiceForUi;
  const canTapDice =
    canRollDice &&
    effectiveDiceForUi === 0 &&
    isMyTurn &&
    connectionReady &&
    !gamePaused &&
    !(onlineMode && heldRoll);
  // While a landed roll is held, draw it in the colour of whoever rolled it,
  // even if the turn has already moved on.
  const diceOwnerIndex = heldRoll ? heldRoll.player : effectiveCurrentPlayer;
  const offlinePeers = players
    .map((seat, index) => ({ seat, index }))
    .filter(
      ({ seat, index }) =>
        index !== myPlayerIndex && seat && !seat.isBot && seat.isOffline && isHumanLudoProfileId(seat.profileId),
    );
  const turnHint = !gameStarted
    ? 'Waiting…'
    : !isMyTurn
      ? players[effectiveCurrentPlayer]?.isBot
        ? 'Computer turn'
        : 'Opponent turn'
      : canTapDice
        ? 'Tap dice to roll'
        : effectiveDiceForUi > 0
          ? 'Tap a glowing piece'
          : 'Wait…';

  const renderToken = (playerIndex: number, pieceIndex: number, piece: Player['pieces'][number]) => {
    const pieceSteps = getPieceSteps(piece);
    const isFinishedPiece = pieceSteps >= maxSteps;
    const tokenSize = isFinishedPiece ? finishedTokenSize : boardTokenSize;
    let x = 0;
    let y = 0;
    if (pieceSteps <= 0) {
      const boardSeatIndex = getBoardSeatIndex(playerIndex, selectedPlayerCount);
      const pos = HOME_POSITIONS[boardSeatIndex][pieceIndex];
      x = pos.x * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
      y = pos.y * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
    } else if (isFinishedPiece) {
      // Finished tokens: the last path cell is inside the 3x3 centre where
      // the dice sits, so line them up as small tokens along the outer edge
      // of their colour's triangle instead of drawing them on the dice.
      const finalPos = getPositionOnPath(playerIndex, maxSteps, selectedPlayerCount);
      const dirX = Math.sign(finalPos.x - 7);
      const dirY = Math.sign(finalPos.y - 7);
      const finishedIndexes = (players[playerIndex]?.pieces || [])
        .map((pc, idx) => (getPieceSteps(pc) >= maxSteps ? idx : -1))
        .filter((idx) => idx >= 0);
      const slot = Math.max(0, finishedIndexes.indexOf(pieceIndex));
      const spread = (slot - (finishedIndexes.length - 1) / 2) * FINISHED_TOKEN_GAP_CELLS;
      const centerX = (7.5 + dirX * FINISHED_TOKEN_BAND_CELLS + (dirX === 0 ? spread : 0)) * CELL_SIZE;
      const centerY = (7.5 + dirY * FINISHED_TOKEN_BAND_CELLS + (dirY === 0 ? spread : 0)) * CELL_SIZE;
      x = centerX - tokenSize / 2;
      y = centerY - tokenSize / 2;
    } else {
      const pos = getPositionOnPath(playerIndex, pieceSteps, selectedPlayerCount);
      x = pos.x * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
      y = pos.y * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
      const key = `${pos.x},${pos.y}`;
      const group = cellOccupancy.get(key) || [];
      const idxInGroup = group.findIndex((g) => g.playerIndex === playerIndex && g.pieceIndex === pieceIndex);
      const offset = getTokenOffset(idxInGroup >= 0 ? idxInGroup : group.length, group.length, CELL_SIZE);
      x += offset.x;
      y += offset.y;
    }
    x = Math.round(x);
    y = Math.round(y);
    const isCurrent = playerIndex === effectiveCurrentPlayer;
    const animationKey = `token-${playerIndex}-${pieceIndex}`;
    const isAnimating = tokenAnimation?.key === animationKey;
    const canMove =
      isCurrent &&
      connectionReady &&
      !gamePaused &&
      effectiveDiceForUi > 0 &&
      !isMovingRef.current &&
      !isAutoMovingRef.current &&
      ((pieceSteps <= 0 && effectiveDiceForUi === 6) ||
        (pieceSteps > 0 && pieceSteps < maxSteps && pieceSteps + effectiveDiceForUi <= maxSteps));
    const avatar = players[playerIndex]?.avatar;
    const TokenWrap = canMove || isAnimating ? Animated.View : View;
    return (
      <TouchableOpacity
        key={`token-${playerIndex}-${pieceIndex}`}
        testID={`ludo-token-${playerIndex}-${pieceIndex}`}
        activeOpacity={0.85}
        onPress={() => {
          const currentDiceValue = diceValueRef.current > 0 ? diceValueRef.current : diceValue;
          const allowed =
            ((!onlineMode && !playWithComputer && !playersRef.current[currentPlayerRef.current]?.isBot) ||
              myPlayerIndexRef.current === currentPlayerRef.current) &&
            isCurrent &&
            canMove &&
            currentDiceValue > 0 &&
            !isMovingRef.current &&
            !isAutoMovingRef.current;
          if (allowed) movePiece(pieceIndex);
        }}
        disabled={!canMove}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: tokenSize,
          height: tokenSize,
          // Finished tokens sit beside the dice (never under it), above it.
          zIndex: isFinishedPiece ? 60 : canMove ? 100 : 10,
        }}
      >
        <TokenWrap
          style={[
            styles.token,
            {
              width: tokenSize,
              height: tokenSize,
              borderRadius: tokenSize / 2,
              backgroundColor: piece.color,
              borderColor: adjustHexColor(piece.color, -40),
            },
            isAnimating && {
              transform: [
                { translateX: tokenAnimation.translateX },
                { translateY: tokenAnimation.translateY },
                {
                  translateY: tokenAnimation.hop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -tokenSize * 0.45],
                  }),
                },
                {
                  scale: tokenAnimation.hop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.22],
                  }),
                },
              ],
            },
            canMove && !isAnimating && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.tokenInner} />
          {avatar ? (
            <ProfileImage
              uri={avatar}
              pixelSize={Math.round(tokenSize * 2)}
              style={{
                width: tokenSize * 0.68,
                height: tokenSize * 0.68,
                borderRadius: (tokenSize * 0.68) / 2,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.7)',
              }}
            />
          ) : null}
        </TokenWrap>
      </TouchableOpacity>
    );
  };

  if (gameEnded) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <GameEndedScreen winners={winners} onResetGame={startNewGame} />
      </SafeAreaView>
    );
  }

  // Smaller than the 3x3 centre so finished tokens fit beside it.
  const diceSize = Math.round(CELL_SIZE * CENTER_DICE_CELLS);
  const avatarSize = Math.min(56, BOARD_SIZE * 0.14);
  const showDice = isRollingRef.current || diceForDisplay > 0;
  const currentAvatar = String(players[effectiveCurrentPlayer]?.avatar || '').trim();
  const showConnectLogo = !currentAvatar;
  const diceSpinStyle = {
    transform: [
      {
        rotate: diceRotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '720deg'],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <View style={styles.bgBlobA} />
      <View style={styles.bgBlobB} />

      <GameHeader
        gameStarted={gameStarted || waitingForPlayers}
        playWithComputer={playWithComputer}
        gameId={gameId}
        onStartGame={startNewGame}
        onResetGame={() => {
          if (!onlineMode && localSaveIdRef.current) {
            const id = localSaveIdRef.current;
            localSaveIdRef.current = null;
            removeLocalSave(id).then(refreshSavedGames);
          }
          startNewGame();
        }}
        onExitGame={exitGame}
        canPause={gameStarted && !gameEnded && !gamePaused}
        pauseDisabled={pauseDisabled}
        onPauseGame={pauseGame}
      />

      <IncomingInviteModal
        inviteRequest={incomingInviteRequest}
        onAccept={acceptIncomingInvite}
        onDecline={() => setIncomingInviteRequest(null)}
      />

      <PlayerEditorModal
        show={showPlayerEditor}
        editingPlayerIndex={editingPlayerIndex}
        player={editingPlayerIndex != null ? players[editingPlayerIndex] : null}
        editName={editName}
        editAvatarUrl={editAvatarUrl}
        inviteCopied={inviteCopied}
        connectSearchQuery={connectSearchQuery}
        loadingSearch={loadingSearch}
        searchResults={searchResults}
        connectList={connectList}
        canReplaceWithComputer={
          myPlayerIndex === 0 &&
          Number(editingPlayerIndex) > 0 &&
          !isRollingRef.current &&
          !isMovingRef.current &&
          !isAutoMovingRef.current
        }
        onNameChange={setEditName}
        onAvatarUrlChange={setEditAvatarUrl}
        onConnectSearchChange={onChangeConnectSearch}
        onAssignConnectToSlot={assignConnectToSlot}
        onReplaceWithComputer={() => replacePlayerWithBot(editingPlayerIndex)}
        onCopyInviteLink={copyInviteLink}
        onPlaySound={playSound}
        onClose={closePlayerEditor}
        onSave={savePlayerEditor}
      />

      <PlayerSelectionModal
        show={showPlayerSelection}
        selectedPlayerCount={selectedPlayerCount}
        onlineMode={onlineMode}
        playWithComputer={playWithComputer}
        connectSearchQuery={connectSearchQuery}
        loadingSearch={loadingSearch}
        searchResults={searchResults}
        connectList={connectList}
        selectedConnects={selectedConnects}
        invitedStatusByConnectId={invitedStatusByConnectId}
        players={players}
        myProfile={myProfile}
        onPlayerCountChange={setSelectedPlayerCount}
        onOnlineModeToggle={() => {
          setOnlineMode((prev) => {
            const next = !prev;
            if (next) setPlayWithComputer(false);
            return next;
          });
        }}
        onPlayWithComputerToggle={() => {
          setPlayWithComputer((prev) => {
            const next = !prev;
            if (next) setOnlineMode(false);
            return next;
          });
        }}
        onConnectSearchChange={onChangeConnectSearch}
        onConnectSelect={(f, isSelected) => {
          setSelectedConnects((prev) => {
            if (isSelected) return prev.filter((p) => p._id !== f._id);
            return [...prev, f].slice(0, Math.max(0, selectedPlayerCount - 1));
          });
        }}
        onInviteConnect={inviteConnect}
        onAssignConnectOffline={assignConnectOffline}
        onGetNextOpenSlot={getNextOpenSlot}
        onCancel={() => {
          setShowPlayerSelection(false);
          // With saved games the menu lists them; otherwise close Ludo.
          if (!gameStarted && !hasSavedGames) setLudoGameActive(false);
        }}
        onConfirmPlayerCount={confirmPlayerCount}
      />

      <WinnerModal
        winner={showWinnerModal ? winner : null}
        gameEnded={gameEnded}
        onContinueGame={() => setShowWinnerModal(false)}
        onEndGame={() => {
          setShowWinnerModal(false);
          setGameEnded(true);
          gameEndedRef.current = true;
        }}
      />

      {!gameStarted && !waitingForPlayers && !showPlayerSelection && (
        <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
          <SavedGamesPanel
            localSaves={localSaves}
            onlineGames={onlineSavedGames}
            maxSteps={maxSteps}
            onStartNew={startNewGame}
            onResumeLocal={resumeLocalGame}
            onDeleteLocal={deleteLocalSave}
            onResumeOnline={resumeOnlineGame}
            onRefresh={refreshSavedGames}
          />
        </ScrollView>
      )}

      {(gameStarted || waitingForPlayers) && (
        <ScrollView contentContainerStyle={[styles.stage, { paddingHorizontal: padding }]}>
          {onlineMode && gameStarted && !gameEnded && offlinePeers.length > 0 && (
            <View style={[styles.peerBanner, { width: BOARD_SIZE }]} testID="ludo-peer-offline">
              <ActivityIndicator color="#FDD835" size="small" />
              <Text style={styles.peerBannerText} numberOfLines={2}>
                {offlinePeers.map(({ seat }) => seat.name || 'A player').join(', ')}{' '}
                {offlinePeers.length === 1 ? 'is' : 'are'} reconnecting…
                {offlinePeers.some(({ index }) => index === 0) ? ' The game resumes when the host is back.' : ' Their turns are skipped.'}
              </Text>
              {myPlayerIndex === 0 &&
                offlinePeers
                  .filter(({ index }) => index > 0)
                  .map(({ index }) => (
                    <TouchableOpacity
                      key={`peer-bot-${index}`}
                      testID={`peer-replace-bot-${index}`}
                      style={styles.peerBannerBtn}
                      onPress={() => replacePlayerWithBot(index)}
                    >
                      <Text style={styles.peerBannerBtnText}>Use computer</Text>
                    </TouchableOpacity>
                  ))}
            </View>
          )}
          <Animated.View
            style={[
              styles.boardWrap,
              { width: BOARD_SIZE, height: BOARD_SIZE },
              {
                transform: [
                  {
                    // Shake: a quick decaying side-to-side wobble.
                    translateX: boardShake.interpolate({
                      inputRange: [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1],
                      outputRange: [0, -9, 8, -7, 6, -4, 3, -1, 0],
                    }),
                  },
                  {
                    // Wiggle: a happy little tilt.
                    rotate: boardBounce.interpolate({
                      inputRange: [0, 0.2, 0.45, 0.7, 1],
                      outputRange: ["0deg", "-2.2deg", "1.8deg", "-0.8deg", "0deg"],
                    }),
                  },
                  {
                    scale: boardBounce.interpolate({
                      inputRange: [0, 0.25, 1],
                      outputRange: [1, 1.035, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <GameBoard
              boardSize={BOARD_SIZE}
              cellSize={CELL_SIZE}
              players={players}
              selectedPlayerCount={selectedPlayerCount}
            />
            <View style={[styles.tokens, { width: BOARD_SIZE, height: BOARD_SIZE }]} pointerEvents="box-none">
              {renderPlayerOrder.map((playerIndex) =>
                players[playerIndex]?.pieces.map((piece, pieceIndex) =>
                  renderToken(playerIndex, pieceIndex, piece),
                ),
              )}
            </View>

            {waitingForPlayers && (
              <View style={styles.overlay}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {myPlayerIndex === 0 ? 'Waiting for players…' : 'Joining the match…'}
                  </Text>
                  <Text style={styles.cardBody}>
                    {myPlayerIndex === 0
                      ? 'The match starts as soon as everyone you invited accepts.'
                      : 'The match starts in a moment.'}
                  </Text>
                  <Text style={styles.seatCount}>
                    Joined {countOccupiedLobbySeats(players, selectedPlayerCount)}/{selectedPlayerCount}
                  </Text>
                  <View style={styles.seatList}>
                    {Array.from({ length: selectedPlayerCount }).map((_, i) => {
                      const seat = players[i];
                      const joined = isLobbySeatOccupied(seat, i);
                      return (
                        <View key={`seat-${i}`} style={styles.seatRow}>
                          <View style={[styles.seatDot, { backgroundColor: seat?.color || THEME.accent }]} />
                          <Text style={styles.seatName} numberOfLines={1}>
                            {seat?.name || `Seat ${i + 1}`}
                          </Text>
                          <Text style={[styles.seatBadge, joined ? styles.seatBadgeJoined : styles.seatBadgeWaiting]}>
                            {seat?.isBot ? 'Computer' : joined ? 'Joined' : 'Invited'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {myPlayerIndex === 0 && (
                    <TouchableOpacity
                      testID="waiting-replace-bot"
                      style={styles.primaryBtn}
                      onPress={() => {
                        // Fill empty seats with bots; the auto-start effect then
                        // starts the match and broadcasts it to joined players.
                        const copy = clonePlayers(playersRef.current);
                        for (let i = 1; i < copy.length; i++) {
                          if (!isHumanLudoProfileId(copy[i]?.profileId)) {
                            copy[i] = {
                              ...copy[i],
                              name: `Computer ${i}`,
                              isBot: true,
                              isActive: true,
                              profileId: `bot-${i}`,
                            };
                          }
                        }
                        playersRef.current = copy;
                        setPlayers(copy);
                        if (!onlineMode) {
                          setPlayWithComputer(true);
                          setWaitingForPlayers(false);
                          setCanRollDice(true);
                        }
                      }}
                    >
                      <Text style={styles.primaryBtnText}>Start with computer players</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {onlineMode && gameId && connectionHealth !== 'ok' && (
              <View style={styles.overlay} testID="ludo-reconnecting">
                <View style={styles.card}>
                  <ActivityIndicator color={THEME.accent} size="large" />
                  <Text style={[styles.cardTitle, { marginTop: 12 }]}>Reconnecting…</Text>
                  <Text style={styles.cardBody}>
                    {connectionHealth === 'slow'
                      ? 'Your connection is slow. Your moves are paused until it recovers.'
                      : 'Connection lost. Your game is safe and resumes automatically.'}
                  </Text>
                </View>
              </View>
            )}

            <View
              style={[styles.diceHit, !canTapDice && styles.diceHitLow]}
              pointerEvents={canTapDice ? 'auto' : 'none'}
            >
              <TouchableOpacity
                testID="ludo-dice"
                onPress={() => rollDice()}
                disabled={!canTapDice}
                activeOpacity={0.85}
              >
                <View style={{ width: diceSize, height: diceSize, alignItems: 'center', justifyContent: 'center' }}>
                  {!showDice ? (
                    showConnectLogo ? (
                      <View
                        style={{
                          width: avatarSize,
                          height: avatarSize,
                          borderRadius: avatarSize / 2,
                          backgroundColor: '#fff',
                          borderWidth: 3,
                          borderColor: players[effectiveCurrentPlayer]?.color || THEME.accent,
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <Image
                          source={CONNECT_LOGO}
                          style={{
                            width: avatarSize * 0.72,
                            height: avatarSize * 0.72,
                          }}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <ProfileImage
                        uri={currentAvatar}
                        pixelSize={Math.round(avatarSize * 2)}
                        style={{
                          width: avatarSize,
                          height: avatarSize,
                          borderRadius: avatarSize / 2,
                          borderWidth: 3,
                          borderColor: players[effectiveCurrentPlayer]?.color || THEME.accent,
                          backgroundColor: '#fff',
                        }}
                        resizeMode="cover"
                      />
                    )
                  ) : (
                    <Dice3D
                      value={isRollingRef.current ? diceSpin || 1 : diceForDisplay || 1}
                      size={diceSize}
                      strokeColor={players[diceOwnerIndex]?.color || THEME.accent}
                      rolling={isRollingRef.current}
                      durationMs={onlineMode ? 700 : DICE_ROLL_ANIMATION_MS}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
            <FunFxLayer bursts={fxBursts} onDone={removeFxBurst} reduceMotion={reduceMotionRef.current} />
            <PausedOverlay
              pause={gamePaused}
              isMine={Boolean(
                gamePaused &&
                  (gamePaused.local ||
                    (gamePaused.profileId && String(gamePaused.profileId) === String(myProfile?._id))),
              )}
              canResume={!onlineMode || myPlayerIndex === 0}
              onlineMode={Boolean(onlineMode && gameId)}
              resumeDenied={resumeDenied}
              onResume={resumeGame}
              onSaveAndExit={saveAndExitGame}
            />
          </Animated.View>

          <View style={{ width: BOARD_SIZE, maxWidth: '100%' }}>
            <PlayerDock
              currentPlayer={players[effectiveCurrentPlayer]}
              turnHint={turnHint}
              renderPlayerOrder={renderPlayerOrder}
              players={players}
              currentPlayerIndex={effectiveCurrentPlayer}
              soundsEnabled={soundsEnabled}
              onToggleSounds={toggleSounds}
              onOpenPlayerEditor={openPlayerEditor}
            />
          </View>
          {onlineMode && (
            <Text style={styles.conn}>
              {connectionHealth === 'ok'
                ? 'Online · connected'
                : connectionHealth === 'slow'
                  ? 'Online · slow connection…'
                  : 'Online · reconnecting…'}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingTop: 0,
  },
  bgBlobA: {
    position: 'absolute',
    width: 280,
    height: 280,
    left: -80,
    top: -60,
    backgroundColor: THEME.accent,
    opacity: 0.07,
    borderRadius: 140,
  },
  bgBlobB: {
    position: 'absolute',
    width: 260,
    height: 260,
    right: -70,
    top: 140,
    backgroundColor: THEME.accent2,
    opacity: 0.08,
    borderRadius: 130,
  },
  stage: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  boardWrap: {
    marginTop: 30,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f7f4ef',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tokens: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
  },
  token: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tokenInner: {
    position: 'absolute',
    left: 3,
    top: 3,
    right: 3,
    bottom: 3,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    backgroundColor: 'rgba(6, 10, 16, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.bgPanel,
    borderWidth: 1,
    borderColor: THEME.borderStrong,
    borderRadius: THEME.radius,
    padding: 18,
    alignItems: 'center',
  },
  cardTitle: { color: THEME.text, fontWeight: '800', fontSize: 16, marginBottom: 6 },
  cardBody: { color: THEME.muted, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 999,
    minHeight: 42,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: { color: '#06241f', fontWeight: '800' },
  diceHit: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceHitLow: { zIndex: 5 },
  conn: { color: THEME.muted, fontSize: 12, marginTop: 4 },
  seatCount: { color: THEME.text, fontWeight: '700', fontSize: 13, marginBottom: 8 },
  seatList: { width: '100%', gap: 6, marginBottom: 14 },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.surface,
    borderRadius: THEME.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  seatDot: { width: 12, height: 12, borderRadius: 6 },
  seatName: { flex: 1, color: THEME.text, fontSize: 13, fontWeight: '600' },
  seatBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  seatBadgeJoined: { color: '#06241f', backgroundColor: THEME.success },
  seatBadgeWaiting: { color: THEME.warn, backgroundColor: 'rgba(240, 180, 41, 0.14)' },
  peerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    backgroundColor: 'rgba(240, 180, 41, 0.12)',
    borderColor: 'rgba(240, 180, 41, 0.45)',
    borderWidth: 1,
    borderRadius: THEME.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  peerBannerText: { flex: 1, color: THEME.text, fontSize: 12.5, lineHeight: 17 },
  peerBannerBtn: {
    backgroundColor: THEME.warn,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  peerBannerBtnText: { color: '#1b1300', fontWeight: '800', fontSize: 12 },
});

export default LudoGameSVG;
