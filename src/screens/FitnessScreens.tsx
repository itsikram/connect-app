import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { fitnessApi } from '../services/fitnessApi';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';

type Props = { navigation?: any; route?: any };

const FitnessPage = ({ children, title, navigation }: { children: React.ReactNode; title: string; navigation?: any }) => {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        style={{ backgroundColor: colors.background.primary }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headingRow}>
          <Pressable onPress={() => navigation?.goBack()}><Text style={[styles.back, { color: colors.primary }]}>‹</Text></Pressable>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const Field = ({ label, value, onChangeText, keyboardType = 'default', placeholder }: any) => {
  const { colors } = useTheme();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text><TextInput value={String(value ?? '')} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.text.tertiary} keyboardType={keyboardType} style={[styles.input, { color: colors.text.primary, borderColor: colors.border.primary, backgroundColor: colors.surface.primary }]} /></View>;
};

const Button = ({ label, loadingLabel = 'Loading...', onPress, secondary = false }: { label: string; loadingLabel?: string; onPress: () => void | Promise<void>; secondary?: boolean }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try { await onPress(); } finally { setLoading(false); }
  };
  return <Pressable disabled={loading} onPress={handlePress} style={[styles.button, { backgroundColor: secondary ? colors.surface.secondary : colors.primary, borderColor: colors.border.primary, opacity: loading ? 0.7 : 1 }]}><View style={styles.buttonContent}>{loading ? <><ActivityIndicator size="small" color={secondary ? colors.text.primary : '#001014'} /><Text style={[styles.buttonText, { color: secondary ? colors.text.primary : '#001014' }]}>{loadingLabel}</Text></> : <Text style={[styles.buttonText, { color: secondary ? colors.text.primary : '#001014' }]}>{label}</Text>}</View></Pressable>;
};

export const FitnessOnboarding = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [form, setForm] = useState<any>({ sex: 'other', age: '', heightCm: '', weightKg: '', activityLevel: 'moderate', goal: 'maintain' });
  const set = (key: string) => (value: string) => setForm((old: any) => ({ ...old, [key]: ['age', 'heightCm', 'weightKg', 'targetWeightKg'].includes(key) ? Number(value) || '' : value }));
  const save = async () => {
    try { await fitnessApi.saveProfile(form); navigation.replace('FitnessDashboard'); } catch (error: any) { Alert.alert('Fitness profile', error?.response?.data?.message || 'Please check your details'); }
  };
  return <FitnessPage title="Set up your fitness plan" navigation={navigation}><Text style={[styles.help, { color: colors.text.secondary }]}>Your targets are calculated privately on the server using Mifflin-St Jeor.</Text><Field label="Sex (male, female, other)" value={form.sex} onChangeText={set('sex')} /><Field label="Age" value={form.age} onChangeText={set('age')} keyboardType="number-pad" /><Field label="Height (cm)" value={form.heightCm} onChangeText={set('heightCm')} keyboardType="decimal-pad" /><Field label="Current weight (kg)" value={form.weightKg} onChangeText={set('weightKg')} keyboardType="decimal-pad" /><Field label="Target weight (kg, optional)" value={form.targetWeightKg} onChangeText={set('targetWeightKg')} keyboardType="decimal-pad" /><Field label="Activity (sedentary, light, moderate, very_active, extra_active)" value={form.activityLevel} onChangeText={set('activityLevel')} /><Field label="Goal (lose, maintain, gain)" value={form.goal} onChangeText={set('goal')} /><Button label="Calculate my targets" onPress={save} /></FitnessPage>;
};

export const FitnessDashboard = ({ navigation }: Props) => {
  const [data, setData] = useState<any>(null);
  const { colors } = useTheme();
  useEffect(() => { fitnessApi.getDashboard().then((response) => setData(response.data)).catch(() => {}); }, []);
  if (!data?.profile) return <FitnessPage title="Fitness" navigation={navigation}><Text style={[styles.help, { color: colors.text.secondary }]}>Create a profile to get safe daily targets.</Text><Button label="Start setup" onPress={() => navigation.navigate('FitnessOnboarding')} /></FitnessPage>;
  const profile = data.profile;
  const totals = data.totals || {};
  const reset = () => Alert.alert('Reset Fitness details', 'This permanently deletes your Fitness profile, meals, weights, and reminders.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: async () => { try { await fitnessApi.resetFitness(); setData(null); } catch (error: any) { Alert.alert('Fitness', error?.response?.data?.message || 'Could not reset Fitness details'); } } },
  ]);
  return <FitnessPage title="Today's fitness" navigation={navigation}>
    <View style={[styles.hero, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}><Text style={[styles.heroNumber, { color: colors.primary }]}>{totals.calories || 0} / {profile.targetCalories} kcal</Text><Text style={[styles.help, { color: colors.text.secondary }]}>BMR {Math.round(profile.bmr)} · TDEE {Math.round(profile.tdee)}</Text></View>
    <View style={styles.row}><Stat label="Protein" value={`${Math.round(totals.proteinG || 0)} / ${Math.round(profile.macros?.proteinG || 0)}g`} /><Stat label="Carbs" value={`${Math.round(totals.carbsG || 0)} / ${Math.round(profile.macros?.carbsG || 0)}g`} /><Stat label="Fat" value={`${Math.round(totals.fatG || 0)} / ${Math.round(profile.macros?.fatG || 0)}g`} /></View>
    <Button label="Add a meal" onPress={() => navigation.navigate('FitnessMeal')} /><Button label="Food recommendations" onPress={() => navigation.navigate('FitnessRecommendations')} secondary /><Button label="Log weight" onPress={() => navigation.navigate('FitnessWeight')} secondary /><Button label="View progress" onPress={() => navigation.navigate('FitnessProgress')} secondary /><Button label="Reminders" onPress={() => navigation.navigate('FitnessReminders')} secondary /><Button label="Coach" onPress={() => navigation.navigate('FitnessCoach')} secondary /><Button label="Reset Fitness details" onPress={reset} secondary />
  </FitnessPage>;
};

const Stat = ({ label, value }: { label: string; value: string }) => { const { colors } = useTheme(); return <View style={[styles.stat, { backgroundColor: colors.surface.secondary }]}><Text style={[styles.statValue, { color: colors.text.primary }]}>{value}</Text><Text style={[styles.statLabel, { color: colors.text.secondary }]}>{label}</Text></View>; };

export const FitnessMeal = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const initial = route?.params?.analysis || {};
  const [form, setForm] = useState<any>({ name: initial.name || '', calories: initial.calories || '', proteinG: initial.proteinG || '', carbsG: initial.carbsG || '', fatG: initial.fatG || '', fiberG: initial.fiberG || '', mealType: 'snack' });
  const [imageUri, setImageUri] = useState<string | null>(route?.params?.imageUri || null);
  const [source, setSource] = useState(route?.params?.source || 'manual');
  const set = (key: string) => (value: string) => setForm((old: any) => ({ ...old, [key]: ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'].includes(key) ? Number(value) || '' : value }));
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'You can still add this meal manually.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]?.uri) setImageUri(result.assets[0].uri);
  };
  const analyze = async () => {
    try {
      if (!imageUri) {
        const response = await fitnessApi.analyzeMeal({ name: form.name });
        setForm((old: any) => ({ ...old, ...response.data.analysis }));
        setSource(response.data.provider || 'gemini');
        return;
      }
      const body = new FormData();
      body.append('name', form.name || 'meal');
      body.append('image', { uri: imageUri, name: 'meal.jpg', type: 'image/jpeg' } as any);
      const response = await fitnessApi.analyzeMeal(body);
      setForm((old: any) => ({ ...old, ...response.data.analysis }));
      setSource(response.data.provider || 'gemini');
    } catch (error: any) {
      Alert.alert('Analysis unavailable', 'Could not analyze this meal. You can add it manually.');
    }
  };
  const save = async () => { try { await fitnessApi.createMeal({ ...form, source, imageUrl: imageUri || undefined, date: new Date().toISOString() }); navigation.goBack(); } catch (error: any) { Alert.alert('Meal', error?.response?.data?.message || 'Please complete nutrition fields'); } };
  return <FitnessPage title="Add meal" navigation={navigation}>{source === 'gemini' ? <Text style={[styles.help, { color: colors.text.secondary }]}>AI filled these values as estimates. Review and edit them before saving.</Text> : null}<Field label="Food name" value={form.name} onChangeText={set('name')} placeholder="e.g. chicken rice bowl" /><Button label={imageUri ? 'Photo selected - analyze' : 'Choose food photo'} onPress={choosePhoto} secondary /><Button label="Analyze food (optional)" loadingLabel="Analyzing meal with AI..." onPress={analyze} secondary /><Field label="Calories" value={form.calories} onChangeText={set('calories')} keyboardType="decimal-pad" /><Field label="Protein (g)" value={form.proteinG} onChangeText={set('proteinG')} keyboardType="decimal-pad" /><Field label="Carbs (g)" value={form.carbsG} onChangeText={set('carbsG')} keyboardType="decimal-pad" /><Field label="Fat (g)" value={form.fatG} onChangeText={set('fatG')} keyboardType="decimal-pad" /><Field label="Fiber (g)" value={form.fiberG} onChangeText={set('fiberG')} keyboardType="decimal-pad" /><Button label="Save meal" onPress={save} /></FitnessPage>;
};

export const FitnessConfirmation = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const analysis = route?.params?.analysis || {};
  const [form, setForm] = useState<any>(analysis);
  const set = (key: string) => (value: string) => setForm((old: any) => ({ ...old, [key]: ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'].includes(key) ? Number(value) || '' : value }));
  const save = async () => {
    try {
      await fitnessApi.createMeal({ ...form, source: route?.params?.source || 'gemini', date: new Date().toISOString(), imageUrl: route?.params?.imageUri });
      navigation.navigate('FitnessDashboard');
    } catch (error: any) {
      Alert.alert('Meal', error?.response?.data?.message || 'Please correct the nutrition values');
    }
  };
  return <FitnessPage title="Confirm nutrition" navigation={navigation}><Text style={[styles.help, { color: colors.text.secondary }]}>AI estimates may be inaccurate. Review and edit every value before confirming.</Text><Field label="Food name" value={form.name} onChangeText={set('name')} /><Field label="Calories" value={form.calories} onChangeText={set('calories')} keyboardType="decimal-pad" /><Field label="Protein (g)" value={form.proteinG} onChangeText={set('proteinG')} keyboardType="decimal-pad" /><Field label="Carbs (g)" value={form.carbsG} onChangeText={set('carbsG')} keyboardType="decimal-pad" /><Field label="Fat (g)" value={form.fatG} onChangeText={set('fatG')} keyboardType="decimal-pad" /><Field label="Fiber (g)" value={form.fiberG} onChangeText={set('fiberG')} keyboardType="decimal-pad" /><Button label="Confirm meal" onPress={save} /><Button label="Cancel" onPress={() => navigation.goBack()} secondary /></FitnessPage>;
};

export const FitnessWeight = ({ navigation }: Props) => {
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const save = async () => { try { await fitnessApi.addWeight(Number(weight), new Date().toISOString(), note); navigation.goBack(); } catch (error: any) { Alert.alert('Weight', error?.response?.data?.message || 'Enter a valid weight'); } };
  return <FitnessPage title="Log weight" navigation={navigation}><Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /><Field label="Note (optional)" value={note} onChangeText={setNote} /><Button label="Save weight" onPress={save} /></FitnessPage>;
};

export const FitnessProgress = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [data, setData] = useState<any>({ weights: [], nutrition: [], summary: {} });
  useEffect(() => {
    fitnessApi.getProgress(period).then((response) => setData(response.data)).catch(() => {});
  }, [period]);
  const periods: Array<{ key: 'daily' | 'weekly' | 'monthly'; label: string }> = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];
  return <FitnessPage title="Progress" navigation={navigation}>
    <View style={styles.periodRow}>
      {periods.map((item) => <Pressable key={item.key} onPress={() => setPeriod(item.key)} style={[styles.periodButton, { backgroundColor: period === item.key ? colors.primary : colors.surface.secondary, borderColor: colors.border.primary }]}><Text style={{ color: period === item.key ? colors.text.inverse : colors.text.primary, fontWeight: '700' }}>{item.label}</Text></Pressable>)}
    </View>
    <View style={[styles.summaryCard, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}>
      <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>{period === 'daily' ? "Today's details" : period === 'weekly' ? 'This week' : 'This month'}</Text>
      <Text style={[styles.help, { color: colors.text.secondary }]}>Average calories: {data.summary?.averageCalories || 0} kcal/day</Text>
      <Text style={[styles.help, { color: colors.text.secondary }]}>Protein: {Math.round(data.summary?.totalProteinG || 0)}g · Carbs: {Math.round(data.summary?.totalCarbsG || 0)}g · Fat: {Math.round(data.summary?.totalFatG || 0)}g</Text>
      <Text style={[styles.help, { color: colors.text.secondary }]}>Logged days: {data.summary?.loggedDays || 0}</Text>
    </View>
    <Text style={[styles.section, { color: colors.primary }]}>Weight history</Text>
    {data.weights.length ? data.weights.map((item: any) => <Text key={item._id} style={[styles.help, { color: colors.text.secondary }]}>{new Date(item.date).toLocaleDateString()} · {item.weightKg} kg</Text>) : <Text style={[styles.help, { color: colors.text.secondary }]}>No weight entries for this period.</Text>}
    <Text style={[styles.section, { color: colors.primary }]}>Nutrition details</Text>
    {data.nutrition.length ? data.nutrition.map((item: any) => <View key={item._id} style={[styles.detailRow, { borderBottomColor: colors.border.primary }]}><Text style={[styles.detailDate, { color: colors.text.primary }]}>{item._id}</Text><Text style={[styles.help, { color: colors.text.secondary }]}>{Math.round(item.calories)} kcal · {Math.round(item.proteinG)}g protein · {item.meals} meal{item.meals === 1 ? '' : 's'}</Text></View>) : <Text style={[styles.help, { color: colors.text.secondary }]}>No meals logged for this period.</Text>}
  </FitnessPage>;
};

export const FitnessReminders = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [reminders, setReminders] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState('Drink water');
  const [time, setTime] = useState('12:00');
  const load = () => fitnessApi.getReminders().then((response) => setReminders(response.data.reminders || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = async () => {
    try {
      const saved = await fitnessApi.createReminder({ title, time, type: 'water' });
      load();
    } catch (error: any) { Alert.alert('Reminder', error?.response?.data?.message || 'Use HH:mm time'); }
  };
  const remove = async (item: any) => {
    if (deletingId) return;
    setDeletingId(item._id);
    try {
      try { if (item.notificationId) await Notifications.cancelScheduledNotificationAsync(item.notificationId); } catch (_) {}
      await fitnessApi.deleteReminder(item._id);
      load();
    } catch (error: any) {
      Alert.alert('Reminder', error?.response?.data?.message || 'Could not delete this reminder');
    } finally {
      setDeletingId(null);
    }
  };
  return <FitnessPage title="Reminders" navigation={navigation}><Field label="Reminder title" value={title} onChangeText={setTitle} /><Field label="Time (HH:mm)" value={time} onChangeText={setTime} /><Button label="Add reminder" onPress={add} />{reminders.map((item) => <View key={item._id} style={[styles.reminder, { borderBottomColor: colors.border.primary }]}><Text style={[styles.confirmName, { color: colors.text.primary }]}>{item.time} · {item.title}</Text><Pressable disabled={deletingId === item._id} onPress={() => remove(item)}><View style={styles.deleteContent}>{deletingId === item._id ? <ActivityIndicator size="small" color={colors.status.error} /> : <Text style={[styles.delete, { color: colors.status.error }]}>Delete</Text>}</View></Pressable></View>)}</FitnessPage>;
};

export const FitnessRecommendations = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError('');
    try {
      const response = await fitnessApi.getRecommendations();
      setData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load recommendations');
    }
  };
  useEffect(() => { load(); }, []);
  return <FitnessPage title="Food recommendations" navigation={navigation}>
      <Text style={[styles.help, { color: colors.text.secondary }]}>Suggestions use your remaining calories and macros. AI insights are estimates for general wellness, not medical advice.</Text>
      <Button label="Refresh recommendations" onPress={load} secondary />
      {error ? <Text style={[styles.help, { color: colors.status.error }]}>{error}</Text> : null}
      {data ? <View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}>
          <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>Remaining today</Text>
          <Text style={[styles.help, { color: colors.text.secondary }]}>{data.remaining?.calories || 0} kcal · Protein {data.remaining?.proteinG || 0}g · Carbs {data.remaining?.carbsG || 0}g · Fat {data.remaining?.fatG || 0}g</Text>
        </View>
        {(data.recommendations || []).map((item: any, index: number) => <View key={`${item.name}-${index}`} style={[styles.recommendationCard, { backgroundColor: colors.surface.secondary, borderColor: colors.border.primary }]}>
          <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>{item.name}</Text>
          <Text style={[styles.help, { color: colors.text.secondary }]}>{item.calories} kcal · {item.proteinG}g protein · {item.carbsG}g carbs · {item.fatG}g fat</Text>
          <Text style={[styles.help, { color: colors.text.secondary }]}>{item.why}</Text>
        </View>)}
        <Text style={[styles.section, { color: colors.primary }]}>Health details</Text>
        {(data.healthNotes || []).map((note: string, index: number) => <Text key={index} style={[styles.help, { color: colors.text.secondary }]}>• {note}</Text>)}
      </View> : null}
  </FitnessPage>;
};

export const FitnessCoach = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const ask = async () => {
    try {
      const response = await fitnessApi.askCoach(question);
      setReply(response.data.reply || '');
    } catch (error: any) {
      Alert.alert('Coach unavailable', error?.response?.data?.message || 'Please try again later');
    }
  };
  return <FitnessPage title="Fitness coach" navigation={navigation}><Text style={[styles.help, { color: colors.text.secondary }]}>Ask about meals, protein, or your remaining calories. This is general wellness guidance, not medical advice.</Text><Field label="Question" value={question} onChangeText={setQuestion} placeholder="What can I eat for dinner?" /><Button label="Ask coach" onPress={ask} />{reply ? <View style={[styles.confirm, { backgroundColor: colors.surface.secondary }]}><Text style={[styles.help, { color: colors.text.primary }]}>{reply}</Text></View> : null}</FitnessPage>;
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 20, paddingBottom: 98 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  back: { fontSize: 36, marginRight: 12, lineHeight: 36 },
  title: { fontSize: 25, fontWeight: '700' },
  help: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  button: { borderWidth: 1, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10, marginBottom: 4 },
  buttonContent: { minHeight: 19, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontWeight: '700' },
  hero: { borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 12 },
  heroNumber: { fontSize: 26, fontWeight: '800', marginBottom: 5 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stat: { flex: 1, borderRadius: 12, padding: 10 },
  statValue: { fontSize: 13, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 3 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 11 },
  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 8 },
  summaryTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  detailRow: { borderBottomWidth: 1, paddingVertical: 10 },
  detailDate: { fontWeight: '700', marginBottom: 2 },
  recommendationCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 10 },
  confirm: { padding: 16, borderRadius: 12, marginVertical: 12, backgroundColor: '#16323A' },
  confirmName: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  reminder: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  delete: { fontWeight: '700' },
  deleteContent: { minWidth: 48, minHeight: 19, justifyContent: 'center', alignItems: 'center' },
});
