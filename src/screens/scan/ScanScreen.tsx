// MEVE-253 — "나" tab. Section-based menu hub. Mode-aware (SKIN / LOOK).
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ModeToggle } from '../../components/ui/ModeToggle';
import { useMode } from '../../stores/modeStore';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { getEventContextText, getEventEmoji } from '../../utils/eventLens';
import { MainStackParamList, MainTabParamList } from '../../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Scan'>,
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

export function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const mode = useMode();
  const profile = useBeautyProfile();

  const goMeveTab = () =>
    navigation.navigate('MainTabs', { screen: 'Meve' } as any);

  // MEVE-256 — used for event-aware sub copy on a few menu items.
  const daysLeft = profile.eventDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000
        )
      )
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>나</Text>
        <ModeToggle />

        {mode === 'skin' ? (
          <>
            <SectionHeader title="📸 스캔 & 분석" />
            <MenuItem
              icon="🔬"
              title="AI 피부 스캔"
              sub={getEventContextText(
                '사진 한 장으로 피부를 분석해요',
                profile.eventType,
                daysLeft
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
                daysLeft
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
              icon={
                profile.eventType ? getEventEmoji(profile.eventType) : '📅'
              }
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
                // MEVE-254 — first-time users go straight into the builder.
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
              onPress={goMeveTab}
              activeOpacity={0.85}
            >
              <Text style={styles.coachBannerText}>
                💙 AI 피부 코치에게 물어보기 →
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* MEVE-255 — makeup diagnosis (Vision) is the new LOOK headline. */}
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
              onPress={goMeveTab}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.coachBannerText, { color: '#FF6B9D' }]}
              >
                💕 AI 스타일 코치에게 물어보기 →
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 120 },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
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
    color: '#8A8A9A',
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
    backgroundColor: '#5BA3D9',
  },
  menuItemIcon: { fontSize: 22, marginRight: 12 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  menuItemSub: { fontSize: 12, color: '#8A8A9A', marginTop: 2 },
  menuItemArrow: { fontSize: 20, color: '#C0C0CC' },
  menuItemBadge: { fontSize: 15, fontWeight: '700', color: '#5BA3D9' },
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
  coachBannerText: { fontSize: 14, fontWeight: '600', color: '#5BA3D9' },
});
