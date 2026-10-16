// Turns the server's `ludo:state` stream into what the board shows: token
// positions that hop square by square when a piece moves, a dice that tumbles
// and lands, and sound/effect events. The server's state is the truth; this
// only paces how it appears. The web app has a copy of this file
// (web/src/pages/ludo/utils/stateFeed.js); keep them in step.
import type { ServerAction, ServerState } from './types';

const LOCAL_TUMBLE_MS = 450; // own roll: at least this long before landing
const REMOTE_TUMBLE_MS = 450;
const ROLL_REQUEST_TIMEOUT_MS = 5000;
const DICE_HOLD_MS = 1800; // a landed face stays up at least this long

export interface DiceView {
  rolling: boolean;
  value: number;
  seat: number;
  since: number;
  heldUntil: number;
  pendingLocal: boolean;
  showing: boolean;
}

export interface FeedSnapshot {
  state: ServerState | null;
  pieces: number[][];
  moving: { seat: number; piece: number } | null;
  dice: DiceView;
  animating: boolean;
}

export type FeedEvent =
  | 'diceRoll'
  | 'rolledSix'
  | 'threeSixes'
  | 'pieceOut'
  | 'pieceMove'
  | 'capture'
  | 'win'
  | 'turnChange';

type Timer = ReturnType<typeof setTimeout>;

const piecesOf = (state: ServerState | null): number[][] =>
  (state?.players || []).map((player) => (player.pieces || []).map((piece) => Number(piece.steps) || 0));

const clonePieces = (pieces: number[][]) => (pieces || []).map((list) => [...list]);

export const createStateFeed = ({
  onChange,
  onEvent,
  now = () => Date.now(),
}: {
  onChange?: () => void;
  onEvent?: (kind: FeedEvent, detail?: any) => void;
  now?: () => number;
} = {}) => {
  let state: ServerState | null = null;
  let pieces: number[][] = [];
  let moving: { seat: number; piece: number } | null = null;
  let moveTimers: Timer[] = [];
  let lastActionId: number | null = null;
  const dice = { rolling: false, value: 0, seat: 0, since: 0, heldUntil: 0, pendingLocal: false };
  let diceTimers: Timer[] = [];
  let disposed = false;

  const emit = (kind: FeedEvent, detail?: any) => {
    try {
      onEvent?.(kind, detail);
    } catch (_e) {}
  };
  const changed = () => {
    if (!disposed) onChange?.();
  };
  const clearMoveTimers = () => {
    moveTimers.forEach((t) => clearTimeout(t));
    moveTimers = [];
  };
  const clearDiceTimers = () => {
    diceTimers.forEach((t) => clearTimeout(t));
    diceTimers = [];
  };
  const later = (list: Timer[], ms: number, fn: () => void) => {
    const timer = setTimeout(() => {
      if (!disposed) fn();
    }, Math.max(0, ms));
    list.push(timer);
    return timer;
  };

  const settle = () => {
    clearMoveTimers();
    moving = null;
    pieces = piecesOf(state);
  };

  const landDice = (value: number, seat: number, forfeit?: boolean) => {
    dice.rolling = false;
    dice.pendingLocal = false;
    dice.value = value;
    dice.seat = seat;
    dice.heldUntil = now() + DICE_HOLD_MS;
    if (forfeit) emit('threeSixes');
    else if (value === 6) emit('rolledSix');
    later(diceTimers, DICE_HOLD_MS + 20, changed);
    changed();
  };

  const showRoll = (action: ServerAction) => {
    clearDiceTimers();
    const value = Number(action.value) || 0;
    const seat = Number(action.seat) || 0;
    if (dice.rolling) {
      const elapsed = now() - dice.since;
      later(diceTimers, LOCAL_TUMBLE_MS - elapsed, () => landDice(value, seat, action.forfeit));
      return;
    }
    dice.rolling = true;
    dice.since = now();
    dice.seat = seat;
    emit('diceRoll');
    later(diceTimers, REMOTE_TUMBLE_MS, () => landDice(value, seat, action.forfeit));
    changed();
  };

  const animateMove = (action: ServerAction, previous: ServerState | null) => {
    clearMoveTimers();
    const seat = Number(action.seat);
    const piece = Number(action.piece);
    const from = Number(action.from) || 0;
    const to = Number(action.to) || 0;
    const stepMs = Math.max(30, Number(state?.stepMs) || 150);
    pieces = previous ? piecesOf(previous) : clonePieces(pieces);
    if (!pieces[seat]) {
      settle();
      return;
    }
    pieces[seat][piece] = from;
    moving = { seat, piece };
    const path: number[] = [];
    if (from <= 0) path.push(1);
    else for (let s = from + 1; s <= to; s += 1) path.push(s);
    if (!path.length) path.push(to);

    path.forEach((square, index) => {
      later(moveTimers, index * stepMs, () => {
        pieces = clonePieces(pieces);
        pieces[seat][piece] = square;
        emit(from <= 0 && index === 0 ? 'pieceOut' : 'pieceMove');
        changed();
      });
    });
    later(moveTimers, path.length * stepMs, () => {
      const captures = Array.isArray(action.captures) ? action.captures : [];
      if (captures.length) {
        pieces = clonePieces(pieces);
        captures.forEach((hit) => {
          if (pieces[hit.seat]) pieces[hit.seat][hit.piece] = 0;
        });
        emit('capture', { captures });
      }
      if (action.won) emit('win', { seat });
      moving = null;
      later(moveTimers, captures.length ? 120 : 0, () => {
        settle();
        changed();
      });
      changed();
    });
    changed();
  };

  const push = (next: ServerState | null | undefined) => {
    if (!next || disposed) return;
    const previous = state;
    // A new epoch is the same game reloaded on the server: take it as-is.
    const sameGame = Boolean(previous && previous.gameId === next.gameId && previous.epoch === next.epoch);
    if (sameGame && Number(next.version) <= Number(previous!.version)) return;
    state = next;

    const action = next.lastAction;
    const isNewAction = Boolean(action && action.id !== lastActionId && sameGame);
    if (action) lastActionId = action.id;

    if (!sameGame) {
      clearDiceTimers();
      dice.rolling = false;
      dice.pendingLocal = false;
      dice.value = next.phase === 'move' ? Number(next.diceValue) || 0 : 0;
      dice.seat = Number(next.currentPlayer) || 0;
      dice.heldUntil = 0;
      settle();
      changed();
      return;
    }

    if (isNewAction && action!.type === 'move') {
      if (Number(next.version) - Number(previous!.version) > 3) settle();
      else animateMove(action!, previous);
    } else if (!moving) {
      pieces = piecesOf(next);
    }

    if (isNewAction) {
      if (action!.type === 'roll') showRoll(action!);
      else if (
        action!.type === 'turn' &&
        !action!.again &&
        Number(action!.seat) !== Number(previous!.currentPlayer)
      ) {
        emit('turnChange');
      }
    }
    if (dice.pendingLocal && (next.phase !== 'roll' || next.paused)) {
      if (!(isNewAction && action!.type === 'roll')) {
        dice.rolling = false;
        dice.pendingLocal = false;
      }
    }
    changed();
  };

  const beginLocalRoll = (seat: number) => {
    clearDiceTimers();
    dice.rolling = true;
    dice.pendingLocal = true;
    dice.since = now();
    dice.seat = seat;
    emit('diceRoll');
    later(diceTimers, ROLL_REQUEST_TIMEOUT_MS, () => {
      if (dice.pendingLocal) {
        dice.rolling = false;
        dice.pendingLocal = false;
        changed();
      }
    });
    changed();
  };

  const cancelLocalRoll = () => {
    if (!dice.pendingLocal) return;
    clearDiceTimers();
    dice.rolling = false;
    dice.pendingLocal = false;
    changed();
  };

  const snapshot = (): FeedSnapshot => {
    const t = now();
    const showing =
      dice.rolling ||
      (dice.value > 0 &&
        (t < dice.heldUntil ||
          Boolean(state && state.currentPlayer === dice.seat && (state.phase === 'move' || state.phase === 'busy'))));
    return { state, pieces, moving, dice: { ...dice, showing }, animating: Boolean(moving) };
  };

  const dispose = () => {
    disposed = true;
    clearMoveTimers();
    clearDiceTimers();
  };

  return { push, beginLocalRoll, cancelLocalRoll, snapshot, dispose, getState: () => state };
};
