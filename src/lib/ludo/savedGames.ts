/**
 * Offline (local / vs computer) Ludo games saved on this device so they can
 * be resumed later. Online games are saved on the server instead.
 *
 * Entries are kept per account so a shared device never mixes players' games.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Player } from './types';

const STORAGE_KEY = 'ludo_saved_local_games';
const MAX_SAVES = 10;

export interface LocalSave {
  id: string;
  owner?: string;
  savedAt?: number;
  paused: boolean;
  players: Player[];
  currentPlayer: number;
  diceValue: number;
  selectedPlayerCount: number;
  playWithComputer: boolean;
  consecutiveSixes: Record<number, number>;
  winners: Player[];
}

const readAll = async (): Promise<LocalSave[]> => {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
};

// Writes are chained so quick successive autosaves never interleave.
let writeChain: Promise<unknown> = Promise.resolve();
const update = (fn: (saves: LocalSave[]) => LocalSave[]) => {
  writeChain = writeChain
    .then(async () => {
      const next = fn(await readAll());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    })
    .catch(() => {});
  return writeChain;
};

const ownerKey = (profileId?: string | null) => String(profileId || 'guest');

export const createLocalSaveId = () =>
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const listLocalSaves = async (profileId?: string | null) => {
  await writeChain;
  return (await readAll())
    .filter((save) => save?.owner === ownerKey(profileId) && Array.isArray(save.players))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
};

export const upsertLocalSave = (profileId: string | null | undefined, save: LocalSave) => {
  if (!save?.id) return Promise.resolve();
  const owner = ownerKey(profileId);
  return update((all) => {
    const others = all.filter((entry) => entry?.id !== save.id);
    const mine = others.filter((entry) => entry?.owner === owner);
    const notMine = others.filter((entry) => entry?.owner !== owner);
    const keptMine = [{ ...save, owner, savedAt: Date.now() }, ...mine]
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      .slice(0, MAX_SAVES);
    return [...notMine, ...keptMine];
  });
};

export const removeLocalSave = (saveId?: string | null) => {
  if (!saveId) return Promise.resolve();
  return update((all) => all.filter((entry) => entry?.id !== saveId));
};

// Share of all tokens' journey completed, for the saved-game list.
export const getSaveProgress = (save: { players?: Player[] }, maxSteps: number) => {
  const pieces = (save?.players || []).flatMap((p) => p?.pieces || []);
  if (!pieces.length || !maxSteps) return 0;
  const total = pieces.reduce(
    (sum, pc: any) => sum + Math.min(maxSteps, Math.max(0, Number(pc?.steps) || 0)),
    0,
  );
  return Math.round((total / (pieces.length * maxSteps)) * 100);
};
