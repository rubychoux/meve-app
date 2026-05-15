/**
 * HomeScreen — meve v1.5 디자인.
 *
 * 기존(2152줄) 풀 리라이트 — 백업: HomeScreen.backup.tsx
 *
 * 보존된 로직:
 * - displayName fetch (Supabase + AsyncStorage 캐시)
 * - eventType / eventDate / ddayCount 파생
 * - eventTheme + currentPhase (eventConfig.ts)
 * - todayTip (GPT-4o-mini + AsyncStorage 캐시 + Supabase daily_tips mirror)
 * - useFocusEffect re-load on tab focus
 * - mode (skin/look) reactive subscription
 *
 * 새 레이아웃:
 *   1. TopBar: meve wordmark + 3 Ionicons
 *   2. 날짜 + 이름 인사
 *   3. DNACard mini
 *   4. Today's Beauty (signatureGradient strip)
 *   5. D-day GlassCard (조건부)
 *   6. SKIN / LOOK 2-column mini grid
 *   7. For You 가로 스크롤
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { useMode } from '../../stores/modeStore';
import { MainTabParamList, MainStackParamList } from '../../types';
import { EVENT_CONFIG, EventKey } from '../../constants/events';
import {
  getEventConfig as getEventThemeConfig,
  phaseStatus,
} from '../../constants/eventConfig';
import { colors, BeautyTypeCode } from '../../theme';
import { DNACard, GlassCard, GradientPill } from '../../components/signature';
import { TopBar } from '../../components/common/TopBar';
import {
  loadRoutineCheckin,
  routineCheckinStorageKey,
} from '../../utils/routineCheckin';

interface ScanRecord {
  date: string;
  score: number;
}
interface Routine {
  am: boolean;
  pm: boolean;
}
type ActiveTab = 'SKIN' | 'LOOK';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ─── Fallback tips (used when GPT call fails) ────────────────────────────────

const SKIN_TIPS = [
  '자외선 차단제는 흐린 날에도 꼭 발라주세요',
  '세안 후 3분 이내에 수분크림을 발라야 효과적이에요',
  '주 1회 각질 케어로 피부톤을 맑게 유지해요',
  '잠들기 전 수분팩으로 피부 장벽을 지켜주세요',
  '비타민 C는 아침 루틴에 추가하면 칙칙함을 줄여줘요',
  '클렌징은 35도 미지근한 물이 가장 자극이 적어요',
  '눈가 보습은 30대 이후 노화 예방에 가장 중요해요',
];
const LOOK_TIPS = [
  '쿨톤이면 핑크 계열 블러셔가 더 자연스러워요',
  '눈동자 컬러보다 1톤 어두운 아이라이너가 잘 어울려요',
  '하트형 얼굴엔 광대 아래 사선 블러셔가 잘 어울려요',
  '립은 D-day 2주 전부터 입술 각질 케어를 시작하세요',
  '파운데이션은 목선 경계가 안 생기는 톤으로 고르세요',
  '추구미를 정하면 메이크업이 훨씬 빠르고 통일감 있어요',
  '눈매가 또렷해 보이는 마스카라는 컬링 + 볼륨 조합이에요',
];

// ─── For You — 매칭 추천 제품 (샘플 데이터) ──────────────────────────────────

interface RecommendedProduct {
  brand: string;
  name: string;
  match: string;
  swatch: string;
}
const RECOMMENDED_PRODUCTS: RecommendedProduct[] = [
  { brand: '라네즈', name: 'Neo Cushion Matte 23C', match: '96% match', swatch: '#F5DCD0' },
  { brand: 'rom&nd', name: 'Glasting Melting Balm 13', match: '95% match', swatch: '#C8B5E0' },
  { brand: '힌스', name: 'Second Skin Lip 06', match: '93% match', swatch: '#D49098' },
  { brand: '메디큐브', name: 'Zero Pore Pad', match: '91% match', swatch: '#C8DAEC' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigation = useNavigation<Nav>();

  // Reactive profile subscriptions
  const eventType = useBeautyProfile((s) => s.eventType);
  const eventDate = useBeautyProfile((s) => s.eventDate);
  const profileSkinType = useBeautyProfile((s) => s.skinType);
  const profilePersonalColor = useBeautyProfile((s) => s.personalColor);
  const profileVibe = useBeautyProfile((s) => s.vibe);
  const mode = useMode();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [todayTip, setTodayTip] = useState<string | null>(null);
  const [amRoutineSteps, setAmRoutineSteps] = useState<string[]>([]);
  const [pmRoutineSteps, setPmRoutineSteps] = useState<string[]>([]);

  // ── Display name (Supabase + AsyncStorage cache) ────────────────────────
  const fetchDisplayName = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .single();
    if (data?.display_name) {
      setDisplayName(data.display_name);
      return;
    }
    try {
      const cached = await AsyncStorage.getItem('meve_display_name');
      if (cached) setDisplayName(cached);
    } catch {}
  };
  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) fetchDisplayName(session.user.id);
  };

  useEffect(() => {
    loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) fetchDisplayName(session.user.id);
      },
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Routine steps from AsyncStorage ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('meve_routine');
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        const toLabels = (arr: any): string[] =>
          Array.isArray(arr)
            ? arr
                .map((s) =>
                  typeof s === 'string'
                    ? s
                    : s?.product ?? s?.category ?? s?.step ?? '',
                )
                .filter(Boolean)
            : [];
        setAmRoutineSteps(toLabels(parsed?.am));
        setPmRoutineSteps(toLabels(parsed?.pm));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Today's tip (GPT-4o-mini + cache + Supabase mirror) ─────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const cacheKey = `meve_${mode}_tip_${todayStr}`;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          if (!cancelled) setTodayTip(cached);
          return;
        }
        const idx = new Date().getDate() % 7;
        const fallback = mode === 'look' ? LOOK_TIPS[idx] : SKIN_TIPS[idx];
        let tip = fallback;
        try {
          const prompt = `당신은 meve의 ${
            mode === 'look' ? '스타일' : '스킨케어'
          } 코치예요.
오늘 사용자에게 줄 짧은 뷰티 팁을 한 문장으로 만들어주세요.
한국어 해요체, 60자 이내, 친근하고 실용적으로.
JSON으로만 답하세요: { "tip": "..." }`;
          const res = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 120,
                response_format: { type: 'json_object' },
                messages: [{ role: 'user', content: prompt }],
              }),
            },
          );
          if (res.ok) {
            const json = await res.json();
            const content: string = json.choices?.[0]?.message?.content ?? '';
            const parsed = JSON.parse(content);
            if (typeof parsed?.tip === 'string' && parsed.tip.trim()) {
              tip = parsed.tip.trim();
            }
          }
        } catch {}

        if (cancelled) return;
        setTodayTip(tip);

        try {
          await AsyncStorage.setItem(cacheKey, tip);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('daily_tips').upsert(
              {
                user_id: user.id,
                mode,
                tip_text: tip,
                tip_date: todayStr,
                event_type: eventType ?? null,
              },
              { onConflict: 'user_id,mode,tip_date' },
            );
          }
        } catch {}
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, eventType]);

  // ── Derived values ─────────────────────────────────────────────────────
  const eventConfig = eventType ? EVENT_CONFIG[eventType as EventKey] : null;
  const eventTheme = getEventThemeConfig(eventType);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ddayCount = eventDate
    ? Math.ceil(
        (new Date(eventDate).setHours(0, 0, 0, 0) - today.getTime()) /
          86_400_000,
      )
    : null;

  const ddayLeft = eventDate != null
    ? Math.max(
        0,
        Math.ceil((new Date(eventDate).getTime() - Date.now()) / 86_400_000),
      )
    : null;
  const currentPhase = (() => {
    if (!eventTheme || ddayLeft == null) return null;
    for (const phase of eventTheme.plan) {
      if (phaseStatus(phase.daysBeforeLabel, ddayLeft) === 'current') {
        return phase;
      }
    }
    return eventTheme.plan[0] ?? null;
  })();
  const stageNum =
    eventTheme && currentPhase
      ? eventTheme.plan.indexOf(currentPhase) + 1
      : 0;

  // Date label e.g. "May 13, Wed"
  const now = new Date();
  const dateLabel = `${now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}, ${now.toLocaleDateString('en-US', { weekday: 'short' })}`;

  // Mini-card subtitles
  const skinStepCount = Math.max(amRoutineSteps.length, pmRoutineSteps.length);
  const skinSubtitle = `${skinStepCount > 0 ? `${skinStepCount}단계 · ` : ''}${
    profileSkinType ?? '건성'
  }`;
  const lookSubtitle = `${
    profilePersonalColor ? profilePersonalColor.split(' ')[0] : '쿨톤'
  } · ${profileVibe ?? '글로우'}`;

  // Default DNA (store doesn't yet have dnaType field — fallback to 'GCS')
  const userDnaType: BeautyTypeCode = 'GCS';
  const dnaInfo = colors.types[userDnaType];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF5F6" />
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Date + Name greeting ─────────────────────────────────────── */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Text style={styles.nameLabel}>{displayName ?? '회원'}님</Text>
        </View>

        {/* ── DNA mini card ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <DNACard
            size="mini"
            typeCode={userDnaType}
            typeName={dnaInfo.name}
            typeKr={dnaInfo.kr}
          />
        </View>

        {/* ── Today's Beauty (signatureGradient strip) ────────────────── */}
        {todayTip && (
          <View style={[styles.section, { marginTop: 12 }]}>
            <View style={styles.todayCard}>
              <LinearGradient
                colors={colors.signatureGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.todayStrip}
              />
              <View style={styles.todayContent}>
                <Text style={styles.todayLabel}>Today, from meve</Text>
                <Text style={styles.todayText}>{todayTip}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── D-day GlassCard (when event is set) ────────────────────── */}
        {eventConfig && ddayCount != null && (
          <View style={[styles.section, { marginTop: 12 }]}>
            <GlassCard>
              <View style={styles.ddayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ddayEventName}>
                    {eventConfig.label}
                  </Text>
                  <Text style={styles.ddayBig}>D − {ddayCount}</Text>
                </View>
                {currentPhase && (
                  <View style={styles.ddayPhase}>
                    <Text style={styles.ddayPhaseStage}>
                      {stageNum > 0 ? `${stageNum} 단계 진행중` : currentPhase.daysBeforeLabel}
                    </Text>
                    <Text style={styles.ddayPhaseDesc}>
                      {currentPhase.title}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('DdayPlan')}
                style={styles.ddayLinkRow}
                hitSlop={6}
              >
                <Text style={styles.ddayLink}>케어 플랜 보기 →</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        )}

        {/* ── SKIN / LOOK 2-column grid ───────────────────────────────── */}
        <View style={[styles.section, styles.miniGrid]}>
          <TouchableOpacity
            style={styles.miniCard}
            onPress={() => navigation.navigate('Skincare')}
            activeOpacity={0.85}
          >
            <Text style={[styles.miniCardEyebrow, { color: 'rgba(45,58,107,0.7)' }]}>
              SKIN
            </Text>
            <Text style={styles.miniCardTitle}>오늘의 루틴</Text>
            <Text style={styles.miniCardSub}>{skinSubtitle}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniCard}
            onPress={() => navigation.navigate('Look')}
            activeOpacity={0.85}
          >
            <Text style={[styles.miniCardEyebrow, { color: 'rgba(92,44,63,0.7)' }]}>
              LOOK
            </Text>
            <Text style={styles.miniCardTitle}>오늘의 룩</Text>
            <Text style={styles.miniCardSub}>{lookSubtitle}</Text>
          </TouchableOpacity>
        </View>

        {/* ── For You horizontal scroll ────────────────────────────────── */}
        <View style={styles.forYouHeader}>
          <Text style={styles.forYouTitle}>For You</Text>
          <TouchableOpacity hitSlop={8}>
            <Text style={styles.forYouLink}>더 보기 →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.forYouScroll}
        >
          {RECOMMENDED_PRODUCTS.map((p) => (
            <View key={p.name} style={styles.productCard}>
              <View style={[styles.productSwatch, { backgroundColor: p.swatch }]} />
              <Text style={styles.productBrand} numberOfLines={1}>
                {p.brand}
              </Text>
              <Text style={styles.productName} numberOfLines={2}>
                {p.name}
              </Text>
              <Text style={styles.productMatch}>{p.match}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FBF5F6',
  },

  // TopBar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  wordmark: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: '#2D3A6B',
    fontWeight: '300',
  },
  topBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // Date + name
  dateRow: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  dateLabel: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(45,58,107,0.6)',
  },
  nameLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: '#1A1A1F',
    fontWeight: '600',
    marginTop: 4,
  },

  // Generic section
  section: {
    paddingHorizontal: 20,
    marginTop: 16,
  },

  // Today's Beauty card
  todayCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.1)',
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
  },
  todayStrip: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  todayContent: {
    flex: 1,
  },
  todayLabel: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(45,58,107,0.6)',
  },
  todayText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1F',
    fontWeight: '400',
    marginTop: 4,
  },

  // D-day card
  ddayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  ddayEventName: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  ddayBig: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 32,
    lineHeight: 36,
    color: '#2D3A6B',
    fontWeight: '300',
    marginTop: 4,
  },
  ddayPhase: {
    alignItems: 'flex-end',
  },
  ddayPhaseStage: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    lineHeight: 14,
    color: '#2D3A6B',
    fontWeight: '500',
  },
  ddayPhaseDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  ddayLinkRow: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  ddayLink: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#2D3A6B',
    fontWeight: '500',
  },

  // SKIN / LOOK 2-column grid
  miniGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.08)',
  },
  miniCardEyebrow: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
  },
  miniCardTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: '#1A1A1F',
    fontWeight: '600',
    marginTop: 2,
  },
  miniCardSub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
    marginTop: 2,
  },

  // For You
  forYouHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  forYouTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  forYouLink: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 16,
    color: '#2D3A6B',
    fontWeight: '500',
  },
  forYouScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  productCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.08)',
  },
  productSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  productBrand: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
    fontWeight: '400',
    marginTop: 8,
  },
  productName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#1A1A1F',
    fontWeight: '600',
    marginTop: 2,
  },
  productMatch: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 14,
    color: '#2D3A6B',
    marginTop: 4,
  },
});
