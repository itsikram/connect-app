import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi } from '../../services/fitnessApi';
import {
  BarChart, Button, Card, EmptyState, FIT, FitnessPage, HeaderIconButton, Icon, IconName, MEAL_TYPES, Muted,
  ProgressBar, Ring, SectionHeader, Stepper, errorMessage, fmt, greeting, num, ratio, shortDay, workoutMeta,
} from './ui';

type Props = { navigation?: any };

const PILLAR_ACTIONS: Record<string, { title: string; body: string; icon: IconName; cta: string; route?: string }> = {
  nutrition: { title: 'Log your next meal', body: 'Tracking every meal is the #1 predictor of reaching a nutrition goal.', icon: 'silverware-fork-knife', cta: 'Add meal', route: 'FitnessMeal' },
  protein: { title: 'Prioritise protein', body: 'Protein keeps you full and protects muscle. Add a protein-rich meal or snack.', icon: 'food-drumstick', cta: 'Get ideas', route: 'FitnessRecommendations' },
  hydration: { title: 'Drink a glass of water', body: 'You are behind on hydration today. A glass now keeps energy and focus up.', icon: 'cup-water', cta: '+250 ml' },
  steps: { title: 'Take a 10-minute walk', body: 'A brisk 10-minute walk adds roughly 1,000 steps.', icon: 'walk', cta: 'Log walk', route: 'FitnessWorkout' },
  activity: { title: 'Get 30 active minutes', body: 'Any movement counts: a workout, a sport, or a brisk walk.', icon: 'dumbbell', cta: 'Log workout', route: 'FitnessWorkout' },
  sleep: { title: 'Log last night’s sleep', body: '7–9 hours of sleep supports recovery, appetite control and mood.', icon: 'power-sleep', cta: 'Log sleep' },
};

const scoreLabel = (score: number) => (score >= 85 ? 'Excellent' : score >= 65 ? 'On track' : score >= 40 ? 'Building' : 'Just getting started');

export const FitnessDashboard = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<null | 'steps' | 'sleep'>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fitnessApi.getDashboard();
      if (!mounted.current) return;
      setData(response.data);
      fitnessApi.cacheDashboard(response.data).catch(() => {});
    } catch (requestError: any) {
      if (mounted.current) setError(errorMessage(requestError, 'Could not load your fitness summary.'));
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fitnessApi.getCachedDashboard()
      .then((cached) => { if (mounted.current && cached) { setData(cached); setLoading(false); } })
      .catch(() => {})
      .finally(refresh);
    const unsubscribe = navigation?.addListener?.('focus', refresh);
    return () => { mounted.current = false; unsubscribe?.(); };
  }, [navigation, refresh]);

  // iOS exposes today's step history; sync it when it is ahead of the stored value.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !data?.profile) return;
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, new Date());
        if (result?.steps > (data.habits?.steps || 0)) {
          await fitnessApi.updateDaily({ steps: result.steps });
          setData((old: any) => (old ? { ...old, habits: { ...old.habits, steps: result.steps } } : old));
        }
      } catch (_) {
        // Motion permission denied or unavailable: manual entry still works.
      }
    })();
  }, [data?.profile, data?.habits?.steps]);

  const updateHabits = async (patch: Record<string, number>, optimistic: Record<string, number>) => {
    const previous = data;
    setData((old: any) => ({ ...old, habits: { ...old.habits, ...optimistic } }));
    try {
      const response = await fitnessApi.updateDaily(patch);
      const daily = response.data.daily || {};
      setData((old: any) => ({ ...old, habits: { ...old.habits, waterMl: daily.waterMl ?? 0, steps: daily.steps ?? 0, sleepHours: daily.sleepHours ?? 0 } }));
      refresh();
    } catch (requestError: any) {
      setData(previous);
      Alert.alert('Fitness', errorMessage(requestError, 'Could not save. Please try again.'));
    }
  };

  const addWater = (amount: number) => updateHabits({ addWaterMl: amount }, { waterMl: Math.max(0, (data?.habits?.waterMl || 0) + amount) });

  const deleteMeal = (meal: any) => Alert.alert('Delete meal', `Remove "${meal.name}" from today?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await fitnessApi.deleteMeal(meal._id); refresh(); } catch (e: any) { Alert.alert('Meal', errorMessage(e, 'Could not delete this meal')); } } },
  ]);

  const deleteWorkout = (workout: any) => Alert.alert('Delete workout', `Remove "${workout.name}"?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await fitnessApi.deleteWorkout(workout._id); refresh(); } catch (e: any) { Alert.alert('Workout', errorMessage(e, 'Could not delete this workout')); } } },
  ]);

  const openSettings = () => Alert.alert('Fitness plan', undefined, [
    { text: 'Edit my plan', onPress: () => navigation.navigate('FitnessOnboarding', { edit: true }) },
    { text: 'Reminders', onPress: () => navigation.navigate('FitnessReminders') },
    {
      text: 'Reset all fitness data',
      style: 'destructive',
      onPress: () => Alert.alert('Reset fitness data', 'This permanently deletes your profile, meals, workouts, weights, habits and reminders.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => { try { await fitnessApi.resetFitness(); await fitnessApi.clearDashboardCache(); setData({ profile: null }); } catch (e: any) { Alert.alert('Fitness', errorMessage(e, 'Could not reset fitness data')); } } },
      ]),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);

  if (loading && !data) {
    return <FitnessPage title="Fitness" navigation={navigation}><View style={s.center}><ActivityIndicator size="large" color={colors.primary} /><Muted style={{ marginTop: 12 }}>Loading your day...</Muted></View></FitnessPage>;
  }
  if (error && !data) {
    return <FitnessPage title="Fitness" navigation={navigation}><EmptyState icon="wifi-off" title="Could not load your summary" message={error} action="Try again" onAction={() => { setLoading(true); refresh(); }} /></FitnessPage>;
  }
  if (!data?.profile) {
    return (
      <FitnessPage title="Fitness" navigation={navigation}>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View style={[s.heroIcon, { backgroundColor: colors.primary }]}><Icon name="heart-pulse" size={34} color="#001014" /></View>
          <Text style={[s.welcomeTitle, { color: colors.text.primary }]}>Your personal health coach</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>Answer a few questions and get science-based daily targets for calories, macros, water, steps, workouts and sleep, plus a projected date for reaching your goal.</Muted>
          {[
            ['target', 'Personal calorie & macro targets'],
            ['chart-line', 'Weight trend and goal projection'],
            ['run', 'Workout, steps, water & sleep tracking'],
            ['robot-happy-outline', 'AI meal analysis and coaching'],
          ].map(([icon, text]) => (
            <View key={text} style={s.featureRow}><Icon name={icon as IconName} size={20} color={colors.primary} /><Text style={[s.featureText, { color: colors.text.primary }]}>{text}</Text></View>
          ))}
          <Button label="Create my plan" icon="arrow-right" onPress={() => navigation.navigate('FitnessOnboarding')} style={{ alignSelf: 'stretch', marginTop: 18 }} />
        </Card>
      </FitnessPage>
    );
  }

  const { profile, totals = {}, burn = {}, habits = {}, week = [], weekSummary = {}, goalProgress, score, streak = 0 } = data;
  const target = num(profile.targetCalories);
  const eaten = num(totals.calories);
  const burned = num(burn.caloriesBurned);
  const remaining = target - eaten + burned;
  const over = remaining < 0;
  const macros = [
    { label: 'Protein', value: totals.proteinG, target: profile.macros?.proteinG, color: FIT.protein },
    { label: 'Carbs', value: totals.carbsG, target: profile.macros?.carbsG, color: FIT.carbs },
    { label: 'Fat', value: totals.fatG, target: profile.macros?.fatG, color: FIT.fat },
  ];
  const weakest = (score?.pillars || []).filter((pillar: any) => pillar.percent < 100).sort((a: any, b: any) => a.percent * b.weight - b.percent * a.weight)[0];
  const nextAction = weakest ? PILLAR_ACTIONS[weakest.key] : null;
  const runAction = () => {
    if (!weakest || !nextAction) return;
    if (weakest.key === 'hydration') return addWater(250);
    if (weakest.key === 'sleep') return setSheet('sleep');
    navigation.navigate(nextAction.route, weakest.key === 'steps' ? { preset: 'walk' } : undefined);
  };
  const meals = data.meals || [];
  const workouts = data.workouts || [];
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <FitnessPage
      title="Fitness"
      subtitle={dateLabel}
      navigation={navigation}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); refresh(); }}
      right={<HeaderIconButton icon="cog-outline" label="Fitness settings" onPress={openSettings} />}
    >
      {error ? <View style={[s.banner, { backgroundColor: colors.surface.secondary }]}><Icon name="cloud-off-outline" size={16} color={colors.text.secondary} /><Muted style={{ flex: 1, fontSize: 13 }}>Offline. Showing your last saved summary.</Muted></View> : null}

      <View style={s.greetingRow}>
        <Text style={[s.greeting, { color: colors.text.primary }]}>{greeting()}</Text>
        <View style={[s.streak, { backgroundColor: colors.surface.secondary, borderColor: colors.border.primary }]}>
          <Icon name="fire" size={16} color={streak > 0 ? FIT.carbs : colors.text.tertiary} />
          <Text style={[s.streakText, { color: colors.text.primary }]}>{streak} day{streak === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <Card>
        <View style={s.calorieRow}>
          <Ring size={138} stroke={13} progress={ratio(eaten, target + burned)} color={over ? colors.status.warning : colors.primary}>
            <Text style={[s.ringNumber, { color: colors.text.primary }]}>{fmt(Math.abs(remaining))}</Text>
            <Text style={[s.ringLabel, { color: colors.text.secondary }]}>{over ? 'kcal over' : 'kcal left'}</Text>
          </Ring>
          <View style={s.calorieStats}>
            <CalorieLine icon="flag-checkered" label="Target" value={target} />
            <CalorieLine icon="silverware-fork-knife" label="Food" value={eaten} sign="-" />
            <CalorieLine icon="fire" label="Exercise" value={burned} sign="+" />
          </View>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border.primary }]} />
        <View style={s.macroRow}>
          {macros.map((macro) => (
            <View key={macro.label} style={s.macro}>
              <View style={s.macroHead}>
                <View style={[s.swatch, { backgroundColor: macro.color }]} />
                <Text style={[s.macroLabel, { color: colors.text.secondary }]}>{macro.label}</Text>
              </View>
              <Text style={[s.macroValue, { color: colors.text.primary }]}>{num(macro.value)}<Text style={{ color: colors.text.tertiary, fontWeight: '500' }}>/{num(macro.target)}g</Text></Text>
              <ProgressBar value={macro.value} target={macro.target} color={macro.color} height={6} />
            </View>
          ))}
        </View>
      </Card>

      {score ? (
        <Card>
          <View style={s.scoreRow}>
            <Ring size={64} stroke={7} progress={score.score / 100} color={colors.status.success}>
              <Text style={[s.scoreNumber, { color: colors.text.primary }]}>{score.score}</Text>
            </Ring>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: colors.text.primary }]}>Daily health score</Text>
              <Muted style={{ fontSize: 13 }}>{scoreLabel(score.score)} · nutrition, protein, water, steps, activity & sleep</Muted>
            </View>
          </View>
          {nextAction ? (
            <View style={[s.nextAction, { backgroundColor: colors.surface.secondary }]}>
              <Icon name={nextAction.icon} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.nextTitle, { color: colors.text.primary }]}>Next best step: {nextAction.title}</Text>
                <Muted style={{ fontSize: 13 }}>{nextAction.body}</Muted>
              </View>
              <Pressable onPress={runAction} style={[s.nextButton, { backgroundColor: colors.primary }]}><Text style={s.nextButtonText}>{nextAction.cta}</Text></Pressable>
            </View>
          ) : <Muted style={{ marginTop: 10 }}>Every target hit today. Outstanding work!</Muted>}
        </Card>
      ) : null}

      <SectionHeader title="Daily habits" />
      <View style={s.grid}>
        <HabitCard
          icon="cup-water" color={FIT.water} label="Water"
          value={`${(num(habits.waterMl) / 1000).toFixed(1)}`} unit={`/ ${(num(profile.waterTargetMl) / 1000).toFixed(1)} L`}
          progress={ratio(habits.waterMl, profile.waterTargetMl)}
        >
          <View style={s.waterButtons}>
            <SmallButton label="-" onPress={() => addWater(-250)} disabled={!habits.waterMl} />
            <SmallButton label="+250" onPress={() => addWater(250)} primary />
            <SmallButton label="+500" onPress={() => addWater(500)} />
          </View>
        </HabitCard>
        <HabitCard
          icon="shoe-print" color={FIT.steps} label="Steps"
          value={fmt(habits.steps)} unit={`/ ${fmt(profile.stepTarget)}`}
          progress={ratio(habits.steps, profile.stepTarget)} onPress={() => setSheet('steps')} hint="Tap to update"
        />
        <HabitCard
          icon="dumbbell" color={FIT.workout} label="Workouts this week"
          value={String(weekSummary.workouts || 0)} unit={`/ ${weekSummary.workoutTarget || profile.weeklyWorkoutTarget || 3}`}
          progress={ratio(weekSummary.workouts, weekSummary.workoutTarget || profile.weeklyWorkoutTarget)}
          onPress={() => navigation.navigate('FitnessWorkout')} hint={`${num(burn.durationMin)} active min today`}
        />
        <HabitCard
          icon="power-sleep" color={FIT.sleep} label="Sleep"
          value={Number(habits.sleepHours || 0).toFixed(1)} unit={`/ ${profile.sleepTargetHours || 8} h`}
          progress={ratio(habits.sleepHours, profile.sleepTargetHours || 8)} onPress={() => setSheet('sleep')} hint="Tap to log"
        />
      </View>

      <GoalCard profile={profile} goalProgress={goalProgress} currentWeightKg={data.currentWeightKg} onPress={() => navigation.navigate('FitnessWeight')} />

      <Card>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.text.primary }]}>Calories this week</Text>
          <Pressable hitSlop={8} onPress={() => navigation.navigate('FitnessProgress')}><Text style={[s.link, { color: colors.primary }]}>Insights</Text></Pressable>
        </View>
        <BarChart
          data={week.map((day: any) => ({ label: shortDay(day.date), value: day.calories, detail: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }))}
          target={target}
          unit=" kcal"
          height={110}
          emptyLabel="Log meals to see your week"
        />
        <Muted style={{ fontSize: 12, marginTop: 8 }}>Dashed line: your {fmt(target)} kcal daily target</Muted>
      </Card>

      <SectionHeader title="Today's meals" action="Add" onAction={() => navigation.navigate('FitnessMeal')} />
      <Card style={{ paddingVertical: 4 }}>
        {MEAL_TYPES.map((type, index) => {
          const items = meals.filter((meal: any) => (meal.mealType || 'snack') === type.value);
          const kcal = items.reduce((sum: number, meal: any) => sum + (Number(meal.calories) || 0), 0);
          return (
            <View key={type.value} style={[s.mealGroup, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.primary }]}>
              <View style={s.mealGroupHead}>
                <Icon name={type.icon} size={20} color={colors.text.secondary} />
                <Text style={[s.mealGroupTitle, { color: colors.text.primary }]}>{type.label}</Text>
                <Text style={[s.mealGroupKcal, { color: colors.text.secondary }]}>{kcal ? `${fmt(kcal)} kcal` : ''}</Text>
                <Pressable accessibilityLabel={`Add ${type.label}`} hitSlop={8} onPress={() => navigation.navigate('FitnessMeal', { mealType: type.value })} style={[s.addCircle, { backgroundColor: colors.surface.secondary }]}>
                  <Icon name="plus" size={18} color={colors.primary} />
                </Pressable>
              </View>
              {items.map((meal: any) => (
                <Pressable key={meal._id} onPress={() => navigation.navigate('FitnessMeal', { meal })} onLongPress={() => deleteMeal(meal)} style={s.mealItem}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[s.mealName, { color: colors.text.primary }]}>{meal.name}</Text>
                    <Text style={[s.mealMacros, { color: colors.text.tertiary }]}>P {num(meal.proteinG)}g · C {num(meal.carbsG)}g · F {num(meal.fatG)}g</Text>
                  </View>
                  <Text style={[s.mealKcal, { color: colors.text.primary }]}>{fmt(meal.calories)}</Text>
                  <Pressable accessibilityLabel={`Delete ${meal.name}`} hitSlop={8} onPress={() => deleteMeal(meal)}>
                    <Icon name="trash-can-outline" size={18} color={colors.text.tertiary} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Today's activity" action="Log workout" onAction={() => navigation.navigate('FitnessWorkout')} />
      <Card>
        {workouts.length ? workouts.map((workout: any, index: number) => {
          const meta = workoutMeta(workout.type);
          return (
            <View key={workout._id} style={[s.workoutRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.primary }]}>
              <View style={[s.workoutIcon, { backgroundColor: colors.surface.secondary }]}><Icon name={meta.icon} size={20} color={FIT.workout} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.mealName, { color: colors.text.primary }]}>{workout.name}</Text>
                <Text style={[s.mealMacros, { color: colors.text.tertiary }]}>{workout.durationMin} min · {workout.intensity}{workout.exercises?.length ? ` · ${workout.exercises.length} exercises` : ''}</Text>
              </View>
              <Text style={[s.mealKcal, { color: colors.text.primary }]}>{fmt(workout.caloriesBurned)} kcal</Text>
              <Pressable accessibilityLabel={`Delete ${workout.name}`} hitSlop={8} onPress={() => deleteWorkout(workout)}><Icon name="trash-can-outline" size={18} color={colors.text.tertiary} /></Pressable>
            </View>
          );
        }) : <EmptyState icon="run" title="No activity logged yet" message="Workouts add to your calorie budget and your weekly goal." action="Log a workout" onAction={() => navigation.navigate('FitnessWorkout')} />}
      </Card>

      <SectionHeader title="Tools" />
      <View style={s.grid}>
        <ToolTile icon="robot-happy-outline" label="AI coach" hint="Ask anything" onPress={() => navigation.navigate('FitnessCoach')} />
        <ToolTile icon="lightbulb-on-outline" label="Meal ideas" hint="Fit your macros" onPress={() => navigation.navigate('FitnessRecommendations')} />
        <ToolTile icon="chart-timeline-variant" label="Progress" hint="Trends & insights" onPress={() => navigation.navigate('FitnessProgress')} />
        <ToolTile icon="bell-ring-outline" label="Reminders" hint="Build habits" onPress={() => navigation.navigate('FitnessReminders')} />
      </View>
      <Muted style={{ fontSize: 12, textAlign: 'center', marginTop: 14 }}>General wellness guidance, not medical advice. Consult a professional for medical conditions.</Muted>

      <ValueSheet
        visible={sheet === 'steps'}
        title="Steps today"
        initial={num(habits.steps)}
        step={500}
        max={100000}
        suffix="steps"
        onClose={() => setSheet(null)}
        onSave={(value) => { setSheet(null); updateHabits({ steps: value }, { steps: value }); }}
      />
      <ValueSheet
        visible={sheet === 'sleep'}
        title="Hours slept last night"
        initial={Number(habits.sleepHours) || 7}
        step={0.5}
        max={16}
        decimals={1}
        suffix="h"
        onClose={() => setSheet(null)}
        onSave={(value) => { setSheet(null); updateHabits({ sleepHours: value }, { sleepHours: value }); }}
      />
    </FitnessPage>
  );
};

const CalorieLine = ({ icon, label, value, sign }: { icon: IconName; label: string; value: number; sign?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={s.calorieLine}>
      <Icon name={icon} size={18} color={colors.text.tertiary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.calorieLabel, { color: colors.text.secondary }]}>{label}</Text>
        <Text style={[s.calorieValue, { color: colors.text.primary }]}>{sign && value ? `${sign} ` : ''}{fmt(value)}</Text>
      </View>
    </View>
  );
};

const HabitCard = ({ icon, color, label, value, unit, progress, onPress, hint, children }: { icon: IconName; color: string; label: string; value: string; unit: string; progress: number; onPress?: () => void; hint?: string; children?: React.ReactNode }) => {
  const { colors } = useTheme();
  const done = progress >= 1;
  return (
    <Card style={s.habit} onPress={onPress}>
      <View style={s.habitHead}>
        <Icon name={icon} size={20} color={color} />
        <Text numberOfLines={1} style={[s.habitLabel, { color: colors.text.secondary }]}>{label}</Text>
        {done ? <Icon name="check-circle" size={16} color={colors.status.success} /> : null}
      </View>
      <Text style={[s.habitValue, { color: colors.text.primary }]}>{value} <Text style={[s.habitUnit, { color: colors.text.tertiary }]}>{unit}</Text></Text>
      <ProgressBar value={progress} target={1} color={color} height={6} />
      {children || (hint ? <Text style={[s.habitHint, { color: colors.text.tertiary }]}>{hint}</Text> : null)}
    </Card>
  );
};

const SmallButton = ({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) => {
  const { colors } = useTheme();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[s.smallButton, { backgroundColor: primary ? FIT.water : colors.surface.secondary, opacity: disabled ? 0.4 : 1 }]}>
      <Text style={[s.smallButtonText, { color: primary ? '#ffffff' : colors.text.primary }]}>{label}</Text>
    </Pressable>
  );
};

const GoalCard = ({ profile, goalProgress, currentWeightKg, onPress }: { profile: any; goalProgress: any; currentWeightKg?: number; onPress: () => void }) => {
  const { colors } = useTheme();
  const current = currentWeightKg || profile.weightKg;
  const bmiText = profile.bmi ? `BMI ${profile.bmi}${profile.bmiCategory ? ` · ${profile.bmiCategory}` : ''}` : '';
  return (
    <Card onPress={onPress} style={profile.goal !== 'lose' ? { marginTop: 10 } : undefined}>
      <View style={s.cardHeader}>
        <Text style={[s.cardTitle, { color: colors.text.primary }]}>{profile.goal === 'lose' ? 'Weight-loss goal' : profile.goal === 'gain' ? 'Weight-gain goal' : 'Maintain weight'}</Text>
        <Text style={[s.link, { color: colors.primary }]}>Log weight</Text>
      </View>
      {goalProgress ? (
        <>
          <View style={s.goalNumbers}>
            <GoalNumber label="Start" value={goalProgress.startWeightKg} />
            <GoalNumber label="Current" value={current} emphasis />
            <GoalNumber label="Target" value={goalProgress.targetWeightKg} />
          </View>
          <ProgressBar value={goalProgress.percent} target={100} color={FIT.weight} height={10} />
          <Muted style={{ fontSize: 13, marginTop: 8 }}>
            {goalProgress.reached
              ? 'Goal reached! Switch to maintenance in your plan to lock in your result.'
              : `${goalProgress.percent}% done · ${goalProgress.remainingKg} kg to go${goalProgress.eta ? ` · on pace for ${new Date(goalProgress.eta).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`}
          </Muted>
          {bmiText ? <Muted style={{ fontSize: 12, marginTop: 2 }}>{bmiText} · {goalProgress.weeklyKg} kg/week planned</Muted> : null}
        </>
      ) : (
        <>
          <Text style={[s.habitValue, { color: colors.text.primary }]}>{Number(current).toFixed(1)} <Text style={[s.habitUnit, { color: colors.text.tertiary }]}>kg</Text></Text>
          <Muted style={{ fontSize: 13 }}>{bmiText}{profile.healthyWeightRangeKg ? ` · healthy range ${profile.healthyWeightRangeKg.min}–${profile.healthyWeightRangeKg.max} kg` : ''}</Muted>
          {profile.goal !== 'maintain' ? <Muted style={{ fontSize: 13, marginTop: 4 }}>Add a target weight in your plan to see a projected finish date.</Muted> : null}
        </>
      )}
    </Card>
  );
};

const GoalNumber = ({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[emphasis ? s.goalCurrent : s.goalValue, { color: colors.text.primary }]}>{Number(value).toFixed(1)}</Text>
      <Text style={[s.goalLabel, { color: colors.text.tertiary }]}>{label} (kg)</Text>
    </View>
  );
};

const ToolTile = ({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Card style={s.habit} onPress={onPress}>
      <Icon name={icon} size={24} color={colors.primary} />
      <Text style={[s.toolLabel, { color: colors.text.primary }]}>{label}</Text>
      <Text style={[s.habitHint, { color: colors.text.tertiary }]}>{hint}</Text>
    </Card>
  );
};

const ValueSheet = ({ visible, title, initial, step, max, decimals = 0, suffix, onClose, onSave }: { visible: boolean; title: string; initial: number; step: number; max: number; decimals?: number; suffix: string; onClose: () => void; onSave: (value: number) => void }) => {
  const { colors } = useTheme();
  const [value, setValue] = useState(initial);
  useEffect(() => { if (visible) setValue(initial); }, [visible, initial]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}>
        <View style={[s.handle, { backgroundColor: colors.border.secondary }]} />
        <Text style={[s.cardTitle, { color: colors.text.primary, textAlign: 'center', marginBottom: 18 }]}>{title}</Text>
        <Stepper value={value} onChange={setValue} step={step} max={max} decimals={decimals} suffix={suffix} />
        <Button label="Save" onPress={() => onSave(value)} style={{ marginTop: 22 }} />
        <Button label="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 60 },
  heroIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 12 },
  featureText: { fontSize: 15, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 12 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  greeting: { fontSize: 24, fontWeight: '800' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  streakText: { fontSize: 13, fontWeight: '700' },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringNumber: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLabel: { fontSize: 12, fontWeight: '600' },
  calorieStats: { flex: 1, gap: 10 },
  calorieLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calorieLabel: { fontSize: 12 },
  calorieValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  macroRow: { flexDirection: 'row', gap: 14 },
  macro: { flex: 1, gap: 4 },
  macroHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontSize: 12, fontWeight: '600' },
  macroValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreNumber: { fontSize: 20, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  link: { fontSize: 14, fontWeight: '700' },
  nextAction: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, marginTop: 14 },
  nextTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  nextButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  nextButtonText: { color: '#001014', fontWeight: '800', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 2 },
  habit: { width: '48.5%', flexGrow: 1, flexBasis: '46%', padding: 14, marginBottom: 0, gap: 6 },
  habitHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  habitLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  habitValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  habitUnit: { fontSize: 13, fontWeight: '600' },
  habitHint: { fontSize: 12 },
  waterButtons: { flexDirection: 'row', gap: 6, marginTop: 2 },
  smallButton: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 7 },
  smallButtonText: { fontSize: 13, fontWeight: '700' },
  goalNumbers: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  goalValue: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalCurrent: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  goalLabel: { fontSize: 11, marginTop: 2 },
  mealGroup: { paddingVertical: 10 },
  mealGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealGroupTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  mealGroupKcal: { fontSize: 13, fontVariant: ['tabular-nums'] },
  addCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mealItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 30, paddingTop: 10 },
  mealName: { fontSize: 14, fontWeight: '600' },
  mealMacros: { fontSize: 12, marginTop: 2 },
  mealKcal: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  workoutIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
});
