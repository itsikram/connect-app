import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VoiceTextInput from '../../components/VoiceTextInput';
import { useTheme } from '../../contexts/ThemeContext';
import { Badge, Checkin, CrisisInfo, SubstanceKey, recoveryApi } from '../../services/recoveryApi';
import { OFFLINE_TRIGGERS } from './content';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import {
  Banner,
  Button,
  Card,
  CrisisCard,
  Icon,
  MoodScale,
  MultiChips,
  Muted,
  NumberScale,
  Question,
  REC,
  RecoveryPage,
  Segmented,
  Stepper,
  errorMessage,
  toggleIn,
} from './ui';

type Props = { navigation?: any };
type Result = { checkin: Checkin; crisis: CrisisInfo | null; lapsesCreated: SubstanceKey[]; pointsEarned: number; newBadges: Badge[] };

const HALT_FALLBACK: Record<'en' | 'bn', Array<{ key: string; label: string }>> = {
  en: [
    { key: 'hungry', label: 'Hungry' },
    { key: 'angry', label: 'Angry' },
    { key: 'lonely', label: 'Lonely' },
    { key: 'tired', label: 'Tired' },
  ],
  bn: [
    { key: 'hungry', label: 'ক্ষুধার্ত' },
    { key: 'angry', label: 'রাগান্বিত' },
    { key: 'lonely', label: 'একা' },
    { key: 'tired', label: 'ক্লান্ত' },
  ],
};

export const RecoveryCheckIn = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, num } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data } = useRecoveryDashboard(lang);
  const substances = (data?.substances || []).filter((item) => item.status === 'clean');
  const existing = data?.today?.checkin || null;

  const [used, setUsed] = useState<Record<string, number | null>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [craving, setCraving] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [sleep, setSleep] = useState(7);
  const [halt, setHalt] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Editing today's check-in: start from what was saved (the note is never sent back).
  useEffect(() => {
    if (!existing || prefilled) return;
    setPrefilled(true);
    setMood(existing.mood);
    setCraving(existing.craving);
    setStress(existing.stress);
    if (existing.sleepHours !== null) setSleep(existing.sleepHours);
    setHalt(existing.halt || []);
    setTriggers(existing.triggers || []);
    setUsed(Object.fromEntries((existing.used || []).map((item) => [item.substance, item.amount])));
  }, [existing, prefilled]);

  const submit = async () => {
    if (mood === null || craving === null) {
      setError(s.onboarding.answerAll);
      return;
    }
    setError('');
    try {
      const response = await recoveryApi.saveCheckin(
        {
          used: Object.entries(used)
            .filter(([, amount]) => amount !== null && amount > 0)
            .map(([substance, amount]) => ({ substance: substance as SubstanceKey, amount: amount as number })),
          mood,
          craving,
          stress: stress ?? undefined,
          sleepHours: sleep,
          halt,
          triggers,
          note: note.trim() || undefined,
        },
        lang,
      );
      setResult(response.data);
    } catch (saveError: any) {
      setError(errorMessage(saveError, s.common.saveError));
    }
  };

  if (result) {
    const { checkin } = result;
    return (
      <RecoveryPage title={s.checkin.title} navigation={navigation} footer={<Button label={s.lapse.home} icon="home-outline" onPress={() => navigation.goBack()} />}>
        {result.crisis ? <CrisisCard crisis={result.crisis} contacts={data?.profile?.supportContacts} lang={lang} onMoreHelp={() => navigation.navigate('RecoveryHelp')} /> : null}
        <Card>
          <View style={styles.head}>
            <Icon name="check-circle" size={24} color={colors.status.success} />
            <Text style={[styles.title, { color: colors.text.primary }]}>{existing ? s.checkin.updated : s.checkin.resultTitle}</Text>
          </View>
          {checkin.reflection ? <Text style={[styles.reflection, { color: colors.text.primary }]}>{checkin.reflection}</Text> : null}
          {checkin.microGoal ? (
            <View style={[styles.goal, { backgroundColor: colors.surface.secondary }]}>
              <Icon name="flag-checkered" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalLabel, { color: colors.text.secondary }]}>{s.checkin.tomorrow}</Text>
                <Text style={[styles.goalText, { color: colors.text.primary }]}>{checkin.microGoal}</Text>
              </View>
            </View>
          ) : null}
          {result.pointsEarned ? <Text style={[styles.points, { color: REC.warm }]}>{f(s.common.points, { n: num(result.pointsEarned) })}</Text> : null}
          {result.newBadges.map((badge) => (
            <Banner key={badge.key} icon="medal-outline" tone="good" text={f(s.common.newBadge, { label: badge.label })} />
          ))}
        </Card>
        {result.lapsesCreated.length ? <Banner icon="restart" text={s.checkin.slipRecorded} /> : null}
        {result.lapsesCreated.length || checkin.craving >= 7 || checkin.mood <= 2 ? (
          <Button
            label={s.checkin.talkIt}
            icon="robot-happy-outline"
            variant="secondary"
            onPress={() => navigation.replace('RecoveryCoach', { mode: result.lapsesCreated.length ? 'lapse' : 'coach' })}
          />
        ) : null}
      </RecoveryPage>
    );
  }

  const haltOptions = content?.halt?.length ? content.halt : HALT_FALLBACK[lang];
  const triggerOptions = content?.triggers?.length ? content.triggers : OFFLINE_TRIGGERS[lang];

  return (
    <RecoveryPage title={s.checkin.title} navigation={navigation} footer={<Button label={s.checkin.submit} loadingLabel={s.common.saving} icon="check" onPress={submit} />}>
      {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}
      <Card>
        {substances.map((substance) => {
          const amount = used[substance.key];
          const didUse = amount !== undefined && amount !== null && amount > 0;
          return (
            <Question key={substance.key} title={substances.length > 1 ? `${s.checkin.usedQ} · ${substance.name}` : s.checkin.usedQ}>
              <Segmented
                options={[
                  { label: s.common.no, value: 'no' },
                  { label: s.common.yes, value: 'yes' },
                ]}
                value={didUse ? 'yes' : 'no'}
                onChange={(value) => setUsed((old) => ({ ...old, [substance.key]: value === 'yes' ? Math.max(1, old[substance.key] || 1) : 0 }))}
              />
              {didUse ? (
                <View style={{ marginTop: 10 }}>
                  <Muted style={{ fontSize: 13, marginBottom: 6 }}>{f(s.checkin.howMuch, { unit: substance.unit })}</Muted>
                  <Stepper value={amount as number} min={1} max={200} onChange={(value) => setUsed((old) => ({ ...old, [substance.key]: value }))} />
                </View>
              ) : null}
            </Question>
          );
        })}
        <Question title={s.checkin.moodQ}>
          <MoodScale value={mood} onChange={setMood} labels={s.checkin.moods} />
        </Question>
        <Question title={s.checkin.cravingQ}>
          <NumberScale min={0} max={10} value={craving} onChange={setCraving} lang={lang} danger />
        </Question>
        <Question title={s.checkin.stressQ} hint={s.common.optional}>
          <NumberScale min={1} max={5} value={stress} onChange={setStress} lang={lang} lowLabel={s.checkin.stressLabels[0]} highLabel={s.checkin.stressLabels[1]} />
        </Question>
        <Question title={s.checkin.sleepQ}>
          <Stepper value={sleep} min={0} max={24} step={0.5} decimals={1} suffix={s.common.hours} onChange={setSleep} />
        </Question>
        <Question title={s.checkin.haltQ} hint={s.common.optional}>
          <MultiChips options={haltOptions} values={halt} onToggle={(key) => setHalt((old) => toggleIn(old, key))} />
        </Question>
        <Question title={s.checkin.triggersQ} hint={s.common.optional}>
          <MultiChips options={triggerOptions} values={triggers} onToggle={(key) => setTriggers((old) => toggleIn(old, key))} />
        </Question>
        <Question title={s.checkin.noteQ}>
          <View style={[styles.noteBox, { borderColor: colors.border.primary, backgroundColor: colors.surface.primary }]}>
            <VoiceTextInput value={note} onChangeText={setNote} multiline maxLength={1000} placeholderTextColor={colors.text.tertiary} style={[styles.noteInput, { color: colors.text.primary }]} />
          </View>
        </Question>
      </Card>
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  reflection: { fontSize: 16, lineHeight: 24 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, marginTop: 12 },
  goalLabel: { fontSize: 12, fontWeight: '700' },
  goalText: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  points: { fontSize: 15, fontWeight: '800', marginTop: 12 },
  noteBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 80 },
  noteInput: { fontSize: 15, minHeight: 76, textAlignVertical: 'top', paddingVertical: 10 },
});
