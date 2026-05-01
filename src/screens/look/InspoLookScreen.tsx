import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MainStackParamList,
  InspoLookResult,
  FaceAnalysisResult,
} from '../../types';
import { fetchOpenAIWithTimeout, friendlyAIErrorMessage } from '../../utils/openai';

type Nav = NativeStackNavigationProp<MainStackParamList, 'InspoLook'>;

const ACCENT = '#FF6B9D';

const KEYWORDS = [
  '클린걸',
  '영앤리치',
  '귀티',
  '테토녀',
  '에겐녀',
  '어른여자',
  '청순',
  '글로우',
  '볼드',
  '내추럴',
  '빈티지',
  '도파민 메이크업',
  '마네킹 메이크업',
  '2D 메이크업',
  'Y2K',
  '로맨틱',
  '시크',
];

const RESPONSE_SCHEMA = `{
  "referenceAnalysis": {
    "baseFinish": "매트 | 세미매트 | 글로우 | 듀이",
    "eyeStyle": "아이라이너 스타일과 컬러 설명",
    "lipColor": "립 컬러 계열 (예: MLBB, 코럴, 누드핑크, 버건디)",
    "lipTexture": "매트 | 글로우 | 물광 | 틴트",
    "blushPosition": "사과볼 | 광대 | 관자놀이 | 콧등",
    "blushColor": "블러셔 컬러 계열",
    "overallVibe": "이 메이크업의 추구미 (예: 청순/클린걸/글로우)",
    "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"]
  },
  "personalizedGuide": {
    "adjustments": "내 퍼스널 컬러/얼굴형에 맞게 조정된 점 설명 (2-3줄, 해요체)",
    "steps": [
      {"step": 1, "category": "베이스", "instruction": "구체적인 방법 2줄", "productHint": "제품 타입 힌트"},
      {"step": 2, "category": "아이", "instruction": "구체적인 방법 2줄", "productHint": "제품 타입 힌트"},
      {"step": 3, "category": "치크", "instruction": "구체적인 방법 2줄", "productHint": "제품 타입 힌트"},
      {"step": 4, "category": "립", "instruction": "구체적인 방법 2줄", "productHint": "제품 타입 힌트"}
    ],
    "colorAdjustment": "레퍼런스 컬러 vs 내 버전 설명 (예: 원본 오렌지 립 → 내 쿨톤에 맞게 핑크레드로)"
  },
  "summary": "전체 요약 2줄, 해요체"
}`;

async function loadProfile(): Promise<{ personalColor: string; faceShape: string }> {
  try {
    const [[, pc], [, fa]] = await AsyncStorage.multiGet([
      'meve_personal_color',
      'meve_face_analysis',
    ]);
    let faceShape = '미정';
    if (fa) {
      try {
        const parsed = JSON.parse(fa) as FaceAnalysisResult;
        if (parsed.faceShape) faceShape = parsed.faceShape;
      } catch {}
    }
    return { personalColor: pc ?? '미정', faceShape };
  } catch {
    return { personalColor: '미정', faceShape: '미정' };
  }
}

function parseJson(raw: string): InspoLookResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON 파싱 실패');
  return JSON.parse(match[0]) as InspoLookResult;
}

async function analyzeWithImage(
  base64: string,
  profile: { personalColor: string; faceShape: string }
): Promise<InspoLookResult> {
  const text = `Analyze this makeup reference image and the user's profile, then return ONLY JSON.
User profile:
- Personal color: ${profile.personalColor}
- Face shape: ${profile.faceShape}

Response schema (return ONLY this JSON, no markdown, no other text):
${RESPONSE_SCHEMA}`;

  const res = await fetchOpenAIWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
            { type: 'text', text },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
  return parseJson(data.choices[0].message.content.trim());
}

async function analyzeWithKeyword(
  keyword: string,
  profile: { personalColor: string; faceShape: string }
): Promise<InspoLookResult> {
  const prompt = `You are a Korean makeup expert. The user wants the "${keyword}" makeup style.
Based on their profile (personal color: ${profile.personalColor}, face shape: ${profile.faceShape}),
return ONLY this JSON structure (set referenceAnalysis.overallVibe = "${keyword}", no markdown, no other text):
${RESPONSE_SCHEMA}`;

  const res = await fetchOpenAIWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
  return parseJson(data.choices[0].message.content.trim());
}

export function InspoLookScreen() {
  const navigation = useNavigation<Nav>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [keyword, setKeyword] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const canSubmit = (imageBase64 !== null || keyword !== null) && !analyzing;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setKeyword(null);
    }
  };

  const selectKeyword = (k: string) => {
    if (keyword === k) {
      setKeyword(null);
      return;
    }
    setKeyword(k);
    setImageUri(null);
    setImageBase64(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setAnalyzing(true);
    try {
      const profile = await loadProfile();
      const result = imageBase64
        ? await analyzeWithImage(imageBase64, profile)
        : await analyzeWithKeyword(keyword!, profile);
      navigation.replace('InspoLookResult', {
        result,
        imageUri: imageUri ?? undefined,
        keyword: keyword ?? undefined,
      });
    } catch (e: any) {
      Alert.alert('분석 실패', friendlyAIErrorMessage(e), [
        { text: '다시 시도', onPress: () => handleSubmit() },
        { text: '취소', style: 'cancel' },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>인스포 룩</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hero}>어떤 메이크업이 끌리나요? ✨</Text>
        <Text style={styles.heroSub}>
          레퍼런스 사진을 올리거나 키워드를 골라주세요.
        </Text>

        {/* Upload */}
        <TouchableOpacity
          style={[styles.uploadBox, imageUri && styles.uploadBoxFilled]}
          onPress={pickImage}
          activeOpacity={0.85}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.uploadImage} />
          ) : (
            <View style={styles.uploadInner}>
              <Ionicons name="image-outline" size={40} color={ACCENT} />
              <Text style={styles.uploadLabel}>사진 업로드하기</Text>
              <Text style={styles.uploadHint}>최대 1장</Text>
            </View>
          )}
        </TouchableOpacity>
        {imageUri && (
          <TouchableOpacity
            onPress={() => {
              setImageUri(null);
              setImageBase64(null);
            }}
            style={styles.removeImageBtn}
          >
            <Text style={styles.removeImageText}>사진 다시 고르기</Text>
          </TouchableOpacity>
        )}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Keywords */}
        <Text style={styles.keywordLabel}>키워드로 고르기</Text>
        <View style={styles.keywordRow}>
          {KEYWORDS.map((k) => {
            const active = keyword === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => selectKeyword(k)}
                style={[styles.keywordPill, active && styles.keywordPillActive]}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.keywordText, active && styles.keywordTextActive]}
                >
                  {k}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && { opacity: 0.45 }]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>분석하기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  content: { padding: 20, paddingBottom: 60, gap: 14 },

  hero: { fontSize: 20, fontWeight: '800', color: '#2D2D2D' },
  heroSub: { fontSize: 13, color: '#9A8F97', marginBottom: 6 },

  uploadBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFC4D6',
    borderStyle: 'dashed',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadBoxFilled: { borderStyle: 'solid' },
  uploadInner: { alignItems: 'center', gap: 6 },
  uploadLabel: { fontSize: 15, fontWeight: '700', color: ACCENT, marginTop: 4 },
  uploadHint: { fontSize: 12, color: '#9A8F97' },
  uploadImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { alignSelf: 'center', paddingVertical: 4 },
  removeImageText: { fontSize: 12, color: ACCENT, fontWeight: '600' },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F0E6EC' },
  dividerText: { fontSize: 12, color: '#9A8F97' },

  keywordLabel: { fontSize: 13, fontWeight: '700', color: '#2D2D2D' },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keywordPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E6EC',
  },
  keywordPillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  keywordText: { fontSize: 13, color: '#2D2D2D' },
  keywordTextActive: { color: '#fff', fontWeight: '700' },

  submitBtn: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
