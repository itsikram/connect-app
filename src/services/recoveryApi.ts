import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

const DASHBOARD_CACHE_KEY = '@connect/recovery-dashboard';
const CONTENT_CACHE_PREFIX = '@connect/recovery-content-';
const OUTBOX_KEY = '@connect/recovery-outbox';

export type RecoveryLang = 'en' | 'bn';
export type SubstanceKey =
  | 'yaba'
  | 'ice'
  | 'ganja'
  | 'cigarette'
  | 'smokeless'
  | 'phensedyl'
  | 'heroin'
  | 'alcohol'
  | 'sleeping_pills'
  | 'inhalant'
  | 'other';
export type SafetyClass = 'nicotine' | 'cannabis' | 'stimulant' | 'opioid' | 'medical_taper' | 'inhalant' | 'other';
export type Approach = 'now' | 'date' | 'taper' | 'doctor';
export type RiskLevel = 'none' | 'elevated' | 'crisis';
export type ToolKey = 'urge_surf' | 'breathing' | 'reasons' | 'tape_forward' | 'grounding' | 'four_ds' | 'distract' | 'call_support' | 'coach';
export type SuggestedTool = 'none' | 'breathing' | 'urge_surf' | 'reasons' | 'grounding' | 'tape_forward' | 'distract' | 'call_support' | 'help';
export type CoachMode = 'coach' | 'sos' | 'lapse';

export type TrackedSubstance = {
  key: SubstanceKey;
  customName?: string;
  primary: boolean;
  amountPerDay: number;
  daysPerWeek: number;
  costPerUnit: number;
  yearsUsing?: number | null;
  wakeUse?: string;
  approach: Approach;
  quitDate: string;
  streakStart?: string;
  longestStreakDays?: number;
  bankedCleanDays?: number;
  screener?: { tool: string; score: number | null; severity: '' | 'low' | 'moderate' | 'high' } | null;
};

export type SupportContact = { name: string; phone: string; relation?: string };

export type PlanIfThen = { trigger: string; action: string };
export type RecoveryPlan = {
  summary: string;
  safetyNote: string;
  ifThen: PlanIfThen[];
  tools: ToolKey[];
  checklist: Array<{ text: string; done: boolean }>;
  weeklyGoals: Array<{ week: number; goal: string; expect?: string; done?: boolean }>;
  rewardIdea: string;
  rewardGoal?: { title: string; amount: number } | null;
  source: 'gemini' | 'curated';
};

export type RecoveryProfile = {
  substances: TrackedSubstance[];
  readiness: { importance: number; confidence: number };
  reasonKeys: string[];
  reasons: string;
  letter: string;
  triggers: string[];
  riskHours: number[];
  supportContacts: SupportContact[];
  plan: RecoveryPlan | null;
  planSource: string;
  planGeneratedAt: string | null;
  points: number;
  badges: Array<{ key: string; at: string | null }>;
  settings: { aiEnabled: boolean; discreet: boolean; riskNudges: boolean };
  language: 'auto' | 'en' | 'bn';
  timezone: string;
  currency: string;
  onboardingCompleted: boolean;
};

export type ProfileInput = Partial<Omit<RecoveryProfile, 'substances'>> & {
  substances?: Array<Partial<TrackedSubstance> & { key: SubstanceKey }>;
  screenerAnswers?: Partial<Record<SubstanceKey, number[]>>;
};

export type Helpline = {
  key: string;
  phone: string;
  display: string;
  kind: string;
  crisis: boolean;
  url?: string;
  name: string;
  description: string;
  hours: string;
};

export type CrisisInfo = { type: string; message: string; helplines: Helpline[] };

export type TimelineStep = { hours: number; at: string; text: string };

export type SubstanceSummary = {
  key: SubstanceKey;
  name: string;
  unit: string;
  icon: string;
  safetyClass: SafetyClass;
  approach: Approach;
  primary: boolean;
  quitDate: string;
  streakStart: string;
  costPerUnit: number;
  status: 'clean' | 'preparing';
  msUntilQuit: number;
  currentStreakMs: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalCleanDays: number;
  unitsAvoided: number;
  moneySaved: number;
  lifeRegainedMinutes: number;
  milestone: { reachedDays: number; nextDays: number | null; progress: number; msToNext: number; reachedLabel: string | null; nextLabel: string | null };
  health: { reachedIndex: number; nextIndex: number | null; msToNext: number; last: TimelineStep | null; next: TimelineStep | null };
};

export type Checkin = {
  day: string;
  used: Array<{ substance: SubstanceKey; amount: number }>;
  mood: number;
  craving: number;
  stress: number | null;
  sleepHours: number | null;
  halt: string[];
  triggers: string[];
  note: string;
  reflection: string;
  microGoal: string;
  risk: RiskLevel;
};

export type Badge = { key: string; icon: string; label: string; at: string | null };

export type RecoveryDashboard = {
  profile: RecoveryProfile | null;
  serverTime?: string;
  todayKey?: string;
  substances?: SubstanceSummary[];
  totals?: {
    moneySaved: number;
    cravingsResisted: number;
    cravingsLogged: number;
    checkinCount: number;
    checkinStreak: number;
    longestStreakDays: number;
    totalCleanDays: number;
  };
  today?: { checkin: Checkin | null };
  daily?: { note: string; mission: string; source?: string } | null;
  recent?: { checkins: number; avgMood: number | null; avgCraving: number | null; cravingsLogged: number; cravingsResisted: number };
  toolOrder?: ToolKey[];
  proHelp?: Array<'severity' | 'medical' | 'crisis' | 'lapses'>;
  stage?: string;
  points?: number;
  badges?: Badge[];
  newBadges?: Badge[];
};

export type ScreenerContent = { title: string; questions: Array<{ text: string; options: string[] }> };

export type RecoveryContent = {
  lang: RecoveryLang;
  substances: Array<{ key: SubstanceKey; safetyClass: SafetyClass; screener: string; icon: string; name: string; unit: string; unitOne: string; defaultAmount: number }>;
  safetyClasses: Record<SafetyClass, { approaches: Approach[]; defaultApproach: Approach; title: string; quitAdvice: string; withdrawal: string; safety: string; lapseSafety: string }>;
  screeners: Record<string, ScreenerContent>;
  triggers: Array<{ key: string; label: string }>;
  reasons: Array<{ key: string; label: string }>;
  halt: Array<{ key: string; label: string }>;
  milestones: Array<{ days: number; label: string }>;
  badges: Record<string, { icon: string; label: string }>;
  timelines: Record<string, TimelineStep[]>;
  helplines: Helpline[];
  crisisMessages: Record<string, string>;
};

export type CravingInput = {
  clientId: string;
  at: string;
  substance?: SubstanceKey;
  intensityStart: number;
  intensityEnd?: number;
  trigger?: string;
  tools: ToolKey[];
  durationSec: number;
  outcome: 'resisted' | 'used' | 'unsure';
};

export type CravingResult = { duplicate?: boolean; pointsEarned: number; newBadges: Badge[]; queued?: boolean };

export type CheckinInput = {
  used: Array<{ substance: SubstanceKey; amount: number }>;
  mood: number;
  craving: number;
  stress?: number;
  sleepHours?: number;
  halt: string[];
  triggers: string[];
  note?: string;
};

export type LapseInput = {
  substance: SubstanceKey;
  at: string;
  amount?: number;
  trigger?: string;
  feelingBefore?: string;
  context?: string;
  restart: 'continue' | 'new_date';
  newQuitDate?: string;
};

export type LapseDebrief = {
  reflection: string;
  chain: string[];
  lesson: string;
  newIfThen: PlanIfThen;
  risk: RiskLevel;
  source: string;
};

export type CoachReply = {
  reply: string;
  risk: RiskLevel;
  riskType: string;
  suggestedTool: SuggestedTool;
  crisis: CrisisInfo | null;
  source: string;
};

export type CoachMessage = {
  id: string;
  role: 'user' | 'coach';
  mode: string;
  text: string;
  risk: RiskLevel;
  suggestedTool: SuggestedTool;
  crisis: CrisisInfo | null;
  createdAt: string;
};

type OutboxItem = { kind: 'craving'; payload: CravingInput };

export const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** True when the request never reached the server (offline, DNS, timeout). */
export const isNetworkError = (error: any) => !!error && !error.response;

const readJson = async <T,>(key: string): Promise<T | null> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (_) {
    return null;
  }
};

const readOutbox = async () => (await readJson<OutboxItem[]>(OUTBOX_KEY)) || [];

let flushing: Promise<number> | null = null;

export const recoveryApi = {
  getContent: (lang: RecoveryLang) => api.get<RecoveryContent>('/recovery/content', { params: { lang } }),
  getCachedContent: (lang: RecoveryLang) => readJson<RecoveryContent>(`${CONTENT_CACHE_PREFIX}${lang}`),
  cacheContent: (lang: RecoveryLang, content: RecoveryContent) => AsyncStorage.setItem(`${CONTENT_CACHE_PREFIX}${lang}`, JSON.stringify(content)),

  getDashboard: (lang: RecoveryLang) => api.get<RecoveryDashboard>('/recovery/dashboard', { params: { lang } }),
  getCachedDashboard: () => readJson<RecoveryDashboard>(DASHBOARD_CACHE_KEY),
  cacheDashboard: (dashboard: RecoveryDashboard) => AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(dashboard)),
  clearCache: () => AsyncStorage.multiRemove([DASHBOARD_CACHE_KEY, OUTBOX_KEY, `${CONTENT_CACHE_PREFIX}en`, `${CONTENT_CACHE_PREFIX}bn`]),

  getProfile: () => api.get<{ profile: RecoveryProfile | null }>('/recovery/profile'),
  saveProfile: (profile: ProfileInput, lang: RecoveryLang) => api.put<{ profile: RecoveryProfile }>('/recovery/profile', profile, { params: { lang } }),
  getDaily: (lang: RecoveryLang) => api.get<{ note: string; mission: string; source: string }>('/recovery/daily', { params: { lang }, timeout: 30000 }),

  generatePlan: (lang: RecoveryLang) => api.post<{ plan: RecoveryPlan; pointsEarned: number }>('/recovery/plan/generate', {}, { params: { lang }, timeout: 45000 }),
  updatePlan: (plan: RecoveryPlan, lang: RecoveryLang) => api.put<{ plan: RecoveryPlan }>('/recovery/plan', { plan }, { params: { lang } }),

  getCheckins: (days = 30) => api.get<{ checkins: Checkin[] }>('/recovery/checkins', { params: { days } }),
  saveCheckin: (checkin: CheckinInput, lang: RecoveryLang) =>
    api.post<{ checkin: Checkin; crisis: CrisisInfo | null; lapsesCreated: SubstanceKey[]; pointsEarned: number; newBadges: Badge[] }>('/recovery/checkins', checkin, { params: { lang }, timeout: 30000 }),

  getCravings: (days = 30) => api.get<{ cravings: Array<CravingInput & { id: string }> }>('/recovery/cravings', { params: { days } }),
  /** Logs an SOS session; when offline it is queued and uploaded later. */
  logCraving: async (craving: CravingInput, lang: RecoveryLang): Promise<CravingResult> => {
    try {
      const response = await api.post<CravingResult>('/recovery/cravings', craving, { params: { lang } });
      return response.data;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const outbox = await readOutbox();
      outbox.push({ kind: 'craving', payload: craving });
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox.slice(-100)));
      return { queued: true, pointsEarned: 0, newBadges: [] };
    }
  },
  /** Uploads queued SOS sessions. Returns how many were sent. */
  flushOutbox: (lang: RecoveryLang): Promise<number> => {
    if (flushing) return flushing;
    flushing = (async () => {
      const outbox = await readOutbox();
      if (!outbox.length) return 0;
      const remaining: OutboxItem[] = [];
      let sent = 0;
      for (const item of outbox) {
        try {
          await api.post('/recovery/cravings', item.payload, { params: { lang } });
          sent += 1;
        } catch (error) {
          // Keep items that failed for network reasons; drop ones the server rejected.
          if (isNetworkError(error)) remaining.push(item);
        }
      }
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
      return sent;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  },
  pendingCount: async () => (await readOutbox()).length,

  getLapses: (days = 90) => api.get<{ lapses: any[] }>('/recovery/lapses', { params: { days } }),
  logLapse: (lapse: LapseInput, lang: RecoveryLang) =>
    api.post<{ lapse: any; debrief: LapseDebrief; safety: { safetyClass: SafetyClass; text: string }; crisis: CrisisInfo | null; substance: SubstanceSummary; newBadges: Badge[] }>(
      '/recovery/lapses',
      lapse,
      { params: { lang }, timeout: 45000 },
    ),

  askCoach: (message: string, mode: CoachMode, lang: RecoveryLang) => api.post<CoachReply>('/recovery/coach', { message, mode }, { params: { lang }, timeout: 45000 }),
  getCoachHistory: (lang: RecoveryLang) => api.get<{ messages: CoachMessage[] }>('/recovery/coach/history', { params: { lang } }),
  clearCoachHistory: () => api.delete('/recovery/coach/history'),

  exportData: () => api.get('/recovery/export', { timeout: 45000 }),
  reset: () => api.delete('/recovery/reset'),
};
