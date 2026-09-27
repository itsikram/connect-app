import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Checkin, CravingInput, recoveryApi } from '../../services/recoveryApi';
import { buildCalendar, cravingsByHourBin, localDayKey, startOfLocalDay, topTriggers } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { Banner, BarChart, Card, EmptyState, Icon, IconName, LineChart, Muted, REC, RecoveryPage, SectionHeader, Segmented, StatTile, errorMessage } from './ui';

type Props = { navigation?: any };
type Activity = { checkins: Checkin[]; cravings: Array<CravingInput & { id: string }>; lapseDays: string[] };

export const RecoveryProgress = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, num, date } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data } = useRecoveryDashboard(lang, navigation);
  const [range, setRange] = useState<'7' | '30'>('7');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [checkins, cravings, lapses] = await Promise.all([recoveryApi.getCheckins(30), recoveryApi.getCravings(30), recoveryApi.getLapses(30)]);
      setActivity({ checkins: checkins.data.checkins, cravings: cravings.data.cravings, lapseDays: lapses.data.lapses.map((lapse: any) => lapse.day).filter(Boolean) });
      setError('');
    } catch (loadError: any) {
      setError(errorMessage(loadError, s.progress.loadError));
    }
  }, [s.progress.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const days = Number(range);
  const view = useMemo(() => {
    if (!activity) return null;
    const since = startOfLocalDay(-(days - 1)).getTime();
    const sinceKey = localDayKey(since);
    const checkins = activity.checkins.filter((checkin) => checkin.day >= sinceKey).sort((a, b) => a.day.localeCompare(b.day));
    const cravings = activity.cravings.filter((craving) => Date.parse(craving.at) >= since);
    const shortDay = (day: string) => date(`${day}T12:00:00`, days <= 7 ? { weekday: 'short' } : { day: 'numeric' });
    const triggerLabel = (key: string) => content?.triggers?.find((item) => item.key === key)?.label || key;
    return {
      checkins,
      cravings,
      resisted: cravings.filter((craving) => craving.outcome === 'resisted').length,
      cravingTrend: checkins.map((checkin) => ({ label: shortDay(checkin.day), value: checkin.craving })),
      moodTrend: checkins.map((checkin) => ({ label: shortDay(checkin.day), value: checkin.mood })),
      byHour: cravingsByHourBin(cravings).map((value, index) => ({ label: s.progress.hourBins[index], value })),
      byTrigger: topTriggers([...cravings, ...checkins]).map(([key, value]) => ({ label: triggerLabel(key), value })),
    };
  }, [activity, days, content?.triggers, date, s.progress.hourBins]);

  const calendar = useMemo(() => (activity ? buildCalendar(30, activity.checkins, activity.lapseDays) : []), [activity]);
  const substances = data?.substances || [];
  const current = substances.find((item) => item.primary) || substances[0];
  const earned = new Set((data?.badges || []).map((badge) => badge.key));
  const allBadges = Object.entries(content?.badges || {});
  const empty = view && !view.checkins.length && !view.cravings.length;
  const cellColor = (state: string) => (state === 'clean' ? colors.status.success : state === 'slip' ? REC.sos : colors.surface.secondary);

  return (
    <RecoveryPage title={s.progress.title} navigation={navigation} onRefresh={load}>
      {error ? <Banner icon="cloud-off-outline" tone="warn" text={error} /> : null}
      <Segmented
        options={[
          { label: s.progress.range7, value: '7' },
          { label: s.progress.range30, value: '30' },
        ]}
        value={range}
        onChange={(value) => setRange(value as '7' | '30')}
      />
      <View style={{ height: 12 }} />

      {!view && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : null}

      {view ? (
        <View style={styles.grid}>
          <StatTile style={styles.tile} icon="lightning-bolt-outline" color={REC.calm} label={s.progress.summaryCravings} value={num(view.cravings.length)} />
          <StatTile style={styles.tile} icon="shield-check-outline" color={colors.status.success} label={s.progress.summaryResisted} value={num(view.resisted)} />
          <StatTile style={styles.tile} icon="calendar-check-outline" color={REC.warm} label={s.progress.summaryCheckins} value={num(view.checkins.length)} />
        </View>
      ) : null}

      {empty ? <EmptyState icon="chart-timeline-variant" title={s.progress.title} message={s.progress.noData} /> : null}

      {view && view.cravingTrend.length ? (
        <>
          <SectionHeader title={s.progress.cravingTrend} />
          <Card>
            <LineChart data={view.cravingTrend} color={REC.sos} decimals={0} />
          </Card>
          <SectionHeader title={s.progress.moodTrend} />
          <Card>
            <LineChart data={view.moodTrend} color={colors.primary} decimals={0} />
          </Card>
        </>
      ) : null}

      {view && view.cravings.length ? (
        <>
          <SectionHeader title={s.progress.byHour} />
          <Card>
            <BarChart data={view.byHour} color={REC.calm} emptyLabel={s.progress.noData} />
          </Card>
        </>
      ) : null}

      {view && view.byTrigger.length ? (
        <>
          <SectionHeader title={s.progress.byTrigger} />
          <Card>
            {view.byTrigger.map((item) => (
              <View key={item.label} style={styles.triggerRow}>
                <Text style={[styles.triggerLabel, { color: colors.text.primary }]}>{item.label}</Text>
                <View style={[styles.triggerTrack, { backgroundColor: colors.surface.secondary }]}>
                  <View style={[styles.triggerFill, { backgroundColor: REC.warm, width: `${Math.max(8, (item.value / view.byTrigger[0].value) * 100)}%` }]} />
                </View>
                <Text style={[styles.triggerValue, { color: colors.text.secondary }]}>{num(item.value)}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {calendar.length ? (
        <>
          <SectionHeader title={s.progress.calendarTitle} />
          <Card>
            <View style={styles.calendar}>
              {calendar.map((cell) => (
                <View key={cell.day} accessible accessibilityLabel={`${cell.day}: ${cell.state}`} style={[styles.cell, { backgroundColor: cellColor(cell.state) }]}>
                  <Text style={[styles.cellText, { color: cell.state === 'none' ? colors.text.tertiary : '#ffffff' }]}>{num(Number(cell.day.slice(8)))}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              {(['clean', 'slip', 'none'] as const).map((state) => (
                <View key={state} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: cellColor(state) }]} />
                  <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{state === 'clean' ? s.progress.legendClean : state === 'slip' ? s.progress.legendSlip : s.progress.legendNone}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {current && content?.milestones?.length ? (
        <>
          <SectionHeader title={f(s.progress.milestonesTitle, { name: current.name })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {content.milestones.map((milestone) => {
              const reached = current.status === 'clean' && current.currentStreakDays >= milestone.days;
              return (
                <View key={milestone.days} style={[styles.chip, { borderColor: reached ? colors.status.success : colors.border.primary, backgroundColor: colors.surface.primary }]}>
                  <Icon name={reached ? 'check-decagram' : 'flag-outline'} size={22} color={reached ? colors.status.success : colors.text.tertiary} />
                  <Text numberOfLines={2} style={[styles.chipLabel, { color: reached ? colors.text.primary : colors.text.tertiary }]}>{milestone.label}</Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {allBadges.length ? (
        <>
          <SectionHeader title={s.progress.badgesTitle} />
          <Muted style={{ fontSize: 13, marginTop: -6, marginBottom: 10 }}>{f(s.progress.points, { n: num(data?.points) })}</Muted>
          <View style={styles.badges}>
            {allBadges.map(([key, badge]) => {
              const has = earned.has(key);
              return (
                <View key={key} style={[styles.badge, { borderColor: colors.border.primary, backgroundColor: colors.surface.primary, opacity: has ? 1 : 0.55 }]}>
                  <Icon name={(has ? badge.icon : 'lock-outline') as IconName} size={26} color={has ? REC.warm : colors.text.tertiary} />
                  <Text numberOfLines={2} style={[styles.chipLabel, { color: colors.text.primary }]}>{badge.label}</Text>
                  {!has ? <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{s.progress.locked}</Text> : null}
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tile: { flexBasis: '30%', flexGrow: 1 },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  triggerLabel: { width: 110, fontSize: 13, fontWeight: '600' },
  triggerTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  triggerFill: { height: 10, borderRadius: 5 },
  triggerValue: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 12, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  hScroll: { gap: 10, paddingBottom: 4, marginBottom: 12 },
  chip: { width: 96, borderWidth: 1.5, borderRadius: 14, padding: 10, alignItems: 'center', gap: 6 },
  chipLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: '30%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 10, alignItems: 'center', gap: 4 },
});
