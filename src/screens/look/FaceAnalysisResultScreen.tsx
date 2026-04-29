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

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const { error } = await supabase.from('face_analysis').insert({
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
      });
      if (error) throw error;

      await AsyncStorage.multiSet([
        ['meve_personal_color', result.personalColor],
        ['meve_face_analysis', JSON.stringify(result)],
      ]);

      setSaved(true);
      Alert.alert('저장 완료', '분석 결과가 저장되었어요 ✨');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const message = [
      `✨ 나의 AI 얼굴 분석 결과 ✨`,
      ``,
      `얼굴형: ${result.faceShape}`,
      `퍼스널 컬러: ${result.personalColor} (${result.undertone})`,
      `눈매: ${result.eyeShape}, ${result.eyeTail}`,
      `입술: ${result.lipFullness}`,
      `피부톤: ${result.skinTone}`,
      ``,
      result.summary,
      ``,
      `— meve에서 분석했어요 💕`,
    ].join('\n');
    try {
      await Share.share({ message });
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
});
