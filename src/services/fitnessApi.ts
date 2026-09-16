import api from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DASHBOARD_CACHE_KEY = '@connect/fitness-dashboard';

export type FitnessProfile = {
  sex: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: 'lose' | 'maintain' | 'gain';
  targetWeightKg?: number;
  targetCalories?: number;
  bmr?: number;
  tdee?: number;
  macros?: { proteinG: number; carbsG: number; fatG: number };
};

type AnalyzeMealPayload = FormData | {
  name: string;
  mealType?: string;
  imageUrl?: string;
};

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
  askCoach: (question: string) => api.post('/fitness/coach', { question }, { timeout: 30000 }),
  getRecommendations: (refreshToken = Date.now()) =>
    api.get('/fitness/recommendations', { params: { refresh: refreshToken }, timeout: 30000 }),
  getMeals: (date?: string) => api.get('/fitness/meals', { params: date ? { date } : undefined }),
  analyzeMeal: (payload: AnalyzeMealPayload) =>
    api.post('/fitness/analyze-food', payload, { timeout: 30000 }),
  createMeal: (meal: Record<string, any>) => api.post('/fitness/meals', meal),
  getMeal: (id: string) => api.get(`/fitness/meals/${id}`),
  updateMeal: (id: string, meal: Record<string, any>) => api.put(`/fitness/meals/${id}`, meal),
  deleteMeal: (id: string) => api.delete(`/fitness/meals/${id}`),
  getWeights: () => api.get('/fitness/weight'),
  addWeight: (weightKg: number, date?: string, note?: string) => api.post('/fitness/weight', { weightKg, date, note }),
  getProgress: (period: 'daily' | 'weekly' | 'monthly' = 'monthly') =>
    api.get('/fitness/progress', { params: { period } }),
  getReminders: () => api.get('/fitness/reminders'),
  createReminder: (reminder: Record<string, any>) => api.post('/fitness/reminders', reminder),
  updateReminder: (id: string, reminder: Record<string, any>) => api.put(`/fitness/reminders/${id}`, reminder),
  deleteReminder: (id: string) => api.delete(`/fitness/reminders/${id}`),
};
