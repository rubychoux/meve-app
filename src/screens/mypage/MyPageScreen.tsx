import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';

const logo = require('../../../assets/images/meve-logo.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList, ScanAnalysisResult } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface ScanRow {
  id: string;
  created_at: string;
  scan_result: ScanAnalysisResult;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
}

const FEATURES = [
  { label: 'AI 피부 스캔', free: '월 3회', premium: '무제한' },
  { label: '성분 스캔', free: '월 5회', premium: '무제한' },
  { label: '맞춤 성분 분석', free: 'X', premium: 'O' },
  { label: 'AI 루틴 생성', free: 'X', premium: 'O' },
  { label: 'D-day 케어 플랜', free: 'X', premium: 'O' },
];

const MENU_ITEMS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  iconColor?: string;
  subtitle?: string;
}[] = [
  { icon: 'person-outline', label: '프로필 수정' },
  { icon: 'notifications-outline', label: '알림 설정' },
  { icon: 'shield-outline', label: '개인정보 처리방침' },
  { icon: 'document-text-outline', label: '이용약관' },
  {
    icon: 'chatbubble-outline',
    label: '문의하기',
    iconColor: '#5BA3D9',
    subtitle: '불편한 점이나 개선사항을 알려주세요',
  },
  { icon: 'log-out-outline', label: '로그아웃', danger: true },
];

export function MyPageScreen() {
  const navigation = useNavigation<Nav>();
  const { signOut } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [showAllScans, setShowAllScans] = useState(false);
  const SCAN_PREVIEW_COUNT = 3;

  const loadProfile = async () => {
    // Premium status (cheap — no auth call)
    try {
      const raw = await AsyncStorage.getItem('meve_is_premium');
      if (raw === 'true') setIsPremium(true);
    } catch {}

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (user.email) setEmail(user.email);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    } else {
      // Fallback to a locally cached name (e.g. just-saved edit before
      // Supabase propagation completes).
      try {
        const cached = await AsyncStorage.getItem('meve_display_name');
        if (cached) setDisplayName(cached);
      } catch {}
    }

    // Scan history
    const { data: scanData } = await supabase
      .from('skin_scans')
      .select('id, created_at, scan_result')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (scanData) setScans(scanData as ScanRow[]);
  };

  useEffect(() => {
    loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch on focus so profile edits propagate immediately.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          signOut();
        },
      },
    ]);
  };

  const handleContact = () => {
    Alert.alert('문의하기', '어떤 방법으로 문의하시겠어요?', [
      {
        text: '이메일로 문의',
        onPress: () =>
          Linking.openURL(
            'mailto:chouxxkim@gmail.com?subject=meve 앱 문의&body=문의 내용을 입력해주세요.'
          ),
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handleMenuPress = (label: string) => {
    switch (label) {
      case '프로필 수정':
        navigation.navigate('ProfileEdit');
        return;
      case '알림 설정':
        navigation.navigate('NotificationSettings');
        return;
      case '개인정보 처리방침':
        navigation.navigate('PrivacyPolicy');
        return;
      case '이용약관':
        navigation.navigate('TermsOfService');
        return;
      case '문의하기':
        handleContact();
        return;
      case '로그아웃':
        handleLogout();
        return;
      default:
        Alert.alert('준비 중', '이 기능은 곧 추가될 예정이에요!');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.screenHeader}>
          <Image source={logo} style={styles.headerLogo} />
        </View>

        {/* ── 1. PROFILE HEADER ──────────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          <Text style={styles.displayName}>{displayName || '회원'}님</Text>
          {email && <Text style={styles.email}>{email}</Text>}
          <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
            <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPremium]}>
              {isPremium ? 'Premium' : 'Free'}
            </Text>
          </View>
        </View>

        {/* ── 2. BEAUTY DNA ───────────────────────────────────────────────── */}
        <BeautyDnaCard
          onFaceAnalysis={() => navigation.navigate('FaceAnalysis')}
          onSkinScan={() => (navigation as any).navigate('Scan')}
        />

        {/* ── 3. PLAN CARD (if not premium) ──────────────────────────────── */}
        {!isPremium && (
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>meve 프리미엄</Text>
            <Text style={styles.planSubtitle}>
              D-day까지 완벽한 피부를 위한 모든 기능
            </Text>

            {/* Feature table */}
            <View style={styles.featureTable}>
              {/* Header */}
              <View style={styles.featureHeaderRow}>
                <Text style={[styles.featureCell, styles.featureCellLabel]}>기능</Text>
                <Text style={[styles.featureCell, styles.featureCellHeader]}>Free</Text>
                <Text style={[styles.featureCell, styles.featureCellHeader, { color: Colors.accent, fontWeight: '600' }]}>
                  Premium
                </Text>
              </View>

              {/* Rows */}
              {FEATURES.map((f, i) => (
                <View
                  key={i}
                  style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}
                >
                  <Text style={[styles.featureCell, styles.featureCellLabel, { color: Colors.textPrimary, fontSize: 13 }]}>
                    {f.label}
                  </Text>
                  <Text style={[styles.featureCell, styles.featureCellValue]}>{f.free}</Text>
                  <Text
                    style={[
                      styles.featureCell,
                      styles.featureCellValue,
                      { color: f.premium === 'O' || f.premium === '무제한' ? Colors.accent : '#999', fontWeight: '600' },
                    ]}
                  >
                    {f.premium}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <LinearGradient
              colors={['#F9C4D8', '#E8B4E8', '#C4B8E8', '#B8D4F0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Paywall', { source: 'mypage_card' })
                }
                style={styles.ctaBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnTitle}>프리미엄 시작하기</Text>
                <Text style={styles.ctaBtnPrice}>월 9,900원</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {/* ── 2.5 DERMATOLOGY REFERRAL ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>피부과 상담하기</Text>
          <View style={styles.referralCard}>
            <Text style={styles.referralDesc}>
              제휴 피부과에서 상담 예약을 진행할 수 있어요.
            </Text>

            {[
              { name: '제휴 피부과 A', phone: '0212345678', url: 'https://example.com/clinic-a' },
              { name: '제휴 피부과 B', phone: '0211122233', url: 'https://example.com/clinic-b' },
              { name: '제휴 피부과 C', phone: '0255556666', url: 'https://example.com/clinic-c' },
            ].map((c) => (
              <View key={c.name} style={styles.clinicRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clinicName}>{c.name}</Text>
                  <Text style={styles.clinicSub}>예약 링크 또는 전화 연결</Text>
                </View>
                <TouchableOpacity
                  style={styles.clinicBtn}
                  onPress={() => Linking.openURL(c.url)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.clinicBtnText}>예약</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clinicBtn, styles.clinicBtnOutline]}
                  onPress={() => Linking.openURL(`tel:${c.phone}`)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.clinicBtnText, styles.clinicBtnTextOutline]}>전화</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* ── 3. SCAN HISTORY ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 스캔 이력</Text>
          {scans.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="heart-outline" size={32} color={Colors.accentMuted} />
              <Text style={styles.emptyText}>
                아직 스캔 기록이 없어요.{'\n'}AI 스캐너로 첫 진단을 시작해보세요!
              </Text>
            </View>
          ) : (
            <View style={styles.scanList}>
              {(showAllScans ? scans : scans.slice(0, SCAN_PREVIEW_COUNT)).map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={styles.scanRow}
                  onPress={() =>
                    navigation.navigate('ScanResult', {
                      result: row.scan_result,
                      isSaved: true,
                    })
                  }
                  activeOpacity={0.75}
                >
                  <View style={styles.scanRowLeft}>
                    <Text style={styles.scanDate}>{formatDate(row.created_at)}</Text>
                    <Text style={styles.scanCondition} numberOfLines={1}>
                      {row.scan_result.skinType ??
                        row.scan_result.skinCondition ??
                        row.scan_result.summary ??
                        '피부 분석 결과'}
                    </Text>
                  </View>
                  <View style={styles.scanRowRight}>
                    <Text style={[styles.scanScore, { color: scoreColor(row.scan_result.overallScore) }]}>
                      {row.scan_result.overallScore}점
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
                  </View>
                </TouchableOpacity>
              ))}
              {scans.length > SCAN_PREVIEW_COUNT && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAllScans((prev) => !prev)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.showMoreText}>
                    {showAllScans
                      ? '접기 ▲'
                      : `더보기 (${scans.length - SCAN_PREVIEW_COUNT}개 더) ▼`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── 4. SETTINGS MENU ───────────────────────────────────────────── */}
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, index < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() => handleMenuPress(item.label)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.danger ? Colors.danger : item.iconColor ?? '#999'}
              />
              <View style={styles.menuLabelCol}>
                <Text style={[styles.menuLabel, item.danger && { color: Colors.danger }]}>
                  {item.label}
                </Text>
                {item.subtitle && (
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ddd" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Beauty DNA card ────────────────────────────────────────────────────────

const isValid = (v: string | null | undefined) =>
  !!v && v !== 'unknown' && v.trim() !== '';

// Personal color → palette mapping for the Beauty DNA card swatches.
const COLOR_PALETTES: Record<string, string[]> = {
  '봄 웜톤': ['#FFB5A7', '#F8A195', '#E07B6B', '#FFCBA4', '#F4A460', '#DEB887'],
  '여름 쿨톤': ['#B8D4E8', '#9FC3DC', '#C4B8E0', '#E8B4D0', '#D4A0C0', '#B0C4DE'],
  '가을 웜톤': ['#C8A882', '#B8956A', '#8B6914', '#CD853F', '#D2691E', '#A0522D'],
  '겨울 쿨톤': ['#E8E8F0', '#C8C8E0', '#9090C8', '#FF1493', '#DC143C', '#800020'],
};

function BeautyDnaCard({
  onFaceAnalysis,
  onSkinScan,
}: {
  onFaceAnalysis: () => void;
  onSkinScan: () => void;
}) {
  const profile = useBeautyProfile();
  const completion = profile.getCompletionPercentage();
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Load previous scan score for the trend arrow.
  useEffect(() => {
    AsyncStorage.getItem('meve_previous_scan_result').then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.overallScore === 'number') {
          setPreviousScore(parsed.overallScore);
        }
      } catch {}
    });
  }, []);

  // Identity sentence pieces.
  const featureParts: string[] = [];
  if (isValid(profile.personalColor)) featureParts.push(profile.personalColor!);
  if (isValid(profile.faceShape)) featureParts.push(profile.faceShape!);
  if (isValid(profile.eyeType)) featureParts.push(profile.eyeType!);
  const featureLine = featureParts.length > 0 ? featureParts.join(' / ') : null;

  const skinPart = isValid(profile.skinType) ? `${profile.skinType} 피부` : null;
  const vibePart = isValid(profile.vibe) ? `${profile.vibe} 추구미` : null;
  const skinVibeJoined = [skinPart, vibePart].filter(Boolean).join('에 ');
  const skinVibeLine = skinVibeJoined ? `${skinVibeJoined}예요` : null;

  const hasIdentity = !!featureLine || !!skinVibeLine;

  const palette =
    isValid(profile.personalColor) && COLOR_PALETTES[profile.personalColor!]
      ? COLOR_PALETTES[profile.personalColor!]
      : null;

  const scoreDiff =
    profile.lastSkinScore != null && previousScore != null
      ? profile.lastSkinScore - previousScore
      : null;

  // CTA copy + handler depend on what's missing first.
  const ctaText = !isValid(profile.personalColor)
    ? '+ AI 얼굴 분석으로 퍼스널컬러 알아보기 →'
    : profile.lastSkinScore == null
      ? '+ 피부 스캔하고 스코어 확인하기 →'
      : '+ 프로필 완성하기 →';
  const ctaHandler =
    !isValid(profile.personalColor) || isValid(profile.personalColor)
      ? onFaceAnalysis
      : onSkinScan;
  // Above keeps onFaceAnalysis for personalColor missing case AND default;
  // route the "피부 스캔" CTA to onSkinScan for correct destination:
  const skinScanCta =
    isValid(profile.personalColor) && profile.lastSkinScore == null;

  return (
    <View style={styles.dnaCard}>
      {/* Header */}
      <View style={styles.dnaHeader}>
        <Text style={styles.dnaTitle}>내 뷰티 DNA ✨</Text>
        <TouchableOpacity onPress={onFaceAnalysis} activeOpacity={0.75}>
          <Text style={styles.dnaEditBtn}>편집 →</Text>
        </TouchableOpacity>
      </View>

      {/* Identity sentence */}
      {hasIdentity ? (
        <View style={styles.identitySection}>
          {featureLine && (
            <Text style={styles.identityFeature}>{featureLine}</Text>
          )}
          {skinVibeLine && (
            <Text style={styles.identitySkinVibe}>{skinVibeLine}</Text>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.identityEmpty}
          onPress={onFaceAnalysis}
          activeOpacity={0.85}
        >
          <Text style={styles.identityEmptyText}>
            AI 얼굴 분석으로 내 뷰티 정체성을 알아봐요 →
          </Text>
        </TouchableOpacity>
      )}

      {/* Personal color palette swatches */}
      {palette && (
        <View style={styles.paletteSection}>
          <Text style={styles.paletteLabel}>
            {profile.personalColor} 컬러 팔레트
          </Text>
          <View style={styles.swatchRow}>
            {palette.map((color, i) => (
              <View
                key={`${color}-${i}`}
                style={[styles.swatch, { backgroundColor: color }]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Skin concerns */}
      {profile.skinConcerns && profile.skinConcerns.length > 0 && (
        <View style={styles.concernSection}>
          <Text style={styles.concernLabel}>피부 고민</Text>
          <View style={styles.concernPills}>
            {profile.skinConcerns.map((concern, i) => (
              <View key={`${concern}-${i}`} style={styles.concernPill}>
                <Text style={styles.concernPillText}>{concern}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Skin score with trend */}
      {profile.lastSkinScore != null && (
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>스킨 스코어</Text>
          <View style={styles.scoreRight}>
            <Text style={styles.scoreValue}>{profile.lastSkinScore}점</Text>
            {scoreDiff !== null && scoreDiff !== 0 && (
              <Text
                style={[
                  styles.scoreDiff,
                  { color: scoreDiff > 0 ? '#7CB798' : '#FF6B6B' },
                ]}
              >
                {scoreDiff > 0 ? ' ↑' : ' ↓'}
                {Math.abs(scoreDiff)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Completion bar */}
      <View style={styles.completionSection}>
        <View style={styles.completionRow}>
          <Text style={styles.completionLabel}>
            프로필 완성도 {completion}%
          </Text>
        </View>
        <View style={styles.completionBar}>
          <View
            style={[styles.completionFill, { width: `${completion}%` }]}
          />
        </View>
      </View>

      {/* CTA if incomplete */}
      {completion < 100 && (
        <TouchableOpacity
          style={styles.dnaCta}
          onPress={skinScanCta ? onSkinScan : ctaHandler}
          activeOpacity={0.75}
        >
          <Text style={styles.dnaCtaText}>{ctaText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F9' },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },

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

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  email: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  planBadge: {
    marginTop: 8,
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  planBadgePremium: {
    backgroundColor: Colors.accent,
  },
  planBadgeText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  planBadgeTextPremium: {
    color: '#fff',
  },

  // Beauty DNA card
  dnaCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#D0B0D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  dnaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dnaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  dnaEditBtn: {
    fontSize: 13,
    color: '#FF6B9D',
    fontWeight: '500',
  },

  identitySection: {
    marginBottom: 14,
  },
  identityFeature: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  identitySkinVibe: {
    fontSize: 14,
    color: '#5A5A7A',
    fontWeight: '400',
  },
  identityEmpty: {
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#FFC4D6',
    borderStyle: 'dashed',
  },
  identityEmptyText: {
    fontSize: 13,
    color: '#FF6B9D',
    fontWeight: '500',
  },

  paletteSection: {
    marginBottom: 14,
  },
  paletteLabel: {
    fontSize: 11,
    color: '#8A8A9A',
    marginBottom: 6,
    fontWeight: '500',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 6,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },

  concernSection: {
    marginBottom: 12,
  },
  concernLabel: {
    fontSize: 11,
    color: '#8A8A9A',
    marginBottom: 6,
    fontWeight: '500',
  },
  concernPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  concernPill: {
    backgroundColor: '#E8F4FD',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  concernPillText: {
    fontSize: 12,
    color: '#5BA3D9',
    fontWeight: '500',
  },

  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#8A8A9A',
    fontWeight: '500',
  },
  scoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5BA3D9',
  },
  scoreDiff: {
    fontSize: 13,
    fontWeight: '600',
  },

  completionSection: {
    marginBottom: 10,
  },
  completionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  completionLabel: {
    fontSize: 12,
    color: '#8A8A9A',
  },
  completionBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
  },
  completionFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B9D',
  },

  dnaCta: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  dnaCtaText: {
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: '500',
  },

  // Plan card
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  featureTable: {},
  featureHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6EC',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9F0F5',
  },
  featureCell: {
    textAlign: 'center',
  },
  featureCellLabel: {
    flex: 1,
    textAlign: 'left',
    fontSize: 12,
    color: '#999',
  },
  featureCellHeader: {
    width: 60,
    fontSize: 12,
    color: '#999',
  },
  featureCellValue: {
    width: 60,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },

  // CTA
  ctaGradient: {
    borderRadius: 14,
    marginTop: 20,
  },
  ctaBtn: {
    padding: 16,
    alignItems: 'center',
  },
  ctaBtnTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  ctaBtnPrice: {
    color: '#fff',
    opacity: 0.85,
    fontSize: 13,
    marginTop: 2,
  },

  // Section
  section: {
    marginHorizontal: 16,
    gap: Spacing.sm,
    marginBottom: 16,
  },
  sectionTitle: { ...Typography.h3 },
  referralCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  referralDesc: { ...Typography.bodySecondary, lineHeight: 20 },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clinicName: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  clinicSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  clinicBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  clinicBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  clinicBtnText: { ...Typography.caption, color: '#fff', fontWeight: '800' },
  clinicBtnTextOutline: { color: Colors.accent },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.bodySecondary, textAlign: 'center', lineHeight: 22 },

  // Scan list
  scanList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scanRowLeft: { flex: 1, gap: 2 },
  scanDate: { ...Typography.caption, color: Colors.textSecondary },
  scanCondition: { ...Typography.body, color: Colors.textPrimary },
  scanRowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scanScore: { fontSize: 15, fontWeight: '700' },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  showMoreText: {
    fontSize: 13,
    color: '#5BA3D9',
    fontWeight: '500',
  },

  // Menu
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9F0F5',
  },
  menuLabelCol: {
    marginLeft: 12,
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 15,
    color: '#2D2D2D',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#8A8A9A',
  },
});
