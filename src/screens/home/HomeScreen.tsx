import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

const logo = require('../../../assets/images/meve-logo.png');
import { GlassCard } from '../../components/ui/GlassCard';
import { BubbleIcon } from '../../components/ui/BubbleIcon';
import { MEVE_GRADIENT } from '../../constants/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CALENDAR_EXPANDED_KEY = 'meve_calendar_expanded';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  loadRoutineCheckin,
  loadRoutineCheckinsForDates,
  routineCheckinStorageKey,
  RoutineCheckin,
} from '../../utils/routineCheckin';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { MainTabParamList, MainStackParamList } from '../../types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { useMode } from '../../stores/modeStore';
import { ModeToggle } from '../../components/ui/ModeToggle';
import {
  getEventContextText,
  getEventFocusMessage,
} from '../../utils/eventLens';
import { EVENT_CONFIG, EventKey } from '../../constants/events';
import {
  getEventConfig as getEventThemeConfig,
  phaseStatus,
} from '../../constants/eventConfig';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateStreak(isoDates: string[]): number {
  if (isoDates.length === 0) return 0;
  const unique = [...new Set(isoDates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 0;
  let expected = unique[0];
  for (const d of unique) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().slice(0, 10);
    } else {
      break;
    }
  }
  return streak;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanRecord {
  date: string; // YYYY-MM-DD
  score: number;
}

interface Routine {
  am: boolean;
  pm: boolean;
}

type PersonalColor = '쿨톤 여름' | '쿨톤 겨울' | '웜톤 봄' | '웜톤 가을';

const PERSONAL_COLOR_SWATCHES: Record<PersonalColor, string[]> = {
  '쿨톤 여름': ['#F4B8C8', '#C8A8D4', '#A8C4D4', '#D4A8B8'],
  '쿨톤 겨울': ['#C41E3A', '#4B0082', '#000080', '#2F4F4F'],
  '웜톤 봄':   ['#FFB347', '#FF8C69', '#FFD700', '#98FB98'],
  '웜톤 가을': ['#8B4513', '#CD853F', '#D2691E', '#A0522D'],
};

const SKIN_TIPS = [
  '자외선 차단제는 흐린 날에도 꼭 발라주세요',
  '세안 후 3분 이내에 수분크림을 발라야 효과적이에요',
  '주 1회 각질 케어로 피부톤을 맑게 유지해요',
  '잠들기 전 수분팩으로 피부 장벽을 지켜주세요',
  '비타민 C는 아침 루틴에 추가하면 칙칙함을 줄여줘요',
  '미지근한 물로 세안해야 유수분 밸런스가 유지돼요',
  '베개 커버는 주 2회 세탁해 트러블을 예방해요',
];

const LOOK_TIPS = [
  '쿨톤이면 핑크 계열 블러셔가 더 자연스러워요 💕',
  '웨딩 D-30, 새 제품은 최소 2주 전에 테스트해보세요',
  '무쌍 눈엔 밝은 펄 섀도로 눈두덩에 포인트를 줘보세요',
  '하트형 얼굴엔 광대 아래 사선 블러셔가 잘 어울려요',
  '립은 D-day 2주 전부터 입술 각질 케어를 시작하세요',
  '파운데이션은 목선 경계가 안 생기는 톤으로 고르세요',
  '추구미를 정하면 메이크업이 훨씬 빠르고 통일감 있어요',
];

// ─────────────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  // MEVE — event source of truth: beautyProfileStore (reactive across screens)
  const eventType = useBeautyProfile((s) => s.eventType);
  const eventDate = useBeautyProfile((s) => s.eventDate);
  // MEVE-249 — global SKIN/LOOK mode determines which home variant to render.
  const mode = useMode();
  const { width } = useWindowDimensions();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [routine, setRoutine] = useState<Routine>({ am: false, pm: false });
  const [routineByDate, setRoutineByDate] = useState<Record<string, RoutineCheckin>>({});
  const [vibe, setVibe] = useState<string | null>(null);
  const [personalColor, setPersonalColor] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  // MEVE-253 — daily tip banner (top of home, mode-aware, date-cached)
  const [todayTip, setTodayTip] = useState<string | null>(null);

  // MEVE-253 — last-7-day scans for the new skin-record card (avg + bar chart)
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [recentScoreDiff, setRecentScoreDiff] = useState<number | null>(null);

  // MEVE-253 — routine steps loaded from `meve_routine` (single key, has am/pm)
  const [amRoutineSteps, setAmRoutineSteps] = useState<string[]>([]);
  const [pmRoutineSteps, setPmRoutineSteps] = useState<string[]>([]);

  // MEVE-202 — first-scan banner state
  const lastSkinScore = useBeautyProfile((s) => s.lastSkinScore);
  // MEVE-246 — extra subscriptions for the 4 new home cards
  const profilePersonalColor = useBeautyProfile((s) => s.personalColor);
  const profileSkinType = useBeautyProfile((s) => s.skinType);
  const profileVibe = useBeautyProfile((s) => s.vibe);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('meve_previous_scan_result').then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.overallScore === 'number') {
          setPrevScore(parsed.overallScore);
        }
      } catch {}
    });
  }, []);
  const [scanBannerDismissed, setScanBannerDismissed] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('meve_scan_banner_dismissed').then((v) => {
      if (v === 'true') setScanBannerDismissed(true);
    });
  }, []);
  const showFirstScanBanner = lastSkinScore == null && !scanBannerDismissed;
  const dismissScanBanner = async () => {
    setScanBannerDismissed(true);
    try {
      await AsyncStorage.setItem('meve_scan_banner_dismissed', 'true');
    } catch {}
  };

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // ── Initial data loads ──────────────────────────────────────────────────────
  useEffect(() => {
    loadProfile();
    loadScans();
    loadRoutine();
    loadLookPrefs();
    loadCalendarExpanded();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) fetchDisplayName(session.user.id);
      }
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch display name whenever the Home tab regains focus — so profile
  // edits propagate back without needing to re-login.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const daysInMonthForEffect = getDaysInMonth(calYear, calMonth);
  useEffect(() => {
    const dates: string[] = [];
    for (let d = 1; d <= daysInMonthForEffect; d++) {
      dates.push(
        `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      );
    }
    let cancelled = false;
    loadRoutineCheckinsForDates(dates).then((map) => {
      if (!cancelled) setRoutineByDate(map);
    });
    return () => {
      cancelled = true;
    };
  }, [calYear, calMonth, daysInMonthForEffect]);

  // MEVE-253 — load last-7-day skin scans for the new home record card
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data } = await supabase
          .from('skin_scans')
          .select('scan_result, created_at')
          .eq('user_id', user.id)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true })
          .limit(7);
        if (cancelled || !data || data.length === 0) return;
        const scans: ScanRecord[] = data.map((s: any) => ({
          date: s.created_at.slice(0, 10),
          score: s.scan_result?.overallScore ?? 0,
        }));
        setRecentScans(scans);
        const avg = Math.round(
          scans.reduce((sum, r) => sum + r.score, 0) / scans.length
        );
        setAvgScore(avg);
        setRecentScoreDiff(
          scans.length >= 2 ? scans[scans.length - 1].score - scans[0].score : null
        );
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // MEVE-253 — load saved routine (single AsyncStorage key with am/pm arrays)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('meve_routine');
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        const toLabels = (arr: any): string[] =>
          Array.isArray(arr)
            ? arr.map((s) =>
                typeof s === 'string'
                  ? s
                  : s?.product ?? s?.category ?? s?.step ?? ''
              ).filter(Boolean)
            : [];
        setAmRoutineSteps(toLabels(parsed?.am));
        setPmRoutineSteps(toLabels(parsed?.pm));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // MEVE-253 — load (or generate + cache) today's mode-specific tip.
  // Cache: AsyncStorage `meve_{mode}_tip_${YYYY-MM-DD}`. Falls back to the
  // static tip arrays when GPT is unavailable. Mirrors to Supabase daily_tips
  // so MeveScreen can render the channel history.
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

        // Pick a stable fallback so we always have something to show.
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
            }
          );
          if (res.ok) {
            const json = await res.json();
            const content: string = json.choices?.[0]?.message?.content ?? '';
            const parsed = JSON.parse(content);
            if (typeof parsed?.tip === 'string' && parsed.tip.trim()) {
              tip = parsed.tip.trim();
            }
          }
        } catch {
          // Keep the fallback tip.
        }

        if (cancelled) return;
        setTodayTip(tip);

        // Persist locally and mirror to Supabase (best-effort).
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
              { onConflict: 'user_id,mode,tip_date' }
            );
          }
        } catch {}
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, eventType]);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) fetchDisplayName(session.user.id);
  };

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

  const loadScans = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('skin_scans')
      .select('scan_result, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) return;

    const records: ScanRecord[] = data.map((r: any) => ({
      date: r.created_at.slice(0, 10),
      score: r.scan_result?.overallScore ?? 0,
    }));
    setScanRecords(records);
    setStreak(calculateStreak(data.map((r: any) => r.created_at)));
  };

  const loadRoutine = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const checkin = await loadRoutineCheckin(today);
    setRoutine(checkin);
  };

  const loadLookPrefs = async () => {
    try {
      const [[, v], [, pc]] = await AsyncStorage.multiGet([
        'meve_vibe',
        'meve_personal_color',
      ]);
      setVibe(v);
      setPersonalColor(pc);
    } catch {}
  };

  const loadCalendarExpanded = async () => {
    try {
      const val = await AsyncStorage.getItem(CALENDAR_EXPANDED_KEY);
      if (val === 'true') setCalendarExpanded(true);
    } catch {}
  };

  const toggleCalendar = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !calendarExpanded;
    setCalendarExpanded(next);
    try {
      await AsyncStorage.setItem(
        CALENDAR_EXPANDED_KEY,
        next ? 'true' : 'false'
      );
    } catch {}
  };

  const toggleRoutine = async (type: 'am' | 'pm') => {
    const next = { ...routine, [type]: !routine[type] };
    setRoutine(next);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await AsyncStorage.multiSet([
        [routineCheckinStorageKey(today), JSON.stringify(next)],
        ['meve_am_done', next.am ? '1' : '0'],
        ['meve_pm_done', next.pm ? '1' : '0'],
      ]);
      setRoutineByDate((prev) => ({ ...prev, [today]: next }));
    } catch {}
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const eventConfig = eventType ? EVENT_CONFIG[eventType as EventKey] : null;
  // MEVE-244 — event-specific theme + plan + tip from EVENT_CONFIG (eventConfig.ts)
  const eventTheme = getEventThemeConfig(eventType);

  // MEVE-246 — derived values for the 4 new home cards
  const scoreDiff =
    lastSkinScore != null && prevScore != null ? lastSkinScore - prevScore : null;
  const ddayLeft =
    eventDate != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(eventDate).getTime() - Date.now()) / 86_400_000
          )
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

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ddayCount = eventDate
    ? Math.ceil((new Date(eventDate).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000)
    : null;

  // Build scanMap for calendar: date string → score
  const scanMap: Record<string, number> = {};
  for (const r of scanRecords) {
    if (!(r.date in scanMap) || scanMap[r.date] < r.score) {
      scanMap[r.date] = r.score;
    }
  }

  // Calendar grid
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const todayStr = now.toISOString().slice(0, 10);
  const eventDateStr = eventDate ? eventDate.slice(0, 10) : null;

  const domToday = new Date().getDate();
  const tipIndex = domToday % 7;
  // MEVE-249 — tip aligns with the active mode instead of alternating by day.
  const tipLabel: 'SKIN' | 'LOOK' = mode === 'look' ? 'LOOK' : 'SKIN';
  const tipText = mode === 'look' ? LOOK_TIPS[tipIndex] : SKIN_TIPS[tipIndex];
  const latestScan = scanRecords[0] ?? null;
  const pcSwatches =
    personalColor && (personalColor as PersonalColor) in PERSONAL_COLOR_SWATCHES
      ? PERSONAL_COLOR_SWATCHES[personalColor as PersonalColor]
      : null;

  const goToFaceScanner = () => {
    navigation.navigate('FaceScanner');
  };

  const currentMonthPrefix = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const monthScanCount = scanRecords.filter((r) =>
    r.date.startsWith(currentMonthPrefix)
  ).length;

  // Selected day scan info
  const selectedDateStr = selectedDay
    ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedScore = selectedDateStr ? scanMap[selectedDateStr] : undefined;

  function scoreColor(score: number) {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    return '#F44336';
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Build 6-row grid cells
  const totalCells = 42;
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - firstDay - daysInMonth).fill(null),
  ];

  const cellSize = Math.floor((width - 40 - 32) / 7); // width - marginHorizontal*2 - padding*2

  // ── Render ──────────────────────────────────────────────────────────────────
  // MEVE-258 — flat plain background (no LinearGradient).
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F8" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── COMPACT HEADER ───────────────────────────────────────────── */}
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderMain}>
            <Image source={logo} style={styles.headerLogo} />
            <Text style={styles.compactSubtitle}>
              {getEventFocusMessage(eventType, ddayCount)}
            </Text>
            <Text style={styles.compactName}>
              {displayName ?? '회원'}님
            </Text>

            <View style={styles.ddayPillRow}>
              {eventConfig && ddayCount != null ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.ddayPillSet,
                      eventTheme && {
                        backgroundColor: eventTheme.theme.badgeBackground,
                      },
                    ]}
                    onPress={() => navigation.navigate('EventSetting')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.ddayPillTextSet,
                        eventTheme && { color: eventTheme.theme.badgeText },
                      ]}
                    >
                      {eventTheme
                        ? eventTheme.badgeText(ddayCount)
                        : `${eventConfig.emoji ?? '✨'} ${eventConfig.label}까지 D-${ddayCount}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EventSetting')}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.ddayChangeLink}>변경</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.ddayPillUnset}
                  onPress={() => navigation.navigate('EventSetting')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ddayPillTextUnset}>🌟 특별한 날 추가하기</Text>
                </TouchableOpacity>
              )}
            </View>
            {eventTheme && ddayCount != null && (
              <TouchableOpacity
                onPress={() => navigation.navigate('DdayPlan')}
                hitSlop={6}
                style={styles.planEntryRow}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.planEntryText,
                    { color: eventTheme.theme.primary },
                  ]}
                >
                  {eventTheme.label} 준비 플랜 보기 →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── MODE TOGGLE (MEVE-249) ──────────────────────────────────── */}
        <ModeToggle />

        {/* ── TODAY'S TIP (MEVE-253) — top-of-feed, mode-aware ────────── */}
        {todayTip && (
          <View
            style={[
              styles.tipBanner,
              mode === 'skin' ? styles.tipBannerSkin : styles.tipBannerLook,
            ]}
          >
            <Text style={styles.tipBannerLabel}>
              {mode === 'skin' ? '💙 오늘의 SKIN 팁' : '💕 오늘의 LOOK 팁'}
            </Text>
            <Text style={styles.tipBannerText}>{todayTip}</Text>
          </View>
        )}

        {/* ── FIRST SCAN BANNER (SKIN only) ───────────────────────────── */}
        {mode === 'skin' && showFirstScanBanner && (
          <View style={styles.firstScanBanner}>
            <TouchableOpacity
              onPress={dismissScanBanner}
              hitSlop={10}
              style={styles.firstScanCloseBtn}
            >
              <Ionicons name="close" size={16} color="#8A8A9A" />
            </TouchableOpacity>
            <Text style={styles.firstScanTitle}>
              ✨ AI 피부 스캔으로 내 피부를 분석해봐요
            </Text>
            <Text style={styles.firstScanSub}>
              {getEventContextText(
                '피부 분석을 시작해봐요',
                eventType,
                ddayCount
              )}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Scan')}
              activeOpacity={0.85}
              style={[styles.firstScanCtaShadow, styles.firstScanCta]}
            >
              <Text style={styles.firstScanCtaText}>지금 스캔하기 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SKIN RECORD (MEVE-253) — replaces the calendar ─────────── */}
        {mode === 'skin' && (
          <View style={styles.skinRecordCard}>
            <View style={styles.skinRecordHeader}>
              <Text style={styles.skinRecordTitle}>피부 기록 📓</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SkinJournal')}>
                <Text style={styles.skinRecordLink}>자세히 보기 →</Text>
              </TouchableOpacity>
            </View>
            {recentScans.length > 0 ? (
              <>
                <View style={styles.scoreRow}>
                  <View>
                    <Text style={styles.scoreLabel}>평균 스킨 스코어</Text>
                    <Text style={styles.scoreValue}>{avgScore}점</Text>
                  </View>
                  {recentScoreDiff !== null && recentScoreDiff !== 0 && (
                    <View style={styles.scoreDiffBadge}>
                      <Text
                        style={[
                          styles.scoreDiffText,
                          { color: recentScoreDiff >= 0 ? '#7CB798' : '#FF6B6B' },
                        ]}
                      >
                        {recentScoreDiff >= 0
                          ? `↑ +${recentScoreDiff}`
                          : `↓ ${recentScoreDiff}`}점
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.miniChart}>
                  {recentScans.map((scan, i) => {
                    const barHeight = Math.max(4, (scan.score / 100) * 48);
                    const isLast = i === recentScans.length - 1;
                    return (
                      <View key={`${scan.date}-${i}`} style={styles.barWrapper}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: barHeight,
                              backgroundColor: isLast ? '#5BA3D9' : '#C8DFF0',
                            },
                          ]}
                        />
                        <Text style={styles.barLabel}>
                          {new Date(scan.date).getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.noScanState}>
                <Text style={styles.noScanText}>아직 스캔 기록이 없어요</Text>
                <TouchableOpacity
                  style={styles.noScanCta}
                  onPress={() => navigation.navigate('FaceScanner')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.noScanCtaText}>첫 스캔하기 →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* MEVE-253 — DNA summary card removed from home (lives in 나 tab now). */}


        {/* ── SECTION 2: SKIN TODAY (SKIN mode only — full width) ───── */}
        {mode === 'skin' && (
        <>
        <Text style={styles.sectionTitle}>
          {getEventContextText('오늘의 체크인', eventType, ddayCount)}
        </Text>
        {/* MEVE-258 — plain white check-in card (no gradient, no glossy PNGs) */}
        <View style={styles.checkinCard}>
          <View style={styles.checkinCardHeader}>
            <Text style={styles.checkinCardMode}>💙 SKIN</Text>
            <Text style={styles.checkinCardSub}>오늘의 스킨케어</Text>
          </View>
          <View style={styles.ampmRow}>
            <TouchableOpacity
              style={[styles.ampmBtn, routine.am && styles.ampmBtnActive]}
              onPress={() => toggleRoutine('am')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.ampmBtnText,
                  routine.am && styles.ampmBtnTextActive,
                ]}
              >
                {routine.am ? '✓' : '○'} AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ampmBtn, routine.pm && styles.ampmBtnActive]}
              onPress={() => toggleRoutine('pm')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.ampmBtnText,
                  routine.pm && styles.ampmBtnTextActive,
                ]}
              >
                {routine.pm ? '✓' : '○'} PM
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={goToFaceScanner}
            activeOpacity={0.85}
          >
            <Text style={styles.scanBtnText}>📸 피부 스캔하기</Text>
          </TouchableOpacity>

          {/* MEVE-253 — routine steps preview (next slot's products) */}
          {(() => {
            const stepsToShow = routine.am ? pmRoutineSteps : amRoutineSteps;
            if (stepsToShow.length > 0) {
              const trimmed = stepsToShow.slice(0, 5);
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.routineStepsRow}
                >
                  {trimmed.map((step, i) => (
                    <View key={`${step}-${i}`} style={styles.routineStepWrapper}>
                      <View style={styles.routineStep}>
                        <Text style={styles.routineStepText}>{step}</Text>
                      </View>
                      {i < trimmed.length - 1 && (
                        <Text style={styles.routineStepArrow}>→</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              );
            }
            return (
              <TouchableOpacity
                style={styles.noRoutineCta}
                onPress={() => navigation.navigate('RoutineBuilder')}
                activeOpacity={0.75}
              >
                <Text style={styles.noRoutineCtaText}>
                  ✨ AI가 내 맞춤 루틴 만들어줘 →
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>

        {/* MEVE-250 — quick link to trouble check-in */}
        <TouchableOpacity
          style={styles.troubleLink}
          onPress={() => navigation.navigate('TroubleCheckin')}
          activeOpacity={0.75}
        >
          <Text style={styles.troubleLinkText}>⚠️ 피부 뒤집어졌어요 →</Text>
        </TouchableOpacity>

        {/* MEVE-253 — quick log row (3 entry points) */}
        <View style={styles.quickLogRow}>
          <TouchableOpacity
            style={styles.quickLogBtn}
            onPress={() => navigation.navigate('TroubleCheckin')}
            activeOpacity={0.85}
          >
            <Text style={styles.quickLogIcon}>⚠️</Text>
            <Text style={styles.quickLogLabel}>트러블 기록</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLogBtn}
            onPress={() => navigation.navigate('SkinJournal')}
            activeOpacity={0.85}
          >
            <Text style={styles.quickLogIcon}>📊</Text>
            <Text style={styles.quickLogLabel}>라이프스타일</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLogBtn}
            onPress={() =>
              navigation.navigate('ProductTracking', { mode: 'start' })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.quickLogIcon}>🧴</Text>
            <Text style={styles.quickLogLabel}>제품 추적</Text>
          </TouchableOpacity>
        </View>
        </>
        )}

        {/* ── LOOK MODE HOME (MEVE-249) ───────────────────────────────── */}
        {mode === 'look' && (
          <>
            <TouchableOpacity
              style={styles.lookHeroCard}
              onPress={() => navigation.navigate('TodaysLook')}
              activeOpacity={0.9}
            >
              <Text style={styles.lookHeroTitle}>오늘의 룩 💕</Text>
              <Text style={styles.lookHeroSub}>
                {eventType && ddayLeft != null
                  ? `${eventType} D-${ddayLeft}을 위한 룩`
                  : `${vibe ?? '글로우'} 추구미 룩`}
              </Text>
              <Text style={styles.lookHeroLink}>찾아보기 →</Text>
            </TouchableOpacity>

            {/* MEVE-257 — quick entry into makeup diagnosis */}
            <TouchableOpacity
              style={styles.makeupDiagnosisQuick}
              onPress={() => navigation.navigate('MakeupDiagnosis')}
              activeOpacity={0.85}
            >
              <Text style={styles.makeupDiagnosisQuickIcon}>🪞</Text>
              <Text style={styles.makeupDiagnosisQuickText}>
                오늘 화장 이상한 것 같아요
              </Text>
              <Text style={styles.makeupDiagnosisQuickArrow}>→</Text>
            </TouchableOpacity>

            {/* MEVE-257 — PC + 추구미 in a single mini row */}
            <View style={styles.lookMiniRow}>
              <TouchableOpacity
                style={styles.lookMiniRowCard}
                onPress={() => navigation.navigate('FaceAnalysis')}
                activeOpacity={0.85}
              >
                <Text style={styles.lookMiniRowLabel}>퍼스널컬러</Text>
                <Text style={styles.lookMiniRowValue}>
                  {profilePersonalColor ?? '분석 전'}
                </Text>
              </TouchableOpacity>
              <View style={styles.lookMiniRowDivider} />
              <TouchableOpacity
                style={styles.lookMiniRowCard}
                onPress={() => navigation.navigate('Look')}
                activeOpacity={0.85}
              >
                <Text style={styles.lookMiniRowLabel}>추구미</Text>
                <Text style={styles.lookMiniRowValue}>
                  {profileVibe ?? '미설정'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── MEVE-246 NEW CARD 2: D-day 플랜 현재 단계 ─────────────────── */}
        {eventTheme && currentPhase && (
          <TouchableOpacity
            style={styles.planPhaseCard}
            onPress={() => navigation.navigate('DdayPlan')}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.planPhaseAccent,
                { backgroundColor: eventTheme.theme.primary },
              ]}
            />
            <View style={styles.planPhaseContent}>
              <Text style={styles.planPhaseLabel}>
                {eventTheme.emoji} {eventTheme.label} 준비 플랜
              </Text>
              <Text style={styles.planPhaseTitle}>
                지금은 {currentPhase.title} 구간이에요
              </Text>
              {currentPhase.items[0] && (
                <Text style={styles.planPhaseItem} numberOfLines={1}>
                  • {currentPhase.items[0]}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.planPhaseArrow,
                { color: eventTheme.theme.primary },
              ]}
            >
              →
            </Text>
          </TouchableOpacity>
        )}

        {/* ── SECTION 3: RECENT ACTIVITY (SKIN only) ──────────────────── */}
        {mode === 'skin' && (
        <>
        <Text style={styles.sectionTitle}>최근 활동</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScrollContent}
        >
          {/* Card 1 — 최근 스캔 결과 */}
          <GlassCard
            style={styles.hCardLayout}
            contentStyle={styles.hCardContent}
            radius={18}
            padding={14}
            sheenColors={['rgba(168,213,232,0.30)', 'rgba(255,255,255,0.20)']}
          >
            <View style={styles.hCardHeader}>
              <BubbleIcon icon="camera" size={28} iconSize={14} colors={['#A8D5E8', '#5BA3D9']} />
              <Text style={styles.hCardTitle}>최근 스캔 결과</Text>
            </View>
            {latestScan ? (
              <>
                <Text style={[styles.hCardScore, styles.hCardScoreLatest]}>
                  {latestScan.score}점
                </Text>
                <Text style={styles.hCardSub}>{latestScan.date}</Text>
              </>
            ) : (
              <Text style={styles.hCardBody}>아직 스캔 기록이 없어요</Text>
            )}
            <TouchableOpacity onPress={goToFaceScanner}>
              <Text style={[styles.hCardCta, { color: '#5BA3D9' }]}>
                {latestScan ? '다시 스캔하기 →' : '스캔하러 가기 →'}
              </Text>
            </TouchableOpacity>
          </GlassCard>

          {/* MEVE-253 — Card 2 (오늘의 룩) moved into the LOOK-mode scroll. */}

          {/* Card 3 — 스킨 스코어 그래프 */}
          <GlassCard
            style={styles.hCardLayout}
            contentStyle={styles.hCardContent}
            radius={18}
            padding={14}
            sheenColors={['rgba(168,213,232,0.30)', 'rgba(255,255,255,0.20)']}
          >
            <View style={styles.hCardHeader}>
              <BubbleIcon icon="trending-up" size={28} iconSize={14} colors={['#A8D5E8', '#5BA3D9']} />
              <Text style={styles.hCardTitle}>스킨 스코어</Text>
            </View>
            {scanRecords.length > 0 ? (
              <View style={styles.miniBarRow}>
                {scanRecords.slice(0, 7).reverse().map((r, i) => (
                  <View
                    key={`${r.date}-${i}`}
                    style={[
                      styles.miniBar,
                      {
                        height: Math.max(6, (r.score / 100) * 48),
                        backgroundColor: scoreColor(r.score),
                      },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.hCardBody}>스캔을 시작하면 점수가 기록돼요</Text>
            )}
            <TouchableOpacity onPress={goToFaceScanner}>
              <Text style={[styles.hCardCta, { color: '#5BA3D9' }]}>자세히 보기 →</Text>
            </TouchableOpacity>
          </GlassCard>

          {/* MEVE-253 — Card 4 (퍼스널 컬러) moved into the LOOK-mode scroll. */}

          {/* Card 5 — Scan Streak */}
          <GlassCard
            style={styles.hCardLayout}
            contentStyle={styles.hCardContent}
            radius={18}
            padding={14}
            sheenColors={['rgba(255,215,168,0.30)', 'rgba(255,255,255,0.20)']}
          >
            <View style={styles.hCardHeader}>
              <BubbleIcon icon="flame" size={28} iconSize={14} colors={['#FFD7A8', '#FFB347']} />
              <Text style={styles.hCardTitle}>스캔 기록</Text>
            </View>
            <Text style={[styles.hCardScore, { color: '#B8860B' }]}>
              {streak}일
            </Text>
            <Text style={styles.hCardSub}>
              {streak > 0 ? '연속 스캔 중이에요' : '오늘부터 시작해요'}
            </Text>
            <TouchableOpacity onPress={goToFaceScanner}>
              <Text style={[styles.hCardCta, { color: '#B8860B' }]}>오늘 스캔하기 →</Text>
            </TouchableOpacity>
          </GlassCard>

          {/* MEVE-246 NEW CARD 3 — 피부 여정 미니 요약 */}
          {lastSkinScore != null && (
            <TouchableOpacity
              style={styles.activityCard}
              onPress={() => navigation.navigate('SkinJournal')}
              activeOpacity={0.85}
            >
              <Text style={styles.activityCardIcon}>📊</Text>
              <Text style={styles.activityCardTitle}>내 피부 여정</Text>
              <Text style={[styles.activityCardValue, { color: '#5BA3D9' }]}>
                {lastSkinScore}점
              </Text>
              {scoreDiff !== null && scoreDiff !== 0 && (
                <Text
                  style={[
                    styles.activityCardSub,
                    { color: scoreDiff > 0 ? '#7CB798' : '#FF6B6B' },
                  ]}
                >
                  {scoreDiff > 0 ? `+${scoreDiff}점 ↑` : `${scoreDiff}점 ↓`}
                </Text>
              )}
              <Text style={styles.activityCardLink}>기록 보기 →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        </>
        )}

        {/* ── LOOK MODE ACTIVITY SCROLL (MEVE-253) ─────────────────────── */}
        {mode === 'look' && (
          <>
            <Text style={styles.sectionTitle}>최근 활동</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScrollContent}
            >
              <GlassCard
                style={styles.hCardLayout}
                contentStyle={styles.hCardContent}
                radius={18}
                padding={14}
                sheenColors={['rgba(255,196,214,0.30)', 'rgba(255,255,255,0.20)']}
              >
                <View style={styles.hCardHeader}>
                  <BubbleIcon
                    icon="sparkles"
                    size={28}
                    iconSize={14}
                    colors={['#FFC4D6', '#FF6B9D']}
                  />
                  <Text style={styles.hCardTitle}>오늘의 룩</Text>
                </View>
                <Text style={styles.hCardBody}>
                  {vibe
                    ? `${vibe} 추구미에 맞는 룩을 찾아볼까요?`
                    : '추구미를 선택하면 오늘의 룩을 추천해드려요'}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('TodaysLook')}>
                  <Text style={[styles.hCardCta, { color: '#FF6B9D' }]}>
                    오늘의 룩 보기 →
                  </Text>
                </TouchableOpacity>
              </GlassCard>

              {/* MEVE-257 — PC card removed from LOOK activity scroll
                  (lives in the new mini row above). */}
            </ScrollView>
          </>
        )}

        {/* ── MEVE-246 NEW CARD 4: 시술 추천 진입점 ──────────────────── */}
        {eventType && (
          <TouchableOpacity
            style={styles.treatmentEntryCard}
            onPress={() =>
              navigation.navigate('TreatmentRecommend', { mode })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.treatmentEntryIcon}>👩‍⚕️</Text>
            <View style={styles.treatmentEntryContent}>
              <Text style={styles.treatmentEntryTitle}>
                {eventTheme?.label ?? eventType} D-day 시술 가이드
              </Text>
              <Text style={styles.treatmentEntrySub}>
                지금 받으면 좋은 시술을 알아봐요
              </Text>
            </View>
            <Text style={styles.treatmentEntryArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* MEVE-253 — bottom tip card removed (moved to top tipBanner). */}

        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PAGE_BG = '#F5F5F8';
const PINK = '#F2A7C3';

const styles = StyleSheet.create({
  // MEVE-258 — flat plain background, matches MyPage aesthetic
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1, backgroundColor: PAGE_BG },
  content: { paddingBottom: 20 },

  // Compact header
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
    gap: 10,
  },
  compactHeaderMain: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start'
  },
  headerLogo: {
    width: 170,
    height: 68,
    resizeMode: 'contain',
    alignSelf: 'flex-start',
    marginLeft: -40,
    marginBottom: -8,
  },
  compactSubtitle: {
    fontSize: 12,
    fontFamily: 'NanumSquareRoundL',
    color: '#8A8A9A',
  },
  compactName: {
    fontSize: 26,
    fontFamily: 'NanumSquareRoundB',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  ddayPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planEntryRow: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  planEntryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ddayPillSet: {
    backgroundColor: '#FFF0F5',
    borderColor: '#FFC4D6',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  ddayPillTextSet: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundB',
    color: '#FF6B9D',
  },
  ddayChangeLink: {
    fontSize: 11,
    fontFamily: 'NanumSquareRoundL',
    color: '#8A8A9A',
  },
  ddayPillUnset: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  ddayPillTextUnset: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundR',
    color: '#8A8A9A',
  },
  avatarBtn: {
    marginTop: 6,
  },

  // Section title
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'NanumSquareRoundB',
    color: '#1A1A2E',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  calendarCardLayout: {
    marginHorizontal: 20,
    marginBottom: 16,
  },

  // First-scan banner (MEVE-202)
  firstScanBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    paddingTop: 18,
    borderWidth: 1,
    borderColor: '#FFE0EC',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
    gap: 6,
  },
  firstScanCloseBtn: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  firstScanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  firstScanSub: {
    fontSize: 12,
    color: '#8A8A9A',
    lineHeight: 17,
    marginBottom: 10,
  },
  firstScanCtaShadow: {
    borderRadius: 50,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    alignSelf: 'flex-start',
  },
  firstScanCta: {
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#FF6B9D',
  },
  firstScanCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  calFoldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(184,216,240,0.2)',
  },
  calFoldTitle: {
    fontSize: 14,
    fontFamily: 'NanumSquareRoundB',
    color: '#2D2D2D',
  },
  calFoldPill: {
    marginLeft: 'auto',
    backgroundColor: '#FFC4D6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  calFoldPillText: {
    fontSize: 11,
    fontFamily: 'NanumSquareRoundB',
    color: '#C44777',
  },
  calContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  calMonthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calMonthText: {
    fontSize: 14,
    fontFamily: 'NanumSquareRoundB',
    color: '#2D2D2D',
  },
  calDayHeaders: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'NanumSquareRoundR',
    color: '#999',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    alignItems: 'center',
    paddingVertical: 3,
  },
  calDayCircle: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCircleToday: {
    backgroundColor: PINK,
  },
  calDayCircleSelected: {
    backgroundColor: '#FFE8F3',
  },
  calDayNum: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundR',
    color: '#2D2D2D',
  },
  calDdayBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },
  calDotEmpty: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
  calRoutineRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
    height: 5,
    alignItems: 'center',
  },
  calRoutineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calRoutineDotEmpty: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  calSelectedInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5EEF3',
  },
  calSelectedScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calSelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calSelectedText: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundR',
    color: '#666',
  },
  calSelectedEmpty: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundR',
    color: '#aaa',
    textAlign: 'center',
  },

  // Section 2 — SKIN + LOOK dual
  dualRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 18,
  },
  dualCardLayout: {
    flex: 1,
  },
  dualCardShadow: {
    borderRadius: 20,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  dualCardSurface: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
  },
  dualCardContent: {
    gap: 6,
  },
  dualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dualCardTitle: {
    fontSize: 14,
    fontFamily: 'NanumSquareRoundB',
    letterSpacing: 0.5,
  },
  cardTitleImage: {
    width: 140,
    height: 55,
    resizeMode: 'contain',
    marginBottom: -10,
    marginLeft: -27,
    marginTop: -6,
  },
  dualCheckRow: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 32,
    alignItems: 'center',
  },
  dualCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dualCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#5BA3D9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dualCheckCircleDone: {
    backgroundColor: '#5BA3D9',
    borderColor: '#5BA3D9',
  },
  dualCheckLabel: {
    fontSize: 12,
    fontFamily: 'NanumSquareRoundB',
    color: '#1A1A2E',
  },
  dualBodyBox: {
    minHeight: 32,
    justifyContent: 'center',
  },
  lookVibeText: {
    fontSize: 12,
    fontFamily: 'NanumSquareRoundB',
    color: '#FF6B9D',
    lineHeight: 18,
  },
  imageButton: {
    width: '100%',
    alignItems: 'center',
    marginTop: -26,
    marginBottom: -28,
  },
  skinScanButtonImage: {
    width: '220%',
    height: 115,
  },
  lookFindButtonImage: {
    width: '200%',
    height: 110,
  },

  // Section 3 — horizontal activity scroll
  hScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 12,
  },
  hCardLayout: {
    width: 160,
    maxHeight: 170,
  },
  hCardContent: {
    gap: 6,
  },
  hCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hCardTitle: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundB',
    color: '#1A1A2E',
  },
  hCardBody: {
    fontSize: 12,
    fontFamily: 'NanumSquareRoundL',
    color: '#666',
    lineHeight: 17,
    minHeight: 34,
  },
  hCardScore: {
    fontSize: 22,
    fontFamily: 'NanumSquareRoundEB',
    color: '#2D2D2D',
    marginTop: 2,
  },
  hCardScoreLatest: {
    fontSize: 28,
    fontFamily: 'NanumSquareRoundB',
    color: '#5BA3D9',
  },
  hCardSub: {
    fontSize: 11,
    fontFamily: 'NanumSquareRoundL',
    color: '#999',
  },
  hCardCta: {
    fontSize: 12,
    fontFamily: 'NanumSquareRoundB',
    marginTop: 6,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 48,
    marginVertical: 4,
  },
  miniBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 6,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  swatchDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  // Section 5 — tip of the day
  tipCardLayout: {
    marginHorizontal: 20,
    marginTop: 18,
  },
  tipCardContent: {
    gap: 6,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipLabel: {
    fontSize: 12,
    fontFamily: 'NanumSquareRoundB',
    letterSpacing: 0.3,
  },
  tipBody: {
    fontSize: 13,
    fontFamily: 'NanumSquareRoundR',
    color: '#1A1A2E',
    lineHeight: 20,
  },

  // MEVE-246 — DNA summary card
  dnaSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#D0B0D8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  dnaSummaryLeft: { flex: 1 },
  dnaSummaryLabel: {
    fontSize: 11,
    color: '#8A8A9A',
    fontWeight: '500',
    marginBottom: 3,
  },
  dnaSummaryContent: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '600',
  },
  dnaSummaryScore: { alignItems: 'flex-end', marginLeft: 8 },
  dnaSummaryScoreNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5BA3D9',
  },
  dnaSummaryScoreDiff: {
    fontSize: 12,
    fontWeight: '600',
  },

  // MEVE-246 — D-day plan phase card
  planPhaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  planPhaseAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  planPhaseContent: {
    flex: 1,
    padding: 14,
  },
  planPhaseLabel: {
    fontSize: 11,
    color: '#8A8A9A',
    fontWeight: '500',
    marginBottom: 3,
  },
  planPhaseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 3,
  },
  planPhaseItem: {
    fontSize: 12,
    color: '#5A5A7A',
  },
  planPhaseArrow: {
    fontSize: 18,
    fontWeight: '700',
    paddingRight: 14,
  },

  // MEVE-246 — Activity card (피부 여정 mini)
  activityCard: {
    width: 160,
    maxHeight: 170,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
    gap: 2,
  },
  activityCardIcon: { fontSize: 24, marginBottom: 6 },
  activityCardTitle: {
    fontSize: 11,
    color: '#8A8A9A',
    marginBottom: 4,
  },
  activityCardValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  activityCardSub: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityCardLink: {
    fontSize: 11,
    color: '#5BA3D9',
    fontWeight: '500',
  },

  // MEVE-246 — Treatment entry card
  treatmentEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFC4D6',
  },
  treatmentEntryIcon: { fontSize: 28, marginRight: 12 },
  treatmentEntryContent: { flex: 1 },
  treatmentEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  treatmentEntrySub: {
    fontSize: 12,
    color: '#8A8A9A',
  },
  treatmentEntryArrow: {
    fontSize: 18,
    color: '#FF6B9D',
    fontWeight: '700',
  },

  // MEVE-249 — LOOK mode home cards
  lookHeroCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 20,
    backgroundColor: '#FFF0F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFC4D6',
    gap: 4,
  },
  lookHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  lookHeroSub: {
    fontSize: 13,
    color: '#5A5A7A',
    marginTop: 2,
  },
  lookHeroLink: {
    fontSize: 13,
    color: '#FF6B9D',
    fontWeight: '700',
    marginTop: 8,
  },
  lookMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#D0B0D8',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  lookMiniLabel: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '500',
  },
  lookMiniValue: {
    fontSize: 14,
    color: '#FF6B9D',
    fontWeight: '700',
  },

  // MEVE-257 — combined PC + 추구미 mini row
  lookMiniRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  lookMiniRowCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  lookMiniRowDivider: {
    width: 1,
    backgroundColor: '#F0F0F5',
    marginVertical: 10,
  },
  lookMiniRowLabel: {
    fontSize: 11,
    color: '#8A8A9A',
    fontWeight: '500',
    marginBottom: 4,
  },
  lookMiniRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF6B9D',
  },

  // MEVE-257 — makeup diagnosis quick CTA on the LOOK home
  makeupDiagnosisQuick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF0F5',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD0E0',
  },
  makeupDiagnosisQuickIcon: { fontSize: 20 },
  makeupDiagnosisQuickText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  makeupDiagnosisQuickArrow: { fontSize: 16, color: '#FF6B9D' },

  // MEVE-250 — trouble check-in quick link
  troubleLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  troubleLinkText: {
    fontSize: 13,
    color: '#FF8C69',
    fontWeight: '600',
  },

  // MEVE-258 — plain check-in card (replaces glossy SKIN/LOOK dual gradient)
  checkinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  checkinCardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  checkinCardMode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5BA3D9',
    letterSpacing: 0.4,
  },
  checkinCardSub: { fontSize: 12, color: '#8A8A9A' },
  ampmRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  ampmBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  ampmBtnActive: { borderColor: '#5BA3D9', backgroundColor: '#E8F4FD' },
  ampmBtnText: { fontSize: 14, color: '#8A8A9A', fontWeight: '600' },
  ampmBtnTextActive: { color: '#1A1A2E', fontWeight: '700' },
  scanBtn: {
    backgroundColor: '#5BA3D9',
    borderRadius: 50,
    padding: 14,
    alignItems: 'center',
  },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // MEVE-253 — top-of-feed tip banner
  tipBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
  },
  tipBannerSkin: { backgroundColor: '#E8F4FD' },
  tipBannerLook: { backgroundColor: '#FFF0F5' },
  tipBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A9A',
    marginBottom: 6,
  },
  tipBannerText: { fontSize: 14, color: '#1A1A2E', lineHeight: 22 },

  // MEVE-253 — skin record card (replaces calendar)
  skinRecordCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  skinRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  skinRecordTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  skinRecordLink: { fontSize: 13, color: '#5BA3D9', fontWeight: '600' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreLabel: { fontSize: 12, color: '#8A8A9A', marginBottom: 4 },
  scoreValue: { fontSize: 28, fontWeight: '800', color: '#5BA3D9' },
  scoreDiffBadge: {
    backgroundColor: '#F5F5FA',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreDiffText: { fontSize: 14, fontWeight: '700' },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 56,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, color: '#8A8A9A' },
  noScanState: { alignItems: 'center', paddingVertical: 16 },
  noScanText: { fontSize: 14, color: '#8A8A9A', marginBottom: 10 },
  noScanCta: {
    backgroundColor: '#5BA3D9',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  noScanCtaText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },

  // MEVE-253 — routine step preview row
  routineStepsRow: { marginTop: 12 },
  routineStepWrapper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routineStep: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E0E8F0',
  },
  routineStepText: { fontSize: 11, color: '#5A5A7A', fontWeight: '500' },
  routineStepArrow: { fontSize: 10, color: '#C0C0CC' },
  noRoutineCta: { marginTop: 10 },
  noRoutineCtaText: { fontSize: 12, color: '#5BA3D9', fontWeight: '500' },

  // MEVE-253 — 3 quick log entry buttons
  quickLogRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  quickLogBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  quickLogIcon: { fontSize: 24, marginBottom: 6 },
  quickLogLabel: { fontSize: 11, color: '#5A5A7A', fontWeight: '600' },
});
