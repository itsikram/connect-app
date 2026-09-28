import type { Approach, Checkin, CravingInput, RecoveryPlan, ToolKey } from '../../services/recoveryApi';
import { DEFAULT_TOOL_ORDER } from './content';

// Pure helpers shared by the Recovery screens (kept free of React so they can be unit tested).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local YYYY-MM-DD for a date. */
export const localDayKey = (value: Date | number | string) => {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Local midnight `offsetDays` from today. */
export const startOfLocalDay = (offsetDays = 0, now = new Date()) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
};

/**
 * Quit date sent to the server.
 * - "now": right now, or `daysAgo` days back when the person already stopped.
 * - otherwise: local midnight `daysAhead` days from today.
 */
export const quitDateFor = (approach: Approach, { daysAhead = 1, daysAgo = 0 }: { daysAhead?: number; daysAgo?: number } = {}, now = new Date()) => {
  if (approach === 'now') {
    return daysAgo > 0 ? startOfLocalDay(-daysAgo, now).toISOString() : new Date(now).toISOString();
  }
  return startOfLocalDay(Math.max(1, daysAhead), now).toISOString();
};

/** Whole days between now and a future quit date (for pre-filling the day picker). */
export const daysUntil = (iso: string | undefined, now = new Date()) => {
  if (!iso) return 1;
  const diff = Math.round((startOfLocalDay(0, new Date(iso)).getTime() - startOfLocalDay(0, now).getTime()) / DAY_MS);
  return Math.min(14, Math.max(1, diff));
};

/** Whole days since a past quit date. */
export const daysSince = (iso: string | undefined, now = new Date()) => {
  if (!iso) return 0;
  return Math.max(0, Math.round((startOfLocalDay(0, now).getTime() - startOfLocalDay(0, new Date(iso)).getTime()) / DAY_MS));
};

/** SOS tools in the server's personal order, with any missing tools appended. */
export const orderTools = (order?: ToolKey[] | null): ToolKey[] => {
  const known = (order || []).filter((tool) => DEFAULT_TOOL_ORDER.includes(tool));
  return [...new Set([...known, ...DEFAULT_TOOL_ORDER])];
};

/** True when the personal ranking differs from the default, i.e. past SOS data moved a tool up. */
export const hasPersonalOrder = (order?: ToolKey[] | null) => !!order?.length && order[0] !== DEFAULT_TOOL_ORDER[0];

/** When a slip happened, never earlier than the quit date (the server rejects those). */
export const lapseTime = (when: 'now' | 'today' | 'yesterday', quitDate?: string, now = new Date()) => {
  const offsets = { now: 0, today: 2 * 60 * 60 * 1000, yesterday: DAY_MS };
  let at = now.getTime() - offsets[when];
  if (when === 'today') at = Math.max(at, startOfLocalDay(0, now).getTime());
  const floor = quitDate ? Date.parse(quitDate) : NaN;
  if (Number.isFinite(floor)) at = Math.max(at, floor);
  return new Date(Math.min(at, now.getTime())).toISOString();
};

/** Counts cravings into six 4-hour bins by local hour. */
export const cravingsByHourBin = (cravings: Array<Pick<CravingInput, 'at'>>) => {
  const bins = [0, 0, 0, 0, 0, 0];
  cravings.forEach((craving) => {
    const date = new Date(craving.at);
    if (!Number.isNaN(date.getTime())) bins[Math.floor(date.getHours() / 4)] += 1;
  });
  return bins;
};

/** Trigger counts, most common first. */
export const topTriggers = (items: Array<{ trigger?: string; triggers?: string[] }>, limit = 6) => {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const keys = item.triggers || (item.trigger ? [item.trigger] : []);
    keys.forEach((key) => key && counts.set(key, (counts.get(key) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
};

export type CalendarDay = { day: string; state: 'clean' | 'slip' | 'none' | 'future' };

/**
 * Last `days` days, oldest first. A day is a slip if a lapse was logged or the
 * check-in reported use; clean if there was a check-in without use.
 */
export const buildCalendar = (days: number, checkins: Array<Pick<Checkin, 'day' | 'used'>>, lapseDays: string[], now = new Date()): CalendarDay[] => {
  const slips = new Set(lapseDays);
  const byDay = new Map(checkins.map((checkin) => [checkin.day, checkin]));
  return Array.from({ length: days }, (_, index) => {
    const day = localDayKey(startOfLocalDay(index - days + 1, now));
    const checkin = byDay.get(day);
    const used = checkin?.used?.some((item) => item.amount > 0);
    return { day, state: slips.has(day) || used ? 'slip' : checkin ? 'clean' : 'none' };
  });
};

/** A plan object the server accepts, even when the person has none yet. */
export const emptyPlan = (): RecoveryPlan => ({
  summary: '',
  safetyNote: '',
  ifThen: [],
  tools: [],
  checklist: [],
  weeklyGoals: [],
  rewardIdea: '',
  rewardGoal: null,
  source: 'curated',
});

/** Adds an if-then plan unless the same action is already there. */
export const withIfThen = (plan: RecoveryPlan | null | undefined, item: { trigger: string; action: string }): RecoveryPlan => {
  const base = plan || emptyPlan();
  if (!item.action || base.ifThen.some((existing) => existing.action.trim() === item.action.trim())) return base;
  return { ...base, ifThen: [...base.ifThen, item].slice(-10) };
};

/** Toggles a chip; picking "none" clears the others and any real answer clears "none". */
export const toggleExclusive = (list: string[], key: string, noneKey = 'none') => {
  if (list.includes(key)) return list.filter((item) => item !== key);
  if (key === noneKey) return [noneKey];
  return [...list.filter((item) => item !== noneKey), key];
};

/** Keys from `picked` whose option is marked as a red flag. */
export const redFlagsIn = (picked: string[] = [], options: Array<{ key: string; redFlag?: unknown }> = []) =>
  picked.filter((key) => options.some((option) => option.key === key && option.redFlag));

/** Keeps only digits, "+", spaces and dashes in a typed phone number. */
export const cleanPhone = (value: string) => value.replace(/[^\d+\-\s()]/g, '').slice(0, 24);

/** Parses a typed number (accepts Bangla digits). */
export const parseNumber = (value: string) => {
  const latin = value.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit))).replace(/[^0-9.]/g, '');
  const number = Number(latin);
  return Number.isFinite(number) ? number : 0;
};
