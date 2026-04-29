import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types';
import { openOliveYoungSearch } from '../../services/affiliate';

type Nav = NativeStackNavigationProp<MainStackParamList, 'InspoLookResult'>;
type Rt = RouteProp<MainStackParamList, 'InspoLookResult'>;

const ACCENT = '#FF6B9D';
const BLUE = '#6DA5C4';
const SAVED_KEY = 'meve_inspo_looks';

export function InspoLookResultScreen() {
  const navigation = useNavigation<Nav>();
  const { result, imageUri, keyword } = useRoute<Rt>().params;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { referenceAnalysis, personalizedGuide, summary } = result;

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      const list: Array<{
        savedAt: string;
        imageUri?: string;
        keyword?: string;
        result: typeof result;
      }> = raw ? JSON.parse(raw) : [];
      list.unshift({
        savedAt: new Date().toISOString(),
        imageUri,
        keyword,
        result,
      });
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(list));
      setSaved(true);
      Alert.alert('저장 완료', '인스포 룩이 저장됐어요 ✨');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const vibe = referenceAnalysis.overallVibe || keyword || '인스포';
    const message = `나도 ${vibe} 메이크업 하고 싶었는데, meve로 내 얼굴에 맞게 알아봤어요 ✨\nhttps://meve.app`;
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>인스포 분석 결과</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Section 1 — Reference summary */}
        <View style={styles.card}>
          <View style={styles.refHeader}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.refThumb} />
            ) : (
              <View style={[styles.refThumb, styles.refThumbEmpty]}>
                <Ionicons name="sparkles-outline" size={22} color={ACCENT} />
              </View>
            )}
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.vibePill}>
                <Text style={styles.vibePillText}>{referenceAnalysis.overallVibe}</Text>
              </View>
              <Text style={styles.summary}>{summary}</Text>
            </View>
          </View>

          <View style={styles.keyBox}>
            {referenceAnalysis.keyPoints.map((kp, i) => (
              <View key={i} style={styles.keyRow}>
                <Text style={styles.keyBullet}>•</Text>
                <Text style={styles.keyText}>{kp}</Text>
              </View>
            ))}
          </View>

          <View style={styles.featGrid}>
            <Feat label="베이스" value={referenceAnalysis.baseFinish} />
            <Feat label="눈매" value={referenceAnalysis.eyeStyle} />
            <Feat label="립 컬러" value={referenceAnalysis.lipColor} />
            <Feat label="립 질감" value={referenceAnalysis.lipTexture} />
            <Feat label="블러셔 위치" value={referenceAnalysis.blushPosition} />
            <Feat label="블러셔 컬러" value={referenceAnalysis.blushColor} />
          </View>
        </View>

        {/* Color adjustment card */}
        <View style={styles.adjustCard}>
          <Text style={styles.adjustTitle}>원본 → 내 버전</Text>
          <Text style={styles.adjustText}>{personalizedGuide.colorAdjustment}</Text>
          <Text style={[styles.adjustText, { marginTop: 8 }]}>
            {personalizedGuide.adjustments}
          </Text>
        </View>

        {/* Section 2 — Step by step */}
        <Text style={styles.stepSectionTitle}>STEP BY STEP</Text>

        {personalizedGuide.steps.map((s) => (
          <View key={s.step} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{s.step}</Text>
              </View>
              <Text style={styles.stepCategory}>{s.category}</Text>
            </View>
            <Text style={styles.stepInstruction}>{s.instruction}</Text>
            <View style={styles.hintRow}>
              <View style={styles.hintPill}>
                <Text style={styles.hintText}>{s.productHint}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  openOliveYoungSearch(s.productHint, {
                    source: 'inspo_look_result_step',
                    item_name: s.productHint,
                  })
                }
              >
                <Text style={styles.oliveLink}>올리브영에서 보기 →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Section 3 — Save / Share */}
        <TouchableOpacity
          style={[styles.saveBtn, (saving || saved) && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={saving || saved}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            {saved ? '저장됐어요 ✓' : '이 인스포 룩 저장하기'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={16} color={BLUE} />
          <Text style={styles.shareBtnText}>공유하기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.feat}>
      <Text style={styles.featLabel}>{label}</Text>
      <Text style={styles.featValue}>{value}</Text>
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
  content: { padding: 20, paddingBottom: 60, gap: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 10,
  },
  refHeader: { flexDirection: 'row', gap: 12 },
  refThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#FFF5F9',
  },
  refThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  vibePill: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  vibePillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  summary: { fontSize: 13, color: '#2D2D2D', lineHeight: 19 },

  keyBox: {
    backgroundColor: '#FFF5F9',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  keyRow: { flexDirection: 'row', gap: 6 },
  keyBullet: { fontSize: 13, color: '#2D2D2D' },
  keyText: { flex: 1, fontSize: 12, color: '#2D2D2D', lineHeight: 18 },

  featGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  feat: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFF5F9',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  featLabel: { fontSize: 11, color: '#9A8F97', fontWeight: '600' },
  featValue: { fontSize: 12, color: '#2D2D2D', lineHeight: 17 },

  adjustCard: {
    backgroundColor: '#FFC4D6',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  adjustTitle: { fontSize: 12, fontWeight: '800', color: '#C44777', letterSpacing: 0.4 },
  adjustText: { fontSize: 13, color: '#2D2D2D', lineHeight: 20 },

  stepSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1.2,
    marginTop: 6,
  },

  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F0E6EC',
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepCategory: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
  stepInstruction: { fontSize: 13, color: '#2D2D2D', lineHeight: 19 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  hintPill: {
    backgroundColor: '#F0E6EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hintText: { fontSize: 11, color: '#2D2D2D', fontWeight: '600' },
  oliveLink: { fontSize: 12, color: ACCENT, fontWeight: '600' },

  saveBtn: {
    marginTop: 6,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
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
