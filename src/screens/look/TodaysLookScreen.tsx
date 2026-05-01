import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import {
  MainStackParamList,
  MainTabParamList,
  LookRecommendation,
  FaceAnalysisResult,
} from '../../types';
import { useBeautyProfile } from '../../stores/beautyProfileStore';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<MainStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

const ACCENT = '#FF6B9D';
const BLUE = '#6DA5C4';

const EVENT_LABELS: Record<string, string> = {
  wedding: '웨딩',
  date: '데이트',
  graduation: '졸업',
  travel: '여행',
  other: '기타',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  쉬움: '#85C1AE',
  보통: '#F5C97A',
  어려움: '#F08080',
};

async function generateLooks(profileContext: string): Promise<LookRecommendation[]> {
  const prompt = `You are a Korean beauty expert. Generate 3 makeup look recommendations in Korean.

${profileContext}

Return ONLY a JSON array with exactly 3 looks:
[
  {
    "lookName": "룩 이름 (예: 청순한 웨딩 게스트 룩)",
    "description": "룩 설명 2-3줄, 해요체",
    "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
    "products": [
      {"category": "베이스", "name": "제품명 예시", "tip": "사용 팁 1줄"},
      {"category": "립", "name": "제품명 예시", "tip": "사용 팁 1줄"},
      {"category": "아이", "name": "제품명 예시", "tip": "사용 팁 1줄"},
      {"category": "블러셔", "name": "제품명 예시", "tip": "사용 팁 1줄"}
    ],
    "colorKeyword": "컬러 키워드 (예: 누드핑크, 코럴, 로즈브라운)",
    "difficulty": "쉬움 | 보통 | 어려움"
  }
]
Return ONLY the JSON array. No other text.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
  }
  const content = data.choices[0].message.content.trim();
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('JSON 배열을 찾을 수 없어요.');
  return JSON.parse(match[0]) as LookRecommendation[];
}

export function TodaysLookScreen() {
  const navigation = useNavigation<Nav>();
  const getProfileContext = useBeautyProfile((s) => s.getProfileContext);
  const profileVibe = useBeautyProfile((s) => s.vibe);
  const profileEventType = useBeautyProfile((s) => s.eventType);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [looks, setLooks] = useState<LookRecommendation[] | null>(null);
  const [vibe, setVibe] = useState<string | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [personalColor, setPersonalColor] = useState<string | null>(null);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [[, v], [, et], [, pc], [, fa]] = await AsyncStorage.multiGet([
          'meve_vibe',
          'meve_event_type',
          'meve_personal_color',
          'meve_face_analysis',
        ]);
        setVibe(v);
        setEventType(et);
        setPersonalColor(pc);
        if (fa) setFaceAnalysis(JSON.parse(fa));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Prefer the live store; fall back to AsyncStorage values for screens we
  // reach before the store has finished hydrating.
  const effectiveVibe = profileVibe ?? vibe;
  const effectiveEventType = profileEventType ?? eventType;
  const canGenerate = !!effectiveVibe && !!effectiveEventType;
  const eventLabel = effectiveEventType
    ? EVENT_LABELS[effectiveEventType] ?? effectiveEventType
    : '';

  const handleGenerate = async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    try {
      const result = await generateLooks(getProfileContext());
      setLooks(result);
    } catch (e: any) {
      Alert.alert('생성 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareLook = async (look: LookRecommendation) => {
    try {
      await Share.share({
        message: `meve 오늘의 룩 추천 💄\n\n${look.lookName}\n${look.description}\n\nmeve에서 나만의 메이크업 룩을 찾아봐요!\n앱 다운로드 → https://meve.app`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 80 }} color={ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>오늘의 룩</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {canGenerate ? (
          <>
            <Text style={styles.hero}>
              {eventLabel}을 위한 {effectiveVibe} 룩 💕
            </Text>
            <Text style={styles.heroSub}>
              AI가 D-day와 추구미에 맞춰 3가지 룩을 추천해드려요.
            </Text>

            {!looks ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleGenerate}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>룩 추천 받기</Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                {looks.map((look, i) => (
                  <View key={`${look.lookName}-${i}`} style={styles.lookCard}>
                    <View style={styles.lookHeader}>
                      <Text style={styles.lookName}>{look.lookName}</Text>
                      <View
                        style={[
                          styles.diffBadge,
                          { backgroundColor: DIFFICULTY_COLOR[look.difficulty] ?? '#ccc' },
                        ]}
                      >
                        <Text style={styles.diffText}>{look.difficulty}</Text>
                      </View>
                    </View>
                    <Text style={styles.lookDesc}>{look.description}</Text>

                    <View style={styles.keyPointsBox}>
                      {look.keyPoints.map((kp, j) => (
                        <View key={j} style={styles.keyRow}>
                          <Text style={styles.keyBullet}>•</Text>
                          <Text style={styles.keyText}>{kp}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.colorPill}>
                      <Ionicons name="color-palette-outline" size={12} color="#C44777" />
                      <Text style={styles.colorPillText}>{look.colorKeyword}</Text>
                    </View>

                    <View style={styles.lookActionsRow}>
                      <TouchableOpacity
                        style={styles.followBtn}
                        onPress={() => navigation.navigate('LookDetail', { look })}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.followBtnText}>따라하기 →</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.shareLookBtn}
                        onPress={() => handleShareLook(look)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="share-outline" size={14} color={ACCENT} />
                        <Text style={styles.shareLookBtnText}>공유</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.regenBtn}
                  onPress={handleGenerate}
                  disabled={generating}
                  activeOpacity={0.85}
                >
                  {generating ? (
                    <ActivityIndicator color={ACCENT} />
                  ) : (
                    <Text style={styles.regenBtnText}>다른 룩 추천받기</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={40} color="#FFC4D6" />
            <Text style={styles.emptyTitle}>
              추구미와 D-day를 설정하면{'\n'}오늘의 룩을 추천해드려요
            </Text>
            <View style={styles.emptyBtnRow}>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: ACCENT }]}
                onPress={() => navigation.navigate('Look')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyBtnText}>추구미 설정하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: BLUE }]}
                onPress={() => navigation.navigate('EventFlow')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyBtnText}>이벤트 설정하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  content: { padding: 20, paddingBottom: 60, gap: 12 },

  hero: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  heroSub: { fontSize: 13, color: '#9A8F97', marginBottom: 6 },

  primaryBtn: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  lookCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F0E6EC',
  },
  lookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lookName: { fontSize: 16, fontWeight: '700', color: '#2D2D2D', flex: 1 },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  diffText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  lookDesc: { fontSize: 13, color: '#2D2D2D', lineHeight: 19 },

  keyPointsBox: {
    backgroundColor: '#FFF5F9',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  keyRow: { flexDirection: 'row', gap: 6 },
  keyBullet: { fontSize: 13, color: '#2D2D2D' },
  keyText: { flex: 1, fontSize: 12, color: '#2D2D2D', lineHeight: 18 },

  colorPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFC4D6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorPillText: { fontSize: 11, fontWeight: '700', color: '#C44777' },

  lookActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2D2D2D',
    borderRadius: 10,
  },
  followBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  shareLookBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareLookBtnText: { color: ACCENT, fontSize: 12, fontWeight: '700' },

  regenBtn: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  regenBtnText: { color: ACCENT, fontWeight: '700', fontSize: 14 },

  emptyCard: {
    marginTop: 30,
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    color: '#2D2D2D',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  emptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
