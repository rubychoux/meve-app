import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { AIScanStackParamList } from '../../types';
import { openOliveYoungSearch } from '../../services/affiliate';

type Nav = NativeStackNavigationProp<AIScanStackParamList, 'IngredientResult'>;
type Route = RouteProp<AIScanStackParamList, 'IngredientResult'>;

interface IngredientItem {
  name: string;
  status: 'safe' | 'caution' | 'avoid';
  reason: string;
}

interface ScanResult {
  productName: string | null;
  overallScore: number;
  summary: string;
  ingredients: IngredientItem[];
}

function scoreColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
}

function scoreLabel(score: number): string {
  if (score >= 80) return '안전해요';
  if (score >= 60) return '주의가 필요해요';
  return '피하는 게 좋아요';
}

function statusColor(s: 'safe' | 'caution' | 'avoid'): string {
  if (s === 'safe') return Colors.flagSafe;
  if (s === 'caution') return Colors.flagCaution;
  return Colors.flagAvoid;
}

function statusIcon(s: 'safe' | 'caution' | 'avoid'): keyof typeof Ionicons.glyphMap {
  if (s === 'safe') return 'checkmark-circle';
  if (s === 'caution') return 'alert-circle';
  return 'close-circle';
}

function statusLabel(s: 'safe' | 'caution' | 'avoid'): string {
  if (s === 'safe') return '안전';
  if (s === 'caution') return '주의';
  return '피하세요';
}

export function IngredientResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { imageBase64, result: preloadedResult } = route.params;

  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(!preloadedResult);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preloadedResult) {
      setResult(preloadedResult as ScanResult);
      setLoading(false);
    } else if (imageBase64) {
      analyzeImage();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const analyzeImage = async () => {
    setLoading(true);
    setError(null);
    try {
      const skinProfile = await AsyncStorage.getItem('meve_last_scan');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
                {
                  type: 'text',
                  text: `You are a Korean skincare ingredient expert.
Read the ingredient list from this product label.
User skin profile: ${skinProfile || 'unknown'}
Return ONLY valid JSON no markdown:
{
  "productName": "제품명 or null",
  "overallScore": 0-100,
  "summary": "한 줄 요약 in Korean",
  "ingredients": [
    {"name": "성분명", "status": "safe|caution|avoid", "reason": "이유 in Korean"}
  ]
}`,
                },
              ],
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);

      const content = data.choices[0].message.content.trim();
      const jsonMatch = content.match(/[{[][\s\S]*[}\]]/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');

      const parsed: ScanResult = JSON.parse(jsonMatch[0]);
      setResult(parsed);
    } catch (e: any) {
      console.error('[IngredientResult] error:', e);
      setError(e?.message ?? '분석에 실패했어요');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || saved || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');
      await supabase.from('products').insert({
        user_id: user.id,
        product_name: result.productName ?? '알 수 없는 제품',
        ingredients: result.ingredients,
        compatibility_score: result.overallScore,
        scan_result: result,
      });
      setSaved(true);
      Alert.alert('저장됐어요!');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.loadingText}>성분을 분석하고 있어요...</Text>
        <Text style={styles.loadingSubText}>잠시만 기다려주세요</Text>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !result) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
        <Text style={styles.errorTitle}>분석에 실패했어요</Text>
        <Text style={styles.errorDesc}>{error ?? '알 수 없는 오류가 발생했어요'}</Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity style={styles.retryBtn} onPress={analyzeImage}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtnOutline} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result ──────────────────────────────────────────────────────────────────
  const sc = scoreColor(result.overallScore);
  const safeItems = result.ingredients.filter((i) => i.status === 'safe');
  const cautionItems = result.ingredients.filter((i) => i.status === 'caution');
  const avoidItems = result.ingredients.filter((i) => i.status === 'avoid');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Score header */}
        <View style={styles.scoreSection}>
          <View style={[styles.scoreCircle, { borderColor: sc }]}>
            <Text style={[styles.scoreNumber, { color: sc }]}>{result.overallScore}</Text>
            <Text style={styles.scoreUnit}>점</Text>
          </View>
          <Text style={[styles.scoreLabel, { color: sc }]}>{scoreLabel(result.overallScore)}</Text>
          {result.productName && (
            <Text style={styles.productName}>{result.productName}</Text>
          )}
          <Text style={styles.summary}>{result.summary}</Text>
        </View>

        {/* Ingredient groups */}
        {avoidItems.length > 0 && (
          <View style={styles.groupSection}>
            <View style={styles.groupHeader}>
              <Ionicons name="close-circle" size={16} color={Colors.flagAvoid} />
              <Text style={[styles.groupTitle, { color: Colors.flagAvoid }]}>
                피하세요 ({avoidItems.length})
              </Text>
            </View>
            {avoidItems.map((item, i) => (
              <IngredientCard key={i} item={item} />
            ))}
          </View>
        )}

        {cautionItems.length > 0 && (
          <View style={styles.groupSection}>
            <View style={styles.groupHeader}>
              <Ionicons name="alert-circle" size={16} color={Colors.flagCaution} />
              <Text style={[styles.groupTitle, { color: Colors.flagCaution }]}>
                주의 ({cautionItems.length})
              </Text>
            </View>
            {cautionItems.map((item, i) => (
              <IngredientCard key={i} item={item} />
            ))}
          </View>
        )}

        {safeItems.length > 0 && (
          <View style={styles.groupSection}>
            <View style={styles.groupHeader}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.flagSafe} />
              <Text style={[styles.groupTitle, { color: Colors.flagSafe }]}>
                안전 ({safeItems.length})
              </Text>
            </View>
            {safeItems.map((item, i) => (
              <IngredientCard key={i} item={item} />
            ))}
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttons}>
          {result.productName && (
            <TouchableOpacity
              style={styles.oliveyoungBtn}
              onPress={() =>
                openOliveYoungSearch(result.productName!, { source: 'ingredient_result', item_name: result.productName! })
              }
            >
              <Text style={styles.oliveyoungText}>올리브영에서 보기 →</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, (saved || saving) && styles.saveBtnDone]}
            onPress={handleSave}
            disabled={saved || saving}
          >
            <Text style={styles.saveBtnText}>
              {saved ? '저장됐어요' : saving ? '저장 중...' : '저장하기'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.outlineBtnText}>다시 스캔하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => navigation.navigate('SkinHome')}
            >
              <Text style={styles.outlineBtnText}>홈으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Ingredient card component ─────────────────────────────────────────────────

function IngredientCard({ item }: { item: IngredientItem }) {
  const color = statusColor(item.status);
  return (
    <View style={[styles.ingredientCard, { borderLeftColor: color }]}>
      <View style={styles.ingredientHeader}>
        <Text style={styles.ingredientName}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
          <Ionicons name={statusIcon(item.status)} size={12} color={color} />
          <Text style={[styles.statusText, { color }]}>{statusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.ingredientReason}>{item.reason}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F9' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.md,
  },

  // Loading / error
  centerContainer: {
    flex: 1,
    backgroundColor: '#FDF6F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  loadingSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorTitle: { ...Typography.h3, textAlign: 'center' },
  errorDesc: { ...Typography.bodySecondary, textAlign: 'center', lineHeight: 22 },
  errorButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  retryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
  },
  retryBtnText: { ...Typography.cta, color: '#fff' },
  backBtnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
  },
  backBtnText: { ...Typography.cta, color: Colors.accent },

  // Score section
  scoreSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  scoreNumber: { fontSize: 28, fontWeight: '800' },
  scoreUnit: { fontSize: 12, color: Colors.textSecondary, alignSelf: 'flex-end', marginBottom: 4 },
  scoreLabel: { fontSize: 16, fontWeight: '700' },
  productName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  summary: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Groups
  groupSection: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { fontSize: 14, fontWeight: '700' },

  // Ingredient card
  ingredientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    gap: 4,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  ingredientReason: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // Buttons
  buttons: { gap: Spacing.sm, marginTop: Spacing.md },
  oliveyoungBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  oliveyoungText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: Colors.success },
  saveBtnText: { ...Typography.cta, color: '#fff' },
  bottomRow: { flexDirection: 'row', gap: Spacing.md },
  outlineBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineBtnText: { ...Typography.cta, color: Colors.accent },
});
