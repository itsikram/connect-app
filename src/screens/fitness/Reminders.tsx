import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi } from '../../services/fitnessApi';
import { Button, Card, ChipGroup, EmptyState, Field, FitnessPage, Icon, IconName, Muted, SectionHeader, errorMessage, timezone } from './ui';

type Props = { navigation?: any };

const TYPES: Array<{ value: string; label: string; icon: IconName; title: string; message: string }> = [
  { value: 'water', label: 'Water', icon: 'cup-water', title: 'Drink water', message: 'Time for a glass of water.' },
  { value: 'meal', label: 'Meal', icon: 'silverware-fork-knife', title: 'Log your meal', message: 'Log your meal to stay on target.' },
  { value: 'workout', label: 'Workout', icon: 'dumbbell', title: 'Workout time', message: 'Time to move. Even 15 minutes counts.' },
  { value: 'weight', label: 'Weigh-in', icon: 'scale-bathroom', title: 'Morning weigh-in', message: 'Weigh in before breakfast for consistent readings.' },
  { value: 'custom', label: 'Custom', icon: 'bell-outline', title: '', message: '' },
];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const typeMeta = (type?: string) => TYPES.find((item) => item.value === type) || TYPES[4];
const toTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const fromTime = (time: string) => { const [h, m] = time.split(':').map(Number); const date = new Date(); date.setHours(h || 0, m || 0, 0, 0); return date; };
const displayTime = (time: string) => fromTime(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const daysLabel = (days?: number[]) => {
  const list = days && days.length ? [...days].sort() : [0, 1, 2, 3, 4, 5, 6];
  if (list.length === 7) return 'Every day';
  if (list.join() === '1,2,3,4,5') return 'Weekdays';
  if (list.join() === '0,6') return 'Weekends';
  return list.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ');
};

export const FitnessReminders = ({ navigation }: Props) => {
  const { colors, isDarkMode } = useTheme();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('water');
  const [title, setTitle] = useState(TYPES[0].title);
  const [time, setTime] = useState('12:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [showPicker, setShowPicker] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => fitnessApi.getReminders()
    .then((response) => setReminders(response.data.reminders || []))
    .catch(() => {})
    .finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  const chooseType = (value: string) => { setType(value); const meta = typeMeta(value); if (meta.title) setTitle(meta.title); };
  const toggleDay = (day: number) => setDays((old) => (old.includes(day) ? (old.length > 1 ? old.filter((d) => d !== day) : old) : [...old, day]));

  const add = async () => {
    if (!title.trim()) { Alert.alert('Reminder', 'Give your reminder a title.'); return; }
    try {
      await fitnessApi.createReminder({ title: title.trim(), time, type, days, message: typeMeta(type).message || undefined, timezone: timezone() });
      setShowForm(false);
      load();
    } catch (error: any) { Alert.alert('Reminder', errorMessage(error, 'Could not create this reminder.')); }
  };

  const toggle = async (item: any, enabled: boolean) => {
    setReminders((old) => old.map((r) => (r._id === item._id ? { ...r, enabled } : r)));
    try { await fitnessApi.updateReminder(item._id, { enabled }); }
    catch (error: any) {
      setReminders((old) => old.map((r) => (r._id === item._id ? { ...r, enabled: !enabled } : r)));
      Alert.alert('Reminder', errorMessage(error, 'Could not update this reminder.'));
    }
  };

  const remove = (item: any) => Alert.alert('Delete reminder', `Delete "${item.title}"?`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: async () => {
        setBusyId(item._id);
        try {
          try { if (item.notificationId) await Notifications.cancelScheduledNotificationAsync(item.notificationId); } catch (_) {}
          await fitnessApi.deleteReminder(item._id);
          load();
        } catch (error: any) { Alert.alert('Reminder', errorMessage(error, 'Could not delete this reminder.')); }
        finally { setBusyId(null); }
      },
    },
  ]);

  const enabledCount = reminders.filter((item) => item.enabled).length;

  return (
    <FitnessPage title="Reminders" subtitle={`${enabledCount} active`} navigation={navigation}>
      <Muted style={{ marginBottom: 12 }}>Small, well-timed nudges are one of the most effective ways to build lasting habits.</Muted>
      {showForm ? (
        <Card>
          <Text style={[s.formTitle, { color: colors.text.primary }]}>New reminder</Text>
          <ChipGroup value={type} onChange={chooseType} options={TYPES.map((item) => ({ value: item.value, label: item.label, icon: item.icon }))} />
          <Field label="Title" value={title} onChangeText={setTitle} style={{ marginTop: 14 }} />
          <Text style={[s.label, { color: colors.text.secondary }]}>Time</Text>
          <Pressable onPress={() => setShowPicker(true)} style={[s.timeButton, { borderColor: colors.border.primary, backgroundColor: colors.surface.secondary }]}>
            <Icon name="clock-outline" size={20} color={colors.primary} />
            <Text style={[s.timeText, { color: colors.text.primary }]}>{displayTime(time)}</Text>
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={fromTime(time)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant={isDarkMode ? 'dark' : 'light'}
              onChange={(event: any, date?: Date) => {
                if (Platform.OS !== 'ios') setShowPicker(false);
                if (event?.type !== 'dismissed' && date) setTime(toTime(date));
              }}
            />
          ) : null}
          {showPicker && Platform.OS === 'ios' ? <Button label="Done" variant="ghost" onPress={() => setShowPicker(false)} /> : null}
          <Text style={[s.label, { color: colors.text.secondary, marginTop: 14 }]}>Repeat</Text>
          <View style={s.days}>
            {DAYS.map((label, day) => {
              const selected = days.includes(day);
              return (
                <Pressable key={day} accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]} accessibilityState={{ selected }} onPress={() => toggleDay(day)} style={[s.day, { backgroundColor: selected ? colors.primary : colors.surface.secondary, borderColor: selected ? colors.primary : colors.border.primary }]}>
                  <Text style={{ color: selected ? '#001014' : colors.text.primary, fontWeight: '700' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.formButtons}>
            <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            <Button label="Add reminder" loadingLabel="Adding..." icon="check" onPress={add} style={{ flex: 2 }} />
          </View>
        </Card>
      ) : <Button label="New reminder" icon="plus" onPress={() => setShowForm(true)} />}

      <SectionHeader title="Your reminders" />
      {loading ? <ActivityIndicator color={colors.primary} /> : reminders.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {reminders.map((item, index) => {
            const meta = typeMeta(item.type);
            return (
              <View key={item._id} style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.primary }, !item.enabled && { opacity: 0.55 }]}>
                <View style={[s.rowIcon, { backgroundColor: colors.surface.secondary }]}><Icon name={meta.icon} size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTime, { color: colors.text.primary }]}>{displayTime(item.time)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.text.secondary, fontSize: 13 }}>{item.title} · {daysLabel(item.days)}{item.autoGenerated ? ' · suggested' : ''}</Text>
                </View>
                <Switch value={!!item.enabled} onValueChange={(value) => toggle(item, value)} trackColor={{ true: colors.primary, false: colors.border.secondary }} thumbColor="#ffffff" />
                <Pressable accessibilityLabel={`Delete ${item.title}`} disabled={busyId === item._id} hitSlop={8} onPress={() => remove(item)} style={{ marginLeft: 8 }}>
                  {busyId === item._id ? <ActivityIndicator size="small" color={colors.status.error} /> : <Icon name="trash-can-outline" size={20} color={colors.text.tertiary} />}
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : <EmptyState icon="bell-sleep-outline" title="No reminders yet" message="Add a water, meal or workout reminder to stay consistent." />}
    </FitnessPage>
  );
};

const s = StyleSheet.create({
  formTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  timeButton: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14 },
  timeText: { fontSize: 18, fontWeight: '700' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTime: { fontSize: 17, fontWeight: '800' },
});
