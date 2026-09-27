/// <reference types="jest" />

import { DEFAULT_TOOL_ORDER } from '../src/screens/recovery/content';
import {
  buildCalendar,
  cleanPhone,
  cravingsByHourBin,
  daysSince,
  daysUntil,
  emptyPlan,
  hasPersonalOrder,
  lapseTime,
  localDayKey,
  orderTools,
  parseNumber,
  quitDateFor,
  topTriggers,
  withIfThen,
} from '../src/screens/recovery/helpers';

// Local-time dates so the tests pass in any timezone.
const now = new Date(2026, 8, 27, 15, 30, 0);

describe('quit dates', () => {
  it('stops now, or on an earlier day when already stopped', () => {
    expect(quitDateFor('now', {}, now)).toBe(now.toISOString());
    expect(quitDateFor('now', { daysAgo: 3 }, now)).toBe(new Date(2026, 8, 24).toISOString());
  });

  it('puts future quit dates at local midnight, at least tomorrow', () => {
    expect(quitDateFor('date', { daysAhead: 5 }, now)).toBe(new Date(2026, 9, 2).toISOString());
    expect(quitDateFor('doctor', { daysAhead: 0 }, now)).toBe(new Date(2026, 8, 28).toISOString());
  });

  it('round-trips days until and since', () => {
    expect(daysUntil(quitDateFor('date', { daysAhead: 6 }, now), now)).toBe(6);
    expect(daysUntil(undefined, now)).toBe(1);
    expect(daysSince(quitDateFor('now', { daysAgo: 40 }, now), now)).toBe(40);
    expect(daysSince(new Date(2026, 9, 5).toISOString(), now)).toBe(0);
  });
});

describe('slip time', () => {
  it('never goes before the quit date or after now', () => {
    const quit = new Date(2026, 8, 27, 14, 0).toISOString();
    expect(lapseTime('now', quit, now)).toBe(now.toISOString());
    expect(lapseTime('yesterday', quit, now)).toBe(quit);
    expect(lapseTime('today', undefined, now)).toBe(new Date(2026, 8, 27, 13, 30).toISOString());
    expect(lapseTime('today', undefined, new Date(2026, 8, 27, 1, 0))).toBe(new Date(2026, 8, 27).toISOString());
  });
});

describe('SOS tools', () => {
  it('keeps the personal order and appends missing tools once', () => {
    const ordered = orderTools(['breathing', 'coach', 'breathing', 'unknown' as any]);
    expect(ordered.slice(0, 2)).toEqual(['breathing', 'coach']);
    expect([...ordered].sort()).toEqual([...DEFAULT_TOOL_ORDER].sort());
    expect(orderTools(undefined)).toEqual(DEFAULT_TOOL_ORDER);
  });

  it('knows when past sessions changed the order', () => {
    expect(hasPersonalOrder(DEFAULT_TOOL_ORDER)).toBe(false);
    expect(hasPersonalOrder(['reasons', ...DEFAULT_TOOL_ORDER])).toBe(true);
    expect(hasPersonalOrder([])).toBe(false);
  });
});

describe('progress', () => {
  it('bins cravings by local hour and counts triggers', () => {
    const at = (hour: number) => new Date(2026, 8, 20, hour, 10).toISOString();
    expect(cravingsByHourBin([{ at: at(1) }, { at: at(22) }, { at: at(23) }, { at: 'bad' }])).toEqual([1, 0, 0, 0, 0, 2]);
    expect(topTriggers([{ trigger: 'stress' }, { triggers: ['stress', 'friends'] }, { trigger: '' }])).toEqual([
      ['stress', 2],
      ['friends', 1],
    ]);
  });

  it('marks clean, slip and missing days, oldest first', () => {
    const today = localDayKey(now);
    const yesterday = localDayKey(new Date(2026, 8, 26));
    const twoAgo = localDayKey(new Date(2026, 8, 25));
    const calendar = buildCalendar(
      3,
      [
        { day: today, used: [] },
        { day: yesterday, used: [{ substance: 'yaba', amount: 1 }] },
      ],
      [],
      now,
    );
    expect(calendar).toEqual([
      { day: twoAgo, state: 'none' },
      { day: yesterday, state: 'slip' },
      { day: today, state: 'clean' },
    ]);
    expect(buildCalendar(1, [], [today], now)[0].state).toBe('slip');
  });
});

describe('plan and input helpers', () => {
  it('adds an if-then plan once, even without a plan', () => {
    const item = { trigger: 'Friends at the tea stall', action: 'Say my line and walk home' };
    const plan = withIfThen(null, item);
    expect(plan.ifThen).toEqual([item]);
    expect(withIfThen(plan, { ...item, action: ' Say my line and walk home ' }).ifThen).toHaveLength(1);
    expect(withIfThen(emptyPlan(), { trigger: 'x', action: '' }).ifThen).toHaveLength(0);
  });

  it('cleans phone numbers and parses Bangla digits', () => {
    expect(cleanPhone('+880 17-1234abc')).toBe('+880 17-1234');
    expect(parseNumber('১৫০')).toBe(150);
    expect(parseNumber('12.5 tk')).toBe(12.5);
    expect(parseNumber('')).toBe(0);
  });
});
