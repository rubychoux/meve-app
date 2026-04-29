import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/** Single scheduled daily routine slot — avoids stacking multiple daily alarms. */
export const ROUTINE_NOTIFICATION_ID = 'meve_routine_daily';

export const NOTIFICATION_STORAGE_KEY = 'meve_notification_settings';

export type ReminderInterval = 3 | 7 | 14;

export interface NotificationPrefs {
  master: boolean;
  dailyRoutine: boolean;
  dailyRoutineTime: string;
  /** When true, hour/minute use calendar triggers in Asia/Seoul (evening check-in after first scan). */
  dailyRoutineUsesFixedKST?: boolean;
  scanReminder: boolean;
  scanReminderInterval: ReminderInterval;
  community: boolean;
  marketing: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  master: true,
  dailyRoutine: false,
  dailyRoutineTime: '21:00',
  dailyRoutineUsesFixedKST: false,
  scanReminder: false,
  scanReminderInterval: 7,
  community: true,
  marketing: false,
};

const FIRST_SCAN_NOTIF_HANDLED_KEY = 'meve_first_scan_notification_handled';
const LEGACY_ROUTINE_SCHEDULES_MIGRATION_KEY = 'meve_notif_migration_legacy_routine_v2';

const ROUTINE_CHANNEL_ID = 'routine';

let migrateLegacyRoutineSchedulesPromise: Promise<void> | null = null;

/**
 * One-time clear of pre-identified scheduled locals (legacy random IDs) then reschedule from prefs.
 * Safe to await before first-scan scheduling so upgrades never stack duplicate daily reminders.
 */
export async function ensureRoutineNotificationsMigrated(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (!migrateLegacyRoutineSchedulesPromise) {
    migrateLegacyRoutineSchedulesPromise = runLegacyRoutineMigration();
  }

  await migrateLegacyRoutineSchedulesPromise;
}

async function runLegacyRoutineMigration(): Promise<void> {
  try {
    const flag = await AsyncStorage.getItem(LEGACY_ROUTINE_SCHEDULES_MIGRATION_KEY);
    if (flag === 'true') return;

    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending.map((r) =>
        r.identifier !== ROUTINE_NOTIFICATION_ID
          ? Notifications.cancelScheduledNotificationAsync(r.identifier).catch(() => {})
          : Promise.resolve(),
      ),
    );

    await AsyncStorage.setItem(LEGACY_ROUTINE_SCHEDULES_MIGRATION_KEY, 'true');

    const prefs = await loadPrefs();
    await applyRoutineSchedule(prefs);
  } catch (e) {
    console.warn('[routineNotifications] legacy migration:', e);
  }
}

function registerHandlerOnce() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

registerHandlerOnce();

async function ensureAndroidRoutineChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ROUTINE_CHANNEL_ID, {
    name: '루틴 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Applies prefs to the OS scheduler using one identifier (see ROUTINE_NOTIFICATION_ID).
 * Cancels the routine slot when master is off or daily routine is off.
 */
export async function applyRoutineSchedule(prefs: NotificationPrefs): Promise<void> {
  if (Platform.OS === 'web') return;

  await ensureAndroidRoutineChannel();

  try {
    await Notifications.cancelScheduledNotificationAsync(ROUTINE_NOTIFICATION_ID);
  } catch {
    /* none scheduled */
  }

  if (!prefs.master || !prefs.dailyRoutine) return;

  const [hourRaw, minuteRaw] = prefs.dailyRoutineTime.split(':').map((n) => parseInt(n, 10));
  const hour = Number.isFinite(hourRaw) ? hourRaw : 21;
  const minute = Number.isFinite(minuteRaw) ? minuteRaw : 0;

  const useKst = prefs.dailyRoutineUsesFixedKST === true;

  const trigger = useKst
    ? ({
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
        timezone: 'Asia/Seoul',
        channelId: ROUTINE_CHANNEL_ID,
      } satisfies Notifications.CalendarTriggerInput)
    : ({
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: ROUTINE_CHANNEL_ID,
      } satisfies Notifications.DailyTriggerInput);

  await Notifications.scheduleNotificationAsync({
    identifier: ROUTINE_NOTIFICATION_ID,
    content: {
      title: '오늘의 루틴 시간이에요 ✨',
      body: '저녁 루틴 체크인 — 오늘 피부 관리 어떠셨나요?',
    },
    trigger,
  });
}

async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

async function savePrefs(next: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
}

/**
 * Runs once after the first completed skin scan (real or DEV mock): prompts for notification
 * permission in context, then schedules one daily evening reminder at 21:00 Asia/Seoul.
 * Does not stack extra notifications — uses ROUTINE_NOTIFICATION_ID only.
 */
export async function handleFirstScanCompleted(): Promise<void> {
  if (Platform.OS === 'web') return;

  await ensureRoutineNotificationsMigrated();

  try {
    const done = await AsyncStorage.getItem(FIRST_SCAN_NOTIF_HANDLED_KEY);
    if (done === 'true') return;

    await AsyncStorage.setItem(FIRST_SCAN_NOTIF_HANDLED_KEY, 'true');

    const prefs = await loadPrefs();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain !== false) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }

    if (!granted) return;

    if (!prefs.master) return;

    // Respect explicit opt-out of daily routine reminders before first scan.
    if (prefs.dailyRoutine === false) return;

    const next: NotificationPrefs = {
      ...prefs,
      dailyRoutine: true,
      dailyRoutineTime: '21:00',
      dailyRoutineUsesFixedKST: true,
    };

    await savePrefs(next);
    await applyRoutineSchedule(next);
  } catch (e) {
    console.warn('[routineNotifications] handleFirstScanCompleted:', e);
  }
}
