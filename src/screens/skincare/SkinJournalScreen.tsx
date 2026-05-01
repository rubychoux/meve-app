// MEVE-242 — Skin Journey Tracking. Three tabs: 오늘 기록 / 변화 그래프 / 히스토리.
// Reads/writes daily_skin_checkins, treatment_records, daily_logs, skin_scans.
// Uploads photos to skin-photos bucket scoped by uid.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList, ScanAnalysisResult } from '../../types';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import {
  cleanJson,
  fetchOpenAIWithTimeout,
  friendlyAIErrorMessage,
} from '../../utils/openai';

type Nav = NativeStackNavigationProp<MainStackParamList, 'SkinJournal'>;

const SKY = '#5BA3D9';
const PINK = '#FF6B9D';
const GREEN = '#7CB798';
const PURPLE = '#9B59B6';
const RED = '#FF6B6B';

type TabKey = 'today' | 'graph' | 'history';

const EMOJIS = ['😫', '😕', '😐', '🙂', '😊'];

const QUICK_TREATMENTS = [
  '레이저토닝',
  '물광주사',
  '리쥬란',
  '보톡스',
  '필러',
  '기타',
];

interface RoutineStep {
  step: number;
  category: string;
  product: string;
}

interface GeneratedRoutine {
  am?: RoutineStep[];
  pm?: RoutineStep[];
}

interface TodayCheckin {
  id?: string;
  date: string;
  hydration_score: number | null;
  trouble_score: number | null;
  glow_score: number | null;
  photo_url: string | null;
  products_used: string[];
}

interface TreatmentRow {
  id: string;
  treatment_name: string;
  treatment_date: string;
  clinic_name: string | null;
  memo: string | null;
  skin_score_before: number | null;
}

interface ScanRow {
  id: string;
  created_at: string;
  scan_result: ScanAnalysisResult;
}

interface DailyLog {
  id?: string;
  date: string;
  sleep_hours: number | null;
  water_intake: number | null;
  stress_level: number | null;
  diet_tags: string[] | null;
}

interface AIInsight {
  trend: '상승' | '하락' | '유지';
  trendScore: number;
  bestPeriod: string;
  insight1: string;
  insight2: string;
  recommendation: string;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function extractScore(scan: ScanAnalysisResult | null | undefined): number | null {
  if (!scan) return null;
  const s = scan.overallScore;
  return typeof s === 'number' ? s : null;
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export function SkinJournalScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<TabKey>('today');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 피부 여정 📊</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabRow}>
        {(
          [
            { key: 'today' as TabKey, label: '오늘 기록' },
            { key: 'graph' as TabKey, label: '변화 그래프' },
            { key: 'history' as TabKey, label: '히스토리' },
          ]
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'today' && <TodayLogTab />}
      {tab === 'graph' && <ProgressGraphTab />}
      {tab === 'history' && <HistoryTab />}
    </SafeAreaView>
  );
}

// ─── TAB 1 — TODAY LOG ──────────────────────────────────────────────────────

function TodayLogTab() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();
  const today = todayString();

  const [checkin, setCheckin] = useState<TodayCheckin>({
    date: today,
    hydration_score: null,
    trouble_score: null,
    glow_score: null,
    photo_url: null,
    products_used: [],
  });
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [recentTreatments, setRecentTreatments] = useState<TreatmentRow[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showLifestyleModal, setShowLifestyleModal] = useState(false);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Today's checkin
      const { data: checkinRow } = await supabase
        .from('daily_skin_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      if (checkinRow) {
        setCheckin({
          id: checkinRow.id,
          date: checkinRow.date,
          hydration_score: checkinRow.hydration_score,
          trouble_score: checkinRow.trouble_score,
          glow_score: checkinRow.glow_score,
          photo_url: checkinRow.photo_url,
          products_used: Array.isArray(checkinRow.products_used)
            ? checkinRow.products_used
            : [],
        });
      }

      // Recent treatments (last 5)
      const { data: tRows } = await supabase
        .from('treatment_records')
        .select('*')
        .eq('user_id', user.id)
        .order('treatment_date', { ascending: false })
        .limit(5);
      if (tRows) setRecentTreatments(tRows as TreatmentRow[]);

      // Today's lifestyle log
      const { data: logRow } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      if (logRow) setDailyLog(logRow as DailyLog);

      // Last scan date (for the scan card state)
      const lastScanRaw = await AsyncStorage.getItem('meve_last_scan_date');
      if (lastScanRaw) setLastScanDate(lastScanRaw.slice(0, 10));

      // Routine for product checks
      const routineRaw = await AsyncStorage.getItem('meve_routine');
      if (routineRaw) {
        try {
          setRoutine(JSON.parse(routineRaw));
        } catch {}
      }
    } catch (e) {
      console.warn('[TodayLogTab] load error:', e);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const upsertCheckin = async (patch: Partial<TodayCheckin>) => {
    const next = { ...checkin, ...patch, date: today };
    setCheckin(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error, data } = await supabase
        .from('daily_skin_checkins')
        .upsert(
          {
            user_id: user.id,
            date: next.date,
            hydration_score: next.hydration_score,
            trouble_score: next.trouble_score,
            glow_score: next.glow_score,
            photo_url: next.photo_url,
            products_used: next.products_used,
          },
          { onConflict: 'user_id,date' }
        )
        .select('id')
        .single();
      if (error) throw error;
      if (data?.id && !next.id) {
        setCheckin((c) => ({ ...c, id: data.id as string }));
      }
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const handleSaveCheckin = async () => {
    if (savingCheckin) return;
    setSavingCheckin(true);
    try {
      await upsertCheckin({});
      Alert.alert('저장 완료', '오늘 체크가 저장됐어요 ✨');
    } finally {
      setSavingCheckin(false);
    }
  };

  const toggleProductCheck = async (product: string) => {
    const checked = checkin.products_used.includes(product);
    const nextList = checked
      ? checkin.products_used.filter((p) => p !== product)
      : [...checkin.products_used, product];
    await upsertCheckin({ products_used: nextList });
  };

  const pickAndUploadPhoto = async () => {
    if (uploadingPhoto) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const path = `${user.id}/${today}.jpg`;
      const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from('skin-photos')
        .upload(path, byteArray, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage
        .from('skin-photos')
        .getPublicUrl(path);
      const photoUrl = pub.publicUrl;

      await upsertCheckin({ photo_url: photoUrl });
    } catch (e: any) {
      Alert.alert('업로드 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddTreatment = async (t: {
    name: string;
    date: string;
    clinic: string;
    memo: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');
      const { error } = await supabase.from('treatment_records').insert({
        user_id: user.id,
        treatment_name: t.name,
        treatment_date: t.date,
        clinic_name: t.clinic || null,
        memo: t.memo || null,
        skin_score_before: profile.lastSkinScore ?? null,
      });
      if (error) throw error;
      Alert.alert('저장 완료', '시술 기록이 저장됐어요 ✨');
      setShowTreatmentModal(false);
      loadAll();
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const handleAddProduct = async (name: string, category: string) => {
    if (!name.trim()) return;
    const nextList = checkin.products_used.includes(name)
      ? checkin.products_used
      : [...checkin.products_used, name];
    await upsertCheckin({ products_used: nextList });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('product_usage_logs').insert({
          user_id: user.id,
          product_name: name,
          category: category || null,
          started_at: today,
        });
      }
    } catch {}
    setShowProductModal(false);
  };

  const handleSaveLifestyle = async (log: {
    sleep_hours: number | null;
    water_intake: number | null;
    stress_level: number | null;
    diet_tags: string[];
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');
      const { error, data } = await supabase
        .from('daily_logs')
        .upsert(
          {
            user_id: user.id,
            date: today,
            sleep_hours: log.sleep_hours,
            water_intake: log.water_intake,
            stress_level: log.stress_level,
            diet_tags: log.diet_tags,
          },
          { onConflict: 'user_id,date' }
        )
        .select('*')
        .single();
      if (error) throw error;
      if (data) setDailyLog(data as DailyLog);
      setShowLifestyleModal(false);
      Alert.alert('저장 완료', '오늘 라이프스타일이 저장됐어요 ✨');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  // Each step gets a unique productKey so AM/PM steps with the same product
  // name don't share check state. Custom products use their bare name.
  const allRoutineSteps: (RoutineStep & { productKey: string; slot: 'am' | 'pm' })[] = [
    ...((routine?.am ?? []).map((s, i) => ({
      ...s,
      slot: 'am' as const,
      productKey: `am_${i}_${s.product}`,
    }))),
    ...((routine?.pm ?? []).map((s, i) => ({
      ...s,
      slot: 'pm' as const,
      productKey: `pm_${i}_${s.product}`,
    }))),
  ];

  const scannedToday = lastScanDate === today;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.dateHeader}>{formatKoreanDate(today)} 기록</Text>

      {/* SECTION 1 — Scan card */}
      <TouchableOpacity
        style={styles.scanEntryCard}
        onPress={() => navigation.navigate('FaceScanner' as never)}
        activeOpacity={0.85}
      >
        {scannedToday && profile.lastSkinScore != null ? (
          <View style={styles.scanDoneRow}>
            <Text style={styles.scanDoneIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanDoneTitle}>오늘 스캔 완료</Text>
              <Text style={styles.scanDoneScore}>
                스킨 스코어 {profile.lastSkinScore}점
              </Text>
            </View>
            <Text style={styles.scanViewBtn}>결과 보기 →</Text>
          </View>
        ) : (
          <View style={styles.scanPromptRow}>
            <Text style={styles.scanPromptIcon}>📸</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanPromptTitle}>오늘 피부 스캔하기</Text>
              <Text style={styles.scanPromptSub}>
                매일 같은 조건으로 찍으면 비교가 정확해요
              </Text>
            </View>
            <Text style={styles.scanArrow}>→</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* SECTION 2 — Self check */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘 피부 자가 체크</Text>
        <CheckRow
          label="수분"
          value={checkin.hydration_score}
          onChange={(v) => upsertCheckin({ hydration_score: v })}
        />
        <CheckRow
          label="트러블"
          value={checkin.trouble_score}
          onChange={(v) => upsertCheckin({ trouble_score: v })}
        />
        <CheckRow
          label="광채"
          value={checkin.glow_score}
          onChange={(v) => upsertCheckin({ glow_score: v })}
        />

        <TouchableOpacity
          style={styles.saveCheckinBtn}
          onPress={handleSaveCheckin}
          disabled={savingCheckin}
          activeOpacity={0.85}
        >
          {savingCheckin ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveCheckinBtnText}>오늘 체크 저장하기</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* SECTION 3 — Products checkboxes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘 쓴 제품 체크</Text>
        {allRoutineSteps.length === 0 ? (
          <Text style={styles.emptyHint}>
            아직 등록된 루틴이 없어요. 제품을 직접 추가해봐요.
          </Text>
        ) : (
          allRoutineSteps.map((s) => {
            const checked = checkin.products_used.includes(s.productKey);
            return (
              <TouchableOpacity
                key={s.productKey}
                style={styles.productCheckRow}
                onPress={() => toggleProductCheck(s.productKey)}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.checkbox, checked && styles.checkboxChecked]}
                >
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.productName} numberOfLines={1}>
                  {s.product}
                </Text>
                <Text style={styles.productCategory}>
                  {s.slot.toUpperCase()} · {s.category}
                </Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* Custom products user added today (not matching any routine key) */}
        {checkin.products_used
          .filter((p) => !allRoutineSteps.some((s) => s.productKey === p))
          .map((p, i) => (
            <TouchableOpacity
              key={`custom-${p}-${i}`}
              style={styles.productCheckRow}
              onPress={() => toggleProductCheck(p)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, styles.checkboxChecked]}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <Text style={styles.productName} numberOfLines={1}>
                {p}
              </Text>
              <Text style={styles.productCategory}>직접 추가</Text>
            </TouchableOpacity>
          ))}

        <TouchableOpacity
          onPress={() => setShowProductModal(true)}
          style={styles.addProductBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.addProductBtnText}>+ 제품 추가하기</Text>
        </TouchableOpacity>
      </View>

      {/* SECTION 4 — Treatments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 시술 기록</Text>
        {recentTreatments.length === 0 ? (
          <Text style={styles.emptyHint}>아직 시술 기록이 없어요</Text>
        ) : (
          recentTreatments.map((t) => (
            <View key={t.id} style={styles.treatmentChip}>
              <Text style={styles.treatmentChipText}>💉 {t.treatment_name}</Text>
              <Text style={styles.treatmentChipDate}>
                {formatShort(t.treatment_date)}
              </Text>
            </View>
          ))
        )}
        <TouchableOpacity
          style={styles.addTreatmentBtn}
          onPress={() => setShowTreatmentModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addTreatmentBtnText}>+ 시술 기록 추가</Text>
        </TouchableOpacity>
      </View>

      {/* SECTION 5 — Lifestyle */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘의 라이프스타일</Text>
        {dailyLog ? (
          <View style={styles.lifestyleSummary}>
            {dailyLog.sleep_hours != null && (
              <Text style={styles.lifestyleSummaryText}>
                💤 수면 {dailyLog.sleep_hours}시간
              </Text>
            )}
            {dailyLog.water_intake != null && (
              <Text style={styles.lifestyleSummaryText}>
                💧 물 {dailyLog.water_intake}컵
              </Text>
            )}
            {dailyLog.stress_level != null && (
              <Text style={styles.lifestyleSummaryText}>
                😤 스트레스 {dailyLog.stress_level}/5
              </Text>
            )}
            {dailyLog.diet_tags && dailyLog.diet_tags.length > 0 && (
              <Text style={styles.lifestyleSummaryText}>
                🥗 {dailyLog.diet_tags.join(', ')}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyHint}>오늘 라이프스타일을 기록해 봐요</Text>
        )}
        <TouchableOpacity
          style={styles.lifestyleBtn}
          onPress={() => setShowLifestyleModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.lifestyleBtnText}>
            {dailyLog ? '라이프스타일 수정' : '+ 라이프스타일 기록'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SECTION 6 — Photo */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘의 사진</Text>
        <TouchableOpacity
          style={styles.photoCard}
          onPress={pickAndUploadPhoto}
          activeOpacity={0.85}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? (
            <View style={styles.photoPlaceholder}>
              <ActivityIndicator color={SKY} />
              <Text style={styles.photoPlaceholderText}>업로드 중...</Text>
            </View>
          ) : checkin.photo_url ? (
            <Image
              source={{ uri: checkin.photo_url }}
              style={styles.photoPreview}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>오늘 피부 사진 찍기</Text>
              <Text style={styles.photoPlaceholderSub}>
                같은 조명, 같은 각도로 찍어요
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Modals */}
      <TreatmentModal
        visible={showTreatmentModal}
        onClose={() => setShowTreatmentModal(false)}
        onSave={handleAddTreatment}
      />
      <AddProductModal
        visible={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSave={handleAddProduct}
      />
      <LifestyleModal
        visible={showLifestyleModal}
        initial={dailyLog}
        onClose={() => setShowLifestyleModal(false)}
        onSave={handleSaveLifestyle}
      />
    </ScrollView>
  );
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.checkRow}>
      <Text style={styles.checkLabel}>{label}</Text>
      <View style={styles.emojiRow}>
        {[1, 2, 3, 4, 5].map((v) => {
          const active = value === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onChange(v)}
              style={[styles.emojiBtn, active && styles.emojiBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiText}>{EMOJIS[v - 1]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── TREATMENT MODAL ────────────────────────────────────────────────────────

function TreatmentModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (t: { name: string; date: string; clinic: string; memo: string }) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [clinic, setClinic] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setDate(new Date());
      setShowDate(false);
      setClinic('');
      setMemo('');
    }
  }, [visible]);

  const submit = () => {
    if (!name.trim()) {
      Alert.alert('시술명 필요', '시술명을 입력해주세요.');
      return;
    }
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    onSave({ name: name.trim(), date: dateStr, clinic: clinic.trim(), memo: memo.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>시술 기록 추가</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={styles.fieldLabel}>시술명</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="레이저토닝, 물광주사 등"
              placeholderTextColor="#C0C0CC"
            />

            <View style={styles.quickRow}>
              {QUICK_TREATMENTS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.quickChip, name === q && styles.quickChipActive]}
                  onPress={() => setName(q)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      name === q && styles.quickChipTextActive,
                    ]}
                  >
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>시술 날짜</Text>
            <TouchableOpacity
              style={styles.fieldInput}
              onPress={() => setShowDate(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.fieldInputText}>
                {date.getFullYear()}.{date.getMonth() + 1}.{date.getDate()}
              </Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowDate(false);
                  if (d) setDate(d);
                }}
              />
            )}

            <Text style={styles.fieldLabel}>병원 (선택)</Text>
            <TextInput
              style={styles.fieldInput}
              value={clinic}
              onChangeText={setClinic}
              placeholder="병원 이름"
              placeholderTextColor="#C0C0CC"
            />

            <Text style={styles.fieldLabel}>메모 (선택)</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 60, textAlignVertical: 'top' }]}
              value={memo}
              onChangeText={setMemo}
              placeholder="시술 후 느낀 점, 부작용 등"
              placeholderTextColor="#C0C0CC"
              multiline
            />

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={submit}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveBtnText}>저장하기</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ADD PRODUCT MODAL ──────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = ['클렌저', '토너', '세럼', '크림', '선크림', '기타'];

function AddProductModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, category: string) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('기타');

  useEffect(() => {
    if (visible) {
      setName('');
      setCategory('기타');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>제품 추가</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <Text style={styles.fieldLabel}>제품명</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="예: 닥터지 레드블레미쉬 크림"
              placeholderTextColor="#C0C0CC"
            />

            <Text style={styles.fieldLabel}>카테고리</Text>
            <View style={styles.quickRow}>
              {PRODUCT_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.quickChip, category === c && styles.quickChipActive]}
                  onPress={() => setCategory(c)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      category === c && styles.quickChipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => {
                if (!name.trim()) {
                  Alert.alert('제품명 필요', '제품명을 입력해주세요.');
                  return;
                }
                onSave(name.trim(), category);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveBtnText}>추가하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── LIFESTYLE MODAL ────────────────────────────────────────────────────────

const DIET_TAGS = ['고당', '유제품', '글루텐', '음주', '건강식'];

function LifestyleModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: DailyLog | null;
  onClose: () => void;
  onSave: (log: {
    sleep_hours: number | null;
    water_intake: number | null;
    stress_level: number | null;
    diet_tags: string[];
  }) => void;
}) {
  const [sleep, setSleep] = useState<string>('');
  const [water, setWater] = useState<string>('');
  const [stress, setStress] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSleep(initial?.sleep_hours != null ? String(initial.sleep_hours) : '');
      setWater(initial?.water_intake != null ? String(initial.water_intake) : '');
      setStress(initial?.stress_level ?? null);
      setTags(initial?.diet_tags ?? []);
    }
  }, [visible, initial]);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>오늘 라이프스타일</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={styles.fieldLabel}>💤 수면 시간</Text>
            <TextInput
              style={styles.fieldInput}
              value={sleep}
              onChangeText={setSleep}
              placeholder="예: 7"
              keyboardType="numeric"
              placeholderTextColor="#C0C0CC"
            />

            <Text style={styles.fieldLabel}>💧 물 섭취 (컵)</Text>
            <TextInput
              style={styles.fieldInput}
              value={water}
              onChangeText={setWater}
              placeholder="예: 8"
              keyboardType="numeric"
              placeholderTextColor="#C0C0CC"
            />

            <Text style={styles.fieldLabel}>😤 스트레스 (1~5)</Text>
            <View style={styles.quickRow}>
              {[1, 2, 3, 4, 5].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.quickChip, stress === v && styles.quickChipActive]}
                  onPress={() => setStress(v)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      stress === v && styles.quickChipTextActive,
                    ]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>🥗 식단 태그</Text>
            <View style={styles.quickRow}>
              {DIET_TAGS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.quickChip, tags.includes(t) && styles.quickChipActive]}
                  onPress={() => toggleTag(t)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      tags.includes(t) && styles.quickChipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => {
                const sNum = sleep.trim() ? parseFloat(sleep.trim()) : null;
                const wNum = water.trim() ? parseInt(water.trim(), 10) : null;
                onSave({
                  sleep_hours: sNum != null && !isNaN(sNum) ? sNum : null,
                  water_intake: wNum != null && !isNaN(wNum) ? wNum : null,
                  stress_level: stress,
                  diet_tags: tags,
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveBtnText}>저장하기</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── TAB 2 — PROGRESS GRAPH ─────────────────────────────────────────────────

interface ScorePoint {
  date: string;
  score: number;
}

type GraphPeriod = 30 | 90 | 9999;

function ProgressGraphTab() {
  const profile = useBeautyProfile();
  const { width: winWidth } = useWindowDimensions();

  const [period, setPeriod] = useState<GraphPeriod>(30);
  const [scores, setScores] = useState<ScorePoint[]>([]);
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const daysLeft = useMemo(() => {
    if (!profile.eventDate) return null;
    return Math.max(
      0,
      Math.ceil((new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000)
    );
  }, [profile.eventDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setScores([]);
        setTreatments([]);
        return;
      }

      // Skin scores
      let scanQuery = supabase
        .from('skin_scans')
        .select('id, created_at, scan_result')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (period !== 9999) {
        const cutoff = new Date(Date.now() - period * 86_400_000).toISOString();
        scanQuery = scanQuery.gte('created_at', cutoff);
      }
      const { data: scanData } = await scanQuery;
      const points: ScorePoint[] = ((scanData ?? []) as ScanRow[])
        .map((r) => ({
          date: r.created_at,
          score: extractScore(r.scan_result) ?? 0,
        }))
        .filter((p) => p.score > 0);
      setScores(points);

      // Treatments in period
      let tQuery = supabase
        .from('treatment_records')
        .select('*')
        .eq('user_id', user.id)
        .order('treatment_date', { ascending: true });
      if (period !== 9999) {
        const cutoffDate = new Date(Date.now() - period * 86_400_000)
          .toISOString()
          .slice(0, 10);
        tQuery = tQuery.gte('treatment_date', cutoffDate);
      }
      const { data: tData } = await tQuery;
      setTreatments((tData ?? []) as TreatmentRow[]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const generateInsight = async () => {
    if (insightLoading || scores.length < 2) return;
    setInsightLoading(true);
    try {
      const prompt = `피부 스코어 데이터를 분석해서 인사이트를 제공해줘.

스코어 히스토리: ${JSON.stringify(scores.map((p) => ({ date: p.date.slice(0, 10), score: p.score })))}
시술 기록: ${JSON.stringify(treatments.map((t) => ({ name: t.treatment_name, date: t.treatment_date })))}

Return ONLY valid JSON (no markdown):
{
  "trend": "상승" or "하락" or "유지",
  "trendScore": (last score - first score, integer),
  "bestPeriod": "가장 피부가 좋았던 기간 한 줄 설명 (해요체)",
  "insight1": "데이터 기반 인사이트 1줄 (해요체)",
  "insight2": "데이터 기반 인사이트 1줄 (해요체)",
  "recommendation": "앞으로 추천 행동 1줄 (해요체)"
}`;
      const res = await fetchOpenAIWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 800,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      const content: string = data.choices?.[0]?.message?.content ?? '';
      setInsight(JSON.parse(cleanJson(content)) as AIInsight);
    } catch (e) {
      Alert.alert('AI 분석 실패', friendlyAIErrorMessage(e));
    } finally {
      setInsightLoading(false);
    }
  };

  // Auto-generate insight when scores load
  useEffect(() => {
    if (scores.length >= 2 && !insight && !insightLoading) {
      generateInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  const graphWidth = winWidth - 32;
  const graphHeight = 220;
  const padding = 24;

  // Map scores to graph coordinates
  const points = scores.length > 0 ? scores.map((s, i) => {
    const x =
      scores.length === 1
        ? graphWidth / 2
        : (i / (scores.length - 1)) * (graphWidth - padding * 2) + padding;
    const y =
      graphHeight - padding - (s.score / 100) * (graphHeight - padding * 2);
    return { x, y, score: s.score, date: s.date };
  }) : [];
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Treatment marker positions (mapped onto graph by date)
  const treatmentMarkers =
    points.length >= 2
      ? treatments
          .map((t) => {
            const tDate = new Date(t.treatment_date).getTime();
            const startDate = new Date(scores[0].date).getTime();
            const endDate = new Date(scores[scores.length - 1].date).getTime();
            if (endDate <= startDate) return null;
            const ratio = (tDate - startDate) / (endDate - startDate);
            if (ratio < 0 || ratio > 1) return null;
            const x = ratio * (graphWidth - padding * 2) + padding;
            return { x, name: t.treatment_name };
          })
          .filter((m): m is { x: number; name: string } => m !== null)
      : [];

  // D-day timeline progress
  let timelineFirstScore: number | null = null;
  let timelineProgress = 0;
  if (profile.eventDate && scores.length > 0) {
    timelineFirstScore = scores[0].score;
    const total = new Date(profile.eventDate).getTime() - new Date(scores[0].date).getTime();
    const elapsed = Date.now() - new Date(scores[0].date).getTime();
    if (total > 0) {
      timelineProgress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    }
  }
  const lastSkinScore = profile.lastSkinScore;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Period selector */}
      <View style={styles.periodRow}>
        {[
          { v: 30 as GraphPeriod, label: '30일' },
          { v: 90 as GraphPeriod, label: '90일' },
          { v: 9999 as GraphPeriod, label: '전체' },
        ].map((p) => (
          <TouchableOpacity
            key={p.v}
            onPress={() => setPeriod(p.v)}
            style={[styles.periodPill, period === p.v && styles.periodPillActive]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.periodPillText,
                period === p.v && styles.periodPillTextActive,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Graph card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>스킨 스코어 변화</Text>

        {loading ? (
          <View style={styles.graphEmpty}>
            <ActivityIndicator color={SKY} />
          </View>
        ) : points.length === 0 ? (
          <View style={styles.graphEmpty}>
            <Text style={styles.emptyHint}>아직 스캔 기록이 없어요</Text>
          </View>
        ) : (
          <View>
            <Svg width={graphWidth} height={graphHeight}>
              {[25, 50, 75, 100].map((y) => {
                const yCoord =
                  graphHeight - padding - (y / 100) * (graphHeight - padding * 2);
                return (
                  <React.Fragment key={y}>
                    <Line
                      x1={padding}
                      y1={yCoord}
                      x2={graphWidth - padding}
                      y2={yCoord}
                      stroke="#F0F0F0"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={padding - 4}
                      y={yCoord + 4}
                      fontSize={10}
                      fill="#C0C0CC"
                      textAnchor="end"
                    >
                      {y}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Treatment dashed markers */}
              {treatmentMarkers.map((m, i) => (
                <Line
                  key={`t-${i}`}
                  x1={m.x}
                  y1={padding}
                  x2={m.x}
                  y2={graphHeight - padding}
                  stroke={PINK}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.7}
                />
              ))}

              {/* Score line */}
              {points.length > 1 && (
                <Path d={pathD} stroke={SKY} strokeWidth={2.5} fill="none" />
              )}

              {/* Data points */}
              {points.map((p, i) => {
                const isLast = i === points.length - 1;
                return (
                  <Circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={isLast ? 6 : 4}
                    fill={SKY}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                );
              })}
            </Svg>

            {/* Treatment marker labels under graph */}
            {treatmentMarkers.length > 0 && (
              <View style={styles.markerLegend}>
                <Text style={styles.markerLegendText}>💉 시술 기록</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* AI insight */}
      {insightLoading ? (
        <View style={styles.card}>
          <ActivityIndicator color={SKY} />
          <Text style={[styles.emptyHint, { textAlign: 'center', marginTop: 8 }]}>
            AI 가 데이터를 분석하고 있어요...
          </Text>
        </View>
      ) : insight ? (
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>💙 AI 분석</Text>
          <View style={styles.trendRow}>
            <Text style={styles.trendScore}>
              {insight.trendScore > 0 ? '+' : ''}
              {insight.trendScore}점
            </Text>
            <Text
              style={[
                styles.trendLabel,
                {
                  color:
                    insight.trend === '상승'
                      ? GREEN
                      : insight.trend === '하락'
                        ? RED
                        : '#8A8A9A',
                },
              ]}
            >
              {insight.trend === '상승'
                ? '↑ 좋아지고 있어요!'
                : insight.trend === '하락'
                  ? '↓ 케어가 필요해요'
                  : '→ 유지 중이에요'}
            </Text>
          </View>
          <Text style={styles.insightText}>• {insight.insight1}</Text>
          <Text style={styles.insightText}>• {insight.insight2}</Text>
          <Text style={styles.insightRecommend}>💡 {insight.recommendation}</Text>
        </View>
      ) : scores.length >= 2 ? (
        <TouchableOpacity
          style={styles.insightGenerateBtn}
          onPress={generateInsight}
          activeOpacity={0.85}
        >
          <Text style={styles.insightGenerateBtnText}>💙 AI 분석 받기</Text>
        </TouchableOpacity>
      ) : null}

      {/* D-day timeline */}
      {profile.eventType && daysLeft != null && (
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>
            {profile.eventType}까지 D-{daysLeft} 피부 여정
          </Text>
          <View style={styles.timelineBar}>
            <View
              style={[styles.timelineFill, { width: `${timelineProgress}%` }]}
            />
            <View style={[styles.timelineDot, { left: `${timelineProgress}%` }]} />
          </View>
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabelLeft}>시작</Text>
            <Text style={styles.timelineLabelCenter}>오늘 D-{daysLeft}</Text>
            <Text style={styles.timelineLabelRight}>{profile.eventType} D-day</Text>
          </View>
          <Text style={styles.timelineScore}>
            이벤트 준비 시작 후 스킨 스코어{' '}
            {timelineFirstScore != null && lastSkinScore != null ? (
              <Text style={{ fontWeight: '700' }}>
                {lastSkinScore - timelineFirstScore > 0 ? '+' : ''}
                {lastSkinScore - timelineFirstScore}점 변화
              </Text>
            ) : (
              '추적 중...'
            )}
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── TAB 3 — HISTORY ────────────────────────────────────────────────────────

interface CalendarEvent {
  hasScan: boolean;
  hasTreatment: boolean;
  hasPhoto: boolean;
  hasCheckin: boolean;
}

interface TimelineEntry {
  type: 'scan' | 'treatment' | 'checkin' | 'photo';
  date: string;
  title: string;
  detail: string;
}

function HistoryTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalendarEvent>>({});
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setEventsByDate({});
        setTimeline([]);
        return;
      }

      const [scanRes, treatRes, checkinRes] = await Promise.all([
        supabase
          .from('skin_scans')
          .select('id, created_at, scan_result')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('treatment_records')
          .select('*')
          .eq('user_id', user.id)
          .order('treatment_date', { ascending: false }),
        supabase
          .from('daily_skin_checkins')
          .select('date, hydration_score, trouble_score, glow_score, photo_url')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(100),
      ]);

      const events: Record<string, CalendarEvent> = {};
      const tl: TimelineEntry[] = [];

      for (const r of (scanRes.data ?? []) as ScanRow[]) {
        const k = r.created_at.slice(0, 10);
        if (!events[k]) events[k] = { hasScan: false, hasTreatment: false, hasPhoto: false, hasCheckin: false };
        events[k].hasScan = true;
        const score = extractScore(r.scan_result);
        tl.push({
          type: 'scan',
          date: r.created_at,
          title: '피부 스캔',
          detail: score != null ? `스킨 스코어 ${score}점` : '결과 보기',
        });
      }

      for (const t of (treatRes.data ?? []) as TreatmentRow[]) {
        const k = t.treatment_date.slice(0, 10);
        if (!events[k]) events[k] = { hasScan: false, hasTreatment: false, hasPhoto: false, hasCheckin: false };
        events[k].hasTreatment = true;
        tl.push({
          type: 'treatment',
          date: t.treatment_date,
          title: t.treatment_name,
          detail: [t.clinic_name, t.memo].filter(Boolean).join(' · ') || '시술 기록',
        });
      }

      for (const c of checkinRes.data ?? []) {
        const k = c.date as string;
        if (!events[k]) events[k] = { hasScan: false, hasTreatment: false, hasPhoto: false, hasCheckin: false };
        events[k].hasCheckin = true;
        if (c.photo_url) {
          events[k].hasPhoto = true;
          tl.push({
            type: 'photo',
            date: c.date,
            title: '오늘의 사진',
            detail: '피부 사진 기록',
          });
        }
        const parts: string[] = [];
        if (c.hydration_score) parts.push(`수분 ${c.hydration_score}/5`);
        if (c.trouble_score) parts.push(`트러블 ${c.trouble_score}/5`);
        if (c.glow_score) parts.push(`광채 ${c.glow_score}/5`);
        if (parts.length > 0) {
          tl.push({
            type: 'checkin',
            date: c.date,
            title: '자가 체크',
            detail: parts.join(' · '),
          });
        }
      }

      tl.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEventsByDate(events);
      setTimeline(tl);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const goPrevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Calendar */}
      <View style={[styles.card, styles.calendarCard]}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={goPrevMonth} hitSlop={6}>
            <Ionicons name="chevron-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.calHeaderText}>
            {year}년 {month + 1}월
          </Text>
          <TouchableOpacity onPress={goNextMonth} hitSlop={6}>
            <Ionicons name="chevron-forward" size={20} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.calWeekRow}>
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <Text key={w} style={styles.calWeekText}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.calGrid}>
          {grid.map((d, i) => {
            if (d === null) {
              return <View key={`e-${i}`} style={styles.calCell} />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const ev = eventsByDate[dateStr];
            return (
              <View key={dateStr} style={styles.calCell}>
                <Text style={styles.calDayText}>{d}</Text>
                {ev && (
                  <View style={styles.calDots}>
                    {ev.hasScan && (
                      <View style={[styles.calDot, { backgroundColor: SKY }]} />
                    )}
                    {ev.hasTreatment && (
                      <View style={[styles.calDot, { backgroundColor: PINK }]} />
                    )}
                    {ev.hasCheckin && (
                      <View style={[styles.calDot, { backgroundColor: GREEN }]} />
                    )}
                    {ev.hasPhoto && (
                      <Text style={styles.calPhoto}>📷</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.calLegendRow}>
          <View style={styles.calLegendItem}>
            <View style={[styles.calDot, { backgroundColor: SKY }]} />
            <Text style={styles.calLegendText}>스캔</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calDot, { backgroundColor: PINK }]} />
            <Text style={styles.calLegendText}>시술</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calDot, { backgroundColor: GREEN }]} />
            <Text style={styles.calLegendText}>체크</Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>전체 기록</Text>
        {loading ? (
          <ActivityIndicator color={SKY} />
        ) : timeline.length === 0 ? (
          <Text style={styles.emptyHint}>아직 기록이 없어요</Text>
        ) : (
          timeline.map((e, i) => {
            const color =
              e.type === 'scan'
                ? SKY
                : e.type === 'treatment'
                  ? PINK
                  : e.type === 'checkin'
                    ? GREEN
                    : PURPLE;
            const icon =
              e.type === 'scan'
                ? '📸'
                : e.type === 'treatment'
                  ? '💉'
                  : e.type === 'checkin'
                    ? '✅'
                    : '🖼️';
            return (
              <View
                key={`${e.type}-${e.date}-${i}`}
                style={[styles.timelineItem, { borderLeftColor: color }]}
              >
                <View style={styles.timelineItemHeader}>
                  <Text style={styles.timelineItemIcon}>{icon}</Text>
                  <Text style={styles.timelineItemTitle}>{e.title}</Text>
                  <Text style={styles.timelineItemDate}>{formatShort(e.date)}</Text>
                </View>
                <Text style={styles.timelineItemDetail}>{e.detail}</Text>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFBFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },

  // Top tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: SKY,
    borderColor: SKY,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: '#8A8A9A' },
  tabTextActive: { color: '#FFFFFF' },

  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  dateHeader: {
    fontSize: 14,
    color: '#8A8A9A',
    marginBottom: 4,
    fontWeight: '500',
  },

  // Generic card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 13,
    color: '#8A8A9A',
    paddingVertical: 4,
  },

  // Scan entry card
  scanEntryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 16,
  },
  scanDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanDoneIcon: { fontSize: 28 },
  scanDoneTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  scanDoneScore: { fontSize: 13, color: SKY, fontWeight: '600', marginTop: 2 },
  scanViewBtn: { fontSize: 13, color: SKY, fontWeight: '700' },
  scanPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanPromptIcon: { fontSize: 28 },
  scanPromptTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  scanPromptSub: { fontSize: 12, color: '#5A5A7A', marginTop: 2 },
  scanArrow: { fontSize: 18, color: SKY, fontWeight: '700' },

  // Self check
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  checkLabel: { width: 60, fontSize: 13, color: '#1A1A2E', fontWeight: '600' },
  emojiRow: { flexDirection: 'row', flex: 1, justifyContent: 'space-between' },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FC',
  },
  emojiBtnActive: { backgroundColor: '#FFE0EC' },
  emojiText: { fontSize: 22 },

  saveCheckinBtn: {
    backgroundColor: SKY,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveCheckinBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Product check
  productCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
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
  checkboxChecked: { backgroundColor: SKY, borderColor: SKY },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  productName: { flex: 1, fontSize: 13, color: '#1A1A2E' },
  productCategory: { fontSize: 11, color: '#8A8A9A' },

  addProductBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addProductBtnText: { color: SKY, fontSize: 13, fontWeight: '700' },

  // Treatment list
  treatmentChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  treatmentChipText: { fontSize: 13, color: '#1A1A2E', fontWeight: '600' },
  treatmentChipDate: { fontSize: 11, color: '#8A8A9A' },
  addTreatmentBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addTreatmentBtnText: { color: PINK, fontSize: 13, fontWeight: '700' },

  // Lifestyle
  lifestyleSummary: {
    gap: 4,
  },
  lifestyleSummaryText: { fontSize: 13, color: '#1A1A2E' },
  lifestyleBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  lifestyleBtnText: { color: SKY, fontSize: 13, fontWeight: '700' },

  // Photo
  photoCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8F9FC',
  },
  photoPreview: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
  },
  photoPlaceholderIcon: { fontSize: 36 },
  photoPlaceholderText: { fontSize: 14, color: '#1A1A2E', fontWeight: '700' },
  photoPlaceholderSub: { fontSize: 12, color: '#8A8A9A' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  fieldLabel: { fontSize: 12, color: '#8A8A9A', fontWeight: '600' },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
    backgroundColor: '#FAFBFC',
  },
  fieldInputText: { fontSize: 14, color: '#1A1A2E' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  quickChipActive: { backgroundColor: SKY, borderColor: SKY },
  quickChipText: { fontSize: 12, color: '#5A5A7A', fontWeight: '600' },
  quickChipTextActive: { color: '#FFFFFF' },
  modalSaveBtn: {
    backgroundColor: SKY,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSaveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Period selector
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  periodPillActive: { backgroundColor: SKY, borderColor: SKY },
  periodPillText: { fontSize: 12, color: '#5A5A7A', fontWeight: '700' },
  periodPillTextActive: { color: '#FFFFFF' },

  // Graph
  graphEmpty: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLegend: {
    alignItems: 'center',
    paddingTop: 6,
  },
  markerLegendText: { fontSize: 11, color: '#8A8A9A' },

  // Insight
  insightCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D9ECFB',
  },
  insightTitle: { fontSize: 14, fontWeight: '700', color: SKY },
  trendRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  trendScore: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  trendLabel: { fontSize: 13, fontWeight: '700' },
  insightText: { fontSize: 13, color: '#1A1A2E', lineHeight: 19 },
  insightRecommend: {
    fontSize: 13,
    color: SKY,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 19,
  },
  insightGenerateBtn: {
    backgroundColor: SKY,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  insightGenerateBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // D-day timeline
  timelineCard: {
    backgroundColor: '#FFF0F5',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  timelineBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFE0EC',
    position: 'relative',
    marginTop: 4,
  },
  timelineFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: PINK,
    borderRadius: 4,
  },
  timelineDot: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: PINK,
    marginLeft: -8,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineLabelLeft: { fontSize: 11, color: '#8A8A9A' },
  timelineLabelCenter: { fontSize: 11, color: PINK, fontWeight: '700' },
  timelineLabelRight: { fontSize: 11, color: '#8A8A9A' },
  timelineScore: { fontSize: 13, color: '#1A1A2E', marginTop: 4 },

  // Calendar (MEVE — compact override of shared card style)
  calendarCard: {
    paddingBottom: 12,
    marginBottom: 0,
    gap: 4,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calHeaderText: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  calWeekRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  calWeekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#8A8A9A',
    fontWeight: '600',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    gap: 2,
  },
  calDayText: { fontSize: 12, color: '#1A1A2E', fontWeight: '500' },
  calDots: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    marginTop: 2,
  },
  calDot: { width: 5, height: 5, borderRadius: 2.5 },
  calPhoto: { fontSize: 9 },
  calLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 12,
    paddingBottom: 0,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendText: { fontSize: 11, color: '#8A8A9A' },

  // Timeline list
  timelineItem: {
    paddingVertical: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    marginBottom: 6,
    gap: 4,
  },
  timelineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineItemIcon: { fontSize: 14 },
  timelineItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  timelineItemDate: { fontSize: 11, color: '#8A8A9A' },
  timelineItemDetail: { fontSize: 12, color: '#5A5A7A', lineHeight: 17 },
});
