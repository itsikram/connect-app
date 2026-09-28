/**
 * Fitness + Recovery actions for the AI Agent.
 *
 * Pure planning/formatting (no network) so it can be unit-tested: each agent
 * action becomes either an API request against /fitness or /recovery with a
 * formatter for the reply, or a screen to open. Inputs are validated and
 * normalised here (lb -> kg, glasses -> ml, "7pm" -> 19:00, mood words ->
 * 1-5) so the server only ever receives sensible values.
 */

export type HealthRequest = {
  kind: 'request';
  method: 'get' | 'post' | 'put';
  url: string;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  /** Turns the response body into a short, human reply. */
  format: (data: any) => string;
  /** Screen to open afterwards (e.g. Help after a crisis). */
  thenOpen?: (data: any) => [string, Record<string, unknown>?] | null;
};

export type HealthNavigate = {
  kind: 'navigate';
  route: string;
  params?: Record<string, unknown>;
  message: string;
};

export type HealthPlan = HealthRequest | HealthNavigate;

/** Every fitness / recovery action the agent understands. */
export const HEALTH_ACTIONS = [
  'FITNESS_SUMMARY',
  'LOG_MEAL',
  'LOG_WEIGHT',
  'LOG_WATER',
  'LOG_STEPS',
  'LOG_SLEEP',
  'LOG_WORKOUT',
  'FITNESS_REMINDER',
  'ASK_FITNESS_COACH',
  'FOOD_RECOMMENDATIONS',
  'FITNESS_PROGRESS',
  'RECOVERY_SUMMARY',
  'RECOVERY_CHECKIN',
  'LOG_CRAVING',
  'LOG_LAPSE',
  'ASK_RECOVERY_COACH',
  'RECOVERY_SOS',
  'RECOVERY_HELP',
] as const;
export type HealthActionName = (typeof HEALTH_ACTIONS)[number];
const HEALTH_SET = new Set<string>(HEALTH_ACTIONS);
export const isHealthAction = (name: string): name is HealthActionName =>
  HEALTH_SET.has(name);

/** Actions whose result is information the user asked for (read aloud). */
export const HEALTH_REPORT_ACTIONS = new Set<string>([
  'FITNESS_SUMMARY',
  'FOOD_RECOMMENDATIONS',
  'RECOVERY_SUMMARY',
]);
/** Coach answers are spoken as they are. */
export const HEALTH_COACH_ACTIONS = new Set<string>([
  'ASK_FITNESS_COACH',
  'ASK_RECOVERY_COACH',
]);

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const WORKOUT_TYPES = ['walking', 'running', 'cycling', 'strength', 'hiit', 'yoga', 'swimming', 'sports', 'cardio', 'other'];
const INTENSITIES = ['light', 'moderate', 'vigorous'];
const REMINDER_TYPES = ['meal', 'water', 'workout', 'weight', 'custom'];
const CRAVING_OUTCOMES = ['resisted', 'used', 'unsure'];
const RECOVERY_TRIGGERS = ['stress', 'boredom', 'loneliness', 'friends', 'tea_stall', 'after_meals', 'late_night', 'money', 'family_conflict', 'work_study', 'celebration', 'anger', 'sadness', 'cant_sleep', 'places', 'social_media'];

const text = (...values: unknown[]) => {
  for (const value of values) {
    const out = value === undefined || value === null ? '' : String(value).trim();
    if (out) return out;
  }
  return '';
};
const num = (...values: unknown[]) => {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    // Bangla digits count too; text without any digit is not a number.
    const digits = String(value)
      .replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
      .replace(/[^\d.-]/g, '');
    if (!/\d/.test(digits)) continue;
    const parsed = Number(digits);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
};
const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const oneOf = (value: unknown, options: string[], fallback: string) => {
  const key = String(value || '').trim().toLowerCase();
  return options.includes(key) ? key : fallback;
};
const fail = (message: string): never => {
  throw new Error(message);
};

/** "7pm", "7:30 PM", "19:30", "সন্ধ্যা ৭টা" -> "HH:mm" (or '' if unclear). */
export const toClockTime = (value: unknown) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
  const match = raw.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (!match) return '';
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3] || '';
  const evening = /pm|p\.m\.|বিকাল|বিকেল|সন্ধ্যা|রাত/.test(`${meridiem} ${raw}`);
  const morning = /am|a\.m\.|সকাল|ভোর/.test(`${meridiem} ${raw}`);
  if (evening && hours < 12) hours += 12;
  if (morning && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** Mood words (English/Bangla) or numbers -> 1..5. */
export const toMoodScore = (value: unknown) => {
  const direct = num(value);
  if (Number.isFinite(direct)) return Math.min(5, Math.max(1, Math.round(direct)));
  const word = String(value || '').toLowerCase();
  if (/very (bad|low)|terrible|awful|খুব খারাপ/.test(word)) return 1;
  if (/bad|low|sad|down|খারাপ|মন খারাপ/.test(word)) return 2;
  if (/okay|ok|fine|so.?so|মোটামুটি|ঠিক/.test(word)) return 3;
  if (/very good|great|amazing|excellent|খুব ভালো/.test(word)) return 5;
  if (/good|happy|well|ভালো/.test(word)) return 4;
  return NaN;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

// ── Formatters ───────────────────────────────────────────────────────────────

export const summarizeFitnessDashboard = (data: any) => {
  if (!data?.profile) return 'Your fitness profile is not set up yet.';
  const totals = data.totals || {};
  const profile = data.profile || {};
  const habits = data.habits || {};
  const target = Math.round(Number(profile.targetCalories) || 0);
  const eaten = Math.round(Number(totals.calories) || 0);
  const burned = Math.round(Number(data.burn?.caloriesBurned ?? data.burn?.total ?? data.burn) || 0);
  const proteinTarget = Math.round(Number(profile.macros?.proteinG) || 0);
  const waterTarget = Math.round(Number(profile.waterTargetMl) || 0);
  const parts = [
    target
      ? `Calories: ${eaten} of ${target} kcal (${Math.max(0, target - eaten)} left)`
      : `Calories: ${eaten} kcal`,
    `Protein: ${Math.round(Number(totals.proteinG) || 0)}${proteinTarget ? ` of ${proteinTarget}` : ''} g`,
    `Water: ${Math.round(Number(habits.waterMl) || 0)}${waterTarget ? ` of ${waterTarget}` : ''} ml`,
  ];
  if (Number(habits.steps)) parts.push(`Steps: ${Math.round(habits.steps)}`);
  if (burned > 0) parts.push(`Burned: ${burned} kcal`);
  if (Array.isArray(data.workouts) && data.workouts.length)
    parts.push(`Workouts today: ${data.workouts.length}`);
  if (Number(data.streak)) parts.push(`Streak: ${data.streak} days`);
  if (Number(data.currentWeightKg)) parts.push(`Weight: ${round(Number(data.currentWeightKg), 1)} kg`);
  return parts.join('\n');
};

export const summarizeRecommendations = (data: any) => {
  const items = Array.isArray(data?.recommendations) ? data.recommendations : [];
  if (!items.length) return data?.message || 'No food suggestions right now.';
  const lines = items.slice(0, 5).map((item: any) => {
    const name = text(item?.name, item?.title, item?.food, item);
    const kcal = Number(item?.calories);
    return `• ${name}${Number.isFinite(kcal) && kcal > 0 ? ` (${Math.round(kcal)} kcal)` : ''}`;
  });
  const remaining = Number(data?.remaining?.calories);
  return `${Number.isFinite(remaining) ? `You have about ${Math.round(remaining)} kcal left today. ` : ''}Good options:\n${lines.join('\n')}`;
};

export const summarizeRecoveryDashboard = (data: any) => {
  const substances: any[] = Array.isArray(data?.substances) ? data.substances : [];
  if (!substances.length) return 'Recovery is not set up yet.';
  const totals = data.totals || {};
  const lines = substances.map(substance => {
    const days = Math.round(Number(substance.currentStreakDays) || 0);
    return `• ${text(substance.name, substance.key)}: ${days} day${days === 1 ? '' : 's'} free`;
  });
  if (Number(totals.moneySaved)) lines.push(`Money saved: ৳${Math.round(totals.moneySaved)}`);
  if (Number(totals.cravingsResisted)) lines.push(`Cravings resisted: ${totals.cravingsResisted}`);
  if (Number(totals.checkinStreak)) lines.push(`Check-in streak: ${totals.checkinStreak} days`);
  lines.push(data?.today?.checkin ? "Today's check-in: done" : "Today's check-in: not yet");
  return lines.join('\n');
};

const formatCrisis = (crisis: any) => {
  if (!crisis) return '';
  const helplines = (Array.isArray(crisis.helplines) ? crisis.helplines : [])
    .slice(0, 3)
    .map((line: any) => `${text(line?.name, line?.label, line?.title)}: ${text(line?.phone, line?.number, line?.contact)}`)
    .filter((line: string) => !line.startsWith(':'));
  return [text(crisis.message), ...helplines].filter(Boolean).join('\n');
};

// ── Planner ──────────────────────────────────────────────────────────────────

/**
 * Plans one fitness/recovery action. Throws an Error with a user-facing
 * message when something required is missing or invalid.
 */
export const planHealthAction = (
  action: HealthActionName,
  parameters: Record<string, unknown> = {},
  { now = new Date(), clientId }: { now?: Date; clientId?: string } = {},
): HealthPlan => {
  const p = parameters;
  switch (action) {
    case 'FITNESS_SUMMARY':
      return {
        kind: 'request',
        method: 'get',
        url: '/fitness/dashboard',
        format: summarizeFitnessDashboard,
        thenOpen: data => (data?.profile ? null : ['Menu', { screen: 'FitnessOnboarding' }]),
      };

    case 'LOG_MEAL': {
      const name = text(p.name, p.food, p.meal, p.title);
      if (!name) fail('Tell me what you ate.');
      const calories = num(p.calories, p.kcal);
      if (!Number.isFinite(calories) || calories < 0 || calories > 5000)
        fail(`How many calories were in the ${name}?`);
      const macro = (value: unknown) => {
        const grams = num(value);
        return Number.isFinite(grams) && grams >= 0 && grams < 1000 ? round(grams, 1) : 0;
      };
      const mealType = oneOf(p.mealType, MEAL_TYPES, '') ||
        (now.getHours() < 11 ? 'breakfast' : now.getHours() < 16 ? 'lunch' : now.getHours() < 21 ? 'dinner' : 'snack');
      return {
        kind: 'request',
        method: 'post',
        url: '/fitness/meals',
        body: {
          name,
          mealType,
          calories: Math.round(calories),
          proteinG: macro(p.proteinG),
          carbsG: macro(p.carbsG),
          fatG: macro(p.fatG),
          fiberG: macro(p.fiberG),
          // Values the model estimated are marked as such.
          source: p.estimated === false ? 'manual' : 'gemini',
          date: now.toISOString(),
        },
        format: data => {
          const eaten = Math.round(Number(data?.totals?.calories) || 0);
          return `Logged ${name} (${Math.round(calories)} kcal) as ${mealType}.${eaten ? ` Today so far: ${eaten} kcal.` : ''}`;
        },
      };
    }

    case 'LOG_WEIGHT': {
      let weightKg = num(p.weightKg, p.kg);
      const pounds = num(p.weightLb, p.lb, p.lbs);
      if (!Number.isFinite(weightKg) && Number.isFinite(pounds)) weightKg = pounds * 0.45359237;
      if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350)
        fail('Tell me your weight in kilograms (or pounds).');
      const kg = round(weightKg, 1);
      return {
        kind: 'request',
        method: 'post',
        url: '/fitness/weight',
        body: { weightKg: kg, note: text(p.note), date: now.toISOString() },
        format: () => `Logged your weight: ${kg} kg.`,
      };
    }

    case 'LOG_WATER': {
      let ml = num(p.amountMl, p.ml);
      const glasses = num(p.glasses, p.cups);
      const litres = num(p.liters, p.litres, p.l);
      if (!Number.isFinite(ml) && Number.isFinite(glasses)) ml = glasses * 250;
      if (!Number.isFinite(ml) && Number.isFinite(litres)) ml = litres * 1000;
      if (!Number.isFinite(ml)) ml = 250; // "I drank a glass of water"
      if (ml <= 0 || ml > 3000) fail('How much water did you drink?');
      return {
        kind: 'request',
        method: 'put',
        url: '/fitness/daily',
        body: { addWaterMl: Math.round(ml) },
        format: data =>
          `Added ${Math.round(ml)} ml of water.${Number(data?.daily?.waterMl) ? ` Today: ${Math.round(data.daily.waterMl)} ml.` : ''}`,
      };
    }

    case 'LOG_STEPS': {
      const steps = num(p.steps, p.count);
      if (!Number.isFinite(steps) || steps < 0 || steps > 100000) fail('How many steps did you walk today?');
      return {
        kind: 'request',
        method: 'put',
        url: '/fitness/daily',
        body: { steps: Math.round(steps) },
        format: () => `Saved ${Math.round(steps)} steps for today.`,
      };
    }

    case 'LOG_SLEEP': {
      const hours = num(p.hours, p.sleepHours);
      if (!Number.isFinite(hours) || hours < 0 || hours > 24) fail('How many hours did you sleep?');
      return {
        kind: 'request',
        method: 'put',
        url: '/fitness/daily',
        body: { sleepHours: round(hours, 1) },
        format: () => `Saved ${round(hours, 1)} hours of sleep.`,
      };
    }

    case 'LOG_WORKOUT': {
      const type = oneOf(p.type, WORKOUT_TYPES, 'other');
      const name = text(p.name, p.title) || (type === 'other' ? '' : type[0].toUpperCase() + type.slice(1));
      if (!name) fail('What workout did you do?');
      const minutes = num(p.durationMin, p.minutes, p.duration);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) fail(`How many minutes of ${name.toLowerCase()} did you do?`);
      const calories = num(p.caloriesBurned);
      return {
        kind: 'request',
        method: 'post',
        url: '/fitness/workouts',
        body: {
          name,
          type,
          intensity: oneOf(p.intensity, INTENSITIES, 'moderate'),
          durationMin: Math.round(minutes),
          ...(Number.isFinite(calories) && calories > 0 ? { caloriesBurned: Math.round(calories) } : {}),
          date: now.toISOString(),
        },
        format: data => {
          const burned = Math.round(Number(data?.workout?.caloriesBurned) || 0);
          return `Logged ${Math.round(minutes)} min of ${name.toLowerCase()}${burned ? ` (about ${burned} kcal)` : ''}.`;
        },
      };
    }

    case 'FITNESS_REMINDER': {
      const time = toClockTime(p.time);
      if (!time) fail('What time should I remind you?');
      const type = oneOf(p.type, REMINDER_TYPES, 'custom');
      const title = text(p.title, p.message) ||
        { meal: 'Meal time', water: 'Drink water', workout: 'Workout time', weight: 'Weigh in', custom: 'Reminder' }[type];
      return {
        kind: 'request',
        method: 'post',
        url: '/fitness/reminders',
        body: {
          title,
          type,
          time,
          message: text(p.message, title),
          days: [0, 1, 2, 3, 4, 5, 6],
          enabled: true,
        },
        format: () => `Reminder set: "${title}" every day at ${time}.`,
      };
    }

    case 'ASK_FITNESS_COACH': {
      const question = text(p.question, p.message, p.text).slice(0, 500);
      if (!question) fail('What would you like to ask your fitness coach?');
      return {
        kind: 'request',
        method: 'post',
        url: '/fitness/coach',
        body: { question },
        format: data => text(data?.reply, data?.answer) || 'Your coach has no answer right now.',
      };
    }

    case 'FOOD_RECOMMENDATIONS':
      return {
        kind: 'request',
        method: 'get',
        url: '/fitness/recommendations',
        format: summarizeRecommendations,
      };

    case 'FITNESS_PROGRESS':
      return {
        kind: 'navigate',
        route: 'Menu',
        params: { screen: 'FitnessProgress' },
        message: 'Your fitness progress is open.',
      };

    case 'RECOVERY_SUMMARY':
      return {
        kind: 'request',
        method: 'get',
        url: '/recovery/dashboard',
        format: summarizeRecoveryDashboard,
        thenOpen: data =>
          Array.isArray(data?.substances) && data.substances.length
            ? null
            : ['Menu', { screen: 'RecoveryOnboarding' }],
      };

    case 'RECOVERY_CHECKIN': {
      const mood = toMoodScore(p.mood);
      const craving = num(p.craving, p.cravingLevel);
      if (!Number.isFinite(mood)) fail('How is your mood right now, from 1 (very low) to 5 (very good)?');
      if (!Number.isFinite(craving)) fail('How strong are your cravings today, from 0 (none) to 10?');
      const triggers = (Array.isArray(p.triggers) ? p.triggers : [p.triggers, p.trigger])
        .map(item => String(item || '').trim().toLowerCase())
        .filter(item => RECOVERY_TRIGGERS.includes(item));
      const stress = num(p.stress);
      const sleep = num(p.sleepHours, p.sleep);
      return {
        kind: 'request',
        method: 'post',
        url: '/recovery/checkins',
        body: {
          mood,
          craving: clamp(Math.round(craving), 0, 10),
          ...(Number.isFinite(stress) ? { stress: clamp(Math.round(stress), 1, 5) } : {}),
          ...(Number.isFinite(sleep) ? { sleepHours: clamp(sleep, 0, 24) } : {}),
          ...(triggers.length ? { triggers } : {}),
          note: text(p.note, p.message).slice(0, 1000),
        },
        format: data => {
          const reflection = text(data?.checkin?.reflection, data?.reflection);
          return `Check-in saved.${reflection ? ` ${reflection}` : ''}`;
        },
        thenOpen: data => (data?.crisis ? ['Menu', { screen: 'RecoveryHelp' }] : null),
      };
    }

    case 'LOG_CRAVING': {
      const intensity = num(p.intensity, p.level, p.intensityStart);
      if (!Number.isFinite(intensity)) fail('How strong is the craving, from 1 to 10?');
      const trigger = oneOf(p.trigger, RECOVERY_TRIGGERS, '');
      const outcome = oneOf(p.outcome, CRAVING_OUTCOMES, 'resisted');
      return {
        kind: 'request',
        method: 'post',
        url: '/recovery/cravings',
        body: {
          clientId: clientId || `agent-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          intensityStart: clamp(Math.round(intensity), 1, 10),
          outcome,
          ...(trigger ? { trigger } : {}),
          at: now.toISOString(),
        },
        format: () =>
          outcome === 'resisted'
            ? 'Craving logged — and you got through it. Well done.'
            : 'Craving logged. Every time you notice one, you learn a little more.',
      };
    }

    // A slip needs care and choices (keep the streak or pick a new quit
    // date), so the agent opens the guided screen rather than recording it.
    case 'LOG_LAPSE':
      return {
        kind: 'navigate',
        route: 'Menu',
        params: { screen: 'RecoveryLapse' },
        message: "A slip doesn't erase your progress. I opened the slip screen so you can record it and choose what happens next.",
      };

    case 'ASK_RECOVERY_COACH': {
      const message = text(p.message, p.question, p.text).slice(0, 1000);
      if (!message) fail('What would you like to tell your recovery coach?');
      const mode = oneOf(p.mode, ['coach', 'sos', 'lapse'], 'coach');
      return {
        kind: 'request',
        method: 'post',
        url: '/recovery/coach',
        body: { message, mode },
        format: data => [text(data?.reply), formatCrisis(data?.crisis)].filter(Boolean).join('\n\n') || 'Your coach is here for you.',
        thenOpen: data => (data?.crisis ? ['Menu', { screen: 'RecoveryHelp' }] : null),
      };
    }

    case 'RECOVERY_SOS':
      return {
        kind: 'navigate',
        route: 'Menu',
        params: { screen: 'RecoverySos' },
        message: "You're not alone. I opened your SOS tools — breathe with me, this urge will pass.",
      };

    case 'RECOVERY_HELP':
      return {
        kind: 'navigate',
        route: 'Menu',
        params: { screen: 'RecoveryHelp' },
        message: 'I opened Help with people you can call right now. If you are in danger, please call emergency services.',
      };

    default:
      return fail('That health action is not available.');
  }
};
