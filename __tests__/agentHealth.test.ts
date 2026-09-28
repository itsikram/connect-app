/// <reference types="jest" />

import {
  planHealthAction,
  summarizeFitnessDashboard,
  summarizeRecoveryDashboard,
  toClockTime,
  toMoodScore,
} from '../src/services/agentHealth';
import { executeAgentActions, parseAgentIntent } from '../src/services/agentActionCatalog';

const at = new Date('2026-09-27T13:00:00');

describe('fitness actions', () => {
  it('logs a meal with estimated nutrition and a sensible meal type', () => {
    const plan = planHealthAction('LOG_MEAL', {
      name: 'Rice and chicken curry',
      calories: '650',
      proteinG: 32,
      carbsG: 80,
      fatG: 20,
    }, { now: at });
    expect(plan).toMatchObject({
      kind: 'request',
      method: 'post',
      url: '/fitness/meals',
      body: { name: 'Rice and chicken curry', calories: 650, mealType: 'lunch', source: 'gemini' },
    });
  });

  it('asks for calories instead of logging a meal blindly', () => {
    expect(() => planHealthAction('LOG_MEAL', { name: 'Biryani' })).toThrow(/calories/i);
  });

  it('converts pounds, glasses and clock words', () => {
    expect(planHealthAction('LOG_WEIGHT', { weightLb: 154 })).toMatchObject({ body: { weightKg: 69.9 } });
    expect(planHealthAction('LOG_WATER', { glasses: 2 })).toMatchObject({ body: { addWaterMl: 500 } });
    expect(planHealthAction('LOG_WATER', {})).toMatchObject({ body: { addWaterMl: 250 } });
    expect(toClockTime('7pm')).toBe('19:00');
    expect(toClockTime('7:30 AM')).toBe('07:30');
    expect(toClockTime('সন্ধ্যা ৭টা')).toBe('19:00');
    expect(toClockTime('21:15')).toBe('21:15');
  });

  it('logs workouts and reminders with valid values only', () => {
    expect(planHealthAction('LOG_WORKOUT', { type: 'running', durationMin: 30 })).toMatchObject({
      body: { name: 'Running', type: 'running', intensity: 'moderate', durationMin: 30 },
    });
    expect(() => planHealthAction('LOG_WORKOUT', { type: 'yoga' })).toThrow(/minutes/);
    expect(planHealthAction('FITNESS_REMINDER', { type: 'water', time: '10am' })).toMatchObject({
      body: { title: 'Drink water', type: 'water', time: '10:00' },
    });
  });

  it('summarises the fitness dashboard', () => {
    const text = summarizeFitnessDashboard({
      profile: { targetCalories: 2000, macros: { proteinG: 120 }, waterTargetMl: 2500 },
      totals: { calories: 1200, proteinG: 70 },
      habits: { waterMl: 1500, steps: 6000 },
      streak: 4,
    });
    expect(text).toContain('1200 of 2000 kcal (800 left)');
    expect(text).toContain('Water: 1500 of 2500 ml');
    expect(text).toContain('Steps: 6000');
    expect(summarizeFitnessDashboard({ profile: null })).toMatch(/not set up/);
  });
});

describe('recovery actions', () => {
  it('turns mood words into a check-in', () => {
    expect(toMoodScore('মন খারাপ')).toBe(2);
    expect(toMoodScore('very good')).toBe(5);
    expect(planHealthAction('RECOVERY_CHECKIN', { mood: 'okay', craving: 4, triggers: ['stress', 'nonsense'] })).toMatchObject({
      url: '/recovery/checkins',
      body: { mood: 3, craving: 4, triggers: ['stress'] },
    });
    expect(() => planHealthAction('RECOVERY_CHECKIN', { mood: 3 })).toThrow(/craving/i);
  });

  it('never records a slip by itself — it opens the guided screen', () => {
    expect(planHealthAction('LOG_LAPSE', {})).toMatchObject({
      kind: 'navigate',
      params: { screen: 'RecoveryLapse' },
    });
  });

  it('opens Help when the coach reports a crisis', () => {
    const plan = planHealthAction('ASK_RECOVERY_COACH', { message: 'I feel hopeless' });
    if (plan.kind !== 'request') throw new Error('expected a request');
    const data = {
      reply: 'I am here with you.',
      crisis: { message: 'Please reach out now.', helplines: [{ name: 'Kaan Pete Roi', phone: '09612-119911' }] },
    };
    expect(plan.format(data)).toContain('Kaan Pete Roi: 09612-119911');
    expect(plan.thenOpen?.(data)).toEqual(['Menu', { screen: 'RecoveryHelp' }]);
    expect(plan.thenOpen?.({ reply: 'ok' })).toBeNull();
  });

  it('summarises recovery progress', () => {
    const text = summarizeRecoveryDashboard({
      substances: [{ name: 'Smoking', currentStreakDays: 12 }],
      totals: { moneySaved: 1440, cravingsResisted: 9, checkinStreak: 5 },
      today: { checkin: null },
    });
    expect(text).toContain('Smoking: 12 days free');
    expect(text).toContain('৳1440');
    expect(text).toContain("Today's check-in: not yet");
  });
});

describe('agent wiring', () => {
  it('accepts fitness names from the server tool list', () => {
    const parsed = parseAgentIntent('{"actions":[{"action":"LOG_FITNESS_WEIGHT","parameters":{"weightKg":70}}]}');
    expect(parsed.ok && parsed.intent.actions?.[0].action).toBe('LOG_WEIGHT');
  });

  it('runs health actions through the adapter', async () => {
    const runHealthAction = jest.fn(async () => 'Added 250 ml of water.');
    const [result] = await executeAgentActions(
      [{ action: 'LOG_WATER', parameters: { glasses: 1 } }],
      { runHealthAction },
      { skipConfirmation: true },
    );
    expect(result).toMatchObject({ ok: true, message: 'Added 250 ml of water.' });
    expect(runHealthAction).toHaveBeenCalledWith('LOG_WATER', { glasses: 1 });
  });
});
