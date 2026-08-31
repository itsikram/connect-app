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
  Vibration,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useSocket } from '../contexts/SocketContext';
import api, { friendAPI } from '../lib/api';
import config from '../lib/config';
import { RootState } from '../store';
import {
  AUTO_MOVE_DELAY_MS,
  BOARD_CELLS,
  COLORS,
  DICE_ROLL_ANIMATION_MS,
  HOME_POSITIONS,
  PLAYER_NAMES,
  ROLL_UNLOCK_DELAY_MS,
  SIX_LIMIT_TRANSITION_DELAY_MS,
  STEP_DURATION_MS,
  THEME,
  TURN_TRANSITION_DELAY_MS,
} from '../lib/ludo/constants';
import { adjustHexColor } from '../lib/ludo/colorUtils';
import { DiceSVG } from '../lib/ludo/DiceSVG';
import { GameBoard } from '../lib/ludo/GameBoard';
import { GameHeader } from '../lib/ludo/GameHeader';
import {
  GameEndedScreen,
  IncomingInviteModal,
  PlayerDock,
  WinnerModal,
} from '../lib/ludo/GameOverlays';
import {
  applyPieceLifecycle,
  clonePlayers,
  generateGameId,
  getBoardSeatIndex,
  getRenderPlayerOrder,
  getTokenOffset,
  isHumanLudoProfileId,
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
import type { FriendUser, GameSnapshot, LudoInvite, Player } from '../lib/ludo/types';

const CONNECT_LOGO = require('../assets/images/logo.png');

const LudoGameSVG = () => {
  const { setLudoGameActive } = useLudoGame();
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
  const [selectedFriends, setSelectedFriends] = useState<FriendUser[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [friendList, setFriendList] = useState<FriendUser[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [invitedStatusByFriendId, setInvitedStatusByFriendId] = useState<Record<string, string>>({});
  const [invitedSlotByFriendId, setInvitedSlotByFriendId] = useState<Record<string, number>>({});
  const [incomingInviteRequest, setIncomingInviteRequest] = useState<LudoInvite | null>(null);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [diceSpin, setDiceSpin] = useState(0);
  const [showPlayerEditor, setShowPlayerEditor] = useState(false);
  const [editingPlayerIndex, setEditingPlayerIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

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
  const lastRollTimeRef = useRef(0);
  const lastLocalDiceRollTimeRef = useRef(0);
  const isRollingRef = useRef(false);
  const isMovingRef = useRef(false);
  const isAutoMovingRef = useRef(false);
  const moveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const botActingRef = useRef(false);
  const botActingPlayerIndexRef = useRef<number | null>(null);
  const botTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentMovesRef = useRef(new Map<string, { toSteps: number; timestamp: number; isCapture?: boolean }>());
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newGameDraftIdRef = useRef<string | null>(null);
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

  const playSound = useCallback((type: string) => {
    if (!soundsEnabled) return;
    try {
      if (type === 'capture' || type === 'win') Vibration.vibrate(type === 'win' ? 400 : 80);
      else Vibration.vibrate(20);
    } catch {
      // ignore
    }
  }, [soundsEnabled]);

  const setDiceValueImmediate = useCallback((value: number) => {
    setDiceValue(value);
    diceValueRef.current = value;
  }, []);

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
    friends: FriendUser[] = selectedFriends,
  ) => {
    const newPlayers: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
      const boardSeatIndex = getBoardSeatIndex(i, playerCount);
      const friend = i > 0 ? friends[i - 1] : undefined;
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
            : friend?.fullName || PLAYER_NAMES[boardSeatIndex],
        color: COLORS[boardSeatIndex],
        pieces,
        isActive: i === 0,
        avatar: i === 0 ? myProfile?.profilePic : friend?.profilePic,
        cover:
          i === 0
            ? myProfile?.coverPic || (myProfile as any)?.cover
            : friend?.coverPic || friend?.cover,
        profileId: i === 0 ? myProfile?._id || 'local' : friend?._id,
      });
    }
    playersRef.current = newPlayers;
    setPlayers(newPlayers);
    const sixes: Record<number, number> = {};
    for (let i = 0; i < playerCount; i++) sixes[i] = 0;
    setConsecutiveSixes(sixes);
    consecutiveSixesRef.current = sixes;
  }, [selectedPlayerCount, selectedFriends, myProfile]);

  useEffect(() => {
    if (!gameStartedRef.current) {
      initializeGame(selectedPlayerCount, selectedFriends);
    }
    // Only rebuild seats when the player count changes. Friend assigns update seats directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerCount]);

  useEffect(() => {
    if ((showPlayerSelection || showPlayerEditor) && myProfile?._id) {
      friendAPI.getFriendList(myProfile._id)
        .then((res) => setFriendList(Array.isArray(res.data) ? res.data : []))
        .catch(() => setFriendList([]));
    }
  }, [showPlayerSelection, showPlayerEditor, myProfile?._id]);

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

  const advanceTurnForPlayer = useCallback((fromPlayer: number) => {
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
      persistAndBroadcastGameState('turn_advance');
    }
    setTimeout(() => {
      if (
        !onlineModeRef.current &&
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
    }
    return { didFinish: true, winners: nextWinners, gameEnded: nextGameEnded };
  }, [playSound]);

  const animateTokenMovement = (
    _playerIndex: number,
    _pieceIndex: number,
    toSteps: number,
    fromSteps: number,
    onComplete: () => void,
  ) => {
    const stepsToGo = toSteps - fromSteps;
    if (stepsToGo <= 0) {
      onComplete();
      return;
    }
    const completionDelay = onlineModeRef.current
      ? Math.min(stepsToGo * STEP_DURATION_MS, 100)
      : stepsToGo * STEP_DURATION_MS;
    const finalTimer = setTimeout(onComplete, completionDelay);
    moveTimersRef.current.push(finalTimer);
  };

  const movePiece = (pieceId: number) => {
    if (isMovingRef.current && !isAutoMovingRef.current) return;
    const effectiveDiceValue = diceValueRef.current > 0 ? diceValueRef.current : diceValue;
    const abortMove = (opts?: { skipTurnIfNoMoves?: boolean }) => {
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      if (!opts?.skipTurnIfNoMoves) return;
      const diceVal = diceValueRef.current > 0 ? diceValueRef.current : diceValue;
      const remaining = getPlayablePieces(currentPlayerRef.current, diceVal);
      if (remaining.length === 0 && diceVal > 0) {
        setTimeout(() => advanceTurnForPlayer(currentPlayerRef.current), TURN_TRANSITION_DELAY_MS);
      }
    };
    if (effectiveDiceValue === 0 || (diceValueRef.current === 0 && diceValue === 0)) {
      abortMove();
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
              !onlineModeRef.current &&
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
                !onlineModeRef.current &&
                currentPlayerRef.current === nextPlayer &&
                diceValueRef.current === 0
              ) {
                setCanRollDice(true);
              }
            }, ROLL_UNLOCK_DELAY_MS);
          }, TURN_TRANSITION_DELAY_MS);
        }
      } else {
        setCanRollDice(false);
        isRollingRef.current = true;
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
      const keepTurnOnMoveOut = rolledDiceValue === 6 || didCaptureOnMoveOut;
      finishTurn(movingPlayerIndex, keepTurnOnMoveOut, didCaptureOnMoveOut);
      return;
    }

    if (pieceSteps > 0) {
      playSound('pieceMove');
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
    if (waitingForPlayers) return;
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
      const currentSixCount = consecutiveSixesRef.current[currentRollPlayer] || 0;
      if (value === 6) {
        const newSixCount = currentSixCount + 1;
        setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: newSixCount }));
        consecutiveSixesRef.current[currentRollPlayer] = newSixCount;
        if (newSixCount >= 3) {
          setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: 0 }));
          consecutiveSixesRef.current[currentRollPlayer] = 0;
          setDiceValueImmediate(value);
          isRollingRef.current = false;
          playSound('pieceOut');
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
            advanceTurnForPlayer(currentPlayerRef.current);
          }, onlineMode ? 250 : SIX_LIMIT_TRANSITION_DELAY_MS);
          return;
        }
      } else if (currentSixCount > 0) {
        setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: 0 }));
        consecutiveSixesRef.current[currentRollPlayer] = 0;
      }

      setDiceValueImmediate(value);
      lastLocalDiceRollTimeRef.current = Date.now();
      isRollingRef.current = false;
      if (value === 6) playSound('pieceOut');
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
          () => advanceTurnForPlayer(currentPlayerRef.current),
          onlineMode ? 100 : TURN_TRANSITION_DELAY_MS,
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
        }, AUTO_MOVE_DELAY_MS);
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
    if (!canControlBots || !gameStarted || gameEnded || waitingForPlayers) return;
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
        if (!gameStartedRef.current || gameEndedRef.current || !playersRef.current[playerIndex]?.isBot) return;
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
    if (Array.isArray(payload.players)) {
      playersRef.current = payload.players;
      setPlayers(payload.players);
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
    setWaitingForPlayers(false);
  }, [setCurrentPlayerImmediate, setDiceValueImmediate]);

  useEffect(() => {
    const onPlayers = (payload: GameSnapshot) => applyRemoteSnapshot(payload);
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
      if (typeof payload?.value === 'number') {
        setDiceValueImmediate(payload.value);
        setDiceSpin(payload.value);
      }
    };
    const onMove = (payload: any) => {
      if (!onlineModeRef.current || String(payload?.gameId) !== String(gameIdRef.current)) return;
      if (String(payload?.by) === String(myProfile?._id)) return;
      if (typeof payload?.toSteps !== 'number') return;
      setPlayers((prev) => {
        const copy = clonePlayers(prev);
        const pIdx = Number(payload.playerIndex);
        const pcIdx = Number(payload.pieceIndex);
        if (copy[pIdx]?.pieces?.[pcIdx]) {
          copy[pIdx].pieces[pcIdx] = applyPieceLifecycle(
            { ...copy[pIdx].pieces[pcIdx] },
            payload.toSteps,
            maxStepsRef.current,
          );
        }
        (payload.captures || []).forEach((c: any) => {
          if (copy[c.playerIndex]?.pieces?.[c.pieceIndex]) {
            copy[c.playerIndex].pieces[c.pieceIndex] = applyPieceLifecycle(
              { ...copy[c.playerIndex].pieces[c.pieceIndex] },
              0,
              maxStepsRef.current,
            );
          }
        });
        playersRef.current = copy;
        return copy;
      });
    };
    const onInvites = (data: any) => {
      const list = data?.invites || [];
      if (list[0]) setIncomingInviteRequest(list[0]);
    };
    on('ludo:players', onPlayers);
    on('ludo:invite', onInvite);
    on('ludo:invites', onInvites);
    on('ludo:roll', onRoll);
    on('ludo:move', onMove);
    return () => {
      off('ludo:players', onPlayers);
      off('ludo:invite', onInvite);
      off('ludo:invites', onInvites);
      off('ludo:roll', onRoll);
      off('ludo:move', onMove);
    };
  }, [on, off, applyRemoteSnapshot, myProfile?._id, setDiceValueImmediate]);

  const getNextOpenSlot = useCallback(() => {
    const max = Math.max(2, Math.min(4, selectedPlayerCount));
    for (let i = 1; i < max; i++) {
      const p = players[i];
      if (!p) return i;
      if (!p.profileId && !p.isBot) return i;
    }
    return null;
  }, [players, selectedPlayerCount]);

  const assignFriendOffline = (friend: FriendUser) => {
    const slot = getNextOpenSlot();
    if (slot == null) return;
    setPlayers((prev) => {
      const copy = clonePlayers(prev);
      if (!copy[slot]) return prev;
      copy[slot].name = friend.fullName || copy[slot].name;
      copy[slot].avatar = friend.profilePic;
      copy[slot].cover = friend.coverPic || friend.cover;
      copy[slot].profileId = friend._id;
      copy[slot].isBot = false;
      playersRef.current = copy;
      return copy;
    });
    setSelectedFriends((prev) => (prev.some((p) => p._id === friend._id) ? prev : [...prev, friend]));
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

  const assignFriendToSlot = (friend: FriendUser, slotIndex: number) => {
    if (!friend?._id || typeof slotIndex !== 'number' || slotIndex < 0) return;
    setPlayers((prev) => {
      const copy = clonePlayers(prev);
      if (!copy[slotIndex]) return prev;
      copy[slotIndex].name = friend.fullName || copy[slotIndex].name;
      copy[slotIndex].avatar = friend.profilePic || copy[slotIndex].avatar;
      copy[slotIndex].cover = friend.coverPic || friend.cover || copy[slotIndex].cover;
      copy[slotIndex].profileId = friend._id;
      copy[slotIndex].isBot = false;
      copy[slotIndex].isActive = true;
      copy[slotIndex].isOffline = false;
      playersRef.current = copy;
      return copy;
    });
    setSelectedFriends((prev) => {
      const already = prev.some((p) => String(p?._id) === String(friend._id));
      if (already) return prev;
      return [...prev, friend].slice(0, Math.max(0, selectedPlayerCount - 1));
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
      setInvitedStatusByFriendId((prev) => {
        const next = { ...prev };
        delete next[replacedProfileId];
        return next;
      });
      setInvitedSlotByFriendId((prev) => {
        const next = { ...prev };
        delete next[replacedProfileId];
        return next;
      });
      setSelectedFriends((prev) =>
        prev.filter((friend) => String(friend?._id || '') !== replacedProfileId),
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
        message: `${myProfile?.fullName || 'A friend'} invited you to play Ludo on Connect.\n${url}`,
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

  const inviteFriend = (friend: FriendUser) => {
    if (!friend?._id) return;
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
      copy[slot].name = friend.fullName || copy[slot].name;
      copy[slot].avatar = friend.profilePic;
      copy[slot].cover = friend.coverPic || friend.cover;
      copy[slot].isBot = false;
      playersRef.current = copy;
      return copy;
    });
    setInvitedStatusByFriendId((prev) => ({ ...prev, [String(friend._id)]: 'invited' }));
    setInvitedSlotByFriendId((prev) => ({ ...prev, [String(friend._id)]: slot }));
    setSelectedFriends((prev) => (prev.some((p) => p._id === friend._id) ? prev : [...prev, friend]));
    emit('ludo:invite', {
      to: friend._id,
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
          const hasHumanFriend = isHumanLudoProfileId(seat?.profileId);
          if (!hasHumanFriend) {
            next[i] = { ...seat, name: `Computer ${i}`, isBot: true, profileId: `bot-${i}` };
          }
        }
      }
      playersRef.current = next;
      return next;
    });
    setGameStarted(true);
    gameStartedRef.current = true;
    setCanRollDice(true);
    if (onlineMode && myProfile?._id && newOnlineGameId) {
      setWaitingForPlayers(true);
      emit('ludo:join', { gameId: newOnlineGameId });
      selectedFriends.forEach((f, idx) => {
        const slot = invitedSlotByFriendId[String(f._id)] ?? idx + 1;
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

  const startNewGame = () => {
    if (gameIdRef.current) {
      emit('ludo:leave', {
        gameId: gameIdRef.current,
        profileId: myProfile?._id,
        playerIndex: myPlayerIndexRef.current,
      });
    }
    setGameId(null);
    gameIdRef.current = null;
    newGameDraftIdRef.current = null;
    setOnlineMode(false);
    setPlayWithComputer(false);
    setGameStarted(false);
    gameStartedRef.current = false;
    setCurrentPlayer(0);
    setDiceValueImmediate(0);
    setWinner(null);
    setWinners([]);
    winnersRef.current = [];
    setGameEnded(false);
    gameEndedRef.current = false;
    setWaitingForPlayers(false);
    setCanRollDice(false);
    setShowWinnerModal(false);
    setSelectedFriends([]);
    setInvitedStatusByFriendId({});
    setInvitedSlotByFriendId({});
    initializeGame(selectedPlayerCount, []);
    setShowPlayerSelection(true);
  };

  const exitGame = () => {
    Alert.alert(
      'Leave game?',
      onlineMode
        ? 'Leave this game? Your progress will be removed.'
        : 'Leave this board and return to the menu?',
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
            }
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
    setWaitingForPlayers(true);
    emit('ludo:join', { gameId: payload.gameId });
    emit('ludo:accept', {
      gameId: payload.gameId,
      slotIndex: payload.slotIndex,
      by: myProfile?._id,
      friend: {
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
        if (steps <= 0) return;
        const stepsToUse = steps >= maxSteps ? maxSteps : steps;
        const pos = getPositionOnPath(playerIndex, stepsToUse, selectedPlayerCount);
        const key = `${pos.x},${pos.y}`;
        if (!occupancy.has(key)) occupancy.set(key, []);
        occupancy.get(key)!.push({ playerIndex, pieceIndex });
      });
    });
    return occupancy;
  }, [players, renderPlayerOrder, maxSteps, selectedPlayerCount]);

  const effectiveCurrentPlayer = currentPlayerRef.current ?? currentPlayer;
  const effectiveDiceForUi = diceValueRef.current || diceValue || 0;
  const canTapDice = canRollDice && effectiveDiceForUi === 0 && isMyTurn;
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
    let x = 0;
    let y = 0;
    if (pieceSteps <= 0) {
      const boardSeatIndex = getBoardSeatIndex(playerIndex, selectedPlayerCount);
      const pos = HOME_POSITIONS[boardSeatIndex][pieceIndex];
      x = pos.x * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
      y = pos.y * CELL_SIZE + CELL_SIZE / 2 - tokenSize / 2;
    } else {
      const stepsToUse = pieceSteps >= maxSteps ? maxSteps : pieceSteps;
      const pos = getPositionOnPath(playerIndex, stepsToUse, selectedPlayerCount);
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
    const canMove =
      isCurrent &&
      effectiveDiceForUi > 0 &&
      !isMovingRef.current &&
      !isAutoMovingRef.current &&
      ((pieceSteps <= 0 && effectiveDiceForUi === 6) ||
        (pieceSteps > 0 && pieceSteps < maxSteps && pieceSteps + effectiveDiceForUi <= maxSteps));
    const avatar = players[playerIndex]?.avatar;
    const TokenWrap = canMove ? Animated.View : View;
    return (
      <TouchableOpacity
        key={`token-${playerIndex}-${pieceIndex}`}
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
          zIndex: canMove ? 100 : 10,
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
              transform: canMove ? [{ scale: pulseAnim }] : undefined,
            },
          ]}
        >
          <View style={styles.tokenInner} />
          {avatar ? (
            <Image
              source={{ uri: avatar }}
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

  const diceSize = Math.min(72, BOARD_SIZE * 0.18);
  const avatarSize = Math.min(56, BOARD_SIZE * 0.14);
  const showDice = isRollingRef.current || effectiveDiceForUi > 0;
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <View style={styles.bgBlobA} />
      <View style={styles.bgBlobB} />

      <GameHeader
        gameStarted={gameStarted}
        playWithComputer={playWithComputer}
        gameId={gameId}
        onStartGame={startNewGame}
        onResetGame={startNewGame}
        onExitGame={exitGame}
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
        friendSearchQuery={friendSearchQuery}
        loadingSearch={loadingSearch}
        searchResults={searchResults}
        friendList={friendList}
        canReplaceWithComputer={
          myPlayerIndex === 0 &&
          Number(editingPlayerIndex) > 0 &&
          !isRollingRef.current &&
          !isMovingRef.current &&
          !isAutoMovingRef.current
        }
        onNameChange={setEditName}
        onAvatarUrlChange={setEditAvatarUrl}
        onFriendSearchChange={onChangeFriendSearch}
        onAssignFriendToSlot={assignFriendToSlot}
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
        friendSearchQuery={friendSearchQuery}
        loadingSearch={loadingSearch}
        searchResults={searchResults}
        friendList={friendList}
        selectedFriends={selectedFriends}
        invitedStatusByFriendId={invitedStatusByFriendId}
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
        onFriendSearchChange={onChangeFriendSearch}
        onFriendSelect={(f, isSelected) => {
          setSelectedFriends((prev) => {
            if (isSelected) return prev.filter((p) => p._id !== f._id);
            return [...prev, f].slice(0, Math.max(0, selectedPlayerCount - 1));
          });
        }}
        onInviteFriend={inviteFriend}
        onAssignFriendOffline={assignFriendOffline}
        onGetNextOpenSlot={getNextOpenSlot}
        onCancel={() => {
          setShowPlayerSelection(false);
          if (!gameStarted) setLudoGameActive(false);
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

      {(gameStarted || waitingForPlayers) && (
        <ScrollView contentContainerStyle={[styles.stage, { paddingHorizontal: padding }]}>
          <View style={[styles.boardWrap, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
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
                  <Text style={styles.cardTitle}>Waiting for players…</Text>
                  <Text style={styles.cardBody}>The match starts when everyone joins.</Text>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      setPlayers((prev) => {
                        const copy = clonePlayers(prev);
                        for (let i = 1; i < copy.length; i++) {
                          if (!isHumanLudoProfileId(copy[i]?.profileId)) {
                            copy[i] = {
                              ...copy[i],
                              name: `Computer ${i}`,
                              isBot: true,
                              profileId: `bot-${i}`,
                            };
                          }
                        }
                        playersRef.current = copy;
                        return copy;
                      });
                      setPlayWithComputer(true);
                      setWaitingForPlayers(false);
                      setCanRollDice(true);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Replace with computer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View
              style={[styles.diceHit, !canTapDice && styles.diceHitLow]}
              pointerEvents={canTapDice ? 'auto' : 'none'}
            >
              <TouchableOpacity
                onPress={() => rollDice()}
                disabled={
                  !canRollDice ||
                  ((onlineMode || playWithComputer) && effectiveCurrentPlayer !== myPlayerIndex)
                }
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
                      <Image
                        source={{ uri: currentAvatar }}
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
                    <Animated.View style={diceSpinStyle}>
                      <DiceSVG
                        value={isRollingRef.current ? diceSpin || 1 : effectiveDiceForUi || 1}
                        size={diceSize}
                        strokeColor={players[effectiveCurrentPlayer]?.color || THEME.accent}
                      />
                    </Animated.View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ width: BOARD_SIZE, maxWidth: '100%' }}>
            <PlayerDock
              currentPlayer={players[effectiveCurrentPlayer]}
              turnHint={turnHint}
              renderPlayerOrder={renderPlayerOrder}
              players={players}
              currentPlayerIndex={effectiveCurrentPlayer}
              soundsEnabled={soundsEnabled}
              onToggleSounds={() => setSoundsEnabled((v) => !v)}
              onOpenPlayerEditor={openPlayerEditor}
            />
          </View>
          {onlineMode && (
            <Text style={styles.conn}>
              {isConnected ? 'Online · connected' : 'Online · connecting…'}
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
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  boardWrap: {
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
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceHitLow: { zIndex: 5 },
  conn: { color: THEME.muted, fontSize: 12, marginTop: 4 },
});

export default LudoGameSVG;
