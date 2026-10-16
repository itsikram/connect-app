import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createStateFeed, type FeedEvent } from './stateFeed';
import type { LudoInvite, LudoResult, ServerState } from './types';

type Emit = (event: string, data: any, ack?: (...args: any[]) => void) => void;
type On = (event: string, callback: (...args: any[]) => void) => void;
type Off = (event: string, callback?: (...args: any[]) => void) => void;

/** emit() that resolves with the server's acknowledgement (or a timeout). */
export const useLudoRequest = (emit: Emit) =>
  useCallback(
    (event: string, payload: Record<string, any> = {}, timeoutMs = 12000) =>
      new Promise<LudoResult>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve({
            ok: false,
            error: 'timeout',
            message: "The game server didn't answer. Check your connection.",
          });
        }, timeoutMs);
        emit(event, payload, (result: LudoResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result || { ok: false, error: 'empty' });
        });
      }),
    [emit],
  );

export interface JoinInfo {
  status: 'joining' | 'ready' | 'not_found' | 'error';
  seat: number;
  canJoin: boolean;
  invite: LudoInvite | null;
  message?: string;
}

/**
 * One server-hosted game on screen: joins its room (again after every
 * reconnect), follows `ludo:state`, and exposes the player's actions.
 */
export const useServerGame = ({
  emit,
  on,
  off,
  isConnected,
  gameId,
  onEvent,
  onRemoved,
  onSeatReplaced,
}: {
  emit: Emit;
  on: On;
  off: Off;
  isConnected: boolean;
  gameId: string | null;
  onEvent?: (kind: FeedEvent, detail?: any) => void;
  onRemoved?: (payload: any) => void;
  onSeatReplaced?: (payload: any) => void;
}) => {
  const [, render] = useReducer((n: number) => n + 1, 0);
  const request = useLudoRequest(emit);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onRemovedRef = useRef(onRemoved);
  onRemovedRef.current = onRemoved;
  const onSeatReplacedRef = useRef(onSeatReplaced);
  onSeatReplacedRef.current = onSeatReplaced;

  const feedRef = useRef<ReturnType<typeof createStateFeed> | null>(null);
  if (!feedRef.current) {
    feedRef.current = createStateFeed({
      onChange: () => render(),
      onEvent: (kind, detail) => onEventRef.current?.(kind, detail),
    });
  }
  const feed = feedRef.current;
  useEffect(() => () => feed.dispose(), [feed]);

  const [joinInfo, setJoinInfo] = useState<JoinInfo>({ status: 'joining', seat: -1, canJoin: false, invite: null });

  useEffect(() => {
    if (!gameId) return undefined;
    const onState = (state: ServerState) => {
      if (state?.gameId === gameId) feed.push(state);
    };
    const onGameRemoved = (payload: any) => {
      if (payload?.gameId === gameId) onRemovedRef.current?.(payload);
    };
    const onReplaced = (payload: any) => {
      if (payload?.gameId === gameId) onSeatReplacedRef.current?.(payload);
    };
    on('ludo:state', onState);
    on('ludo:game:removed', onGameRemoved);
    on('ludo:seat:replaced', onReplaced);
    return () => {
      off('ludo:state', onState);
      off('ludo:game:removed', onGameRemoved);
      off('ludo:seat:replaced', onReplaced);
    };
  }, [gameId, on, off, feed]);

  const join = useCallback(async () => {
    if (!gameId) return null;
    const result = await request('ludo:join', { gameId });
    if (result?.ok) {
      if (result.state) feed.push(result.state);
      setJoinInfo({
        status: 'ready',
        seat: Number.isInteger(result.seat) ? (result.seat as number) : -1,
        canJoin: Boolean(result.canJoin),
        invite: result.invite || null,
      });
    } else if (result?.error === 'not_found') {
      setJoinInfo({ status: 'not_found', seat: -1, canJoin: false, invite: null });
    } else {
      setJoinInfo((prev) => ({
        ...prev,
        status: prev.status === 'ready' ? 'ready' : 'error',
        message: result?.message,
      }));
    }
    return result;
  }, [gameId, request, feed]);

  // Join when the board opens and after every reconnect.
  useEffect(() => {
    if (!gameId || !isConnected) return;
    join();
  }, [gameId, isConnected, join]);

  // Leaving the board keeps the seat; the server marks this player away.
  useEffect(
    () => () => {
      if (gameId) emit('ludo:board:closed', { gameId });
    },
    [gameId, emit],
  );

  const act = useCallback(
    (event: string, payload: Record<string, any> = {}) => request(event, { ...payload, gameId }),
    [request, gameId],
  );

  const actions = {
    join,
    accept: async (slotIndex?: number) => {
      const result = await act('ludo:accept', Number.isInteger(slotIndex) ? { slotIndex } : {});
      if (result?.ok) {
        if (result.state) feed.push(result.state);
        setJoinInfo({ status: 'ready', seat: result.seat ?? -1, canJoin: false, invite: null });
      }
      return result;
    },
    decline: () => act('ludo:invites:dismiss'),
    roll: async (seat: number, value?: number) => {
      feed.beginLocalRoll(seat);
      const result = await act('ludo:roll', Number.isInteger(value) ? { value } : {});
      if (!result?.ok) feed.cancelLocalRoll();
      return result;
    },
    move: (pieceIndex: number) => act('ludo:move', { pieceIndex }),
    pause: (name?: string) => act('ludo:pause', { name }),
    resume: () => act('ludo:resume'),
    start: () => act('ludo:start'),
    invite: (to: string, slotIndex?: number) => act('ludo:invite', { to, slotIndex }),
    reinvite: () => act('ludo:reinvite'),
    replaceWithComputer: (playerIndex: number) => act('ludo:replace:bot', { playerIndex }),
    updateSeat: (playerIndex: number, seat: { name?: string; avatar?: string }) =>
      act('ludo:seat:update', { playerIndex, ...seat }),
    leave: () => act('ludo:leave'),
    reload: async () => {
      const result = await act('ludo:state:get');
      if (result?.ok && result.state) feed.push(result.state);
      return result;
    },
  };

  return { snapshot: feed.snapshot(), joinInfo, actions, request };
};
