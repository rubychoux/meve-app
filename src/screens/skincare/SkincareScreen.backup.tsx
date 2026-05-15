import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const logo = require('../../../assets/images/meve-logo.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { MainStackParamList, MainTabParamList, ScanAnalysisResult } from '../../types';
import { loadRoutineCheckin, RoutineCheckin } from '../../utils/routineCheckin';
import { cleanJson } from '../../utils/openai';
import { useBeautyProfile } from '../../stores/beautyProfileStore';

// v3 — Skincare is now a BottomTab (composite type for pushing stack screens).
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Skincare'>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ─── Event config (inline) ───────────────────────────────────────────────────

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wedding: 'diamond-outline',
  date: 'heart-outline',
  graduation: 'school-outline',
  travel: 'airplane-outline',
};

const EVENT_INFO: Record<string, { label: string; gradient: [string, string]; tip: string }> = {
  wedding: { label: '웨딩', gradient: ['#F5E6E8', '#E8D5D8'], tip: '트러블 제로 + 순한 성분 중심으로 관리해요' },
  date: { label: '데이트', gradient: ['#FCE4EC', '#F8BBD9'], tip: '글로우 집중 + 모공 정돈 케어' },
  graduation: { label: '졸업', gradient: ['#E3F2FD', '#BBDEFB'], tip: '화사한 피부톤 + 미백 집중' },
  travel: { label: '여행', gradient: ['#E0F7FA', '#B2EBF2'], tip: '피부 장벽 강화 + 선케어 집중' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngredientRec {
  name: string;
  benefit: string;
  reason: string;
}
interface IngredientAvoid {
  name: string;
  reason: string;
}
interface IngredientResult {
  recommended: IngredientRec[];
  avoid: IngredientAvoid[];
  eventTip: string;
}

interface GeneratedRoutineStep {
  step: number;
  category: string;
  product: string;
  instruction: string;
  tip: string;
  oliveyoungQuery: string;
}

interface GeneratedRoutine {
  eventFocus: string;
  am: GeneratedRoutineStep[];
  pm: GeneratedRoutineStep[];
}

// ─────────────────────────────────────────────────────────────────────────────

export function SkincareScreen() {
  const navigation = useNavigation<Nav>();

  // MEVE — event source of truth: beautyProfileStore (reactive across screens)
  const eventType = useBeautyProfile((s) => s.eventType);
  const eventDate = useBeautyProfile((s) => s.eventDate);
  const [lastScan, setLastScan] = useState<ScanAnalysisResult | null>(null);
  const [scanLoaded, setScanLoaded] = useState(false);
  // MEVE-242 — for the journal entry card
  const lastSkinScore = useBeautyProfile((s) => s.lastSkinScore);
  const [previousSkinScore, setPreviousSkinScore] = useState<number | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('meve_previous_scan_result').then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.overallScore === 'number') {
          setPreviousSkinScore(parsed.overallScore);
        }
      } catch {}
    });
  }, []);
  const journalScoreDiff =
    lastSkinScore != null && previousSkinScore != null
      ? lastSkinScore - previousSkinScore
      : null;

  // Ingredient analysis
  const [ingredientResult, setIngredientResult] = useState<IngredientResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedExpanded, setRecommendedExpanded] = useState(false);
  const [avoidExpanded, setAvoidExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleRecommended = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRecommendedExpanded((prev) => !prev);
  };
  const toggleAvoid = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAvoidExpanded((prev) => !prev);
  };
  const toggleStep = (stepNum: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  // Routine (check-in + AI-generated routine)
  const [routineCheckin, setRoutineCheckin] = useState<RoutineCheckin>({ am: false, pm: false });
  const [routineTab, setRoutineTab] = useState<'am' | 'pm'>('am');
  const [generatedRoutine, setGeneratedRoutine] = useState<GeneratedRoutine | null>(null);
  const [generatingRoutine, setGeneratingRoutine] = useState(false);

  const daysLeft = eventDate
    ? Math.ceil((new Date(eventDate).getTime() - Date.now()) / 86_400_000)
    : null;
  const eventInfo = eventType ? EVENT_INFO[eventType] : null;

  // ── Load data on mount ──────────────────────────────────────────────────────

  useEffect(() => {
    loadLastScan();
    loadCachedIngredients();
    loadRoutine();
    loadGeneratedRoutine();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRoutine();
      loadGeneratedRoutine();
    }, [])
  );

  const loadLastScan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('skin_scans')
        .select('scan_result, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastScan(data[0].scan_result as ScanAnalysisResult);
      }
    } finally {
      setScanLoaded(true);
    }
  };

  const loadCachedIngredients = async () => {
    try {
      const raw = await AsyncStorage.getItem('meve_ingredients');
      if (raw) setIngredientResult(JSON.parse(raw));
    } catch {}
  };

  const loadRoutine = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const checkin = await loadRoutineCheckin(today);
    setRoutineCheckin(checkin);
  };

  const loadGeneratedRoutine = async () => {
    try {
      const raw = await AsyncStorage.getItem('meve_routine');
      if (raw) setGeneratedRoutine(JSON.parse(raw));
      else setGeneratedRoutine(null);
    } catch {}
  };

  const generateRoutine = async () => {
    if (generatingRoutine) return;
    setGeneratingRoutine(true);
    try {
      const [
        [, scanRaw],
        [, storedEventType],
        [, ddayDate],
      ] = await AsyncStorage.multiGet([
        'meve_last_scan_result',
        'meve_event_type',
        'meve_event_date',
      ]);

      const scanResult = scanRaw ? JSON.parse(scanRaw) : null;
      const daysLeft = ddayDate
        ? Math.max(
            0,
            Math.ceil((new Date(ddayDate).getTime() - Date.now()) / 86_400_000)
          )
        : null;

      const prompt = `You are a Korean skincare expert. Create a personalized AM/PM skincare routine.

User profile:
- Skin type: ${scanResult?.skinType ?? '정보 없음'}
- Concerns: ${scanResult?.concerns?.join(', ') ?? '정보 없음'}
- Event: ${storedEventType ?? '없음'}
- Days until event: ${daysLeft ?? '미설정'}

Return ONLY valid JSON, no markdown:
{
  "eventFocus": "D-day 이벤트 기반 루틴 포커스 한 줄 (해요체)",
  "am": [
    {
      "step": 1,
      "category": "클렌징",
      "product": "약산성 폼클렌저",
      "instruction": "사용 방법 1-2줄 (해요체)",
      "tip": "팁 한 줄 (해요체)",
      "oliveyoungQuery": "올리브영 검색어"
    }
  ],
  "pm": [
    {
      "step": 1,
      "category": "더블클렌징",
      "product": "클렌징 오일",
      "instruction": "사용 방법 (해요체)",
      "tip": "팁 (해요체)",
      "oliveyoungQuery": "검색어"
    }
  ]
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? `OpenAI ${response.status}`);
      }
      const text = data.choices[0].message.content;
      const routine: GeneratedRoutine = JSON.parse(cleanJson(text));
      await AsyncStorage.setItem('meve_routine', JSON.stringify(routine));
      setGeneratedRoutine(routine);
    } catch (e: any) {
      Alert.alert('루틴 생성 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setGeneratingRoutine(false);
    }
  };

  const regenerateRoutine = async () => {
    try {
      await AsyncStorage.removeItem('meve_routine');
    } catch {}
    setGeneratedRoutine(null);
    generateRoutine();
  };

  // ── Ingredient analysis ─────────────────────────────────────────────────────

  const analyzeIngredients = async () => {
    if (!lastScan) {
      Alert.alert('피부 스캔 필요', '먼저 AI 피부 스캔을 해주세요');
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 800,
          messages: [
            {
              role: 'user',
              content: `You are a Korean skincare expert.
Skin analysis result: ${JSON.stringify(lastScan)}
Upcoming event: ${eventType ?? 'none'}, ${daysLeft ?? 'unknown'} days away.
Return ONLY valid JSON no markdown:
{
  "recommended": [{"name":"성분명","benefit":"효능","reason":"이유"}],
  "avoid": [{"name":"성분명","reason":"이유"}],
  "eventTip": "D-day 케어 팁 한 줄"
}
Max 4 recommended, 3 avoid. All text in Korean.`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'OpenAI 오류');
      const content = data.choices[0].message.content.trim();
      const jsonMatch = content.match(/[{[][\s\S]*[}\]]/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');
      const result: IngredientResult = JSON.parse(jsonMatch[0]);
      setIngredientResult(result);
      await AsyncStorage.setItem('meve_ingredients', JSON.stringify(result));
    } catch (e: any) {
      Alert.alert('분석 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.screenHeader}>
          <Image source={logo} style={styles.headerLogo} />
        </View>

        {/* ── 1. D-DAY BANNER ────────────────────────────────────────────── */}
        {eventInfo && daysLeft != null && (
          <LinearGradient
            colors={eventInfo.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ddayBanner}
          >
            <View style={styles.ddayRow}>
              <Ionicons
                name={EVENT_ICONS[eventType!] ?? 'calendar-outline'}
                size={22}
                color={Colors.textPrimary}
              />
              <Text style={styles.ddayTitle}>
                {eventInfo.label}까지 {daysLeft}일
              </Text>
            </View>
            <Text style={styles.ddayTip}>{eventInfo.tip}</Text>
          </LinearGradient>
        )}

        {/* ── 2. AI 피부 스캔 ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.scanCard}
          onPress={() => navigation.navigate('FaceScanner')}
          activeOpacity={0.85}
        >
          <Ionicons name="scan-outline" size={28} color="#fff" />
          <View style={styles.scanCardText}>
            <Text style={styles.scanCardTitle}>AI 피부 스캔</Text>
            <Text style={styles.scanCardDesc}>AI가 피부 상태를 분석해드려요</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* ── 2-0. 내 피부 여정 (MEVE-242) ────────────────────────────────── */}
        <TouchableOpacity
          style={styles.journalEntryCard}
          onPress={() => navigation.navigate('SkinJournal')}
          activeOpacity={0.85}
        >
          <View style={styles.journalEntryLeft}>
            <Text style={styles.journalEntryTitle}>내 피부 여정 📊</Text>
            <Text style={styles.journalEntrySub}>
              스코어 변화 · 시술 기록 · 제품 기록
            </Text>
          </View>

          {lastSkinScore != null && (
            <View style={styles.journalScoreBadge}>
              <Text style={styles.journalScoreText}>{lastSkinScore}점</Text>
              {journalScoreDiff !== null && journalScoreDiff !== 0 && (
                <Text
                  style={[
                    styles.journalScoreDiff,
                    {
                      color: journalScoreDiff > 0 ? '#7CB798' : '#FF6B6B',
                    },
                  ]}
                >
                  {journalScoreDiff > 0 ? '+' : ''}
                  {journalScoreDiff}
                </Text>
              )}
            </View>
          )}

          <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
        </TouchableOpacity>

        {/* ── 2-1. 내 피부 케어 플랜 ──────────────────────────────────────── */}
        <View style={styles.carePlanCard}>
          <Text style={styles.carePlanTitle}>내 피부 케어 플랜 ✨</Text>
          {eventType && daysLeft != null && (
            <Text style={styles.carePlanSubtitle}>
              {EVENT_INFO[eventType]?.label ?? eventType} D-{daysLeft} 기준으로 정리했어요
            </Text>
          )}

          <View style={styles.carePlanRow}>
            <TouchableOpacity
              style={styles.carePlanItem}
              onPress={() => navigation.navigate('RoutineCoachChat')}
              activeOpacity={0.85}
            >
              <Text style={styles.carePlanItemIcon}>🏠</Text>
              <Text style={styles.carePlanItemLabel}>홈케어</Text>
              <Text style={styles.carePlanItemSub}>루틴 보기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.carePlanItem, styles.carePlanItemHighlight]}
              onPress={() => navigation.navigate('TreatmentRecommend', { mode: 'skin' })}
              activeOpacity={0.85}
            >
              <Text style={styles.carePlanItemIcon}>👩‍⚕️</Text>
              <Text style={styles.carePlanItemLabel}>피부과</Text>
              <Text style={styles.carePlanItemSub}>시술 추천</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.carePlanItem}
              onPress={analyzeIngredients}
              activeOpacity={0.85}
            >
              <Text style={styles.carePlanItemIcon}>🧴</Text>
              <Text style={styles.carePlanItemLabel}>성분</Text>
              <Text style={styles.carePlanItemSub}>분석 보기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3. 성분 스캔하기 ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.ingredientScanCard}
          onPress={() => navigation.navigate('IngredientScanner')}
          activeOpacity={0.85}
        >
          <Ionicons name="flask-outline" size={24} color={Colors.accent} />
          <View style={styles.scanCardText}>
            <Text style={styles.ingredientScanTitle}>성분 스캔하기</Text>
            <Text style={styles.ingredientScanDesc}>제품 성분표를 스캔해요</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* ── 4. 맞춤 성분 분석 ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 피부 맞춤 성분</Text>
            <TouchableOpacity
              style={styles.analyzeBtn}
              onPress={analyzeIngredients}
              disabled={isAnalyzing}
              activeOpacity={0.8}
            >
              {isAnalyzing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.analyzeBtnText}>
                  {ingredientResult ? '다시 분석' : '분석하기'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {!scanLoaded ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : !lastScan && !ingredientResult ? (
            <View style={styles.emptyBox}>
              <Ionicons name="flask-outline" size={28} color={Colors.textDisabled} />
              <Text style={styles.emptyText}>
                AI 피부 스캔 후 맞춤 성분을 분석해드려요
              </Text>
            </View>
          ) : isAnalyzing ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.accent} size="large" />
              <Text style={styles.loadingText}>맞춤 성분 분석 중...</Text>
            </View>
          ) : ingredientResult ? (
            <>
              {/* 추천 성분 — collapsible */}
              <TouchableOpacity
                style={styles.ingredientFoldHeader}
                onPress={toggleRecommended}
                activeOpacity={0.8}
              >
                <Text style={styles.ingredientFoldTitle}>추천 성분</Text>
                <View style={styles.ingredientFoldPill}>
                  <Text style={styles.ingredientFoldPillText}>
                    {ingredientResult.recommended.length}개
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Ionicons
                  name="chevron-down-outline"
                  size={18}
                  color="#5BA3D9"
                  style={{
                    transform: [{ rotate: recommendedExpanded ? '180deg' : '0deg' }],
                  }}
                />
              </TouchableOpacity>
              {recommendedExpanded &&
                ingredientResult.recommended.map((item, i) => (
                  <View key={i} style={[styles.ingredientCard, styles.recommendedBorder]}>
                    <Text style={styles.ingredientName}>{item.name}</Text>
                    <Text style={styles.ingredientBenefit}>{item.benefit}</Text>
                    <Text style={styles.ingredientReason}>{item.reason}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(
                          `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(item.name)}`
                        )
                      }
                    >
                      <Text style={styles.oliveyoungLink}>올리브영에서 보기 →</Text>
                    </TouchableOpacity>
                  </View>
                ))}

              {/* 피해야 할 성분 — collapsible */}
              <TouchableOpacity
                style={[styles.ingredientFoldHeader, styles.ingredientFoldHeaderAvoid]}
                onPress={toggleAvoid}
                activeOpacity={0.8}
              >
                <Text style={[styles.ingredientFoldTitle, { color: '#FF6B6B' }]}>
                  피해야할 성분
                </Text>
                <View style={[styles.ingredientFoldPill, { backgroundColor: '#FF6B6B' }]}>
                  <Text style={styles.ingredientFoldPillText}>
                    {ingredientResult.avoid.length}개
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Ionicons
                  name="chevron-down-outline"
                  size={18}
                  color="#FF6B6B"
                  style={{
                    transform: [{ rotate: avoidExpanded ? '180deg' : '0deg' }],
                  }}
                />
              </TouchableOpacity>
              {avoidExpanded &&
                ingredientResult.avoid.map((item, i) => (
                  <View key={i} style={[styles.ingredientCard, styles.avoidBorder]}>
                    <Text style={styles.ingredientName}>{item.name}</Text>
                    <Text style={styles.ingredientReason}>{item.reason}</Text>
                  </View>
                ))}

              {/* Event tip */}
              {ingredientResult.eventTip && (
                <View style={styles.eventTipBox}>
                  <Ionicons name="sparkles-outline" size={14} color={Colors.accent} />
                  <Text style={styles.eventTipText}>{ingredientResult.eventTip}</Text>
                </View>
              )}
            </>
          ) : null}
        </View>

        {/* ── 5. 내 루틴 ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.routineSectionHeader}>
            <Text style={styles.sectionTitle}>내 루틴</Text>
            <View style={{ flex: 1 }} />
            {generatedRoutine && !generatingRoutine && (
              <TouchableOpacity
                style={styles.regenBtn}
                onPress={regenerateRoutine}
                activeOpacity={0.75}
                hitSlop={6}
              >
                <Ionicons name="refresh" size={14} color="#8A8A9A" />
                <Text style={styles.regenBtnText}>새로고침</Text>
              </TouchableOpacity>
            )}
          </View>

          {generatedRoutine?.eventFocus && (
            <View style={styles.eventFocusCard}>
              <Text style={styles.eventFocusText}>
                💙 {generatedRoutine.eventFocus}
              </Text>
            </View>
          )}

          {!generatedRoutine && !generatingRoutine ? (
            <View style={styles.generatedEmpty}>
              <Text style={styles.generatedEmptyEmoji}>💙</Text>
              <Text style={styles.generatedEmptyText}>
                아직 루틴이 없어요.{'\n'}AI 루틴 코치에게 루틴을 만들어달라고 해봐요
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RoutineBuilder')}
                style={styles.generatedEmptyBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.generatedEmptyBtnText}>루틴 만들기</Text>
              </TouchableOpacity>
            </View>
          ) : generatingRoutine ? (
            <View style={styles.generatedEmpty}>
              <ActivityIndicator color="#5BA3D9" size="large" />
              <Text style={styles.generatedEmptyText}>
                맞춤 루틴을 만들고 있어요...
              </Text>
            </View>
          ) : generatedRoutine ? (
            <>
              <View style={styles.generatedToggle}>
                <TouchableOpacity
                  onPress={() => setRoutineTab('am')}
                  style={[
                    styles.generatedToggleBtn,
                    routineTab === 'am' && styles.generatedToggleBtnActive,
                  ]}
                >
                  <Ionicons
                    name="sunny-outline"
                    size={16}
                    color={routineTab === 'am' ? Colors.accent : '#999'}
                  />
                  <Text
                    style={[
                      styles.generatedToggleText,
                      { color: routineTab === 'am' ? Colors.accent : '#999' },
                    ]}
                  >
                    AM 루틴
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRoutineTab('pm')}
                  style={[
                    styles.generatedToggleBtn,
                    routineTab === 'pm' && styles.generatedToggleBtnActive,
                  ]}
                >
                  <Ionicons
                    name="moon-outline"
                    size={16}
                    color={routineTab === 'pm' ? '#A8D5E8' : '#999'}
                  />
                  <Text
                    style={[
                      styles.generatedToggleText,
                      { color: routineTab === 'pm' ? '#A8D5E8' : '#999' },
                    ]}
                  >
                    PM 루틴
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.routineStatus}>
                <Ionicons
                  name={routineCheckin[routineTab] ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={routineCheckin[routineTab] ? Colors.success : Colors.textDisabled}
                />
                <Text style={styles.routineStatusText}>
                  {routineCheckin[routineTab]
                    ? `오늘 ${routineTab.toUpperCase()} 홈에서 완료했어요`
                    : `홈에서 오늘 ${routineTab.toUpperCase()} 루틴을 체크해 주세요`}
                </Text>
              </View>

              <View style={styles.routineList}>
                {(routineTab === 'am' ? generatedRoutine.am : generatedRoutine.pm).map(
                  (step, idx, arr) => {
                    const isExpanded = expandedSteps.has(step.step);
                    return (
                      <View
                        key={`${routineTab}-${step.step}`}
                        style={[
                          styles.compactStep,
                          idx < arr.length - 1 && styles.compactStepDivider,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.compactStepRow}
                          onPress={() => toggleStep(step.step)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.compactStepNum}>
                            <Text style={styles.compactStepNumText}>{step.step}</Text>
                          </View>
                          <Text style={styles.compactStepCategory}>{step.category}</Text>
                          <Text
                            style={styles.compactStepProduct}
                            numberOfLines={1}
                          >
                            {step.product}
                          </Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              Linking.openURL(
                                `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(
                                  step.oliveyoungQuery || step.category
                                )}`
                              );
                            }}
                            hitSlop={6}
                          >
                            <Text style={styles.compactStepOlive}>올리브영 →</Text>
                          </TouchableOpacity>
                          <Ionicons
                            name="chevron-down-outline"
                            size={14}
                            color="#8A8A9A"
                            style={{
                              marginLeft: 4,
                              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                            }}
                          />
                        </TouchableOpacity>
                        {isExpanded && (
                          <View style={styles.compactStepDetail}>
                            <Text style={styles.compactStepInstruction}>
                              {step.instruction}
                            </Text>
                            {step.tip ? (
                              <Text style={styles.compactStepTip}>💡 {step.tip}</Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    );
                  }
                )}
              </View>
            </>
          ) : null}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* AI 코치 FAB */}
      <TouchableOpacity
        style={styles.coachFAB}
        onPress={() => navigation.navigate('RoutineCoachChat')}
        activeOpacity={0.85}
      >
        <Text style={styles.coachFABIcon}>💬</Text>
      </TouchableOpacity>
      <View style={styles.coachFABLabel} pointerEvents="none">
        <Text style={styles.coachFABLabelText}>AI 코치</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PAGE_BG = '#FDF6F9';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  content: { paddingBottom: 80, gap: 12 },

  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 0,
  },
  headerLogo: {
    width: 170,
    height: 68,
    resizeMode: 'contain',
    alignSelf: 'flex-start',
    marginLeft: -40,
    marginBottom: -8,
  },

  // D-day banner
  ddayBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  ddayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ddayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  ddayTip: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 30,
  },

  // AI scan card
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 18,
    gap: 14,
  },
  scanCardText: { flex: 1 },
  scanCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  scanCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  // Ingredient scan card
  ingredientScanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ingredientScanTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  ingredientScanDesc: { fontSize: 12, color: Colors.textSecondary },

  // Section
  section: {
    marginHorizontal: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  routineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  samplePill: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  samplePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  routineEventLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  routineScanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  routineScanBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  routineStepCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routineStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineStepNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
  routineStepBody: {
    flex: 1,
    gap: 4,
  },
  routineStepCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  routineStepDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  routineStepIngredient: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  analyzeBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  analyzeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Loading / empty
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Ingredient cards
  ingredientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recommendedBorder: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  avoidBorder: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  ingredientBenefit: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
  },
  ingredientReason: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  oliveyoungLink: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500',
    marginTop: 4,
  },

  // Event tip
  eventTipBox: {
    backgroundColor: '#FFF0F6',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  eventTipText: {
    fontSize: 13,
    color: Colors.accent,
    flex: 1,
    lineHeight: 19,
    fontWeight: '500',
  },

  // Routine
  routineToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  routineToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  routineToggleBtnActive: {
    backgroundColor: Colors.accent,
  },
  routineToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  routineToggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  routineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routineStatusText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  smallScanBtn: {
    marginTop: 4,
  },
  smallScanBtnText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Generated routine
  generatedToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0E6EC',
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  generatedToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'transparent',
  },
  generatedToggleBtnActive: {
    backgroundColor: '#fff',
  },
  generatedToggleText: {
    fontWeight: '600',
    fontSize: 12,
  },
  generatedStepCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generatedStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  generatedStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#2D3A6B',
  },
  generatedStepNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  generatedStepCategory: {
    fontWeight: '700',
    fontSize: 14,
    color: '#2D3A6B',
  },
  generatedStepProduct: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1A1A1F',
    flexShrink: 1,
  },
  generatedStepInstruction: {
    fontSize: 14,
    color: '#1A1A1F',
    lineHeight: 20,
    marginTop: 4,
  },
  generatedStepTip: {
    fontSize: 12,
    color: '#8A8A9A',
    fontStyle: 'italic',
    marginTop: 4,
  },
  eventFocusCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 16,
    padding: 12,
    marginBottom: 4,
  },
  eventFocusText: {
    fontSize: 13,
    color: '#1A1A1F',
    fontWeight: '500',
    lineHeight: 19,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  regenBtnText: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '600',
  },
  // Collapsible ingredient headers
  ingredientFoldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    gap: 8,
  },
  ingredientFoldHeaderAvoid: {
    backgroundColor: '#FFF0F5',
  },
  ingredientFoldTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3A6B',
  },
  ingredientFoldPill: {
    backgroundColor: '#2D3A6B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ingredientFoldPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Compact routine steps
  routineList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  compactStep: {
    backgroundColor: '#fff',
  },
  compactStepDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  compactStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    minHeight: 44,
  },
  compactStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2D3A6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStepNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  compactStepCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3A6B',
    marginRight: 6,
  },
  compactStepProduct: {
    fontSize: 13,
    color: '#1A1A1F',
    flex: 1,
  },
  compactStepOlive: {
    fontSize: 11,
    color: '#2D3A6B',
    fontWeight: '600',
  },
  compactStepDetail: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 4,
  },
  compactStepInstruction: {
    fontSize: 13,
    color: '#1A1A1F',
    lineHeight: 19,
  },
  compactStepTip: {
    fontSize: 12,
    color: '#8A8A9A',
    fontStyle: 'italic',
  },

  // AI coach FAB
  coachFAB: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2D3A6B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D3A6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  coachFABIcon: {
    fontSize: 24,
  },
  coachFABLabel: {
    position: 'absolute',
    bottom: 6,
    right: 20,
    width: 56,
    alignItems: 'center',
    zIndex: 998,
  },
  coachFABLabelText: {
    fontSize: 10,
    color: '#2D3A6B',
    fontWeight: '600',
  },
  generatedStepOliveLink: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 6,
  },
  generatedEmpty: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generatedEmptyEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  generatedEmptyText: {
    fontSize: 15,
    color: '#5C525B',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  generatedEmptyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  generatedEmptyBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  // 내 피부 케어 플랜 (MEVE-241)
  carePlanCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
  },
  carePlanTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 4,
  },
  carePlanSubtitle: {
    fontSize: 12,
    color: '#8A8A9A',
    marginBottom: 12,
  },
  carePlanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  carePlanItem: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  carePlanItemHighlight: {
    backgroundColor: '#FFF0F5',
    borderWidth: 1.5,
    borderColor: '#FFC4D6',
  },
  carePlanItemIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  carePlanItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1F',
  },
  carePlanItemSub: {
    fontSize: 10,
    color: '#8A8A9A',
    marginTop: 2,
  },
  newBadge: {
    backgroundColor: '#FF6B9D',
    borderRadius: 50,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },

  // 내 피부 여정 entry card (MEVE-242)
  journalEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#2D3A6B',
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
    gap: 10,
  },
  journalEntryLeft: { flex: 1 },
  journalEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 2,
  },
  journalEntrySub: {
    fontSize: 12,
    color: '#8A8A9A',
  },
  journalScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
  },
  journalScoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D3A6B',
  },
  journalScoreDiff: {
    fontSize: 11,
    fontWeight: '700',
  },
});
