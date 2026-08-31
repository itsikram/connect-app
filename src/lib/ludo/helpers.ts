import { HOME_COLUMN_LENGTH, PATHS } from './constants';
import type { Piece, Player, Position } from './types';

export const getBoardSeatIndex = (playerIndex: number, playerCount: number) =>
  Number(playerCount) === 2 && Number(playerIndex) === 1
    ? 3
    : Number(playerIndex);

export const getPlayerIndexForBoardSeat = (
  boardSeatIndex: number,
  playerCount: number,
): number | null => {
  if (Number(playerCount) === 2) {
    if (Number(boardSeatIndex) === 0) return 0;
    if (Number(boardSeatIndex) === 3) return 1;
    return null;
  }
  return Number(boardSeatIndex) < Number(playerCount)
    ? Number(boardSeatIndex)
    : null;
};

export const isHumanLudoProfileId = (profileId?: string | null) => {
  if (profileId == null || profileId === '') return false;
  const value = String(profileId);
  return value !== 'local' && !value.startsWith('bot-');
};

export const isLobbySeatOccupied = (seat: Player | undefined, seatIndex: number) => {
  if (Number(seatIndex) === 0) return true;
  if (seat?.isBot) return true;
  return isHumanLudoProfileId(seat?.profileId);
};

export const countOccupiedLobbySeats = (seats: Player[], maxPlayers: number) => {
  const max = Math.max(2, Math.min(4, Number(maxPlayers) || 2));
  let filled = 0;
  for (let i = 0; i < max; i++) {
    if (isLobbySeatOccupied(seats?.[i], i)) filled += 1;
  }
  return filled;
};

export const applyPieceLifecycle = (
  piece: Piece,
  steps: number,
  maxStepsValue: number,
): Piece => {
  const safeSteps = Number.isFinite(Number(steps))
    ? Math.max(0, Math.trunc(Number(steps)))
    : 0;
  piece.steps = safeSteps;
  piece.isHome = safeSteps === 0;
  piece.isInPlay = safeSteps > 0 && safeSteps < maxStepsValue;
  return piece;
};

export const isHomeColumnSteps = (steps: number, maxStepsValue: number) => {
  const homeStart = maxStepsValue - (HOME_COLUMN_LENGTH - 1);
  return steps >= homeStart && steps <= maxStepsValue;
};

export const generateGameId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const clonePlayers = (players: Player[]): Player[] =>
  (players || []).map((p) => ({
    ...p,
    pieces: Array.isArray(p.pieces) ? p.pieces.map((pc) => ({ ...pc })) : [],
  }));

export const getRenderPlayerOrder = (selectedPlayerCount: number) =>
  selectedPlayerCount === 4
    ? [0, 1, 3, 2]
    : [0, 1, 2].slice(0, selectedPlayerCount);

export const getTokenOffset = (
  index: number,
  count: number,
  cellSize: number,
): Position => {
  const delta = Math.round(cellSize * 0.35);
  if (count <= 1) return { x: 0, y: 0 };
  if (count === 2) {
    const dx = index === 0 ? -delta / 2 : delta / 2;
    return { x: Math.round(dx), y: 0 };
  }
  if (count === 3) {
    const positions = [
      { x: -delta / 2, y: -delta / 2 },
      { x: delta / 2, y: -delta / 2 },
      { x: 0, y: delta / 2 },
    ];
    const pos = positions[index] || { x: 0, y: 0 };
    return { x: Math.round(pos.x), y: Math.round(pos.y) };
  }
  const grid = [
    { x: -delta / 2, y: -delta / 2 },
    { x: delta / 2, y: -delta / 2 },
    { x: -delta / 2, y: delta / 2 },
    { x: delta / 2, y: delta / 2 },
  ];
  const pos = grid[index % 4];
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
};

export const getPathForPlayer = (playerIndex: number, playerCount: number) =>
  PATHS[getBoardSeatIndex(playerIndex, playerCount)] || PATHS[0];
