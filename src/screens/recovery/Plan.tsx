import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { RecoveryPlan, recoveryApi } from '../../services/recoveryApi';
import { TOOL_ICONS } from './content';
import { emptyPlan, parseNumber } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { Banner, Button, Card, EmptyState, Field, Icon, IconName, InfoCard, Muted, ProgressBar, REC, RecoveryPage, SectionHeader, errorMessage } from './ui';

type Props = { navigation?: any; route?: any };

export const RecoveryPlanScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, num } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data, loading, refresh } = useRecoveryDashboard(lang, navigation);
  const fromOnboarding = !!route?.params?.fromOnboarding;
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState(route?.params?.planFailed ? s.onboarding.planFailed : '');
  const [newIf, setNewIf] = useState('');
  const [newThen, setNewThen] = useState('');
  const [newStep, setNewStep] = useState('');

  // Load the saved plan once; later dashboard refreshes must not wipe unsaved edits.
  useEffect(() => {
    if (!dirty && data?.profile) setPlan(data.profile.plan);
  }, [data?.profile, dirty]);

  const edit = (patch: Partial<RecoveryPlan>) => {
    setPlan((old) => ({ ...(old || emptyPlan()), ...patch }));
    setDirty(true);
    setMessage('');
  };

  const build = async () => {
    setBuilding(true);
    setMessage('');
    try {
      const response = await recoveryApi.generatePlan(lang);
      setPlan(response.data.plan);
      setDirty(false);
      refresh();
    } catch (buildError: any) {
      setMessage(errorMessage(buildError, s.onboarding.planFailed));
    } finally {
      setBuilding(false);
    }
  };

  const confirmRebuild = () =>
    Alert.alert(s.plan.regenerate, s.plan.regenerateConfirm, [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.plan.regenerate, onPress: build },
    ]);

  const save = async () => {
    if (!plan) return;
    try {
      const response = await recoveryApi.updatePlan(plan, lang);
      setPlan(response.data.plan);
      setDirty(false);
      setMessage(s.plan.saved);
      refresh();
    } catch (saveError: any) {
      setMessage(errorMessage(saveError, s.common.saveError));
    }
  };

  const footer = dirty ? (
    <Button label={s.plan.save} loadingLabel={s.common.saving} icon="content-save-outline" onPress={save} />
  ) : fromOnboarding ? (
    <Button label={s.plan.goHome} icon="home-outline" onPress={() => navigation.replace('RecoveryHome')} />
  ) : undefined;

  if (building || (loading && !data)) {
    return (
      <RecoveryPage title={s.plan.title} navigation={navigation}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          {building ? <Text style={[styles.building, { color: colors.text.primary }]}>{s.plan.building}</Text> : null}
        </View>
      </RecoveryPage>
    );
  }

  const profile = data?.profile;
  const saved = data?.totals?.moneySaved || 0;
  const reasonLabels = (profile?.reasonKeys || []).map((key) => content?.reasons?.find((reason) => reason.key === key)?.label).filter(Boolean) as string[];
  const goal = plan?.rewardGoal;

  return (
    <RecoveryPage title={s.plan.title} navigation={navigation} footer={footer}>
      {message ? <Banner icon={message === s.plan.saved ? 'check' : 'information-outline'} tone={message === s.plan.saved ? 'good' : 'warn'} text={message} /> : null}

      {!plan ? (
        <EmptyState icon="map-marker-path" title={s.plan.emptyTitle} message={s.plan.emptyBody} action={s.plan.generate} onAction={build} />
      ) : (
        <>
          {plan.summary ? (
            <Card>
              <Text style={[styles.summary, { color: colors.text.primary }]}>{plan.summary}</Text>
              <Muted style={{ fontSize: 12, marginTop: 8 }}>{plan.source === 'gemini' ? s.plan.madeByAi : s.plan.madeCurated}</Muted>
            </Card>
          ) : null}
          {plan.safetyNote ? (
            <InfoCard icon="shield-alert-outline" title={s.plan.safetyTitle} tone={REC.sos}>
              <Text style={[styles.body, { color: colors.text.primary }]}>{plan.safetyNote}</Text>
            </InfoCard>
          ) : null}

          <SectionHeader title={s.plan.ifThenTitle} />
          <Muted style={styles.hint}>{s.plan.ifThenHint}</Muted>
          {plan.ifThen.map((item, index) => (
            <Card key={`${index}-${item.action}`}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { color: colors.text.primary }]}>
                    <Text style={{ fontWeight: '800' }}>{`${s.plan.ifLabel} `}</Text>
                    {item.trigger}
                  </Text>
                  <Text style={[styles.body, { color: colors.text.primary, marginTop: 4 }]}>
                    <Text style={{ fontWeight: '800', color: colors.primary }}>{`${s.plan.thenLabel} `}</Text>
                    {item.action}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={s.plan.remove} hitSlop={10} onPress={() => edit({ ifThen: plan.ifThen.filter((_, position) => position !== index) })}>
                  <Icon name="close" size={20} color={colors.text.tertiary} />
                </Pressable>
              </View>
            </Card>
          ))}
          {plan.ifThen.length < 10 ? (
            <Card>
              <Field label={s.plan.ifLabel} value={newIf} onChangeText={setNewIf} />
              <Field label={s.plan.thenLabel} value={newThen} onChangeText={setNewThen} />
              <Button
                label={s.plan.addIfThen}
                icon="plus"
                variant="secondary"
                disabled={!newThen.trim()}
                onPress={() => {
                  edit({ ifThen: [...plan.ifThen, { trigger: newIf.trim(), action: newThen.trim() }] });
                  setNewIf('');
                  setNewThen('');
                }}
              />
            </Card>
          ) : null}

          <SectionHeader title={s.plan.checklistTitle} />
          <Muted style={styles.hint}>{s.plan.checklistHint}</Muted>
          <Card>
            {plan.checklist.map((item, index) => (
              <View key={`${index}-${item.text}`} style={styles.checkRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.done }}
                  onPress={() => edit({ checklist: plan.checklist.map((entry, position) => (position === index ? { ...entry, done: !entry.done } : entry)) })}
                  style={styles.checkPress}
                >
                  <Icon name={item.done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={item.done ? colors.status.success : colors.text.secondary} />
                  <Text style={[styles.body, { flex: 1, color: item.done ? colors.text.secondary : colors.text.primary, textDecorationLine: item.done ? 'line-through' : 'none' }]}>{item.text}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={s.plan.remove} hitSlop={10} onPress={() => edit({ checklist: plan.checklist.filter((_, position) => position !== index) })}>
                  <Icon name="close" size={18} color={colors.text.tertiary} />
                </Pressable>
              </View>
            ))}
            {plan.checklist.length < 15 ? (
              <>
                <Field label={s.plan.addStep} value={newStep} placeholder={s.plan.stepPlaceholder} onChangeText={setNewStep} style={{ marginTop: 10 }} />
                <Button
                  label={s.plan.addStep}
                  icon="plus"
                  variant="secondary"
                  disabled={!newStep.trim()}
                  onPress={() => {
                    edit({ checklist: [...plan.checklist, { text: newStep.trim(), done: false }] });
                    setNewStep('');
                  }}
                />
              </>
            ) : null}
          </Card>

          {plan.tools.length ? (
            <>
              <SectionHeader title={s.plan.toolsTitle} />
              <View style={styles.tools}>
                {plan.tools.map((tool) => (
                  <Pressable key={tool} accessibilityRole="button" onPress={() => navigation.navigate('RecoverySos', { tool })} style={[styles.tool, { borderColor: colors.border.primary, backgroundColor: colors.surface.primary }]}>
                    <Icon name={TOOL_ICONS[tool]} size={18} color={colors.primary} />
                    <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{s.sos.tools[tool][0]}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {plan.weeklyGoals.length ? (
            <>
              <SectionHeader title={s.plan.weeksTitle} />
              {plan.weeklyGoals.map((item, index) => (
                <Card key={`${item.week}-${index}`}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!item.done }}
                    onPress={() => edit({ weeklyGoals: plan.weeklyGoals.map((entry, position) => (position === index ? { ...entry, done: !entry.done } : entry)) })}
                    style={styles.checkPress}
                  >
                    <Icon name={item.done ? 'check-circle' : (`numeric-${Math.min(9, Math.max(1, item.week))}-circle-outline` as IconName)} size={24} color={item.done ? colors.status.success : colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.weekLabel, { color: colors.text.secondary }]}>{f(s.plan.week, { n: num(item.week) })}</Text>
                      <Text style={[styles.body, { color: colors.text.primary, fontWeight: '700' }]}>{item.goal}</Text>
                      {item.expect ? <Muted style={{ fontSize: 13, marginTop: 4 }}>{f(s.plan.expect, { text: item.expect })}</Muted> : null}
                    </View>
                  </Pressable>
                </Card>
              ))}
            </>
          ) : null}

          <SectionHeader title={s.plan.rewardTitle} />
          <Card>
            {plan.rewardIdea ? <Muted style={{ fontSize: 14, marginBottom: 10 }}>{plan.rewardIdea}</Muted> : null}
            <Field label={s.plan.rewardName} value={goal?.title || ''} onChangeText={(value) => edit({ rewardGoal: { title: value, amount: goal?.amount || 0 } })} />
            <Field label={s.plan.rewardAmount} value={goal?.amount ? String(goal.amount) : ''} keyboardType="number-pad" onChangeText={(value) => edit({ rewardGoal: { title: goal?.title || '', amount: parseNumber(value) } })} />
            {goal?.amount ? (
              <>
                <ProgressBar value={saved} target={goal.amount} color={REC.money} height={10} />
                <Text style={[styles.reward, { color: saved >= goal.amount ? REC.money : colors.text.secondary }]}>
                  {saved >= goal.amount ? s.plan.rewardReached : f(s.plan.rewardProgress, { saved: num(saved), goal: num(goal.amount) })}
                </Text>
              </>
            ) : null}
          </Card>
        </>
      )}

      {profile ? (
        <>
          <SectionHeader title={s.plan.reasonsTitle} action={s.plan.editReasons} onAction={() => navigation.navigate('RecoveryOnboarding', { edit: true })} />
          <Card>
            {reasonLabels.map((label) => (
              <View key={label} style={styles.reasonRow}>
                <Icon name="heart" size={16} color={REC.sos} />
                <Text style={[styles.body, { color: colors.text.primary, flex: 1 }]}>{label}</Text>
              </View>
            ))}
            {profile.reasons ? <Text style={[styles.quote, { color: colors.text.primary }]}>{profile.reasons}</Text> : null}
            {!reasonLabels.length && !profile.reasons ? <Muted>{s.sos.noReasons}</Muted> : null}
          </Card>
        </>
      ) : null}

      {plan ? <Button label={s.plan.regenerate} icon="refresh" variant="ghost" onPress={confirmRebuild} /> : null}
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  building: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  summary: { fontSize: 16, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 13, marginBottom: 10, marginTop: -4 },
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkPress: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  weekLabel: { fontSize: 12, fontWeight: '800' },
  reward: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  quote: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginTop: 6 },
});
