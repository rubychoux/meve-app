// MEVE-249 — global app mode (SKIN / LOOK) shared across all tabs.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppMode = 'skin' | 'look';

interface ModeStore {
  mode: AppMode;
  setMode: (mode: AppMode) => Promise<void>;
  loadMode: () => Promise<void>;
}

const STORAGE_KEY = 'meve_app_mode';

export const useModeStore = create<ModeStore>((set) => ({
  mode: 'skin',
  setMode: async (mode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  },
  loadMode: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'skin' || saved === 'look') {
        set({ mode: saved });
      }
    } catch {}
  },
}));

export const useMode = () => useModeStore((s) => s.mode);
export const useSetMode = () => useModeStore((s) => s.setMode);
