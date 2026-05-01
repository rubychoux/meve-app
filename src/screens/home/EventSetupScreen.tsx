import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EventStackParamList } from '../../types';
import { EVENT_CONFIG, EventKey } from '../../constants/events';
import { useAuthStore } from '../../store';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

type Nav = NativeStackNavigationProp<EventStackParamList, 'EventSetup'>;
type Route = RouteProp<EventStackParamList, 'EventSetup'>;

function formatDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function EventSetupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { eventType } = route.params;
  const { height } = useWindowDimensions();

  const config = EVENT_CONFIG[eventType as EventKey];
  const { setEvent } = useAuthStore();
  const updateProfile = useBeautyProfile((s) => s.updateProfile);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  const handleStart = async () => {
    const dateStr = selectedDate?.toISOString() ?? '';
    const directions = config.careDirections.map((d) => d.title);

    try {
      await AsyncStorage.multiSet([
        ['meve_event_type', eventType],
        ['meve_event_date', dateStr],
        ['meve_care_direction', JSON.stringify(directions)],
      ]);
    } catch {}

    // MEVE — push event into beautyProfileStore so all subscribed screens
    // (Home, Skin, Look, eve, DdayPlan) re-render immediately.
    await updateProfile({ eventType, eventDate: dateStr });

    setEvent(eventType, dateStr, directions);
    // Dismiss entire modal stack (EventStackNavigator) back to MainTabs
    navigation.getParent()?.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 상단 히어로 영역 */}
        <View style={[styles.hero, { backgroundColor: config.themeColor, minHeight: height * 0.38 }]}>
          {/* 닫기 버튼 */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <Ionicons
            name={(eventType === 'wedding' ? 'diamond-outline' :
                   eventType === 'date' ? 'heart-outline' :
                   eventType === 'graduation' ? 'school-outline' :
                   'airplane-outline') as keyof typeof Ionicons.glyphMap}
            size={56}
            color={config.accentColor}
          />
          <Text style={styles.heroGreeting}>{config.greeting}</Text>
          <Text style={styles.heroSubtitle}>{config.subtitle}</Text>
        </View>

        {/* 미들 — 날짜 & 케어 방향 */}
        <View style={styles.body}>

          {/* 날짜 선택 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{config.dateQuestion}</Text>
            <TouchableOpacity
              style={[styles.dateTrigger, { borderColor: config.accentColor }]}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color={config.accentColor} />
              <Text style={[styles.dateTriggerText, { color: selectedDate ? Colors.textPrimary : Colors.textSecondary }]}>
                {selectedDate ? formatDate(selectedDate) : '날짜를 선택해주세요'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={selectedDate ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={onDateChange}
            />
          )}

          {/* 케어 방향 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>meve가 이렇게 도와드릴게요</Text>
            <View style={styles.careCards}>
              {config.careDirections.map((dir, i) => (
                <View key={i} style={styles.careCard}>
                  <View style={[styles.careIconWrap, { backgroundColor: config.themeColor }]}>
                    <Ionicons
                      name={dir.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={config.accentColor}
                    />
                  </View>
                  <View style={styles.careText}>
                    <Text style={styles.careTitle}>{dir.title}</Text>
                    <Text style={styles.careDesc}>{dir.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 하단 CTA */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: config.accentColor }]}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>시작할게요!</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },

  // 히어로
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 64, marginBottom: Spacing.sm },
  heroGreeting: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  heroSubtitle: { ...Typography.bodySecondary, textAlign: 'center', lineHeight: 22 },

  // 바디
  body: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },

  section: { gap: Spacing.md },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // 날짜 트리거
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  dateTriggerText: { flex: 1, fontSize: 15, fontWeight: '500' },

  // 케어 카드
  careCards: { gap: Spacing.sm },
  careCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  careIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careText: { flex: 1, gap: 2 },
  careTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  careDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // CTA
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ctaBtn: {
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: Colors.surface },
});
