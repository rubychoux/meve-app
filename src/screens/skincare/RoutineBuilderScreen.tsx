// MEVE-254 — AI routine builder. 5-step flow:
//   1) collect existing products per category
//   2) GPT evaluates each one against the user's skin profile
//   3) for replace/add categories, surface 1-3 catalog suggestions (with GPT
//      + Olive Young search-URL fallback when product_catalog is empty/missing)
//   4) render the assembled AM/PM routine for confirmation
//   5) success state, back to home
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { fetchOpenAIWithTimeout, cleanJson } from '../../utils/openai';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'RoutineBuilder'>;

const ROUTINE_CATEGORIES = ['클렌저', '토너', '세럼', '크림', '선크림'] as const;

type EvaluationLevel = 'keep' | 'caution' | 'replace' | 'add';

interface ProductEntry {
  category: string;
  hasProduct: boolean;
  productName: string;
  evaluation?: EvaluationLevel;
  evaluationNote?: string;
  catalogSuggestions?: CatalogProduct[];
  selectedProduct?: string;
  selectedCatalogId?: string | null;
  selectedOliveyoungUrl?: string | null;
}

interface CatalogProduct {
  id: string;
  brand: string;
  name: string;
  price_krw: number;
  key_ingredients: string[];
  oliveyoung_url: string;
  image_emoji: string;
  rating: number;
}

interface RoutineStep {
  step: number;
  category: string;
  product: string;
  isExisting: boolean;
  catalogId: string | null;
  oliveyoungUrl: string | null;
  aiNote: string;
}

const EVAL_CONFIG: Record<
  EvaluationLevel,
  { icon: string; label: string; color: string }
> = {
  keep: { icon: '✅', label: '유지 추천', color: '#7CB798' },
  caution: { icon: '⚠️', label: '주의 필요', color: '#F0A500' },
  replace: { icon: '❌', label: '교체 추천', color: '#FF6B6B' },
  add: { icon: '➕', label: '추가 추천', color: '#2D3A6B' },
};

function oliveYoungSearchUrl(query: string): string {
  return `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(query)}`;
}

async function callOpenAIJson(prompt: string, maxTokens: number, timeoutMs: number) {
  const res = await fetchOpenAIWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    timeoutMs
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
  const content: string = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(cleanJson(content));
}

function categoryMatches(productName: string, category: string): boolean {
  const n = productName.toLowerCase();
  if (n.includes(category.toLowerCase())) return true;
  switch (category) {
    case '클렌저':
      return n.includes('클렌') || n.includes('cleanser');
    case '토너':
      return n.includes('토너') || n.includes('toner');
    case '세럼':
      return n.includes('세럼') || n.includes('앰플') || n.includes('serum');
    case '크림':
      return n.includes('크림') || n.includes('cream');
    case '선크림':
      return n.includes('선') || n.includes('spf') || n.includes('sunscreen');
    default:
      return false;
  }
}

export function RoutineBuilderScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<ProductEntry[]>(
    ROUTINE_CATEGORIES.map((cat) => ({
      category: cat,
      hasProduct: false,
      productName: '',
    }))
  );
  const [evaluating, setEvaluating] = useState(false);
  const [findingSuggestions, setFindingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill with products the user has already marked "good" via product_tracking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('product_tracking')
          .select('product_name, status')
          .eq('user_id', user.id)
          .eq('status', 'good');
        if (cancelled || !data || data.length === 0) return;
        setProducts((prev) =>
          prev.map((entry) => {
            const match = data.find((p: any) =>
              categoryMatches(p.product_name ?? '', entry.category)
            );
            return match
              ? { ...entry, hasProduct: true, productName: match.product_name }
              : entry;
          })
        );
      } catch {
        // product_tracking may not exist yet; just skip pre-fill.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProduct = <K extends keyof ProductEntry>(
    index: number,
    field: K,
    value: ProductEntry[K]
  ) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  // Step 1 → 2 — GPT evaluates each existing product.
  const evaluateProducts = async () => {
    setEvaluating(true);
    try {
      const existing = products.filter((p) => p.hasProduct && p.productName.trim());

      if (existing.length === 0) {
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            evaluation: 'add' as EvaluationLevel,
            evaluationNote: '추천 제품을 선택해봐요',
          }))
        );
        setStep(3);
        return;
      }

      const daysLeft = profile.eventDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000
            )
          )
        : null;

      const prompt = `피부 전문가로서 아래 유저의 현재 스킨케어 제품을 평가해주세요.

유저 피부 정보:
- 피부 타입: ${profile.skinType ?? '복합성'}
- 피부 고민: ${profile.skinConcerns?.join(', ') || '없음'}
- 스킨 스코어: ${profile.lastSkinScore ?? '미측정'}점
- 이벤트: ${profile.eventType ?? '없음'}${
        daysLeft != null ? ` D-${daysLeft}` : ''
      }

현재 사용 중인 제품:
${existing.map((p) => `- ${p.category}: ${p.productName}`).join('\n')}

각 제품을 평가해주세요. 반드시 JSON만 반환:
{
  "evaluations": [
    { "category": "클렌저", "evaluation": "keep", "note": "잘 맞는 제품이에요 (20자 이내, 해요체)" }
  ]
}

evaluation 값:
- "keep": 잘 맞음, 유지 추천
- "caution": 주의 필요하지만 당장 교체 불필요
- "replace": 교체 추천 (성분 문제 또는 피부 타입 부적합)`;

      let evalMap: Record<string, { evaluation: EvaluationLevel; note: string }> = {};
      try {
        const parsed = await callOpenAIJson(prompt, 800, 20_000);
        for (const ev of parsed?.evaluations ?? []) {
          if (ev?.category) {
            evalMap[ev.category] = {
              evaluation: (ev.evaluation as EvaluationLevel) ?? 'keep',
              note: ev.note ?? '평가 완료',
            };
          }
        }
      } catch {
        // Fall through; the per-entry mapping below applies safe defaults.
      }

      setProducts((prev) =>
        prev.map((p) => {
          if (p.hasProduct && p.productName.trim()) {
            const ev = evalMap[p.category];
            return {
              ...p,
              evaluation: ev?.evaluation ?? 'keep',
              evaluationNote: ev?.note ?? '유지해요',
            };
          }
          return {
            ...p,
            evaluation: 'add',
            evaluationNote: '추천 제품을 선택해봐요',
          };
        })
      );
      setStep(2);
    } finally {
      setEvaluating(false);
    }
  };

  // Step 2 → 3 — pull catalog suggestions (or GPT/search-url fallback) for
  // every replace/add category.
  const findSuggestions = async () => {
    setFindingSuggestions(true);
    try {
      const updated = [...products];
      for (let i = 0; i < updated.length; i++) {
        const entry = updated[i];
        if (entry.evaluation !== 'replace' && entry.evaluation !== 'add') continue;

        let catalogItems: CatalogProduct[] | null = null;
        try {
          const { data } = await supabase
            .from('product_catalog')
            .select(
              'id, brand, name, price_krw, key_ingredients, oliveyoung_url, image_emoji, rating'
            )
            .eq('category', entry.category)
            .contains('skin_types', [profile.skinType ?? '복합성'])
            .order('rating', { ascending: false })
            .limit(3);
          catalogItems = (data as CatalogProduct[]) ?? null;
        } catch {
          catalogItems = null;
        }

        if (catalogItems && catalogItems.length > 0) {
          updated[i] = { ...entry, catalogSuggestions: catalogItems };
          continue;
        }

        // GPT fallback — recommend a real Olive Young product, then construct
        // a search URL pointing at it.
        const fallbackPrompt = `${profile.skinType ?? '복합성'} 피부에 맞는 ${entry.category} 제품 1개만 추천해줘.
한국 올리브영에서 살 수 있는 실제 제품.
JSON만 반환: { "brand": "브랜드명", "name": "제품명", "price_krw": 가격, "reason": "이유 15자" }`;
        try {
          const rec = await callOpenAIJson(fallbackPrompt, 300, 10_000);
          const display = rec?.name ?? entry.category;
          updated[i] = {
            ...entry,
            catalogSuggestions: [
              {
                id: 'gpt',
                brand: rec?.brand ?? '',
                name: display,
                price_krw: typeof rec?.price_krw === 'number' ? rec.price_krw : 0,
                key_ingredients: [],
                oliveyoung_url: oliveYoungSearchUrl(display),
                image_emoji: '🧴',
                rating: 0,
              },
            ],
          };
        } catch {
          updated[i] = {
            ...entry,
            catalogSuggestions: [
              {
                id: 'search',
                brand: '',
                name: `${entry.category} 검색`,
                price_krw: 0,
                key_ingredients: [],
                oliveyoung_url: oliveYoungSearchUrl(entry.category),
                image_emoji: '🔍',
                rating: 0,
              },
            ],
          };
        }
      }
      setProducts(updated);
      setStep(3);
    } finally {
      setFindingSuggestions(false);
    }
  };

  const selectSuggestion = (categoryIndex: number, suggestion: CatalogProduct) => {
    const display = `${suggestion.brand} ${suggestion.name}`.trim();
    setProducts((prev) =>
      prev.map((p, i) =>
        i === categoryIndex
          ? {
              ...p,
              selectedProduct: display,
              selectedCatalogId:
                suggestion.id === 'gpt' || suggestion.id === 'search'
                  ? null
                  : suggestion.id,
              selectedOliveyoungUrl: suggestion.oliveyoung_url,
            }
          : p
      )
    );
  };

  // Build AM (클렌저 → 토너 → 세럼 → 선크림) and PM (클렌저 → 토너 → 세럼 → 크림).
  const buildFinalRoutine = () => {
    const amSteps: RoutineStep[] = [];
    const pmSteps: RoutineStep[] = [];
    const amCategories = ['클렌저', '토너', '세럼', '선크림'];
    const pmCategories = ['클렌저', '토너', '세럼', '크림'];

    const buildStep = (cat: string, stepNum: number): RoutineStep | null => {
      const entry = products.find((p) => p.category === cat);
      if (!entry) return null;
      if (entry.evaluation === 'keep' || entry.evaluation === 'caution') {
        return {
          step: stepNum,
          category: cat,
          product: entry.productName,
          isExisting: true,
          catalogId: null,
          oliveyoungUrl: null,
          aiNote: entry.evaluationNote ?? '',
        };
      }
      if (!entry.selectedProduct) return null;
      return {
        step: stepNum,
        category: cat,
        product: entry.selectedProduct,
        isExisting: false,
        catalogId: entry.selectedCatalogId ?? null,
        oliveyoungUrl: entry.selectedOliveyoungUrl ?? null,
        aiNote: entry.evaluationNote ?? '',
      };
    };

    amCategories.forEach((cat, i) => {
      const s = buildStep(cat, i + 1);
      if (s) amSteps.push(s);
    });
    pmCategories.forEach((cat, i) => {
      const s = buildStep(cat, i + 1);
      if (s) pmSteps.push(s);
    });
    return { amSteps, pmSteps };
  };

  const saveRoutine = async () => {
    setSaving(true);
    try {
      const { amSteps, pmSteps } = buildFinalRoutine();
      const daysLeft = profile.eventDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(profile.eventDate).getTime() - Date.now()) / 86_400_000
            )
          )
        : null;

      const routine = {
        am: amSteps,
        pm: pmSteps,
        confirmedAt: new Date().toISOString().split('T')[0],
        basedOn: {
          skinScore: profile.lastSkinScore,
          skinType: profile.skinType,
          eventType: profile.eventType,
          daysLeft,
        },
        changeHistory: [],
      };

      await AsyncStorage.setItem('meve_routine', JSON.stringify(routine));
      setStep(5);
    } catch {
      Alert.alert('오류', '루틴 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER STEPS ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>현재 쓰는 제품이 있나요?</Text>
      <Text style={styles.stepSub}>
        있으면 그대로 활용할게요. 없는 단계는 AI가 추천해드려요.
      </Text>
      {products.map((entry, i) => (
        <View key={entry.category} style={styles.productEntry}>
          <Text style={styles.productEntryCategory}>{entry.category}</Text>
          <View style={styles.productEntryToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, entry.hasProduct && styles.toggleBtnActive]}
              onPress={() => updateProduct(i, 'hasProduct', true)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  entry.hasProduct && styles.toggleBtnTextActive,
                ]}
              >
                있어요
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                !entry.hasProduct && styles.toggleBtnActiveGray,
              ]}
              onPress={() => updateProduct(i, 'hasProduct', false)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  !entry.hasProduct && styles.toggleBtnTextActive,
                ]}
              >
                없어요
              </Text>
            </TouchableOpacity>
          </View>
          {entry.hasProduct && (
            <TextInput
              style={styles.productNameInput}
              placeholder={`${entry.category} 제품명 입력`}
              placeholderTextColor="#C0C0CC"
              value={entry.productName}
              onChangeText={(v) => updateProduct(i, 'productName', v)}
            />
          )}
        </View>
      ))}
      <View style={styles.bottomBarInner}>
        <TouchableOpacity
          style={[styles.ctaBtn, evaluating && styles.ctaBtnDisabled]}
          onPress={evaluateProducts}
          disabled={evaluating}
          activeOpacity={0.85}
        >
          {evaluating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaBtnText}>AI 분석 시작하기 →</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>AI 제품 평가 결과</Text>
      <Text style={styles.stepSub}>내 피부 데이터를 기반으로 분석했어요</Text>
      {products.map((entry) => {
        const cfg = EVAL_CONFIG[entry.evaluation ?? 'keep'];
        return (
          <View key={entry.category} style={styles.evalCard}>
            <Text style={styles.evalIcon}>{cfg.icon}</Text>
            <View style={styles.evalContent}>
              <Text style={styles.evalCategory}>{entry.category}</Text>
              {entry.hasProduct ? (
                <Text style={styles.evalProductName}>{entry.productName}</Text>
              ) : null}
              <Text style={[styles.evalLabel, { color: cfg.color }]}>
                {cfg.label}
              </Text>
              <Text style={styles.evalNote}>{entry.evaluationNote}</Text>
            </View>
          </View>
        );
      })}
      <View style={styles.bottomBarInner}>
        <TouchableOpacity
          style={[styles.ctaBtn, findingSuggestions && styles.ctaBtnDisabled]}
          onPress={findSuggestions}
          disabled={findingSuggestions}
          activeOpacity={0.85}
        >
          {findingSuggestions ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaBtnText}>다음 — 제품 추천 받기 →</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStep3 = () => {
    const needsSuggestion = products.filter(
      (p) => p.evaluation === 'replace' || p.evaluation === 'add'
    );
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>교체/추가할 제품 선택</Text>
        <Text style={styles.stepSub}>각 단계에서 원하는 제품을 골라주세요</Text>
        {needsSuggestion.length === 0 ? (
          <View style={styles.allGoodState}>
            <Text style={styles.allGoodEmoji}>🎉</Text>
            <Text style={styles.allGoodText}>
              지금 쓰는 제품들이 모두 잘 맞아요!{'\n'}그대로 루틴을 확정할게요.
            </Text>
          </View>
        ) : (
          needsSuggestion.map((entry) => {
            const index = products.findIndex((p) => p.category === entry.category);
            return (
              <View key={entry.category} style={styles.suggestionSection}>
                <Text style={styles.suggestionCategory}>
                  {entry.evaluation === 'replace' ? '❌' : '➕'} {entry.category}
                </Text>
                {entry.evaluation === 'replace' && (
                  <Text style={styles.suggestionReplaceNote}>
                    기존: {entry.productName} — {entry.evaluationNote}
                  </Text>
                )}
                {(entry.catalogSuggestions ?? []).map((suggestion) => {
                  const display = `${suggestion.brand} ${suggestion.name}`.trim();
                  const isSelected = entry.selectedProduct === display;
                  return (
                    <View
                      key={suggestion.id + suggestion.name}
                      style={[
                        styles.suggestionCard,
                        isSelected && styles.suggestionCardSelected,
                      ]}
                    >
                      <View style={styles.suggestionCardTop}>
                        <Text style={styles.suggestionEmoji}>
                          {suggestion.image_emoji}
                        </Text>
                        <View style={styles.suggestionInfo}>
                          {suggestion.brand ? (
                            <Text style={styles.suggestionBrand}>
                              {suggestion.brand}
                            </Text>
                          ) : null}
                          <Text style={styles.suggestionName}>
                            {suggestion.name}
                          </Text>
                          {suggestion.price_krw > 0 && (
                            <Text style={styles.suggestionPrice}>
                              {suggestion.price_krw.toLocaleString()}원
                            </Text>
                          )}
                          {suggestion.rating > 0 && (
                            <Text style={styles.suggestionRating}>
                              ★ {suggestion.rating}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.suggestionCardBtns}>
                        <TouchableOpacity
                          style={styles.oliveyoungBtn}
                          onPress={() =>
                            Linking.openURL(suggestion.oliveyoung_url)
                          }
                          activeOpacity={0.85}
                        >
                          <Text style={styles.oliveyoungBtnText}>
                            올리브영 보기
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.selectBtn,
                            isSelected && styles.selectBtnActive,
                          ]}
                          onPress={() => selectSuggestion(index, suggestion)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.selectBtnText,
                              isSelected && styles.selectBtnTextActive,
                            ]}
                          >
                            {isSelected ? '선택됨 ✓' : '이걸로'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
        <View style={styles.bottomBarInner}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => setStep(4)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>최종 루틴 확인하기 →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderStep4 = () => {
    const { amSteps, pmSteps } = buildFinalRoutine();
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>내 맞춤 루틴 확정</Text>
        <Text style={styles.stepSub}>이 루틴으로 시작할까요?</Text>

        <View style={styles.routineSection}>
          <Text style={styles.routineSectionTitle}>☀️ AM 루틴</Text>
          {amSteps.map((s, i) => (
            <View key={`am-${i}`} style={styles.routineStepCard}>
              <Text style={styles.routineStepNum}>{i + 1}</Text>
              <View style={styles.routineStepContent}>
                <Text style={styles.routineStepCategory}>{s.category}</Text>
                <Text style={styles.routineStepProduct}>{s.product}</Text>
                {s.aiNote ? (
                  <Text style={styles.routineStepNote}>{s.aiNote}</Text>
                ) : null}
              </View>
              <Text style={s.isExisting ? styles.existingBadge : styles.newBadge}>
                {s.isExisting ? '기존' : '새로'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.routineSection}>
          <Text style={styles.routineSectionTitle}>🌙 PM 루틴</Text>
          {pmSteps.map((s, i) => (
            <View key={`pm-${i}`} style={styles.routineStepCard}>
              <Text style={styles.routineStepNum}>{i + 1}</Text>
              <View style={styles.routineStepContent}>
                <Text style={styles.routineStepCategory}>{s.category}</Text>
                <Text style={styles.routineStepProduct}>{s.product}</Text>
                {s.aiNote ? (
                  <Text style={styles.routineStepNote}>{s.aiNote}</Text>
                ) : null}
              </View>
              <Text style={s.isExisting ? styles.existingBadge : styles.newBadge}>
                {s.isExisting ? '기존' : '새로'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>왜 이 루틴인가요?</Text>
          {profile.lastSkinScore != null && (
            <Text style={styles.whyItem}>
              💙 스킨 스코어 {profile.lastSkinScore}점 기반
            </Text>
          )}
          {profile.skinType ? (
            <Text style={styles.whyItem}>💙 {profile.skinType} 피부 맞춤</Text>
          ) : null}
          {profile.eventType ? (
            <Text style={styles.whyItem}>
              💙 {profile.eventType} D-day 집중 케어
            </Text>
          ) : null}
          <Text style={styles.whyItem}>💙 피해야할 성분 배제</Text>
        </View>

        <View style={styles.bottomBarInner}>
          <TouchableOpacity
            style={[styles.ctaBtn, saving && styles.ctaBtnDisabled]}
            onPress={saveRoutine}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaBtnText}>이 루틴으로 확정하기 ✓</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setStep(3)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>← 제품 다시 선택</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderStep5 = () => (
    <View style={styles.completeState}>
      <Text style={styles.completeEmoji}>🎉</Text>
      <Text style={styles.completeTitle}>루틴이 확정됐어요!</Text>
      <Text style={styles.completeSub}>
        홈탭에서 매일 루틴을 체크할 수 있어요.{'\n'}루틴이 안 맞으면 언제든 변경 요청해봐요.
      </Text>
      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaBtnText}>홈으로 가기 →</Text>
      </TouchableOpacity>
    </View>
  );

  const totalSteps = 4;
  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  const canStepBack = step > 1 && step < 5;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            canStepBack ? setStep((s) => s - 1) : navigation.goBack()
          }
          hitSlop={8}
        >
          <Text style={styles.backBtn}>{canStepBack ? '←' : '✕'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI 맞춤 루틴 만들기</Text>
        <View style={{ width: 32 }} />
      </View>

      {step < 5 && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(step / totalSteps) * 100}%` },
            ]}
          />
        </View>
      )}

      {renderCurrentStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF5F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: { fontSize: 22, color: '#1A1A1F', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1F' },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(26,26,31,0.06)',
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: { height: 3, backgroundColor: '#2D3A6B', borderRadius: 2 },
  stepContent: { padding: 20, paddingBottom: 60 },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1F',
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 14,
    color: '#8A8A9A',
    marginBottom: 24,
    lineHeight: 20,
  },

  // Step 1
  productEntry: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  productEntryCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 10,
  },
  productEntryToggle: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  toggleBtnActive: { borderColor: '#2D3A6B', backgroundColor: '#E8F4FD' },
  toggleBtnActiveGray: { borderColor: '#C0C0CC', backgroundColor: '#F5F5FA' },
  toggleBtnText: { fontSize: 14, color: '#8A8A9A', fontWeight: '500' },
  toggleBtnTextActive: { color: '#1A1A1F', fontWeight: '700' },
  productNameInput: {
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1F',
  },

  // Step 2
  evalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  evalIcon: { fontSize: 24 },
  evalContent: { flex: 1 },
  evalCategory: { fontSize: 12, color: '#8A8A9A', marginBottom: 2 },
  evalProductName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1F',
    marginBottom: 4,
  },
  evalLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  evalNote: { fontSize: 13, color: '#5A5A7A' },

  // Step 3
  suggestionSection: { marginBottom: 20 },
  suggestionCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 6,
  },
  suggestionReplaceNote: {
    fontSize: 12,
    color: '#FF6B6B',
    marginBottom: 10,
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  suggestionCardSelected: {
    borderColor: '#2D3A6B',
    backgroundColor: '#E8F4FD',
  },
  suggestionCardTop: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  suggestionEmoji: { fontSize: 28 },
  suggestionInfo: { flex: 1 },
  suggestionBrand: { fontSize: 11, color: '#8A8A9A', marginBottom: 2 },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1F',
    marginBottom: 4,
  },
  suggestionPrice: { fontSize: 13, color: '#2D3A6B', fontWeight: '600' },
  suggestionRating: { fontSize: 11, color: '#F0A500' },
  suggestionCardBtns: { flexDirection: 'row', gap: 8 },
  oliveyoungBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  oliveyoungBtnText: { fontSize: 13, color: '#5A5A7A', fontWeight: '500' },
  selectBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2D3A6B',
    alignItems: 'center',
  },
  selectBtnActive: { backgroundColor: '#2D3A6B' },
  selectBtnText: { fontSize: 13, color: '#2D3A6B', fontWeight: '600' },
  selectBtnTextActive: { color: '#FFFFFF' },
  allGoodState: { alignItems: 'center', paddingVertical: 40 },
  allGoodEmoji: { fontSize: 48, marginBottom: 12 },
  allGoodText: {
    fontSize: 15,
    color: '#5A5A7A',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Step 4
  routineSection: { marginBottom: 20 },
  routineSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 10,
  },
  routineStepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  routineStepNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D3A6B',
    width: 24,
    textAlign: 'center',
  },
  routineStepContent: { flex: 1 },
  routineStepCategory: { fontSize: 11, color: '#8A8A9A', marginBottom: 2 },
  routineStepProduct: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1F',
    marginBottom: 2,
  },
  routineStepNote: { fontSize: 11, color: '#8A8A9A' },
  existingBadge: {
    fontSize: 10,
    color: '#7CB798',
    fontWeight: '700',
    backgroundColor: '#F0FFF4',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  newBadge: {
    fontSize: 10,
    color: '#2D3A6B',
    fontWeight: '700',
    backgroundColor: '#E8F4FD',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  whyCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  whyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 10,
  },
  whyItem: {
    fontSize: 13,
    color: '#5A5A7A',
    marginBottom: 6,
    lineHeight: 20,
  },

  // Step 5
  completeState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  completeEmoji: { fontSize: 64, marginBottom: 16 },
  completeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1F',
    marginBottom: 10,
  },
  completeSub: {
    fontSize: 14,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  // Common
  bottomBarInner: { marginTop: 24 },
  ctaBtn: {
    backgroundColor: '#2D3A6B',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  ctaBtnDisabled: { backgroundColor: '#C0C0CC' },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryBtn: { alignItems: 'center', padding: 12 },
  secondaryBtnText: { fontSize: 14, color: '#8A8A9A' },
});
