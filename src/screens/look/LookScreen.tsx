import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const logo = require('../../../assets/images/meve-logo.png');
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { MainStackParamList, FaceAnalysisResult } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type AestheticKey = 'pure' | 'glow' | 'bold' | 'natural' | 'vintage';

interface Aesthetic {
  key: AestheticKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  desc: string;
  tip: string;
}

const AESTHETICS: Aesthetic[] = [
  {
    key: 'pure',
    label: '청순',
    icon: 'heart-outline',
    desc: '맑고 투명한 피부 표현',
    tip: '수분감 있는 스킨케어 후 가벼운 쿠션 파운데이션을 사용해요. 핑크·복숭아 톤 블러셔로 생기를 더하세요.',
  },
  {
    key: 'glow',
    label: '글로우',
    icon: 'sparkles-outline',
    desc: '빛나는 광채 메이크업',
    tip: '하이라이터를 광대뼈·콧날에 가볍게 얹고, 광택감 있는 립 글로스로 마무리해요.',
  },
  {
    key: 'bold',
    label: '볼드',
    icon: 'flame-outline',
    desc: '강렬하고 개성있는 룩',
    tip: '선명한 아이라이너와 레드·버건디 립으로 포인트를 줘요. 피부는 매트하게 정리하세요.',
  },
  {
    key: 'natural',
    label: '내추럴',
    icon: 'leaf-outline',
    desc: '자연스러운 무결점 메이크업',
    tip: '피부 톤을 고르게 정리하고 브라운 계열 아이섀도우로 깊이를 더해요. 립은 누드 컬러로 자연스럽게.',
  },
  {
    key: 'vintage',
    label: '빈티지',
    icon: 'camera-outline',
    desc: '레트로 감성 룩',
    tip: '테라코타·벽돌색 립과 브라운 아이라이너로 복고 무드를 연출해요. 블러셔는 오렌지-레드 계열로.',
  },
];

export function LookScreen() {
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<AestheticKey | null>(null);
  const [savedFaceAnalysis, setSavedFaceAnalysis] = useState<FaceAnalysisResult | null>(null);
  const [savedInspoCount, setSavedInspoCount] = useState(0);

  const selectedAesthetic = AESTHETICS.find((a) => a.key === selected);

  useEffect(() => {
    (async () => {
      try {
        const storedLabel = await AsyncStorage.getItem('meve_vibe');
        if (storedLabel) {
          const match = AESTHETICS.find((a) => a.label === storedLabel);
          if (match) setSelected(match.key);
        }
      } catch {}
    })();
  }, []);

  const loadSavedFaceAnalysis = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('meve_face_analysis');
      if (raw) setSavedFaceAnalysis(JSON.parse(raw) as FaceAnalysisResult);
      else setSavedFaceAnalysis(null);
    } catch {
      setSavedFaceAnalysis(null);
    }
  }, []);

  const loadSavedInspoCount = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('meve_inspo_looks');
      const list = raw ? JSON.parse(raw) : [];
      setSavedInspoCount(Array.isArray(list) ? list.length : 0);
    } catch {
      setSavedInspoCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedFaceAnalysis();
      loadSavedInspoCount();
    }, [loadSavedFaceAnalysis, loadSavedInspoCount])
  );

  const handleSelect = async (key: AestheticKey) => {
    const isDeselect = selected === key;
    const next = isDeselect ? null : key;
    setSelected(next);
    try {
      if (next) {
        const label = AESTHETICS.find((a) => a.key === next)?.label;
        if (label) await AsyncStorage.setItem('meve_vibe', label);
      } else {
        await AsyncStorage.removeItem('meve_vibe');
      }
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Image source={logo} style={styles.headerLogo} />
        </View>

        {/* 타이틀 */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>나만의 추구미를 찾아요</Text>
          <Text style={styles.subtitle}>원하는 스타일을 선택하면 맞춤 팁을 드려요</Text>
        </View>

        {/* 추구미 가로 스크롤 카드 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.aestheticScroll}
          contentContainerStyle={styles.aestheticRow}
        >
          {AESTHETICS.map((item) => {
            const isSelected = selected === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.aestheticCard, isSelected && styles.aestheticCardSelected]}
                onPress={() => handleSelect(item.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={item.icon}
                  size={28}
                  color={isSelected ? Colors.accent : Colors.textSecondary}
                />
                <Text style={[styles.aestheticLabel, isSelected && styles.aestheticLabelSelected]}>
                  {item.label}
                </Text>
                <Text style={styles.aestheticDesc}>{item.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 선택된 추구미 팁 */}
        {selectedAesthetic && (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <Ionicons name="bulb-outline" size={16} color={Colors.accent} />
              <Text style={styles.tipTitle}>{selectedAesthetic.label} 스타일 팁</Text>
            </View>
            <Text style={styles.tipText}>{selectedAesthetic.tip}</Text>
          </View>
        )}

        {/* 기능 카드들 */}
        <View style={styles.comingSoonSection}>
          <Text style={styles.sectionLabel}>AI 뷰티 기능</Text>

          <TouchableOpacity
            style={styles.comingSoonCard}
            onPress={() => navigation.navigate('FaceAnalysis')}
            activeOpacity={0.85}
          >
            <View style={styles.comingSoonIconWrap}>
              <Ionicons name="scan-outline" size={28} color={Colors.accent} />
            </View>
            <View style={styles.comingSoonBody}>
              <Text style={styles.comingSoonTitle}>
                AI 얼굴 분석{savedFaceAnalysis ? ' 다시 하기' : ''}
              </Text>
              <Text style={styles.comingSoonDesc}>
                얼굴형과 피부톤을 분석해 어울리는 룩을 추천해드려요
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {savedFaceAnalysis && (
            <TouchableOpacity
              style={[styles.comingSoonCard, styles.savedResultCard]}
              onPress={() =>
                navigation.navigate('FaceAnalysisResult', { result: savedFaceAnalysis })
              }
              activeOpacity={0.85}
            >
              <View style={[styles.comingSoonIconWrap, styles.savedResultIconWrap]}>
                <Ionicons name="sparkles" size={24} color="#fff" />
              </View>
              <View style={styles.comingSoonBody}>
                <Text style={styles.comingSoonTitle}>저장된 분석 결과 보기</Text>
                <Text style={styles.comingSoonDesc}>
                  {savedFaceAnalysis.personalColor} · {savedFaceAnalysis.faceShape}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.comingSoonCard}
            onPress={() => navigation.navigate('TodaysLook')}
            activeOpacity={0.85}
          >
            <View style={styles.comingSoonIconWrap}>
              <Ionicons name="calendar-outline" size={28} color={Colors.accent} />
            </View>
            <View style={styles.comingSoonBody}>
              <Text style={styles.comingSoonTitle}>오늘의 룩</Text>
              <Text style={styles.comingSoonDesc}>
                D-day에 맞는 메이크업을 제안해드려요
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 인스포 룩 분석 */}
        <View style={styles.inspoSection}>
          <Text style={styles.inspoTitle}>인스포 룩 분석 ✨</Text>
          <Text style={styles.inspoDesc}>레퍼런스 사진으로 나만의 메이크업 찾기</Text>
          <TouchableOpacity
            style={styles.inspoBtn}
            onPress={() => navigation.navigate('InspoLook')}
            activeOpacity={0.85}
          >
            <Ionicons name="image-outline" size={18} color="#fff" />
            <Text style={styles.inspoBtnText}>사진 업로드하기</Text>
          </TouchableOpacity>
          {savedInspoCount > 0 && (
            <TouchableOpacity
              style={styles.inspoSavedLink}
              onPress={() => navigation.navigate('InspoLookSaved')}
              activeOpacity={0.75}
            >
              <Ionicons name="bookmark" size={14} color="#FF6B9D" />
              <Text style={styles.inspoSavedLinkText}>
                저장한 인스포 룩 {savedInspoCount}개 보기 →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  content: { paddingBottom: 40 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 0,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 4,
  },
  headerLogo: {
    width: 170,
    height: 68,
    resizeMode: 'contain',
    alignSelf: 'flex-start',
    marginLeft: -40,
    marginBottom: -8,
  },

  titleSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  title: { ...Typography.h2, marginBottom: 4 },
  subtitle: { ...Typography.bodySecondary },

  // 추구미 스크롤
  aestheticScroll: { marginBottom: Spacing.md },
  aestheticRow: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  aestheticCard: {
    width: 100,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  aestheticCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  aestheticLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  aestheticLabelSelected: { color: Colors.accent },
  aestheticDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },

  // 팁 카드
  tipCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  tipText: { ...Typography.body, lineHeight: 22, color: Colors.textPrimary },

  // 커밍순
  comingSoonSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  sectionLabel: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  comingSoonIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonBody: { flex: 1, gap: 4 },
  comingSoonTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  comingSoonDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  savedResultCard: {
    backgroundColor: '#FFF5F9',
    borderColor: '#FFC4D6',
  },
  savedResultIconWrap: {
    backgroundColor: '#FF6B9D',
  },
  comingSoonBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  comingSoonBadgeText: { fontSize: 12, color: Colors.accent, fontWeight: '500' },

  // Inspo section
  inspoSection: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: '#FFF5F9',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#FFC4D6',
    gap: 6,
  },
  inspoTitle: { fontSize: 15, fontWeight: '800', color: '#2D2D2D' },
  inspoDesc: { fontSize: 13, color: '#9A8F97' },
  inspoBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF6B9D',
    borderRadius: 12,
    paddingVertical: 12,
  },
  inspoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  inspoSavedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 6,
  },
  inspoSavedLinkText: {
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: '600',
  },
});
