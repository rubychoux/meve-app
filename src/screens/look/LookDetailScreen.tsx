import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, LookRecommendation, LookProduct } from '../../types';
import { openOliveYoungSearch } from '../../services/affiliate';

type Nav = NativeStackNavigationProp<MainStackParamList, 'LookDetail'>;
type Rt = RouteProp<MainStackParamList, 'LookDetail'>;

const ACCENT = '#FF6B9D';
const BLUE = '#6DA5C4';
const SAVED_KEY = 'meve_saved_looks';

type IconName = keyof typeof Ionicons.glyphMap;

// Map product categories → step order. Extras we don't have a step for
// (e.g. 하이라이터) fall back to step 5 ("마무리").
const STEP_MAP: { step: number; label: string; icon: IconName }[] = [
  { step: 1, label: '베이스 메이크업', icon: 'color-palette-outline' },
  { step: 2, label: '아이 메이크업', icon: 'eye-outline' },
  { step: 3, label: '치크', icon: 'flower-outline' },
  { step: 4, label: '립', icon: 'heart-outline' },
  { step: 5, label: '마무리', icon: 'sparkles-outline' },
];

const CATEGORY_TO_STEP: Record<string, number> = {
  베이스: 1,
  파운데이션: 1,
  쿠션: 1,
  아이: 2,
  섀도: 2,
  아이섀도: 2,
  아이라이너: 2,
  마스카라: 2,
  블러셔: 3,
  치크: 3,
  립: 4,
  립스틱: 4,
  립글로스: 4,
  하이라이터: 5,
  세팅: 5,
  마무리: 5,
};

function bucketByStep(products: LookProduct[]): Record<number, LookProduct[]> {
  const buckets: Record<number, LookProduct[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const p of products) {
    const step = CATEGORY_TO_STEP[p.category] ?? 5;
    buckets[step].push(p);
  }
  return buckets;
}

export function LookDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { look } = useRoute<Rt>().params;
  const [saving, setSaving] = useState(false);

  const stepBuckets = bucketByStep(look.products);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      const list: LookRecommendation[] = raw ? JSON.parse(raw) : [];
      // Dedupe by lookName — keep latest.
      const filtered = list.filter((l) => l.lookName !== look.lookName);
      filtered.unshift(look);
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
      Alert.alert('저장 완료', '저장된 룩에서 확인할 수 있어요 ✨');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const text = [
      `✨ ${look.lookName}`,
      ``,
      look.description,
      ``,
      `핵심 포인트:`,
      ...look.keyPoints.map((p) => `• ${p}`),
      ``,
      `컬러 키워드: ${look.colorKeyword}`,
      `난이도: ${look.difficulty}`,
      ``,
      `— meve에서 추천받았어요 💕`,
    ].join('\n');
    try {
      await Share.share({ message: text });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {look.lookName}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroBox}>
          <View style={styles.heroBadges}>
            <View style={styles.colorPill}>
              <Ionicons name="color-palette-outline" size={12} color="#C44777" />
              <Text style={styles.colorPillText}>{look.colorKeyword}</Text>
            </View>
            <View style={styles.diffPill}>
              <Text style={styles.diffPillText}>{look.difficulty}</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>{look.description}</Text>
        </View>

        <Text style={styles.sectionTitle}>STEP BY STEP</Text>

        {STEP_MAP.map((s) => {
          const items = stepBuckets[s.step];
          if (!items || items.length === 0) return null;
          return (
            <View key={s.step} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{s.step}</Text>
                </View>
                <Ionicons name={s.icon} size={16} color={ACCENT} />
                <Text style={styles.stepLabel}>{s.label}</Text>
              </View>

              {items.map((p, i) => (
                <View key={`${s.step}-${i}`} style={styles.productRow}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productCategory}>{p.category}</Text>
                    <Text style={styles.productName}>{p.name}</Text>
                  </View>
                  <Text style={styles.productTip}>{p.tip}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      openOliveYoungSearch(p.name, {
                        source: 'look_detail_product',
                        item_name: p.name,
                      })
                    }
                  >
                    <Text style={styles.oliveLink}>올리브영에서 보기 →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>이 룩 저장하기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={16} color={BLUE} />
          <Text style={styles.shareBtnText}>공유하기</Text>
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
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  content: { padding: 20, paddingBottom: 60, gap: 12 },

  heroBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 10,
  },
  heroBadges: { flexDirection: 'row', gap: 8 },
  colorPill: {
    backgroundColor: '#FFC4D6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorPillText: { fontSize: 11, fontWeight: '700', color: '#C44777' },
  diffPill: {
    backgroundColor: '#F0E6EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  diffPillText: { fontSize: 11, fontWeight: '700', color: '#2D2D2D' },
  heroDesc: { fontSize: 14, color: '#2D2D2D', lineHeight: 21 },

  sectionTitle: {
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
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0E6EC',
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepLabel: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },

  productRow: {
    backgroundColor: '#FFF5F9',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C44777',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  productName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#2D2D2D' },
  productTip: { fontSize: 12, color: '#2D2D2D', lineHeight: 18 },
  oliveLink: { fontSize: 12, color: ACCENT, fontWeight: '600', marginTop: 4 },

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
