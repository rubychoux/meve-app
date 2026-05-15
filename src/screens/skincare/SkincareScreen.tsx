/**
 * SkincareScreen — v3 SKIN tab full redesign.
 *
 * 백업:
 *   - SkincareScreen.backup.tsx          (1520-line original — routine + ingredient deep screen)
 *   - SkincareScreen.backup-menuhub.tsx  (v3 menu hub from ScanScreen split)
 *
 * 새 구조 (위→아래):
 *   1. TopBar (공통)
 *   2. 헤더 — Skin eyebrow + 스킨케어 + DNA/skin-type 한 줄
 *   3. 피부 프로필 카드 (GCS gradient + ShimmerSweep + 토글 펼침)
 *   4. 오늘의 루틴 (5 dots + GradientPill)
 *   5. 추천 성분 (pill chips)
 *   6. 피부 기록 (score + 7일 bar chart) + 3 sub-rows
 *   7. 케어 플랜 (D-day, AI 시술 추천)
 *   8. 루틴 관리 (내 루틴 / 다시 만들기)
 *   9. For you · 스킨케어 (카테고리 필터 + 2×2 제품 그리드)
 *
 * 보존된 navigate 경로:
 *   Skincare(self) / SkinJournal / TroubleCheckin / TroubleAnalysis /
 *   ProductTracking / DdayPlan / EventSetting / TreatmentRecommend / RoutineBuilder
 *
 * 제거됨: AI 피부 스캔 / 성분 스캔 / AI 피부 코치 (TopBar ✨ / Scan 탭으로 이동)
 */

import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList, MainTabParamList } from '../../types';
import { GradientPill, ShimmerSweep } from '../../components/signature';
import { TopBar } from '../../components/common/TopBar';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Skincare'>,
  NativeStackNavigationProp<MainStackParamList>
>;

interface ScanRecord {
  date: string;
  score: number;
}

// ─── Static content ───────────────────────────────────────────────────────────

const RECOMMENDED_INGREDIENTS = ['히알루론산', '세라마이드', '판테놀', '나이아신아마이드'];

const CATEGORIES = ['전체', '클렌징', '토너', '세럼', '크림', '선크림', '마스크'];

interface RecommendedProduct {
  brand: string;
  name: string;
  match: string;
  reason: string;
  price: string;
  swatch: readonly [string, string];
}
const RECOMMENDED_PRODUCTS: RecommendedProduct[] = [
  { brand: '라네즈',     name: '워터뱅크 크림',        match: '94%', reason: '건성·고보습', price: '₩38,000', swatch: ['#D4E4FF', '#C4D4F0'] as const },
  { brand: '이니스프리', name: '그린티 세럼',          match: '92%', reason: '수분·진정',   price: '₩28,000', swatch: ['#D8E8C5', '#C8D8B5'] as const },
  { brand: '코스알엑스', name: '스네일 에센스',        match: '91%', reason: '재생·보습',   price: '₩24,000', swatch: ['#F0E0CC', '#E0D0BC'] as const },
  { brand: '닥터지',     name: '레드 블레미쉬 클리어', match: '89%', reason: '진정·트러블', price: '₩22,000', swatch: ['#FFD4DC', '#EFC4D4'] as const },
];

// ─── Helper: gradient icon box (replaces emoji) ──────────────────────────────

interface IconBoxProps {
  gradient: readonly [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
}
const IconBox: React.FC<IconBoxProps> = ({ gradient, icon, size = 34 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size === 34 ? 10 : 12,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <Ionicons name={icon} size={size * 0.5} color="#FFFFFF" />
  </View>
);

// ─── Helper: MenuRow (icon + title + sub + chevron) ──────────────────────────

interface MenuRowProps {
  gradient: readonly [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  iconSize?: number;
}
const MenuRow: React.FC<MenuRowProps> = ({ gradient, icon, title, sub, onPress, iconSize = 34 }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.85}>
    <IconBox gradient={gradient} icon={icon} size={iconSize} />
    <View style={styles.menuRowText}>
      <Text style={styles.menuRowTitle}>{title}</Text>
      <Text style={styles.menuRowSub}>{sub}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export function SkincareScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();
  const { width } = useWindowDimensions();

  const [profileExpanded, setProfileExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);

  // Load last-7-day skin scans for the record card bar chart (preserved from
  // backup pattern).
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
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────
  const daysLeft = profile.eventDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : null;

  const skinScore = profile.lastSkinScore ?? recentScans[recentScans.length - 1]?.score ?? null;
  const scoreDiff =
    recentScans.length >= 2
      ? recentScans[recentScans.length - 1].score - recentScans[0].score
      : null;

  // ── Handlers (preserve original navigate paths) ─────────────────────────
  const goIngredients   = () => navigation.navigate('Skincare');
  const goJournal       = () => navigation.navigate('SkinJournal');
  const goTrouble       = () => navigation.navigate('TroubleCheckin');
  const goAnalysis      = () => navigation.navigate('TroubleAnalysis');
  const goProductTrack  = () => navigation.navigate('ProductTracking', { mode: 'history' });
  const goDday          = () =>
    profile.eventType
      ? navigation.navigate('DdayPlan')
      : navigation.navigate('EventSetting');
  const goTreatment     = () => navigation.navigate('TreatmentRecommend', { mode: 'skin' });
  const goRoutineManage = async () => {
    const existing = await AsyncStorage.getItem('meve_routine');
    if (existing) navigation.navigate('Skincare');
    else navigation.navigate('RoutineBuilder');
  };
  const goRoutineRebuild = () => navigation.navigate('RoutineBuilder');

  // Product grid sizing
  const productCardW = (width - 36 - 12) / 2; // 18px screen padding × 2 + 12 gap

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── 1. Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Skin</Text>
          <Text style={styles.title}>스킨케어</Text>
          <Text style={styles.subline}>
            {`Icy Glow · ${profile.skinType ?? '건성'} · 모공케어 맞춤`}
          </Text>
        </View>

        {/* ── 2. Profile card (toggle) ──────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <LinearGradient
              colors={['#D8E4F2', '#DCD4EC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ShimmerSweep duration={4500} widthRatio={0.3} />
            <View style={styles.profileTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileDnaCode}>GCS · YOUR DNA</Text>
                <Text style={styles.profileDnaName}>Icy Glow</Text>
                <Text style={styles.profileDnaKr}>아이시 글로우</Text>
              </View>
              <TouchableOpacity
                onPress={() => setProfileExpanded((v) => !v)}
                style={styles.profileToggle}
                hitSlop={8}
              >
                <Ionicons
                  name={profileExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#2D3A6B"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.profileTagsDivider} />
            <Text style={styles.profileTags}>
              {`${profile.skinType ?? '건성'} · ${profile.skinConcerns?.[0] ?? '모공'} · 건조 · 글로우`}
            </Text>
          </View>

          {profileExpanded && (
            <View style={styles.profileExpanded}>
              <ProfileRow label="피부 타입"      value={profile.skinType ?? '미설정'} />
              <ProfileRow label="피부 고민"      value={profile.skinConcerns?.join(' · ') ?? '미설정'} />
              <ProfileRow label="베이스"         value={profile.skinTone ?? '미설정'} />
              <ProfileRow label="퍼스널 컬러"    value={profile.personalColor ?? '미설정'} />
              <ProfileRow label="케어 우선순위"  value={'수분 · 진정'} />
              <TouchableOpacity onPress={goJournal} style={styles.profileFullLink} hitSlop={6}>
                <Text style={styles.profileFullLinkText}>See full profile →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 3. Today's routine ────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>Today's routine</Text>
            <Text style={styles.cardMeta}>5단계</Text>
          </View>
          <View style={styles.routineDotsRow}>
            <View style={styles.routineDotsLeft}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.routineDot,
                    i < 3 && styles.routineDotDone,
                    i === 3 && styles.routineDotNext,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.routineProgress}>AM 3/5</Text>
          </View>
          <View style={{ marginTop: 12 }}>
            <GradientPill
              label="4단계 시작"
              onPress={goRoutineManage}
              size="md"
              fullWidth
            />
          </View>
        </View>

        {/* ── 4. Recommended ingredients ────────────────────────────── */}
        <TouchableOpacity
          onPress={goIngredients}
          activeOpacity={0.9}
          style={[styles.card, { paddingVertical: 12, paddingHorizontal: 12 }]}
        >
          <Text style={styles.cardEyebrowCompact}>Ingredients · 추천 성분</Text>
          <View style={styles.ingredientChips}>
            {RECOMMENDED_INGREDIENTS.map((ing) => (
              <View key={ing} style={styles.chip}>
                <Text style={styles.chipText}>{ing}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* ── 5. Skin record ────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>Skin record</Text>
            <TouchableOpacity onPress={goJournal} hitSlop={6}>
              <Text style={styles.cardLink}>자세히 보기 →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreBig}>{skinScore != null ? skinScore : '—'}</Text>
            {scoreDiff != null && scoreDiff !== 0 && (
              <View
                style={[
                  styles.scoreDiff,
                  {
                    backgroundColor:
                      scoreDiff > 0 ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scoreDiffText,
                    { color: scoreDiff > 0 ? '#388E3C' : '#C62828' },
                  ]}
                >
                  {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.barChart}>
            {Array.from({ length: 7 }, (_, i) => {
              const scan = recentScans[i];
              const score = scan?.score ?? 0;
              const isLast = i === recentScans.length - 1 && score > 0;
              return (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (score / 100) * 40),
                      backgroundColor: isLast
                        ? '#2D3A6B'
                        : 'rgba(45,58,107,0.12)',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Sub-rows: 트러블 / 원인 분석 / 제품 반응 ─────────────────── */}
        <View style={styles.subRowsGroup}>
          <MenuRow
            gradient={['#FFD4DC', '#EFC4D4']}
            icon="alert-circle-outline"
            title="트러블 기록"
            sub="피부 뒤집어졌을 때 원인 찾기"
            onPress={goTrouble}
          />
          <MenuRow
            gradient={['#E4D4FF', '#D4C4F0']}
            icon="pulse-outline"
            title="AI 원인 분석"
            sub="최근 7일 데이터 기반"
            onPress={goAnalysis}
          />
          <MenuRow
            gradient={['#D4E4FF', '#C4D4F0']}
            icon="flask-outline"
            title="제품 반응 기록"
            sub="추적 중인 제품 확인"
            onPress={goProductTrack}
          />
        </View>

        {/* ── 6. Care plan ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>케어 플랜</Text>
        <View style={styles.subRowsGroup}>
          <MenuRow
            gradient={['#FFD4DC', '#E4D4FF']}
            icon="calendar-outline"
            title="D-day 케어 플랜"
            sub={
              profile.eventType && daysLeft != null
                ? `${profile.eventType} D-${daysLeft} 단계별 가이드`
                : '특별한 날을 설정하면 맞춤 플랜이 생겨요'
            }
            onPress={goDday}
            iconSize={40}
          />
          <MenuRow
            gradient={['#DCD4EC', '#C5CCE0']}
            icon="medkit-outline"
            title="AI 시술 추천"
            sub="얼굴형·퍼스널컬러 기반"
            onPress={goTreatment}
            iconSize={40}
          />
        </View>

        {/* ── 7. Routine management ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>루틴 관리</Text>
        <View style={styles.subRowsGroup}>
          <MenuRow
            gradient={['#D8E4F2', '#DCD4EC']}
            icon="list-outline"
            title="내 루틴 관리"
            sub="AM/PM 루틴 보기·수정·생성"
            onPress={goRoutineManage}
          />
          <MenuRow
            gradient={['#E4D4FF', '#D4E4FF']}
            icon="refresh-outline"
            title="루틴 다시 만들기"
            sub="AI가 새 루틴을 추천"
            onPress={goRoutineRebuild}
          />
        </View>

        {/* ── 8. For you · 스킨케어 (shop) ──────────────────────────── */}
        <View style={styles.forYouHeader}>
          <Text style={styles.forYouTitle}>For you · 스킨케어</Text>
          <TouchableOpacity hitSlop={6}>
            <Text style={styles.cardLink}>all →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.productGrid}>
          {RECOMMENDED_PRODUCTS.map((p) => (
            <View
              key={p.name}
              style={[styles.productCard, { width: productCardW }]}
            >
              <LinearGradient
                colors={p.swatch}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.productImage}
              />
              <Text style={styles.productBrand} numberOfLines={1}>{p.brand}</Text>
              <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
              <View style={styles.productBottomRow}>
                <Text style={styles.productMatch}>{p.match}</Text>
                <Text style={styles.productPrice}>{p.price}</Text>
              </View>
              <Text style={styles.productReason} numberOfLines={1}>{p.reason}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-component: profile expanded row ─────────────────────────────────────

const ProfileRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.profileRow}>
    <Text style={styles.profileRowLabel}>{label}</Text>
    <Text style={styles.profileRowValue}>{value}</Text>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FBF5F6',
  },

  // Section 1: Header
  header: {
    paddingHorizontal: 18,
    marginTop: 4,
  },
  eyebrow: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(45,58,107,0.7)',
  },
  title: {
    fontFamily: 'Pretendard-Thin',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: '#1A1A1F',
    fontWeight: '200',
    marginTop: 2,
  },
  subline: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
    marginTop: 4,
  },

  // Section 2: Profile card
  profileCard: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    overflow: 'hidden',
  },
  profileTop: {
    padding: 14,
    paddingHorizontal: 16,
    position: 'relative',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profileDnaCode: {
    fontFamily: 'Menlo',
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 3,
    color: 'rgba(45,58,107,0.6)',
  },
  profileDnaName: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: '#2D3A6B',
    fontWeight: '300',
    marginTop: 4,
  },
  profileDnaKr: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.5,
    color: 'rgba(45,58,107,0.7)',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  profileToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTagsDivider: {
    height: 0.5,
    backgroundColor: 'rgba(45,58,107,0.15)',
    marginTop: 12,
    marginBottom: 8,
  },
  profileTags: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(45,58,107,0.7)',
  },
  profileExpanded: {
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileRowLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: '#8E8E93',
  },
  profileRowValue: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#1A1A1F',
    fontWeight: '500',
  },
  profileFullLink: {
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  profileFullLinkText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    color: '#2D3A6B',
  },

  // Generic card
  card: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardEyebrow: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
    color: '#2D3A6B',
  },
  cardEyebrowCompact: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 14,
    color: '#2D3A6B',
    marginBottom: 8,
  },
  cardMeta: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 8,
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  cardLink: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: '#8E8E93',
  },

  // Section 3: Today's routine
  routineDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineDotsLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  routineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(45,58,107,0.15)',
  },
  routineDotDone: {
    backgroundColor: '#2D3A6B',
  },
  routineDotNext: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2D3A6B',
  },
  routineProgress: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    color: '#2D3A6B',
    fontWeight: '500',
  },

  // Section 4: Ingredient chips
  ingredientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: '#FBF5F6',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
  },
  chipText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: '#1A1A1F',
  },

  // Section 5: Skin record
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  scoreBig: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 34,
    lineHeight: 38,
    color: '#2D3A6B',
    fontWeight: '300',
  },
  scoreDiff: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  scoreDiffText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 2,
  },
  bar: {
    width: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },

  // Sub-row group container
  subRowsGroup: {
    paddingHorizontal: 18,
    marginTop: 12,
    gap: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    gap: 12,
  },
  menuRowText: {
    flex: 1,
    gap: 2,
  },
  menuRowTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    lineHeight: 16,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  menuRowSub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
  },

  // Section titles between groups
  sectionTitle: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
    color: '#2D3A6B',
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 4,
  },

  // Section 8: For you · 스킨케어
  forYouHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 10,
  },
  forYouTitle: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 18,
    color: '#2D3A6B',
  },
  categoryRow: {
    paddingHorizontal: 18,
    gap: 6,
    paddingBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
  },
  categoryChipActive: {
    backgroundColor: '#2D3A6B',
    borderColor: '#2D3A6B',
  },
  categoryChipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 12,
    marginTop: 10,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    overflow: 'hidden',
    paddingBottom: 10,
  },
  productImage: {
    width: '100%',
    height: 90,
  },
  productBrand: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 8,
    lineHeight: 11,
    color: '#8E8E93',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  productName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: '#1A1A1F',
    fontWeight: '600',
    paddingHorizontal: 10,
    marginTop: 2,
  },
  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 4,
  },
  productMatch: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 10,
    lineHeight: 12,
    color: '#2D3A6B',
  },
  productPrice: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 10,
    lineHeight: 12,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  productReason: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 8,
    lineHeight: 11,
    color: '#8E8E93',
    paddingHorizontal: 10,
    marginTop: 2,
  },
});
