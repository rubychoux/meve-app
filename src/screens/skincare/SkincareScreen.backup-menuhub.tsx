/**
 * SkincareScreen — v3 tab structure: dedicated SKIN tab.
 *
 * Content extracted from the previous "나" tab (ScanScreen.tsx) SKIN-mode branch.
 * - ModeToggle removed (SKIN is its own tab now).
 * - Header changed from "나" → "SKIN".
 * - All navigation calls, eventLens helpers, and beauty profile reads preserved.
 *
 * Previous heavy SkincareScreen (routine + ingredient + …) is preserved as
 * SkincareScreen.backup.tsx for reference.
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { getEventContextText, getEventEmoji } from '../../utils/eventLens';
import { MainStackParamList, MainTabParamList } from '../../types';
import { TopBar } from '../../components/common/TopBar';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Skincare'>,
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

export function SkincareScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();

  // Center "스캔" tab now hosts the AI coach (MeveScreen).
  const goCoachTab = () => navigation.navigate('Scan');

  // Event-aware sub copy on a few menu items.
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
        <Text style={styles.header}>SKIN</Text>

        <SectionHeader title="📸 스캔 & 분석" />
        <MenuItem
          icon="🔬"
          title="AI 피부 스캔"
          sub={getEventContextText(
            '사진 한 장으로 피부를 분석해요',
            profile.eventType,
            daysLeft,
          )}
          onPress={() => navigation.navigate('FaceScanner')}
          highlight
        />
        <MenuItem
          icon="🧪"
          title="성분 스캔"
          sub="제품 성분표를 스캔해요"
          onPress={() => navigation.navigate('IngredientScanner')}
        />
        <MenuItem
          icon="🧴"
          title="내 피부 맞춤 성분"
          sub="추천 성분 · 피해야할 성분"
          onPress={() => navigation.navigate('Skincare')}
        />

        <SectionHeader title="📊 내 기록" />
        <MenuItem
          icon="📈"
          title="내 피부 여정"
          sub={getEventContextText(
            '스코어 변화 · 시술 기록 · 제품 기록',
            profile.eventType,
            daysLeft,
          )}
          onPress={() => navigation.navigate('SkinJournal')}
          badge={
            profile.lastSkinScore != null
              ? `${profile.lastSkinScore}점`
              : undefined
          }
        />
        <MenuItem
          icon="⚠️"
          title="트러블 기록"
          sub="피부 뒤집어졌을 때 원인을 찾아봐요"
          onPress={() => navigation.navigate('TroubleCheckin')}
        />
        <MenuItem
          icon="📊"
          title="AI 원인 분석"
          sub="최근 7일 데이터로 트러블 원인 찾기"
          onPress={() => navigation.navigate('TroubleAnalysis')}
        />
        <MenuItem
          icon="🧴"
          title="제품 반응 기록"
          sub="추적 중인 제품 확인하기"
          onPress={() =>
            navigation.navigate('ProductTracking', { mode: 'history' })
          }
        />

        <SectionHeader title="💊 케어 플랜" />
        <MenuItem
          icon={profile.eventType ? getEventEmoji(profile.eventType) : '📅'}
          title={
            profile.eventType
              ? `${profile.eventType} D-day 케어 플랜`
              : 'D-day 케어 플랜'
          }
          sub={
            profile.eventType && daysLeft != null
              ? `${profile.eventType} D-${daysLeft} 단계별 가이드`
              : '특별한 날을 설정하면 맞춤 플랜이 생겨요'
          }
          onPress={() =>
            profile.eventType
              ? navigation.navigate('DdayPlan')
              : navigation.navigate('EventSetting')
          }
        />
        <MenuItem
          icon="👩‍⚕️"
          title="AI 시술 추천"
          sub="얼굴형·퍼스널컬러 기반 시술 가이드"
          onPress={() =>
            navigation.navigate('TreatmentRecommend', { mode: 'skin' })
          }
        />
        <MenuItem
          icon="✨"
          title="내 루틴 관리"
          sub="AM/PM 루틴 보기 · 수정 · 생성"
          onPress={async () => {
            // First-time users go straight into the builder.
            const existing = await AsyncStorage.getItem('meve_routine');
            if (existing) {
              navigation.navigate('Skincare');
            } else {
              navigation.navigate('RoutineBuilder');
            }
          }}
        />
        <MenuItem
          icon="🔄"
          title="루틴 다시 만들기"
          sub="AI가 새 루틴을 추천해드려요"
          onPress={() => navigation.navigate('RoutineBuilder')}
        />

        <TouchableOpacity
          style={styles.coachBanner}
          onPress={goCoachTab}
          activeOpacity={0.85}
        >
          <Text style={styles.coachBannerText}>
            💙 AI 피부 코치에게 물어보기 →
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
    backgroundColor: '#2D3A6B',
  },
  menuItemIcon: { fontSize: 22, marginRight: 12 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1F' },
  menuItemSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  menuItemArrow: { fontSize: 20, color: '#C0C0CC' },
  menuItemBadge: { fontSize: 15, fontWeight: '700', color: '#2D3A6B' },
  coachBanner: {
    backgroundColor: '#E8F4FD',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  coachBannerText: { fontSize: 14, fontWeight: '600', color: '#2D3A6B' },
});
