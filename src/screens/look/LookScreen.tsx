// MEVE-195 LOOK tab full redesign — 6 sections wired through beautyProfileStore.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/theme';
import { MainStackParamList } from '../../types';
import { supabase } from '../../services/supabase';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { cleanJson } from '../../utils/openai';
import { getEventConfig } from '../../constants/eventConfig';

const logo = require('../../../assets/images/meve-logo.png');

type Nav = NativeStackNavigationProp<MainStackParamList>;

const PINK = '#FF6B9D';

// ─── Constants ─────────────────────────────────────────────────────────────

const VIBES = ['청순', '글로우', '볼드', '내추럴', '빈티지', '클린걸', '테토녀', '에겐녀'] as const;
type VibeKey = (typeof VIBES)[number];

const VIBE_QUERIES: Record<VibeKey, string> = {
  청순: 'clean girl soft makeup korean',
  글로우: 'glow dewy glass skin makeup',
  볼드: 'bold dramatic makeup editorial',
  내추럴: 'natural nude minimal makeup',
  빈티지: 'retro vintage 90s makeup',
  클린걸: 'clean girl aesthetic minimal makeup',
  테토녀: 'cute tomboy casual korean makeup',
  에겐녀: 'cute kawaii korean makeup',
};

const PERSONAL_PALETTES: Record<string, string[]> = {
  '봄 웜톤': ['#FFB5A7', '#F8A195', '#E07B6B', '#C96A5A', '#FFCBA4', '#F4A460'],
  '여름 쿨톤': ['#B8D4E8', '#9FC3DC', '#7BA8C8', '#C4B8E0', '#E8B4D0', '#D4A0C0'],
  '가을 웜톤': ['#C8A882', '#B8956A', '#8B6914', '#CD853F', '#D2691E', '#A0522D'],
  '겨울 쿨톤': ['#E8E8F0', '#C8C8E0', '#9090C8', '#FF1493', '#DC143C', '#800020'],
};

const TODAYS_LOOK_KEY_PREFIX = 'meve_todays_look_';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TodaysLookData {
  lookTitle: string;
  lookDescription: string;
  keyColors: string[];
  unsplashQuery: string;
  steps: { category: string; tip: string }[];
  imageUrl?: string | null;
  generatedAt?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${TODAYS_LOOK_KEY_PREFIX}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchUnsplashImage(query: string): Promise<string | null> {
  const key = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait&client_id=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

async function fetchUnsplashImages(query: string, count: number): Promise<string[]> {
  const key = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait&client_id=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const urls: string[] = (data?.results ?? [])
      .map((r: any) => r?.urls?.regular)
      .filter(Boolean);
    return urls;
  } catch {
    return [];
  }
}

function olivePalette(personalColor: string | null): string[] {
  if (!personalColor) return [];
  return PERSONAL_PALETTES[personalColor] ?? [];
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Screen ────────────────────────────────────────────────────────────────

export function LookScreen() {
  const navigation = useNavigation<Nav>();
  const personalColor = useBeautyProfile((s) => s.personalColor);
  const faceShape = useBeautyProfile((s) => s.faceShape);
  const eyeType = useBeautyProfile((s) => s.eyeType);
  const vibe = useBeautyProfile((s) => s.vibe);
  const eventType = useBeautyProfile((s) => s.eventType);
  const eventDate = useBeautyProfile((s) => s.eventDate);
  const updateProfile = useBeautyProfile((s) => s.updateProfile);

  // Today's look
  const [todaysLook, setTodaysLook] = useState<TodaysLookData | null>(null);
  const [loadingLook, setLoadingLook] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // My color products palette (Section 2)
  const [myColorPalette, setMyColorPalette] = useState<string[]>([]);

  // Moodboard images (Section 5)
  const [moodImages, setMoodImages] = useState<string[]>([]);
  const [loadingMood, setLoadingMood] = useState(false);

  // Vibe selector modal (Section 5)
  const [vibePickerOpen, setVibePickerOpen] = useState(false);

  // Face analysis "last analyzed" timestamp (Section 6)
  const [faceAnalyzedAt, setFaceAnalyzedAt] = useState<string | null>(null);

  // ── Today's look ─────────────────────────────────────────────────────────
  const generateTodaysLook = useCallback(async () => {
    const key = todayKey();
    setLoadingLook(true);
    try {
      const daysLeft =
        eventDate
          ? Math.max(
              0,
              Math.ceil((new Date(eventDate).getTime() - Date.now()) / 86_400_000)
            )
          : null;

      const prompt = `You are a Korean makeup expert. Generate today's makeup look recommendation.

User profile:
- Personal color: ${personalColor ?? '미분석'}
- Makeup style: ${vibe ?? '내추럴'}
- Event: ${eventType ?? '없음'}${daysLeft != null ? ` D-${daysLeft}` : ''}
- Face shape: ${faceShape ?? '미분석'}

Return ONLY valid JSON (no markdown):
{
  "lookTitle": "오늘의 룩 제목 (예: 데이트 D-4를 위한 글로우 룩 💕)",
  "lookDescription": "2줄 설명 해요체",
  "keyColors": ["#hex1", "#hex2", "#hex3"],
  "unsplashQuery": "english search query for reference image (e.g. 'dewy glow makeup korean')",
  "steps": [
    {"category": "베이스", "tip": "1줄 팁 해요체"},
    {"category": "아이", "tip": "1줄 팁 해요체"},
    {"category": "립", "tip": "1줄 팁 해요체"}
  ]
}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 700,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      const parsed = JSON.parse(cleanJson(data.choices[0].message.content ?? '')) as TodaysLookData;

      // MEVE-244 — prefer event-specific Unsplash query when an event is set.
      const eventThemeConfig = getEventConfig(eventType);
      const queryFallback =
        eventThemeConfig?.unsplashQuery ??
        `${vibe ?? 'natural'} makeup korean beauty`;
      const imageUrl = await fetchUnsplashImage(
        parsed.unsplashQuery ?? queryFallback
      );

      const finalLook: TodaysLookData = {
        ...parsed,
        imageUrl,
        generatedAt: new Date().toISOString(),
      };
      setTodaysLook(finalLook);
      try {
        await AsyncStorage.setItem(key, JSON.stringify(finalLook));
      } catch {}
    } catch {
      // Silently leave todaysLook as null; UI shows graceful fallback below.
      setTodaysLook(null);
    } finally {
      setLoadingLook(false);
    }
  }, [personalColor, vibe, eventType, eventDate, faceShape]);

  const loadTodaysLook = useCallback(async () => {
    const key = todayKey();
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        setTodaysLook(JSON.parse(cached) as TodaysLookData);
        return;
      }
    } catch {}
    await generateTodaysLook();
  }, [generateTodaysLook]);

  useEffect(() => {
    loadTodaysLook();
  }, [loadTodaysLook]);

  // MEVE — when eventType changes, invalidate today's look cache + regenerate
  // so the look matches the new event theme immediately.
  const prevEventTypeRef = useRef(eventType);
  useEffect(() => {
    if (prevEventTypeRef.current === eventType) return;
    prevEventTypeRef.current = eventType;
    AsyncStorage.removeItem(todayKey()).catch(() => {});
    setTodaysLook(null);
    generateTodaysLook();
  }, [eventType, generateTodaysLook]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await AsyncStorage.removeItem(todayKey());
    } catch {}
    await generateTodaysLook();
    setRefreshing(false);
  };

  // ── Section 2: my color products palette ─────────────────────────────────
  const loadMyColorPalette = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMyColorPalette([]);
        return;
      }
      const { data } = await supabase
        .from('my_color_products')
        .select('colors, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const seen = new Set<string>();
      const out: string[] = [];
      for (const row of (data ?? []) as any[]) {
        const cs = Array.isArray(row.colors) ? row.colors : [];
        for (const c of cs) {
          const hex = (c?.hex ?? '').toLowerCase();
          if (hex && !seen.has(hex)) {
            seen.add(hex);
            out.push(c.hex);
            if (out.length >= 8) {
              setMyColorPalette(out);
              return;
            }
          }
        }
      }
      setMyColorPalette(out);
    } catch {
      setMyColorPalette([]);
    }
  }, []);

  // ── Section 5: moodboard images ──────────────────────────────────────────
  const loadMoodboard = useCallback(async (key: VibeKey) => {
    setLoadingMood(true);
    setMoodImages([]);
    try {
      const urls = await fetchUnsplashImages(VIBE_QUERIES[key], 6);
      setMoodImages(urls);
    } finally {
      setLoadingMood(false);
    }
  }, []);

  useEffect(() => {
    if (vibe && (VIBES as readonly string[]).includes(vibe)) {
      loadMoodboard(vibe as VibeKey);
    } else {
      setMoodImages([]);
    }
  }, [vibe, loadMoodboard]);

  // ── Section 6: face analysis last-analyzed timestamp ─────────────────────
  const loadFaceAnalyzedAt = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('face_analysis')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setFaceAnalyzedAt((data[0] as any).created_at ?? null);
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyColorPalette();
      loadFaceAnalyzedAt();
    }, [loadMyColorPalette, loadFaceAnalyzedAt])
  );

  // ── Vibe selector ────────────────────────────────────────────────────────
  const selectVibe = async (v: VibeKey) => {
    setVibePickerOpen(false);
    await updateProfile({ vibe: v });
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const palette = olivePalette(personalColor);
  const recommendedLip = palette[0] ?? null;
  const faceAnalyzed = !!(personalColor || faceShape || eyeType);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFC" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PINK}
            colors={[PINK]}
          />
        }
      >
        {/* Header logo */}
        <View style={styles.header}>
          <Image source={logo} style={styles.headerLogo} />
        </View>

        {/* ─── SECTION 1: 오늘의 룩 히어로 카드 ──────────────────────────── */}
        <TodaysLookHero
          loading={loadingLook && !todaysLook}
          look={todaysLook}
          onPress={() => navigation.navigate('TodaysLook')}
        />

        {/* ─── SECTION 2: 내 뷰티 솔루션 (MEVE-241) ───────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 뷰티 솔루션 ✨</Text>

          {/* 메이크업으로 — 컬러 매치 */}
          <TouchableOpacity
            style={styles.solutionCard}
            onPress={() => navigation.navigate('ColorMatch')}
            activeOpacity={0.85}
          >
            <Text style={styles.solutionIcon}>💄</Text>
            <View style={styles.solutionContent}>
              <Text style={styles.solutionTitle}>메이크업으로</Text>
              <Text style={styles.solutionSub}>
                테스터 찍으면 어울리는지 바로 알려드려요
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
          </TouchableOpacity>

          {/* 시술로 — AI 시술 추천 */}
          <TouchableOpacity
            style={[styles.solutionCard, styles.solutionCardHighlight]}
            onPress={() => navigation.navigate('TreatmentRecommend', { mode: 'look' })}
            activeOpacity={0.85}
          >
            <Text style={styles.solutionIcon}>👩‍⚕️</Text>
            <View style={styles.solutionContent}>
              <Text style={styles.solutionTitle}>시술로</Text>
              <Text style={styles.solutionSub}>
                얼굴형·퍼스널컬러 기반 시술 가이드
              </Text>
            </View>
            <View style={styles.newTag}>
              <Text style={styles.newTagText}>NEW</Text>
            </View>
          </TouchableOpacity>

          {/* 스타일로 — 인스포 룩 */}
          <TouchableOpacity
            style={styles.solutionCard}
            onPress={() => navigation.navigate('InspoLook')}
            activeOpacity={0.85}
          >
            <Text style={styles.solutionIcon}>✨</Text>
            <View style={styles.solutionContent}>
              <Text style={styles.solutionTitle}>스타일로</Text>
              <Text style={styles.solutionSub}>
                핀터레스트 사진으로 나만의 메이크업 찾기
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
          </TouchableOpacity>

          {/* 내 컬러 팔레트 미리보기 */}
          {myColorPalette.length > 0 && (
            <View style={styles.solutionPaletteRow}>
              {myColorPalette.map((hex) => (
                <View
                  key={hex}
                  style={[styles.paletteDot, { backgroundColor: hex }]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ─── SECTION 4: 내 퍼스널컬러 팔레트 ───────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 퍼스널컬러 팔레트</Text>
          {personalColor ? (
            <View style={styles.card}>
              <Text style={styles.pcType}>{personalColor}</Text>
              <View style={styles.pcSwatchRow}>
                {palette.map((hex) => (
                  <View
                    key={hex}
                    style={[styles.pcSwatch, { backgroundColor: hex }]}
                  />
                ))}
              </View>

              {recommendedLip && (
                <>
                  <Text style={styles.pcLabel}>이번 주 추천 립 컬러</Text>
                  <View style={styles.lipRow}>
                    <View
                      style={[
                        styles.lipSwatch,
                        { backgroundColor: recommendedLip },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(
                          `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(`${personalColor} 립`)}`
                        )
                      }
                    >
                      <Text style={styles.oliveLink}>올리브영에서 찾기 →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={[styles.card, styles.dashedCard]}>
              <Text style={styles.dashedTitle}>퍼스널컬러를 분석하면</Text>
              <Text style={styles.dashedDesc}>
                나에게 어울리는 컬러를 알려드려요 ✨
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('FaceAnalysis')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>
                  AI 얼굴 분석 시작하기 →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── SECTION 5: 추구미 무드보드 ────────────────────────────────── */}
        <View style={styles.section}>
          {vibe && (VIBES as readonly string[]).includes(vibe) ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{vibe} 무드보드</Text>
                <TouchableOpacity
                  onPress={() => setVibePickerOpen(true)}
                  hitSlop={8}
                >
                  <Text style={styles.changeLink}>변경</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.moodGrid}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const url = moodImages[i];
                  return (
                    <View key={i} style={styles.moodTile}>
                      {url ? (
                        <Image source={{ uri: url }} style={styles.moodImage} />
                      ) : (
                        <View style={styles.moodSkeleton}>
                          {loadingMood && <ActivityIndicator color={PINK} />}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>추구미 무드보드</Text>
              <View style={[styles.card, styles.dashedCard]}>
                <Text style={styles.dashedDesc}>
                  추구미를 선택하면 무드보드를 보여드려요
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setVibePickerOpen(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>추구미 선택하기</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ─── SECTION 6: AI 얼굴 분석 ───────────────────────────────────── */}
        <View style={styles.section}>
          {faceAnalyzed ? (
            <>
              <Text style={styles.sectionTitle}>AI 얼굴 분석 결과</Text>
              <View style={[styles.card, styles.faceCard]}>
                <View style={styles.faceTagRow}>
                  {personalColor && (
                    <View style={styles.faceTag}>
                      <Text style={styles.faceTagText}>{personalColor}</Text>
                    </View>
                  )}
                  {faceShape && (
                    <View style={styles.faceTag}>
                      <Text style={styles.faceTagText}>{faceShape}</Text>
                    </View>
                  )}
                  {eyeType && (
                    <View style={styles.faceTag}>
                      <Text style={styles.faceTagText}>{eyeType}</Text>
                    </View>
                  )}
                </View>
                {faceAnalyzedAt && (
                  <Text style={styles.faceMeta}>
                    마지막 분석: {formatDate(faceAnalyzedAt)}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.outlinedBtn}
                  onPress={() => navigation.navigate('FaceAnalysis')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.outlinedBtnText}>다시 분석하기</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>AI 얼굴 분석</Text>
              <View style={styles.card}>
                <Text style={styles.faceIntroTitle}>
                  AI가 내 퍼스널컬러와 얼굴형을 분석해드려요
                </Text>
                <Text style={styles.faceIntroDesc}>
                  얼굴 사진 한 장으로 완성되는 뷰티 프로필 ✨
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('FaceAnalysis')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    AI 얼굴 분석 시작하기 →
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Vibe selector modal */}
      <Modal
        visible={vibePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setVibePickerOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetDismiss}
            activeOpacity={1}
            onPress={() => setVibePickerOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>추구미 선택</Text>
            <View style={styles.vibePillRow}>
              {VIBES.map((v) => {
                const active = vibe === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[styles.vibePill, active && styles.vibePillActive]}
                    onPress={() => selectVibe(v)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.vibePillText,
                        active && styles.vibePillTextActive,
                      ]}
                    >
                      {v}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Today's Look hero card ────────────────────────────────────────────────

function TodaysLookHero({
  loading,
  look,
  onPress,
}: {
  loading: boolean;
  look: TodaysLookData | null;
  onPress: () => void;
}) {
  return (
    <View style={styles.heroSection}>
      <TouchableOpacity
        style={styles.heroCard}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {look?.imageUrl ? (
          <Image source={{ uri: look.imageUrl }} style={styles.heroImage} />
        ) : (
          <LinearGradient
            colors={['#FFF0F5', '#E8F4FD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroImage}
          >
            {loading && <ActivityIndicator color={PINK} />}
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.heroOverlay}
          pointerEvents="none"
        />
        <View style={styles.heroOverlayContent} pointerEvents="none">
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {look?.lookTitle ?? '오늘의 룩'}
            </Text>
            <Text style={styles.heroDesc} numberOfLines={2}>
              {look?.lookDescription ??
                (loading
                  ? '룩을 불러오고 있어요…'
                  : '내 프로필에 맞춘 메이크업 추천이에요')}
            </Text>
          </View>
        </View>
        <View style={styles.heroPillWrap} pointerEvents="box-none">
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>따라하기 →</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.heroFooter}>
        <View style={styles.heroColorRow}>
          {(look?.keyColors ?? []).slice(0, 3).map((c, i) => (
            <View
              key={`${c}-${i}`}
              style={[styles.heroColorDot, { backgroundColor: c }]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={onPress} hitSlop={6}>
          <Text style={styles.heroFooterLink}>오늘의 루틴 보기 →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { flex: 1 },
  content: { paddingBottom: 60 },

  header: { paddingHorizontal: 20, paddingTop: 4 },
  headerLogo: {
    width: 170,
    height: 68,
    resizeMode: 'contain',
    alignSelf: 'flex-start',
    marginLeft: -40,
    marginBottom: -8,
  },

  // Hero
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  heroImage: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
  },
  heroOverlayContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroDesc: { color: '#fff', fontSize: 13, opacity: 0.9, lineHeight: 18 },
  heroPillWrap: { position: 'absolute', right: 16, bottom: 16 },
  heroPill: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroPillText: { fontSize: 12, color: PINK, fontWeight: '700' },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroColorRow: { flexDirection: 'row', gap: 6 },
  heroColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  heroFooterLink: { fontSize: 12, color: PINK, fontWeight: '700' },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  changeLink: { fontSize: 13, color: PINK, fontWeight: '700' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
    gap: 8,
  },
  dashedCard: {
    borderWidth: 1.5,
    borderColor: '#FFC4D6',
    borderStyle: 'dashed',
    backgroundColor: '#FFFAFC',
    alignItems: 'center',
    paddingVertical: 22,
    gap: 10,
  },
  dashedTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  dashedDesc: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 19,
  },

  primaryBtn: {
    backgroundColor: PINK,
    borderRadius: 50,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  outlinedBtn: {
    height: 44,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  outlinedBtnText: { color: PINK, fontSize: 14, fontWeight: '700' },

  // Section 2 — Color match
  colorMatchCard: {
    backgroundColor: '#FFF0F5',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FFC4D6',
    gap: 12,
  },
  colorMatchTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  colorMatchBtnRow: { flexDirection: 'row', gap: 8 },
  colorMatchBtn: {
    flex: 1,
    backgroundColor: PINK,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  colorMatchBtnAlt: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PINK,
  },
  colorMatchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  paletteRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  paletteDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  emptyHint: { fontSize: 12, color: '#8A8A9A' },

  // Section 3 — Inspo
  inspoCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  inspoTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  inspoDesc: { fontSize: 13, color: '#5A5A65', lineHeight: 19 },

  // Section 4 — Personal color
  pcType: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  pcSwatchRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pcSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  pcLabel: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '600',
    marginTop: 6,
  },
  lipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lipSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  oliveLink: { fontSize: 13, color: PINK, fontWeight: '700' },

  // Section 5 — Moodboard
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodTile: {
    width: '32%',
    aspectRatio: 0.85,
    borderRadius: 12,
    overflow: 'hidden',
  },
  moodImage: { width: '100%', height: '100%' },
  moodSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section 6 — Face analysis
  faceCard: { backgroundColor: '#F0F5FF', borderRadius: 20, padding: 16 },
  faceTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  faceTag: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#D0DDF0',
  },
  faceTagText: { fontSize: 13, color: '#3D5A80', fontWeight: '700' },
  faceMeta: { fontSize: 11, color: '#8A8A9A' },
  faceIntroTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  faceIntroDesc: { fontSize: 13, color: '#8A8A9A', lineHeight: 19 },

  // Vibe selector sheet
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
    gap: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  vibePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  vibePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  vibePillActive: {
    backgroundColor: '#FFF0F5',
    borderColor: PINK,
  },
  vibePillText: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },
  vibePillTextActive: { color: PINK, fontWeight: '700' },

  // 내 뷰티 솔루션 (MEVE-241)
  solutionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  solutionCardHighlight: {
    backgroundColor: '#FFF0F5',
    borderWidth: 1.5,
    borderColor: '#FFC4D6',
  },
  solutionIcon: { fontSize: 28, marginRight: 12 },
  solutionContent: { flex: 1 },
  solutionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  solutionSub: { fontSize: 12, color: '#8A8A9A', marginTop: 2 },
  newTag: {
    backgroundColor: '#FF6B9D',
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  solutionPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});

// suppress unused import (Colors retained for future palette extensions)
void Colors;
