// MEVE-256 — Single-screen event setter (chip + date + preview). Used by
// the home D-day pill and the my-page event-change button. The legacy
// EventFlow modal (EventSelect → EventSetup) still exists; this screen is
// the new lighter entry point.
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { getEventEmoji } from '../../utils/eventLens';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'EventSetting'>;

const EVENT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '💍 웨딩', value: '웨딩' },
  { label: '🎓 졸업', value: '졸업' },
  { label: '✈️ 여행', value: '여행' },
  { label: '💕 데이트', value: '데이트' },
  { label: '📸 화보/촬영', value: '화보' },
  { label: '🎂 생일', value: '생일' },
  { label: '🏢 면접/입사', value: '면접' },
  { label: '🌟 직접 입력', value: 'custom' },
];

const DEFAULT_OFFSET_MS = 30 * 86_400_000;

export function EventSettingScreen() {
  const navigation = useNavigation<Nav>();
  const eventType = useBeautyProfile((s) => s.eventType);
  const eventDate = useBeautyProfile((s) => s.eventDate);
  const updateProfile = useBeautyProfile((s) => s.updateProfile);

  const presetMatch = EVENT_OPTIONS.find((o) => o.value === eventType);

  const [selectedEvent, setSelectedEvent] = useState<string | null>(
    eventType ? (presetMatch ? presetMatch.value : 'custom') : null
  );
  const [customEvent, setCustomEvent] = useState(
    eventType && !presetMatch ? eventType : ''
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    eventDate ? new Date(eventDate) : new Date(Date.now() + DEFAULT_OFFSET_MS)
  );

  const resolvedEventType =
    selectedEvent === 'custom' ? customEvent.trim() : selectedEvent ?? '';

  const handleSave = async () => {
    if (!resolvedEventType) {
      Alert.alert('이벤트를 선택해주세요');
      return;
    }
    try {
      await updateProfile({
        eventType: resolvedEventType,
        eventDate: selectedDate.toISOString().split('T')[0],
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '저장에 실패했어요');
    }
  };

  const handleNoEvent = async () => {
    try {
      await updateProfile({ eventType: null, eventDate: null });
    } catch {}
    navigation.goBack();
  };

  const daysLeft = Math.max(
    0,
    Math.ceil((selectedDate.getTime() - Date.now()) / 86_400_000)
  );
  const previewLabel = resolvedEventType || '이벤트';
  const cannotSave =
    !selectedEvent || (selectedEvent === 'custom' && !customEvent.trim());

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>특별한 날 설정</Text>
        <TouchableOpacity onPress={handleNoEvent} hitSlop={8}>
          <Text style={styles.skipBtn}>건너뛰기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>어떤 특별한 날을 준비하고 있나요?</Text>
        <Text style={styles.sub}>
          이벤트를 설정하면 모든 기능이{'\n'}그 날을 위한 맞춤 모드로 바뀌어요
        </Text>

        <View style={styles.eventGrid}>
          {EVENT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.eventChip,
                selectedEvent === opt.value && styles.eventChipActive,
              ]}
              onPress={() => setSelectedEvent(opt.value)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.eventChipText,
                  selectedEvent === opt.value && styles.eventChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedEvent === 'custom' && (
          <TextInput
            style={styles.customInput}
            placeholder="이벤트 이름을 입력해줘요 (예: 학회 발표)"
            placeholderTextColor="#C0C0CC"
            value={customEvent}
            onChangeText={setCustomEvent}
          />
        )}

        {selectedEvent && (
          <>
            <Text style={styles.dateLabel}>언제예요?</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.datePickerEmoji}>
                {getEventEmoji(resolvedEventType)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.datePickerText}>
                  {selectedDate.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.datePickerSub}>D-{daysLeft}</Text>
              </View>
              <Text style={styles.datePickerArrow}>›</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )}

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>이렇게 바뀌어요</Text>
              <Text style={styles.previewItem}>
                {getEventEmoji(resolvedEventType)} 홈탭 → "{previewLabel}까지 D-
                {daysLeft}"
              </Text>
              <Text style={styles.previewItem}>
                💙 피부 스캔 → "{previewLabel}을 위한 피부 분석"
              </Text>
              <Text style={styles.previewItem}>
                💕 메이크업 진단 → "{previewLabel}식 화장 연습"
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {selectedEvent && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.ctaBtn, cannotSave && styles.ctaBtnDisabled]}
            onPress={handleSave}
            disabled={cannotSave}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>
              {getEventEmoji(resolvedEventType)} 이걸로 설정하기
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF5F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: { fontSize: 22, color: '#1A1A1F', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1F' },
  skipBtn: { fontSize: 14, color: '#8A8A9A' },
  content: { padding: 20, paddingBottom: 140 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1F',
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: '#8A8A9A',
    lineHeight: 20,
    marginBottom: 28,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  eventChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  eventChipActive: { borderColor: '#2D3A6B', backgroundColor: '#E8F4FD' },
  eventChipText: { fontSize: 14, color: '#5A5A7A', fontWeight: '500' },
  eventChipTextActive: { color: '#1A1A1F', fontWeight: '700' },
  customInput: {
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1A1A1F',
    marginBottom: 24,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 10,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
    marginBottom: 16,
  },
  datePickerEmoji: { fontSize: 28 },
  datePickerText: { fontSize: 15, fontWeight: '600', color: '#1A1A1F' },
  datePickerSub: {
    fontSize: 12,
    color: '#2D3A6B',
    fontWeight: '600',
    marginTop: 2,
  },
  datePickerArrow: { fontSize: 20, color: '#C0C0CC' },
  previewCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 14,
    padding: 16,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D3A6B',
    marginBottom: 10,
  },
  previewItem: {
    fontSize: 13,
    color: '#5A5A7A',
    marginBottom: 6,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FBF5F6',
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,31,0.06)',
  },
  ctaBtn: {
    backgroundColor: '#2D3A6B',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: '#C0C0CC' },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
