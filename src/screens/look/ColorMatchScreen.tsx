// MEVE-232 Color Match — scan tester photo, AI compares to user's beauty profile.
// Storage bucket 'product-photos' (public read) is set up via migration.
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList } from '../../types';
import { cleanJson, fetchOpenAIWithTimeout, friendlyAIErrorMessage } from '../../utils/openai';
import { useBeautyProfile } from '../../stores/beautyProfileStore';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ColorMatch'>;

const PINK = '#FF6B9D';
const BUCKET = 'product-photos';

type Mode = 'scan' | 'mine';
type ProductType = '립' | '아이' | '볼터치' | '하이라이터' | '기타';

const PRODUCT_TYPES: { key: ProductType; label: string; emoji: string }[] = [
  { key: '립', label: '립', emoji: '💋' },
  { key: '아이', label: '아이', emoji: '👁️' },
  { key: '볼터치', label: '볼터치', emoji: '🌸' },
  { key: '하이라이터', label: '하이라이터', emoji: '✨' },
  { key: '기타', label: '기타', emoji: '✨' },
];

const SCORE_STYLES: Record<
  string,
  { color: string; bg: string; emoji: string; label: string }
> = {
  강추: { color: '#7CB798', bg: '#EAF7EE', emoji: '💚', label: '강추예요!' },
  추천: { color: '#5BA3D9', bg: '#E8F4FD', emoji: '💙', label: '추천해요!' },
  보통: { color: '#FFB347', bg: '#FFF4E6', emoji: '🧡', label: '보통이에요' },
  비추: { color: '#FF6B6B', bg: '#FFECEC', emoji: '💔', label: '비추예요' },
};

interface ExtractedColor {
  name: string;
  hex: string;
  finish: string;
  tone: string;
}

interface AnalyzeResult {
  extractedColors: ExtractedColor[];
  productType: string;
  personalColorMatch: boolean;
  personalColorScore: number;
  personalColorReason: string;
  vibeMatch: boolean;
  vibeScore: number;
  vibeReason: string;
  isDuplicate: boolean;
  duplicateReason: string;
  overallScore: '강추' | '추천' | '보통' | '비추';
  recommendation: string;
  alternativeSuggestion: string;
}

interface SavedProduct {
  id: string;
  user_id: string;
  product_name: string | null;
  brand: string | null;
  product_type: string | null;
  colors: ExtractedColor[];
  photo_url: string | null;
  created_at: string;
}

// ─── Color Match Screen ─────────────────────────────────────────────────────

export function ColorMatchScreen() {
  const navigation = useNavigation<Nav>();
  const personalColor = useBeautyProfile((s) => s.personalColor);
  const vibe = useBeautyProfile((s) => s.vibe);

  const [mode, setMode] = useState<Mode>('scan');

  // Scan mode state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [productType, setProductType] = useState<ProductType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  // Save bottom sheet state
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveBrand, setSaveBrand] = useState('');
  const [saving, setSaving] = useState(false);

  // My colors state
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'전체' | ProductType>('전체');

  const resetScan = () => {
    setPhotoUri(null);
    setProductType(null);
    setResult(null);
    setSaveName('');
    setSaveBrand('');
  };

  // ── Photo input ──────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요해요.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!r.canceled && r.assets[0]) {
      setPhotoUri(r.assets[0].uri);
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 찍으려면 카메라 접근 권한이 필요해요.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!r.canceled && r.assets[0]) {
      setPhotoUri(r.assets[0].uri);
      setResult(null);
    }
  };

  // ── Load existing products (for my-colors tab + duplicate check) ─────────
  const loadProducts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProducts([]);
        setProductsLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from('my_color_products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const normalized: SavedProduct[] = rows.map((r) => ({
        ...r,
        colors: Array.isArray(r.colors) ? (r.colors as ExtractedColor[]) : [],
      }));
      setProducts(normalized);
    } catch (e: any) {
      console.warn('[ColorMatch] loadProducts error:', e?.message);
    } finally {
      setProductsLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  // ── Analyze ──────────────────────────────────────────────────────────────
  const analyze = async () => {
    if (!photoUri || !productType || analyzing) return;
    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const existingColors = products.flatMap((p) =>
        p.colors.map((c) => ({ name: c.name, hex: c.hex, type: p.product_type }))
      );

      const prompt = `Analyze this makeup product/tester photo and the user's beauty profile.

User profile:
- Personal color: ${personalColor ?? '미분석'}
- Makeup style (추구미): ${vibe ?? '미선택'}
- Detected product category: ${productType}
- Existing color products: ${JSON.stringify(existingColors)}

Return ONLY valid JSON (no markdown):
{
  "extractedColors": [
    { "name": "색상 이름 한국어 (예: 코럴 핑크, 버건디, 누드 베이지)", "hex": "#XXXXXX", "finish": "매트 | 글로우 | 시머 | 글리터 | 새틴", "tone": "쿨톤 | 웜톤 | 뉴트럴" }
  ],
  "productType": "립 | 아이섀도우 | 블러셔 | 하이라이터 | 기타",
  "personalColorMatch": true,
  "personalColorScore": 0,
  "personalColorReason": "퍼스널컬러 매칭 이유 1줄 한국어",
  "vibeMatch": true,
  "vibeScore": 0,
  "vibeReason": "추구미 어울림 이유 1줄 한국어",
  "isDuplicate": false,
  "duplicateReason": "중복이면 어떤 기존 색상과 비슷한지 설명",
  "overallScore": "강추 or 추천 or 보통 or 비추",
  "recommendation": "최종 추천 멘트 2-3줄 해요체, 구체적으로",
  "alternativeSuggestion": "더 잘 어울리는 색상 계열 제안 한국어 1줄"
}`;

      const res = await fetchOpenAIWithTimeout('https://api.openai.com/v1/chat/completions', {
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
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      }
      const content: string = data.choices[0].message.content ?? '';
      let parsed: AnalyzeResult;
      try {
        parsed = JSON.parse(cleanJson(content)) as AnalyzeResult;
      } catch {
        console.warn('[ColorMatch] non-JSON:', content.slice(0, 200));
        throw new Error('분석 결과를 읽지 못했어요. 다시 시도해 주세요.');
      }
      setResult(parsed);
    } catch (e: any) {
      Alert.alert('분석 실패', friendlyAIErrorMessage(e), [
        { text: '다시 시도', onPress: () => analyze() },
        { text: '취소', style: 'cancel' },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Save product ─────────────────────────────────────────────────────────
  const uploadPhoto = async (uri: string, userId: string): Promise<string> => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const path = `${userId}/${Date.now()}.jpg`;
    const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, byteArray, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!photoUri || !result || !productType || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');
      const photoUrl = await uploadPhoto(photoUri, user.id);
      const { error } = await supabase.from('my_color_products').insert({
        user_id: user.id,
        product_name: saveName.trim() || null,
        brand: saveBrand.trim() || null,
        product_type: productType,
        colors: result.extractedColors,
        photo_url: photoUrl,
      });
      if (error) throw error;
      setSaveOpen(false);
      Alert.alert('저장 완료', '내 컬러 팔레트에 추가됐어요 ✨');
      resetScan();
      await loadProducts();
      setMode('mine');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete product ───────────────────────────────────────────────────────
  const deleteProduct = (p: SavedProduct) => {
    Alert.alert('삭제', '이 제품을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('my_color_products')
              .delete()
              .eq('id', p.id);
            if (error) throw error;
            setProducts((prev) => prev.filter((x) => x.id !== p.id));
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '다시 시도해 주세요.');
          }
        },
      },
    ]);
  };

  // ── Derived (my colors) ──────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (categoryFilter === '전체') return products;
    return products.filter((p) => p.product_type === categoryFilter);
  }, [products, categoryFilter]);

  const palette = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of products) {
      for (const c of p.colors) {
        const key = (c.hex ?? '').toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push(c.hex);
          if (out.length >= 12) return out;
        }
      }
    }
    return out;
  }, [products]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>컬러 매치 💄</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          내 퍼스널컬러에 맞는 색상인지 확인해봐요
        </Text>

        {/* Mode tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === 'scan' && styles.tabActive]}
            onPress={() => setMode('scan')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'scan' && styles.tabTextActive]}>
              테스터 스캔
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'mine' && styles.tabActive]}
            onPress={() => setMode('mine')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'mine' && styles.tabTextActive]}>
              내 컬러
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'scan' ? (
          <ScanMode
            photoUri={photoUri}
            productType={productType}
            analyzing={analyzing}
            result={result}
            onTakePhoto={takePhoto}
            onPickGallery={pickFromGallery}
            onSelectType={setProductType}
            onAnalyze={analyze}
            onReset={resetScan}
            onSavePress={() => setSaveOpen(true)}
          />
        ) : (
          <MineMode
            products={filteredProducts}
            allProducts={products}
            palette={palette}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            onDelete={deleteProduct}
            onAddNew={() => setMode('scan')}
            loaded={productsLoaded}
          />
        )}
      </ScrollView>

      {/* Save bottom sheet */}
      <Modal
        visible={saveOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSaveOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetBackdrop}
        >
          <TouchableOpacity
            style={styles.sheetDismiss}
            activeOpacity={1}
            onPress={() => !saving && setSaveOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>제품 정보 저장</Text>

            <Text style={styles.sheetLabel}>제품명 (선택)</Text>
            <TextInput
              style={styles.sheetInput}
              value={saveName}
              onChangeText={setSaveName}
              placeholder="예: 디올 어딕트 립글로우"
              placeholderTextColor="#B8AFB5"
              maxLength={60}
            />

            <Text style={styles.sheetLabel}>브랜드 (선택)</Text>
            <TextInput
              style={styles.sheetInput}
              value={saveBrand}
              onChangeText={setSaveBrand}
              placeholder="예: 디올"
              placeholderTextColor="#B8AFB5"
              maxLength={40}
            />

            <View style={styles.sheetTypeRow}>
              <Text style={styles.sheetLabel}>제품 종류</Text>
              <View style={styles.sheetTypeBadge}>
                <Text style={styles.sheetTypeBadgeText}>{productType}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.sheetCta, saving && { opacity: 0.65 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sheetCtaText}>저장하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Scan mode ────────────────────────────────────────────────────────────

interface ScanModeProps {
  photoUri: string | null;
  productType: ProductType | null;
  analyzing: boolean;
  result: AnalyzeResult | null;
  onTakePhoto: () => void;
  onPickGallery: () => void;
  onSelectType: (t: ProductType) => void;
  onAnalyze: () => void;
  onReset: () => void;
  onSavePress: () => void;
}

function ScanMode({
  photoUri,
  productType,
  analyzing,
  result,
  onTakePhoto,
  onPickGallery,
  onSelectType,
  onAnalyze,
  onReset,
  onSavePress,
}: ScanModeProps) {
  if (analyzing) {
    return (
      <View style={styles.analyzingWrap}>
        <ActivityIndicator color={PINK} size="large" />
        <Text style={styles.analyzingText}>색상을 분석하고 있어요... 💄</Text>
      </View>
    );
  }

  if (result) {
    const overall = SCORE_STYLES[result.overallScore] ?? SCORE_STYLES['보통'];
    return (
      <View style={{ gap: 14 }}>
        <View style={[styles.overallBadge, { backgroundColor: overall.bg }]}>
          <Text style={[styles.overallEmoji, { color: overall.color }]}>
            {overall.emoji}
          </Text>
          <Text style={[styles.overallLabel, { color: overall.color }]}>
            {overall.label}
          </Text>
        </View>

        {/* Extracted colors */}
        <View style={styles.swatchCard}>
          <Text style={styles.cardTitle}>추출된 색상</Text>
          <View style={styles.swatchRow}>
            {result.extractedColors.map((c, i) => (
              <View key={`${c.hex}-${i}`} style={styles.swatchItem}>
                <View
                  style={[
                    styles.swatchCircle,
                    { backgroundColor: c.hex ?? '#EEE' },
                  ]}
                />
                <Text style={styles.swatchName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Personal color */}
        <AnalysisCard
          title="퍼스널컬러 매칭"
          score={result.personalColorScore}
          match={result.personalColorMatch}
          reason={result.personalColorReason}
        />

        {/* Vibe */}
        <AnalysisCard
          title="추구미 어울림"
          score={result.vibeScore}
          match={result.vibeMatch}
          reason={result.vibeReason}
        />

        {/* Duplicate */}
        <View style={styles.cardOuter}>
          <Text style={styles.cardTitle}>기존 색상과 비교</Text>
          <Text style={[styles.cardStatus, { color: result.isDuplicate ? '#FFB347' : '#7CB798' }]}>
            {result.isDuplicate ? '⚠️ 비슷한 색이 있어요' : '✨ 새로운 색상이에요'}
          </Text>
          {!!result.duplicateReason && (
            <Text style={styles.cardReason}>{result.duplicateReason}</Text>
          )}
        </View>

        {/* Recommendation */}
        <View style={styles.recCard}>
          <Text style={styles.recTitle}>AI 추천 💕</Text>
          <Text style={styles.recBody}>{result.recommendation}</Text>
          {!!result.alternativeSuggestion && (
            <Text style={styles.recAlt}>
              💡 {result.alternativeSuggestion}
            </Text>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.primaryCta}
          onPress={onSavePress}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryCtaText}>이 제품 저장하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryCta}
          onPress={onReset}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryCtaText}>다시 스캔하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Idle: photo input + product type + analyze button
  return (
    <View style={{ gap: 14 }}>
      {photoUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <TouchableOpacity
            style={styles.previewClear}
            onPress={() => onPickGallery()}
            hitSlop={8}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={onTakePhoto}
            activeOpacity={0.85}
          >
            <Text style={styles.photoBtnEmoji}>📸</Text>
            <Text style={styles.photoBtnText}>사진 찍기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={onPickGallery}
            activeOpacity={0.85}
          >
            <Text style={styles.photoBtnEmoji}>🖼️</Text>
            <Text style={styles.photoBtnText}>갤러리에서</Text>
          </TouchableOpacity>
        </View>
      )}

      {photoUri && (
        <>
          <Text style={styles.sectionLabel}>제품 종류</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
          >
            {PRODUCT_TYPES.map((t) => {
              const active = productType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typePill, active && styles.typePillActive]}
                  onPress={() => onSelectType(t.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.typePillText, active && styles.typePillTextActive]}
                  >
                    {t.label} {t.emoji}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryCta, !productType && { opacity: 0.5 }]}
            onPress={onAnalyze}
            disabled={!productType}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryCtaText}>AI 분석하기 →</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Mine mode ────────────────────────────────────────────────────────────

interface MineModeProps {
  products: SavedProduct[];
  allProducts: SavedProduct[];
  palette: string[];
  categoryFilter: '전체' | ProductType;
  onCategoryChange: (c: '전체' | ProductType) => void;
  onDelete: (p: SavedProduct) => void;
  onAddNew: () => void;
  loaded: boolean;
}

function MineMode({
  products,
  allProducts,
  palette,
  categoryFilter,
  onCategoryChange,
  onDelete,
  onAddNew,
  loaded,
}: MineModeProps) {
  if (!loaded) {
    return (
      <View style={styles.analyzingWrap}>
        <ActivityIndicator color={PINK} />
      </View>
    );
  }

  if (allProducts.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>아직 저장된 색상이 없어요 💄</Text>
        <Text style={styles.emptyDesc}>
          테스터를 스캔하고 저장해봐요
        </Text>
        <TouchableOpacity
          style={styles.primaryCta}
          onPress={onAddNew}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryCtaText}>+ 제품 등록하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {/* Palette summary */}
      {palette.length > 0 && (
        <View style={styles.paletteCard}>
          <Text style={styles.cardTitle}>내 컬러 팔레트</Text>
          <View style={styles.paletteRow}>
            {palette.map((hex) => (
              <View
                key={hex}
                style={[styles.paletteDot, { backgroundColor: hex }]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
      >
        {(['전체', '립', '아이', '볼터치', '하이라이터', '기타'] as const).map((c) => {
          const active = categoryFilter === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.typePill, active && styles.typePillActive]}
              onPress={() => onCategoryChange(c)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.typePillText, active && styles.typePillTextActive]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Products */}
      {products.length === 0 ? (
        <Text style={styles.emptyDesc}>이 카테고리엔 제품이 없어요</Text>
      ) : (
        products.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.productCard}
            activeOpacity={0.9}
            onLongPress={() => onDelete(p)}
          >
            {p.photo_url ? (
              <Image source={{ uri: p.photo_url }} style={styles.productThumb} />
            ) : (
              <View
                style={[
                  styles.productThumb,
                  { backgroundColor: p.colors[0]?.hex ?? '#FFF0F5' },
                ]}
              />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.productName} numberOfLines={1}>
                {p.product_name ?? '이름 없음'}
              </Text>
              {!!p.brand && (
                <Text style={styles.productBrand} numberOfLines={1}>
                  {p.brand}
                </Text>
              )}
              <View style={styles.productSwatches}>
                {p.colors.slice(0, 5).map((c, i) => (
                  <View
                    key={`${c.hex}-${i}`}
                    style={[
                      styles.productSwatch,
                      { backgroundColor: c.hex ?? '#EEE' },
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.productTypeTag}>
              <Text style={styles.productTypeTagText}>
                {p.product_type ?? '기타'}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={onAddNew}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ 새 제품 등록</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function AnalysisCard({
  title,
  score,
  match,
  reason,
}: {
  title: string;
  score: number;
  match: boolean;
  reason: string;
}) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text
          style={[
            styles.cardStatus,
            { color: match ? '#7CB798' : '#FF6B6B', fontSize: 16 },
          ]}
        >
          {match ? '✅' : '❌'}
        </Text>
      </View>
      <View style={styles.scoreBar}>
        <View style={[styles.scoreFill, { width: `${clamped}%` }]} />
      </View>
      <Text style={styles.cardScoreText}>{clamped}점</Text>
      {!!reason && <Text style={styles.cardReason}>{reason}</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  subtitle: { fontSize: 13, color: '#8A8A9A', lineHeight: 19 },

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0E6EC',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },
  tabTextActive: { color: PINK, fontWeight: '700' },

  photoButtons: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#FFF0F5',
    borderWidth: 2,
    borderColor: '#FFC4D6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnEmoji: { fontSize: 30 },
  photoBtnText: { fontSize: 13, color: PINK, fontWeight: '700' },

  previewWrap: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F0E6EC',
  },
  previewImage: { width: '100%', height: '100%' },
  previewClear: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 13,
    color: '#1A1A2E',
    fontWeight: '700',
    marginTop: 4,
  },

  typeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  typePillActive: {
    backgroundColor: '#FFF0F5',
    borderColor: PINK,
  },
  typePillText: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },
  typePillTextActive: { color: PINK, fontWeight: '700' },

  primaryCta: {
    height: 52,
    borderRadius: 50,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryCta: {
    height: 48,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaText: { color: PINK, fontSize: 13, fontWeight: '700' },

  // Analyzing
  analyzingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  analyzingText: { fontSize: 13, color: '#8A8A9A' },

  // Result
  overallBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    borderRadius: 20,
    gap: 4,
  },
  overallEmoji: { fontSize: 32 },
  overallLabel: { fontSize: 18, fontWeight: '800' },

  swatchCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 10,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchItem: { alignItems: 'center', gap: 4, width: 64 },
  swatchCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  swatchName: { fontSize: 11, color: '#1A1A2E', textAlign: 'center' },

  cardOuter: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  cardStatus: { fontSize: 13, fontWeight: '700' },
  cardReason: { fontSize: 12, color: '#666', lineHeight: 18 },
  scoreBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  scoreFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: PINK,
  },
  cardScoreText: { fontSize: 11, color: '#8A8A9A', fontWeight: '600' },

  recCard: {
    backgroundColor: '#FFF0F5',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFC4D6',
  },
  recTitle: { fontSize: 13, fontWeight: '700', color: PINK },
  recBody: { fontSize: 13, color: '#1A1A2E', lineHeight: 20 },
  recAlt: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 2 },

  // Mine mode
  paletteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 8,
  },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 12,
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFF0F5',
  },
  productName: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  productBrand: { fontSize: 12, color: '#8A8A9A' },
  productSwatches: { flexDirection: 'row', gap: 4, marginTop: 2 },
  productSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  productTypeTag: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
  },
  productTypeTagText: { fontSize: 11, color: PINK, fontWeight: '700' },

  fab: {
    height: 52,
    borderRadius: 50,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  emptyDesc: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    gap: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  sheetLabel: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '700',
    marginTop: 8,
  },
  sheetInput: {
    backgroundColor: '#F9F5F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A2E',
  },
  sheetTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sheetTypeBadge: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  sheetTypeBadgeText: { fontSize: 12, color: PINK, fontWeight: '700' },
  sheetCta: {
    marginTop: 14,
    height: 52,
    borderRadius: 50,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
