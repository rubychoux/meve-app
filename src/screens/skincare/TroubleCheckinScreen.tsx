// MEVE-250 — Trouble check-in. Multi-step (3 or 5 steps depending on status)
// + free-text. GPT parses the free text into structured tags / metadata that
// downstream pattern detection can mine once enough days are logged.
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { fetchOpenAIWithTimeout, cleanJson } from '../../utils/openai';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'TroubleCheckin'>;

type SkinStatus = 'good' | 'normal' | 'bad' | 'breakout';

const SYMPTOM_OPTIONS = ['뾰루지', '가려움', '붉어짐', '건조', '번들거림', '각질'];

const ONSET_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '오늘', value: 'today' },
  { label: '2-3일 전', value: '2-3days' },
  { label: '1주일 전', value: '1week' },
  { label: '그 이상', value: 'more' },
];

const TRIGGER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '새 제품 사용', value: '새제품' },
  { label: '자극적인 음식', value: '자극음식' },
  { label: '수면 부족', value: '수면부족' },
  { label: '스트레스 심함', value: '스트레스' },
  { label: '생리 전후', value: '생리전후' },
  { label: '야외 활동 많음', value: '야외활동' },
  { label: '운동 안함', value: '운동안함' },
  { label: '환경 변화', value: '환경변화' },
  { label: '수분 부족', value: '수분부족' },
];

const STATUS_OPTIONS: Array<{ label: string; value: SkinStatus; color: string }> = [
  { label: '😌 좋음', value: 'good', color: '#7CB798' },
  { label: '😐 보통', value: 'normal', color: '#F0A500' },
  { label: '😟 안좋음', value: 'bad', color: '#FF8C69' },
  { label: '🔴 뒤집어짐', value: 'breakout', color: '#FF4444' },
];

interface ParsedFreeText {
  additional_triggers?: string[];
  food_mentions?: string[];
  product_mentions?: string[];
  duration_info?: string;
  body_area?: string[];
  additional_tags?: string[];
  summary?: string;
}

export function TroubleCheckinScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState(1);
  const [skinStatus, setSkinStatus] = useState<SkinStatus | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [onset, setOnset] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [loading, setLoading] = useState(false);

  const isMild = skinStatus === 'good' || skinStatus === 'normal';
  const totalSteps = isMild ? 3 : 5;

  const toggleItem = (
    item: string,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const parseWithGPT = async (): Promise<{
    tags: string[];
    data: ParsedFreeText;
  }> => {
    if (!freeText.trim()) return { tags: [], data: {} };

    const prompt = `유저가 피부 트러블에 대해 자유롭게 쓴 텍스트야:
"${freeText}"

이미 선택된 트리거: ${triggers.join(', ')}
이미 선택된 증상: ${symptoms.join(', ')}

텍스트에서 추가로 언급된 정보를 추출해줘.
반드시 JSON만 반환. 설명 없이.

{
  "additional_triggers": ["추가로 발견된 트리거들 (한국어)"],
  "food_mentions": ["언급된 음식들"],
  "product_mentions": ["언급된 제품명들"],
  "duration_info": "기간 관련 언급",
  "body_area": ["언급된 부위 (예: 턱, 이마, 볼)"],
  "additional_tags": ["#태그1", "#태그2"],
  "summary": "한 줄 요약 (20자 이내)"
}`;

    try {
      const res = await fetchOpenAIWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        15_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      const content: string = data.choices?.[0]?.message?.content ?? '';
      const parsed: ParsedFreeText = JSON.parse(cleanJson(content));
      const allTags = [
        ...(parsed.food_mentions ?? []).map((f) => `#${f}`),
        ...(parsed.product_mentions ?? []).map((p) => `#신규제품_${p}`),
        ...(parsed.additional_tags ?? []),
      ];
      return { tags: allTags, data: parsed };
    } catch {
      return { tags: [], data: {} };
    }
  };

  const handleSubmit = async () => {
    if (!skinStatus) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const { tags: parsedTags, data: parsedData } = await parseWithGPT();

      const allTags = [
        ...triggers.map((t) => `#${t}`),
        ...symptoms.map((s) => `#${s}`),
        ...parsedTags,
      ];

      const { error } = await supabase.from('trouble_logs').insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        skin_status: skinStatus,
        symptoms,
        onset,
        triggers,
        free_text: freeText,
        parsed_tags: allTags,
        parsed_data: parsedData,
      });

      if (error) throw error;

      Alert.alert(
        '기록 완료! 💙',
        '트러블 기록이 저장됐어요.',
        [
          {
            text: 'AI 원인 분석 보기',
            onPress: () => {
              navigation.goBack();
              setTimeout(() => navigation.navigate('TroubleAnalysis'), 300);
            },
          },
          { text: '확인', onPress: () => navigation.goBack() },
        ]
      );
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '저장에 실패했어요');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return !!skinStatus;
    if (step === 2) return isMild || symptoms.length > 0;
    if (step === 3) return isMild || !!onset;
    return true;
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>오늘 피부 어때요?</Text>
      <Text style={styles.stepSub}>솔직하게 선택해줘요</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.statusCard,
              skinStatus === opt.value && {
                borderColor: opt.color,
                backgroundColor: opt.color + '15',
              },
            ]}
            onPress={() => setSkinStatus(opt.value)}
            activeOpacity={0.85}
          >
            <Text style={styles.statusLabel}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTriggersStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {isMild ? '오늘 특별한 일이 있었나요?' : '혹시 이런 거 있었나요?'}
      </Text>
      <Text style={styles.stepSub}>
        {isMild ? '피부에 영향을 줄 수 있는 것들' : '피부 트러블 원인이 될 수 있어요'}
      </Text>
      <View style={styles.chipGrid}>
        {TRIGGER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, triggers.includes(opt.value) && styles.chipActive]}
            onPress={() => toggleItem(opt.value, triggers, setTriggers)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.chipText,
                triggers.includes(opt.value) && styles.chipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* MEVE-252 — quick path to start tracking the new product */}
      {triggers.includes('새제품') && (
        <TouchableOpacity
          style={styles.productTrackingHint}
          onPress={() =>
            navigation.navigate('ProductTracking', { mode: 'start' })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.productTrackingHintText}>
            💡 어떤 제품인지 추적 시작하기 →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSymptomsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>어떤 증상이에요?</Text>
      <Text style={styles.stepSub}>해당되는 거 모두 선택해줘요</Text>
      <View style={styles.chipGrid}>
        {SYMPTOM_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, symptoms.includes(s) && styles.chipActiveDanger]}
            onPress={() => toggleItem(s, symptoms, setSymptoms)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.chipText,
                symptoms.includes(s) && styles.chipTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderOnsetStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>언제부터예요?</Text>
      <View style={styles.onsetList}>
        {ONSET_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.onsetItem, onset === opt.value && styles.onsetItemActive]}
            onPress={() => setOnset(opt.value)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.onsetText,
                onset === opt.value && styles.onsetTextActive,
              ]}
            >
              {opt.label}
            </Text>
            {onset === opt.value && <Text style={styles.onsetCheck}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFreeTextStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>더 하고 싶은 말이 있으면요 ✍️</Text>
      <Text style={styles.stepSub}>AI가 읽고 분석해줄게요. 자유롭게 써도 돼요</Text>
      <TextInput
        style={styles.freeTextInput}
        multiline
        numberOfLines={6}
        placeholder={
          '예) 어제 마라탕 먹었고 요즘 잠을 3-4시간밖에 못 자고 있어요.\n새로 산 라운드랩 세럼 쓰기 시작한지 3일 됐는데\n턱이랑 볼 쪽에 뾰루지가 많이 났어요...'
        }
        placeholderTextColor="#C0C0CC"
        value={freeText}
        onChangeText={setFreeText}
        textAlignVertical="top"
      />
      <Text style={styles.freeTextHint}>
        💡 제품명, 음식, 기간, 부위 등 구체적으로 쓸수록 정확한 분석을 받을 수 있어요
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    if (isMild) {
      if (step === 1) return renderStep1();
      if (step === 2) return renderTriggersStep();
      if (step === 3) return renderFreeTextStep();
    } else {
      if (step === 1) return renderStep1();
      if (step === 2) return renderSymptomsStep();
      if (step === 3) return renderOnsetStep();
      if (step === 4) return renderTriggersStep();
      if (step === 5) return renderFreeTextStep();
    }
    return null;
  };

  const isLastStep = step === totalSteps;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((s) => s - 1) : navigation.goBack())}
          hitSlop={8}
        >
          <Text style={styles.backBtn}>{step > 1 ? '←' : '✕'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>오늘의 피부 기록</Text>
        <Text style={styles.stepIndicator}>
          {step}/{totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(step / totalSteps) * 100}%` },
          ]}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.bottomBar}>
        {isLastStep ? (
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              (!canProceed() || loading) && styles.ctaBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || !canProceed()}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaBtnText}>AI 분석 저장하기 💙</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaBtn, !canProceed() && styles.ctaBtnDisabled]}
            onPress={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>다음 →</Text>
          </TouchableOpacity>
        )}
        {!isLastStep && (
          <TouchableOpacity
            onPress={() => setStep((s) => s + 1)}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>건너뛰기</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: { fontSize: 22, color: '#1A1A2E', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  stepIndicator: {
    fontSize: 14,
    color: '#8A8A9A',
    width: 32,
    textAlign: 'right',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#F0F0F5',
    marginHorizontal: 20,
    borderRadius: 2,
  },
  progressFill: {
    height: 3,
    backgroundColor: '#5BA3D9',
    borderRadius: 2,
  },
  content: { flex: 1 },
  stepContainer: { padding: 24, paddingTop: 32 },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  stepSub: { fontSize: 14, color: '#8A8A9A', marginBottom: 24 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statusCard: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statusLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { borderColor: '#5BA3D9', backgroundColor: '#E8F4FD' },
  chipActiveDanger: { borderColor: '#FF6B6B', backgroundColor: '#FFF0F0' },
  chipText: { fontSize: 14, color: '#5A5A7A', fontWeight: '500' },
  chipTextActive: { color: '#1A1A2E', fontWeight: '700' },
  onsetList: { gap: 10 },
  onsetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  onsetItemActive: { borderColor: '#5BA3D9', backgroundColor: '#E8F4FD' },
  onsetText: { fontSize: 15, color: '#5A5A7A', fontWeight: '500' },
  onsetTextActive: { color: '#1A1A2E', fontWeight: '700' },
  onsetCheck: { fontSize: 16, color: '#5BA3D9' },
  freeTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    padding: 16,
    fontSize: 15,
    color: '#1A1A2E',
    lineHeight: 24,
    minHeight: 160,
  },
  freeTextHint: {
    fontSize: 12,
    color: '#8A8A9A',
    marginTop: 12,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FAFBFC',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  ctaBtn: {
    backgroundColor: '#5BA3D9',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: '#C0C0CC' },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  skipBtn: { alignItems: 'center', paddingTop: 12 },
  skipText: { fontSize: 14, color: '#8A8A9A' },

  // MEVE-252 — product-tracking hint shown when '새제품' trigger is active
  productTrackingHint: {
    marginTop: 12,
    backgroundColor: '#E8F4FD',
    borderRadius: 10,
    padding: 12,
  },
  productTrackingHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5BA3D9',
  },
});
