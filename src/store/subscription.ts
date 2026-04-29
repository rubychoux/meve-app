import { create } from 'zustand';

export type SubscriptionPlan = 'free' | 'premium';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  entitlementActive: boolean;
  expiresAt: string | null;
  source: 'local' | 'supabase' | 'revenuecat' | null;
  isHydrated: boolean;

  setSubscription: (next: Partial<Omit<SubscriptionState, 'setSubscription' | 'markHydrated' | 'reset'>>) => void;
  markHydrated: () => void;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  plan: 'free',
  entitlementActive: false,
  expiresAt: null,
  source: null,
  isHydrated: false,

  setSubscription: (next) =>
    set((state) => ({
      ...state,
      ...next,
    })),
  markHydrated: () => set({ isHydrated: true }),
  reset: () =>
    set({
      plan: 'free',
      entitlementActive: false,
      expiresAt: null,
      source: null,
      isHydrated: false,
    }),
}));

