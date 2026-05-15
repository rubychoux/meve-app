import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'GlamSyncCreate'>;

const PINK = '#FF6B9D';

function glamLabel(level: number): string {
  if (level <= 2) return '쌩얼 🌿';
  if (level <= 4) return '선크림 + 립 💋';
  if (level <= 6) return '세미 메이크업 ✨';
  if (level <= 8) return '풀메이크업 💄';
  return '풀메 + 풀세팅 👑';
}

function glamColor(level: number): string {
  if (level <= 2) return '#85C1AE';
  if (level <= 4) return '#F5C97A';
  if (level <= 6) return '#FF9F7F';
  if (level <= 8) return '#FF6B9D';
  return '#B8A0E0';
}

function makeInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function formatDateTime(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export function GlamSyncCreateScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');

  // Step 2
  const [level, setLevel] = useState<number>(5);
  const [creating, setCreating] = useState(false);

  const handleNext = () => {
    if (eventName.trim().length === 0) {
      Alert.alert('이벤트 이름', '이벤트 이름을 입력해주세요.');
      return;
    }
    if (!eventDate) {
      Alert.alert('날짜', '이벤트 날짜를 선택해주세요.');
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const inviteCode = makeInviteCode();
      const { data: sync, error } = await supabase
        .from('glam_syncs')
        .insert({
          host_id: user.id,
          event_name: eventName.trim(),
          event_date: eventDate?.toISOString() ?? null,
          invite_code: inviteCode,
        })
        .select('*')
        .single();
      if (error) throw error;

      const { error: memberErr } = await supabase
        .from('glam_sync_members')
        .insert({
          sync_id: sync.id,
          user_id: user.id,
          proposed_level: level,
        });
      if (memberErr) throw memberErr;

      navigation.replace('GlamSyncDetail', { syncId: sync.id });
    } catch (e: any) {
      Alert.alert('생성 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 1 ? '이벤트 정보' : '내 꾸밈 정도'}
        </Text>
        <Text style={styles.headerStep}>{step}/2</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 ? (
          <>
            <Text style={styles.label}>이벤트 이름</Text>
            <TextInput
              style={styles.input}
              value={eventName}
              onChangeText={setEventName}
              placeholder="예: 토요일 홍대 브런치"
              placeholderTextColor="#B8AFB5"
              maxLength={40}
            />

            <Text style={styles.label}>날짜</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setDatePickerMode('date');
                setShowDatePicker(true);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.inputText, !eventDate && styles.inputPlaceholder]}>
                {eventDate ? formatDateTime(eventDate) : '날짜와 시간을 선택해주세요'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={eventDate ?? new Date()}
                mode={datePickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_e, d) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (d) {
                    if (datePickerMode === 'date') {
                      setEventDate(d);
                      if (Platform.OS !== 'ios') {
                        setDatePickerMode('time');
                        setShowDatePicker(true);
                      }
                    } else {
                      setEventDate(d);
                    }
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  if (datePickerMode === 'date') {
                    setDatePickerMode('time');
                  } else {
                    setShowDatePicker(false);
                  }
                }}
              >
                <Text style={styles.doneBtnText}>
                  {datePickerMode === 'date' ? '다음 (시간)' : '완료'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>다음</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>내 꾸밈 정도를 선택해요</Text>
            <View style={[styles.levelPreview, { backgroundColor: glamColor(level) + '22' }]}>
              <Text style={[styles.levelNum, { color: glamColor(level) }]}>{level}/10</Text>
              <Text style={styles.levelLabel}>{glamLabel(level)}</Text>
            </View>

            <View style={styles.levelRow}>
              {Array.from({ length: 11 }, (_, i) => i).map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setLevel(i)}
                  style={[
                    styles.levelDot,
                    {
                      backgroundColor: i === level ? glamColor(i) : '#fff',
                      borderColor: i === level ? glamColor(i) : '#E2D5DC',
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.levelDotText,
                      { color: i === level ? '#fff' : '#9A8F97' },
                    ]}
                  >
                    {i}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, creating && { opacity: 0.65 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>글램 싱크 만들기</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1F' },
  headerStep: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },

  content: { padding: 20, paddingBottom: 60 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1F',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E6EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#1A1A1F',
    justifyContent: 'center',
    minHeight: 48,
  },
  inputText: { fontSize: 14, color: '#1A1A1F' },
  inputPlaceholder: { color: '#B8AFB5' },
  doneBtn: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8 },
  doneBtnText: { color: PINK, fontWeight: '600', fontSize: 14 },

  levelPreview: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    marginBottom: 14,
  },
  levelNum: { fontSize: 34, fontWeight: '800' },
  levelLabel: { fontSize: 14, color: '#1A1A1F', fontWeight: '600' },

  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  levelDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelDotText: { fontSize: 12, fontWeight: '700' },

  primaryBtn: {
    marginTop: 20,
    backgroundColor: PINK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
