// MEVE-241 (rewrite) — User-led treatment recommendation flow.
// Step 1: pick what you want help with.
// Step 2: (only when 'concern') pick specific concerns.
// Step 3: AI returns recommendations focused ONLY on what the user chose.
// Philosophy: meve doesn't push beauty standards. Address only what users
// ask about, frame as empowerment, not "fixing flaws".
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types';
import { supabase } from '../../services/supabase';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import {
  cleanJson,
  fetchOpenAIWithTimeout,
  friendlyAIErrorMessage,
} from '../../utils/openai';

type Nav = NativeStackNavigationProp<MainStackParamList, 'TreatmentRecommend'>;
type Rt = RouteProp<MainStackParamList, 'TreatmentRecommend'>;

const PINK = '#FF6B9D';
const SKY = '#5BA3D9';

type TreatmentMode = 'concern' | 'general' | 'dday' | null;
type Step = 1 | 2 | 3;

interface TreatmentRecommendation {
  name: string;
  targetConcern: string;
  effect: string;
  timing: string;
  sessions: string;
  priceRange: string;
  caution: string;
  priority: number;
}

interface TreatmentResult {
  intro: string;
  recommendations: TreatmentRecommendation[];
  closing: string;
}

interface ConcernOption {
  id: string;
  label: string;
  emoji: string;
}

const CONCERN_OPTIONS: ConcernOption[] = [
  { id: 'texture', label: '피부결 / 모공', emoji: '🔬' },
  { id: 'tone', label: '피부톤 / 칙칙함', emoji: '✨' },
  { id: 'trouble', label: '트러블 / 여드름', emoji: '🔴' },
  { id: 'hydration', label: '수분 / 건조함', emoji: '💧' },
  { id: 'eyes', label: '눈가 / 다크서클', emoji: '👁️' },
  { id: 'lips', label: '입술 / 입꼬리', emoji: '💋' },
  { id: 'jawline', label: '턱선', emoji: '✦' },
  { id: 'forehead', label: '이마 주름', emoji: '〰️' },
  { id: 'lifting', label: '탄력 / 처짐', emoji: '⬆️' },
  { id: 'other', label: '기타', emoji: '💬' },
];

function openClinicMap(treatmentName: string) {
  const query = `${treatmentName} 피부과 강남`;
  const naverApp = `nmap://search?query=${encodeURIComponent(query)}&appname=com.meve.app`;
  const naverWeb = `https://map.naver.com/v5/search/${encodeURIComponent(`${treatmentName} 피부과`)}`;
  Linking.openURL(naverApp).catch(() => Linking.openURL(naverWeb));
}

export function TreatmentRecommendScreen() {
  const navigation = useNavigation<Nav>();
  // Route param kept for backward-compat; the new flow is user-led.
  useRoute<Rt>();
  const profile = useBeautyProfile();

  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<TreatmentMode>(null);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [otherConcern, setOtherConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TreatmentResult | null>(null);

  // MEVE — pull actual scan + face analysis from Supabase for richer prompts.
  // skin_scans stores the result as a JSON blob; face_analysis has flat columns.
  const [latestScanDetail, setLatestScanDetail] = useState<{
    overall_score: number | null;
    zone_scores: unknown;
    concerns: unknown;
    recommendations: unknown;
    created_at: string | null;
  } | null>(null);
  const [latestFaceAnalysis, setLatestFaceAnalysis] = useState<{
    personal_color: string | null;
    face_shape: string | null;
    eye_shape: string | null;
    skin_tone: string | null;
    user_confirmed: boolean | null;
    created_at: string | null;
  } | null>(null);
  const [scanFetching, setScanFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Latest skin scan — extract from scan_result JSON
        const { data: scanRow } = await supabase
          .from('skin_scans')
          .select('scan_result, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && scanRow?.scan_result) {
          const r = scanRow.scan_result as Record<string, unknown>;
          setLatestScanDetail({
            overall_score: typeof r.overallScore === 'number' ? r.overallScore : null,
            zone_scores: r.zones ?? null,
            concerns: r.concerns ?? null,
            recommendations: r.recommendations ?? r.routineAdvice ?? null,
            created_at: scanRow.created_at,
          });
        }

        // Latest face analysis
        const { data: faceRow } = await supabase
          .from('face_analysis')
          .select('personal_color, face_shape, eye_shape, skin_tone, user_confirmed, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && faceRow) {
          setLatestFaceAnalysis(faceRow);
        }
      } catch {
        // Silent — fall back to base profile context.
      } finally {
        if (!cancelled) setScanFetching(false);
      }
    };
    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, []);

  const daysLeft = useMemo(() => {
    if (!profile.eventDate) return null;
    return Math.max(
      0,
      Math.ceil((new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000)
    );
  }, [profile.eventDate]);

  const toggleConcern = (id: string) => {
    setSelectedConcerns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleHeaderBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else if (step === 2) {
      setStep(1);
    } else {
      // step === 3 — go back to either 1 or 2 depending on mode
      if (mode === 'concern') setStep(2);
      else setStep(1);
    }
  };

  const handleNextFromStep1 = () => {
    if (!mode) return;
    if (mode === 'concern') {
      setStep(2);
    } else {
      generateRecommendations();
    }
  };

  const handleRestart = () => {
    setStep(1);
    setMode(null);
    setSelectedConcerns([]);
    setOtherConcern('');
    setResult(null);
  };

  const buildPrompt = (): string => {
    const profileLine = (line: string, value: string | number | null | undefined) =>
      `- ${line}: ${value ?? '미설정'}`;

    // MEVE — detailed scan + face context for richer personalization
    const scanContext = latestScanDetail
      ? `
Detailed skin scan results:
- Overall score: ${latestScanDetail.overall_score ?? '미상'}점
- Zone analysis: ${JSON.stringify(latestScanDetail.zone_scores ?? {})}
- Detected concerns: ${JSON.stringify(latestScanDetail.concerns ?? [])}
- AI recommendations from scan: ${JSON.stringify(latestScanDetail.recommendations ?? [])}
`
      : '';

    const faceContext = latestFaceAnalysis
      ? `
Face analysis results:
- Personal color: ${latestFaceAnalysis.personal_color ?? '미분석'}
- Face shape: ${latestFaceAnalysis.face_shape ?? '미분석'}
- Eye type: ${latestFaceAnalysis.eye_shape ?? '미분석'}
- Skin tone: ${latestFaceAnalysis.skin_tone ?? '미분석'}
- User confirmed analysis: ${latestFaceAnalysis.user_confirmed === true ? 'yes' : latestFaceAnalysis.user_confirmed === false ? 'no' : 'unknown'}
`
      : '';

    if (mode === 'concern') {
      const concerns = selectedConcerns
        .map((id) => {
          if (id === 'other') return otherConcern.trim() || '기타';
          return CONCERN_OPTIONS.find((c) => c.id === id)?.label ?? id;
        })
        .join(', ');

      return `You are a Korean skincare and aesthetic treatment advisor.
The user has selected SPECIFIC concerns they want help with.

CRITICAL RULES:
- ONLY address the concerns the user selected: ${concerns}
- Do NOT mention any other body parts or features
- Do NOT suggest the user "needs" to change anything they didn't mention
- Do NOT use phrases like "이 부분을 바꾸면 더 예뻐져요"
- Frame everything as "원하는 것을 이루는 방법" not "부족한 점을 고치는 방법"
- Tone: supportive, empowering, never critical

PERSONALIZATION RULES:
- Reference the user's ACTUAL scan data when making recommendations
- If zone_scores show specific weak areas, mention them
- Connect the user's selected concerns to their actual scan findings
- Use phrases like "스캔 결과에서 {concern}이 발견됐어요" when relevant
- Make it feel like you analyzed THEIR specific skin, not generic advice

User's skin data (for context only, don't analyze unlisted areas):
${profileLine('Skin type', profile.skinType)}
${profileLine('Skin score', profile.lastSkinScore != null ? `${profile.lastSkinScore}점` : '미스캔')}
${profileLine('Event', `${profile.eventType ?? '없음'}${daysLeft != null ? ` D-${daysLeft}` : ''}`)}
${scanContext}${faceContext}
User's selected concerns: ${concerns}

Recommend 3 treatments focused ONLY on these concerns.

Return ONLY valid JSON (no markdown):
{
  "intro": "따뜻하고 격려하는 인트로 1-2줄 (해요체). 유저가 선택한 것에 대한 공감.",
  "recommendations": [
    {
      "name": "시술명",
      "targetConcern": "어떤 고민을 해결하는지 (유저가 선택한 것 중 하나)",
      "effect": "효과 2줄 해요체 — 긍정적 프레이밍으로",
      "timing": "언제 받으면 좋은지",
      "sessions": "권장 횟수",
      "priceRange": "가격대",
      "caution": "주의사항 1줄",
      "priority": 1
    }
  ],
  "closing": "마무리 격려 문구 1줄 (해요체)"
}`;
    }

    if (mode === 'general') {
      return `You are a Korean skincare advisor helping someone who wants to feel their best overall.

CRITICAL RULES:
- Frame recommendations as "피부 건강과 컨디션을 높이는 방법"
- NOT "더 예뻐지는 방법" or "부족한 점을 개선하는 방법"
- Tone: warm, empowering, "당신은 이미 아름다워요" energy
- Focus on glow, health, confidence — not fixing "flaws"

PERSONALIZATION RULES:
- Use their actual scan score (${latestScanDetail?.overall_score ?? '미스캔'}점) as context
- Reference specific zones that scored low if available
- Connect recommendations to their real data

User profile:
${profileLine('Skin type', profile.skinType)}
${profileLine('Skin score', profile.lastSkinScore != null ? `${profile.lastSkinScore}점` : '미스캔')}
${profileLine('Main concerns', profile.skinConcerns?.length ? profile.skinConcerns.join(', ') : '없음')}
${profileLine('Event', `${profile.eventType ?? '없음'}${daysLeft != null ? ` D-${daysLeft}` : ''}`)}
${scanContext}${faceContext}
Recommend 3 treatments for overall skin health and radiance.

Return ONLY valid JSON (no markdown):
{
  "intro": "따뜻한 인트로 1-2줄 (해요체). 피부 건강과 빛남에 집중.",
  "recommendations": [
    {
      "name": "시술명",
      "targetConcern": "피부 건강 / 광채 / 컨디션",
      "effect": "효과 2줄 해요체 — 건강하고 빛나는 피부 관점으로",
      "timing": "언제",
      "sessions": "횟수",
      "priceRange": "가격대",
      "caution": "주의사항",
      "priority": 1
    }
  ],
  "closing": "격려 마무리 1줄"
}`;
    }

    // dday
    return `You are a Korean skincare advisor helping someone prepare for a special event.

CRITICAL RULES:
- Focus on achieving the BEST CONDITION for the event day
- Prioritize care routines over invasive treatments
- Only recommend treatments with enough recovery time before D-day
- Tone: excited, supportive, "당신의 특별한 날을 위해" energy

PERSONALIZATION RULES:
- Consider their current skin score when recommending timing
- If score is low (<70), prioritize recovery treatments
- If score is high (>80), focus on maintenance and glow treatments

User profile:
- Event: ${profile.eventType ?? '없음'} D-${daysLeft ?? '?'}
${profileLine('Skin type', profile.skinType)}
${profileLine('Skin score', profile.lastSkinScore != null ? `${profile.lastSkinScore}점` : '미스캔')}
${scanContext}${faceContext}
Focus on timing-appropriate recommendations for D-${daysLeft ?? '?'}.

Return ONLY valid JSON (no markdown):
{
  "intro": "이벤트를 위한 설레는 인트로 1-2줄 (해요체)",
  "recommendations": [
    {
      "name": "시술 또는 케어명",
      "targetConcern": "D-day 컨디션",
      "effect": "효과 2줄",
      "timing": "D-day 기준 타이밍 (예: D-30~D-14에 받으면 좋아요)",
      "sessions": "횟수",
      "priceRange": "가격대",
      "caution": "주의사항",
      "priority": 1
    }
  ],
  "closing": "D-day를 향한 격려 마무리"
}`;
  };

  const generateRecommendations = async () => {
    if (loading) return;
    setStep(3);
    setLoading(true);
    setResult(null);
    try {
      const prompt = buildPrompt();
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
            max_tokens: 1500,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      }
      const text: string = data.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(cleanJson(text)) as TreatmentResult;
      setResult(parsed);
    } catch (e) {
      Alert.alert('오류', friendlyAIErrorMessage(e), [
        { text: '다시 시도', onPress: () => generateRecommendations() },
        { text: '취소', style: 'cancel' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleHeaderBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>시술 추천</Text>
        <View style={{ width: 24 }} />
      </View>

      <StepIndicator step={step} skipStep2={mode !== 'concern'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 1 && (
          <Step1
            mode={mode}
            setMode={setMode}
            hasEvent={!!profile.eventType && !!profile.eventDate}
            eventType={profile.eventType}
            daysLeft={daysLeft}
            onNext={handleNextFromStep1}
            scanFetching={scanFetching}
            hasScanData={!!latestScanDetail}
          />
        )}

        {step === 2 && (
          <Step2
            selectedConcerns={selectedConcerns}
            toggleConcern={toggleConcern}
            otherConcern={otherConcern}
            setOtherConcern={setOtherConcern}
            onNext={generateRecommendations}
          />
        )}

        {step === 3 && (
          <Step3
            loading={loading}
            result={result}
            onRestart={handleRestart}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step, skipStep2 }: { step: Step; skipStep2: boolean }) {
  return (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => {
        const reached =
          s === 2 && skipStep2 ? step >= 3 : step >= s;
        return (
          <View key={s} style={styles.stepIndicatorRow}>
            <View style={[styles.stepDot, reached && styles.stepDotActive]}>
              <Text
                style={[
                  styles.stepDotText,
                  reached && styles.stepDotTextActive,
                ]}
              >
                {s}
              </Text>
            </View>
            {s < 3 && (
              <View
                style={[
                  styles.stepLine,
                  (s === 1 ? step > 1 : step > 2) && styles.stepLineActive,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── STEP 1 ─────────────────────────────────────────────────────────────────

function Step1({
  mode,
  setMode,
  hasEvent,
  eventType,
  daysLeft,
  onNext,
  scanFetching,
  hasScanData,
}: {
  mode: TreatmentMode;
  setMode: (m: TreatmentMode) => void;
  hasEvent: boolean;
  eventType: string | null;
  daysLeft: number | null;
  onNext: () => void;
  scanFetching: boolean;
  hasScanData: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.step1Container}>
      <Text style={styles.step1Title}>어떤 도움이 필요해요? ✨</Text>
      <Text style={styles.step1Subtitle}>
        당신이 원하는 것에만 집중해드려요
      </Text>

      <Step1Option
        emoji="🎯"
        title="특별히 신경 쓰이는 게 있어요"
        desc="내가 직접 고른 부분만 집중해서 알아봐요"
        selected={mode === 'concern'}
        onPress={() => setMode('concern')}
      />

      <Step1Option
        emoji="✨"
        title="전체적으로 더 빛나고 싶어요"
        desc="피부 상태 기반으로 전반적인 케어 방법을 알아봐요"
        selected={mode === 'general'}
        onPress={() => setMode('general')}
      />

      {hasEvent && (
        <Step1Option
          emoji="💕"
          title={`${eventType}을 위해 최상의 컨디션으로`}
          desc={
            daysLeft != null
              ? `D-${daysLeft}까지 케어 중심으로 준비해봐요`
              : '특별한 날을 위해 준비해봐요'
          }
          selected={mode === 'dday'}
          onPress={() => setMode('dday')}
        />
      )}

      {scanFetching ? (
        <Text style={styles.noScanNote}>내 스캔 데이터 불러오는 중...</Text>
      ) : !hasScanData ? (
        <Text style={styles.noScanNote}>
          💡 피부 스캔 후 이용하면 더 정확한 추천을 받을 수 있어요
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.nextBtn, !mode && styles.nextBtnDisabled]}
        onPress={onNext}
        disabled={!mode}
        activeOpacity={0.85}
      >
        <Text style={styles.nextBtnText}>다음 →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Step1Option({
  emoji,
  title,
  desc,
  selected,
  onPress,
}: {
  emoji: string;
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={22} color={PINK} />
      )}
    </TouchableOpacity>
  );
}

// ─── STEP 2 ─────────────────────────────────────────────────────────────────

function Step2({
  selectedConcerns,
  toggleConcern,
  otherConcern,
  setOtherConcern,
  onNext,
}: {
  selectedConcerns: string[];
  toggleConcern: (id: string) => void;
  otherConcern: string;
  setOtherConcern: (v: string) => void;
  onNext: () => void;
}) {
  const otherSelected = selectedConcerns.includes('other');
  const canProceed =
    selectedConcerns.length > 0 &&
    (!otherSelected || otherConcern.trim().length > 0);

  return (
    <ScrollView
      contentContainerStyle={styles.step2Container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.step2Title}>어떤 부분이 신경 쓰이세요?</Text>
      <Text style={styles.step2Subtitle}>
        선택한 부분만 살펴볼게요. 여러 개 선택해도 돼요 🙂
      </Text>

      <View style={styles.concernGrid}>
        {CONCERN_OPTIONS.map((concern) => {
          const isSelected = selectedConcerns.includes(concern.id);
          return (
            <TouchableOpacity
              key={concern.id}
              style={[
                styles.concernChip,
                isSelected && styles.concernChipSelected,
              ]}
              onPress={() => toggleConcern(concern.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.concernEmoji}>{concern.emoji}</Text>
              <Text
                style={[
                  styles.concernLabel,
                  isSelected && styles.concernLabelSelected,
                ]}
              >
                {concern.label}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark" size={14} color={PINK} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {otherSelected && (
        <TextInput
          style={styles.otherInput}
          placeholder="직접 입력해주세요"
          value={otherConcern}
          onChangeText={setOtherConcern}
          placeholderTextColor="#C0C0C0"
        />
      )}

      <TouchableOpacity
        style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
        onPress={onNext}
        disabled={!canProceed}
        activeOpacity={0.85}
      >
        <Text style={styles.nextBtnText}>추천 받기 →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── STEP 3 ─────────────────────────────────────────────────────────────────

function Step3({
  loading,
  result,
  onRestart,
}: {
  loading: boolean;
  result: TreatmentResult | null;
  onRestart: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={PINK} size="large" />
        <Text style={styles.loadingText}>맞춤 추천을 만들고 있어요...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>다시 시도해 주세요.</Text>
        <TouchableOpacity
          style={styles.restartBtn}
          onPress={onRestart}
          activeOpacity={0.85}
        >
          <Text style={styles.restartBtnText}>다시 선택하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.step3Container}>
      {!!result.intro && (
        <View style={styles.introCard}>
          <Text style={styles.introText}>{result.intro}</Text>
        </View>
      )}

      {result.recommendations.map((item, i) => (
        <TreatmentCard key={`${item.name}-${i}`} item={item} />
      ))}

      {!!result.closing && (
        <Text style={styles.closingText}>{result.closing}</Text>
      )}

      <View style={styles.philosophyCard}>
        <Text style={styles.philosophyText}>
          💙 meve는 모든 얼굴이 아름답다고 생각해요.
          {'\n'}이 추천은 당신이 원하는 것을 이루는 데 도움을 드리기 위한 참고 정보예요.
          {'\n\n'}⚕️ 시술은 의료 행위로 반드시 전문의와 상담 후 진행하세요.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.restartBtn}
        onPress={onRestart}
        activeOpacity={0.85}
      >
        <Text style={styles.restartBtnText}>다시 선택하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function TreatmentCard({ item }: { item: TreatmentRecommendation }) {
  return (
    <View style={styles.treatmentCard}>
      <View style={styles.priorityBadge}>
        <Text style={styles.priorityText}>추천 {item.priority}</Text>
      </View>

      <Text style={styles.treatmentName}>{item.name}</Text>
      {!!item.targetConcern && (
        <Text style={styles.treatmentTarget}>{item.targetConcern}</Text>
      )}

      <Text style={styles.effectText}>{item.effect}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>⏰ 타이밍</Text>
          <Text style={styles.infoValue}>{item.timing}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>💊 횟수</Text>
          <Text style={styles.infoValue}>{item.sessions}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>💰 가격</Text>
          <Text style={styles.infoValue}>{item.priceRange}</Text>
        </View>
      </View>

      {!!item.caution && (
        <Text style={styles.cautionText}>⚠️ {item.caution}</Text>
      )}

      <TouchableOpacity
        style={styles.clinicBtn}
        onPress={() => openClinicMap(item.name)}
        activeOpacity={0.85}
      >
        <Text style={styles.clinicBtnText}>📍 근처 피부과 찾기</Text>
      </TouchableOpacity>
    </View>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
    textAlign: 'center',
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: PINK,
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8A9A',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: PINK,
  },

  // Step 1
  step1Container: {
    padding: 20,
    paddingBottom: 40,
  },
  step1Title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  step1Subtitle: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: PINK,
    backgroundColor: '#FFF0F5',
  },
  optionEmoji: { fontSize: 32, marginRight: 14 },
  optionContent: { flex: 1 },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 3,
  },
  optionDesc: { fontSize: 12, color: '#8A8A9A', lineHeight: 18 },
  nextBtn: {
    backgroundColor: PINK,
    borderRadius: 50,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  nextBtnDisabled: { backgroundColor: '#E0E0E0' },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  noScanNote: {
    fontSize: 12,
    color: '#8A8A9A',
    textAlign: 'center',
    marginTop: 8,
  },

  // Step 2
  step2Container: {
    padding: 20,
    paddingBottom: 40,
  },
  step2Title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 12,
    marginBottom: 6,
  },
  step2Subtitle: {
    fontSize: 13,
    color: '#8A8A9A',
    marginBottom: 20,
    lineHeight: 18,
  },
  concernGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  concernChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  concernChipSelected: {
    borderColor: PINK,
    backgroundColor: '#FFF0F5',
  },
  concernEmoji: { fontSize: 16 },
  concernLabel: { fontSize: 13, color: '#4A4A5A', fontWeight: '500' },
  concernLabelSelected: { color: PINK, fontWeight: '600' },
  otherInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1A1A2E',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  // Step 3
  step3Container: {
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#8A8A9A',
  },
  introCard: {
    backgroundColor: '#FFF5F8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: PINK,
  },
  introText: { fontSize: 14, color: '#1A1A2E', lineHeight: 21 },

  treatmentCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  priorityBadge: {
    backgroundColor: PINK,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  priorityText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  treatmentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  treatmentTarget: { fontSize: 12, color: '#8A8A9A', marginBottom: 8 },
  effectText: {
    fontSize: 14,
    color: '#1A1A2E',
    lineHeight: 22,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  infoItem: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    borderRadius: 10,
    padding: 8,
  },
  infoLabel: { fontSize: 10, color: '#8A8A9A', marginBottom: 2 },
  infoValue: { fontSize: 12, color: '#1A1A2E', fontWeight: '600' },
  cautionText: { fontSize: 12, color: '#FFB347', marginBottom: 12 },
  clinicBtn: {
    backgroundColor: '#E8F4FD',
    borderRadius: 50,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clinicBtnText: { color: SKY, fontSize: 13, fontWeight: '600' },

  closingText: {
    fontSize: 14,
    color: PINK,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 12,
  },
  philosophyCard: {
    backgroundColor: '#F0F5FF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: SKY,
  },
  philosophyText: {
    fontSize: 12,
    color: '#5A5A7A',
    lineHeight: 20,
  },
  restartBtn: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginTop: 8,
    marginBottom: 32,
  },
  restartBtnText: {
    fontSize: 13,
    color: '#8A8A9A',
    fontWeight: '500',
  },
});
