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
          onSkinScan={() => (navigation as any).navigate('Skin')}
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
                  Alert.alert('준비 중이에요', '곧 출시될 예정이에요! 조금만 기다려주세요 :)')
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
              {scans.map((row) => (
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

interface PillProps {
  label: string;
  color: string;
  outlined?: boolean;
}

function Pill({ label, color, outlined }: PillProps) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 50,
        backgroundColor: outlined ? 'transparent' : `${color}20`,
        borderWidth: outlined ? 1.5 : 1,
        borderColor: color,
        marginRight: 6,
      }}
    >
      <Text style={{ fontSize: 12, color, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const isValid = (v: string | null | undefined) =>
  !!v && v !== 'unknown' && v.trim() !== '';

function BeautyDnaCard({
  onFaceAnalysis,
  onSkinScan,
}: {
  onFaceAnalysis: () => void;
  onSkinScan: () => void;
}) {
  const profile = useBeautyProfile();
  const completion = profile.getCompletionPercentage();

  return (
    <View style={styles.dnaCard}>
      <Text style={styles.dnaTitle}>내 뷰티 DNA ✨</Text>

      <View style={styles.completionRow}>
        <Text style={styles.completionText}>프로필 완성도 {completion}%</Text>
        <View style={styles.completionBar}>
          <View style={[styles.completionFill, { width: `${completion}%` }]} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dnaPillRow}
      >
        {isValid(profile.skinType) && (
          <Pill label={profile.skinType!} color="#5BA3D9" />
        )}
        {isValid(profile.personalColor) && (
          <Pill label={profile.personalColor!} color="#9B59B6" />
        )}
        {isValid(profile.vibe) && (
          <Pill label={profile.vibe!} color="#FF6B9D" />
        )}
        {isValid(profile.faceShape) && (
          <Pill label={profile.faceShape!} color="#8A8A9A" />
        )}
        {!isValid(profile.personalColor) && (
          <TouchableOpacity onPress={onFaceAnalysis} activeOpacity={0.75}>
            <View style={styles.ctaPill}>
              <Text style={styles.ctaPillText}>+ 얼굴 분석하기</Text>
            </View>
          </TouchableOpacity>
        )}
        {!isValid(profile.skinType) && (
          <TouchableOpacity onPress={onSkinScan} activeOpacity={0.75}>
            <View style={styles.ctaPill}>
              <Text style={styles.ctaPillText}>+ 피부 스캔하기</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      {profile.lastSkinScore != null && (
        <Text style={styles.dnaScoreText}>
          최근 스킨 스코어:{' '}
          <Text style={{ color: '#5BA3D9', fontWeight: '700' }}>
            {profile.lastSkinScore}점
          </Text>
        </Text>
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    gap: 10,
  },
  dnaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completionText: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '600',
  },
  completionBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    flex: 1,
    overflow: 'hidden',
  },
  completionFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B9D',
  },
  dnaPillRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    alignItems: 'center',
  },
  ctaPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#FF6B9D',
    borderStyle: 'dashed',
    marginRight: 6,
  },
  ctaPillText: {
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: '600',
  },
  dnaScoreText: {
    fontSize: 12,
    color: '#1A1A2E',
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
