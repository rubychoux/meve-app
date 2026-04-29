import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useSubscriptionStore } from '../store/subscription';

const KEY_LOCAL_PREMIUM = 'meve_is_premium';

export async function hydratePremiumFromLocalStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_LOCAL_PREMIUM);
    const isPremium = raw === 'true';
    useSubscriptionStore.getState().setSubscription({
      plan: isPremium ? 'premium' : 'free',
      entitlementActive: isPremium,
      source: 'local',
    });
  } finally {
    useSubscriptionStore.getState().markHydrated();
  }
}

export async function setLocalPremium(isPremium: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_LOCAL_PREMIUM, isPremium ? 'true' : 'false');
  useSubscriptionStore.getState().setSubscription({
    plan: isPremium ? 'premium' : 'free',
    entitlementActive: isPremium,
    source: 'local',
  });
}

export async function refreshPremiumFromSupabase(): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[subscriptions] load failed:', error.message);
    return;
  }

  const active = data?.status === 'active' || data?.status === 'trialing';
  useSubscriptionStore.getState().setSubscription({
    plan: active ? 'premium' : 'free',
    entitlementActive: !!active,
    expiresAt: data?.current_period_end ?? null,
    source: 'supabase',
  });
}

export function isPremiumNow(): boolean {
  return useSubscriptionStore.getState().entitlementActive;
}

export async function getMonthlyCount(table: string, userId: string, dateColumn = 'created_at'): Promise<number> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte(dateColumn, start)
    .lt(dateColumn, end);

  if (error) {
    console.warn(`[${table}] count failed:`, error.message);
    return 0;
  }

  return count ?? 0;
}

