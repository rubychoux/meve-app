/**
 * ScanScreen — v3 "스캔" 탭 hub.
 *
 * 정보구조 v3:
 *   1. 헤더 "뭘 스캔할까요?"
 *   2. 메인 DNA 카드 (시그니처 그라데이션, Pearl Reveal 톤) → FaceScanner
 *   3. — 또는 —
 *   4. 6 서브 스캔 (2×3 그리드) — PearlIcon 아이콘 사용
 *
 * 코치 채팅 (구 MeveScreen 콘텐츠)은 TopBar ✨ 아이콘 → 'Meve' stack route로 이동.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../types';
import { colors } from '../../theme';
import { PearlIcon, ShimmerSweep } from '../../components/signature';
import type { PearlVariant } from '../../components/signature';
import { TopBar } from '../../components/common/TopBar';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Scan'>,
  NativeStackNavigationProp<MainStackParamList>
>;

interface SubScanItem {
  variant: PearlVariant;
  title: string;
  sub: string;
  target: keyof MainStackParamList;
}

const SUB_SCANS: SubScanItem[] = [
  { variant: 'trouble',    title: '피부 스캔',      sub: 'AI 피부 분석',       target: 'FaceScanner' },
  { variant: 'makeup',     title: '메이크업 진단',  sub: '내 화장 분석',       target: 'MakeupDiagnosis' },
  { variant: 'inspo',      title: '인스포 룩 분석', sub: '사진으로 제품 찾기', target: 'InspoLook' },
  { variant: 'ingredient', title: '성분 스캔',      sub: '성분표 촬영',        target: 'IngredientScanner' },
  { variant: 'face',       title: 'AI 얼굴 분석',   sub: '퍼스널컬러·얼굴형',  target: 'FaceAnalysis' },
  { variant: 'color',      title: '컬러 매치',      sub: '테스터 촬영',        target: 'ColorMatch' },
];

export function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();

  // 2-column grid card width = (screen - 40 page padding - 12 gap) / 2
  const cardW = (width - 40 - 12) / 2;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>뭘 스캔할까요?</Text>

        {/* Main DNA card */}
        <Pressable
          onPress={() => navigation.navigate('FaceScanner')}
          style={styles.dnaCardWrap}
        >
          <View style={styles.dnaCard}>
            <LinearGradient
              colors={colors.signatureGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ShimmerSweep duration={4500} widthRatio={0.35} />
            <View style={styles.dnaCardContent}>
              <Text style={styles.dnaCardTitle}>뷰티 DNA 스캔</Text>
              <Text style={styles.dnaCardSub}>나의 뷰티 타입 발견</Text>
            </View>
          </View>
        </Pressable>

        {/* Divider */}
        <Text style={styles.divider}>— or —</Text>

        {/* 6 sub-scan grid */}
        <View style={styles.gridWrap}>
          {SUB_SCANS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={[styles.subCard, { width: cardW }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(item.target as any)}
            >
              <PearlIcon variant={item.variant} size={44} />
              <View style={styles.subCardText}>
                <Text style={styles.subCardLabel}>{item.title}</Text>
                <Text style={styles.subCardSub}>{item.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

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
  header: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: '#1A1A1F',
    fontWeight: '600',
    paddingHorizontal: 20,
    marginTop: 12,
  },

  // Main DNA card
  dnaCardWrap: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  dnaCard: {
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dnaCardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  dnaCardTitle: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: '#2D3A6B',
    fontWeight: '300',
  },
  dnaCardSub: {
    fontFamily: 'Pretendard-Light',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(45,58,107,0.7)',
    fontWeight: '300',
    marginTop: 4,
  },

  // — 또는 — divider
  divider: {
    textAlign: 'center',
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(45,58,107,0.5)',
    marginVertical: 16,
  },

  // 2x3 grid
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  subCard: {
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  subCardText: {
    alignItems: 'center',
    gap: 2,
  },
  subCardLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 16,
    color: '#1A1A1F',
    fontWeight: '500',
    textAlign: 'center',
  },
  subCardSub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8E93',
    fontWeight: '400',
    textAlign: 'center',
  },
});
