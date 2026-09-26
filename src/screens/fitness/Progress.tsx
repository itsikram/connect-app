import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi, ProgressPeriod } from '../../services/fitnessApi';
import { BarChart, Card, EmptyState, FIT, FitnessPage, Icon, IconName, LineChart, Muted, ProgressBar, SectionHeader, Segmented, StatTile, fmt, num, shortDate, shortDay } from './ui';

type Props = { navigation?: any };
type Point = { label: string; value: number; detail?: string };

const PERIODS = [
  { label: '7 days', value: 'weekly' },
  { label: '30 days', value: 'monthly' },
  { label: '90 days', value: 'quarterly' },
];

/**
 * One bar per day for 7/30 days; 90 days are rolled into weekly bars so bars stay
 * readable. `mode` controls whether a week shows the average of logged days or a sum.
 */
const series = (dayKeys: string[], valueByDay: Record<string, number>, period: string, mode: 'average' | 'sum'): Point[] => {
  if (period !== 'quarterly') {
    return dayKeys.map((day) => ({
      label: period === 'weekly' ? shortDay(day) : String(Number(day.slice(8))),
      value: valueByDay[day] || 0,
      detail: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    }));
  }
  const weeks: Point[] = [];
  for (let index = 0; index < dayKeys.length; index += 7) {
    const chunk = dayKeys.slice(index, index + 7);
    const values = chunk.map((day) => valueByDay[day] || 0);
    const logged = values.filter((value) => value > 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    weeks.push({
      label: shortDate(chunk[0]),
      value: mode === 'sum' ? total : logged.length ? total / logged.length : 0,
      detail: `Week of ${shortDate(chunk[0])}${mode === 'average' ? ' (daily avg)' : ''}`,
    });
  }
  return weeks;
};

const byDay = (items: any[], key: string, dayField = '_id') => Object.fromEntries((items || []).map((item) => [item[dayField], Number(item[key]) || 0]));

export const FitnessProgress = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<ProgressPeriod>('weekly');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fitnessApi.getProgress(period)
      .then((response) => { if (active) setData(response.data); })
      .catch(() => { if (active) setError('Could not load your progress. Pull down or switch periods to retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const summary = data?.summary || {};
  const targets = data?.targets || {};
  const dayKeys: string[] = data?.dayKeys || [];
  const nutrition = data?.nutrition || [];
  const loggedDays = summary.loggedDays || 0;
  const avgProtein = loggedDays ? summary.totalProteinG / loggedDays : 0;
  const avgCarbs = loggedDays ? summary.totalCarbsG / loggedDays : 0;
  const avgFat = loggedDays ? summary.totalFatG / loggedDays : 0;

  const insights: Array<{ icon: IconName; text: string }> = [];
  if (loggedDays) {
    insights.push({ icon: 'target', text: `You were within 10% of your calorie target on ${summary.onTargetDays} of ${loggedDays} logged days (${summary.adherencePercent}%).` });
    if (targets.proteinG) {
      const pct = Math.round((avgProtein / targets.proteinG) * 100);
      insights.push({ icon: 'food-drumstick', text: pct >= 90 ? `Great protein consistency: ${num(avgProtein)} g/day on average (${pct}% of target).` : `Protein averaged ${num(avgProtein)} g/day, ${pct}% of your ${num(targets.proteinG)} g target. Add a protein source to each meal.` });
    }
  } else {
    insights.push({ icon: 'silverware-fork-knife', text: 'Log meals regularly to unlock nutrition insights. Consistency matters more than perfection.' });
  }
  if (summary.workoutCount) insights.push({ icon: 'dumbbell', text: `${summary.workoutCount} workout${summary.workoutCount === 1 ? '' : 's'} · ${fmt(summary.activeMinutes)} active minutes · ${fmt(summary.caloriesBurned)} kcal burned.` });
  else insights.push({ icon: 'run', text: 'No workouts logged in this period. Aim for at least 150 minutes of moderate activity per week.' });
  if (summary.averageSleepHours && summary.averageSleepHours < 7) insights.push({ icon: 'power-sleep', text: `You averaged ${summary.averageSleepHours} h of sleep. Under 7 hours can increase appetite and slow recovery.` });
  if (summary.weightChangeKg) insights.push({ icon: summary.weightChangeKg < 0 ? 'trending-down' : 'trending-up', text: `Weight changed by ${summary.weightChangeKg > 0 ? '+' : ''}${summary.weightChangeKg} kg in this period.` });

  const weights = (data?.weights || []).map((entry: any) => ({ label: shortDate(entry.day || entry.date), value: entry.weightKg, detail: shortDate(entry.day || entry.date) }));

  return (
    <FitnessPage title="Progress" subtitle="Trends and insights" navigation={navigation}>
      <Segmented options={PERIODS} value={period} onChange={(value) => setPeriod(value as ProgressPeriod)} />
      {loading && !data ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
      {error && !data ? <EmptyState icon="wifi-off" title="Progress unavailable" message={error} /> : null}
      {data ? (
        <View style={{ opacity: loading ? 0.5 : 1 }}>
          <View style={s.tiles}>
            <StatTile icon="fire" label="Avg calories" value={fmt(summary.averageCalories)} unit="kcal" color={colors.primary} />
            <StatTile icon="bullseye-arrow" label="On-target days" value={`${summary.adherencePercent || 0}`} unit="%" color={colors.status.success} />
          </View>
          <View style={s.tiles}>
            <StatTile icon="dumbbell" label="Workouts" value={String(summary.workoutCount || 0)} color={FIT.workout} />
            <StatTile icon="shoe-print" label="Avg steps" value={fmt(summary.averageSteps)} color={FIT.steps} />
            <StatTile icon="power-sleep" label="Avg sleep" value={String(summary.averageSleepHours || 0)} unit="h" color={FIT.sleep} />
          </View>

          <SectionHeader title="Insights" />
          <Card>
            {insights.map((insight, index) => (
              <View key={index} style={[s.insight, index > 0 && { marginTop: 12 }]}>
                <Icon name={insight.icon} size={20} color={colors.primary} />
                <Text style={[s.insightText, { color: colors.text.primary }]}>{insight.text}</Text>
              </View>
            ))}
          </Card>

          <SectionHeader title="Weight" />
          <Card>
            {weights.length >= 2
              ? <LineChart data={weights} target={targets.targetWeightKg} color={FIT.weight} unit=" kg" />
              : <EmptyState icon="scale-bathroom" title="Not enough weigh-ins" message="Log your weight at least twice in this period to see a trend." action="Log weight" onAction={() => navigation.navigate('FitnessWeight')} />}
          </Card>

          <SectionHeader title="Calories eaten" />
          <Card>
            <BarChart data={series(dayKeys, byDay(nutrition, 'calories'), period, 'average')} target={targets.calories} unit=" kcal" emptyLabel="No meals logged in this period" />
            <Muted style={s.note}>Dashed line: {fmt(targets.calories)} kcal daily target</Muted>
          </Card>

          <SectionHeader title="Average daily macros" />
          <Card>
            {[
              { label: 'Protein', value: avgProtein, target: targets.proteinG, color: FIT.protein },
              { label: 'Carbs', value: avgCarbs, target: targets.carbsG, color: FIT.carbs },
              { label: 'Fat', value: avgFat, target: targets.fatG, color: FIT.fat },
            ].map((macro) => (
              <View key={macro.label} style={s.macro}>
                <View style={s.macroHead}>
                  <View style={[s.swatch, { backgroundColor: macro.color }]} />
                  <Text style={[s.macroLabel, { color: colors.text.primary }]}>{macro.label}</Text>
                  <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{num(macro.value)} / {num(macro.target)} g</Text>
                </View>
                <ProgressBar value={macro.value} target={macro.target} color={macro.color} />
              </View>
            ))}
          </Card>

          <SectionHeader title="Active minutes" />
          <Card>
            <BarChart data={series(dayKeys, byDay(data.workouts, 'durationMin'), period, 'sum')} color={FIT.workout} unit=" min" emptyLabel="No workouts logged in this period" />
          </Card>

          <SectionHeader title="Steps" />
          <Card>
            <BarChart data={series(dayKeys, byDay(data.habits, 'steps', 'day'), period, 'average')} target={targets.steps} color={FIT.steps} unit=" steps" emptyLabel="No steps logged in this period" />
            <Muted style={s.note}>Dashed line: {fmt(targets.steps)} steps daily target</Muted>
          </Card>

          <SectionHeader title="Water" />
          <Card>
            <BarChart data={series(dayKeys, byDay(data.habits, 'waterMl', 'day'), period, 'average')} target={targets.waterMl} color={FIT.water} unit=" ml" emptyLabel="No water logged in this period" />
          </Card>
        </View>
      ) : null}
    </FitnessPage>
  );
};

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  insight: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20 },
  note: { fontSize: 12, marginTop: 8 },
  macro: { marginBottom: 14 },
  macroHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
});
