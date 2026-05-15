// MEVE-252 — Product reaction tracking. One screen, three modes:
//   - 'start'   : begin tracking a new product
//   - 'checkin' : 7-day reaction check-in (requires trackingId)
//   - 'history' : list user's tracked products
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
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { fetchOpenAIWithTimeout, cleanJson } from '../../utils/openai';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ProductTracking'>;
type Route = RouteProp<MainStackParamList, 'ProductTracking'>;

type ScreenMode = 'start' | 'checkin' | 'history';
type ReactionStatus = 'good' | 'neutral' | 'bad';

interface ProductTrackingRow {
  id: string;
  user_id: string;
  product_name: string;
  product_catalog_id: string | null;
  started_at: string;
  status: 'tracking' | 'good' | 'neutral' | 'bad' | 'stopped';
  user_review: string | null;
  ai_analysis: string | null;
  reaction_checked_at: string | null;
  created_at: string;
}

const REACTION_OPTIONS: Array<{
  label: string;
  value: ReactionStatus;
  color: string;
  bg: string;
}> = [
  { label: '😊 잘 맞아요', value: 'good', color: '#7CB798', bg: '#F0FFF4' },
  { label: '😐 변화없음', value: 'neutral', color: '#8A8A9A', bg: '#F5F5FA' },
  { label: '😟 안 맞는 것 같아요', value: 'bad', color: '#FF6B6B', bg: '#FFF0F0' },
];

const STATUS_CONFIG: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  tracking: { icon: '⚠️', label: '관찰 중', color: '#F0A500' },
  good: { icon: '✅', label: '잘 맞아요', color: '#7CB798' },
  neutral: { icon: '➖', label: '변화없음', color: '#8A8A9A' },
  bad: { icon: '❌', label: '안 맞음', color: '#FF6B6B' },
  stopped: { icon: '🚫', label: '사용 중단', color: '#C0C0CC' },
};

// Best-effort lookup. If the catalog table is missing or no row matches we
// silently fall back to "no catalog match" so tracking still works.
async function lookupCatalog(productName: string): Promise<{
  id: string;
  name?: string;
  brand?: string;
  key_ingredients?: string[];
} | null> {
  try {
    const { data } = await supabase
      .from('product_catalog')
      .select('id, name, brand, key_ingredients')
      .ilike('name', `%${productName}%`)
      .limit(1)
      .maybeSingle();
    return (data as any) ?? null;
  } catch {
    return null;
  }
}

export function ProductTrackingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const screenMode: ScreenMode = route.params?.mode ?? 'history';
  const trackingId: string | undefined = route.params?.trackingId;

  // start mode
  const [productName, setProductName] = useState('');
  const [startLoading, setStartLoading] = useState(false);

  // checkin mode
  const [reaction, setReaction] = useState<ReactionStatus | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [trackingItem, setTrackingItem] = useState<ProductTrackingRow | null>(null);

  // history mode
  const [trackingList, setTrackingList] = useState<ProductTrackingRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setTrackingList([]);
        return;
      }
      const { data, error } = await supabase
        .from('product_tracking')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTrackingList((data as ProductTrackingRow[]) ?? []);
    } catch (e: any) {
      Alert.alert('불러오기 실패', e?.message ?? '잠시 후 다시 시도해주세요');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTrackingItem = async () => {
    if (!trackingId) return;
    try {
      const { data, error } = await supabase
        .from('product_tracking')
        .select('*')
        .eq('id', trackingId)
        .maybeSingle();
      if (error) throw error;
      setTrackingItem((data as ProductTrackingRow) ?? null);
    } catch (e: any) {
      Alert.alert('불러오기 실패', e?.message ?? '잠시 후 다시 시도해주세요');
    }
  };

  useEffect(() => {
    if (screenMode === 'history') loadHistory();
    if (screenMode === 'checkin' && trackingId) loadTrackingItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenMode, trackingId]);

  const handleStartTracking = async () => {
    if (!productName.trim()) return;
    setStartLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const catalogMatch = await lookupCatalog(productName.trim());

      const { error } = await supabase.from('product_tracking').insert({
        user_id: user.id,
        product_name: productName.trim(),
        product_catalog_id: catalogMatch?.id ?? null,
        started_at: new Date().toISOString().split('T')[0],
        status: 'tracking',
      });

      if (error) throw error;

      Alert.alert(
        '추적 시작! 💙',
        `${productName} 추적을 시작했어요.\n7일 후에 반응을 확인해드릴게요.`,
        [{ text: '확인', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '저장에 실패했어요');
    } finally {
      setStartLoading(false);
    }
  };

  const generateAIAnalysis = async (
    name: string,
    rxn: ReactionStatus,
    review: string,
    daysUsed: number
  ): Promise<string> => {
    const fallback =
      rxn === 'good'
        ? '피부와 잘 맞는 제품이에요. 꾸준히 사용해보세요.'
        : rxn === 'bad'
          ? '피부 반응이 있었어요. 잠시 사용을 중단하고 관찰해보세요.'
          : '확실한 효과가 나타나려면 조금 더 사용해보는 게 좋아요.';

    try {
      const catalogData = await lookupCatalog(name);
      const ingredientsInfo = catalogData?.key_ingredients?.length
        ? `주요 성분: ${catalogData.key_ingredients.join(', ')}`
        : '성분 정보 없음';

      const prompt = `피부 전문가로서 아래 상황을 분석해주세요.

제품명: ${name}
${ingredientsInfo}
사용 기간: ${daysUsed}일
유저 반응: ${rxn === 'good' ? '잘 맞음' : rxn === 'neutral' ? '변화없음' : '안 맞음'}
유저 후기: "${review || '없음'}"

이 반응에 대한 전문적인 설명을 2-3문장으로 해요체로 써주세요.
성분과 반응의 연관성을 설명하고, 다음 단계를 추천해주세요.
JSON으로만 답하세요. 다른 텍스트 없이.

{ "analysis": "분석 문장 (2-3문장, 해요체)" }`;

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
            max_tokens: 500,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        15_000
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? `OpenAI ${res.status}`);
      const content: string = json.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(cleanJson(content));
      return typeof parsed?.analysis === 'string' && parsed.analysis.trim()
        ? parsed.analysis.trim()
        : fallback;
    } catch {
      return fallback;
    }
  };

  const handleCheckin = async () => {
    if (!reaction || !trackingId) return;
    setCheckinLoading(true);
    try {
      const daysUsed = trackingItem
        ? Math.floor(
            (Date.now() - new Date(trackingItem.started_at).getTime()) / 86_400_000
          )
        : 7;

      const analysis = await generateAIAnalysis(
        trackingItem?.product_name ?? '',
        reaction,
        reviewText,
        daysUsed
      );
      setAiAnalysis(analysis);

      const newStatus: ProductTrackingRow['status'] =
        reaction === 'good' ? 'good' : reaction === 'bad' ? 'bad' : 'neutral';

      const { error } = await supabase
        .from('product_tracking')
        .update({
          status: newStatus,
          user_review: reviewText,
          ai_analysis: analysis,
          reaction_checked_at: new Date().toISOString(),
        })
        .eq('id', trackingId);
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '저장에 실패했어요');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleStopTracking = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_tracking')
        .update({ status: 'stopped' })
        .eq('id', id);
      if (error) throw error;
      loadHistory();
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '저장에 실패했어요');
    }
  };

  // ─── START MODE ────────────────────────────────────────────────────────────

  if (screenMode === 'start') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>새 제품 추적 시작</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.sectionTitle}>어떤 제품을 사용하기 시작했나요?</Text>
          <Text style={styles.sectionSub}>7일 후에 피부 반응을 확인해드려요</Text>

          <TextInput
            style={styles.productInput}
            placeholder="예) 라운드랩 1025 독도 세럼"
            placeholderTextColor="#C0C0CC"
            value={productName}
            onChangeText={setProductName}
            returnKeyType="done"
          />

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>📌 이렇게 활용해요</Text>
            <Text style={styles.infoCardItem}>• 새 제품 쓸 때마다 추적 시작</Text>
            <Text style={styles.infoCardItem}>• 7일 후 AI가 반응 확인 알림</Text>
            <Text style={styles.infoCardItem}>• 성분과 피부 반응 자동 연결</Text>
            <Text style={styles.infoCardItem}>• 트러블 원인 분석에 활용돼요</Text>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              (!productName.trim() || startLoading) && styles.ctaBtnDisabled,
            ]}
            onPress={handleStartTracking}
            disabled={!productName.trim() || startLoading}
            activeOpacity={0.85}
          >
            {startLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaBtnText}>추적 시작하기 💙</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── CHECKIN MODE ──────────────────────────────────────────────────────────

  if (screenMode === 'checkin') {
    if (aiAnalysis) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ width: 32 }} />
            <Text style={styles.headerTitle}>반응 분석 완료</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView style={styles.content} contentContainerStyle={{ padding: 24 }}>
            <View style={styles.analysisResultCard}>
              <Text style={styles.analysisResultIcon}>
                {reaction === 'good' ? '✅' : reaction === 'bad' ? '⚠️' : '➖'}
              </Text>
              <Text style={styles.analysisResultTitle}>
                {trackingItem?.product_name}
              </Text>
              <Text style={styles.analysisResultText}>{aiAnalysis}</Text>
            </View>

            {reaction === 'bad' && (
              <TouchableOpacity
                style={styles.stopBtn}
                onPress={async () => {
                  if (trackingId) {
                    await handleStopTracking(trackingId);
                    navigation.goBack();
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.stopBtnText}>사용 중단으로 표시하기</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => navigation.navigate('TroubleAnalysis')}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>원인 분석 보기 →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>돌아가기</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>제품 반응 체크인</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.productNameLarge}>
            {trackingItem?.product_name ?? '제품'}
          </Text>
          <Text style={styles.sectionSub}>
            사용한 지 7일이 됐어요. 피부 반응이 어땠나요?
          </Text>

          <View style={styles.reactionOptions}>
            {REACTION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.reactionCard,
                  reaction === opt.value && {
                    borderColor: opt.color,
                    backgroundColor: opt.bg,
                  },
                ]}
                onPress={() => setReaction(opt.value)}
                activeOpacity={0.85}
              >
                <Text style={styles.reactionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
            더 자세히 알려줄래요?
          </Text>
          <TextInput
            style={styles.reviewInput}
            multiline
            numberOfLines={4}
            placeholder="예) 처음엔 괜찮았는데 3일 후부터 턱 쪽에 뾰루지가 났어요..."
            placeholderTextColor="#C0C0CC"
            value={reviewText}
            onChangeText={setReviewText}
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              (!reaction || checkinLoading) && styles.ctaBtnDisabled,
            ]}
            onPress={handleCheckin}
            disabled={!reaction || checkinLoading}
            activeOpacity={0.85}
          >
            {checkinLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaBtnText}>AI 분석 받기 💙</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── HISTORY MODE ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 제품 반응 기록</Text>
        <TouchableOpacity
          onPress={() => navigation.push('ProductTracking', { mode: 'start' })}
          hitSlop={8}
        >
          <Text style={styles.addBtn}>+ 추가</Text>
        </TouchableOpacity>
      </View>

      {historyLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#5BA3D9" />
        </View>
      ) : trackingList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🧴</Text>
          <Text style={styles.emptyTitle}>추적 중인 제품이 없어요</Text>
          <Text style={styles.emptyDesc}>새 제품 쓸 때마다 추적을 시작해봐요</Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { marginTop: 20, paddingHorizontal: 24 }]}
            onPress={() => navigation.push('ProductTracking', { mode: 'start' })}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>+ 제품 추적 시작</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trackingList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => {
            const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.tracking;
            const daysUsed = Math.floor(
              (Date.now() - new Date(item.started_at).getTime()) / 86_400_000
            );
            const needsCheckin = item.status === 'tracking' && daysUsed >= 7;

            return (
              <View style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyIcon}>{config.icon}</Text>
                  <View style={styles.historyMeta}>
                    <Text style={styles.historyProductName}>{item.product_name}</Text>
                    <Text style={[styles.historyStatus, { color: config.color }]}>
                      {config.label} · {daysUsed}일째
                    </Text>
                  </View>
                </View>

                {item.ai_analysis && (
                  <Text style={styles.historyAnalysis}>{item.ai_analysis}</Text>
                )}

                {needsCheckin && (
                  <TouchableOpacity
                    style={styles.checkinNowBtn}
                    onPress={() =>
                      navigation.push('ProductTracking', {
                        mode: 'checkin',
                        trackingId: item.id,
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={styles.checkinNowText}>
                      7일 됐어요! 반응 체크하기 →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF5F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: { fontSize: 22, color: '#1A1A1F', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1F' },
  addBtn: { fontSize: 15, color: '#2D3A6B', fontWeight: '600' },
  content: { flex: 1 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 8,
  },
  sectionSub: { fontSize: 14, color: '#8A8A9A', marginBottom: 20 },
  productInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    padding: 16,
    fontSize: 16,
    color: '#1A1A1F',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 14,
    padding: 16,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3A6B',
    marginBottom: 10,
  },
  infoCardItem: {
    fontSize: 13,
    color: '#5A5A7A',
    marginBottom: 6,
    lineHeight: 20,
  },
  productNameLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1F',
    marginBottom: 8,
  },
  reactionOptions: { gap: 10 },
  reactionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  reactionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1F' },
  reviewInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    padding: 16,
    fontSize: 15,
    color: '#1A1A1F',
    lineHeight: 24,
    minHeight: 120,
  },
  bottomBar: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,31,0.06)',
    backgroundColor: '#FBF5F6',
  },
  ctaBtn: {
    backgroundColor: '#2D3A6B',
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: '#C0C0CC' },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { fontSize: 15, color: '#8A8A9A' },
  stopBtn: {
    backgroundColor: '#FFF0F0',
    borderRadius: 50,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#FFD0D0',
  },
  stopBtnText: { fontSize: 15, color: '#FF6B6B', fontWeight: '600' },
  analysisResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  analysisResultIcon: { fontSize: 48, marginBottom: 12 },
  analysisResultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 12,
  },
  analysisResultText: {
    fontSize: 15,
    color: '#5A5A7A',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 8,
  },
  emptyDesc: { fontSize: 14, color: '#8A8A9A', textAlign: 'center' },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  historyIcon: { fontSize: 24 },
  historyMeta: { flex: 1 },
  historyProductName: { fontSize: 15, fontWeight: '700', color: '#1A1A1F' },
  historyStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  historyAnalysis: {
    fontSize: 13,
    color: '#5A5A7A',
    lineHeight: 20,
    marginBottom: 10,
  },
  checkinNowBtn: {
    backgroundColor: '#E8F4FD',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  checkinNowText: { fontSize: 13, fontWeight: '600', color: '#2D3A6B' },
});
