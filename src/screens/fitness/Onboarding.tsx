import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi } from '../../services/fitnessApi';
import { Button, Card, ChipGroup, FIT, Field, FitnessPage, Muted, OptionCards, ProgressBar, errorMessage, fmt, timezone } from './ui';

type Props = { navigation?: any; route?: any };

const ACTIVITY_FACTORS: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, extra_active: 1.9 };
const PACE: Record<string, Record<string, number>> = {
  lose: { relaxed: -250, standard: -500, aggressive: -750 },
  gain: { relaxed: 150, standard: 300, aggressive: 450 },
  maintain: { relaxed: 0, standard: 0, aggressive: 0 },
};

/** Mirrors server/utils/fitnessCalculations.js so the review step can preview the plan. */
const previewPlan = (form: any) => {
  const age = Number(form.age);
  const height = Number(form.heightCm);
  const weight = Number(form.weightKg);
  if (!age || !height || !weight) return null;
  const offset = form.sex === 'male' ? 5 : form.sex === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + offset;
  const tdee = bmr * (ACTIVITY_FACTORS[form.activityLevel] || 1.55);
  const minimum = form.sex === 'female' ? 1200 : 1500;
  const calories = Math.round(Math.max(minimum, tdee + (PACE[form.goal]?.[form.pace] || 0)));
  const protein = weight * (form.goal === 'lose' ? 1.8 : 1.6);
  const fat = Math.max((calories * 0.25) / 9, weight * 0.6);
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
  const bmi = weight / ((height / 100) ** 2);
  return { calories, tdee: Math.round(tdee), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), bmi: Math.round(bmi * 10) / 10, floorApplied: calories === minimum };
};

const STEPS = ['Goal', 'About you', 'Body', 'Activity', 'Your plan'];

export const FitnessOnboarding = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const editing = !!route?.params?.edit;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [form, setForm] = useState<any>({ goal: 'lose', pace: 'standard', sex: '', age: '', heightCm: '', weightKg: '', targetWeightKg: '', activityLevel: 'light' });
  const set = (key: string) => (value: string) => setForm((old: any) => ({ ...old, [key]: value }));
  const setNumber = (key: string) => (value: string) => setForm((old: any) => ({ ...old, [key]: value.replace(/[^0-9.]/g, '') }));

  useEffect(() => {
    if (!editing) return;
    fitnessApi.getProfile()
      .then((response) => {
        const profile = response.data.profile;
        if (profile) {
          setForm({
            goal: profile.goal, pace: profile.pace || 'standard', sex: profile.sex, age: String(profile.age),
            heightCm: String(profile.heightCm), weightKg: String(profile.weightKg),
            targetWeightKg: profile.targetWeightKg ? String(profile.targetWeightKg) : '', activityLevel: profile.activityLevel,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editing]);

  const plan = useMemo(() => previewPlan(form), [form]);
  const weeklyKg = Math.round((Math.abs(PACE[form.goal]?.[form.pace] || 0) * 7 / 7700) * 100) / 100;

  const validate = (): string | null => {
    if (step === 1) {
      if (!form.sex) return 'Select an option for sex so we can estimate your metabolism.';
      const age = Number(form.age);
      if (!age || age < 13 || age > 100) return 'Enter an age between 13 and 100.';
    }
    if (step === 2) {
      const height = Number(form.heightCm);
      const weight = Number(form.weightKg);
      if (!height || height < 100 || height > 250) return 'Enter a height between 100 and 250 cm.';
      if (!weight || weight < 25 || weight > 350) return 'Enter a weight between 25 and 350 kg.';
      if (form.targetWeightKg) {
        const target = Number(form.targetWeightKg);
        if (target < 25 || target > 350) return 'Enter a target weight between 25 and 350 kg.';
        if (form.goal === 'lose' && target >= weight) return 'For weight loss, the target should be below your current weight.';
        if (form.goal === 'gain' && target <= weight) return 'For weight gain, the target should be above your current weight.';
      }
    }
    return null;
  };

  const next = () => {
    const problem = validate();
    if (problem) { Alert.alert('Almost there', problem); return; }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const back = () => (step === 0 ? navigation?.goBack() : setStep((value) => value - 1));

  const save = async () => {
    try {
      await fitnessApi.saveProfile({
        ...form,
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        targetWeightKg: form.goal !== 'maintain' && form.targetWeightKg ? Number(form.targetWeightKg) : undefined,
        timezone: timezone(),
      } as any);
      await fitnessApi.clearDashboardCache().catch(() => {});
      if (editing) navigation.goBack();
      else navigation.replace('FitnessDashboard');
    } catch (error: any) {
      Alert.alert('Fitness plan', errorMessage(error, 'Please check your details and try again.'));
    }
  };

  if (loading) return <FitnessPage title="Edit plan" navigation={navigation}><ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /></FitnessPage>;

  return (
    <FitnessPage
      title={editing ? 'Edit your plan' : 'Create your plan'}
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
      navigation={{ goBack: back }}
      footer={
        <View style={s.footerRow}>
          {step > 0 ? <Button label="Back" variant="secondary" onPress={back} style={{ flex: 1 }} /> : null}
          {step < STEPS.length - 1
            ? <Button label="Continue" icon="arrow-right" onPress={next} style={{ flex: 2 }} />
            : <Button label={editing ? 'Save changes' : 'Start my plan'} loadingLabel="Saving..." icon="check" onPress={save} style={{ flex: 2 }} />}
        </View>
      }
    >
      <ProgressBar value={step + 1} target={STEPS.length} height={5} />
      <View style={{ height: 20 }} />

      {step === 0 ? (
        <>
          <Text style={[s.question, { color: colors.text.primary }]}>What is your main goal?</Text>
          <Muted style={s.help}>We will tune your calories, protein and habits around it. You can change it any time.</Muted>
          <OptionCards
            value={form.goal}
            onChange={set('goal')}
            options={[
              { value: 'lose', label: 'Lose weight', hint: 'Burn fat while keeping muscle with a moderate calorie deficit.', icon: 'trending-down' },
              { value: 'maintain', label: 'Maintain & get healthier', hint: 'Keep your weight steady and build consistent habits.', icon: 'scale-balance' },
              { value: 'gain', label: 'Build muscle / gain weight', hint: 'A small surplus with high protein to support lean gains.', icon: 'arm-flex' },
            ]}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={[s.question, { color: colors.text.primary }]}>Tell us about you</Text>
          <Muted style={s.help}>Used only to estimate your resting metabolism (Mifflin-St Jeor equation).</Muted>
          <Text style={[s.label, { color: colors.text.secondary }]}>Sex</Text>
          <ChipGroup value={form.sex} onChange={set('sex')} options={[{ label: 'Male', value: 'male', icon: 'gender-male' }, { label: 'Female', value: 'female', icon: 'gender-female' }, { label: 'Prefer not to say', value: 'other' }]} />
          <View style={{ height: 16 }} />
          <Field label="Age" value={form.age} onChangeText={setNumber('age')} keyboardType="number-pad" placeholder="e.g. 28" suffix="years" />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={[s.question, { color: colors.text.primary }]}>Your body measurements</Text>
          <Muted style={s.help}>Weigh yourself in the morning for the most consistent readings.</Muted>
          <View style={s.row}>
            <Field label="Height" value={form.heightCm} onChangeText={setNumber('heightCm')} keyboardType="decimal-pad" placeholder="170" suffix="cm" style={{ flex: 1 }} />
            <Field label="Current weight" value={form.weightKg} onChangeText={setNumber('weightKg')} keyboardType="decimal-pad" placeholder="70" suffix="kg" style={{ flex: 1 }} />
          </View>
          {form.goal !== 'maintain' ? (
            <>
              <Field label="Target weight (recommended)" value={form.targetWeightKg} onChangeText={setNumber('targetWeightKg')} keyboardType="decimal-pad" placeholder={form.goal === 'lose' ? '65' : '75'} suffix="kg" />
              <Text style={[s.label, { color: colors.text.secondary, marginTop: 6 }]}>How fast?</Text>
              <OptionCards
                value={form.pace}
                onChange={set('pace')}
                options={form.goal === 'lose' ? [
                  { value: 'relaxed', label: 'Relaxed · ~0.25 kg/week', hint: 'Easiest to sustain, minimal hunger.', icon: 'tortoise' },
                  { value: 'standard', label: 'Recommended · ~0.5 kg/week', hint: 'The best balance of speed and sustainability.', icon: 'check-decagram-outline' },
                  { value: 'aggressive', label: 'Fast · ~0.7 kg/week', hint: 'Harder to stick to. Best for short phases.', icon: 'rabbit' },
                ] : [
                  { value: 'relaxed', label: 'Lean · ~0.15 kg/week', hint: 'Minimises fat gain.', icon: 'tortoise' },
                  { value: 'standard', label: 'Recommended · ~0.3 kg/week', hint: 'Steady muscle gain with training.', icon: 'check-decagram-outline' },
                  { value: 'aggressive', label: 'Fast · ~0.4 kg/week', hint: 'For hard gainers; expect some fat gain.', icon: 'rabbit' },
                ]}
              />
            </>
          ) : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text style={[s.question, { color: colors.text.primary }]}>How active are you?</Text>
          <Muted style={s.help}>Think about a typical week, not your best one. This also sets your step and workout targets.</Muted>
          <OptionCards
            value={form.activityLevel}
            onChange={set('activityLevel')}
            options={[
              { value: 'sedentary', label: 'Mostly sitting', hint: 'Desk job, little exercise.', icon: 'sofa-outline' },
              { value: 'light', label: 'Lightly active', hint: 'Light exercise 1–3 days/week or on your feet sometimes.', icon: 'walk' },
              { value: 'moderate', label: 'Moderately active', hint: 'Exercise 3–5 days/week.', icon: 'run' },
              { value: 'very_active', label: 'Very active', hint: 'Hard training 6–7 days/week.', icon: 'run-fast' },
              { value: 'extra_active', label: 'Athlete / physical job', hint: 'Twice-a-day training or heavy manual work.', icon: 'weight-lifter' },
            ]}
          />
        </>
      ) : null}

      {step === 4 && plan ? (
        <>
          <Text style={[s.question, { color: colors.text.primary }]}>Your personalised plan</Text>
          <Muted style={s.help}>Based on your details. Targets update automatically as you log new weigh-ins.</Muted>
          <Card style={{ alignItems: 'center' }}>
            <Text style={[s.bigNumber, { color: colors.primary }]}>{fmt(plan.calories)}</Text>
            <Text style={[s.bigLabel, { color: colors.text.secondary }]}>calories per day</Text>
            <Muted style={{ fontSize: 13, marginTop: 6, textAlign: 'center' }}>
              Maintenance is about {fmt(plan.tdee)} kcal{form.goal !== 'maintain' ? ` · expected change ~${weeklyKg} kg/week` : ''}
            </Muted>
            {plan.floorApplied ? <Muted style={{ fontSize: 12, marginTop: 6, textAlign: 'center', color: colors.status.warning }}>We applied a safe minimum intake. Consider a slower pace.</Muted> : null}
          </Card>
          <View style={s.row}>
            <MacroTile label="Protein" value={plan.protein} color={FIT.protein} />
            <MacroTile label="Carbs" value={plan.carbs} color={FIT.carbs} />
            <MacroTile label="Fat" value={plan.fat} color={FIT.fat} />
          </View>
          <Card>
            <PlanLine label="BMI" value={`${plan.bmi}`} />
            <PlanLine label="Daily water" value={`${(Math.round(Math.min(4500, Math.max(1500, Number(form.weightKg) * 35 + (['very_active', 'extra_active'].includes(form.activityLevel) ? 500 : 0))) / 50) * 50 / 1000).toFixed(1)} L`} />
            <PlanLine label="Daily steps" value={fmt({ sedentary: 6000, light: 7500, moderate: 9000, very_active: 10000, extra_active: 12000 }[form.activityLevel as string] || 8000)} />
            <PlanLine label="Workouts per week" value={String({ sedentary: 2, light: 3, moderate: 4, very_active: 5, extra_active: 6 }[form.activityLevel as string] || 3)} />
            <PlanLine label="Sleep" value="7–9 hours" last />
          </Card>
          <Muted style={{ fontSize: 12 }}>Saving also creates helpful meal, water and movement reminders. These are general wellness estimates, not medical advice. If you are pregnant, have a medical condition or a history of disordered eating, please consult a professional.</Muted>
        </>
      ) : null}
    </FitnessPage>
  );
};

const MacroTile = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
      <View style={[s.swatch, { backgroundColor: color }]} />
      <Text style={[s.macroValue, { color: colors.text.primary }]}>{value}g</Text>
      <Text style={[s.bigLabel, { color: colors.text.secondary }]}>{label}</Text>
    </Card>
  );
};

const PlanLine = ({ label, value, last }: { label: string; value: string; last?: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={[s.planLine, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.primary }]}>
      <Text style={{ color: colors.text.secondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>{value}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  question: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  help: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  footerRow: { flexDirection: 'row', gap: 10 },
  bigNumber: { fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigLabel: { fontSize: 13, fontWeight: '600' },
  swatch: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  macroValue: { fontSize: 20, fontWeight: '800' },
  planLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
});
