/**
 * MyPageScreen — v1.5 redesign.
 *
 * 백업: MyPageScreen.backup.tsx (1022-line original)
 *
 * 새 구조:
 *   1. 상단 Row — "My page" + close (goBack)
 *   2. 프로필 — avatar (gradient + initial + ShimmerSweep) + name + email + Free/Premium badge
 *   3. DNA 카드 — 타입별 그라데이션 + 태그 라인 → FaceAnalysis
 *   4. Premium 카드 — 상태 rows + GradientPill → Paywall
 *   5. My beauty — 위시리스트 / 최근 본 / 스캔 이력
 *   6. Settings — 프로필 수정 / 알림 / 개인정보 / 약관
 *   7. 로그아웃
 *
 * 보존된 logic:
 *   - displayName / email / isPremium / scans loadProfile (Supabase + AsyncStorage)
 *   - useFocusEffect re-fetch
 *   - signOut handler (Alert 확인 → supabase.auth.signOut + store signOut)
 *   - navigate: ProfileEdit / NotificationSettings / PrivacyPolicy / TermsOfService
 *   - navigate: Paywall { source: 'mypage_card' } / FaceAnalysis / SkinJournal
 */

import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList, ScanAnalysisResult } from '../../types';
import { colors, BeautyTypeCode } from '../../theme';
import { GradientPill, ShimmerSweep } from '../../components/signature';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface ScanRow {
  id: string;
  created_at: string;
  scan_result: ScanAnalysisResult;
}

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
  size = 34,
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: 10,
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

// Plain (non-gradient) icon box for Settings rows
const PlainIconBox: React.FC<{ icon: keyof typeof Ionicons.glyphMap }> = ({ icon }) => (
  <View style={styles.plainIconBox}>
    <Ionicons name={icon} size={16} color="#8E8E93" />
  </View>
);

interface MenuRowProps {
  left: ReactNode;
  title: string;
  desc?: string;
  onPress: () => void;
}
const MenuRow: React.FC<MenuRowProps> = ({ left, title, desc, onPress }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.85}>
    {left}
    <View style={styles.menuRowText}>
      <Text style={styles.menuRowTitle}>{title}</Text>
      {desc && <Text style={styles.menuRowDesc}>{desc}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export function MyPageScreen() {
  const navigation = useNavigation<Nav>();
  const { signOut } = useAuthStore();

  // Beauty profile (for DNA card)
  const beautyType = useBeautyProfile((s) => s.beautyType);
  const skinType = useBeautyProfile((s) => s.skinType);
  const personalColor = useBeautyProfile((s) => s.personalColor);
  const faceShape = useBeautyProfile((s) => s.faceShape);
  const vibe = useBeautyProfile((s) => s.vibe);

  // Preserved state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [scans, setScans] = useState<ScanRow[]>([]);

  // ── loadProfile (preserved from backup) ──────────────────────────────────
  const loadProfile = async () => {
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
      try {
        const cached = await AsyncStorage.getItem('meve_display_name');
        if (cached) setDisplayName(cached);
      } catch {}
    }

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

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  // Navigate handlers (preserved targets)
  const goEdit        = () => navigation.navigate('ProfileEdit');
  const goNotifs      = () => navigation.navigate('NotificationSettings');
  const goPrivacy     = () => navigation.navigate('PrivacyPolicy');
  const goTerms       = () => navigation.navigate('TermsOfService');
  const goPaywall     = () => navigation.navigate('Paywall', { source: 'mypage_card' });
  const goScanHist    = () => navigation.navigate('SkinJournal');
  const goDnaDetail   = () => navigation.navigate('FaceAnalysis');
  const todoPlaceholder = () =>
    Alert.alert('준비 중', '곧 추가될 예정이에요!');

  // ── Derived ──────────────────────────────────────────────────────────────
  const dnaCode = (beautyType as BeautyTypeCode | null) ?? 'GCS';
  const dnaInfo = colors.types[dnaCode];
  const initialChar = (displayName || '?').charAt(0).toUpperCase();

  // Monthly scan count for free-tier display
  const now = new Date();
  const monthlyScanCount = scans.filter((s) => {
    const d = new Date(s.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // DNA card tags (only show valid values)
  const tags = [personalColor, faceShape, skinType, vibe].filter(
    (v): v is string => !!v && v.trim() !== '',
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── 1. Top row ────────────────────────────────────────────────── */}
        <View style={styles.topRow}>
          <Text style={styles.title}>My page</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={22} color="#2D3A6B" />
          </TouchableOpacity>
        </View>

        {/* ── 2. Profile ────────────────────────────────────────────────── */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['#FFD4DC', '#E4D4FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ShimmerSweep duration={4500} widthRatio={0.4} />
            <Text style={styles.avatarChar}>{initialChar}</Text>
          </View>
          <Text style={styles.name}>{displayName || '회원'}님</Text>
          {email && <Text style={styles.email}>{email}</Text>}
          <View style={[styles.badge, isPremium && styles.badgePremiumWrap]}>
            {isPremium ? (
              <LinearGradient
                colors={['#FFD4DC', '#E4D4FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text style={styles.badgeText}>{isPremium ? 'Premium' : 'Free'}</Text>
          </View>
        </View>

        {/* ── 3. DNA card ───────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={goDnaDetail}
          style={styles.dnaCard}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={dnaInfo.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <ShimmerSweep duration={4500} widthRatio={0.3} />
          <Text style={[styles.dnaCode, { color: dnaInfo.text }]}>
            {dnaCode} · YOUR BEAUTY DNA
          </Text>
          <Text style={[styles.dnaName, { color: dnaInfo.text }]}>{dnaInfo.name}</Text>
          <Text style={[styles.dnaKr, { color: dnaInfo.text }]}>{dnaInfo.kr}</Text>
          {tags.length > 0 && (
            <>
              <View style={styles.dnaDivider} />
              <View style={styles.dnaTagsRow}>
                {tags.slice(0, 4).map((tag) => (
                  <View key={tag} style={styles.dnaTag}>
                    <Text style={styles.dnaTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* ── 4. Premium ────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Premium</Text>
        <View style={styles.premiumCard}>
          <Text style={styles.premiumTitle}>meve 프리미엄</Text>
          <Text style={styles.premiumDesc}>
            모든 기능 무제한 · 우선 분석 · D-day 플랜
          </Text>
          <View style={styles.statusRowsGroup}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>현재 플랜</Text>
              <Text style={styles.statusValue}>{isPremium ? 'Premium' : 'Free'}</Text>
            </View>
            <View style={[styles.statusRow, styles.statusRowLast]}>
              <Text style={styles.statusLabel}>AI 스캔</Text>
              <Text style={styles.statusValue}>
                {isPremium ? '무제한' : `월 ${monthlyScanCount} / 3회`}
              </Text>
            </View>
          </View>
          {!isPremium && (
            <View style={{ marginTop: 12 }}>
              <GradientPill
                label="프리미엄 시작하기 · ₩9,900/월"
                size="lg"
                fullWidth
                iconRight={null}
                onPress={goPaywall}
              />
            </View>
          )}
        </View>

        {/* ── 5. My beauty ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>My beauty</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            left={
              <IconBox
                gradient={['rgba(255,212,220,0.5)', 'rgba(228,194,204,0.4)']}
                icon="heart-outline"
                iconColor="#993556"
              />
            }
            title="위시리스트"
            desc="저장한 제품"
            onPress={todoPlaceholder}
          />
          <MenuRow
            left={
              <IconBox
                gradient={['rgba(228,212,255,0.5)', 'rgba(212,228,255,0.4)']}
                icon="time-outline"
                iconColor="#534AB7"
              />
            }
            title="최근 본 제품"
            desc="최근 조회한 제품"
            onPress={todoPlaceholder}
          />
          <MenuRow
            left={
              <IconBox
                gradient={['rgba(216,228,242,0.5)', 'rgba(220,212,236,0.4)']}
                icon="document-text-outline"
                iconColor="#2D3A6B"
              />
            }
            title="내 스캔 이력"
            desc="날짜별 스캔 결과"
            onPress={goScanHist}
          />
        </View>

        {/* ── 6. Settings ───────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            left={<PlainIconBox icon="person-outline" />}
            title="프로필 수정"
            onPress={goEdit}
          />
          <MenuRow
            left={<PlainIconBox icon="notifications-outline" />}
            title="알림 설정"
            onPress={goNotifs}
          />
          <MenuRow
            left={<PlainIconBox icon="lock-closed-outline" />}
            title="개인정보 처리방침"
            onPress={goPrivacy}
          />
          <MenuRow
            left={<PlainIconBox icon="document-outline" />}
            title="이용약관"
            onPress={goTerms}
          />
        </View>

        {/* ── 7. Logout ─────────────────────────────────────────────────── */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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

  // 1. Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 24,
    color: '#2D3A6B',
    fontWeight: '300',
  },

  // 2. Profile
  profileSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChar: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 34,
    color: '#2D3A6B',
    fontWeight: '300',
  },
  name: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    lineHeight: 24,
    color: '#1A1A1F',
    fontWeight: '600',
    marginTop: 12,
  },
  email: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
    marginTop: 2,
  },
  badge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(45,58,107,0.08)',
    overflow: 'hidden',
  },
  badgePremiumWrap: {
    backgroundColor: 'transparent',
  },
  badgeText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: '#2D3A6B',
    fontWeight: '600',
  },

  // 3. DNA card
  dnaCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  dnaCode: {
    fontFamily: 'Menlo',
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 3,
    opacity: 0.7,
  },
  dnaName: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '300',
    marginTop: 4,
  },
  dnaKr: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.85,
    marginTop: 2,
    fontWeight: '500',
  },
  dnaDivider: {
    height: 0.5,
    backgroundColor: 'rgba(45,58,107,0.18)',
    marginTop: 10,
    marginBottom: 8,
  },
  dnaTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dnaTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dnaTagText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 9,
    lineHeight: 12,
    color: '#2D3A6B',
    fontWeight: '500',
  },

  // Section title
  sectionTitle: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
    color: '#2D3A6B',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },

  // 4. Premium card
  premiumCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    padding: 16,
  },
  premiumTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  premiumDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: '#8E8E93',
    marginTop: 2,
  },
  statusRowsGroup: {
    marginTop: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F2F2F4',
  },
  statusRowLast: {
    borderBottomWidth: 0,
  },
  statusLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
  },
  statusValue: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#1A1A1F',
    fontWeight: '500',
  },

  // 5 + 6. Menu rows
  menuGroup: {
    paddingHorizontal: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    gap: 12,
    marginBottom: 8,
  },
  menuRowText: {
    flex: 1,
  },
  menuRowTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#1A1A1F',
    fontWeight: '500',
  },
  menuRowDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  plainIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(45,58,107,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 7. Logout
  logoutBtn: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
  logoutText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#8E8E93',
  },
});
