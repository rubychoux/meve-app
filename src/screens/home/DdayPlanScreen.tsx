// MEVE-244 — Event-specific D-day prep checklist screen.
// Reads eventType + eventDate from beautyProfileStore, walks through the
// event's plan phases (from EVENT_CONFIG), and persists checked items
// per event in AsyncStorage.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import {
  getEventConfig,
  phaseStatus,
  type PhaseStatus,
} from '../../constants/eventConfig';

type Nav = NativeStackNavigationProp<MainStackParamList, 'DdayPlan'>;

export function DdayPlanScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();
  const eventConfig = getEventConfig(profile.eventType);

  const daysLeft = useMemo(() => {
    if (!profile.eventDate) return null;
    return Math.max(
      0,
      Math.ceil((new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000)
    );
  }, [profile.eventDate]);

  const eventKey = profile.eventType ?? 'none';
  const storageKey = `meve_dday_plan_checks_${eventKey}`;

  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCheckedItems(parsed);
      } catch {}
    });
  }, [storageKey]);

  const toggleCheck = useCallback(
    (key: string) => {
      setCheckedItems((prev) => {
        const next = prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key];
        AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [storageKey]
  );

  if (!eventConfig) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>준비 플랜</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>설정된 이벤트가 없어요</Text>
          <Text style={styles.emptySubtitle}>
            홈에서 이벤트를 설정하면{'\n'}맞춤 플랜을 보여드려요
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => navigation.navigate('EventFlow')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyCtaText}>이벤트 설정하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalItems = eventConfig.plan.reduce(
    (sum, phase) => sum + phase.items.length,
    0
  );
  const checkedCount = checkedItems.length;
  const progressPct =
    totalItems === 0 ? 0 : Math.round((checkedCount / totalItems) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {eventConfig.emoji} {eventConfig.label} 준비 플랜
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero gradient banner */}
        <LinearGradient
          colors={
            eventConfig.theme.gradientColors as unknown as readonly [
              string,
              string,
              ...string[],
            ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <Text style={styles.heroEmoji}>{eventConfig.emoji}</Text>
          <Text
            style={[styles.heroTitle, { color: eventConfig.theme.badgeText }]}
          >
            {daysLeft != null
              ? `${eventConfig.label}까지 D-${daysLeft}`
              : `${eventConfig.label} 준비 중`}
          </Text>
          <Text style={styles.heroSubtitle}>단계별 가이드</Text>
        </LinearGradient>

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              전체 {totalItems}개 중 {checkedCount}개 완료
            </Text>
            <Text
              style={[
                styles.progressPct,
                { color: eventConfig.theme.primary },
              ]}
            >
              {progressPct}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: eventConfig.theme.primary,
                },
              ]}
            />
          </View>
        </View>

        {/* Plan phases */}
        {eventConfig.plan.map((phase, i) => {
          const status: PhaseStatus =
            daysLeft != null
              ? phaseStatus(phase.daysBeforeLabel, daysLeft)
              : 'informational';
          const isCurrent = status === 'current';
          const isPast = status === 'past';

          return (
            <View
              key={i}
              style={[
                styles.phaseCard,
                isCurrent && {
                  borderLeftWidth: 3,
                  borderLeftColor: eventConfig.theme.primary,
                  backgroundColor: eventConfig.theme.secondary,
                },
                isPast && styles.phaseCardPast,
              ]}
            >
              <View style={styles.phaseHeader}>
                <View
                  style={[
                    styles.phaseDot,
                    isCurrent && { backgroundColor: eventConfig.theme.primary },
                    isPast && { backgroundColor: '#7CB798' },
                  ]}
                />
                <Text style={styles.phaseDaysLabel}>{phase.daysBeforeLabel}</Text>
                {isCurrent && (
                  <View
                    style={[
                      styles.currentBadge,
                      { backgroundColor: eventConfig.theme.primary },
                    ]}
                  >
                    <Text style={styles.currentBadgeText}>지금 여기!</Text>
                  </View>
                )}
                {isPast && <Text style={styles.pastLabel}>✅ 완료 구간</Text>}
              </View>

              <Text style={styles.phaseTitle}>{phase.title}</Text>

              {phase.items.map((item, j) => {
                const key = `${eventKey}_${i}_${j}`;
                const isChecked = checkedItems.includes(key);
                return (
                  <TouchableOpacity
                    key={j}
                    style={styles.checkItem}
                    onPress={() => toggleCheck(key)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isChecked && {
                          backgroundColor: eventConfig.theme.primary,
                          borderColor: eventConfig.theme.primary,
                        },
                      ]}
                    >
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.checkItemText,
                        isChecked && styles.checkItemTextDone,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* Treatment timing */}
        <View style={styles.treatmentSection}>
          <Text style={styles.treatmentSectionTitle}>시술 타이밍 가이드 💉</Text>
          {eventConfig.treatmentTiming.map((t, i) => (
            <View
              key={i}
              style={[
                styles.treatmentRow,
                i < eventConfig.treatmentTiming.length - 1 && styles.treatmentRowDivider,
              ]}
            >
              <View
                style={[
                  styles.treatmentRangePill,
                  { backgroundColor: eventConfig.theme.badgeBackground },
                ]}
              >
                <Text
                  style={[
                    styles.treatmentRangeText,
                    { color: eventConfig.theme.badgeText },
                  ]}
                >
                  {t.daysRange}
                </Text>
              </View>
              <View style={styles.treatmentContent}>
                <Text style={styles.treatmentName}>{t.treatment}</Text>
                <Text style={styles.treatmentReason}>{t.reason}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.treatmentCta,
              { backgroundColor: eventConfig.theme.primary },
            ]}
            onPress={() =>
              navigation.navigate('TreatmentRecommend', { mode: 'skin' })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.treatmentCtaText}>
              AI 맞춤 시술 추천 받기 →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFBFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
    textAlign: 'center',
  },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  // Hero banner
  heroBanner: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroSubtitle: { fontSize: 13, color: '#5A5A7A' },

  // Progress
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { fontSize: 13, color: '#5A5A7A', fontWeight: '600' },
  progressPct: { fontSize: 14, fontWeight: '800' },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },

  // Phase card
  phaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  phaseCardPast: { opacity: 0.6 },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C0C0CC',
  },
  phaseDaysLabel: { fontSize: 12, color: '#8A8A9A', fontWeight: '700', flex: 1 },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 50,
  },
  currentBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  pastLabel: { fontSize: 11, color: '#7CB798', fontWeight: '700' },
  phaseTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
  },

  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C0C0CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  checkItemText: { flex: 1, fontSize: 13, color: '#1A1A2E', lineHeight: 19 },
  checkItemTextDone: {
    color: '#8A8A9A',
    textDecorationLine: 'line-through',
  },

  // Treatment section
  treatmentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  treatmentSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  treatmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  treatmentRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  treatmentRangePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  treatmentRangeText: { fontSize: 11, fontWeight: '800' },
  treatmentContent: { flex: 1, gap: 2 },
  treatmentName: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  treatmentReason: { fontSize: 12, color: '#5A5A7A', lineHeight: 17 },
  treatmentCta: {
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  treatmentCtaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyCta: {
    backgroundColor: '#FF6B9D',
    borderRadius: 50,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
