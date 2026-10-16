import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
  CENTER_DICE_CELLS,
  COLORS,
  FINISHED_TOKEN_BAND_CELLS,
  FINISHED_TOKEN_GAP_CELLS,
  FINISHED_TOKEN_SIZE_CELLS,
  HOME_POSITIONS,
  PLAYER_NAMES,
  THEME,
} from '../lib/ludo/constants';
import { adjustHexColor } from '../lib/ludo/colorUtils';
import { Dice3D } from '../lib/ludo/DiceSVG';
import { GameBoard } from '../lib/ludo/GameBoard';
import { GameHeader } from '../lib/ludo/GameHeader';
import { GamesPanel, PausedOverlay } from '../lib/ludo/PauseViews';
import { GameEndedScreen, IncomingInviteModal, PlayerDock, WinnerModal } from '../lib/ludo/GameOverlays';
import { cellFor, getBoardSeatIndex, getRenderPlayerOrder, getTokenOffset } from '../lib/ludo/helpers';
import { PlayerSelectionModal } from '../lib/ludo/PlayerSelectionModal';
import { PlayerEditorModal } from '../lib/ludo/PlayerEditorModal';
import { useLudoAudio } from '../lib/ludo/useLudoAudio';
import { useConnectionHealth } from '../lib/ludo/useConnectionHealth';
import { useLudoRequest, useServerGame } from '../lib/ludo/useServerGame';
import { FunFxLayer, createBurst, type FxBurst } from '../lib/ludo/FunFxLayer';
import type { ConnectUser, GameSummary, LudoInvite, Player, ServerPlayer, ServerState } from '../lib/ludo/types';

const CONNECT_LOGO = require('../assets/images/logo.png');
const DICE_TUMBLE_MS = 450;
const NOTICE_MS = 3500;

export interface LudoGameSVGProps {
  /** The game on screen (the navigation route's param); none = the Ludo menu. */
  gameId?: string | null;
  /** Opened from an invite: take the seat once the game is loaded. */
  acceptInvite?: { slotIndex?: number } | null;
  /** Show another game (or a new one). */
  onOpenGame?: (gameId: string, options?: { acceptInvite?: { slotIndex?: number }; replace?: boolean }) => void;
  /** Back to the Ludo menu. */
  onShowMenu?: () => void;
  /** Close Ludo entirely. */
  onExit?: () => void;
}

const canControlSeat = (state: ServerState | null, me: string, index: number) => {
  const seat = state?.players?.[index];
  if (!seat || !me) return false;
  if (seat.kind === 'human') return String(seat.profileId) === String(me);
  if (seat.kind === 'local') return String(state?.hostId) === String(me);
  return false;
};

const asPlayers = (players: ServerPlayer[]) => players as unknown as Player[];

// ------------------------------------------------------------- sound + fx

const useSoundFx = (width: number) => {
  const { soundsEnabled, playSound: playAudio, toggleSounds } = useLudoAudio();
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
  const playSound = useCallback(
    (kind: string) => {
      const burst = createBurst(kind, Math.min(1, Math.max(0.7, width / 520)));
      if (burst) setFxBursts((prev) => [...prev.slice(-3), burst]);
      if (!reduceMotionRef.current) {
        if (kind === 'capture' || kind === 'threeSixes') {
          boardShake.setValue(0);
          Animated.timing(boardShake, { toValue: 1, duration: 480, easing: Easing.linear, useNativeDriver: true }).start();
        } else if (kind === 'rolledSix' || kind === 'win') {
          boardBounce.setValue(0);
          Animated.timing(boardBounce, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
        }
      }
      playAudio(kind);
    },
    [boardShake, boardBounce, width, playAudio],
  );
  return { soundsEnabled, toggleSounds, playSound, fxBursts, removeFxBurst, boardShake, boardBounce, reduceMotionRef };
};

// ---------------------------------------------------------------- invites

const useInvites = (me: string) => {
  const { emit, on, off, isConnected } = useSocket();
  const [invites, setInvites] = useState<LudoInvite[]>([]);
  // The newest invite that arrived live (shown as a dialog).
  const [latest, setLatest] = useState<LudoInvite | null>(null);
  useEffect(() => {
    if (!me) return undefined;
    const normalize = (invite: LudoInvite): LudoInvite => ({
      ...invite,
      from: invite.from || invite.by,
      by: invite.by || invite.from,
    });
    const onList = (payload: { invites?: LudoInvite[] }) =>
      setInvites((Array.isArray(payload?.invites) ? payload.invites : []).map(normalize));
    const onOne = (payload: LudoInvite) => {
      if (!payload?.gameId) return;
      if (payload.to && String(payload.to) !== String(me)) return;
      const invite = normalize(payload);
      setInvites((prev) => [invite, ...prev.filter((i) => i.gameId !== invite.gameId)]);
      setLatest(invite);
    };
    on('ludo:invites', onList);
    on('ludo:invite', onOne);
    return () => {
      off('ludo:invites', onList);
      off('ludo:invite', onOne);
    };
  }, [me, on, off]);
  useEffect(() => {
    if (me && isConnected) emit('ludo:invites:get', {});
  }, [me, isConnected, emit]);
  const decline = useCallback(
    (invite: LudoInvite) => {
      setInvites((prev) => prev.filter((i) => i.gameId !== invite.gameId));
      setLatest((prev) => (prev?.gameId === invite.gameId ? null : prev));
      emit('ludo:invites:dismiss', { gameId: invite.gameId, by: invite.from });
      api.post('/notification/resolve-ludo-invite', { gameId: invite.gameId, inviterId: invite.from }).catch(() => null);
    },
    [emit],
  );
  const forget = useCallback((gameId: string) => {
    setInvites((prev) => prev.filter((i) => i.gameId !== gameId));
    setLatest((prev) => (prev?.gameId === gameId ? null : prev));
  }, []);
  return { invites, latest, decline, forget };
};

// ------------------------------------------------------- connect search

const useConnectSearch = (me: string, active: boolean) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConnectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ConnectUser[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active || !me) return;
    connectAPI
      .getConnectList(me)
      .then((res) => setList(Array.isArray(res.data) ? res.data : []))
      .catch(() => setList([]));
  }, [active, me]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  const onChange = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text || text.trim().length < 2) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.get(`/search?input=${encodeURIComponent(text)}`);
        setResults(res.data?.users || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);
  return { query, results, loading, list, onChange };
};

// ------------------------------------------------------------------ token

interface TokenViewProps {
  tokenId: string;
  x: number;
  y: number;
  size: number;
  color: string;
  avatar?: string | null;
  canMove: boolean;
  zIndex: number;
  durationMs: number;
  pulse: Animated.Value;
  onSelect: () => void;
}

// A token that glides (and hops) from its last square to the new one.
const TokenView = memo(function TokenView({
  tokenId,
  x,
  y,
  size,
  color,
  avatar,
  canMove,
  zIndex,
  durationMs,
  pulse,
  onSelect,
}: TokenViewProps) {
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const hop = useRef(new Animated.Value(0)).current;
  const last = useRef({ x, y });
  useEffect(() => {
    const dx = last.current.x - x;
    const dy = last.current.y - y;
    last.current = { x, y };
    if (!dx && !dy) return;
    offset.setValue({ x: dx, y: dy });
    hop.setValue(0);
    Animated.parallel([
      Animated.timing(offset, {
        toValue: { x: 0, y: 0 },
        duration: durationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: durationMs * 0.45, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: durationMs * 0.55, easing: Easing.bounce, useNativeDriver: true }),
      ]),
    ]).start();
  }, [x, y, durationMs, offset, hop]);

  return (
    <TouchableOpacity
      testID={tokenId}
      activeOpacity={0.85}
      onPress={onSelect}
      disabled={!canMove}
      style={{ position: 'absolute', left: x, top: y, width: size, height: size, zIndex }}
    >
      <Animated.View
        style={[
          styles.token,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            borderColor: adjustHexColor(color, -40),
            transform: [
              { translateX: offset.x },
              { translateY: offset.y },
              { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.45] }) },
              { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
              ...(canMove ? [{ scale: pulse }] : []),
            ],
          },
        ]}
      >
        <View style={styles.tokenInner} />
        {avatar ? (
          <ProfileImage
            uri={avatar}
            pixelSize={Math.round(size * 2)}
            style={{
              width: size * 0.68,
              height: size * 0.68,
              borderRadius: (size * 0.68) / 2,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.7)',
            }}
          />
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
});

// =================================================================== menu

interface ScreenProps extends LudoGameSVGProps {
  me: string;
  myProfile: any;
  fx: ReturnType<typeof useSoundFx>;
  invites: ReturnType<typeof useInvites>;
  notice: string;
  setNotice: (text: string) => void;
}

const LudoMenu: React.FC<ScreenProps> = ({ me, myProfile, fx, invites, notice, setNotice, onOpenGame, onExit }) => {
  const { emit, on, off, isConnected } = useSocket();
  const request = useLudoRequest(emit);
  const { pendingLudoInvite, consumeLudoInvite } = useLudoGame();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [showSelection, setShowSelection] = useState(false);
  const [creating, setCreating] = useState(false);
  const decidedRef = useRef(false);

  const [playerCount, setPlayerCount] = useState(4);
  const [onlineMode, setOnlineMode] = useState(false);
  const [playWithComputer, setPlayWithComputer] = useState(false);
  const [selectedConnects, setSelectedConnects] = useState<ConnectUser[]>([]);
  const [invitedSlots, setInvitedSlots] = useState<Record<string, number>>({});
  const [localSeats, setLocalSeats] = useState<Record<number, { name?: string; avatar?: string; cover?: string; profileId?: string }>>({});
  const search = useConnectSearch(me, showSelection);

  const refreshGames = useCallback(async () => {
    const result = await request('ludo:games:get', {});
    if (result?.ok) setGames(Array.isArray(result.games) ? result.games : []);
    return result;
  }, [request]);

  useEffect(() => {
    if (!isConnected) return;
    refreshGames().then((result) => {
      // First visit with nothing to resume goes straight to a new game.
      if (decidedRef.current) return;
      decidedRef.current = true;
      if (result?.ok && !(result.games || []).length && !invites.invites.length && !pendingLudoInvite) {
        setShowSelection(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, refreshGames]);

  // A live invite opens its own dialog; two modals at once don't show on iOS.
  useEffect(() => {
    if (invites.latest) setShowSelection(false);
  }, [invites.latest]);

  useEffect(() => {
    const onGames = (payload: { games?: GameSummary[] }) => setGames(Array.isArray(payload?.games) ? payload.games : []);
    // A seat handed to the computer is no longer this player's game.
    const onSeatReplaced = () => {
      refreshGames();
    };
    on('ludo:games', onGames);
    on('ludo:seat:replaced', onSeatReplaced);
    return () => {
      off('ludo:games', onGames);
      off('ludo:seat:replaced', onSeatReplaced);
    };
  }, [on, off, refreshGames]);

  const seatName = (index: number) => PLAYER_NAMES[getBoardSeatIndex(index, playerCount)];
  const connectById = (id: string) =>
    [...selectedConnects, ...search.list, ...search.results].find((c) => String(c?._id) === String(id));

  const nextOpenSlot = () => {
    const taken = new Set(Object.values(invitedSlots).map(Number));
    Object.entries(localSeats).forEach(([slot, seat]) => {
      if (seat?.profileId) taken.add(Number(slot));
    });
    for (let i = 1; i < playerCount; i++) if (!taken.has(i)) return i;
    return null;
  };

  const draftPlayers = useMemo(() => {
    const slotOwner: Record<number, ConnectUser | undefined> = {};
    Object.entries(invitedSlots).forEach(([id, slot]) => {
      slotOwner[slot] = connectById(id);
    });
    return Array.from({ length: playerCount }, (_, i) => {
      const color = COLORS[getBoardSeatIndex(i, playerCount)];
      const base = { id: i, color, pieces: [], isActive: true } as unknown as Player;
      if (i === 0) return { ...base, name: myProfile?.fullName || 'You', avatar: myProfile?.profilePic, profileId: me };
      const invited = onlineMode ? slotOwner[i] : undefined;
      if (invited) return { ...base, name: invited.fullName || 'Invited', avatar: invited.profilePic };
      const local = localSeats[i];
      if (local?.profileId || (!onlineMode && local)) {
        return { ...base, name: local.name || seatName(i), avatar: local.avatar, profileId: local.profileId };
      }
      if (playWithComputer || onlineMode) return { ...base, name: `Computer ${i}`, isBot: playWithComputer };
      return { ...base, name: seatName(i) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCount, invitedSlots, localSeats, onlineMode, playWithComputer, myProfile, me, selectedConnects, search.list, search.results]);

  const invitedStatusByConnectId = useMemo(() => {
    const status: Record<string, string> = {};
    if (onlineMode) Object.keys(invitedSlots).forEach((id) => (status[id] = 'invited'));
    return status;
  }, [invitedSlots, onlineMode]);

  const inviteConnect = (connect: ConnectUser) => {
    if (!connect?._id) return;
    setOnlineMode(true);
    setPlayWithComputer(false);
    if (invitedSlots[connect._id] != null) return;
    const slot = nextOpenSlot();
    if (slot == null) return;
    setInvitedSlots((prev) => ({ ...prev, [connect._id]: slot }));
    setSelectedConnects((prev) => (prev.some((c) => c._id === connect._id) ? prev : [...prev, connect]));
  };

  const assignConnectOffline = (connect: ConnectUser, slotIndex?: number) => {
    if (!connect?._id) return;
    const slot = Number.isInteger(slotIndex) && (slotIndex as number) > 0 ? (slotIndex as number) : nextOpenSlot();
    if (slot == null) return;
    setLocalSeats((prev) => ({
      ...prev,
      [slot]: { name: connect.fullName, avatar: connect.profilePic, cover: connect.coverPic || connect.cover, profileId: connect._id },
    }));
    setSelectedConnects((prev) => (prev.some((c) => c._id === connect._id) ? prev : [...prev, connect]));
  };

  const create = useCallback(
    async (count: number, seats: any[]) => {
      setCreating(true);
      const result = await request('ludo:create', {
        playerCount: count,
        seats,
        host: { name: myProfile?.fullName, avatar: myProfile?.profilePic, cover: myProfile?.coverPic },
      });
      setCreating(false);
      if (!result?.ok || !result.gameId) {
        setNotice(result?.message || "Couldn't start the game. Try again.");
        return;
      }
      setShowSelection(false);
      onOpenGame?.(result.gameId);
    },
    [request, myProfile, setNotice, onOpenGame],
  );

  // "Invite X to Ludo" from elsewhere in the app (header, assistant).
  useEffect(() => {
    if (!pendingLudoInvite?.id || pendingLudoInvite.gameId || !isConnected) return;
    const target = pendingLudoInvite;
    consumeLudoInvite();
    create(2, [{ kind: 'invite', profileId: target.id, name: target.name, avatar: target.profilePic }]);
  }, [pendingLudoInvite, isConnected, consumeLudoInvite, create]);

  const confirmPlayerCount = async () => {
    if (creating) return;
    fx.playSound('buttonClick');
    const slots: Record<string, number> = { ...invitedSlots };
    if (onlineMode) {
      const taken = new Set(Object.values(slots).map(Number));
      selectedConnects.forEach((connect) => {
        if (slots[connect._id] != null) return;
        for (let i = 1; i < playerCount; i++) {
          if (!taken.has(i)) {
            slots[connect._id] = i;
            taken.add(i);
            break;
          }
        }
      });
    }
    const bySlot: Record<number, string> = {};
    Object.entries(slots).forEach(([id, slot]) => {
      bySlot[slot] = id;
    });
    const seats: any[] = [];
    for (let i = 1; i < playerCount; i++) {
      const local = localSeats[i];
      if (onlineMode && bySlot[i]) {
        const connect = connectById(bySlot[i]);
        seats.push({ kind: 'invite', profileId: bySlot[i], name: connect?.fullName, avatar: connect?.profilePic });
      } else if (onlineMode || (playWithComputer && !local?.profileId)) {
        seats.push({ kind: 'bot' });
      } else {
        seats.push({ kind: 'local', name: local?.name || seatName(i), avatar: local?.avatar, cover: local?.cover });
      }
    }
    await create(playerCount, seats);
  };

  const removeGame = (game: GameSummary) => {
    Alert.alert(
      game.isHost ? 'Delete this game?' : 'Leave this game?',
      game.isHost ? "It ends for everyone in it and can't be resumed." : 'A computer takes over your seat.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: game.isHost ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            const result = await request('ludo:leave', { gameId: game.gameId });
            if (!result?.ok && result?.error !== 'not_found') setNotice(result?.message || "Couldn't remove the game.");
            refreshGames();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <View style={styles.bgBlobA} />
      <View style={styles.bgBlobB} />
      <GameHeader
        gameStarted={false}
        playWithComputer={false}
        gameId={null}
        onStartGame={() => setShowSelection(true)}
        onExitGame={() => onExit?.()}
      />
      {notice ? (
        <Text style={styles.notice} testID="ludo-notice">
          {notice}
        </Text>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        <GamesPanel
          games={games}
          invites={invites.invites}
          connected={isConnected}
          onStartNew={() => setShowSelection(true)}
          onResume={(game) => onOpenGame?.(game.gameId)}
          onRemove={removeGame}
          onRefresh={refreshGames}
          onAcceptInvite={(invite) => {
            invites.forget(invite.gameId);
            onOpenGame?.(invite.gameId, { acceptInvite: { slotIndex: invite.slotIndex } });
          }}
          onDeclineInvite={invites.decline}
        />
        <TouchableOpacity style={styles.closeLink} onPress={() => onExit?.()} testID="ludo-close">
          <Text style={styles.closeLinkText}>Close Ludo</Text>
        </TouchableOpacity>
      </ScrollView>

      <PlayerSelectionModal
        show={showSelection}
        selectedPlayerCount={playerCount}
        onlineMode={onlineMode}
        playWithComputer={playWithComputer}
        connectSearchQuery={search.query}
        loadingSearch={search.loading}
        searchResults={search.results}
        connectList={search.list}
        selectedConnects={selectedConnects}
        invitedStatusByConnectId={invitedStatusByConnectId}
        players={draftPlayers}
        myProfile={myProfile}
        onPlayerCountChange={(count) => {
          setPlayerCount(count);
          setInvitedSlots((prev) => {
            const next: Record<string, number> = {};
            Object.entries(prev).forEach(([id, slot]) => {
              if (slot < count) next[id] = slot;
            });
            return next;
          });
        }}
        onOnlineModeToggle={() =>
          setOnlineMode((prev) => {
            if (!prev) setPlayWithComputer(false);
            return !prev;
          })
        }
        onPlayWithComputerToggle={() =>
          setPlayWithComputer((prev) => {
            if (!prev) setOnlineMode(false);
            return !prev;
          })
        }
        onConnectSearchChange={search.onChange}
        onConnectSelect={(connect, isSelected) => {
          if (isSelected) {
            setSelectedConnects((prev) => prev.filter((c) => c._id !== connect._id));
            setInvitedSlots((prev) => {
              const next = { ...prev };
              delete next[connect._id];
              return next;
            });
            return;
          }
          setSelectedConnects((prev) => [...prev, connect].slice(0, Math.max(0, playerCount - 1)));
        }}
        onInviteConnect={inviteConnect}
        onAssignConnectOffline={(connect) => assignConnectOffline(connect)}
        onGetNextOpenSlot={nextOpenSlot}
        onCancel={() => setShowSelection(false)}
        onConfirmPlayerCount={confirmPlayerCount}
      />

      {creating && (
        <View style={styles.overlay} testID="ludo-creating">
          <View style={styles.card}>
            <ActivityIndicator color={THEME.accent} size="large" />
            <Text style={[styles.cardTitle, { marginTop: 12 }]}>Starting game…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// ================================================================== board

const LudoBoard: React.FC<ScreenProps & { gameId: string }> = ({
  gameId,
  acceptInvite,
  me,
  myProfile,
  fx,
  invites,
  notice,
  setNotice,
  onOpenGame,
  onShowMenu,
  onExit,
}) => {
  const { emit, on, off, isConnected } = useSocket();
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
  const finishedTokenSize = Math.max(9, Math.round(CELL_SIZE * FINISHED_TOKEN_SIZE_CELLS));

  const [removedReason, setRemovedReason] = useState<string | null>(null);
  const [winnerToShow, setWinnerToShow] = useState<number | null>(null);
  const [pendingMove, setPendingMove] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const autoAcceptRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { snapshot, joinInfo, actions, request } = useServerGame({
    emit,
    on,
    off,
    isConnected,
    gameId,
    onEvent: (kind, detail) => {
      fx.playSound(kind);
      if (kind === 'win' && detail) setWinnerToShow(detail.seat);
    },
    onRemoved: (payload) => setRemovedReason(payload?.reason || 'removed'),
    onSeatReplaced: () => setRemovedReason('replaced'),
  });
  const { state, pieces, moving, dice } = snapshot;
  const animating = Boolean(moving);

  const players = state?.players || [];
  const playerCount = state?.playerCount || 4;
  const pathLength = state?.pathLength;
  const maxSteps = state?.maxSteps || 57;
  const stepMs = state?.stepMs || 150;
  const isHost = Boolean(state && String(state.hostId) === String(me));
  const mySeat = players.findIndex((p) => p.kind === 'human' && String(p.profileId) === String(me));
  const isMember = mySeat >= 0 || isHost;
  const myIndex = mySeat >= 0 ? mySeat : 0;
  const current = state?.currentPlayer ?? 0;
  const controlsCurrent = canControlSeat(state, me, current);
  const otherHumans = players.some((p, i) => i !== mySeat && p.kind === 'human');
  const isOnlineGame = state?.mode === 'online' || otherHumans;
  const paused = Boolean(state?.paused);
  const ended = Boolean(state?.gameEnded);
  const lobby = state?.status === 'lobby';
  const playing = state?.status === 'playing';
  const renderOrder = useMemo(() => getRenderPlayerOrder(playerCount), [playerCount]);
  const connectionHealth = useConnectionHealth(true, isConnected, emit, isMember ? gameId : null);
  const connectionReady = connectionHealth === 'ok';
  const canTapDice =
    playing &&
    state?.phase === 'roll' &&
    controlsCurrent &&
    !paused &&
    connectionReady &&
    !dice.rolling &&
    !animating &&
    !busyAction;
  const myMovable =
    playing && state?.phase === 'move' && controlsCurrent && !paused && connectionReady && !animating && !pendingMove
      ? new Set(state?.movable || [])
      : new Set<number>();
  const search = useConnectSearch(me, editing != null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 450, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const report = useCallback(
    (result: any) => {
      if (result && !result.ok && result.error !== 'wrong_phase') setNotice(result.message || 'Something went wrong.');
      return result;
    },
    [setNotice],
  );

  // Opened from an invite: take the seat once the game is loaded.
  useEffect(() => {
    if (!acceptInvite || autoAcceptRef.current) return;
    if (joinInfo.status !== 'ready' || !state) return;
    autoAcceptRef.current = true;
    invites.forget(gameId);
    if (isMember) return;
    if (!joinInfo.canJoin) {
      setNotice(lobby ? 'That seat was taken.' : 'This match has already started.');
      return;
    }
    api.post('/notification/resolve-ludo-invite', { gameId, inviterId: state.hostId }).catch(() => null);
    actions.accept(acceptInvite.slotIndex).then(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptInvite, joinInfo.status, joinInfo.canJoin, state, isMember]);

  const roll = async () => {
    if (!canTapDice) return;
    report(await actions.roll(current));
  };
  const movePiece = async (pieceIndex: number) => {
    if (pendingMove) return;
    setPendingMove(true);
    const result = await actions.move(pieceIndex);
    setPendingMove(false);
    report(result);
  };
  const pauseGame = async () => {
    fx.playSound('buttonClick');
    report(await actions.pause(myProfile?.fullName || players[myIndex]?.name));
  };
  const resumeGame = async () => {
    fx.playSound('buttonClick');
    report(await actions.resume());
  };
  const saveAndExit = async () => {
    fx.playSound('buttonClick');
    if (!paused && playing) await actions.pause(myProfile?.fullName || players[myIndex]?.name);
    onShowMenu?.();
  };

  const leaveGame = () => {
    Alert.alert(
      'Leave this game?',
      !isMember
        ? "You'll stop watching this game."
        : isHost
          ? isOnlineGame
            ? "You're the host — the match ends for everyone who joined. To finish it later, use Pause → Save & exit."
            : 'This game will be deleted. To finish it later, use Pause → Save & exit.'
          : "You'll leave the match; a computer takes over your seat.",
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (isMember) {
              setBusyAction(true);
              await actions.leave();
              setBusyAction(false);
            }
            onExit?.();
          },
        },
      ],
    );
  };

  const restartGame = () => {
    Alert.alert('Restart from the beginning?', 'This game is replaced by a new one with the same players.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        style: 'destructive',
        onPress: async () => {
          if (!state) return;
          setBusyAction(true);
          const seats = players
            .slice(1)
            .map((p) => (p.kind === 'local' ? { kind: 'local', name: p.name, avatar: p.avatar, cover: p.cover } : { kind: 'bot' }));
          const created = await request('ludo:create', {
            playerCount,
            seats,
            host: { name: myProfile?.fullName, avatar: myProfile?.profilePic, cover: myProfile?.coverPic },
          });
          if (created?.ok && created.gameId) {
            await actions.leave();
            setBusyAction(false);
            onOpenGame?.(created.gameId, { replace: true });
            return;
          }
          setBusyAction(false);
          report(created);
        },
      },
    ]);
  };

  const copyInviteLink = async () => {
    try {
      const origin = String(config.SOCKET_BASE_URL || '').replace(/\/$/, '');
      const url = `${origin}/ludo-game/${encodeURIComponent(gameId)}`;
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

  const openEditor = (index: number) => {
    if (!players[index]) return;
    setEditing(index);
    setEditName(players[index]?.name || '');
    setEditAvatar(players[index]?.avatar || '');
    fx.playSound('buttonClick');
  };
  const closeEditor = () => {
    setEditing(null);
    setEditName('');
    setEditAvatar('');
  };
  const saveEditor = async () => {
    const seat = editing != null ? players[editing] : null;
    if (isHost && seat && editing != null && (seat.kind === 'local' || seat.kind === 'bot' || seat.kind === 'open')) {
      const avatar = editAvatar.trim();
      report(await actions.updateSeat(editing, { name: editName.trim(), avatar: avatar && !avatar.startsWith('data:') ? avatar : undefined }));
    }
    closeEditor();
  };
  const replaceWithComputer = async (index: number) => {
    fx.playSound('buttonClick');
    closeEditor();
    report(await actions.replaceWithComputer(index));
  };

  // --------------------------------------------------------------- views

  if (removedReason || joinInfo.status === 'not_found') {
    const text =
      removedReason === 'host_left'
        ? 'The host ended this game.'
        : removedReason === 'replaced'
          ? 'The host gave your seat to the computer.'
          : 'This game has ended or no longer exists.';
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centered} testID="ludo-game-gone">
          <Text style={styles.cardTitle}>Game unavailable</Text>
          <Text style={styles.cardBody}>{text}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onShowMenu?.()} testID="ludo-back-to-menu">
            <Text style={styles.primaryBtnText}>Back to Ludo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (ended && state) {
    const standings = (state.standings?.length ? state.standings : state.winners).map((w) => ({
      ...w,
      id: getBoardSeatIndex(w.seat ?? w.id, playerCount),
    }));
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <GameEndedScreen winners={standings as unknown as Player[]} onResetGame={() => onShowMenu?.()} />
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={THEME.accent} size="large" />
          <Text style={styles.cardBody}>
            {joinInfo.status === 'error' ? joinInfo.message || "Couldn't open the game. Retrying…" : 'Opening game…'}
          </Text>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => onShowMenu?.()}>
            <Text style={styles.ghostBtnText}>Back to Ludo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showJoinPrompt = !isMember && joinInfo.canJoin && !acceptInvite;
  const currentSeat = players[current];
  const turnHint = lobby
    ? 'Waiting…'
    : paused
      ? 'Paused'
      : !controlsCurrent
        ? currentSeat?.isBot
          ? 'Computer turn'
          : 'Opponent turn'
        : canTapDice
          ? 'Tap dice to roll'
          : state.phase === 'move' && !animating
            ? 'Tap a glowing piece'
            : 'Wait…';

  const occupancy = new Map<string, { seat: number; piece: number }[]>();
  renderOrder.forEach((seat) => {
    (pieces[seat] || []).forEach((steps, piece) => {
      if (steps <= 0 || steps >= maxSteps) return;
      const pos = cellFor(seat, steps, playerCount, pathLength);
      const key = `${pos.x},${pos.y}`;
      if (!occupancy.has(key)) occupancy.set(key, []);
      occupancy.get(key)!.push({ seat, piece });
    });
  });

  const renderToken = (seat: number, piece: number, steps: number) => {
    const player = players[seat];
    const color = player?.color || COLORS[getBoardSeatIndex(seat, playerCount)];
    const finished = steps >= maxSteps;
    const size = finished ? finishedTokenSize : tokenSize;
    let x: number;
    let y: number;
    if (steps <= 0) {
      const pos = HOME_POSITIONS[getBoardSeatIndex(seat, playerCount)][piece];
      x = pos.x * CELL_SIZE + CELL_SIZE / 2 - size / 2;
      y = pos.y * CELL_SIZE + CELL_SIZE / 2 - size / 2;
    } else if (finished) {
      const end = cellFor(seat, maxSteps, playerCount, pathLength);
      const dirX = Math.sign(end.x - 7);
      const dirY = Math.sign(end.y - 7);
      const done = (pieces[seat] || []).map((s, i) => (s >= maxSteps ? i : -1)).filter((i) => i >= 0);
      const slot = Math.max(0, done.indexOf(piece));
      const spread = (slot - (done.length - 1) / 2) * FINISHED_TOKEN_GAP_CELLS;
      x = (7.5 + dirX * FINISHED_TOKEN_BAND_CELLS + (dirX === 0 ? spread : 0)) * CELL_SIZE - size / 2;
      y = (7.5 + dirY * FINISHED_TOKEN_BAND_CELLS + (dirY === 0 ? spread : 0)) * CELL_SIZE - size / 2;
    } else {
      const pos = cellFor(seat, steps, playerCount, pathLength);
      x = pos.x * CELL_SIZE + CELL_SIZE / 2 - size / 2;
      y = pos.y * CELL_SIZE + CELL_SIZE / 2 - size / 2;
      const group = occupancy.get(`${pos.x},${pos.y}`) || [];
      const at = group.findIndex((g) => g.seat === seat && g.piece === piece);
      const offset = getTokenOffset(at >= 0 ? at : group.length, group.length, CELL_SIZE);
      x += offset.x;
      y += offset.y;
    }
    const canMove = seat === current && myMovable.has(piece);
    const isMoving = Boolean(moving && moving.seat === seat && moving.piece === piece);
    return (
      <TokenView
        key={`token-${seat}-${piece}`}
        tokenId={`ludo-token-${seat}-${piece}`}
        x={Math.round(x)}
        y={Math.round(y)}
        size={size}
        color={color}
        avatar={player?.avatar}
        canMove={canMove}
        zIndex={finished ? 60 : isMoving ? 120 : canMove ? 100 : 10}
        durationMs={Math.min(stepMs, 160)}
        pulse={pulseAnim}
        onSelect={() => {
          if (canMove) movePiece(piece);
        }}
      />
    );
  };

  const offlinePeers = playing
    ? players.map((seat, index) => ({ seat, index })).filter(({ seat, index }) => index !== mySeat && seat.kind === 'human' && seat.isOffline)
    : [];
  const diceSize = Math.round(CELL_SIZE * CENTER_DICE_CELLS);
  const avatarSize = Math.min(56, BOARD_SIZE * 0.14);
  const currentAvatar = String(currentSeat?.avatar || '').trim();
  const diceOwner = dice.showing ? dice.seat : current;
  const joinedCount = players.filter((p) => p.kind !== 'open').length;
  const editingSeat = editing != null ? players[editing] : null;
  const winnerPlayer = winnerToShow != null ? players[winnerToShow] : null;
  const subtitle = state.mode === 'computer' ? 'Vs computer' : state.mode === 'local' ? 'Pass & play' : 'Online match';

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <View style={styles.bgBlobA} />
      <View style={styles.bgBlobB} />

      <GameHeader
        gameStarted
        playWithComputer={state.mode === 'computer'}
        gameId={gameId}
        subtitle={subtitle}
        onStartGame={() => {}}
        onResetGame={isHost && !isOnlineGame && !lobby ? restartGame : undefined}
        onExitGame={leaveGame}
        canPause={isMember && playing && !paused}
        pauseDisabled={busyAction}
        onPauseGame={pauseGame}
      />

      <IncomingInviteModal
        inviteRequest={
          showJoinPrompt
            ? {
                gameId,
                name: players[0]?.name,
                avatar: players[0]?.avatar || undefined,
                playerCount,
                slotIndex: Math.max(
                  0,
                  players.findIndex((p) => p.kind === 'open' && (!p.invited || String(p.invited.profileId) === String(me))),
                ),
              }
            : null
        }
        onAccept={async () => report(await actions.accept())}
        onDecline={async () => {
          await actions.decline();
          onShowMenu?.();
        }}
      />

      <PlayerEditorModal
        show={editing != null}
        editingPlayerIndex={editing}
        player={editingSeat as unknown as Player}
        editName={editName}
        editAvatarUrl={editAvatar}
        inviteCopied={inviteCopied}
        connectSearchQuery={search.query}
        loadingSearch={search.loading}
        searchResults={search.results}
        connectList={search.list}
        canReplaceWithComputer={isHost && Number(editing) > 0 && !ended}
        onNameChange={setEditName}
        onAvatarUrlChange={setEditAvatar}
        onConnectSearchChange={search.onChange}
        onAssignConnectToSlot={async (connect, slotIndex) => {
          if (!isHost) return;
          report(await actions.invite(connect._id, slotIndex));
        }}
        onReplaceWithComputer={() => editing != null && replaceWithComputer(editing)}
        onCopyInviteLink={copyInviteLink}
        onPlaySound={fx.playSound}
        onClose={closeEditor}
        onSave={saveEditor}
      />

      <WinnerModal
        winner={winnerPlayer && !ended ? (winnerPlayer as unknown as Player) : null}
        gameEnded={ended}
        onContinueGame={() => setWinnerToShow(null)}
        onEndGame={() => {
          setWinnerToShow(null);
          onShowMenu?.();
        }}
      />

      <ScrollView contentContainerStyle={[styles.stage, { paddingHorizontal: padding }]}>
        {notice ? (
          <Text style={[styles.notice, { width: BOARD_SIZE }]} testID="ludo-notice">
            {notice}
          </Text>
        ) : null}
        {!isMember && !showJoinPrompt && (
          <View style={[styles.peerBanner, { width: BOARD_SIZE }]}>
            <Text style={styles.peerBannerText}>You're watching this game.</Text>
          </View>
        )}
        {offlinePeers.length > 0 && (
          <View style={[styles.peerBanner, { width: BOARD_SIZE }]} testID="ludo-peer-offline">
            <ActivityIndicator color="#FDD835" size="small" />
            <Text style={styles.peerBannerText} numberOfLines={2}>
              {offlinePeers.map(({ seat }) => seat.name || 'A player').join(', ')}{' '}
              {offlinePeers.length === 1 ? 'is' : 'are'} away. Their turns are skipped until they're back.
            </Text>
            {isHost &&
              offlinePeers.map(({ index }) => (
                <TouchableOpacity
                  key={`peer-bot-${index}`}
                  testID={`peer-replace-bot-${index}`}
                  style={styles.peerBannerBtn}
                  onPress={() => replaceWithComputer(index)}
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
                  translateX: fx.boardShake.interpolate({
                    inputRange: [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1],
                    outputRange: [0, -9, 8, -7, 6, -4, 3, -1, 0],
                  }),
                },
                {
                  rotate: fx.boardBounce.interpolate({
                    inputRange: [0, 0.2, 0.45, 0.7, 1],
                    outputRange: ['0deg', '-2.2deg', '1.8deg', '-0.8deg', '0deg'],
                  }),
                },
                { scale: fx.boardBounce.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 1.035, 1] }) },
              ],
            },
          ]}
        >
          <GameBoard boardSize={BOARD_SIZE} cellSize={CELL_SIZE} players={players} selectedPlayerCount={playerCount} />
          <View style={[styles.tokens, { width: BOARD_SIZE, height: BOARD_SIZE }]} pointerEvents="box-none">
            {renderOrder.map((seat) => (pieces[seat] || []).map((steps, piece) => renderToken(seat, piece, steps)))}
          </View>

          {lobby && (
            <View style={styles.overlay}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{isHost ? 'Waiting for players…' : 'Waiting for others…'}</Text>
                <Text style={styles.cardBody}>
                  {isHost ? 'The match starts as soon as everyone you invited accepts.' : 'The match starts when all players have joined.'}
                </Text>
                <Text style={styles.seatCount}>
                  Joined {joinedCount}/{playerCount}
                </Text>
                <View style={styles.seatList}>
                  {players.map((seat, i) => {
                    const joined = seat.kind !== 'open';
                    return (
                      <View key={`seat-${i}`} style={styles.seatRow}>
                        <View style={[styles.seatDot, { backgroundColor: seat.color || THEME.accent }]} />
                        <Text style={styles.seatName} numberOfLines={1}>
                          {seat.name || `Seat ${i + 1}`}
                        </Text>
                        <Text style={[styles.seatBadge, joined ? styles.seatBadgeJoined : styles.seatBadgeWaiting]}>
                          {seat.kind === 'bot' ? 'Computer' : joined ? 'Joined' : seat.invited ? 'Invited' : 'Open'}
                        </Text>
                        {isHost && seat.kind === 'open' && (
                          <TouchableOpacity onPress={() => openEditor(i)} testID={`lobby-seat-invite-${i}`}>
                            <Text style={styles.seatAction}>{seat.invited ? 'Change' : 'Invite'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
                {isHost && (
                  <TouchableOpacity
                    testID="waiting-replace-bot"
                    style={[styles.primaryBtn, busyAction && { opacity: 0.6 }]}
                    disabled={busyAction}
                    onPress={async () => {
                      setBusyAction(true);
                      report(await actions.start());
                      setBusyAction(false);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>{busyAction ? 'Starting game…' : 'Start with computer players'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {(connectionHealth !== 'ok' || joinInfo.status === 'error') && (
            <View style={styles.overlay} testID="ludo-reconnecting">
              <View style={styles.card}>
                <ActivityIndicator color={THEME.accent} size="large" />
                <Text style={[styles.cardTitle, { marginTop: 12 }]}>Reconnecting…</Text>
                <Text style={styles.cardBody}>
                  {connectionHealth === 'slow'
                    ? 'Your connection is slow. Your moves are paused until it recovers.'
                    : 'Connection lost. Your game is saved on the server and resumes automatically.'}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.diceHit, !canTapDice && styles.diceHitLow]} pointerEvents={canTapDice ? 'auto' : 'none'}>
            <TouchableOpacity testID="ludo-dice" onPress={roll} disabled={!canTapDice} activeOpacity={0.85}>
              <View style={{ width: diceSize, height: diceSize, alignItems: 'center', justifyContent: 'center' }}>
                {!dice.showing ? (
                  !currentAvatar ? (
                    <View
                      style={[
                        styles.centerAvatar,
                        { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, borderColor: currentSeat?.color || THEME.accent },
                      ]}
                    >
                      <Image source={CONNECT_LOGO} style={{ width: avatarSize * 0.72, height: avatarSize * 0.72 }} resizeMode="contain" />
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
                        borderColor: currentSeat?.color || THEME.accent,
                        backgroundColor: '#fff',
                      }}
                      resizeMode="cover"
                    />
                  )
                ) : (
                  <Dice3D
                    value={dice.value || 1}
                    size={diceSize}
                    strokeColor={players[diceOwner]?.color || THEME.accent}
                    rolling={dice.rolling}
                    durationMs={DICE_TUMBLE_MS}
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
          <FunFxLayer bursts={fx.fxBursts} onDone={fx.removeFxBurst} reduceMotion={fx.reduceMotionRef.current} />
          <PausedOverlay
            pause={paused ? { profileId: state.pausedBy?.profileId, name: state.pausedBy?.name, at: state.pausedAt || undefined } : null}
            isMine={Boolean(paused && String(state.pausedBy?.profileId) === String(me))}
            canResume={isMember}
            onlineMode={isOnlineGame}
            onResume={resumeGame}
            onSaveAndExit={saveAndExit}
          />
        </Animated.View>

        <View style={{ width: BOARD_SIZE, maxWidth: '100%' }}>
          <PlayerDock
            currentPlayer={currentSeat as unknown as Player}
            turnHint={turnHint}
            renderPlayerOrder={renderOrder}
            players={asPlayers(players)}
            currentPlayerIndex={current}
            soundsEnabled={fx.soundsEnabled}
            onToggleSounds={fx.toggleSounds}
            onOpenPlayerEditor={openEditor}
          />
        </View>
        <View style={[styles.toolbar, { width: BOARD_SIZE }]}>
          <TouchableOpacity
            style={styles.tool}
            onPress={async () => {
              fx.playSound('buttonClick');
              report(await actions.reload());
            }}
            testID="ludo-reload"
          >
            <Text style={styles.toolText}>Reload</Text>
          </TouchableOpacity>
          {isHost && isOnlineGame && (
            <TouchableOpacity
              style={styles.tool}
              testID="ludo-reinvite"
              onPress={async () => {
                fx.playSound('buttonClick');
                const result = report(await actions.reinvite());
                if (result?.ok) {
                  setNotice(result.sent ? `Re-invited ${result.sent} player${result.sent === 1 ? '' : 's'}.` : 'Everyone is already here.');
                }
              }}
            >
              <Text style={styles.toolText}>Re-invite</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.tool} onPress={() => onShowMenu?.()} testID="ludo-menu">
            <Text style={styles.toolText}>Your games</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.conn}>
          {connectionHealth === 'ok' ? 'Connected' : connectionHealth === 'slow' ? 'Slow connection…' : 'Reconnecting…'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ================================================================= screen

const LudoGameSVG: React.FC<LudoGameSVGProps> = (props) => {
  const myProfile = useSelector((state: RootState) => state.profile);
  const me = myProfile?._id ? String(myProfile._id) : '';
  const fx = useSoundFx(Dimensions.get('window').width);
  const invites = useInvites(me);
  const [notice, setNoticeState] = useState('');
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setNotice = useCallback((text: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNoticeState(text || '');
    if (text) noticeTimerRef.current = setTimeout(() => setNoticeState(''), NOTICE_MS);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  if (!me) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.cardTitle}>Sign in to play Ludo.</Text>
        </View>
      </SafeAreaView>
    );
  }
  const shared = { ...props, me, myProfile, fx, invites, notice, setNotice };
  const liveInvite = invites.latest && invites.latest.gameId !== props.gameId ? invites.latest : null;
  return (
    <>
      {props.gameId ? <LudoBoard key={props.gameId} {...shared} gameId={props.gameId} /> : <LudoMenu {...shared} />}
      <IncomingInviteModal
        inviteRequest={liveInvite}
        onAccept={() => {
          if (!liveInvite) return;
          invites.forget(liveInvite.gameId);
          props.onOpenGame?.(liveInvite.gameId, { acceptInvite: { slotIndex: liveInvite.slotIndex } });
        }}
        onDecline={() => liveInvite && invites.decline(liveInvite)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg, paddingTop: 0 },
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  stage: { alignItems: 'center', paddingTop: 16, paddingBottom: 28, gap: 14 },
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
  tokens: { position: 'absolute', left: 0, top: 0, zIndex: 20 },
  token: { borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
  cardTitle: { color: THEME.text, fontWeight: '800', fontSize: 16, marginBottom: 6, textAlign: 'center' },
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
  ghostBtn: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  ghostBtnText: { color: THEME.text, fontWeight: '700' },
  diceHit: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  diceHitLow: { zIndex: 5 },
  centerAvatar: {
    backgroundColor: '#fff',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
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
  seatAction: { color: THEME.accent, fontWeight: '800', fontSize: 12 },
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
  peerBannerBtn: { backgroundColor: THEME.warn, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  peerBannerBtnText: { color: '#1b1300', fontWeight: '800', fontSize: 12 },
  notice: {
    alignSelf: 'center',
    maxWidth: '100%',
    color: THEME.text,
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(62, 198, 255, 0.14)',
    borderColor: 'rgba(62, 198, 255, 0.45)',
    borderWidth: 1,
    borderRadius: THEME.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: '100%' },
  tool: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  toolText: { color: THEME.text, fontWeight: '700', fontSize: 12 },
  closeLink: { alignSelf: 'center', marginTop: 18, padding: 8 },
  closeLinkText: { color: THEME.muted, fontWeight: '700' },
});

export default LudoGameSVG;
