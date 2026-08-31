import { DEFAULT_MAX_STEPS, HOME_COLUMN_LENGTH, PATHS } from './constants';
import { getBoardSeatIndex } from './helpers';
import type { CaptureHit, Piece, Player, Position } from './types';

export const getPositionOnPath = (
  playerIndex: number,
  steps: number,
  playerCount = 4,
): Position => {
  const boardSeatIndex = getBoardSeatIndex(playerIndex, playerCount);
  const path = PATHS[boardSeatIndex];
  if (!path || steps <= 0 || steps > path.length) {
    return { x: 7, y: 7 };
  }
  return path[steps - 1];
};

const homeColumnCells = (): string[] => {
  const cells: string[] = [];
  Object.values(PATHS).forEach((path) => {
    if (!Array.isArray(path)) return;
    path.slice(-HOME_COLUMN_LENGTH).forEach((p) => {
      cells.push(`${p.x},${p.y}`);
    });
  });
  return cells;
};

export const SAFE_CELLS = new Set([
  '1,6',
  '8,1',
  '6,13',
  '13,8',
  '7,13',
  '13,7',
  '7,2',
  '2,7',
  ...homeColumnCells(),
]);

export const isSafePosition = (_playerIndex: number, position: Position) =>
  SAFE_CELLS.has(`${position.x},${position.y}`);

export const getMaxSteps = () => {
  try {
    const len0 = Array.isArray(PATHS?.[0]) ? PATHS[0].length : undefined;
    return typeof len0 === 'number' && len0 > 0 ? len0 : DEFAULT_MAX_STEPS;
  } catch {
    return DEFAULT_MAX_STEPS;
  }
};

export const getPieceSteps = (piece?: Piece | null) => {
  const steps = Number(piece?.steps);
  return Number.isFinite(steps) && steps > 0 ? steps : 0;
};

export const checkForCapture = (
  movingPlayerIndex: number,
  newPosition: Position,
  movingPieceNewSteps: number,
  players: Player[],
  maxSteps: number,
  playerCount = 4,
): CaptureHit[] => {
  const captured: CaptureHit[] = [];
  if (isHomeColumnSteps(movingPieceNewSteps, maxSteps)) return captured;

  const tokensAtPosition = new Map<number, number>();

  players.forEach((player, playerIndex) => {
    let count = 0;
    player.pieces.forEach((piece) => {
      if (piece.isInPlay) {
        if (piece.steps >= maxSteps) return;
        const piecePosition = getPositionOnPath(playerIndex, piece.steps, playerCount);
        if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
          count++;
        }
      }
    });
    if (count > 0) tokensAtPosition.set(playerIndex, count);
  });

  if (
    typeof movingPieceNewSteps === 'number' &&
    movingPieceNewSteps > 0 &&
    movingPieceNewSteps < maxSteps
  ) {
    const movingPiecePosition = getPositionOnPath(
      movingPlayerIndex,
      movingPieceNewSteps,
      playerCount,
    );
    if (
      movingPiecePosition.x === newPosition.x &&
      movingPiecePosition.y === newPosition.y
    ) {
      const movingPlayer = players[movingPlayerIndex];
      let alreadyCounted = false;
      if (movingPlayer && Array.isArray(movingPlayer.pieces)) {
        alreadyCounted = movingPlayer.pieces.some((piece) => {
          if (piece.isInPlay && piece.steps === movingPieceNewSteps) {
            const pos = getPositionOnPath(movingPlayerIndex, piece.steps, playerCount);
            return pos.x === newPosition.x && pos.y === newPosition.y;
          }
          return false;
        });
      }
      if (!alreadyCounted) {
        const currentCount = tokensAtPosition.get(movingPlayerIndex) || 0;
        tokensAtPosition.set(movingPlayerIndex, currentCount + 1);
      }
    }
  }

  const movingPlayerTokenCount = tokensAtPosition.get(movingPlayerIndex) || 0;

  tokensAtPosition.forEach((count, playerIndex) => {
    if (playerIndex === movingPlayerIndex) return;
    const player = players[playerIndex];
    let firstPieceAtPosition: Position | null = null;
    for (const piece of player.pieces) {
      if (piece.isInPlay && piece.steps < maxSteps) {
        const piecePosition = getPositionOnPath(playerIndex, piece.steps, playerCount);
        if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
          firstPieceAtPosition = piecePosition;
          break;
        }
      }
    }
    if (firstPieceAtPosition && isSafePosition(playerIndex, firstPieceAtPosition)) return;

    const shouldCapture =
      (movingPlayerTokenCount >= 2 && count === 2) ||
      (movingPlayerTokenCount === 1 && count === 1) ||
      (movingPlayerTokenCount >= 2 && count === 1);

    if (!shouldCapture) return;

    player.pieces.forEach((piece, pieceIndex) => {
      if (piece.isInPlay && piece.steps < maxSteps) {
        const piecePosition = getPositionOnPath(playerIndex, piece.steps, playerCount);
        if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
          captured.push({ playerIndex, pieceIndex });
        }
      }
    });
  });

  return captured;
};

export const checkForCaptureAfterMoveAway = (
  movingPlayerIndex: number,
  oldPosition: Position,
  players: Player[],
  maxSteps: number,
  playerCount = 4,
): CaptureHit[] => {
  const captured: CaptureHit[] = [];
  const tokensAtPosition = new Map<number, number>();

  players.forEach((player, playerIndex) => {
    let count = 0;
    player.pieces.forEach((piece) => {
      if (piece.isInPlay) {
        if (piece.steps >= maxSteps) return;
        const piecePosition = getPositionOnPath(playerIndex, piece.steps, playerCount);
        if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
          count++;
        }
      }
    });
    if (count > 0) tokensAtPosition.set(playerIndex, count);
  });

  tokensAtPosition.forEach((count, playerIndex) => {
    if (playerIndex === movingPlayerIndex) {
      if (count >= 2) {
        players.forEach((opponent, opponentIndex) => {
          if (opponentIndex === playerIndex) return;
          const opponentCount = tokensAtPosition.get(opponentIndex) || 0;
          if (opponentCount === 1) {
            opponent.pieces.forEach((piece, pieceIndex) => {
              if (piece.isInPlay && piece.steps < maxSteps) {
                const piecePosition = getPositionOnPath(opponentIndex, piece.steps, playerCount);
                if (
                  piecePosition.x === oldPosition.x &&
                  piecePosition.y === oldPosition.y &&
                  !isSafePosition(opponentIndex, piecePosition)
                ) {
                  captured.push({ playerIndex: opponentIndex, pieceIndex });
                }
              }
            });
          }
        });
      }
    } else if (count === 1) {
      const movingPlayerRemainingCount = tokensAtPosition.get(movingPlayerIndex) || 0;
      if (movingPlayerRemainingCount >= 2) {
        const player = players[playerIndex];
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps, playerCount);
            if (
              piecePosition.x === oldPosition.x &&
              piecePosition.y === oldPosition.y &&
              !isSafePosition(playerIndex, piecePosition)
            ) {
              captured.push({ playerIndex, pieceIndex });
            }
          }
        });
      }
    }
  });

  return captured;
};

export const getPlayablePieces = (
  playerIndex: number,
  diceVal: number,
  players: Player[],
  maxSteps: number,
) => {
  const playerData = players[playerIndex];
  if (!playerData || !Array.isArray(playerData.pieces)) return [] as number[];
  const playable: number[] = [];
  playerData.pieces.forEach((piece, pieceIndex) => {
    const steps = getPieceSteps(piece);
    if (steps <= 0) {
      if (diceVal === 6) playable.push(pieceIndex);
      return;
    }
    if (steps < maxSteps && steps + diceVal <= maxSteps) {
      playable.push(pieceIndex);
    }
  });
  return playable;
};

export const getNextActivePlayer = (
  fromIndex: number,
  selectedPlayerCount: number,
  players: Player[],
  winners: Player[],
) => {
  const baseOrder =
    selectedPlayerCount === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, selectedPlayerCount);
  if (baseOrder.length === 0) return fromIndex;
  let idx = baseOrder.indexOf(fromIndex);
  if (idx === -1) idx = 0;
  let attempts = 0;
  while (attempts < baseOrder.length) {
    idx = (idx + 1) % baseOrder.length;
    const candidate = baseOrder[idx];
    const player = players[candidate];
    const playerWon = winners.some((w) => w.id === candidate);
    const isOffline = player && player.isOffline && !player.isBot;
    if (!playerWon && !isOffline) return candidate;
    attempts++;
  }
  return fromIndex;
};

const homeColumnStart = (maxSteps: number) => Number(maxSteps) - (HOME_COLUMN_LENGTH - 1);

export const isHomeColumnSteps = (steps: number, maxSteps: number) => {
  const value = Number(steps) || 0;
  return value > 0 && value >= homeColumnStart(maxSteps);
};

const sameCell = (a?: Position | null, b?: Position | null) =>
  Boolean(a && b && a.x === b.x && a.y === b.y);

const destinationSteps = (fromSteps: number, diceVal: number, maxSteps: number) => {
  if (fromSteps <= 0) return diceVal === 6 ? 1 : 0;
  const next = fromSteps + Number(diceVal || 0);
  return next <= maxSteps ? next : -1;
};

const countOwnAtCell = (
  player: Player,
  playerIndex: number,
  cell: Position,
  skipPieceIndex: number,
  maxSteps: number,
  playerCount: number,
) => {
  if (!player || !Array.isArray(player.pieces) || !cell) return 0;
  return player.pieces.reduce((count, piece, pieceIndex) => {
    if (pieceIndex === skipPieceIndex) return count;
    const steps = getPieceSteps(piece);
    if (steps <= 0 || steps >= maxSteps) return count;
    return sameCell(getPositionOnPath(playerIndex, steps, playerCount), cell)
      ? count + 1
      : count;
  }, 0);
};

const opponentPiecesAtCell = (
  players: Player[],
  movingPlayerIndex: number,
  cell: Position,
  maxSteps: number,
  playerCount: number,
) => {
  const hits: Array<CaptureHit & { steps: number }> = [];
  if (!cell) return hits;
  (players || []).forEach((player, playerIndex) => {
    if (playerIndex === movingPlayerIndex || !Array.isArray(player?.pieces)) return;
    player.pieces.forEach((piece, pieceIndex) => {
      const steps = getPieceSteps(piece);
      if (steps <= 0 || steps >= maxSteps || isHomeColumnSteps(steps, maxSteps)) return;
      if (sameCell(getPositionOnPath(playerIndex, steps, playerCount), cell)) {
        hits.push({ playerIndex, pieceIndex, steps });
      }
    });
  });
  return hits;
};

const canCaptureAt = (
  players: Player[],
  movingPlayerIndex: number,
  cell: Position | null,
  toSteps: number,
  maxSteps: number,
  playerCount: number,
) => {
  if (!cell || toSteps <= 0 || toSteps >= maxSteps || isHomeColumnSteps(toSteps, maxSteps)) {
    return [] as Array<CaptureHit & { steps: number }>;
  }
  if (isSafePosition(movingPlayerIndex, cell)) return [];

  const hits = opponentPiecesAtCell(players, movingPlayerIndex, cell, maxSteps, playerCount);
  if (hits.length === 0) return [];

  const byPlayer = new Map<number, Array<CaptureHit & { steps: number }>>();
  hits.forEach((hit) => {
    const list = byPlayer.get(hit.playerIndex) || [];
    list.push(hit);
    byPlayer.set(hit.playerIndex, list);
  });

  const captured: Array<CaptureHit & { steps: number }> = [];
  byPlayer.forEach((list) => {
    const ownLandingStack =
      1 + countOwnAtCell(players[movingPlayerIndex], movingPlayerIndex, cell, -1, maxSteps, playerCount);
    if (list.length >= 2 && ownLandingStack < 2) return;
    captured.push(...list);
  });
  return captured;
};

const isCellThreatened = (
  players: Player[],
  ownerIndex: number,
  cell: Position,
  skipOwnerPieceIndex: number,
  maxSteps: number,
  playerCount: number,
) => {
  if (!cell || isSafePosition(ownerIndex, cell)) return false;
  const ownStack = countOwnAtCell(
    players[ownerIndex],
    ownerIndex,
    cell,
    skipOwnerPieceIndex,
    maxSteps,
    playerCount,
  );
  if (ownStack >= 1) return false;

  return (players || []).some((player, playerIndex) => {
    if (playerIndex === ownerIndex || !Array.isArray(player?.pieces)) return false;
    return player.pieces.some((piece) => {
      const from = getPieceSteps(piece);
      if (from <= 0 || from >= maxSteps || isHomeColumnSteps(from, maxSteps)) return false;
      for (let roll = 1; roll <= 6; roll += 1) {
        const to = from + roll;
        if (to > maxSteps || isHomeColumnSteps(to, maxSteps)) continue;
        if (sameCell(getPositionOnPath(playerIndex, to, playerCount), cell)) return true;
      }
      return false;
    });
  });
};

export const pickSmartBotPiece = (
  playableIds: number[],
  playerIndex: number,
  players: Player[],
  diceVal: number,
  maxSteps: number,
  playerCount = 4,
) => {
  const ids = Array.isArray(playableIds) ? playableIds : [];
  if (ids.length === 0) return 0;
  if (ids.length === 1) return ids[0];

  const pieces = players?.[playerIndex]?.pieces || [];
  const max = Number(maxSteps) || getMaxSteps();
  const roll = Number(diceVal) || 0;
  const homeStart = homeColumnStart(max);

  const inPlaySteps = pieces
    .map((piece) => getPieceSteps(piece))
    .filter((steps) => steps > 0 && steps < max);
  const inPlayCount = inPlaySteps.length;
  const yardCount = pieces.filter((piece) => getPieceSteps(piece) <= 0).length;
  const minInPlay = inPlayCount ? Math.min(...inPlaySteps) : 0;
  const maxInPlay = inPlayCount ? Math.max(...inPlaySteps) : 0;

  let bestId = ids[0];
  let bestScore = -Infinity;

  ids.forEach((id) => {
    const from = getPieceSteps(pieces[id]);
    const to = destinationSteps(from, roll, max);
    if (to < 0) return;

    const leavingYard = from <= 0;
    const dest = to > 0 ? getPositionOnPath(playerIndex, to, playerCount) : null;
    const fromCell = from > 0 ? getPositionOnPath(playerIndex, from, playerCount) : null;
    let score = 0;

    const captures = leavingYard
      ? []
      : canCaptureAt(players, playerIndex, dest, to, max, playerCount);
    if (captures.length > 0) {
      score += 1400 + captures.reduce((sum, hit) => sum + hit.steps * 3, 0);
    }

    if (to >= max) {
      score += 1100;
    } else if (to >= homeStart) {
      score += 240;
      if (from < homeStart) score += 180;
      score += (to - homeStart) * 30;
    }

    if (leavingYard && roll === 6) {
      if (inPlayCount === 0) score += 460;
      else if (inPlayCount === 1) score += 420;
      else if (inPlayCount === 2) score += 300;
      else score += 90;
    }

    if (!leavingYard && to < homeStart) {
      if (from === minInPlay) score += 160;
      if (from === maxInPlay && inPlayCount >= 2 && maxInPlay - minInPlay > 10) {
        score -= 110;
      }
      if (from === maxInPlay && inPlayCount === 1 && yardCount > 0 && roll === 6) {
        score -= 220;
      }
      score += Math.min(from, 18);
    }

    if (!leavingYard && fromCell && isCellThreatened(players, playerIndex, fromCell, id, max, playerCount)) {
      score += 240;
      if (to >= homeStart || (dest && isSafePosition(playerIndex, dest))) {
        score += 90;
      }
    }

    if (dest && to > 0 && to < max) {
      if (isSafePosition(playerIndex, dest) || to >= homeStart) score += 85;
      else if (isCellThreatened(players, playerIndex, dest, id, max, playerCount)) score -= 95;
      if (countOwnAtCell(players[playerIndex], playerIndex, dest, id, max, playerCount) >= 1) {
        score += 55;
      }
    }

    score += (Number(id) * 5 + roll) % 9;

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });

  return bestId;
};
