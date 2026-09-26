import api from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DASHBOARD_CACHE_KEY = '@connect/fitness-dashboard';

export type FitnessGoal = 'lose' | 'maintain' | 'gain';
export type FitnessPace = 'relaxed' | 'standard' | 'aggressive';
export type WorkoutType = 'walking' | 'running' | 'cycling' | 'strength' | 'hiit' | 'yoga' | 'swimming' | 'sports' | 'cardio' | 'other';
export type WorkoutIntensity = 'light' | 'moderate' | 'vigorous';
export type ProgressPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type FitnessProfile = {
  sex: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: FitnessGoal;
  pace?: FitnessPace;
  targetWeightKg?: number;
  startWeightKg?: number;
  targetCalories?: number;
  bmr?: number;
  tdee?: number;
  bmi?: number;
  bmiCategory?: 'underweight' | 'healthy' | 'overweight' | 'obese';
  healthyWeightRangeKg?: { min: number; max: number };
  waterTargetMl?: number;
  stepTarget?: number;
  weeklyWorkoutTarget?: number;
  sleepTargetHours?: number;
  macros?: { proteinG: number; carbsG: number; fatG: number };
};

export type WorkoutExercise = { name: string; sets?: number; reps?: number; weightKg?: number };

export type Workout = {
  _id?: string;
  date?: string;
  name: string;
  type: WorkoutType;
  intensity: WorkoutIntensity;
  durationMin: number;
  caloriesBurned?: number;
  exercises?: WorkoutExercise[];
  notes?: string;
};

export type DailyHabits = { waterMl?: number; addWaterMl?: number; steps?: number; sleepHours?: number; mood?: number; date?: string };

type AnalyzeMealPayload = FormData | {
  name: string;
  mealType?: string;
  imageUrl?: string;
};

export type CoachTurn = { role: 'user' | 'coach'; text: string };

export const fitnessApi = {
  getProfile: () => api.get('/fitness/profile'),
  saveProfile: (profile: Partial<FitnessProfile>) => api.put('/fitness/profile', profile),
  resetFitness: () => api.delete('/fitness/reset'),
  getDashboard: (date?: string) => api.get('/fitness/dashboard', { params: date ? { date } : undefined }),
  getCachedDashboard: async () => {
    const cached = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  },
  cacheDashboard: (dashboard: unknown) => AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(dashboard)),
  clearDashboardCache: () => AsyncStorage.removeItem(DASHBOARD_CACHE_KEY),
  askCoach: (question: string, history: CoachTurn[] = []) =>
    api.post('/fitness/coach', { question, history }, { timeout: 30000 }),
  getRecommendations: (refreshToken = Date.now()) =>
    api.get('/fitness/recommendations', { params: { refresh: refreshToken }, timeout: 30000 }),
  getMeals: (date?: string) => api.get('/fitness/meals', { params: date ? { date } : undefined }),
  getRecentMeals: () => api.get('/fitness/meals/recent'),
  analyzeMeal: (payload: AnalyzeMealPayload) =>
    api.post('/fitness/analyze-food', payload, { timeout: 30000 }),
  createMeal: (meal: Record<string, any>) => api.post('/fitness/meals', meal),
  getMeal: (id: string) => api.get(`/fitness/meals/${id}`),
  updateMeal: (id: string, meal: Record<string, any>) => api.put(`/fitness/meals/${id}`, meal),
  deleteMeal: (id: string) => api.delete(`/fitness/meals/${id}`),
  getWeights: () => api.get('/fitness/weight'),
  addWeight: (weightKg: number, date?: string, note?: string, bodyFatPercent?: number) =>
    api.post('/fitness/weight', { weightKg, date, note, bodyFatPercent }),
  deleteWeight: (id: string) => api.delete(`/fitness/weight/${id}`),
  getDaily: (date?: string) => api.get('/fitness/daily', { params: date ? { date } : undefined }),
  updateDaily: (habits: DailyHabits) => api.put('/fitness/daily', habits),
  getWorkouts: (days = 30) => api.get('/fitness/workouts', { params: { days } }),
  createWorkout: (workout: Workout) => api.post('/fitness/workouts', workout),
  updateWorkout: (id: string, workout: Partial<Workout>) => api.put(`/fitness/workouts/${id}`, workout),
  deleteWorkout: (id: string) => api.delete(`/fitness/workouts/${id}`),
  getProgress: (period: ProgressPeriod = 'monthly') =>
    api.get('/fitness/progress', { params: { period } }),
  getReminders: () => api.get('/fitness/reminders'),
  createReminder: (reminder: Record<string, any>) => api.post('/fitness/reminders', reminder),
  updateReminder: (id: string, reminder: Record<string, any>) => api.put(`/fitness/reminders/${id}`, reminder),
  deleteReminder: (id: string) => api.delete(`/fitness/reminders/${id}`),
};
