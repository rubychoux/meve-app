/**
 * LookScreen — v3 tab structure: dedicated LOOK tab.
 *
 * Content extracted from the previous "나" tab (ScanScreen.tsx) LOOK-mode branch.
 * - ModeToggle removed.
 * - Header "LOOK".
 * - All navigation calls, eventLens helpers, and profile reads preserved.
 *
 * Previous LookScreen content kept as LookScreen.backup.tsx.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList, MainTabParamList } from '../../types';
import { TopBar } from '../../components/common/TopBar';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Look'>,
  NativeStackNavigationProp<MainStackParamList>
>;

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

interface MenuItemProps {
  icon: string;
  title: string;
  sub?: string;
  onPress: () => void;
  badge?: string;
  highlight?: boolean;
}

function MenuItem({ icon, title, sub, onPress, badge, highlight }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, highlight && styles.menuItemHighlight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuItemIcon}>{icon}</Text>
      <View style={styles.menuItemContent}>
        <Text
          style={[styles.menuItemTitle, highlight && { color: '#FFFFFF' }]}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            style={[
              styles.menuItemSub,
              highlight && { color: 'rgba(255,255,255,0.85)' },
            ]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <Text
          style={[
            styles.menuItemBadge,
            highlight && { color: '#FFFFFF' },
          ]}
        >
          {badge}
        </Text>
      ) : (
        <Text
          style={[
            styles.menuItemArrow,
            highlight && { color: 'rgba(255,255,255,0.85)' },
          ]}
        >
          ›
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function LookScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();

  const goCoachTab = () => navigation.navigate('Scan');

  const daysLeft = profile.eventDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopBar />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>LOOK</Text>

        {/* Makeup diagnosis (Vision) is the LOOK headline section. */}
        <SectionHeader title="🪞 메이크업 진단" />
        <MenuItem
          icon="💄"
          title="내 화장 진단받기"
          sub={
            profile.eventType && daysLeft != null
              ? `${profile.eventType}식 화장 미리 연습해봐요`
              : '"묘하게 이상한 이유"를 찾아드려요'
          }
          onPress={() => navigation.navigate('MakeupDiagnosis')}
          highlight
        />
        <MenuItem
          icon="🎯"
          title="원하는 느낌이 안 나와요"
          sub="원하는 느낌 vs 현재 비교 분석"
          onPress={() => navigation.navigate('MakeupDiagnosis')}
        />
        <MenuItem
          icon="🎨"
          title="내 색조가 안 어울려요"
          sub="퍼스널컬러 기반 색조 미스매치 진단"
          onPress={() => navigation.navigate('MakeupDiagnosis')}
        />

        <SectionHeader title="✨ 얼굴 분석" />
        <MenuItem
          icon="🪞"
          title="AI 얼굴 분석"
          sub="퍼스널컬러 · 얼굴형 · 눈매 분석 (민낯)"
          onPress={() => navigation.navigate('FaceAnalysis')}
          highlight
        />
        <MenuItem
          icon="💄"
          title="컬러 매치"
          sub="테스터 찍으면 어울리는지 알려드려요"
          onPress={() => navigation.navigate('ColorMatch')}
        />
        <MenuItem
          icon="🖼️"
          title="인스포 룩 분석"
          sub="핀터레스트 사진으로 메이크업 찾기"
          onPress={() => navigation.navigate('InspoLook')}
        />

        <SectionHeader title="💄 내 뷰티" />
        <MenuItem
          icon="🎨"
          title="퍼스널컬러 팔레트"
          sub={profile.personalColor ?? '아직 분석 전이에요'}
          onPress={() => navigation.navigate('Look')}
        />
        <MenuItem
          icon="✨"
          title="추구미 무드보드"
          sub={profile.vibe ?? '추구미를 설정해봐요'}
          onPress={() => navigation.navigate('Look')}
        />
        <MenuItem
          icon="💅"
          title="오늘의 룩"
          sub={
            profile.eventType && daysLeft != null
              ? `${profile.eventType}에 어울리는 룩 추천`
              : '퍼스널컬러 · 추구미 기반 추천'
          }
          onPress={() => navigation.navigate('TodaysLook')}
        />

        <SectionHeader title="🎨 스타일 플랜" />
        <MenuItem
          icon="👩‍⚕️"
          title="AI 시술 추천"
          sub="얼굴형·퍼스널컬러 기반 시술 가이드"
          onPress={() =>
            navigation.navigate('TreatmentRecommend', { mode: 'look' })
          }
        />

        <TouchableOpacity
          style={[styles.coachBanner, styles.coachBannerLook]}
          onPress={goCoachTab}
          activeOpacity={0.85}
        >
          <Text style={[styles.coachBannerText, { color: '#FF6B9D' }]}>
            💕 AI 스타일 코치에게 물어보기 →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF5F6' },
  container: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 120 },
  header: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: '#1A1A1F',
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 8,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  menuItemHighlight: {
    backgroundColor: '#5C2C3F',
  },
  menuItemIcon: { fontSize: 22, marginRight: 12 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1F' },
  menuItemSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  menuItemArrow: { fontSize: 20, color: '#C0C0CC' },
  menuItemBadge: { fontSize: 15, fontWeight: '700', color: '#5C2C3F' },
  coachBanner: {
    backgroundColor: '#E8F4FD',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  coachBannerLook: { backgroundColor: '#FFF0F5' },
  coachBannerText: { fontSize: 14, fontWeight: '600', color: '#2D3A6B' },
});
