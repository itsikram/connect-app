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
}

export interface CaptureHit {
  playerIndex: number;
  pieceIndex: number;
}

export interface FriendUser {
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
