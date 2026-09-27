import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VoiceTextInput from '../../components/VoiceTextInput';
import { useTheme } from '../../contexts/ThemeContext';
import { Badge, CrisisInfo, LapseDebrief, SubstanceKey, SubstanceSummary, recoveryApi } from '../../services/recoveryApi';
import { FEELING_KEYS, OFFLINE_TRIGGERS } from './content';
import { lapseTime, quitDateFor, withIfThen } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import {
  Banner,
  Button,
  Card,
  ChipGroup,
  CrisisCard,
  EmptyState,
  Icon,
  InfoCard,
  MultiChips,
  Muted,
  OptionCards,
  Question,
  REC,
  RecoveryPage,
  Stepper,
  callPhone,
  errorMessage,
} from './ui';

type Props = { navigation?: any; route?: any };
type Result = { debrief: LapseDebrief; safety: { text: string }; crisis: CrisisInfo | null; substance: SubstanceSummary; newBadges: Badge[] };

export const RecoveryLapse = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, num, date } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data, loading } = useRecoveryDashboard(lang);
  // Only substances whose quit date has passed can have a slip.
  const substances = (data?.substances || []).filter((item) => item.status === 'clean');
  const [key, setKey] = useState<SubstanceKey | ''>(route?.params?.substance || '');
  const [when, setWhen] = useState<'now' | 'today' | 'yesterday'>('now');
  const [amount, setAmount] = useState(1);
  const [trigger, setTrigger] = useState('');
  const [feeling, setFeeling] = useState('');
  const [context, setContext] = useState('');
  const [restart, setRestart] = useState<'continue' | 'new_date'>('continue');
  const [daysAhead, setDaysAhead] = useState(1);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [added, setAdded] = useState(false);

  const current = substances.find((item) => item.key === key) || substances.find((item) => item.primary) || substances[0];
  const safetyText = current ? content?.safetyClasses?.[current.safetyClass]?.lapseSafety : '';
  const triggers = content?.triggers?.length ? content.triggers : OFFLINE_TRIGGERS[lang];
  const dayOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const days = index + 1;
        const label = days === 1 ? s.onboarding.tomorrow : date(quitDateFor('date', { daysAhead: days }), { day: 'numeric', month: 'short' });
        return { label, value: String(days) };
      }),
    [date, s.onboarding.tomorrow],
  );

  const submit = async () => {
    if (!current) return;
    setError('');
    try {
      const response = await recoveryApi.logLapse(
        {
          substance: current.key,
          at: lapseTime(when, current.quitDate),
          amount,
          trigger: trigger || undefined,
          feelingBefore: feeling || undefined,
          context: context.trim() || undefined,
          restart,
          newQuitDate: restart === 'new_date' ? quitDateFor('date', { daysAhead }) : undefined,
        },
        lang,
      );
      setResult(response.data);
    } catch (saveError: any) {
      setError(errorMessage(saveError, s.common.saveError));
    }
  };

  const addToPlan = async () => {
    if (!result?.debrief.newIfThen?.action) return;
    try {
      const plan = withIfThen(data?.profile?.plan, result.debrief.newIfThen);
      await recoveryApi.updatePlan(plan, lang);
      setAdded(true);
    } catch (saveError: any) {
      setError(errorMessage(saveError, s.common.saveError));
    }
  };

  if (result) {
    const { debrief, substance } = result;
    return (
      <RecoveryPage title={s.lapse.debriefTitle} navigation={navigation} footer={<Button label={s.lapse.home} icon="home-outline" onPress={() => navigation.navigate('RecoveryHome')} />}>
        {result.crisis ? <CrisisCard crisis={result.crisis} contacts={data?.profile?.supportContacts} lang={lang} onMoreHelp={() => navigation.navigate('RecoveryHelp')} /> : null}
        {result.safety?.text ? (
          <InfoCard icon="shield-alert-outline" title={s.onboarding.safetyTitle} tone={REC.sos}>
            <Text style={[styles.body, { color: colors.text.primary }]}>{result.safety.text}</Text>
          </InfoCard>
        ) : null}
        <Card>
          <Text style={[styles.reflection, { color: colors.text.primary }]}>{debrief.reflection}</Text>
        </Card>
        {debrief.chain?.length ? (
          <InfoCard icon="link-variant" title={s.lapse.chainTitle}>
            {debrief.chain.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.chainRow}>
                <View style={[styles.chainDot, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.chainNumber, { color: colors.onPrimary }]}>{num(index + 1)}</Text>
                </View>
                <Text style={[styles.body, { color: colors.text.primary, flex: 1 }]}>{item}</Text>
              </View>
            ))}
          </InfoCard>
        ) : null}
        {debrief.lesson ? (
          <InfoCard icon="lightbulb-on-outline" title={s.lapse.lessonTitle} tone={REC.warm}>
            <Text style={[styles.body, { color: colors.text.primary }]}>{debrief.lesson}</Text>
          </InfoCard>
        ) : null}
        {debrief.newIfThen?.action ? (
          <InfoCard icon="map-marker-path" title={s.lapse.newPlanTitle}>
            <Text style={[styles.body, { color: colors.text.primary }]}>
              <Text style={{ fontWeight: '800' }}>{`${s.plan.ifLabel} `}</Text>
              {debrief.newIfThen.trigger}
            </Text>
            <Text style={[styles.body, { color: colors.text.primary, marginTop: 4 }]}>
              <Text style={{ fontWeight: '800' }}>{`${s.plan.thenLabel} `}</Text>
              {debrief.newIfThen.action}
            </Text>
            {added ? <Banner icon="check" tone="good" text={s.lapse.added} /> : <Button label={s.lapse.addToPlan} icon="plus" variant="secondary" onPress={addToPlan} />}
          </InfoCard>
        ) : null}
        <InfoCard icon="trophy-outline" title={s.lapse.keptTitle} tone={REC.warm}>
          <Text style={[styles.body, { color: colors.text.primary }]}>{f(s.lapse.kept, { longest: num(substance.longestStreakDays), total: num(substance.totalCleanDays) })}</Text>
        </InfoCard>
        {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}
        <Button label={s.lapse.talk} icon="robot-happy-outline" variant="secondary" onPress={() => navigation.navigate('RecoveryCoach', { mode: 'lapse' })} />
      </RecoveryPage>
    );
  }

  if (!loading && !substances.length) {
    return (
      <RecoveryPage title={s.lapse.title} navigation={navigation}>
        <EmptyState icon="calendar-clock" title={s.lapse.title} message={s.lapse.nothingToLog} action={s.lapse.home} onAction={() => navigation.goBack()} />
      </RecoveryPage>
    );
  }

  return (
    <RecoveryPage
      title={s.lapse.title}
      navigation={navigation}
      footer={<Button label={s.lapse.submit} loadingLabel={s.lapse.thinking} icon="arrow-right" disabled={!current} onPress={submit} />}
    >
      <Card>
        <Text style={[styles.reflection, { color: colors.text.primary }]}>{s.lapse.intro}</Text>
      </Card>

      <InfoCard icon="shield-alert-outline" title={s.lapse.safeQ} tone={REC.sos}>
        {safetyText ? <Text style={[styles.body, { color: colors.text.primary, marginBottom: 6 }]}>{safetyText}</Text> : null}
        <Button label={s.crisis.call999} icon="phone" variant="danger" onPress={() => callPhone('999', lang)} />
        <Button label={s.lapse.unwell} icon="lifebuoy" variant="secondary" onPress={() => navigation.navigate('RecoveryHelp')} />
      </InfoCard>

      {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}

      <Card>
        {substances.length > 1 ? (
          <Question title={s.lapse.whatQ}>
            <ChipGroup options={substances.map((item) => ({ label: item.name, value: item.key }))} value={current?.key || ''} onChange={(value) => setKey(value as SubstanceKey)} />
          </Question>
        ) : null}
        <Question title={s.lapse.whenQ}>
          <ChipGroup
            options={(['now', 'today', 'yesterday'] as const).map((value) => ({ label: s.lapse.when[value], value }))}
            value={when}
            onChange={(value) => setWhen(value as typeof when)}
          />
        </Question>
        {current ? (
          <Question title={f(s.lapse.amountQ, { unit: current.unit })}>
            <Stepper value={amount} min={0} max={200} onChange={setAmount} />
          </Question>
        ) : null}
        <Question title={s.lapse.triggerQ} hint={s.common.optional}>
          <MultiChips options={triggers} values={trigger ? [trigger] : []} onToggle={(value) => setTrigger(trigger === value ? '' : value)} />
        </Question>
        <Question title={s.lapse.feelingQ} hint={s.common.optional}>
          <MultiChips options={FEELING_KEYS.map((value) => ({ key: value, label: s.lapse.feelings[value] }))} values={feeling ? [feeling] : []} onToggle={(value) => setFeeling(feeling === value ? '' : value)} />
        </Question>
        <Question title={s.lapse.contextQ}>
          <View style={[styles.noteBox, { borderColor: colors.border.primary, backgroundColor: colors.surface.primary }]}>
            <VoiceTextInput value={context} onChangeText={setContext} multiline maxLength={1500} style={[styles.noteInput, { color: colors.text.primary }]} />
          </View>
        </Question>
        <Question title={s.lapse.restartQ}>
          <OptionCards
            value={restart}
            onChange={(value) => setRestart(value as typeof restart)}
            options={[
              { value: 'continue', label: s.lapse.continue, icon: 'play-circle-outline' },
              { value: 'new_date', label: s.lapse.newDate, icon: 'calendar-refresh-outline' },
            ]}
          />
          {restart === 'new_date' ? (
            <View style={{ marginTop: 12 }}>
              <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.quitDate}</Muted>
              <ChipGroup options={dayOptions} value={String(daysAhead)} onChange={(value) => setDaysAhead(Number(value))} />
            </View>
          ) : null}
        </Question>
      </Card>
      <View style={styles.keep}>
        <Icon name="information-outline" size={16} color={colors.text.tertiary} />
        <Muted style={{ flex: 1, fontSize: 12 }}>{s.lapse.keptNote}</Muted>
      </View>
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  reflection: { fontSize: 16, lineHeight: 24 },
  chainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  chainDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chainNumber: { fontWeight: '800', fontSize: 12 },
  noteBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 80 },
  noteInput: { fontSize: 15, minHeight: 76, textAlignVertical: 'top', paddingVertical: 10 },
  keep: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 4 },
});
