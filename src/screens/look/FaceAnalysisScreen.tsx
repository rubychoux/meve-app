import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { MainStackParamList, FaceAnalysisResult } from '../../types';
import { cleanJson } from '../../utils/openai';
import { SkinScanGuideModal } from '../../components/SkinScanGuideModal';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const SKIP_KEY = 'meve_skip_face_analysis_guide';
const ACCENT = '#FF6B9D';

const ANALYSIS_PROMPT = `You are a Korean beauty consultant helping a user with personalized makeup recommendations in the meve app (Korean K-beauty standards, 한국 뷰티 기준).

The user has consented to share their selfie for a makeup consultation. Your task is to suggest makeup that flatters them based on general facial aesthetics (face shape category, overall skin undertone, eye shape style, lip fullness, skin brightness). Do NOT attempt to identify the person. Treat this purely as an aesthetic styling consultation, the same way a makeup artist would classify a client to suggest products.

Personal color MUST be one of: 봄 웜톤, 여름 쿨톤, 가을 웜톤, 겨울 쿨톤.

Respond with a JSON object (and nothing else) matching this schema exactly:
{
  "faceShape": "계란형 or 둥근형 or 각진형 or 하트형 or 긴형 or 역삼각형",
  "faceShapeReason": "1 sentence Korean description of the face-shape clues",
  "personalColor": "봄 웜톤 or 여름 쿨톤 or 가을 웜톤 or 겨울 쿨톤",
  "personalColorReason": "1 sentence Korean description of the undertone clues",
  "undertone": "쿨톤 or 웜톤 or 뉴트럴",
  "eyeShape": "쌍꺼풀 or 무쌍 or 인라인 쌍커풀 or 인아웃라인 쌍커풀 or 아웃라인 쌍커풀",
  "eyeTail": "올라간 눈꼬리 or 내려간 눈꼬리 or 수평",
  "lipFullness": "얇은 편 or 보통 or 도톰한 편",
  "skinTone": "매우밝음 or 밝음 or 중간 or 어두운편",
  "skinToneHex": "#hex swatch approximating the user's skin tone",
  "foundationShade": "Korean K-beauty foundation shade label, exactly one of: 13호, 17호, 19호, 21호 N, 21호 C, 21호 W, 23호 N, 23호 C, 23호 W, 25호. Pick the closest match to skinTone + undertone.",
  "makeupRecommendation": {
    "foundation": "2-3 Korean 해요체 sentences on foundation finish and application tips (do NOT repeat the shade number here)",
    "eye": "2-3 Korean 해요체 sentences on eye makeup style",
    "lip": "2-3 Korean 해요체 sentences on lip color family",
    "blush": "2-3 Korean 해요체 sentences on blush placement and color"
  },
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "avoidColors": ["#hex1", "#hex2", "#hex3"],
  "summary": "4-5 line warm encouraging Korean 해요체 summary"
}`;

const CHECKS = [
  { emoji: '💆', text: '맨얼굴 또는 가벼운 메이크업 상태인가요?' },
  { emoji: '💡', text: '밝고 자연광이 잘 드는 곳에 있나요?' },
  { emoji: '🪞', text: '정면을 바라보고 있나요?' },
  { emoji: '💇', text: '앞머리가 이마를 가리지 않나요?' },
];

async function runFaceAnalysis(base64: string): Promise<FaceAnalysisResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
            { type: 'text', text: ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI ${response.status}`);
  }
  const content: string = data.choices[0].message.content ?? '';
  try {
    return JSON.parse(cleanJson(content)) as FaceAnalysisResult;
  } catch {
    // Model returned prose (usually a safety-refusal). Surface a friendly message.
    console.warn('[FaceAnalysis] non-JSON response:', content.slice(0, 200));
    throw new Error(
      '얼굴을 분석하지 못했어요. 정면을 보고 밝은 곳에서 다시 찍어주세요.'
    );
  }
}

export function FaceAnalysisScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<'idle' | 'analyzing'>('idle');
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    AsyncStorage.getItem(SKIP_KEY).then((val) => {
      if (val !== 'true') setShowGuide(true);
    });
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  const width = layout?.width ?? 0;
  const height = layout?.height ?? 0;
  const ovalRx = (width * 0.75) / 2;
  const ovalRy = ovalRx * 1.2;
  const ovalCx = width / 2;
  const ovalCy = height * 0.42;

  const handleCapture = async () => {
    if (step !== 'idle' || !cameraRef.current) return;
    setStep('analyzing');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      if (!photo.base64) throw new Error('사진 인코딩 실패');
      const result = await runFaceAnalysis(photo.base64);
      navigation.replace('FaceAnalysisResult', { result });
    } catch (e: any) {
      console.error('[FaceAnalysis] error:', e);
      setStep('idle');
      Alert.alert('분석 실패', __DEV__ ? e?.message ?? String(e) : '다시 시도해 주세요.');
    }
  };

  const handleMockCapture = () => {
    const mock: FaceAnalysisResult = {
      faceShape: '계란형',
      personalColor: '여름 쿨톤',
      undertone: '쿨톤',
      eyeShape: '쌍꺼풀',
      eyeTail: '수평',
      lipFullness: '보통',
      skinTone: '밝은',
      makeupRecommendation: {
        foundation: '쿨 핑크 베이스의 밝은 톤 파운데이션이 피부톤과 잘 어울려요. 얇게 펴 바르면 깨끗한 피부 표현이 가능해요.',
        lip: '로즈핑크·모브핑크 계열 립이 자연스럽고 화사해요. MLBB 계열도 추천이에요.',
        eye: '라벤더·그레이시 톤 아이섀도로 청량한 느낌을 살려보세요. 브라운보다 뉴트럴 그레이가 잘 어울려요.',
        blush: '광대 중앙에 핑크·코랄핑크 계열 블러셔를 동그랗게 올려보세요. 생기감이 커져요.',
      },
      colorPalette: ['#F4B8C8', '#C8A8D4', '#A8C4D4', '#D4A8B8', '#FADADD'],
      avoidColors: ['#8B4513', '#FF4500', '#FFD700'],
      summary:
        '여름 쿨톤의 밝고 화사한 피부를 가지고 계세요. 핑크·라벤더 계열이 잘 어울리고, 따뜻한 오렌지·골드 계열은 피하시는 게 좋아요. 청량한 무드의 메이크업이 잘 살아나요.',
    };
    navigation.replace('FaceAnalysisResult', { result: mock });
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Ionicons name="camera-outline" size={48} color={ACCENT} />
        <Text style={styles.permTitle}>카메라 접근이 필요해요</Text>
        <Text style={styles.permDesc}>AI 얼굴 분석을 위해 카메라 권한을 허용해 주세요.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>권한 허용하기</Text>
        </TouchableOpacity>
        {__DEV__ && (
          <TouchableOpacity style={styles.mockBtn} onPress={handleMockCapture}>
            <Text style={styles.mockBtnText}>테스트 결과 보기 (DEV)</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root} onLayout={handleLayout}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>AI 얼굴 분석</Text>
          <Text style={styles.headerSub}>
            {step === 'analyzing'
              ? 'AI가 얼굴을 분석하고 있어요...'
              : '얼굴을 가이드 안에 맞춰 주세요'}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </SafeAreaView>

      {width > 0 && height > 0 && (
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Path
            d={`M 0 0 H ${width} V ${height} H 0 Z M ${ovalCx - ovalRx} ${ovalCy} A ${ovalRx} ${ovalRy} 0 1 0 ${ovalCx + ovalRx} ${ovalCy} A ${ovalRx} ${ovalRy} 0 1 0 ${ovalCx - ovalRx} ${ovalCy} Z`}
            fill="rgba(0,0,0,0.4)"
            fillRule="evenodd"
          />
          <Ellipse
            cx={ovalCx}
            cy={ovalCy}
            rx={ovalRx}
            ry={ovalRy}
            stroke={ACCENT}
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      )}

      {step === 'analyzing' && (
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.analyzingText}>AI가 얼굴을 분석하고 있어요...</Text>
        </View>
      )}

      {step === 'idle' && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={handleCapture}
            activeOpacity={0.85}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          {__DEV__ && (
            <TouchableOpacity style={styles.mockBtn} onPress={handleMockCapture}>
              <Text style={styles.mockBtnText}>테스트 (DEV)</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      )}

      <SkinScanGuideModal
        visible={showGuide}
        title="얼굴 분석을 위해 확인해주세요 ✨"
        confirmLabel="확인하고 분석하기"
        checks={CHECKS}
        skipKey={SKIP_KEY}
        onCancel={() => {
          setShowGuide(false);
          navigation.goBack();
        }}
        onConfirm={() => setShowGuide(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  permWrap: {
    flex: 1,
    backgroundColor: '#FDF6F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  permTitle: { fontSize: 18, fontWeight: '700', color: '#2D2D2D' },
  permDesc: { fontSize: 14, color: '#9A8F97', textAlign: 'center' },
  permBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  analyzingText: { fontSize: 15, color: '#fff' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 24,
    gap: 12,
    zIndex: 10,
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  mockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  mockBtnText: { fontSize: 12, color: '#fff' },
});
