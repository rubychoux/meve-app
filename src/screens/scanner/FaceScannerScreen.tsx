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
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { MainStackParamList, ScanAnalysisResult } from '../../types';
import { handleFirstScanCompleted } from '../../services/routineNotifications';
import { getMonthlyCount, isPremiumNow } from '../../services/premium';
import { PremiumUpsellModal } from '../../components/PremiumUpsellModal';
import { cleanJson } from '../../utils/openai';
import {
  SkinScanGuideModal,
  SKIP_GUIDE_KEY,
} from '../../components/SkinScanGuideModal';
import { track } from '../../services/analytics';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type ScanStep = 'idle' | 'analyzing';

const OPENAI_PROMPT = `You are an expert Korean dermatologist analyzing Asian skin. Analyze ONLY what is clearly visible in this photo. Korean skincare standards apply.
Return ONLY valid JSON (no markdown, no other text):
{
  "overallScore": <0-100 integer>,
  "skinType": "지성 or 건성 or 복합성 or 민감성 or 중성",
  "hydrationLevel": "매우건조 or 건조 or 보통 or 촉촉 or 매우촉촉",
  "zones": {
    "forehead": {"status": "맑음 or 약간칙칙 or 트러블 or 모공넓음 or 번들거림", "score": 0-100},
    "leftCheek": {"status": "맑음 or 약간칙칙 or 트러블 or 모공넓음 or 건조함", "score": 0-100},
    "rightCheek": {"status": "맑음 or 약간칙칙 or 트러블 or 모공넓음 or 건조함", "score": 0-100},
    "nose": {"status": "맑음 or 블랙헤드 or 모공넓음 or 번들거림 or 건조함", "score": 0-100},
    "chin": {"status": "맑음 or 트러블 or 건조함 or 번들거림 or 칙칙함", "score": 0-100}
  },
  "concerns": ["concern1 in Korean", "concern2 if exists", "concern3 if exists"],
  "strengths": ["strength1 in Korean", "strength2 if exists"],
  "ingredients": {
    "recommended": ["ingredient1", "ingredient2", "ingredient3", "ingredient4", "ingredient5"],
    "avoid": ["ingredient1", "ingredient2", "ingredient3"]
  },
  "routineAdvice": {
    "morning": "specific 2-line AM advice Korean 해요체",
    "evening": "specific 2-line PM advice Korean 해요체"
  },
  "summary": "3-4 lines warm encouraging summary Korean 해요체"
}`;

const runAnalysis = async (base64String: string): Promise<ScanAnalysisResult> => {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64String}` },
          },
          {
            type: 'text',
            text: OPENAI_PROMPT,
          },
        ],
      }],
    }),
  });

  const openaiData = await openaiResponse.json();
  console.log('[OpenAI] response:', JSON.stringify(openaiData));

  if (!openaiResponse.ok) {
    throw new Error(openaiData.error?.message ?? `OpenAI ${openaiResponse.status}`);
  }

  const content = openaiData.choices[0].message.content;
  console.log('[OpenAI] raw content:', content);
  const result: ScanAnalysisResult = JSON.parse(cleanJson(content));

  // Save to skin_scans (best-effort — don't block navigation on failure)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('skin_scans').insert({
        user_id: user.id,
        scan_result: result,
      });
    }
  } catch (dbErr) {
    console.warn('[skin_scans] insert failed (non-fatal):', dbErr);
  }

  return result;
};

export function FaceScannerScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<ScanStep>('idle');
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SKIP_GUIDE_KEY).then((val) => {
      if (val !== 'true') setShowGuide(true);
    });
  }, []);

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  const width = layout?.width ?? 0;
  const height = layout?.height ?? 0;
  // Oval: 75% of screen width, ~1.2x that for height, horizontally centered,
  // vertically placed so it sits in the upper ~60% of the frame.
  const ovalRx = (width * 0.75) / 2;
  const ovalRy = ovalRx * 1.2;
  const ovalCx = width / 2;
  const ovalCy = height * 0.42;

  const handleCapture = async () => {
    if (step !== 'idle' || !cameraRef.current) return;

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (user && !isPremiumNow()) {
        const count = await getMonthlyCount('skin_scans', user.id);
        if (count >= 3) {
          setUpsellOpen(true);
          return;
        }
      }
    } catch {}

    setStep('analyzing');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (!photo.base64) throw new Error('base64 없음');
      const result = await runAnalysis(photo.base64);
      track('scan_completed', { scan_type: 'face' });
      await handleFirstScanCompleted();
      navigation.navigate('ScanResult', { result });
    } catch (e: any) {
      console.error('[handleCapture] error:', e);
      setStep('idle');
      Alert.alert('분석 실패', __DEV__ ? (e?.message ?? String(e)) : '다시 시도해 주세요.');
    }
  };

  const handleMockCapture = () => {
    const mockResult: ScanAnalysisResult = {
      overallScore: 72,
      skinType: '복합성',
      hydrationLevel: '보통',
      zones: {
        forehead: { status: '번들거림', score: 60 },
        leftCheek: { status: '맑음', score: 82 },
        rightCheek: { status: '건조함', score: 70 },
        nose: { status: '모공넓음', score: 55 },
        chin: { status: '맑음', score: 80 },
      },
      concerns: ['T존 피지 분비 과다', '볼 부위 수분 부족', '코 주변 모공 확대'],
      strengths: ['전반적인 피부 톤 균일', '볼 부위 결이 매끄러움'],
      ingredients: {
        recommended: ['나이아신아마이드', '판테놀', '세라마이드', '히알루론산', '아연'],
        avoid: ['알코올', '향료', '에센셜 오일'],
      },
      routineAdvice: {
        morning: '저자극 클렌저로 세안하고, 수분 토너 후 오일프리 수분크림을 발라요.\n자외선 차단제는 꼭 챙겨주세요.',
        evening: '이중 세안 후 나이아신아마이드 세럼으로 모공 케어해요.\n주 1회 클레이 마스크팩으로 T존을 관리해 주세요.',
      },
      summary: '복합성 피부로 T존 관리가 필요한 상태예요. 전반적인 피부 톤은 균일하니까,\n피지 조절 성분을 중심으로 루틴을 짜면 금세 맑아질 거예요. 함께 관리해봐요 💕',
    };
    void handleFirstScanCompleted().finally(() => {
      navigation.navigate('ScanResult', { result: mockResult });
    });
  };

  // ── 권한 미승인 ───────────────────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={Colors.accent} style={{ marginBottom: Spacing.sm }} />
        <Text style={styles.permissionTitle}>카메라 접근이 필요해요</Text>
        <Text style={styles.permissionDesc}>
          AI 피부 진단을 위해 카메라 권한을 허용해 주세요.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>권한 허용하기</Text>
        </TouchableOpacity>
        {__DEV__ && (
          <TouchableOpacity style={styles.mockBtn} onPress={handleMockCapture}>
            <Text style={styles.mockBtnText}>테스트 결과 보기 (DEV)</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  // ── 카메라 뷰 ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.cameraContainer} onLayout={handleContainerLayout}>
      <PremiumUpsellModal
        visible={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        onUpgrade={() => {
          setUpsellOpen(false);
          navigation.navigate('Paywall', { source: 'face_scan_limit' });
        }}
        subtitle="무료 플랜은 AI 피부 스캔을 월 3회까지 이용할 수 있어요."
      />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
      />

      {/* 상단 헤더 */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.headerTitle}>AI 피부 스캐너</Text>
        <Text style={styles.headerSub}>
          {step === 'analyzing'
            ? 'AI가 피부를 분석하고 있어요...'
            : '얼굴을 가이드 안에 맞춰 주세요'}
        </Text>
      </SafeAreaView>

      {/* 오발 가이드 + 딤 — SVG evenodd cutout, pink ellipse stroke */}
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
            stroke="#FF6B9D"
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      )}

      {/* 분석 중 오버레이 */}
      {step === 'analyzing' && (
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator color={Colors.surface} size="large" />
          <Text style={styles.analyzingText}>AI가 피부를 분석하고 있어요...</Text>
        </View>
      )}

      {/* 하단 캡처 영역 */}
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

      {/* 스캔 가이드 모달 */}
      <SkinScanGuideModal
        visible={showGuide}
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
  center: { flex: 1, backgroundColor: '#000' },

  // 권한 요청 화면
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  permissionTitle: { ...Typography.h2, textAlign: 'center' },
  permissionDesc: { ...Typography.bodySecondary, textAlign: 'center', lineHeight: 22 },
  permissionBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
  },
  permissionBtnText: { ...Typography.cta, color: Colors.surface },

  // 카메라 화면
  cameraContainer: { flex: 1, backgroundColor: '#000' },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Spacing.md,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.surface,
    letterSpacing: 0.3,
  },
  headerSub: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },

  // 분석 중 오버레이
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  analyzingText: {
    ...Typography.body,
    color: Colors.surface,
  },

  // 하단 캡처
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Spacing.xl,
    zIndex: 10,
    gap: Spacing.md,
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
  },
  mockBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.sm,
  },
  mockBtnText: {
    ...Typography.caption,
    color: Colors.surface,
  },
});
