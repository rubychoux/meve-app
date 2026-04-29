import { create } from 'zustand';
import { UserProfile, SkinType, SkinConcern, ExperienceLevel, SkinGoal, SkinMode } from '../types';
export { useSubscriptionStore } from './subscription';

// ─── Auth Store ───────────────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  session: { accessToken: string } | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  skinMode: SkinMode;

  // Event setup
  eventType: string | null;
  eventDate: string | null;
  careDirections: string[];

  setUser: (user: UserProfile | null) => void;
  setSession: (session: { accessToken: string } | null) => void;
  setLoading: (val: boolean) => void;
  setOnboardingComplete: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setSkinMode: (mode: SkinMode) => void;
  setEvent: (type: string, date: string, directions: string[]) => void;
  clearEvent: () => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  hasCompletedOnboarding: false,
  skinMode: 'everyday',
  eventType: null,
  eventDate: null,
  careDirections: [],

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
  updateProfile: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
  setSkinMode: (skinMode) => set({ skinMode }),
  setEvent: (eventType, eventDate, careDirections) => set({ eventType, eventDate, careDirections }),
  clearEvent: () => set({ eventType: null, eventDate: null, careDirections: [] }),
  signOut: () => set({
    user: null,
    session: null,
    hasCompletedOnboarding: false,
    skinMode: 'everyday',
    eventType: null,
    eventDate: null,
    careDirections: [],
  }),
}));

// ─── Onboarding Survey Store ──────────────────────────────────────────────────

interface OnboardingState {
  skinType: SkinType | null;
  concerns: SkinConcern[];
  routineSteps: number;
  routineBrands: string[];
  experienceLevel: ExperienceLevel | null;
  goal: SkinGoal | null;
  skinDataConsent: boolean;

  setSkinType: (val: SkinType) => void;
  toggleConcern: (val: SkinConcern) => void;
  setRoutineSteps: (val: number) => void;
  setRoutineBrands: (val: string[]) => void;
  setExperienceLevel: (val: ExperienceLevel) => void;
  setGoal: (val: SkinGoal) => void;
  setSkinDataConsent: (val: boolean) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  skinType: null,
  concerns: [],
  routineSteps: 0,
  routineBrands: [],
  experienceLevel: null,
  goal: null,
  skinDataConsent: false,

  setSkinType: (skinType) => set({ skinType }),
  toggleConcern: (val) =>
    set((state) => ({
      concerns: state.concerns.includes(val)
        ? state.concerns.filter((c) => c !== val)
        : [...state.concerns, val],
    })),
  setRoutineSteps: (routineSteps) => set({ routineSteps }),
  setRoutineBrands: (routineBrands) => set({ routineBrands }),
  setExperienceLevel: (experienceLevel) => set({ experienceLevel }),
  setGoal: (goal) => set({ goal }),
  setSkinDataConsent: (skinDataConsent) => set({ skinDataConsent }),
  reset: () =>
    set({
      skinType: null,
      concerns: [],
      routineSteps: 0,
      routineBrands: [],
      experienceLevel: null,
      goal: null,
      skinDataConsent: false,
    }),
}));
