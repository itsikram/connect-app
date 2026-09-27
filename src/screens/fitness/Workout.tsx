import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi, Workout, WorkoutExercise } from '../../services/fitnessApi';
import { Button, Card, Chip, FIT, Field, FitnessPage, Icon, IconName, Muted, SectionHeader, Segmented, Stepper, WORKOUT_TYPES, errorMessage, fmt, shortDate, workoutMeta } from './ui';

type Props = { navigation?: any; route?: any };

// Mirrors server/utils/fitnessCalculations.js WORKOUT_METS for the live estimate.
const METS: Record<string, Record<string, number>> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 5 },
  running: { light: 7, moderate: 9.8, vigorous: 11.5 },
  cycling: { light: 4, moderate: 6.8, vigorous: 10 },
  strength: { light: 3.5, moderate: 5, vigorous: 6 },
  hiit: { light: 6, moderate: 8, vigorous: 10 },
  yoga: { light: 2.5, moderate: 3, vigorous: 4 },
  swimming: { light: 5, moderate: 7, vigorous: 9.8 },
  sports: { light: 4.5, moderate: 6.5, vigorous: 8 },
  cardio: { light: 4, moderate: 6, vigorous: 8 },
  other: { light: 3, moderate: 4.5, vigorous: 6 },
};

const TEMPLATES: Array<{ key: string; name: string; type: Workout['type']; durationMin: number; intensity: Workout['intensity']; icon: IconName; exercises?: WorkoutExercise[] }> = [
  { key: 'walk', name: 'Brisk walk', type: 'walking', durationMin: 30, intensity: 'moderate', icon: 'walk' },
  { key: 'run', name: '5K run', type: 'running', durationMin: 30, intensity: 'moderate', icon: 'run-fast' },
  {
    key: 'fullbody', name: 'Full-body strength', type: 'strength', durationMin: 45, intensity: 'moderate', icon: 'dumbbell',
    exercises: [{ name: 'Squats', sets: 3, reps: 10 }, { name: 'Push-ups', sets: 3, reps: 12 }, { name: 'Dumbbell rows', sets: 3, reps: 10 }, { name: 'Plank (sec)', sets: 3, reps: 45 }],
  },
  { key: 'hiit', name: 'HIIT circuit', type: 'hiit', durationMin: 20, intensity: 'vigorous', icon: 'lightning-bolt' },
  { key: 'yoga', name: 'Yoga & mobility', type: 'yoga', durationMin: 30, intensity: 'light', icon: 'meditation' },
  { key: 'cycle', name: 'Cycling', type: 'cycling', durationMin: 45, intensity: 'moderate', icon: 'bike' },
];

const COMMON_EXERCISES = ['Squats', 'Push-ups', 'Bench press', 'Deadlift', 'Lunges', 'Pull-ups', 'Shoulder press', 'Dumbbell rows', 'Bicep curls', 'Plank (sec)'];

const INTENSITY_HINTS: Record<string, string> = {
  light: 'Easy pace. You can sing or chat comfortably.',
  moderate: 'Breathing harder. You can talk, but not sing.',
  vigorous: 'Hard effort. Only a few words between breaths.',
};

export const FitnessWorkout = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const [type, setType] = useState<Workout['type']>('walking');
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [intensity, setIntensity] = useState<Workout['intensity']>('moderate');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [notes, setNotes] = useState('');
  const [calorieOverride, setCalorieOverride] = useState('');
  const [weightKg, setWeightKg] = useState(70);
  const [recent, setRecent] = useState<any[]>([]);

  const applyTemplate = (template: typeof TEMPLATES[number] | any) => {
    setType(template.type);
    setName(template.name);
    setDurationMin(template.durationMin);
    setIntensity(template.intensity);
    setExercises(template.exercises ? template.exercises.map((item: WorkoutExercise) => ({ ...item })) : []);
    setCalorieOverride('');
  };

  useEffect(() => {
    const preset = TEMPLATES.find((template) => template.key === route?.params?.preset);
    if (preset) applyTemplate(preset);
    fitnessApi.getProfile().then((response) => { if (response.data.profile?.weightKg) setWeightKg(response.data.profile.weightKg); }).catch(() => {});
    fitnessApi.getWorkouts(30).then((response) => {
      const seen = new Set<string>();
      setRecent((response.data.workouts || []).filter((workout: any) => {
        const key = workout.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6));
    }).catch(() => {});
  }, [route?.params?.preset]);

  const estimate = useMemo(() => Math.round((METS[type]?.[intensity] || 4.5) * weightKg * (durationMin / 60)), [type, intensity, weightKg, durationMin]);
  const calories = calorieOverride ? Number(calorieOverride) || 0 : estimate;

  const updateExercise = (index: number, key: keyof WorkoutExercise, value: string) => {
    setExercises((old) => old.map((item, i) => (i === index ? { ...item, [key]: key === 'name' ? value : Number(value.replace(/[^0-9.]/g, '')) || undefined } : item)));
  };

  const save = async () => {
    const workoutName = name.trim() || workoutMeta(type).label;
    if (durationMin < 1) { Alert.alert('Workout', 'Add a duration of at least 1 minute.'); return; }
    try {
      await fitnessApi.createWorkout({
        name: workoutName,
        type,
        intensity,
        durationMin,
        caloriesBurned: calories,
        exercises: exercises.filter((item) => item.name.trim()),
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Workout', errorMessage(error, 'Could not save this workout.'));
    }
  };

  return (
    <FitnessPage
      title="Log workout"
      navigation={navigation}
      footer={
        <View style={s.footer}>
          <View style={{ flex: 1 }}>
            <Text style={[s.footerKcal, { color: colors.text.primary }]}>{fmt(calories)} kcal</Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{durationMin} min · {intensity}</Text>
          </View>
          <Button label="Save workout" loadingLabel="Saving..." icon="check" onPress={save} style={{ marginTop: 0, paddingHorizontal: 22 }} />
        </View>
      }
    >
      <SectionHeader title="Quick start" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
        {TEMPLATES.map((template) => (
          <Pressable key={template.key} onPress={() => applyTemplate(template)} style={({ pressed }) => [s.template, { backgroundColor: colors.surface.primary, borderColor: name === template.name ? colors.primary : colors.border.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Icon name={template.icon} size={24} color={FIT.workout} />
            <Text numberOfLines={1} style={[s.templateName, { color: colors.text.primary }]}>{template.name}</Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{template.durationMin} min</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title="Activity" />
      <View style={s.typeGrid}>
        {WORKOUT_TYPES.map((item) => {
          const selected = item.value === type;
          return (
            <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setType(item.value as Workout['type']); if (!name || WORKOUT_TYPES.some((t) => t.label === name)) setName(item.label); }} style={[s.typeTile, { backgroundColor: selected ? colors.primary : colors.surface.primary, borderColor: selected ? colors.primary : colors.border.primary }]}>
              <Icon name={item.icon} size={22} color={selected ? colors.onPrimary : colors.text.secondary} />
              <Text style={[s.typeLabel, { color: selected ? colors.onPrimary : colors.text.primary }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="Name" value={name} onChangeText={setName} placeholder={workoutMeta(type).label} style={{ marginTop: 12 }} />

      <Card>
        <Text style={[s.cardLabel, { color: colors.text.secondary }]}>Duration</Text>
        <Stepper value={durationMin} onChange={setDurationMin} step={5} min={5} max={600} suffix="min" />
        <View style={s.quickRow}>
          {[15, 30, 45, 60, 90].map((minutes) => <Chip key={minutes} label={`${minutes}`} selected={durationMin === minutes} onPress={() => setDurationMin(minutes)} />)}
        </View>
      </Card>

      <Card>
        <Text style={[s.cardLabel, { color: colors.text.secondary }]}>Intensity</Text>
        <Segmented value={intensity} onChange={(value) => setIntensity(value as Workout['intensity'])} options={[{ label: 'Light', value: 'light' }, { label: 'Moderate', value: 'moderate' }, { label: 'Vigorous', value: 'vigorous' }]} />
        <Muted style={{ fontSize: 13 }}>{INTENSITY_HINTS[intensity]}</Muted>
      </Card>

      <Card>
        <View style={s.estimateRow}>
          <Icon name="fire" size={24} color={FIT.workout} />
          <View style={{ flex: 1 }}>
            <Text style={[s.estimate, { color: colors.text.primary }]}>~{fmt(estimate)} kcal burned</Text>
            <Muted style={{ fontSize: 12 }}>Estimated from activity type, intensity, duration and your {weightKg} kg body weight.</Muted>
          </View>
        </View>
        <Field label="Use a watch reading instead (optional)" value={calorieOverride} onChangeText={(value) => setCalorieOverride(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" suffix="kcal" style={{ marginTop: 12, marginBottom: 0 }} />
      </Card>

      {type === 'strength' || type === 'hiit' || exercises.length ? (
        <>
          <SectionHeader title="Exercises" action="Add" onAction={() => setExercises((old) => [...old, { name: '', sets: 3, reps: 10 }])} />
          <Card>
            {exercises.length ? (
              <View>
                <View style={s.exerciseHead}>
                  <Text style={[s.exHeadText, { flex: 1, color: colors.text.tertiary }]}>Exercise</Text>
                  <Text style={[s.exHeadText, s.exSmall, { color: colors.text.tertiary }]}>Sets</Text>
                  <Text style={[s.exHeadText, s.exSmall, { color: colors.text.tertiary }]}>Reps</Text>
                  <Text style={[s.exHeadText, s.exSmall, { color: colors.text.tertiary }]}>kg</Text>
                  <View style={{ width: 22 }} />
                </View>
                {exercises.map((exercise, index) => (
                  <View key={index} style={s.exerciseRow}>
                    <TextInput value={exercise.name} onChangeText={(value) => updateExercise(index, 'name', value)} placeholder="Exercise" placeholderTextColor={colors.text.tertiary} style={[s.exInput, { flex: 1, color: colors.text.primary, borderColor: colors.border.primary }]} />
                    {(['sets', 'reps', 'weightKg'] as const).map((key) => (
                      <TextInput key={key} value={exercise[key] ? String(exercise[key]) : ''} onChangeText={(value) => updateExercise(index, key, value)} keyboardType="decimal-pad" placeholder="-" placeholderTextColor={colors.text.tertiary} style={[s.exInput, s.exSmall, { color: colors.text.primary, borderColor: colors.border.primary }]} />
                    ))}
                    <Pressable accessibilityLabel="Remove exercise" hitSlop={8} onPress={() => setExercises((old) => old.filter((_, i) => i !== index))}><Icon name="close" size={20} color={colors.text.tertiary} /></Pressable>
                  </View>
                ))}
              </View>
            ) : <Muted style={{ fontSize: 13, marginBottom: 8 }}>Track sets, reps and weight to see your strength progress.</Muted>}
            <View style={[s.quickRow, { marginTop: 12 }]}>
              {COMMON_EXERCISES.filter((exercise) => !exercises.some((item) => item.name === exercise)).slice(0, 6).map((exercise) => (
                <Chip key={exercise} label={`+ ${exercise}`} onPress={() => setExercises((old) => [...old, { name: exercise, sets: 3, reps: exercise.includes('sec') ? 45 : 10 }])} />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="How did it feel? Any personal bests?" multiline />

      {recent.length ? (
        <>
          <SectionHeader title="Repeat a recent workout" />
          <Card style={{ paddingVertical: 4 }}>
            {recent.map((workout, index) => (
              <Pressable key={workout._id} onPress={() => applyTemplate(workout)} style={[s.recentRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.primary }]}>
                <Icon name={workoutMeta(workout.type).icon} size={20} color={FIT.workout} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{workout.name}</Text>
                  <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{shortDate(workout.date)} · {workout.durationMin} min · {fmt(workout.caloriesBurned)} kcal</Text>
                </View>
                <Icon name="replay" size={20} color={colors.primary} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </FitnessPage>
  );
};

const s = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerKcal: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  template: { width: 130, borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 4 },
  templateName: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeTile: { width: '18.5%', flexGrow: 1, alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 10, gap: 4 },
  typeLabel: { fontSize: 11, fontWeight: '700' },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  estimate: { fontSize: 18, fontWeight: '800' },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  exHeadText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  exInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, fontSize: 14 },
  exSmall: { width: 48, textAlign: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
});
