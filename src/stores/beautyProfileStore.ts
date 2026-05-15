// MEVE-231 Beauty DNA — single source of truth for the user's beauty profile.
// All AI features (skin coach, today's look, eve 내 핏) consume this store.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

// MEVE-257 — older builds wrote English event keys (e.g. 'graduation') into
// `meve_event_type`. Normalize to Korean on read/write so downstream copy
// like "graduation D-4을 위한 룩" never surfaces.
const EVENT_TYPE_KO_MAP: Record<string, string> = {
  graduation: '졸업',
  wedding: '웨딩',
  travel: '여행',
  date: '데이트',
  photoshoot: '화보',
  birthday: '생일',
  interview: '면접',
};

function normalizeEventType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return EVENT_TYPE_KO_MAP[raw.toLowerCase()] ?? raw;
}

export interface BeautyProfile {
  // 피부
  skinType: string | null;
  skinConcerns: string[];
  allergyIngredients: string[];
  lastSkinScore: number | null;
  // 외모
  personalColor: string | null;
  faceShape: string | null;
  eyeType: string | null;
  skinTone: string | null;
  // 스타일
  vibe: string | null;
  makeupIntensity: number | null;
  // DNA — 8 beauty types (e.g. 'GCS', 'MCB'). Populated by face-scan flow.
  beautyType: string | null;
  // 이벤트
  eventType: string | null;
  eventDate: string | null;
  // 메타
  isProfileComplete: boolean;
  isLoaded: boolean;
}

interface BeautyProfileStore extends BeautyProfile {
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<BeautyProfile>) => Promise<void>;
  updateFromSkinScan: (scanResult: any) => Promise<void>;
  updateFromFaceAnalysis: (faceResult: any) => Promise<void>;
  getProfileContext: () => string;
  getCompletionPercentage: () => number;
}

const INITIAL: BeautyProfile = {
  skinType: null,
  skinConcerns: [],
  allergyIngredients: [],
  lastSkinScore: null,
  personalColor: null,
  faceShape: null,
  eyeType: null,
  skinTone: null,
  vibe: null,
  makeupIntensity: null,
  beautyType: null,
  eventType: null,
  eventDate: null,
  isProfileComplete: false,
  isLoaded: false,
};

export const useBeautyProfile = create<BeautyProfileStore>((set, get) => ({
  ...INITIAL,

  loadProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ isLoaded: true });
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const [
        [, lastScanRaw],
        [, faceAnalysisRaw],
        [, eventType],
        [, eventDate],
        [, vibe],
      ] = await AsyncStorage.multiGet([
        'meve_last_scan_result',
        'meve_face_analysis',
        'meve_event_type',
        'meve_event_date',
        'meve_vibe',
      ]);

      let lastScan: any = null;
      let faceAnalysis: any = null;
      try {
        lastScan = lastScanRaw ? JSON.parse(lastScanRaw) : null;
      } catch {}
      try {
        faceAnalysis = faceAnalysisRaw ? JSON.parse(faceAnalysisRaw) : null;
      } catch {}

      // MEVE-257 — migrate any English eventType in storage to Korean.
      const normalizedEventType = normalizeEventType(eventType);
      if (eventType && normalizedEventType && normalizedEventType !== eventType) {
        try {
          await AsyncStorage.setItem('meve_event_type', normalizedEventType);
        } catch {}
      }

      const merged: Partial<BeautyProfile> = {
        skinType: profile?.skin_type ?? lastScan?.skinType ?? null,
        skinConcerns: profile?.skin_concerns ?? lastScan?.concerns ?? [],
        allergyIngredients: profile?.allergy_ingredients ?? [],
        personalColor: profile?.personal_color ?? faceAnalysis?.personalColor ?? null,
        faceShape: profile?.face_shape ?? faceAnalysis?.faceShape ?? null,
        eyeType: profile?.eye_type ?? faceAnalysis?.eyeShape ?? null,
        skinTone: profile?.skin_tone ?? faceAnalysis?.skinTone ?? null,
        vibe: profile?.vibe ?? vibe ?? null,
        makeupIntensity: profile?.makeup_intensity ?? null,
        beautyType: profile?.beauty_type ?? null,
        eventType: normalizedEventType,
        eventDate: eventDate ?? null,
        lastSkinScore: lastScan?.overallScore ?? null,
        isLoaded: true,
      };

      const required = [merged.skinType, merged.personalColor, merged.eventType];
      merged.isProfileComplete = required.filter(Boolean).length >= 2;

      set(merged);
    } catch (error) {
      console.warn('[BeautyProfile] loadProfile error:', error);
      set({ isLoaded: true });
    }
  },

  updateProfile: async (updates) => {
    // MEVE-257 — normalize any English eventType keys before persisting.
    if (updates.eventType !== undefined && updates.eventType !== null) {
      updates = { ...updates, eventType: normalizeEventType(updates.eventType) };
    }
    set(updates as BeautyProfile);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const supabaseUpdates: Record<string, any> = {};
        if (updates.skinType !== undefined) supabaseUpdates.skin_type = updates.skinType;
        if (updates.skinConcerns !== undefined) supabaseUpdates.skin_concerns = updates.skinConcerns;
        if (updates.allergyIngredients !== undefined)
          supabaseUpdates.allergy_ingredients = updates.allergyIngredients;
        if (updates.personalColor !== undefined)
          supabaseUpdates.personal_color = updates.personalColor;
        if (updates.faceShape !== undefined) supabaseUpdates.face_shape = updates.faceShape;
        if (updates.eyeType !== undefined) supabaseUpdates.eye_type = updates.eyeType;
        if (updates.skinTone !== undefined) supabaseUpdates.skin_tone = updates.skinTone;
        if (updates.vibe !== undefined) supabaseUpdates.vibe = updates.vibe;
        if (updates.makeupIntensity !== undefined)
          supabaseUpdates.makeup_intensity = updates.makeupIntensity;
        if (updates.beautyType !== undefined)
          supabaseUpdates.beauty_type = updates.beautyType;

        if (Object.keys(supabaseUpdates).length > 0) {
          await supabase
            .from('user_profiles')
            .update(supabaseUpdates)
            .eq('id', user.id);
        }
      }

      const writes: Array<[string, string]> = [];
      if (updates.personalColor) writes.push(['meve_personal_color', updates.personalColor]);
      if (updates.vibe) writes.push(['meve_vibe', updates.vibe]);
      if (updates.eventType) writes.push(['meve_event_type', updates.eventType]);
      if (updates.eventDate) writes.push(['meve_event_date', updates.eventDate]);
      if (writes.length > 0) {
        await AsyncStorage.multiSet(writes);
      }
    } catch (error) {
      console.warn('[BeautyProfile] updateProfile error:', error);
    }
  },

  updateFromSkinScan: async (scanResult: any) => {
    if (!scanResult) return;
    const updates: Partial<BeautyProfile> = {
      lastSkinScore: scanResult.overallScore ?? null,
    };
    if (scanResult.skinType) updates.skinType = scanResult.skinType;
    if (Array.isArray(scanResult.concerns) && scanResult.concerns.length) {
      updates.skinConcerns = scanResult.concerns;
    }
    await get().updateProfile(updates);
    try {
      await AsyncStorage.setItem('meve_last_scan_result', JSON.stringify(scanResult));
    } catch {}
  },

  updateFromFaceAnalysis: async (faceResult: any) => {
    if (!faceResult) return;
    const updates: Partial<BeautyProfile> = {};
    if (faceResult.personalColor) updates.personalColor = faceResult.personalColor;
    if (faceResult.faceShape) updates.faceShape = faceResult.faceShape;
    if (faceResult.eyeShape) updates.eyeType = faceResult.eyeShape;
    if (faceResult.skinTone) updates.skinTone = faceResult.skinTone;
    await get().updateProfile(updates);
    try {
      await AsyncStorage.setItem('meve_face_analysis', JSON.stringify(faceResult));
    } catch {}
  },

  getProfileContext: () => {
    const s = get();
    const daysLeft = s.eventDate
      ? Math.max(
          0,
          Math.ceil((new Date(s.eventDate).getTime() - Date.now()) / 86_400_000)
        )
      : null;

    return [
      '사용자 뷰티 프로필:',
      `- 피부 타입: ${s.skinType ?? '미설정'}`,
      `- 피부 고민: ${s.skinConcerns.length ? s.skinConcerns.join(', ') : '없음'}`,
      `- 퍼스널 컬러: ${s.personalColor ?? '미분석'}`,
      `- 얼굴형: ${s.faceShape ?? '미분석'}`,
      `- 눈 타입: ${s.eyeType ?? '미분석'}`,
      `- 추구미: ${s.vibe ?? '미선택'}`,
      `- 최근 스킨 스코어: ${s.lastSkinScore != null ? `${s.lastSkinScore}점` : '미스캔'}`,
      `- 이벤트: ${s.eventType ?? '없음'}${daysLeft != null ? ` D-${daysLeft}` : ''}`,
    ].join('\n');
  },

  getCompletionPercentage: () => {
    const s = get();
    const fields = [
      s.skinType,
      s.personalColor,
      s.faceShape,
      s.vibe,
      s.eventType,
      s.lastSkinScore != null ? 'yes' : null,
      s.skinConcerns.length > 0 ? 'yes' : null,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  },
}));
