export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  id: number;
  color: string;
  position: Position;
  isHome: boolean;
  isInPlay: boolean;
  steps: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  pieces: Piece[];
  isActive: boolean;
  avatar?: string;
  cover?: string;
  profileId?: string;
  isBot?: boolean;
  isOffline?: boolean;
  offlineSince?: number;
}

export interface CaptureHit {
  playerIndex: number;
  pieceIndex: number;
}

export interface ConnectUser {
  _id: string;
  fullName?: string;
  profilePic?: string;
  coverPic?: string;
  cover?: string;
  profileCover?: string;
}

export interface LudoInvite {
  gameId: string;
  from?: string;
  by?: string;
  to?: string;
  name?: string;
  avatar?: string;
  playerCount?: number;
  slotIndex?: number;
  inviteId?: string;
  reinvite?: boolean;
  ts?: number;
  cover?: string | null;
}

export interface GameSnapshot {
  gameId: string;
  players: Player[];
  currentPlayer: number;
  diceValue: number;
  gameStarted: boolean;
  gameEnded: boolean;
  winners: Player[];
  selectedPlayerCount: number;
  consecutiveSixes?: Record<number, number>;
  myPlayerIndex?: number;
  playersSeq?: number;
  stateVersion?: number;
  lastActionType?: string;
}

// ---- Server-hosted games (see server/sockets/ludo/host.js) ----------------

export type SeatKind = 'human' | 'bot' | 'local' | 'open';

export interface ServerPiece {
  id: number;
  color: string;
  steps: number;
  isHome: boolean;
  isInPlay: boolean;
}

export interface ServerPlayer {
  id: number;
  seat: number;
  kind: SeatKind;
  name: string;
  color: string;
  colorName?: string;
  avatar?: string | null;
  cover?: string | null;
  profileId?: string | null;
  isHost?: boolean;
  isBot?: boolean;
  isLocal?: boolean;
  isOpen?: boolean;
  online?: boolean;
  isOffline?: boolean;
  invited?: { profileId: string; name?: string; avatar?: string | null } | null;
  rank?: number | null;
  finished?: boolean;
  pieces: ServerPiece[];
}

export interface ServerAction {
  id: number;
  at?: number;
  type: string;
  seat?: number;
  value?: number;
  piece?: number;
  from?: number;
  to?: number;
  dice?: number;
  captures?: { seat: number; piece: number; from?: number }[];
  finished?: boolean;
  won?: boolean;
  rank?: number | null;
  keepTurn?: boolean;
  forfeit?: boolean;
  noMove?: boolean;
  again?: boolean;
  auto?: boolean;
  profileId?: string;
}

export interface ServerSeatSummary {
  id: number;
  seat: number;
  name?: string;
  color: string;
  avatar?: string | null;
  profileId?: string | null;
  rank?: number | null;
}

export interface ServerState {
  gameId: string;
  epoch?: string;
  version: number;
  serverTs?: number;
  hostId: string;
  mode: 'online' | 'computer' | 'local';
  status: 'lobby' | 'playing' | 'ended';
  playerCount: number;
  selectedPlayerCount: number;
  maxSteps: number;
  pathLength: number;
  stepMs: number;
  gameStarted: boolean;
  gameEnded: boolean;
  currentPlayer: number;
  phase: 'roll' | 'move' | 'busy' | 'idle';
  diceValue: number;
  movable: number[];
  sixes?: number;
  players: ServerPlayer[];
  winners: ServerSeatSummary[];
  standings: ServerSeatSummary[];
  paused: boolean;
  pausedAt?: number | null;
  pausedBy?: { profileId?: string; name?: string } | null;
  lastAction?: ServerAction | null;
}

export interface GameSummary {
  gameId: string;
  status: 'lobby' | 'playing' | 'ended';
  mode: 'online' | 'computer' | 'local';
  hostId: string;
  isHost: boolean;
  mySeat: number;
  playerCount: number;
  paused: boolean;
  currentPlayer: number;
  progress: number;
  updatedAt?: number;
  players: { seat: number; kind: SeatKind; name?: string; avatar?: string | null; color: string; online?: boolean }[];
}

export interface LudoResult {
  ok: boolean;
  error?: string;
  message?: string;
  gameId?: string;
  state?: ServerState;
  seat?: number;
  canJoin?: boolean;
  invite?: LudoInvite | null;
  removed?: boolean;
  sent?: number;
  games?: GameSummary[];
  invites?: LudoInvite[];
}
