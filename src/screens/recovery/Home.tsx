import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { recoveryApi } from '../../services/recoveryApi';
import { useRecoveryI18n } from './i18n';
import { useRecoveryDashboard } from './hooks';
import { syncRecoveryReminders } from './reminders';
import {
  Banner,
  Button,
  Card,
  CleanTimeCounter,
  EmergencyStrip,
  EmptyState,
  HeaderIconButton,
  Icon,
  IconName,
  Muted,
  REC,
  RecoveryPage,
  Ring,
  SectionHeader,
  Segmented,
  SosButton,
  StatTile,
} from './ui';

type Props = { navigation?: any };

export const RecoveryHome = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, num, money, duration } = useRecoveryI18n();
  const { data, loading, refreshing, error, offsetMs, refresh, pullToRefresh } = useRecoveryDashboard(lang, navigation);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [daily, setDaily] = useState<{ note: string; mission: string } | null>(null);
  const [pending, setPending] = useState(0);
  const dailyRequested = useRef('');

  // Upload SOS sessions that were saved while offline.
  useEffect(() => {
    const sync = async () => {
      const sent = await recoveryApi.flushOutbox(lang).catch(() => 0);
      if (sent) refresh();
      setPending(await recoveryApi.pendingCount());
    };
    sync();
    const unsubscribe = navigation?.addListener?.('focus', sync);
    return () => unsubscribe?.();
  }, [lang, navigation, refresh]);

  // Keep on-device reminders (check-in, risky times, next milestone) in step with fresh data.
  useEffect(() => {
    if (data && !error) syncRecoveryReminders(data, lang);
  }, [data, error, lang]);

  // The AI note is generated once per day, after the dashboard is on screen.
  useEffect(() => {
    if (!data?.profile) return;
    if (data.daily) {
      setDaily(data.daily);
      return;
    }
    const key = `${data.todayKey}-${lang}`;
    if (dailyRequested.current === key) return;
    dailyRequested.current = key;
    recoveryApi
      .getDaily(lang)
      .then((response) => setDaily(response.data))
      .catch(() => {});
  }, [data?.profile, data?.daily, data?.todayKey, lang]);

  const sosFooter = <SosButton label={s.common.sos} onPress={() => navigation.navigate('RecoverySos')} />;

  if (loading && !data) {
    return (
      <RecoveryPage title={s.home.title} navigation={navigation} showSos={false} footer={sosFooter}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Muted style={{ marginTop: 12 }}>{s.common.loading}</Muted>
        </View>
      </RecoveryPage>
    );
  }

  if (error && !data) {
    return (
      <RecoveryPage title={s.home.title} navigation={navigation} showSos={false} footer={sosFooter}>
        <EmergencyStrip lang={lang} />
        <EmptyState icon="wifi-off" title={s.common.offline} message={error} action={s.common.tryAgain} onAction={refresh} />
        <Button label={s.home.helpNow} variant="secondary" icon="lifebuoy" onPress={() => navigation.navigate('RecoveryHelp')} />
      </RecoveryPage>
    );
  }

  if (!data?.profile) {
    return (
      <RecoveryPage title={s.home.title} navigation={navigation} showSos={false} footer={sosFooter}>
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
            <Icon name="sprout" size={34} color={colors.onPrimary} />
          </View>
          <Text style={[styles.welcomeTitle, { color: colors.text.primary }]}>{s.home.welcomeTitle}</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.home.welcomeBody}</Muted>
          {s.home.features.map((feature, index) => (
            <View key={feature} style={styles.featureRow}>
              <Icon name={(['lifebuoy', 'robot-happy-outline', 'chart-line', 'shield-lock-outline'] as IconName[])[index]} size={20} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.text.primary }]}>{feature}</Text>
            </View>
          ))}
          <Button label={s.home.start} icon="arrow-right" onPress={() => navigation.navigate('RecoveryOnboarding')} style={{ alignSelf: 'stretch', marginTop: 18 }} />
          <Button label={s.home.helpNow} variant="ghost" icon="phone-outline" onPress={() => navigation.navigate('RecoveryHelp')} style={{ alignSelf: 'stretch' }} />
        </Card>
        <Muted style={styles.disclaimer}>{s.onboarding.notMedical}</Muted>
      </RecoveryPage>
    );
  }

  const { profile } = data;
  const substances = data.substances || [];
  const current = substances.find((item) => item.key === selectedKey) || substances.find((item) => item.primary) || substances[0];
  const preparing = current?.status === 'preparing';
  const totals = data.totals;
  const tiles: Array<{ key: string; icon: IconName; route: string }> = [
    { key: 'coach', icon: 'robot-happy-outline', route: 'RecoveryCoach' },
    { key: 'checkin', icon: 'calendar-check-outline', route: 'RecoveryCheckIn' },
    { key: 'plan', icon: 'map-marker-path', route: 'RecoveryPlan' },
    { key: 'progress', icon: 'chart-timeline-variant', route: 'RecoveryProgress' },
    { key: 'slip', icon: 'restart', route: 'RecoveryLapse' },
    { key: 'help', icon: 'lifebuoy', route: 'RecoveryHelp' },
  ];
  const celebrations = (data.newBadges || []).filter((badge) => badge.key.startsWith('clean_'));
  const otherNewBadges = (data.newBadges || []).filter((badge) => !badge.key.startsWith('clean_'));

  return (
    <RecoveryPage
      title={s.home.title}
      navigation={navigation}
      showSos={false}
      refreshing={refreshing}
      onRefresh={pullToRefresh}
      right={<HeaderIconButton icon="cog-outline" label={s.home.settings} onPress={() => navigation.navigate('RecoverySettings')} />}
      footer={sosFooter}
    >
      {error ? <Banner icon="cloud-off-outline" text={s.common.offline} /> : null}
      {pending ? <Banner icon="cloud-upload-outline" text={f(s.home.pendingSync, { n: num(pending) })} /> : null}
      {celebrations.map((badge) => (
        <Banner key={badge.key} icon="party-popper" tone="good" text={f(s.home.celebrate, { label: badge.label.replace(/ free$| মুক্ত$/, '') })} />
      ))}
      {otherNewBadges.map((badge) => (
        <Banner key={badge.key} icon="medal-outline" tone="good" text={f(s.common.newBadge, { label: badge.label })} />
      ))}

      {substances.length > 1 ? (
        <Segmented options={substances.map((item) => ({ label: item.name, value: item.key }))} value={current?.key || ''} onChange={setSelectedKey} />
      ) : null}

      {current ? (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={[styles.heroLabel, { color: colors.text.secondary }]}>{preparing ? s.home.quitIn : `${s.home.cleanFor} · ${current.name}`}</Text>
          <Ring size={214} stroke={14} progress={preparing ? 0 : current.milestone.progress} color={colors.primary}>
            <CleanTimeCounter since={current.streakStart} until={preparing ? Date.parse(current.quitDate) : null} lang={lang} offsetMs={offsetMs} />
          </Ring>
          {!preparing ? (
            <Text style={[styles.milestone, { color: colors.text.primary }]}>
              {current.milestone.nextLabel ? f(s.home.nextMilestone, { label: current.milestone.nextLabel }) : s.home.allMilestones}
            </Text>
          ) : null}
          {!preparing && current.milestone.nextLabel ? <Muted style={{ fontSize: 13 }}>{duration(current.milestone.msToNext)}</Muted> : null}
        </Card>
      ) : null}

      {current ? (
        <View style={styles.grid}>
          <StatTile style={styles.tile} icon="cash-multiple" color={REC.money} label={s.home.moneySaved} value={money(preparing ? 0 : totals?.moneySaved)} />
          <StatTile style={styles.tile} icon="close-circle-outline" color={REC.calm} label={f(s.home.unitsAvoided, { unit: current.unit })} value={num(current.unitsAvoided)} />
          <StatTile style={styles.tile} icon="shield-check-outline" color={colors.status.success} label={s.home.cravingsBeaten} value={num(totals?.cravingsResisted)} />
          {current.lifeRegainedMinutes ? (
            <StatTile style={styles.tile} icon="heart-pulse" color={REC.sos} label={s.home.lifeRegained} value={duration(current.lifeRegainedMinutes * 60000)} />
          ) : (
            <StatTile style={styles.tile} icon="trophy-outline" color={REC.warm} label={s.home.longest} value={`${num(current.longestStreakDays)} ${s.common.days}`} />
          )}
        </View>
      ) : null}

      {!profile.onboardingCompleted ? (
        <Card onPress={() => navigation.navigate('RecoveryOnboarding', { resume: true })}>
          <View style={styles.rowHead}>
            <Icon name="clipboard-text-outline" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{s.home.completePlanTitle}</Text>
          </View>
          <Muted style={{ fontSize: 13 }}>{s.home.completePlanBody}</Muted>
          <Button label={s.home.completePlanCta} icon="arrow-right" onPress={() => navigation.navigate('RecoveryOnboarding', { resume: true })} />
        </Card>
      ) : null}

      {data.proHelp?.length ? (
        <Card>
          <View style={styles.rowHead}>
            <Icon name="doctor" size={22} color={REC.warm} />
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{s.home.proHelpTitle}</Text>
          </View>
          <Muted style={{ fontSize: 13 }}>{s.home.proHelp[data.proHelp[0]]}</Muted>
          <Button label={s.home.proHelpCta} variant="secondary" icon="lifebuoy" onPress={() => navigation.navigate('RecoveryHelp')} />
        </Card>
      ) : null}

      <SectionHeader title={s.home.todayTitle} />
      <Card onPress={() => navigation.navigate('RecoveryCheckIn')}>
        <View style={styles.rowHead}>
          <Icon name={data.today?.checkin ? 'check-circle' : 'calendar-check-outline'} size={22} color={data.today?.checkin ? colors.status.success : colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{data.today?.checkin ? s.home.checkinDone : s.home.checkinTitle}</Text>
          {totals?.checkinStreak ? <Text style={[styles.pill, { color: colors.text.secondary, borderColor: colors.border.primary }]}>{f(s.home.checkinStreak, { n: num(totals.checkinStreak) })}</Text> : null}
        </View>
        <Muted style={{ fontSize: 13 }}>{data.today?.checkin?.microGoal || data.today?.checkin?.reflection || s.home.checkinPrompt}</Muted>
      </Card>
      {daily ? (
        <Card>
          <View style={styles.rowHead}>
            <Icon name="white-balance-sunny" size={22} color={REC.warm} />
            <Text style={[styles.dailyNote, { color: colors.text.primary }]}>{daily.note}</Text>
          </View>
          <View style={[styles.mission, { backgroundColor: colors.surface.secondary }]}>
            <Icon name="flag-checkered" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.missionLabel, { color: colors.text.secondary }]}>{s.home.mission}</Text>
              <Text style={[styles.missionText, { color: colors.text.primary }]}>{daily.mission}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {current && !preparing && (current.health.last || current.health.next) ? (
        <Card>
          <View style={styles.rowHead}>
            <Icon name="heart-plus-outline" size={22} color={REC.sos} />
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{s.home.healthTitle}</Text>
          </View>
          {current.health.last ? (
            <View style={styles.healthRow}>
              <Icon name="check-circle" size={18} color={colors.status.success} />
              <Text style={[styles.healthText, { color: colors.text.primary }]}>
                <Text style={{ fontWeight: '800' }}>{f(s.home.healthNow, { at: current.health.last.at })}. </Text>
                {current.health.last.text}
              </Text>
            </View>
          ) : null}
          {current.health.next ? (
            <View style={styles.healthRow}>
              <Icon name="progress-clock" size={18} color={colors.primary} />
              <Text style={[styles.healthText, { color: colors.text.secondary }]}>
                <Text style={{ fontWeight: '800', color: colors.text.primary }}>{f(s.home.healthNext, { at: current.health.next.at })}. </Text>
                {current.health.next.text} ({duration(current.health.msToNext)})
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title={s.home.toolsTitle} />
      <View style={styles.grid}>
        {tiles.map((tile) => {
          const [label, hint] = s.home.tools[tile.key as keyof typeof s.home.tools];
          return (
            <Card key={tile.key} style={styles.toolTile} onPress={() => navigation.navigate(tile.route)}>
              <Icon name={tile.icon} size={24} color={tile.key === 'help' || tile.key === 'slip' ? REC.sos : colors.primary} />
              <Text style={[styles.toolLabel, { color: colors.text.primary }]}>{label}</Text>
              <Text style={[styles.toolHint, { color: colors.text.tertiary }]}>{hint}</Text>
            </Card>
          );
        })}
      </View>

      {data.badges?.length ? (
        <>
          <SectionHeader title={s.home.badgesTitle} action={f(s.home.pointsLabel, { n: num(data.points) })} onAction={() => navigation.navigate('RecoveryProgress')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
            {data.badges.map((badge) => (
              <View key={badge.key} style={[styles.badge, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}>
                <Icon name={badge.icon as IconName} size={26} color={REC.warm} />
                <Text numberOfLines={2} style={[styles.badgeLabel, { color: colors.text.primary }]}>{badge.label}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Pressable onPress={() => navigation.navigate('RecoveryHelp')}>
        <Muted style={styles.disclaimer}>{s.common.aiDisclaimer}</Muted>
      </Pressable>
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 60 },
  heroIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 12 },
  featureText: { flex: 1, fontSize: 15, fontWeight: '600' },
  heroLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  milestone: { fontSize: 16, fontWeight: '800', marginTop: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tile: { flexBasis: '46%', flexGrow: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  pill: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  dailyNote: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  mission: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, marginTop: 8 },
  missionLabel: { fontSize: 12, fontWeight: '700' },
  missionText: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  healthRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  healthText: { flex: 1, fontSize: 14, lineHeight: 20 },
  toolTile: { flexBasis: '30%', flexGrow: 1, padding: 12, marginBottom: 0, gap: 4 },
  toolLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  toolHint: { fontSize: 11 },
  badge: { width: 104, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6 },
  badgeLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 14 },
});
