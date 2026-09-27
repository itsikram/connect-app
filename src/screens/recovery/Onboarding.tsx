import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Approach, ProfileInput, SubstanceKey, SupportContact, recoveryApi } from '../../services/recoveryApi';
import { cleanPhone, daysSince, daysUntil, parseNumber, quitDateFor } from './helpers';
import { useRecoveryContent } from './hooks';
import { useRecoveryI18n } from './i18n';
import {
  Banner,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  Icon,
  IconName,
  InfoCard,
  MultiChips,
  Muted,
  NumberScale,
  OptionCards,
  ProgressBar,
  Question,
  REC,
  RecoveryPage,
  Stepper,
  errorMessage,
  timezone,
  toggleIn,
} from './ui';

type Props = { navigation?: any; route?: any };

type Usage = { amountPerDay: string; daysPerWeek: number; costPerUnit: string; yearsUsing: string; wakeUse: string };
type Quit = { approach: Approach; daysAhead: number; daysAgo: number; original?: string; touched: boolean };

const WAKE_KEYS = ['5min', '30min', '60min', 'later'] as const;

export const RecoveryOnboarding = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, date } = useRecoveryI18n();
  const { content, error: contentError, reload } = useRecoveryContent(lang);
  const editing = !!route?.params?.edit;
  const resuming = !!route?.params?.resume;
  const [loading, setLoading] = useState(editing || resuming);
  const [mode, setMode] = useState<'quick' | 'full'>('full');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [building, setBuilding] = useState(false);

  const [selected, setSelected] = useState<SubstanceKey[]>([]);
  const [primary, setPrimary] = useState<SubstanceKey | ''>('');
  const [customName, setCustomName] = useState('');
  const [usage, setUsage] = useState<Record<string, Usage>>({});
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [importance, setImportance] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reasonKeys, setReasonKeys] = useState<string[]>([]);
  const [reasons, setReasons] = useState('');
  const [letter, setLetter] = useState('');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [quit, setQuit] = useState<Record<string, Quit>>({});
  const [contacts, setContacts] = useState<SupportContact[]>([{ name: '', phone: '', relation: '' }]);

  const meta = (key: string) => content?.substances.find((item) => item.key === key);
  const safetyOf = (key: string) => {
    const substance = meta(key);
    return substance ? content?.safetyClasses?.[substance.safetyClass] : undefined;
  };

  // Editing or finishing setup: start from what is already saved.
  useEffect(() => {
    if (!editing && !resuming) return;
    recoveryApi
      .getProfile()
      .then((response) => {
        const profile = response.data.profile;
        if (!profile) return;
        const keys = profile.substances.map((item) => item.key);
        setSelected(keys);
        setPrimary((profile.substances.find((item) => item.primary) || profile.substances[0])?.key || '');
        setCustomName(profile.substances.find((item) => item.key === 'other')?.customName || '');
        setUsage(
          Object.fromEntries(
            profile.substances.map((item) => [
              item.key,
              {
                amountPerDay: String(item.amountPerDay ?? ''),
                daysPerWeek: item.daysPerWeek ?? 7,
                costPerUnit: item.costPerUnit ? String(item.costPerUnit) : '',
                yearsUsing: item.yearsUsing ? String(item.yearsUsing) : '',
                wakeUse: item.wakeUse || '',
              },
            ]),
          ),
        );
        setQuit(
          Object.fromEntries(
            profile.substances.map((item) => {
              const future = Date.parse(item.quitDate) > Date.now();
              return [item.key, { approach: item.approach, daysAhead: future ? daysUntil(item.quitDate) : 1, daysAgo: future ? 0 : daysSince(item.quitDate), original: item.quitDate, touched: false }];
            }),
          ),
        );
        setImportance(profile.readiness?.importance ?? null);
        setConfidence(profile.readiness?.confidence ?? null);
        setReasonKeys(profile.reasonKeys || []);
        setReasons(profile.reasons || '');
        setLetter(profile.letter || '');
        setTriggers(profile.triggers || []);
        if (profile.supportContacts?.length) setContacts(profile.supportContacts.map((contact) => ({ relation: '', ...contact })));
      })
      .catch((loadError) => setError(errorMessage(loadError, s.common.saveError)))
      .finally(() => setLoading(false));
  }, [editing, resuming]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => {
    const intro = editing || resuming ? [] : ['welcome'];
    if (mode === 'quick') return [...intro, 'substances', 'quit'];
    const screeners = selected.filter((key) => {
      const tool = meta(key)?.screener;
      return !!tool && !!content?.screeners?.[tool];
    });
    return [...intro, 'substances', 'usage', ...screeners.map((key) => `screener:${key}`), 'readiness', 'reasons', 'triggers', 'quit', 'support', 'review'];
  }, [mode, selected, content, editing, resuming]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  const toggleSubstance = (key: SubstanceKey) => {
    const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key].slice(0, 6);
    setSelected(next);
    if (!primary || !next.includes(primary)) setPrimary(next[0] || '');
    const substance = meta(key);
    setUsage((old) => (old[key] ? old : { ...old, [key]: { amountPerDay: String(substance?.defaultAmount ?? ''), daysPerWeek: 7, costPerUnit: '', yearsUsing: '', wakeUse: '' } }));
    setQuit((old) => (old[key] ? old : { ...old, [key]: { approach: safetyOf(key)?.defaultApproach || 'now', daysAhead: 1, daysAgo: 0, touched: true } }));
  };

  const setUsageField = (key: string, field: keyof Usage, value: string | number) => setUsage((old) => ({ ...old, [key]: { ...old[key], [field]: value } }));
  const setQuitField = (key: string, patch: Partial<Quit>) => setQuit((old) => ({ ...old, [key]: { ...old[key], ...patch, touched: true } }));

  const validate = (): string | null => {
    if (current === 'substances') {
      if (!selected.length) return s.onboarding.pickOne;
      if (selected.includes('other') && !customName.trim()) return s.onboarding.otherName;
    }
    if (current.startsWith('screener:')) {
      const key = current.slice('screener:'.length);
      const tool = meta(key)?.screener as string;
      const total = content?.screeners?.[tool]?.questions.length || 0;
      const given = (answers[key] || []).filter((value) => value !== undefined).length;
      // Answer all or none; a partial screener cannot be scored.
      if (given && given < total) return s.onboarding.answerAll;
    }
    if (current === 'readiness' && (importance === null || confidence === null)) return s.onboarding.answerAll;
    return null;
  };

  const next = () => {
    const problem = validate();
    setError(problem || '');
    if (!problem) setStep((value) => Math.min(steps.length - 1, value + 1));
  };
  const back = () => {
    setError('');
    if (step === 0) navigation?.goBack();
    else setStep((value) => value - 1);
  };

  const buildInput = (): ProfileInput => {
    const quitFor = (key: SubstanceKey) => {
      const item = quit[key] || { approach: 'now' as Approach, daysAhead: 1, daysAgo: 0, touched: true };
      const approach = safetyOf(key)?.approaches?.includes(item.approach) ? item.approach : safetyOf(key)?.defaultApproach || item.approach;
      // Keep the saved date unless it was changed, so editing never resets a streak.
      const quitDate = !item.touched && item.original ? item.original : quitDateFor(approach, { daysAhead: item.daysAhead, daysAgo: item.daysAgo });
      return { approach, quitDate };
    };
    const input: ProfileInput = {
      substances: selected.map((key) => {
        const use = usage[key];
        return {
          key,
          primary: key === primary,
          customName: key === 'other' ? customName.trim() : undefined,
          ...(use
            ? {
                amountPerDay: parseNumber(use.amountPerDay),
                daysPerWeek: use.daysPerWeek,
                costPerUnit: parseNumber(use.costPerUnit),
                yearsUsing: use.yearsUsing ? parseNumber(use.yearsUsing) : undefined,
                wakeUse: use.wakeUse || undefined,
              }
            : {}),
          ...quitFor(key),
        };
      }),
      timezone: timezone(),
    };
    if (mode === 'full') {
      const complete = Object.fromEntries(
        Object.entries(answers).filter(([key, list]) => {
          const tool = meta(key)?.screener as string;
          const total = content?.screeners?.[tool]?.questions.length || 0;
          return total > 0 && list.filter((value) => value !== undefined).length === total;
        }),
      );
      Object.assign(input, {
        screenerAnswers: complete,
        readiness: { importance: importance ?? 8, confidence: confidence ?? 5 },
        reasonKeys,
        reasons: reasons.trim(),
        letter: letter.trim(),
        triggers,
        supportContacts: contacts.map((contact) => ({ ...contact, phone: cleanPhone(contact.phone) })).filter((contact) => contact.name.trim() || contact.phone.trim()),
        onboardingCompleted: true,
      });
    } else if (!editing && !resuming) {
      input.onboardingCompleted = false;
    }
    return input;
  };

  const save = async () => {
    setError('');
    try {
      await recoveryApi.saveProfile(buildInput(), lang);
    } catch (saveError: any) {
      setError(errorMessage(saveError, s.common.saveError));
      return;
    }
    if (editing || mode === 'quick') {
      if (editing) navigation.goBack();
      else navigation.replace('RecoveryHome');
      return;
    }
    setBuilding(true);
    try {
      await recoveryApi.generatePlan(lang);
      navigation.replace('RecoveryPlan', { fromOnboarding: true });
    } catch (_) {
      // The plan screen offers "Build my plan" again; the profile is already saved.
      navigation.replace('RecoveryPlan', { fromOnboarding: true, planFailed: true });
    }
  };

  const title = editing ? s.onboarding.editTitle : s.onboarding.title;

  if (building) {
    return (
      <RecoveryPage title={title} navigation={navigation} showSos={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.building, { color: colors.text.primary }]}>{s.onboarding.building}</Text>
        </View>
      </RecoveryPage>
    );
  }

  if (loading || (!content && !contentError)) {
    return (
      <RecoveryPage title={title} navigation={navigation}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </RecoveryPage>
    );
  }

  if (!content) {
    return (
      <RecoveryPage title={title} navigation={navigation}>
        <EmptyState icon="wifi-off" title={s.onboarding.contentError} action={s.common.tryAgain} onAction={reload} />
        <Button label={s.home.helpNow} variant="secondary" icon="lifebuoy" onPress={() => navigation.navigate('RecoveryHelp')} />
      </RecoveryPage>
    );
  }

  const renderWelcome = () => (
    <>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
          <Icon name="sprout" size={32} color={REC.onPrimary} />
        </View>
        <Text style={[styles.heading, { color: colors.text.primary, textAlign: 'center' }]}>{s.onboarding.welcomeTitle}</Text>
        <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.onboarding.welcomeBody}</Muted>
      </Card>
      <InfoCard icon="shield-lock-outline" title={s.onboarding.privacyTitle}>
        <Muted style={styles.body}>{s.onboarding.privacyBody}</Muted>
      </InfoCard>
      <Banner icon="alarm-light-outline" tone="warn" text={s.onboarding.notMedical} />
      <OptionCards
        value={mode}
        onChange={(value) => setMode(value as 'quick' | 'full')}
        options={[
          { value: 'full', label: s.onboarding.fullSetup, hint: s.onboarding.fullSetupHint, icon: 'clipboard-text-outline' },
          { value: 'quick', label: s.onboarding.quickStart, hint: s.onboarding.quickStartHint, icon: 'lightning-bolt-outline' },
        ]}
      />
    </>
  );

  const renderSubstances = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.substancesTitle}</Text>
      <Muted style={styles.hint}>{s.onboarding.substancesHint}</Muted>
      {content.substances.map((item) => {
        const on = selected.includes(item.key);
        const isPrimary = on && primary === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => toggleSubstance(item.key)}
            style={({ pressed }) => [styles.substance, { borderColor: on ? colors.primary : colors.border.primary, backgroundColor: colors.surface.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Icon name={(item.icon || 'circle-outline') as IconName} size={24} color={on ? colors.primary : colors.text.secondary} />
            <Text style={[styles.substanceName, { color: colors.text.primary }]}>{item.name}</Text>
            {on && selected.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={isPrimary ? s.onboarding.main : s.onboarding.makeMain} hitSlop={10} onPress={() => setPrimary(item.key)} style={styles.star}>
                <Icon name={isPrimary ? 'star' : 'star-outline'} size={22} color={isPrimary ? REC.warm : colors.text.tertiary} />
                {isPrimary ? <Text style={{ color: REC.warm, fontSize: 12, fontWeight: '800' }}>{s.onboarding.main}</Text> : null}
              </Pressable>
            ) : null}
            <Icon name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={22} color={on ? colors.primary : colors.text.tertiary} />
          </Pressable>
        );
      })}
      {selected.includes('other') ? <Field label={s.onboarding.otherName} value={customName} onChangeText={setCustomName} /> : null}
    </>
  );

  const renderUsage = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.usageTitle}</Text>
      <Muted style={styles.hint}>{s.onboarding.usageHint}</Muted>
      {selected.map((key) => {
        const item = meta(key);
        const use = usage[key];
        if (!item || !use) return null;
        return (
          <Card key={key}>
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{key === 'other' && customName ? customName : item.name}</Text>
            <Field label={f(s.onboarding.perDay, { unit: item.unit })} value={use.amountPerDay} keyboardType="decimal-pad" onChangeText={(value) => setUsageField(key, 'amountPerDay', value)} />
            <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.daysPerWeek}</Muted>
            <Stepper value={use.daysPerWeek} min={1} max={7} onChange={(value) => setUsageField(key, 'daysPerWeek', value)} />
            <View style={{ height: 12 }} />
            <Field label={f(s.onboarding.pricePer, { unit: item.unitOne || item.unit })} value={use.costPerUnit} keyboardType="decimal-pad" onChangeText={(value) => setUsageField(key, 'costPerUnit', value)} />
            <Field label={s.onboarding.yearsUsing} value={use.yearsUsing} keyboardType="decimal-pad" suffix={s.common.optional} onChangeText={(value) => setUsageField(key, 'yearsUsing', value)} />
            <Question title={s.onboarding.wakeQ}>
              <ChipGroup options={WAKE_KEYS.map((value) => ({ label: s.onboarding.wake[value], value }))} value={use.wakeUse} onChange={(value) => setUsageField(key, 'wakeUse', value)} />
            </Question>
          </Card>
        );
      })}
    </>
  );

  const renderScreener = (key: string) => {
    const item = meta(key);
    const screener = item ? content.screeners[item.screener] : null;
    if (!item || !screener) return null;
    const list = answers[key] || [];
    return (
      <>
        <Text style={[styles.heading, { color: colors.text.primary }]}>{f(s.onboarding.screenerTitle, { substance: key === 'other' && customName ? customName : item.name })}</Text>
        <Muted style={styles.hint}>{s.onboarding.screenerHint}</Muted>
        <Card>
          {screener.questions.map((question, index) => (
            <Question key={question.text} title={`${index + 1}. ${question.text}`}>
              <ChipGroup
                options={question.options.map((label, option) => ({ label, value: String(option) }))}
                value={list[index] === undefined ? '' : String(list[index])}
                onChange={(value) =>
                  setAnswers((old) => {
                    const nextList = [...(old[key] || [])];
                    nextList[index] = Number(value);
                    return { ...old, [key]: nextList };
                  })
                }
              />
            </Question>
          ))}
        </Card>
      </>
    );
  };

  const renderReadiness = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.readinessTitle}</Text>
      <Card>
        <Question title={s.onboarding.importance}>
          <NumberScale min={0} max={10} value={importance} onChange={setImportance} lang={lang} />
        </Question>
        <Question title={s.onboarding.confidence}>
          <NumberScale min={0} max={10} value={confidence} onChange={setConfidence} lang={lang} />
        </Question>
        <Muted style={{ fontSize: 13 }}>{s.onboarding.readinessNote}</Muted>
      </Card>
    </>
  );

  const renderReasons = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.reasonsTitle}</Text>
      <Muted style={styles.hint}>{s.onboarding.reasonsHint}</Muted>
      <Card>
        <MultiChips options={content.reasons} values={reasonKeys} onToggle={(key) => setReasonKeys((old) => toggleIn(old, key))} />
        <View style={{ height: 14 }} />
        <Field label={s.onboarding.ownWords} value={reasons} onChangeText={setReasons} multiline />
        <Field label={s.onboarding.letterLabel} value={letter} onChangeText={setLetter} placeholder={s.onboarding.letterPlaceholder} multiline />
      </Card>
    </>
  );

  const renderTriggers = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.triggersTitle}</Text>
      <Muted style={styles.hint}>{s.onboarding.triggersHint}</Muted>
      <Card>
        <MultiChips options={content.triggers} values={triggers} onToggle={(key) => setTriggers((old) => toggleIn(old, key))} />
      </Card>
    </>
  );

  const renderQuit = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.quitTitle}</Text>
      {selected.map((key) => {
        const item = meta(key);
        const safety = safetyOf(key);
        const plan = quit[key];
        if (!item || !safety || !plan) return null;
        const approach = safety.approaches.includes(plan.approach) ? plan.approach : safety.defaultApproach;
        const dayOptions = Array.from({ length: 14 }, (_, index) => {
          const days = index + 1;
          return { label: days === 1 ? s.onboarding.tomorrow : date(quitDateFor('date', { daysAhead: days }), { weekday: 'short', day: 'numeric', month: 'short' }), value: String(days) };
        });
        const stoppedEarlier = approach === 'now' && plan.daysAgo > 0;
        return (
          <Card key={key}>
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{key === 'other' && customName ? customName : item.name}</Text>
            {safety.safety ? (
              <View style={[styles.safety, { borderColor: REC.sos }]}>
                <Icon name="shield-alert-outline" size={18} color={REC.sos} />
                <Text style={[styles.safetyText, { color: colors.text.primary }]}>{safety.safety}</Text>
              </View>
            ) : null}
            {safety.quitAdvice ? <Muted style={{ fontSize: 13, marginBottom: 8 }}>{safety.quitAdvice}</Muted> : null}
            <OptionCards
              value={approach}
              onChange={(value) => setQuitField(key, { approach: value as Approach })}
              options={safety.approaches.map((value) => ({
                value,
                label: s.onboarding.approach[value][0],
                hint: s.onboarding.approach[value][1],
                icon: ({ now: 'flag-outline', date: 'calendar-outline', taper: 'chart-line-variant', doctor: 'doctor' } as Record<Approach, IconName>)[value],
              }))}
            />
            {approach === 'now' ? (
              <View style={{ marginTop: 12 }}>
                <ChipGroup
                  options={[
                    { label: s.onboarding.today, value: 'today' },
                    { label: s.onboarding.stoppedEarlier, value: 'earlier' },
                  ]}
                  value={stoppedEarlier ? 'earlier' : 'today'}
                  onChange={(value) => setQuitField(key, { daysAgo: value === 'earlier' ? Math.max(1, plan.daysAgo) : 0 })}
                />
                {stoppedEarlier ? (
                  <View style={{ marginTop: 10 }}>
                    <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.daysAgo}</Muted>
                    <Stepper value={plan.daysAgo} min={1} max={3650} onChange={(value) => setQuitField(key, { daysAgo: value })} suffix={s.common.days} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.quitDate}</Muted>
                <ChipGroup options={dayOptions} value={String(plan.daysAhead)} onChange={(value) => setQuitField(key, { daysAhead: Number(value) })} />
              </View>
            )}
            {!plan.touched && plan.original ? <Muted style={{ fontSize: 12, marginTop: 8 }}>{`${s.onboarding.quitDate}: ${date(plan.original)}`}</Muted> : null}
          </Card>
        );
      })}
    </>
  );

  const renderSupport = () => (
    <>
      <Text style={[styles.heading, { color: colors.text.primary }]}>{s.onboarding.supportTitle}</Text>
      <Muted style={styles.hint}>{s.onboarding.supportHint}</Muted>
      <ContactsEditor contacts={contacts} onChange={setContacts} />
    </>
  );

  const renderReview = () => (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
        <Icon name="map-marker-path" size={30} color={REC.onPrimary} />
      </View>
      <Text style={[styles.heading, { color: colors.text.primary, textAlign: 'center' }]}>{editing ? s.onboarding.editTitle : s.onboarding.reviewTitle}</Text>
      {!editing ? <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.onboarding.reviewBody}</Muted> : null}
      <Muted style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>{s.onboarding.notMedical}</Muted>
    </Card>
  );

  const body = (() => {
    if (current === 'welcome') return renderWelcome();
    if (current === 'substances') return renderSubstances();
    if (current === 'usage') return renderUsage();
    if (current.startsWith('screener:')) return renderScreener(current.slice('screener:'.length));
    if (current === 'readiness') return renderReadiness();
    if (current === 'reasons') return renderReasons();
    if (current === 'triggers') return renderTriggers();
    if (current === 'quit') return renderQuit();
    if (current === 'support') return renderSupport();
    return renderReview();
  })();

  const finishLabel = editing ? s.onboarding.saveChanges : s.onboarding.start;

  return (
    <RecoveryPage
      title={title}
      subtitle={f(s.onboarding.stepOf, { n: step + 1, total: steps.length })}
      navigation={{ goBack: back, navigate: (...args: any[]) => navigation?.navigate(...args) }}
      footer={
        <View style={styles.footerRow}>
          {step > 0 ? <Button label={s.common.back} variant="secondary" onPress={back} style={{ flex: 1 }} /> : null}
          {last ? (
            <Button label={finishLabel} loadingLabel={s.common.saving} icon="check" onPress={save} style={{ flex: 2 }} />
          ) : (
            <Button label={s.common.continue} icon="arrow-right" onPress={next} style={{ flex: 2 }} />
          )}
        </View>
      }
    >
      <ProgressBar value={step + 1} target={steps.length} height={5} />
      <View style={{ height: 16 }} />
      {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}
      {body}
    </RecoveryPage>
  );
};

/** Up to five trusted people (name, phone, relation). Shared with Settings. */
export const ContactsEditor = ({ contacts, onChange }: { contacts: SupportContact[]; onChange: (contacts: SupportContact[]) => void }) => {
  const { colors } = useTheme();
  const { s } = useRecoveryI18n();
  const update = (index: number, patch: Partial<SupportContact>) => onChange(contacts.map((contact, position) => (position === index ? { ...contact, ...patch } : contact)));
  return (
    <>
      {contacts.map((contact, index) => (
        <Card key={index}>
          <View style={styles.contactHead}>
            <Icon name="account-heart-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }} />
            {contacts.length > 1 || contact.name || contact.phone ? (
              <Pressable accessibilityRole="button" accessibilityLabel={s.plan.remove} hitSlop={10} onPress={() => onChange(contacts.length > 1 ? contacts.filter((_, position) => position !== index) : [{ name: '', phone: '', relation: '' }])}>
                <Icon name="close" size={20} color={colors.text.tertiary} />
              </Pressable>
            ) : null}
          </View>
          <Field label={s.onboarding.contactName} value={contact.name} onChangeText={(value) => update(index, { name: value })} />
          <Field label={s.onboarding.contactPhone} value={contact.phone} keyboardType="number-pad" onChangeText={(value) => update(index, { phone: cleanPhone(value) })} />
          <Field label={s.onboarding.contactRelation} value={contact.relation || ''} onChangeText={(value) => update(index, { relation: value })} />
        </Card>
      ))}
      {contacts.length < 5 ? (
        <Button label={s.onboarding.addPerson} icon="account-plus-outline" variant="ghost" onPress={() => onChange([...contacts, { name: '', phone: '', relation: '' }])} />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  building: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heading: { fontSize: 21, fontWeight: '800', marginBottom: 4 },
  hint: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  body: { fontSize: 14, lineHeight: 20 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  substance: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14, marginBottom: 8 },
  substanceName: { flex: 1, fontSize: 16, fontWeight: '700' },
  star: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  safety: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  safetyText: { flex: 1, fontSize: 14, lineHeight: 20 },
  contactHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  footerRow: { flexDirection: 'row', gap: 10 },
});
