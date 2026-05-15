/**
 * LookScreen — v3 LOOK tab full redesign.
 *
 * 백업:
 *   - LookScreen.backup.tsx          (1261-line original)
 *   - LookScreen.backup-menuhub.tsx  (v3 menu hub from ScanScreen split)
 *
 * 새 구조 (위→아래):
 *   1. TopBar (공통)
 *   2. 헤더 — Look eyebrow + 메이크업 + face/PC/eye 한 줄
 *   3. 얼굴 프로필 카드 (Rose Plum 그라데이션 + ShimmerSweep + 토글)
 *   4. 너의 컬러 팔레트 (6 swatches)
 *   5. 추구미 무드보드 (3-cell grid)
 *   6. 오늘의 룩 (이미지 + 텍스트)
 *   7. 맞춤 메이크업 팁 (쉐딩/아이/립/눈썹 4 row)
 *   8. 스타일 플랜 (AI 시술 추천)
 *   9. For you · 메이크업 (필터 + 2×2 그리드)
 *
 * 보존된 navigate 경로:
 *   Look(self) / TodaysLook / TreatmentRecommend{mode:'look'} / MakeupDiagnosis
 *
 * 제거됨: 메이크업 진단 3 / 얼굴 분석 3 (Scan 탭) / 코치 banner (TopBar ✨)
 *
 * LOOK 톤: Rose Plum (#5C2C3F) — SKIN의 Mystic Navy와 대비
 */

import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList, MainTabParamList } from '../../types';
import { ShimmerSweep } from '../../components/signature';
import { TopBar } from '../../components/common/TopBar';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Look'>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ─── Static content ───────────────────────────────────────────────────────────

interface Swatch {
  hex: string;
  name: string;
}
const PALETTE_SWATCHES: Swatch[] = [
  { hex: '#D4A0A8', name: 'Rose' },
  { hex: '#B8A8D0', name: 'Lavender' },
  { hex: '#A8C0D8', name: 'Sky' },
  { hex: '#E5B5C0', name: 'Pink' },
  { hex: '#9F7C8A', name: 'Mauve' },
  { hex: '#C8A0A5', name: 'MLBB' },
];

const CATEGORIES = ['전체', '베이스', '아이', '립', '치크', '브로우'];

interface Product {
  brand: string;
  name: string;
  match: string;
  reason: string;
  price: string;
  swatch: readonly [string, string];
}
const RECOMMENDED_PRODUCTS: Product[] = [
  { brand: '힌스',       name: '멜로우 글로우 베이스',    match: '94%', reason: '쿨톤·글로우, 아이시 타입 적합', price: '₩24,000', swatch: ['#FFE0D0', '#F5DCD0'] as const },
  { brand: '롬앤',       name: '베터댄 섀도우 라벤더',    match: '92%', reason: '쿨톤·아몬드눈, 겹쌍 맞춤',     price: '₩17,000', swatch: ['#E4D4FF', '#BFB2CC'] as const },
  { brand: '데이지크',   name: '립아이즈 로즈',           match: '91%', reason: '쿨톤·MLBB, 청순 무드',         price: '₩21,000', swatch: ['#FFD4DC', '#E2A8B5'] as const },
  { brand: '웨이크메이크', name: '소프트 블러링 치크',     match: '89%', reason: '쿨톤·소프트, 은은한 발색',     price: '₩15,000', swatch: ['#F0CFD8', '#D49098'] as const },
];

interface MakeupTip {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  gradient: readonly [string, string];
  title: string;
  sub: string;
}
const MAKEUP_TIPS: MakeupTip[] = [
  {
    icon: 'ellipse-outline',
    iconColor: '#5C2C3F',
    gradient: ['rgba(232,194,204,0.4)', 'rgba(207,181,194,0.3)'] as const,
    title: '쉐딩',
    sub: '타원형 맞춤 윤곽',
  },
  {
    icon: 'eye-outline',
    iconColor: '#2D3A6B',
    gradient: ['rgba(216,228,242,0.5)', 'rgba(220,212,236,0.4)'] as const,
    title: '아이 메이크업',
    sub: '아몬드눈 · 쿨톤 섀도우',
  },
  {
    icon: 'heart-outline',
    iconColor: '#993556',
    gradient: ['rgba(255,212,220,0.5)', 'rgba(228,194,204,0.4)'] as const,
    title: '립 컬러',
    sub: '로즈 · MLBB 추천',
  },
  {
    icon: 'remove-outline',
    iconColor: '#534AB7',
    gradient: ['rgba(220,212,236,0.5)', 'rgba(197,204,224,0.4)'] as const,
    title: '눈썹',
    sub: '아치 · 중간굵기',
  },
];

interface ProfileRowSpec {
  key: keyof BeautyDisplayFields;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  gradient: readonly [string, string];
}
type BeautyDisplayFields = {
  faceShape: string;
  eyeType: string;
  noseType: string;
  lipType: string;
  browType: string;
};

const PROFILE_ROW_SPECS: ProfileRowSpec[] = [
  {
    key: 'faceShape',
    label: '얼굴형',
    icon: 'ellipse-outline',
    iconColor: '#5C2C3F',
    gradient: ['rgba(232,194,204,0.5)', 'rgba(207,181,194,0.4)'] as const,
  },
  {
    key: 'eyeType',
    label: '눈',
    icon: 'eye-outline',
    iconColor: '#2D3A6B',
    gradient: ['rgba(216,228,242,0.5)', 'rgba(220,212,236,0.4)'] as const,
  },
  {
    key: 'noseType',
    label: '코',
    icon: 'triangle-outline',
    iconColor: '#534AB7',
    gradient: ['rgba(228,212,255,0.5)', 'rgba(212,228,255,0.4)'] as const,
  },
  {
    key: 'lipType',
    label: '입술',
    icon: 'heart-outline',
    iconColor: '#993556',
    gradient: ['rgba(255,212,220,0.5)', 'rgba(228,194,204,0.4)'] as const,
  },
  {
    key: 'browType',
    label: '눈썹',
    icon: 'remove-outline',
    iconColor: '#534AB7',
    gradient: ['rgba(220,212,236,0.5)', 'rgba(197,204,224,0.4)'] as const,
  },
];

// ─── Helper: gradient icon box ───────────────────────────────────────────────

interface IconBoxProps {
  gradient: readonly [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  size?: number;
}
const IconBox: React.FC<IconBoxProps> = ({
  gradient,
  icon,
  iconColor = '#FFFFFF',
  size = 36,
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size >= 40 ? 12 : 10,
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
    <Ionicons name={icon} size={size * 0.5} color={iconColor} />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export function LookScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();
  const { width } = useWindowDimensions();

  const [profileExpanded, setProfileExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('전체');

  // ── Derived ─────────────────────────────────────────────────────────────
  const daysLeft = profile.eventDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : null;

  // Default fallbacks for display when profile values are missing.
  const faceShape = profile.faceShape ?? '타원형';
  const eyeType = profile.eyeType ?? '아몬드눈';
  const personalColor = profile.personalColor ?? '쿨톤';
  const vibe = profile.vibe ?? '청순 무드';
  const subline = `${faceShape} · ${personalColor.split(' ')[0] ?? '쿨톤'} · ${eyeType} 맞춤`;

  const profileFields: BeautyDisplayFields = {
    faceShape,
    eyeType,
    noseType: '중간콧대',
    lipType: '둥근입술',
    browType: '자연 아치',
  };

  // ── Navigate handlers (preserve all existing paths) ─────────────────────
  const goPalette       = () => navigation.navigate('Look'); // 기존: 퍼스널컬러 팔레트
  const goMoodBoard     = () => navigation.navigate('Look'); // 기존: 추구미 무드보드
  const goTodaysLook    = () => navigation.navigate('TodaysLook');
  const goTreatment     = () => navigation.navigate('TreatmentRecommend', { mode: 'look' });
  const goMakeupTip     = () => navigation.navigate('MakeupDiagnosis');
  const goFullProfile   = () => navigation.navigate('FaceAnalysis');

  // Product grid sizing
  const productCardW = (width - 36 - 12) / 2;

  // Color palette swatch sizing — 6 swatches in a row, with horizontal padding 16 (card) + 16 = 32 total card inset
  // Card width = screen - 36 (18px each side). Card padding = 16. Inner = card - 32.
  // Swatch width = (innerW - 5 gaps * 8) / 6
  const cardInnerW = width - 36 - 32;
  const swatchW = (cardInnerW - 5 * 8) / 6;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── 1. Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Look</Text>
          <Text style={styles.title}>메이크업</Text>
          <Text style={styles.subline}>{subline}</Text>
        </View>

        {/* ── 2. Face profile card (toggle) ─────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <LinearGradient
              colors={['#E8C2CC', '#CFB5C2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ShimmerSweep duration={4500} widthRatio={0.3} />
            <View style={styles.profileTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileDnaCode}>{`FACE · ${faceShape}`}</Text>
                <Text style={styles.profileDnaName}>Oval · Soft</Text>
                <Text style={styles.profileDnaKr}>{`${faceShape} · 소프트 무드`}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setProfileExpanded((v) => !v)}
                style={styles.profileToggle}
                hitSlop={8}
              >
                <Ionicons
                  name={profileExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#5C2C3F"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.profileTagsDivider} />
            <Text style={styles.profileTags}>
              {`${eyeType} · 중간콧대 · 둥근입술`}
            </Text>
          </View>

          {profileExpanded && (
            <View style={styles.profileExpanded}>
              {PROFILE_ROW_SPECS.map((spec) => (
                <View key={spec.key} style={styles.profileRow}>
                  <IconBox
                    gradient={spec.gradient}
                    icon={spec.icon}
                    iconColor={spec.iconColor}
                    size={26}
                  />
                  <Text style={styles.profileRowLabel}>{spec.label}</Text>
                  <Text style={styles.profileRowValue}>
                    {profileFields[spec.key]}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={goFullProfile}
                style={styles.profileFullLink}
                hitSlop={6}
              >
                <Text style={styles.profileFullLinkText}>See full profile →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 3. Color palette ──────────────────────────────────────── */}
        <TouchableOpacity
          onPress={goPalette}
          activeOpacity={0.9}
          style={styles.paletteCard}
        >
          <View style={styles.paletteHeader}>
            <Text style={styles.cardEyebrowLook}>Your palette</Text>
            <Text style={styles.cardMeta}>
              {profile.personalColor ?? '겨울 쿨톤'}
            </Text>
          </View>
          <Text style={styles.paletteSubtitle}>너의 컬러 팔레트</Text>

          <View style={styles.swatchesRow}>
            {PALETTE_SWATCHES.map((sw) => (
              <View key={sw.name} style={[styles.swatchWrap, { width: swatchW }]}>
                <View
                  style={[
                    styles.swatchCircle,
                    {
                      width: swatchW,
                      height: swatchW,
                      borderRadius: swatchW / 2,
                      backgroundColor: sw.hex,
                    },
                  ]}
                />
                <Text style={styles.swatchLabel} numberOfLines={1}>
                  {sw.name}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.paletteDivider} />
          <View style={styles.paletteCtaRow}>
            <Text style={styles.paletteCta}>전체 팔레트 · 컬러 매치</Text>
            <Ionicons name="chevron-forward" size={16} color="#5C2C3F" />
          </View>
        </TouchableOpacity>

        {/* ── 4. Mood board ─────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={goMoodBoard}
          activeOpacity={0.9}
          style={styles.moodCard}
        >
          <View style={styles.moodHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardEyebrowLook}>Mood board</Text>
              <Text style={styles.moodValue}>{vibe}</Text>
            </View>
            <View style={styles.moodChangePill}>
              <Text style={styles.moodChangePillText}>변경</Text>
            </View>
          </View>
          <View style={styles.moodGrid}>
            <View style={[styles.moodCell, { flex: 2 }]}>
              <LinearGradient
                colors={['#E8C2CC', '#CFB5C2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={[styles.moodCell, { flex: 1 }]}>
              <LinearGradient
                colors={['#FFD4DC', '#E4D4FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={[styles.moodCell, { flex: 1 }]}>
              <LinearGradient
                colors={['#E4D4FF', '#D4E4FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* ── 5. Today's look ───────────────────────────────────────── */}
        <TouchableOpacity
          onPress={goTodaysLook}
          activeOpacity={0.9}
          style={styles.todayCard}
        >
          <View style={styles.todayImage}>
            <LinearGradient
              colors={['#FFD4DC', '#E4D4FF', '#D4E4FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.cardEyebrowLookSm}>Today's look</Text>
            <Text style={styles.todayDday}>
              {profile.eventType && daysLeft != null
                ? `D-${daysLeft} ${profile.eventType}`
                : 'D-25 졸업식'}
            </Text>
            <Text style={styles.todayTitle}>청순 글로우 룩</Text>
            <Text style={styles.todaySub}>로즈 립 · 라벤더 섀도우</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
        </TouchableOpacity>

        {/* ── 6. Makeup tips ────────────────────────────────────────── */}
        <View style={styles.tipsHeader}>
          <Text style={styles.sectionTitle}>Makeup tips</Text>
          <Text style={styles.sectionTitleMeta}>맞춤</Text>
        </View>
        <View style={styles.tipsGroup}>
          {MAKEUP_TIPS.map((tip) => (
            <TouchableOpacity
              key={tip.title}
              onPress={goMakeupTip}
              activeOpacity={0.85}
              style={styles.tipRow}
            >
              <IconBox
                gradient={tip.gradient}
                icon={tip.icon}
                iconColor={tip.iconColor}
                size={36}
              />
              <View style={styles.tipRowText}>
                <Text style={styles.tipRowTitle}>{tip.title}</Text>
                <Text style={styles.tipRowSub}>{tip.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 7. Style plan ─────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>
          스타일 플랜
        </Text>
        <View style={styles.tipsGroup}>
          <TouchableOpacity
            onPress={goTreatment}
            activeOpacity={0.85}
            style={styles.tipRow}
          >
            <IconBox
              gradient={['#DCD4EC', '#C5CCE0'] as const}
              icon="medkit-outline"
              iconColor="#FFFFFF"
              size={44}
            />
            <View style={styles.tipRowText}>
              <Text style={styles.tipRowTitle}>AI 시술 추천</Text>
              <Text style={styles.tipRowSub}>얼굴형·퍼스널컬러 기반 시술 가이드</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
          </TouchableOpacity>
        </View>

        {/* ── 8. For you · 메이크업 (shop) ──────────────────────────── */}
        <View style={styles.forYouHeader}>
          <Text style={styles.forYouTitle}>For you · 메이크업</Text>
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
              <Text style={styles.productReason} numberOfLines={2}>{p.reason}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FBF5F6',
  },

  // 1. Header
  header: {
    paddingHorizontal: 18,
    marginTop: 4,
  },
  eyebrow: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(92,44,63,0.7)',
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

  // 2. Profile card
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
    color: 'rgba(92,44,63,0.65)',
  },
  profileDnaName: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: '#5C2C3F',
    fontWeight: '300',
    marginTop: 4,
  },
  profileDnaKr: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.5,
    color: 'rgba(92,44,63,0.7)',
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
    backgroundColor: 'rgba(92,44,63,0.12)',
    marginTop: 12,
    marginBottom: 8,
  },
  profileTags: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(92,44,63,0.75)',
  },
  profileExpanded: {
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileRowLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#8E8E93',
    width: 60,
  },
  profileRowValue: {
    flex: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
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
    color: '#5C2C3F',
  },

  // Common eyebrow / meta
  cardEyebrowLook: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
    color: '#5C2C3F',
  },
  cardEyebrowLookSm: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 14,
    color: '#5C2C3F',
  },
  cardMeta: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: '#8E8E93',
  },
  cardLink: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: '#8E8E93',
  },

  // 3. Color palette card
  paletteCard: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    padding: 16,
  },
  paletteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  paletteSubtitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    color: '#1A1A1F',
    marginTop: 2,
    fontWeight: '500',
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 4,
  },
  swatchCircle: {
    // dynamic size set inline
  },
  swatchLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 9,
    color: '#8E8E93',
  },
  paletteDivider: {
    height: 0.5,
    backgroundColor: '#F2F2F4',
    marginTop: 14,
    marginBottom: 10,
  },
  paletteCtaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paletteCta: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#5C2C3F',
    fontWeight: '500',
  },

  // 4. Mood board
  moodCard: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    overflow: 'hidden',
  },
  moodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  moodValue: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#1A1A1F',
    fontWeight: '500',
    marginTop: 2,
  },
  moodChangePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: '#FBF5F6',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
  },
  moodChangePillText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    color: '#5C2C3F',
  },
  moodGrid: {
    flexDirection: 'row',
    height: 100,
    gap: 2,
  },
  moodCell: {
    overflow: 'hidden',
  },

  // 5. Today's look
  todayCard: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayImage: {
    width: 60,
    height: 75,
    borderRadius: 10,
    overflow: 'hidden',
  },
  todayDday: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 8,
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  todayTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#1A1A1F',
    fontWeight: '500',
    marginTop: 2,
  },
  todaySub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },

  // 6 + 7. Section titles
  tipsHeader: {
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 18,
    color: '#5C2C3F',
    paddingHorizontal: 18,
  },
  sectionTitleMeta: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: '#8E8E93',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  tipsGroup: {
    paddingHorizontal: 18,
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    gap: 12,
  },
  tipRowText: {
    flex: 1,
    gap: 2,
  },
  tipRowTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 16,
    color: '#1A1A1F',
    fontWeight: '500',
  },
  tipRowSub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8E93',
  },

  // 8. For you
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
    color: '#5C2C3F',
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
    backgroundColor: '#5C2C3F',
    borderColor: '#5C2C3F',
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
    color: '#5C2C3F',
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
