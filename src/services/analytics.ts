import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { init, track as ampTrack, setUserId } from '@amplitude/analytics-react-native';

const ONBOARDING_EVENT_SENT_KEY = 'meve_analytics_onboarding_completed_sent';

let initialized = false;

export type AnalyticsEvent =
  | 'scan_completed'
  | 'vibe_selected'
  | 'eve_tab_entered'
  | 'payment_attempted'
  | 'onboarding_completed';

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const apiKey = (process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? '').trim();
  if (!apiKey) {
    console.warn('[analytics] Missing EXPO_PUBLIC_AMPLITUDE_API_KEY; analytics disabled.');
    return;
  }

  init(apiKey, undefined, {
    // Keep defaults; avoids breaking web dev.
    disableCookies: Platform.OS !== 'web',
  });
}

export function identifyUser(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    setUserId(userId);
  } catch (e) {
    console.warn('[analytics] setUserId failed:', e);
  }
}

export function track(event: AnalyticsEvent, props?: Record<string, any>): void {
  try {
    ampTrack(event, props);
  } catch (e) {
    console.warn('[analytics] track failed:', event, e);
  }
}

export async function trackOnboardingCompletedOnce(props?: Record<string, any>): Promise<void> {
  try {
    const sent = await AsyncStorage.getItem(ONBOARDING_EVENT_SENT_KEY);
    if (sent === 'true') return;
    track('onboarding_completed', props);
    await AsyncStorage.setItem(ONBOARDING_EVENT_SENT_KEY, 'true');
  } catch (e) {
    console.warn('[analytics] onboarding once failed:', e);
  }
}

