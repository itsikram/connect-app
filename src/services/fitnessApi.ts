import api from '../lib/api';

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

export const fitnessApi = {
  getProfile: () => api.get('/fitness/profile'),
  saveProfile: (profile: Partial<FitnessProfile>) => api.put('/fitness/profile', profile),
  resetFitness: () => api.delete('/fitness/reset'),
  getDashboard: (date?: string) => api.get('/fitness/dashboard', { params: date ? { date } : undefined }),
  askCoach: (question: string) => api.post('/fitness/coach', { question }, { timeout: 30000 }),
  getRecommendations: () => api.get('/fitness/recommendations', { timeout: 30000 }),
  getMeals: (date?: string) => api.get('/fitness/meals', { params: date ? { date } : undefined }),
  analyzeMeal: (payload: FormData | { name: string; imageUrl?: string }) =>
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
