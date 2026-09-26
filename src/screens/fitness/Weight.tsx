import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi } from '../../services/fitnessApi';
import { Button, Card, EmptyState, FIT, Field, FitnessPage, Icon, LineChart, Muted, SectionHeader, Stepper, errorMessage, shortDate } from './ui';

type Props = { navigation?: any };

export const FitnessWeight = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState(70);
  const [bodyFat, setBodyFat] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [weights, profileResponse] = await Promise.all([fitnessApi.getWeights(), fitnessApi.getProfile()]);
      const list = weights.data.weights || [];
      const nextProfile = profileResponse.data.profile;
      setHistory(list);
      setProfile(nextProfile);
      setWeight(Number(list[0]?.weightKg || nextProfile?.weightKg || 70));
    } catch (_) {
      // Keep the entry form usable offline.
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const fat = bodyFat ? Number(bodyFat) : undefined;
    if (fat !== undefined && (fat < 1 || fat > 80)) { Alert.alert('Weight', 'Body fat should be between 1% and 80%.'); return; }
    try {
      await fitnessApi.addWeight(weight, new Date().toISOString(), note.trim() || undefined, fat);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Weight', errorMessage(error, 'Enter a valid weight.'));
    }
  };

  const remove = (entry: any) => Alert.alert('Delete entry', `Delete ${entry.weightKg} kg from ${shortDate(entry.date)}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await fitnessApi.deleteWeight(entry._id); load(); } catch (e: any) { Alert.alert('Weight', errorMessage(e, 'Could not delete this entry')); } } },
  ]);

  const chronological = [...history].reverse().slice(-30);
  const last = history[0]?.weightKg;
  const delta = last ? Math.round((weight - last) * 10) / 10 : 0;
  const bmi = profile?.heightCm ? Math.round((weight / ((profile.heightCm / 100) ** 2)) * 10) / 10 : null;

  return (
    <FitnessPage
      title="Log weight"
      subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
      navigation={navigation}
      footer={<Button label="Save weigh-in" loadingLabel="Saving..." icon="check" onPress={save} style={{ marginTop: 0 }} />}
    >
      <Card style={{ paddingVertical: 24 }}>
        <Stepper value={weight} onChange={setWeight} step={0.1} min={25} max={350} decimals={1} suffix="kg" />
        <View style={s.metaRow}>
          {last ? (
            <View style={s.meta}>
              <Icon name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'minus'} size={16} color={colors.text.secondary} />
              <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{delta === 0 ? 'Same as last entry' : `${Math.abs(delta)} kg vs last entry`}</Text>
            </View>
          ) : null}
          {bmi ? <Text style={{ color: colors.text.secondary, fontSize: 13 }}>BMI {bmi}</Text> : null}
        </View>
        <View style={s.quick}>
          {[-1, -0.5, 0.5, 1].map((step) => (
            <Pressable key={step} onPress={() => setWeight((value) => Math.round((value + step) * 10) / 10)} style={[s.quickButton, { backgroundColor: colors.surface.secondary }]}>
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{step > 0 ? '+' : ''}{step}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <View style={s.row}>
        <Field label="Body fat (optional)" value={bodyFat} onChangeText={(value) => setBodyFat(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" suffix="%" style={{ flex: 1 }} />
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. after workout" style={{ flex: 1.4 }} />
      </View>
      <Muted style={{ fontSize: 12, marginBottom: 6 }}>Tip: weigh in first thing in the morning, after the bathroom and before eating. Daily weight fluctuates by 1–2 kg; watch the weekly trend.</Muted>

      <SectionHeader title="Trend" />
      <Card>
        {chronological.length >= 2 ? (
          <LineChart
            data={chronological.map((entry) => ({ label: shortDate(entry.date), value: entry.weightKg, detail: shortDate(entry.date) }))}
            target={profile?.goal !== 'maintain' ? profile?.targetWeightKg : undefined}
            color={FIT.weight}
            unit=" kg"
          />
        ) : <EmptyState icon="chart-line" title="Your trend appears here" message="Log at least two weigh-ins to see your weight trend." />}
      </Card>

      {history.length ? (
        <>
          <SectionHeader title="History" />
          <Card style={{ paddingVertical: 4 }}>
            {history.slice(0, 30).map((entry, index) => {
              const previous = history[index + 1];
              const change = previous ? Math.round((entry.weightKg - previous.weightKg) * 10) / 10 : null;
              return (
                <Pressable key={entry._id} onLongPress={() => remove(entry)} style={[s.historyRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.primary }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    {entry.note || entry.bodyFatPercent ? <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{[entry.bodyFatPercent ? `${entry.bodyFatPercent}% body fat` : '', entry.note].filter(Boolean).join(' · ')}</Text> : null}
                  </View>
                  {change !== null && change !== 0 ? <Text style={{ color: colors.text.secondary, fontSize: 12, marginRight: 10 }}>{change > 0 ? '+' : ''}{change}</Text> : null}
                  <Text style={[s.historyWeight, { color: colors.text.primary }]}>{entry.weightKg} kg</Text>
                  <Pressable accessibilityLabel="Delete entry" hitSlop={8} onPress={() => remove(entry)} style={{ marginLeft: 10 }}><Icon name="trash-can-outline" size={18} color={colors.text.tertiary} /></Pressable>
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : null}
    </FitnessPage>
  );
};

const s = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quick: { flexDirection: 'row', gap: 8, marginTop: 16 },
  quickButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  row: { flexDirection: 'row', gap: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  historyWeight: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
