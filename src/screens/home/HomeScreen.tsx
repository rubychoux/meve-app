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
import { LinearGradient } from 'expo-linear-gradient';
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
import { useAuthStore } from '../../store';
import { EVENT_CONFIG, EventKey } from '../../constants/events';

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
  const { eventType, eventDate, setEvent } = useAuthStore();
  const { width } = useWindowDimensions();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [routine, setRoutine] = useState<Routine>({ am: false, pm: false });
  const [routineByDate, setRoutineByDate] = useState<Record<string, RoutineCheckin>>({});
  const [vibe, setVibe] = useState<string | null>(null);
  const [personalColor, setPersonalColor] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

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
    loadEventFromStorage();
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

  const loadEventFromStorage = async () => {
    if (eventType) return;
    try {
      const [[, storedType], [, storedDate], [, storedDirections]] =
        await AsyncStorage.multiGet(['meve_event_type', 'meve_event_date', 'meve_care_direction']);
      if (storedType) {
        const directions = storedDirections ? JSON.parse(storedDirections) : [];
        setEvent(storedType, storedDate ?? '', directions);
      }
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
  const tipLabel = domToday % 2 === 0 ? 'SKIN' : 'LOOK';
  const tipText = domToday % 2 === 0 ? SKIN_TIPS[tipIndex] : LOOK_TIPS[tipIndex];
  const latestScan = scanRecords[0] ?? null;
  const pcSwatches =
    personalColor && (personalColor as PersonalColor) in PERSONAL_COLOR_SWATCHES
      ? PERSONAL_COLOR_SWATCHES[personalColor as PersonalColor]
      : null;

  const goToFaceScanner = () => {
    (navigation as any).navigate('Skin', { screen: 'FaceScanner' });
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
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient
        colors={['#FFF7FB', '#F8F2FF', '#F2F7FE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF7FB" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── COMPACT HEADER ───────────────────────────────────────────── */}
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderMain}>
            <Image source={logo} style={styles.headerLogo} />
            <Text style={styles.compactSubtitle}>오늘도 빛나는 하루예요 ✨</Text>
            <Text style={styles.compactName}>
              {displayName ?? '회원'}님
            </Text>

            <View style={styles.ddayPillRow}>
              {eventConfig && ddayCount != null ? (
                <>
                  <TouchableOpacity
                    style={styles.ddayPillSet}
                    onPress={() => navigation.navigate('EventFlow')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ddayPillTextSet}>
                      {eventType === 'wedding' ? '💍' :
                       eventType === 'date' ? '💕' :
                       eventType === 'graduation' ? '🎓' :
                       eventType === 'travel' ? '✈️' : '✨'}{' '}
                      {eventConfig.label}까지 D-{ddayCount}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EventFlow')}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.ddayChangeLink}>변경</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.ddayPillUnset}
                  onPress={() => navigation.navigate('EventFlow')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ddayPillTextUnset}>이벤트를 설정해요 →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.avatarBtn}>
            <BubbleIcon
              icon="person"
              size={44}
              iconSize={22}
              colors={MEVE_GRADIENT.colors}
            />
          </View>
        </View>

        {/* ── CALENDAR (collapsible) ──────────────────────────────────── */}
        <GlassCard style={styles.calendarCardLayout} radius={20} padding={0}>
          <TouchableOpacity
            style={styles.calFoldHeader}
            onPress={toggleCalendar}
            activeOpacity={0.8}
          >
            <Text style={styles.calFoldTitle}>피부 기록 🗓️</Text>
            <View style={styles.calFoldPill}>
              <Text style={styles.calFoldPillText}>이번 달 {monthScanCount}회 스캔</Text>
            </View>
            <Ionicons
              name={calendarExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={18}
              color="#999"
            />
          </TouchableOpacity>

          {calendarExpanded && (
          <View style={styles.calContent}>
          {/* Month nav */}
          <View style={styles.calMonthRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={18} color="#999" />
            </TouchableOpacity>
            <Text style={styles.calMonthText}>{calYear}년 {calMonth + 1}월</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.calDayHeaders}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <Text
                key={d}
                style={[
                  styles.calDayHeader,
                  i === 0 && { color: '#FF6B6B' },
                  i === 6 && { color: '#74B9FF' },
                ]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.calGrid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={[styles.calCell, { width: cellSize }]} />;
              }

              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = day === selectedDay;
              const isDday = dateStr === eventDateStr;
              const score = scanMap[dateStr];
              const colIdx = idx % 7;
              const dayRoutine = routineByDate[dateStr];

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.calCell, { width: cellSize }]}
                  onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.calDayCircle,
                    { width: cellSize - 4, height: cellSize - 4 },
                    isToday && styles.calDayCircleToday,
                    isSelected && !isToday && styles.calDayCircleSelected,
                  ]}>
                    <Text style={[
                      styles.calDayNum,
                      colIdx === 0 && { color: '#FF6B6B' },
                      colIdx === 6 && { color: '#74B9FF' },
                      isToday && { color: '#fff', fontFamily: 'NanumSquareRoundB' },
                      isSelected && !isToday && { color: '#F2A7C3', fontFamily: 'NanumSquareRoundB' },
                    ]}>
                      {day}
                    </Text>
                    {isDday && eventConfig && (
                      <View style={styles.calDdayBadge}>
                        <Ionicons
                          name={eventType === 'wedding' ? 'diamond' :
                                eventType === 'date' ? 'heart' :
                                eventType === 'graduation' ? 'school' : 'airplane'}
                          size={8}
                          color={eventConfig.accentColor}
                        />
                      </View>
                    )}
                  </View>
                  {score !== undefined ? (
                    <View style={[styles.calDot, { backgroundColor: scoreColor(score) }]} />
                  ) : (
                    <View style={styles.calDotEmpty} />
                  )}
                  <View style={styles.calRoutineRow}>
                    {dayRoutine?.am ? (
                      <View style={[styles.calRoutineDot, { backgroundColor: PINK }]} />
                    ) : (
                      <View style={styles.calRoutineDotEmpty} />
                    )}
                    {dayRoutine?.pm ? (
                      <View style={[styles.calRoutineDot, { backgroundColor: '#A8D5E8' }]} />
                    ) : (
                      <View style={styles.calRoutineDotEmpty} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day info */}
          {selectedDateStr && (
            <View style={styles.calSelectedInfo}>
              {selectedScore !== undefined ? (
                <View style={styles.calSelectedScore}>
                  <View style={[styles.calSelectedDot, { backgroundColor: scoreColor(selectedScore) }]} />
                  <Text style={styles.calSelectedText}>
                    {calMonth + 1}월 {selectedDay}일 피부 점수: <Text style={{ fontFamily: 'NanumSquareRoundB', color: '#2D2D2D' }}>{selectedScore}점</Text>
                  </Text>
                </View>
              ) : (
                <Text style={styles.calSelectedEmpty}>
                  {calMonth + 1}월 {selectedDay}일 — 스캔 기록이 없어요
                </Text>
              )}
            </View>
          )}
          </View>
          )}
        </GlassCard>

        {/* ── SECTION 2: SKIN + LOOK TODAY ────────────────────────────── */}
        <Text style={styles.sectionTitle}>오늘의 체크인</Text>
        <View style={styles.dualRow}>
          {/* SKIN */}
          <View style={[styles.dualCardLayout, styles.dualCardShadow]}>
            <LinearGradient
              colors={['#FBFCFF', '#F2F6FF', '#E5EDFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.dualCardSurface, { borderColor: '#EBF1FF' }]}
            >
              <Image
                source={require('../../../assets/images/skin-title.png')}
                style={styles.cardTitleImage}
                resizeMode="contain"
              />
              <View style={styles.dualCheckRow}>
                <TouchableOpacity
                  style={styles.dualCheckItem}
                  onPress={() => toggleRoutine('am')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dualCheckCircle, routine.am && styles.dualCheckCircleDone]}>
                    {routine.am && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={styles.dualCheckLabel}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dualCheckItem}
                  onPress={() => toggleRoutine('pm')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dualCheckCircle, routine.pm && styles.dualCheckCircleDone]}>
                    {routine.pm && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={styles.dualCheckLabel}>PM</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={goToFaceScanner}
                activeOpacity={0.85}
                style={styles.imageButton}
              >
                <Image
                  source={require('../../../assets/images/btn-skin-scan.png')}
                  style={styles.skinScanButtonImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* LOOK */}
          <View style={[styles.dualCardLayout, styles.dualCardShadow]}>
            <LinearGradient
              colors={['#FFFCFD', '#FFF4F9', '#FFE5F0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.dualCardSurface, { borderColor: '#FFEEF5' }]}
            >
              <Image
                source={require('../../../assets/images/look-title.png')}
                style={styles.cardTitleImage}
                resizeMode="contain"
              />
              <View style={styles.dualBodyBox}>
                <Text style={styles.lookVibeText} numberOfLines={2}>
                  {vibe ? `${vibe} 추구미` : '추구미를 선택해요'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Look')}
                activeOpacity={0.85}
                style={styles.imageButton}
              >
                <Image
                  source={require('../../../assets/images/btn-look-find.png')}
                  style={styles.lookFindButtonImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        {/* ── SECTION 3: RECENT ACTIVITY HORIZONTAL SCROLL ────────────── */}
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

          {/* Card 2 — 오늘의 룩 미리보기 */}
          <GlassCard
            style={styles.hCardLayout}
            contentStyle={styles.hCardContent}
            radius={18}
            padding={14}
            sheenColors={['rgba(255,196,214,0.30)', 'rgba(255,255,255,0.20)']}
          >
            <View style={styles.hCardHeader}>
              <BubbleIcon icon="sparkles" size={28} iconSize={14} colors={['#FFC4D6', '#FF6B9D']} />
              <Text style={styles.hCardTitle}>오늘의 룩</Text>
            </View>
            <Text style={styles.hCardBody}>
              {vibe
                ? `${vibe} 추구미에 맞는 룩을 찾아볼까요?`
                : '추구미를 선택하면 오늘의 룩을 추천해드려요'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Look')}>
              <Text style={[styles.hCardCta, { color: '#FF6B9D' }]}>LOOK에서 더 보기 →</Text>
            </TouchableOpacity>
          </GlassCard>

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

          {/* Card 4 — 퍼스널 컬러 */}
          <GlassCard
            style={styles.hCardLayout}
            contentStyle={styles.hCardContent}
            radius={18}
            padding={14}
            sheenColors={['rgba(255,196,214,0.30)', 'rgba(196,184,232,0.20)']}
          >
            <View style={styles.hCardHeader}>
              <BubbleIcon icon="color-filter" size={28} iconSize={14} colors={['#FFC4D6', '#C4B8E8']} />
              <Text style={styles.hCardTitle}>퍼스널 컬러</Text>
            </View>
            {personalColor ? (
              <>
                <Text style={styles.hCardScore}>{personalColor}</Text>
                {pcSwatches && (
                  <View style={styles.swatchRow}>
                    {pcSwatches.map((hex) => (
                      <View
                        key={hex}
                        style={[styles.swatchDot, { backgroundColor: hex }]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.hCardBody}>
                AI 얼굴 분석으로 퍼스널 컬러를 알아보세요
              </Text>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Look')}>
              <Text style={[styles.hCardCta, { color: '#FF6B9D' }]}>
                {personalColor ? '다시 분석하기 →' : '얼굴 분석하기 →'}
              </Text>
            </TouchableOpacity>
          </GlassCard>

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
        </ScrollView>

        {/* ── SECTION 5: 오늘의 팁 ───────────────────────────────────────── */}
        <GlassCard
          style={styles.tipCardLayout}
          contentStyle={styles.tipCardContent}
          radius={18}
          padding={14}
        >
          <View style={styles.tipHeader}>
            <BubbleIcon
              icon={tipLabel === 'SKIN' ? 'water' : 'flower'}
              size={28}
              iconSize={14}
              colors={
                tipLabel === 'SKIN'
                  ? ['#A8D5E8', '#5BA3D9']
                  : ['#FFC4D6', '#FF6B9D']
              }
            />
            <Text
              style={[
                styles.tipLabel,
                { color: tipLabel === 'SKIN' ? '#5BA3D9' : '#FF6B9D' },
              ]}
            >
              오늘의 {tipLabel} 팁
            </Text>
          </View>
          <Text style={styles.tipBody}>{tipText}</Text>
        </GlassCard>

        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PAGE_BG = 'transparent';
const PINK = '#F2A7C3';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF7FB' },
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
});
