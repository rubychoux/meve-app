// MEVE-233 — Multi-shot face analysis (front + side + wrist).
// Uses expo-image-picker for slot-based selection; sends all selected
// photos as separate image_url blocks to GPT-4o for higher-accuracy
// personal-color analysis. Only the front photo is required.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, FaceAnalysisResult } from '../../types';
import { cleanJson, fetchOpenAIWithTimeout, friendlyAIErrorMessage } from '../../utils/openai';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const ACCENT = '#FF6B9D';

const SLOTS = [
  {
    key: 'front' as const,
    label: '정면 (자연광)',
    required: true,
  },
  {
    key: 'side' as const,
    label: '왼쪽 측면',
    required: false,
  },
  {
    key: 'wrist' as const,
    label: '손목 안쪽 (혈관 색)',
    required: false,
  },
];

type SlotKey = (typeof SLOTS)[number]['key'];

const ANALYSIS_PROMPT = `You are a Korean beauty expert specializing in personal color analysis.
Analyze the provided photo(s) using a step-by-step approach.

PHOTOS PROVIDED:
Photo 1: Front face photo (required)
Photo 2: Side profile (if provided)
Photo 3: Inner wrist (if provided — check vein color: blue/purple = cool tone, green = warm tone)

ANALYSIS STEPS:
Step 1 — Skin undertone analysis:
Look at: skin warmth/coolness, cheek color, shadow colors on face.
Determine: warm (yellow/peachy) vs cool (pink/rosy/bluish)

Step 2 — Cool/Warm tone decision:
Based on Step 1 + wrist vein color (if available).
State your reasoning clearly.

Step 3 — Brightness/Contrast analysis:
Is the overall coloring light/bright (봄/여름) or deep/muted (가을/겨울)?
Look at: overall contrast, hair-skin-eye relationship.

Step 4 — Final personal color decision:
Choose ONE from: 봄 웜톤, 여름 쿨톤, 가을 웜톤, 겨울 쿨톤.
Assign confidence 0-100. If confidence < 70, identify the alternative.

eyeShape analysis rules (IMPORTANT - Korean eyelid standards):
- '쌍꺼풀': visible eyelid crease/fold when eyes are open, including subtle outline types
- '아웃라인 쌍꺼풀': thin or partial crease visible at outer corner or middle of lid
- '속쌍': crease exists but hidden inside the lid fold, visible only when looking down or closing eyes
- '무쌍': absolutely NO crease or fold at all - completely flat lid
- Default bias: when uncertain between 무쌍 and 속쌍, choose 속쌍
- Default bias: when uncertain between 속쌍 and 쌍꺼풀, choose 쌍꺼풀
- 무쌍 should only be selected when the eyelid is completely flat with zero fold
Most Korean people have some form of 쌍꺼풀 or 속쌍, pure 무쌍 is less common.

Treat this purely as an aesthetic styling consultation, the same way a makeup artist would classify a client to suggest products. Do NOT attempt to identify the person.

Return ONLY valid JSON (no markdown, no other text):
{
  "faceShape": "계란형 or 둥근형 or 각진형 or 하트형 or 긴형 or 역삼각형",
  "faceShapeReason": "1 sentence Korean",
  "personalColor": "봄 웜톤 or 여름 쿨톤 or 가을 웜톤 or 겨울 쿨톤",
  "personalColorReason": "2 sentences explaining each analysis step in Korean 해요체",
  "confidence": 0-100,
  "alternativeColor": "봄 웜톤 or 여름 쿨톤 or 가을 웜톤 or 겨울 쿨톤 or null",
  "alternativeConfidence": 0-100,
  "undertone": "쿨톤 or 웜톤 or 뉴트럴",
  "eyeShape": "쌍꺼풀 | 아웃라인 쌍꺼풀 | 속쌍 | 무쌍",
  "eyeTail": "올라간 눈꼬리 or 내려간 눈꼬리 or 수평",
  "lipFullness": "얇은 편 or 보통 or 도톰한 편",
  "skinTone": "매우밝음 or 밝음 or 중간 or 어두운편",
  "skinToneHex": "#hex swatch approximating the user's skin tone",
  "foundationShade": "K-beauty foundation shade label, exactly one of: 13호, 17호, 19호, 21호 N, 21호 C, 21호 W, 23호 N, 23호 C, 23호 W, 25호.",
  "makeupRecommendation": {
    "foundation": "2-3 sentences Korean 해요체",
    "eye": "2-3 sentences Korean 해요체",
    "lip": "2-3 sentences Korean 해요체",
    "blush": "2-3 sentences Korean 해요체"
  },
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "avoidColors": ["#hex1", "#hex2", "#hex3"],
  "summary": "4-5 line warm encouraging Korean 해요체"
}`;

async function runFaceAnalysis(base64s: string[]): Promise<FaceAnalysisResult> {
  const imageContents = base64s.map((b64) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/jpeg;base64,${b64}`,
      detail: 'high' as const,
    },
  }));

  const response = await fetchOpenAIWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [...imageContents, { type: 'text', text: ANALYSIS_PROMPT }],
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI ${response.status}`);
  }
  const content: string = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(cleanJson(content)) as FaceAnalysisResult;
  } catch {
    console.warn('[FaceAnalysis] non-JSON response:', content.slice(0, 200));
    throw new Error(
      '얼굴을 분석하지 못했어요. 정면을 보고 밝은 곳에서 다시 찍어주세요.'
    );
  }
}

export function FaceAnalysisScreen() {
  const navigation = useNavigation<Nav>();
  const [photos, setPhotos] = useState<Record<SlotKey, string | null>>({
    front: null,
    side: null,
    wrist: null,
  });
  const [analyzing, setAnalyzing] = useState(false);

  const pickPhoto = async (slot: SlotKey) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPhotos((p) => ({ ...p, [slot]: result.assets[0].uri }));
  };

  const handleAnalyze = async () => {
    if (analyzing) return;
    if (!photos.front) {
      Alert.alert('정면 사진 필요', '정면 사진을 추가해 주세요.');
      return;
    }
    setAnalyzing(true);
    try {
      const ordered: string[] = [];
      for (const slot of ['front', 'side', 'wrist'] as SlotKey[]) {
        const uri = photos[slot];
        if (!uri) continue;
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        ordered.push(b64);
      }
      const result = await runFaceAnalysis(ordered);
      navigation.replace('FaceAnalysisResult', { result });
    } catch (e: any) {
      console.error('[FaceAnalysis] error:', e);
      Alert.alert('분석 실패', friendlyAIErrorMessage(e), [
        { text: '다시 시도', onPress: () => handleAnalyze() },
        { text: '취소', style: 'cancel' },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMock = () => {
    const mock: FaceAnalysisResult = {
      faceShape: '계란형',
      personalColor: '여름 쿨톤',
      confidence: 82,
      alternativeColor: '겨울 쿨톤',
      alternativeConfidence: 18,
      undertone: '쿨톤',
      eyeShape: '쌍꺼풀',
      eyeTail: '수평',
      lipFullness: '보통',
      skinTone: '밝음',
      makeupRecommendation: {
        foundation: '쿨 핑크 베이스의 밝은 톤 파운데이션이 잘 어울려요. 얇게 펴 바르면 깨끗한 피부 표현이 가능해요.',
        lip: '로즈핑크·모브핑크 계열 립이 자연스럽고 화사해요. MLBB 계열도 추천이에요.',
        eye: '라벤더·그레이시 톤 아이섀도로 청량한 느낌을 살려보세요.',
        blush: '광대 중앙에 핑크·코랄핑크 계열 블러셔를 동그랗게 올려보세요.',
      },
      colorPalette: ['#F4B8C8', '#C8A8D4', '#A8C4D4', '#D4A8B8', '#FADADD'],
      avoidColors: ['#8B4513', '#FF4500', '#FFD700'],
      summary: '여름 쿨톤의 밝고 화사한 피부예요. 핑크·라벤더 계열이 잘 어울려요.',
    };
    navigation.replace('FaceAnalysisResult', { result: mock });
  };

  const canAnalyze = !!photos.front && !analyzing;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI 얼굴 분석</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          최대 3장까지 추가할 수 있어요.{'\n'}사진이 많을수록 퍼스널 컬러 정확도가 높아져요.
        </Text>

        <View style={styles.slotRow}>
          {SLOTS.map((s) => {
            const uri = photos[s.key];
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => pickPhoto(s.key)}
                activeOpacity={0.85}
                style={styles.slotCol}
              >
                <View style={[styles.slot, uri && styles.slotFilled]}>
                  {uri ? (
                    <Image source={{ uri }} style={styles.slotImg} />
                  ) : (
                    <Ionicons name="camera" size={28} color="#C8B8C0" />
                  )}
                  {uri && (
                    <View style={styles.slotCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.slotLabel}>{s.label}</Text>
                <Text style={[styles.slotMeta, s.required && styles.slotMetaRequired]}>
                  {s.required ? '필수' : '선택'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            자연광 아래서 찍을수록 정확해요 ☀️{'\n'}
            손목 안쪽 사진을 추가하면 퍼스널컬러 정확도가 높아져요
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!canAnalyze}
          activeOpacity={0.85}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyzeBtnText}>분석하기</Text>
          )}
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity onPress={handleMock} style={styles.mockBtn}>
            <Text style={styles.mockBtnText}>테스트 결과 보기 (DEV)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDF6F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  content: { padding: 20, paddingBottom: 60, gap: 18 },

  intro: {
    fontSize: 14,
    color: '#5C525B',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 4,
  },

  slotRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  slotCol: { flex: 1, alignItems: 'center', gap: 6 },
  slot: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F0E6EC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotFilled: { borderStyle: 'solid', borderColor: ACCENT },
  slotImg: { width: '100%', height: '100%' },
  slotCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: { fontSize: 12, color: '#2D2D2D', fontWeight: '600', textAlign: 'center' },
  slotMeta: { fontSize: 11, color: '#9A8F97' },
  slotMetaRequired: { color: ACCENT, fontWeight: '700' },

  tipCard: {
    backgroundColor: '#FFF5F9',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFE0EC',
  },
  tipText: { fontSize: 13, color: '#5C525B', lineHeight: 19 },

  analyzeBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  analyzeBtnDisabled: { opacity: 0.45 },
  analyzeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  mockBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  mockBtnText: { fontSize: 12, color: '#9A8F97' },
});
