// MEVE-202 — Short post-auth onboarding so a new user reaches the first scan
// in under a minute. Two steps total: skin type → optional event. Both steps
// can be skipped. On complete, sets meve_onboarding_done and flips the auth
// store flag, which RootNavigator reads to swap from this screen to MainTabs.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MEVE_GRADIENT_SIMPLE } from '../../constants/theme';

const PINK = '#FF6B9D';

const SKIN_TYPES: { key: string; emoji: string; label: string }[] = [
  { key: '건성', emoji: '🌵', label: '건성' },
  { key: '지성', emoji: '💧', label: '지성' },
  { key: '복합성', emoji: '☯️', label: '복합성' },
  { key: '민감성', emoji: '🌸', label: '민감성' },
];

const EVENTS: { key: string; emoji: string; label: string }[] = [
  { key: 'wedding', emoji: '💍', label: '웨딩' },
  { key: 'date', emoji: '💕', label: '데이트' },
  { key: 'graduation', emoji: '🎓', label: '졸업' },
  { key: 'travel', emoji: '✈️', label: '여행' },
  { key: 'shoot', emoji: '📸', label: '촬영' },
];

export function BeautyOnboardingScreen() {
  const setBeautyOnboardingDone = useAuthStore((s) => s.setBeautyOnboardingDone);
  const setEvent = useAuthStore((s) => s.setEvent);
  const updateProfile = useBeautyProfile((s) => s.updateProfile);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 1. Save skin type to profile (store + Supabase via store side effect)
      if (selectedSkin) {
        await updateProfile({ skinType: selectedSkin });
      }

      // 2. Save event if any — beautyProfileStore.updateProfile pushes to
      //    AsyncStorage AND Supabase, so all subscribed screens re-render.
      if (selectedEvent) {
        const dateStr = eventDate ? eventDate.toISOString() : '';
        setEvent(selectedEvent, dateStr, []);
        await updateProfile({ eventType: selectedEvent, eventDate: dateStr });
      }

      // 3. Mark onboarding done
      await AsyncStorage.setItem('meve_onboarding_done', 'true');

      // 4. Flip the gate flag so RootNavigator swaps to MainStack
      setBeautyOnboardingDone(true);
    } catch (e) {
      console.warn('[BeautyOnboarding] finish error:', e);
      // Even on error, unblock the user
      setBeautyOnboardingDone(true);
    }
  };

  const onPickSkin = (val: string) => {
    setSelectedSkin(val);
    setStep(2);
  };

  const onPickEvent = (val: string) => {
    setSelectedEvent((prev) => (prev === val ? null : val));
  };

  const handleSkipSkin = () => {
    setSelectedSkin(null);
    setStep(2);
  };

  const handleSkipEvent = () => {
    setSelectedEvent(null);
    setEventDate(null);
    finish();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.progressRow}>
        <View style={[styles.dot, step >= 1 && styles.dotActive]} />
        <View style={[styles.dot, step >= 2 && styles.dotActive]} />
      </View>

      <View style={styles.body}>
        {step === 1 ? (
          <>
            <Text style={styles.title}>내 피부 타입을 알려주세요</Text>
            <Text style={styles.subtitle}>탭하면 다음 단계로 넘어가요</Text>

            <View style={styles.skinGrid}>
              {SKIN_TYPES.map((s) => {
                const active = selectedSkin === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.skinCard, active && styles.skinCardActive]}
                    onPress={() => onPickSkin(s.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.skinEmoji}>{s.emoji}</Text>
                    <Text style={[styles.skinLabel, active && styles.skinLabelActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={handleSkipSkin} hitSlop={12} style={styles.skipLink}>
              <Text style={styles.skipLinkText}>잘 모르겠어요 →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>특별한 날이 있나요?</Text>
            <Text style={styles.subtitle}>없으면 건너뛰어도 괜찮아요</Text>

            <View style={styles.eventRow}>
              {EVENTS.map((e) => {
                const active = selectedEvent === e.key;
                return (
                  <TouchableOpacity
                    key={e.key}
                    style={[styles.eventPill, active && styles.eventPillActive]}
                    onPress={() => onPickEvent(e.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.eventEmoji}>{e.emoji}</Text>
                    <Text style={[styles.eventLabel, active && styles.eventLabelActive]}>
                      {e.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedEvent && (
              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>언제예요?</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateBtnText}>
                    {eventDate
                      ? `${eventDate.getFullYear()}.${eventDate.getMonth() + 1}.${eventDate.getDate()}`
                      : '날짜 선택하기'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={eventDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(_, d) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (d) setEventDate(d);
                    }}
                  />
                )}
                <TouchableOpacity
                  style={styles.doneBtnShadow}
                  onPress={finish}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={MEVE_GRADIENT_SIMPLE.colors}
                    start={MEVE_GRADIENT_SIMPLE.start}
                    end={MEVE_GRADIENT_SIMPLE.end}
                    style={styles.doneBtn}
                  >
                    <Text style={styles.doneBtnText}>완료</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {!selectedEvent && (
              <TouchableOpacity
                style={styles.skipBigBtn}
                onPress={handleSkipEvent}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={styles.skipBigBtnText}>없어요, 바로 시작할게요 →</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF7FB' },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F0E6EC',
  },
  dotActive: { backgroundColor: PINK },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  skinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  skinCard: {
    width: '48%',
    aspectRatio: 1.05,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#F0E6EC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  skinCardActive: { borderColor: PINK, backgroundColor: '#FFF5F9' },
  skinEmoji: { fontSize: 40 },
  skinLabel: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  skinLabelActive: { color: PINK },

  skipLink: { alignSelf: 'center', marginTop: 24 },
  skipLinkText: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },

  eventRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 24,
  },
  eventPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#F0E6EC',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventPillActive: { borderColor: PINK, backgroundColor: '#FFF5F9' },
  eventEmoji: { fontSize: 16 },
  eventLabel: { fontSize: 13, fontWeight: '600', color: '#2D2D2D' },
  eventLabelActive: { color: PINK },

  dateBlock: { marginTop: 8, gap: 12 },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#5C525B' },
  dateBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#F0E6EC',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dateBtnText: { fontSize: 14, color: '#2D2D2D', fontWeight: '600' },
  doneBtnShadow: {
    borderRadius: 50,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  doneBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  skipBigBtn: {
    marginTop: 16,
    backgroundColor: PINK,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  skipBigBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
