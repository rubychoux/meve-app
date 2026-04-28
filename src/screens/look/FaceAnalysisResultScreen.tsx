import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList, FaceAnalysisResult } from '../../types';
import { useBeautyProfile } from '../../stores/beautyProfileStore';

type Nav = NativeStackNavigationProp<MainStackParamList, 'FaceAnalysisResult'>;
type Rt = RouteProp<MainStackParamList, 'FaceAnalysisResult'>;

const ACCENT = '#FF6B9D';
const BLUE = '#6DA5C4';

type IconName = keyof typeof Ionicons.glyphMap;

const MAKEUP_ITEMS: { key: 'foundation' | 'lip' | 'eye' | 'blush'; icon: IconName; label: string }[] = [
  { key: 'foundation', icon: 'color-palette-outline', label: '파운데이션' },
  { key: 'lip', icon: 'heart-outline', label: '립' },
  { key: 'eye', icon: 'eye-outline', label: '아이' },
  { key: 'blush', icon: 'flower-outline', label: '블러셔' },
];

export function FaceAnalysisResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { result } = route.params;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showCorrectionUI, setShowCorrectionUI] = useState(false);
  const updateFromFaceAnalysis = useBeautyProfile((s) => s.updateFromFaceAnalysis);

  // MEVE-233 — fallback handling for old cached results without these fields.
  const confidence = result.confidence ?? 100;
  const alternativeColor = result.alternativeColor ?? null;
  const alternativeConfidence = result.alternativeConfidence ?? 0;
  const confidenceColor =
    confidence >= 80 ? '#7CB798' : confidence >= 60 ? '#FFB347' : '#FF6B6B';

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const { data, error } = await supabase
        .from('face_analysis')
        .insert({
          user_id: user.id,
          face_shape: result.faceShape,
          personal_color: result.personalColor,
          undertone: result.undertone,
          eye_shape: result.eyeShape,
          eye_tail: result.eyeTail,
          lip_fullness: result.lipFullness,
          skin_tone: result.skinTone,
          makeup_recommendation: result.makeupRecommendation,
          color_palette: result.colorPalette,
          avoid_colors: result.avoidColors,
          summary: result.summary,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (data?.id) setSavedAnalysisId(data.id as string);

      await AsyncStorage.multiSet([
        ['meve_personal_color', result.personalColor],
        ['meve_face_analysis', JSON.stringify(result)],
      ]);
      await updateFromFaceAnalysis(result);

      setSaved(true);
      Alert.alert('저장 완료', '분석 결과가 저장되었어요 ✨');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleFeedback = async (isCorrect: boolean) => {
    setFeedbackGiven(true);
    try {
      if (savedAnalysisId) {
        await supabase
          .from('face_analysis')
          .update({ user_confirmed: isCorrect })
          .eq('id', savedAnalysisId);
      }
    } catch (e) {
      console.warn('[face_analysis] feedback save failed:', e);
    }
    if (!isCorrect) {
      setShowCorrectionUI(true);
    } else {
      Alert.alert('감사해요! 💕', '분석이 정확했군요. 더 나은 분석을 위해 노력할게요.');
    }
  };

  const saveCorrectedValue = async (
    field: 'personalColor' | 'faceShape' | 'eyeShape' | 'skinType',
    value: string
  ) => {
    try {
      if (savedAnalysisId) {
        const dbField =
          field === 'personalColor'
            ? 'corrected_personal_color'
            : field === 'faceShape'
              ? 'corrected_face_shape'
              : field === 'eyeShape'
                ? 'corrected_eye_shape'
                : 'corrected_skin_type';
        await supabase
          .from('face_analysis')
          .update({
            [dbField]: value,
            user_confirmed: false,
            correction_submitted_at: new Date().toISOString(),
          })
          .eq('id', savedAnalysisId);
      }

      const updateFn = useBeautyProfile.getState().updateFromFaceAnalysis;
      if (field === 'personalColor') {
        await updateFn({ personalColor: value });
        await AsyncStorage.setItem('meve_personal_color', value);
      } else if (field === 'faceShape') {
        await updateFn({ faceShape: value });
      } else if (field === 'eyeShape') {
        await updateFn({ eyeShape: value });
      } else if (field === 'skinType') {
        await updateFn({ skinTone: value });
      }

      Alert.alert('수정됐어요! 💕', '더 나은 분석을 위해 반영할게요.');
      setShowCorrectionUI(false);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const handleCorrectionCategory = (category: string) => {
    if (category === '퍼스널 컬러') {
      Alert.alert('퍼스널 컬러 수정', '실제 퍼스널 컬러를 선택해주세요', [
        { text: '봄 웜톤', onPress: () => saveCorrectedValue('personalColor', '봄 웜톤') },
        { text: '여름 쿨톤', onPress: () => saveCorrectedValue('personalColor', '여름 쿨톤') },
        { text: '가을 웜톤', onPress: () => saveCorrectedValue('personalColor', '가을 웜톤') },
        { text: '겨울 쿨톤', onPress: () => saveCorrectedValue('personalColor', '겨울 쿨톤') },
        { text: '취소', style: 'cancel' },
      ]);
    } else if (category === '얼굴형') {
      Alert.alert('얼굴형 수정', '실제 얼굴형을 선택해주세요', [
        { text: '계란형', onPress: () => saveCorrectedValue('faceShape', '계란형') },
        { text: '둥근형', onPress: () => saveCorrectedValue('faceShape', '둥근형') },
        { text: '각진형', onPress: () => saveCorrectedValue('faceShape', '각진형') },
        { text: '하트형', onPress: () => saveCorrectedValue('faceShape', '하트형') },
        { text: '긴형', onPress: () => saveCorrectedValue('faceShape', '긴형') },
        { text: '취소', style: 'cancel' },
      ]);
    } else if (category === '눈 타입') {
      Alert.alert('눈 타입 수정', '실제 눈 타입을 선택해주세요', [
        { text: '쌍꺼풀', onPress: () => saveCorrectedValue('eyeShape', '쌍꺼풀') },
        { text: '무쌍', onPress: () => saveCorrectedValue('eyeShape', '무쌍') },
        { text: '속쌍', onPress: () => saveCorrectedValue('eyeShape', '속쌍') },
        { text: '두꺼운쌍꺼풀', onPress: () => saveCorrectedValue('eyeShape', '두꺼운쌍꺼풀') },
        { text: '취소', style: 'cancel' },
      ]);
    } else if (category === '피부 타입') {
      Alert.alert('피부 타입 수정', '실제 피부 타입을 선택해주세요', [
        { text: '매우밝음', onPress: () => saveCorrectedValue('skinType', '매우밝음') },
        { text: '밝음', onPress: () => saveCorrectedValue('skinType', '밝음') },
        { text: '중간', onPress: () => saveCorrectedValue('skinType', '중간') },
        { text: '어두운편', onPress: () => saveCorrectedValue('skinType', '어두운편') },
        { text: '취소', style: 'cancel' },
      ]);
    }
  };

  const handleShare = async () => {
    const personalColor = result?.personalColor ?? '';
    const faceShape = result?.faceShape ?? '';
    try {
      await Share.share({
        message: `meve AI 얼굴 분석 결과 ✨\n\n퍼스널컬러: ${personalColor}\n얼굴형: ${faceShape}\n\nmeve로 내 퍼스널컬러를 분석해봤어요!\n앱 다운로드 → https://meve.app`,
        title: 'meve 얼굴 분석 결과 공유',
      });
    } catch {}
  };

  const makeupItems = MAKEUP_ITEMS.map((m) => ({
    ...m,
    text: result.makeupRecommendation[m.key],
  }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>얼굴 분석 결과</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Section 1 — Summary */}
        <Text style={styles.heroTitle}>{result.faceShape} 얼굴형이에요 ✨</Text>
        <Text style={styles.heroSummary}>{result.summary}</Text>

        {/* Section 2 — Personal color */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>퍼스널 컬러</Text>
          <View style={styles.pcRow}>
            <Text style={styles.pcType}>{result.personalColor}</Text>
            <View style={styles.undertoneTag}>
              <Text style={styles.undertoneText}>{result.undertone}</Text>
            </View>
          </View>

          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>분석 확신도</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${confidence}%`, backgroundColor: confidenceColor },
                ]}
              />
            </View>
            <Text style={[styles.confidenceValue, { color: confidenceColor }]}>
              {confidence}%
            </Text>
          </View>

          {alternativeColor && (
            <Text style={styles.alternativeText}>
              차선: {alternativeColor} ({alternativeConfidence}% 가능성)
            </Text>
          )}

          {confidence < 70 && (
            <View style={styles.lowConfidenceCard}>
              <Text style={styles.lowConfidenceText}>
                📸 손목 안쪽 사진을 추가하면 더 정확하게 분석할 수 있어요
              </Text>
              <TouchableOpacity
                style={styles.reAnalyzeBtn}
                onPress={() => navigation.navigate('FaceAnalysis')}
              >
                <Text style={styles.reAnalyzeBtnText}>사진 추가하고 재분석하기 →</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.paletteLabel}>추천 컬러 팔레트</Text>
          <View style={styles.paletteRow}>
            {result.colorPalette.map((hex) => (
              <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
            ))}
          </View>

          <Text style={[styles.paletteLabel, { marginTop: 12 }]}>피해요</Text>
          <View style={styles.paletteRow}>
            {result.avoidColors.map((hex) => (
              <View key={hex} style={styles.avoidWrap}>
                <View style={[styles.swatch, { backgroundColor: hex }]} />
                <View style={styles.avoidX}>
                  <Ionicons name="close" size={12} color="#fff" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Section 3 — Face features */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>얼굴형 + 이목구비</Text>
          <View style={styles.featRow}>
            <Feature label="얼굴형" value={result.faceShape} />
            <Feature label="눈 모양" value={result.eyeShape} />
          </View>
          <View style={styles.featRow}>
            <Feature label="눈꼬리" value={result.eyeTail} />
            <Feature label="입술" value={result.lipFullness} />
          </View>
        </View>

        {/* Section 4 — Makeup recommendations */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>메이크업 추천 가이드</Text>
          {makeupItems.map((m) => (
            <View key={m.key} style={styles.makeupCard}>
              <View style={styles.makeupHeader}>
                <Ionicons name={m.icon} size={18} color={ACCENT} />
                <Text style={styles.makeupLabel}>{m.label}</Text>
              </View>

              {m.key === 'foundation' && (result.foundationShade || result.skinToneHex) && (
                <View style={styles.shadeRow}>
                  {result.skinToneHex && (
                    <View
                      style={[styles.shadeSwatch, { backgroundColor: result.skinToneHex }]}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    {result.foundationShade && (
                      <Text style={styles.shadeLabel}>추천 호수</Text>
                    )}
                    <View style={styles.shadeValueRow}>
                      {result.foundationShade && (
                        <Text style={styles.shadeValue}>{result.foundationShade}</Text>
                      )}
                      {result.skinTone && (
                        <Text style={styles.shadeSub}>· 피부톤 {result.skinTone}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.makeupText}>{m.text}</Text>
            </View>
          ))}
        </View>

        {/* Section 5 — Save / Share */}
        <TouchableOpacity
          style={[styles.saveBtn, (saving || saved) && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={saving || saved}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {saved ? '저장됐어요 ✓' : '분석 결과 저장하기'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={16} color={BLUE} />
          <Text style={styles.shareBtnText}>공유하기</Text>
        </TouchableOpacity>

        {/* Section 6 — Feedback */}
        {!feedbackGiven && (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>이 분석이 맞나요?</Text>
            <View style={styles.feedbackRow}>
              <TouchableOpacity
                style={styles.feedbackBtnYes}
                onPress={() => handleFeedback(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.feedbackBtnText}>✅ 맞아요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackBtnNo}
                onPress={() => handleFeedback(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.feedbackBtnText}>❌ 아닌 것 같아요</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showCorrectionUI && (
          <View style={styles.correctionCard}>
            <Text style={styles.correctionTitle}>어떤 부분이 다른가요?</Text>
            {['퍼스널 컬러', '얼굴형', '눈 타입', '피부 타입'].map((category) => (
              <TouchableOpacity
                key={category}
                style={styles.correctionItem}
                onPress={() => handleCorrectionCategory(category)}
                activeOpacity={0.7}
              >
                <Text style={styles.correctionItemText}>{category}</Text>
                <Ionicons name="chevron-forward" size={16} color="#8A8A9A" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureLabel}>{label}</Text>
      <View style={styles.featurePill}>
        <Text style={styles.featurePillText}>{value}</Text>
      </View>
    </View>
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

  heroTitle: { fontSize: 22, fontWeight: '800', color: '#2D2D2D', marginTop: 4 },
  heroSummary: {
    fontSize: 14,
    color: '#2D2D2D',
    lineHeight: 21,
    marginBottom: 6,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 8,
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 0.5 },

  pcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  pcType: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  undertoneTag: {
    backgroundColor: '#FFC4D6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  undertoneText: { fontSize: 11, fontWeight: '700', color: '#C44777' },

  paletteLabel: { fontSize: 12, color: '#9A8F97', marginTop: 8, fontWeight: '600' },
  paletteRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  avoidWrap: { position: 'relative' },
  avoidX: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F08080',
    alignItems: 'center',
    justifyContent: 'center',
  },

  featRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  feature: { flex: 1, gap: 6 },
  featureLabel: { fontSize: 12, color: '#9A8F97' },
  featurePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  featurePillText: { fontSize: 13, fontWeight: '600', color: '#2D2D2D' },

  makeupCard: {
    backgroundColor: '#FFF5F9',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginTop: 4,
  },
  makeupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  makeupLabel: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
  makeupText: { fontSize: 13, color: '#2D2D2D', lineHeight: 19 },

  shadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFE0EC',
  },
  shadeSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  shadeLabel: { fontSize: 11, color: '#9A8F97', fontWeight: '600' },
  shadeValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  shadeValue: { fontSize: 16, fontWeight: '800', color: ACCENT },
  shadeSub: { fontSize: 12, color: '#8A8A9A' },

  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: BLUE },

  // Confidence + alternative
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#9A8F97',
    fontWeight: '600',
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 6,
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  alternativeText: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '500',
    marginTop: 4,
  },
  lowConfidenceCard: {
    marginTop: 10,
    backgroundColor: '#FFF5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC4D6',
    padding: 12,
    gap: 8,
  },
  lowConfidenceText: {
    fontSize: 13,
    color: '#5C525B',
    lineHeight: 18,
  },
  reAnalyzeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  reAnalyzeBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Feedback
  feedbackCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 10,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2D',
    textAlign: 'center',
  },
  feedbackRow: { flexDirection: 'row', gap: 10 },
  feedbackBtnYes: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E9F6EE',
    alignItems: 'center',
  },
  feedbackBtnNo: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FCEDED',
    alignItems: 'center',
  },
  feedbackBtnText: { fontSize: 13, fontWeight: '700', color: '#2D2D2D' },

  correctionCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 6,
  },
  correctionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  correctionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F5EFF3',
  },
  correctionItemText: { fontSize: 13, color: '#2D2D2D' },
});
