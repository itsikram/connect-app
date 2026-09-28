import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { RecoveryDashboard, RecoveryLang } from '../../services/recoveryApi';
import { STRINGS, fill, toLocalDigits } from './i18n';

// Recovery reminders are scheduled on the device, so no reminder content passes
// through the server or push providers. Taps are routed by useNotifications
// (data.type === 'recovery_reminder').
const CHECKIN_TIME_KEY = '@connect/recovery-checkin-reminder';
const SIGNATURE_KEY = '@connect/recovery-reminder-signature';
const DEFAULT_CHECKIN_TIME = '21:00';

/** "HH:MM", or "off" when the daily check-in reminder is turned off. */
export const getCheckinReminderTime = async () => {
  try {
    return (await AsyncStorage.getItem(CHECKIN_TIME_KEY)) || DEFAULT_CHECKIN_TIME;
  } catch (_) {
    return DEFAULT_CHECKIN_TIME;
  }
};

export const setCheckinReminderTime = async (value: string) => {
  await AsyncStorage.setItem(CHECKIN_TIME_KEY, value);
  await AsyncStorage.removeItem(SIGNATURE_KEY);
};

const cancelRecoveryReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => (item.content.data as any)?.type === 'recovery_reminder')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
};

export const clearRecoveryReminders = async () => {
  try {
    await cancelRecoveryReminders();
    await AsyncStorage.removeItem(SIGNATURE_KEY);
  } catch (_) {
    // Nothing scheduled or notifications unavailable (e.g. Expo Go).
  }
};

const content = (title: string, body: string, screen: string) => ({
  title,
  body,
  data: { type: 'recovery_reminder', screen },
});

/**
 * Re-schedules check-in, risky-time and milestone reminders from the latest
 * dashboard. Skips the work when nothing relevant changed.
 */
export const syncRecoveryReminders = async (dashboard: RecoveryDashboard | null, lang: RecoveryLang) => {
  try {
    const profile = dashboard?.profile;
    if (!profile) return clearRecoveryReminders();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const s = STRINGS[lang].reminders;
    const discreet = profile.settings.discreet !== false;
    const checkinTime = await getCheckinReminderTime();
    const riskHours = profile.settings.riskNudges ? (profile.riskHours || []).slice(0, 2) : [];
    const primary = (dashboard?.substances || []).find((item) => item.primary) || dashboard?.substances?.[0];
    const milestoneAt =
      primary && primary.status === 'clean' && primary.milestone.nextDays ? Date.now() + primary.milestone.msToNext : null;
    const signature = JSON.stringify({ lang, discreet, checkinTime, riskHours, milestone: primary?.milestone.nextDays || null, streakStart: primary?.streakStart });
    if ((await AsyncStorage.getItem(SIGNATURE_KEY)) === signature) return;

    await cancelRecoveryReminders();
    const title = discreet ? 'Connect' : STRINGS[lang].common.appName;

    if (checkinTime !== 'off') {
      const [hour, minute] = checkinTime.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: content(title, discreet ? s.checkinDiscreet : s.checkin, 'RecoveryCheckIn'),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }
    for (const hour of riskHours) {
      // 15 minutes before the hour when cravings usually cluster.
      await Notifications.scheduleNotificationAsync({
        content: content(title, discreet ? s.nudgeDiscreet : s.nudge, 'RecoverySos'),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: (hour + 23) % 24, minute: 45 },
      });
    }
    if (milestoneAt && primary?.milestone.nextLabel && milestoneAt > Date.now() + 60000) {
      const body = discreet ? s.milestoneDiscreet : fill(s.milestone, { label: toLocalDigits(primary.milestone.nextLabel, lang) });
      await Notifications.scheduleNotificationAsync({
        content: content(title, body, 'RecoveryHome'),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(milestoneAt) },
      });
    }
    await AsyncStorage.setItem(SIGNATURE_KEY, signature);
  } catch (_) {
    // Reminders are a convenience; never let scheduling break the screen.
  }
};
