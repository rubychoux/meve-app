// MEVE-255 — Makeup diagnosis. One entry point with 4 purposes:
//   - 'facial'  → bounce out to FaceAnalysis (camera scan, bare face)
//   - 'makeup'  → "지금 내 화장 진단" (gallery/camera + GPT-4o Vision)
//   - 'vibe'    → "원하는 느낌이 안 나와요" (target vibe + photo + Vision)
//   - 'color'   → "내 색조가 안 어울려요" (퍼스널컬러 미스매치 + Vision)
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { fetchOpenAIWithTimeout, cleanJson } from '../../utils/openai';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'MakeupDiagnosis'>;

type DiagnosisType = 'facial' | 'makeup' | 'vibe' | 'color';
type Step = 'select' | 'vibe' | 'photo' | 'analyzing' | 'result';
type Severity = 'high' | 'medium' | 'low';

interface DiagnosisIssue {
  severity: Severity;
  area: string;
  problem: string;
  fix: string;
}

interface DiagnosisResult {
  summary: string;
  issues: DiagnosisIssue[];
  recommendations: string[];
  vibeGap?: string;
}

const VIBE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '청순 🌸', value: '청순' },
  { label: '글로우 ✨', value: '글로우' },
  { label: '볼드 💋', value: '볼드' },
  { label: '내추럴 🍃', value: '내추럴' },
  { label: '카리스마 🖤', value: '카리스마' },
];

const SEVERITY_CONFIG: Record<
  Severity,
  { icon: string; label: string; color: string; bg: string }
> = {
  high: { icon: '🔴', label: '꼭 바꿔봐요', color: '#FF4444', bg: '#FFF0F0' },
  medium: { icon: '🟡', label: '바꾸면 좋아요', color: '#F0A500', bg: '#FFFBF0' },
  low: { icon: '🟢', label: '선택사항이에요', color: '#7CB798', bg: '#F0FFF4' },
};

const TYPE_CARDS: Array<{
  type: DiagnosisType;
  icon: string;
  title: string;
  sub: string;
  note: string;
  inputType: string;
  highlight?: boolean;
}> = [
  {
    type: 'facial',
    icon: '🔬',
    title: '퍼스널컬러 / 얼굴형 분석',
    sub: '민낯으로 촬영 → 카메라 스캔',
    note: '퍼스널컬러, 얼굴형, 눈매 정밀 분석',
    inputType: '카메라',
  },
  {
    type: 'makeup',
    icon: '💄',
    title: '지금 내 화장 진단받기',
    sub: '화장 사진 업로드 → 갤러리 or 카메라',
    note: '"묘하게 이상한 이유"를 찾아드려요',
    inputType: '갤러리',
    highlight: true,
  },
  {
    type: 'vibe',
    icon: '🎯',
    title: '원하는 느낌이 안 나와요',
    sub: '원하는 느낌 선택 + 화장 사진 업로드',
    note: '원하는 느낌 vs 현재 비교 분석',
    inputType: '갤러리',
  },
  {
    type: 'color',
    icon: '🎨',
    title: '내 색조가 안 어울려요',
    sub: '화장 사진 업로드 → 갤러리',
    note: '퍼스널컬러 기반 색조 미스매치 진단',
    inputType: '갤러리',
  },
];

export function MakeupDiagnosisScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();

  const [step, setStep] = useState<Step>('select');
  const [diagType, setDiagType] = useState<DiagnosisType | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [customVibe, setCustomVibe] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const handleTypeSelect = (type: DiagnosisType) => {
    setDiagType(type);
    if (type === 'facial') {
      navigation.navigate('FaceAnalysis');
      return;
    }
    if (type === 'vibe') {
      setStep('vibe');
      return;
    }
    setStep('photo');
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setImageBase64(res.assets[0].base64 ?? null);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('카메라 권한이 필요해요');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setImageBase64(res.assets[0].base64 ?? null);
    }
  };

  const buildPrompt = (): string => {
    const profileContext = `사용자 뷰티 프로필:
- 퍼스널컬러: ${profile.personalColor ?? '미분석'}
- 얼굴형: ${profile.faceShape ?? '미분석'}
- 눈매: ${profile.eyeType ?? '미분석'}
- 추구미: ${profile.vibe ?? '미설정'}
- 피부 타입: ${profile.skinType ?? '미분석'}`;

    const targetVibe =
      selectedVibe === '직접입력' ? customVibe.trim() : selectedVibe ?? '';

    const typePrompts: Record<DiagnosisType, string> = {
      facial: '',
      makeup: `이 사람의 현재 메이크업을 분석해주세요.
화장이 묘하게 이상해 보이거나, 생얼보다 못해 보이거나,
어딘가 촌스러워 보이는 원인을 구체적으로 찾아주세요.

${profileContext}

분석 관점:
1. 퍼스널컬러 vs 현재 색조 (베이스/색조/입술 색상)
2. 얼굴형 vs 쉐이딩/하이라이터/컨투어 위치
3. 눈매 vs 아이라이너/아이섀도 방향과 강도
4. 전체적인 메이크업 밸런스와 완성도
5. 피부 화장 완성도 (커버리지, 들뜸, 목과의 색상 차이)`,
      vibe: `이 사람이 원하는 느낌은 "${targetVibe}"이에요.
현재 메이크업이 원하는 느낌과 얼마나 다른지 분석하고,
원하는 느낌이 안 나오는 구체적인 이유를 찾아주세요.

${profileContext}
원하는 느낌: ${targetVibe}

분석 관점:
1. 원하는 느낌 vs 현재 색조 강도
2. 원하는 느낌 vs 아이 메이크업 스타일
3. 원하는 느낌 vs 입술 메이크업
4. 원하는 느낌을 방해하는 요소
5. ${targetVibe} 느낌을 위해 바꿔야 할 것`,
      color: `이 사람의 현재 색조 메이크업이 퍼스널컬러에 맞는지 분석해주세요.
각 부위별로 색상이 어울리는지, 왜 어울리지 않는지 구체적으로 말해주세요.

${profileContext}

분석 관점:
1. 립 색상 → 퍼스널컬러 매칭 여부
2. 아이섀도 색상 → 웜톤/쿨톤 적합성
3. 블러셔/쉐이딩 색상 → 퍼스널컬러 매칭
4. 하이라이터 → 골드/실버 적합성
5. 베이스 색상 → 언더톤 매칭`,
    };

    const vibeGapDirective =
      diagType === 'vibe'
        ? `원하는 ${targetVibe} 느낌과 현재의 차이 요약 (40자 이내, 해요체)`
        : '';

    return `당신은 한국 최고 수준의 메이크업 아티스트이자 퍼스널컬러 전문가예요.
아래 사진을 보고 분석해주세요.

${typePrompts[diagType!]}

반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 없이:
{
  "summary": "전체 한 줄 요약 (30자 이내, 해요체)",
  "issues": [
    {
      "severity": "high",
      "area": "아이 메이크업",
      "problem": "구체적인 문제점 (30자 이내)",
      "fix": "구체적인 개선 방법 (40자 이내)"
    }
  ],
  "recommendations": [
    "제품 추천 또는 팁 1",
    "제품 추천 또는 팁 2"
  ]${vibeGapDirective ? `,\n  "vibeGap": "${vibeGapDirective}"` : ''}
}

issues는 심각한 순서로 최대 5개.
high = 꼭 바꿔야 할 것, medium = 바꾸면 좋은 것, low = 선택사항.
한국어 해요체로.`;
  };

  const analyze = async () => {
    if (!imageBase64) return;
    setStep('analyzing');
    try {
      const prompt = buildPrompt();
      const res = await fetchOpenAIWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 1000,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${imageBase64}`,
                      detail: 'high',
                    },
                  },
                  { type: 'text', text: prompt },
                ],
              },
            ],
          }),
        },
        30_000
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      }
      const content: string = data.choices?.[0]?.message?.content ?? '';
      const parsed: DiagnosisResult = JSON.parse(cleanJson(content));
      setResult(parsed);
      setStep('result');
    } catch {
      Alert.alert('분석 실패', '다시 시도해줘요');
      setStep('photo');
    }
  };

  const resetForNewDiagnosis = () => {
    setStep('select');
    setDiagType(null);
    setImageUri(null);
    setImageBase64(null);
    setResult(null);
    setSelectedVibe(null);
    setCustomVibe('');
  };

  const goMeveTab = () =>
    navigation.navigate('MainTabs', { screen: 'Meve' } as any);

  // ─── SELECT STEP ──────────────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>메이크업 진단</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.selectTitle}>어떤 분석을 받고 싶으세요?</Text>
          <Text style={styles.selectSub}>목적에 따라 분석 방식이 달라져요</Text>

          {TYPE_CARDS.map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[styles.typeCard, item.highlight && styles.typeCardHighlight]}
              onPress={() => handleTypeSelect(item.type)}
              activeOpacity={0.85}
            >
              <Text style={styles.typeIcon}>{item.icon}</Text>
              <View style={styles.typeContent}>
                <Text
                  style={[
                    styles.typeTitle,
                    item.highlight && { color: '#FFFFFF' },
                  ]}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.typeSub,
                    item.highlight && { color: 'rgba(255,255,255,0.85)' },
                  ]}
                >
                  {item.sub}
                </Text>
                <Text
                  style={[
                    styles.typeNote,
                    item.highlight && { color: 'rgba(255,255,255,0.75)' },
                  ]}
                >
                  {item.note}
                </Text>
              </View>
              <View
                style={[
                  styles.inputTypeBadge,
                  item.highlight && styles.inputTypeBadgeLight,
                ]}
              >
                <Text
                  style={[
                    styles.inputTypeBadgeText,
                    item.highlight && { color: '#FF6B9D' },
                  ]}
                >
                  {item.inputType}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── VIBE STEP ────────────────────────────────────────────────────────────
  if (step === 'vibe') {
    const customMissing = selectedVibe === '직접입력' && !customVibe.trim();
    const cannotProceed = !selectedVibe || customMissing;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('select')} hitSlop={8}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>원하는 느낌 선택</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.selectTitle}>어떤 느낌을 원하세요?</Text>
          <View style={styles.vibeGrid}>
            {VIBE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.vibeChip,
                  selectedVibe === opt.value && styles.vibeChipActive,
                ]}
                onPress={() => setSelectedVibe(opt.value)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.vibeChipText,
                    selectedVibe === opt.value && styles.vibeChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.vibeChip,
                selectedVibe === '직접입력' && styles.vibeChipActive,
              ]}
              onPress={() => setSelectedVibe('직접입력')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.vibeChipText,
                  selectedVibe === '직접입력' && styles.vibeChipTextActive,
                ]}
              >
                직접 입력 ✏️
              </Text>
            </TouchableOpacity>
          </View>
          {selectedVibe === '직접입력' && (
            <TextInput
              style={styles.customVibeInput}
              placeholder="원하는 느낌을 입력해줘요 (예: 학교 선생님 느낌)"
              placeholderTextColor="#C0C0CC"
              value={customVibe}
              onChangeText={setCustomVibe}
            />
          )}
          <TouchableOpacity
            style={[styles.ctaBtn, cannotProceed && styles.ctaBtnDisabled]}
            onPress={() => setStep('photo')}
            disabled={cannotProceed}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>다음 — 사진 업로드 →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PHOTO STEP ───────────────────────────────────────────────────────────
  if (step === 'photo') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setStep(diagType === 'vibe' ? 'vibe' : 'select')}
            hitSlop={8}
          >
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>사진 선택</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.selectTitle}>화장한 사진을 올려주세요</Text>
          <Text style={styles.selectSub}>
            갤러리에서 화장한 셀카를 선택하거나{'\n'}지금 바로 촬영해도 돼요
          </Text>

          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.rePickBtn}
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.rePickBtnText}>다시 선택</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderEmoji}>🖼️</Text>
              <Text style={styles.imagePlaceholderText}>사진을 선택해주세요</Text>
              <View style={styles.imagePickBtns}>
                <TouchableOpacity
                  style={styles.imagePickBtn}
                  onPress={pickImage}
                  activeOpacity={0.85}
                >
                  <Text style={styles.imagePickBtnText}>📷 갤러리</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.imagePickBtn}
                  onPress={takePhoto}
                  activeOpacity={0.85}
                >
                  <Text style={styles.imagePickBtnText}>📸 촬영</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {imageUri && (
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={analyze}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>AI 분석 시작하기 💕</Text>
            </TouchableOpacity>
          )}

          <View style={styles.tipBox}>
            <Text style={styles.tipBoxTitle}>💡 더 정확한 분석을 위해</Text>
            <Text style={styles.tipBoxItem}>• 얼굴 전체가 잘 보이는 사진</Text>
            <Text style={styles.tipBoxItem}>• 밝은 자연광에서 찍은 사진</Text>
            <Text style={styles.tipBoxItem}>• 정면 or 약간 앞을 보는 각도</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── ANALYZING STEP ───────────────────────────────────────────────────────
  if (step === 'analyzing') {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent]} edges={['top']}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={styles.analyzingTitle}>AI가 분석 중이에요 💕</Text>
        <Text style={styles.analyzingDesc}>
          {diagType === 'makeup' && '메이크업의 문제점을 찾고 있어요'}
          {diagType === 'vibe' &&
            `${
              selectedVibe === '직접입력' ? customVibe : selectedVibe
            } 느낌과 비교하고 있어요`}
          {diagType === 'color' && '색조와 퍼스널컬러를 비교하고 있어요'}
        </Text>
      </SafeAreaView>
    );
  }

  // ─── RESULT STEP ─────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>분석 결과</Text>
          <TouchableOpacity onPress={resetForNewDiagnosis} hitSlop={8}>
            <Text style={styles.retryBtn}>다시</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>🪞</Text>
            <Text style={styles.summaryText}>{result.summary}</Text>
            {result.vibeGap ? (
              <Text style={styles.vibeGapText}>{result.vibeGap}</Text>
            ) : null}
          </View>

          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.resultThumbnail}
              resizeMode="cover"
            />
          )}

          {result.issues && result.issues.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {diagType === 'vibe' ? '원하는 느낌과 다른 점' : '발견된 문제점'}
              </Text>
              {result.issues.map((issue, i) => {
                const cfg =
                  SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.medium;
                return (
                  <View
                    key={`issue-${i}`}
                    style={[styles.issueCard, { backgroundColor: cfg.bg }]}
                  >
                    <View style={styles.issueHeader}>
                      <Text style={styles.issueIcon}>{cfg.icon}</Text>
                      <View>
                        <Text style={[styles.issueLevel, { color: cfg.color }]}>
                          {cfg.label}
                        </Text>
                        <Text style={styles.issueArea}>{issue.area}</Text>
                      </View>
                    </View>
                    <Text style={styles.issueProblem}>{issue.problem}</Text>
                    <View style={styles.fixPill}>
                      <Text style={styles.fixLabel}>개선 방법</Text>
                      <Text style={styles.fixText}>{issue.fix}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 추천</Text>
              <View style={styles.recoCard}>
                {result.recommendations.map((rec, i) => (
                  <View key={`reco-${i}`} style={styles.recoItem}>
                    <Text style={styles.recoNum}>{i + 1}</Text>
                    <Text style={styles.recoText}>{rec}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.coachCta}
            onPress={goMeveTab}
            activeOpacity={0.85}
          >
            <Text style={styles.coachCtaText}>
              💕 AI 스타일 코치에게 더 물어보기 →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: { fontSize: 22, color: '#1A1A2E', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  retryBtn: { fontSize: 14, color: '#FF6B9D', fontWeight: '600' },
  content: { padding: 20, paddingBottom: 60 },
  selectTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  selectSub: {
    fontSize: 14,
    color: '#8A8A9A',
    marginBottom: 24,
    lineHeight: 20,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeCardHighlight: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  typeIcon: { fontSize: 28 },
  typeContent: { flex: 1 },
  typeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  typeSub: { fontSize: 12, color: '#8A8A9A', marginBottom: 2 },
  typeNote: { fontSize: 11, color: '#C0C0CC' },
  inputTypeBadge: {
    backgroundColor: '#F0F0F5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputTypeBadgeLight: { backgroundColor: 'rgba(255,255,255,0.25)' },
  inputTypeBadgeText: { fontSize: 11, color: '#8A8A9A', fontWeight: '600' },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  vibeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  vibeChipActive: { borderColor: '#FF6B9D', backgroundColor: '#FFF0F5' },
  vibeChipText: { fontSize: 14, color: '#5A5A7A', fontWeight: '500' },
  vibeChipTextActive: { color: '#FF6B9D', fontWeight: '700' },
  customVibeInput: {
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1A1A2E',
    marginBottom: 20,
  },
  imagePreviewWrapper: { alignItems: 'center', marginBottom: 20 },
  imagePreview: { width: '100%', height: 320, borderRadius: 16 },
  rePickBtn: {
    marginTop: 10,
    backgroundColor: '#F5F5FA',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  rePickBtnText: { fontSize: 13, color: '#5A5A7A', fontWeight: '600' },
  imagePlaceholder: {
    backgroundColor: '#F5F5FA',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 48,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  imagePlaceholderEmoji: { fontSize: 48, marginBottom: 12 },
  imagePlaceholderText: { fontSize: 15, color: '#8A8A9A', marginBottom: 20 },
  imagePickBtns: { flexDirection: 'row', gap: 12 },
  imagePickBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  imagePickBtnText: { fontSize: 14, color: '#1A1A2E', fontWeight: '600' },
  tipBox: {
    backgroundColor: '#FFF0F5',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  tipBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B9D',
    marginBottom: 8,
  },
  tipBoxItem: { fontSize: 12, color: '#5A5A7A', marginBottom: 4 },
  ctaBtn: {
    backgroundColor: '#FF6B9D',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaBtnDisabled: { backgroundColor: '#C0C0CC' },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 20,
  },
  analyzingDesc: { fontSize: 14, color: '#8A8A9A', marginTop: 8 },
  summaryCard: {
    backgroundColor: '#FF6B9D',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: { fontSize: 32, marginBottom: 8 },
  summaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  vibeGapText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 6,
  },
  resultThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 16,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  issueCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  issueIcon: { fontSize: 20 },
  issueLevel: { fontSize: 11, fontWeight: '700' },
  issueArea: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  issueProblem: {
    fontSize: 14,
    color: '#5A5A7A',
    lineHeight: 20,
    marginBottom: 10,
  },
  fixPill: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 10 },
  fixLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8A9A',
    marginBottom: 4,
  },
  fixText: { fontSize: 13, color: '#1A1A2E' },
  recoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  recoItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  recoNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B9D',
    width: 20,
    textAlign: 'center',
  },
  recoText: { flex: 1, fontSize: 14, color: '#1A1A2E', lineHeight: 20 },
  coachCta: {
    backgroundColor: '#FFF0F5',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  coachCtaText: { fontSize: 14, fontWeight: '600', color: '#FF6B9D' },
});
