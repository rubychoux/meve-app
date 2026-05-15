import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import {
  MainStackParamList,
  GlamSync,
  GlamSyncMember,
} from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'GlamSyncDetail'>;
type Rt = RouteProp<MainStackParamList, 'GlamSyncDetail'>;

const PINK = '#FF6B9D';

interface MemberWithProfile extends GlamSyncMember {
  display_name: string | null;
  avatar_url: string | null;
}

function glamLabel(level: number): string {
  if (level <= 2) return '쌩얼 🌿';
  if (level <= 4) return '선크림 + 립 💋';
  if (level <= 6) return '세미 메이크업 ✨';
  if (level <= 8) return '풀메이크업 💄';
  return '풀메 + 풀세팅 👑';
}

function glamColor(level: number): string {
  if (level <= 2) return '#85C1AE';
  if (level <= 4) return '#F5C97A';
  if (level <= 6) return '#FF9F7F';
  if (level <= 8) return '#FF6B9D';
  return '#B8A0E0';
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86_400_000);
}

async function fetchAiGuide(
  level: number,
  eventName: string
): Promise<string> {
  const [[, pc], [, vibe]] = await AsyncStorage.multiGet([
    'meve_personal_color',
    'meve_vibe',
  ]);
  const prompt = `꾸밈정도 ${level}/10, 이벤트: ${eventName}.
사용자 퍼스널 컬러: ${pc ?? '미정'}, 추구미: ${vibe ?? '미정'}.
이 꾸밈정도에 맞는 메이크업 가이드를 3줄로 해요체로 알려줘.
베이스, 포인트 메이크업, 전체 분위기 순서로.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
  return (data.choices[0].message.content as string).trim();
}

export function GlamSyncDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { syncId } = useRoute<Rt>().params;

  const [sync, setSync] = useState<GlamSync | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiGuide, setAiGuide] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [finalizePickerVisible, setFinalizePickerVisible] = useState(false);
  const [pickedFinalLevel, setPickedFinalLevel] = useState<number>(5);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: syncRow } = await supabase
        .from('glam_syncs')
        .select('*')
        .eq('id', syncId)
        .single();
      setSync((syncRow as GlamSync) ?? null);

      const { data: memberRows } = await supabase
        .from('glam_sync_members')
        .select('*')
        .eq('sync_id', syncId);
      const rawMembers = (memberRows as GlamSyncMember[]) ?? [];

      // Fetch display names + avatars for each user
      const ids = rawMembers.map((m) => m.user_id);
      let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (ids.length > 0) {
        const { data: profRows } = await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url')
          .in('id', ids);
        for (const p of (profRows ?? []) as any[]) {
          profiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
      }

      setMembers(
        rawMembers.map((m) => ({
          ...m,
          display_name: profiles[m.user_id]?.display_name ?? null,
          avatar_url: profiles[m.user_id]?.avatar_url ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [syncId])
  );

  useEffect(() => {
    if (sync?.final_glam_level != null && sync.event_name) {
      setAiLoading(true);
      fetchAiGuide(sync.final_glam_level, sync.event_name)
        .then(setAiGuide)
        .catch(() => setAiGuide(null))
        .finally(() => setAiLoading(false));
    } else {
      setAiGuide(null);
    }
  }, [sync?.final_glam_level, sync?.event_name]);

  const proposedLevels = members
    .map((m) => m.proposed_level)
    .filter((v): v is number => v != null);
  const average =
    proposedLevels.length > 0
      ? proposedLevels.reduce((a, b) => a + b, 0) / proposedLevels.length
      : null;

  const isHost = sync != null && userId != null && sync.host_id === userId;
  const dday = daysLeft(sync?.event_date ?? null);

  const handleShare = async () => {
    if (!sync) return;
    const message = `meve 글램 싱크에 초대됐어요! ✨\n이벤트: ${sync.event_name}\n초대 코드: ${sync.invite_code}\n앱에서 코드를 입력해 참여하세요`;
    try {
      await Share.share({ message });
    } catch {}
  };

  const applyFinalLevel = async (finalLevel: number) => {
    if (!sync) return;
    try {
      const { error } = await supabase
        .from('glam_syncs')
        .update({ final_glam_level: finalLevel })
        .eq('id', sync.id);
      if (error) throw error;
      setSync({ ...sync, final_glam_level: finalLevel });
      setFinalizePickerVisible(false);
    } catch (e: any) {
      Alert.alert('확정 실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const handleFinalize = () => {
    if (!sync) return;
    if (average == null) {
      Alert.alert('확정 불가', '멤버들의 꾸밈 정도가 선택되지 않았어요.');
      return;
    }
    Alert.alert(
      '꾸밈 정도 확정',
      `평균값: ${average.toFixed(1)}/10\n어떻게 확정할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '평균값 사용',
          onPress: () => applyFinalLevel(Math.round(average)),
        },
        {
          text: '직접 입력',
          onPress: () => {
            setPickedFinalLevel(Math.round(average));
            setFinalizePickerVisible(true);
          },
        },
      ]
    );
  };

  if (loading || !sync) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 80 }} color={PINK} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{sync.event_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {dday != null && (
          <Text style={styles.dday}>D-{dday}일 남았어요</Text>
        )}
        {sync.event_date && (
          <Text style={styles.eventDate}>
            {new Date(sync.event_date).toLocaleString('ko-KR')}
          </Text>
        )}

        {/* Invite */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>친구 초대하기</Text>
          <Text style={styles.inviteLabel}>INVITE CODE</Text>
          <Text style={styles.inviteCode}>{sync.invite_code}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.shareBtnText}>초대 링크 공유</Text>
          </TouchableOpacity>
        </View>

        {/* Members */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>참여 멤버 ({members.length}명)</Text>
          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(m.display_name ?? '?').charAt(0)}
                </Text>
              </View>
              <Text style={styles.memberName}>
                {m.display_name ?? '회원'}
                {m.user_id === sync.host_id ? ' 👑' : ''}
              </Text>
              {m.proposed_level != null ? (
                <View
                  style={[
                    styles.levelBadge,
                    { backgroundColor: glamColor(m.proposed_level) },
                  ]}
                >
                  <Text style={styles.levelBadgeText}>{m.proposed_level}/10</Text>
                </View>
              ) : (
                <Text style={styles.pending}>아직 선택 안 함</Text>
              )}
            </View>
          ))}
        </View>

        {/* Average */}
        {average != null && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>평균 꾸밈 정도</Text>
            <View style={styles.avgRow}>
              <Text style={[styles.avgNum, { color: glamColor(Math.round(average)) }]}>
                {average.toFixed(1)}
              </Text>
              <Text style={styles.avgUnit}>/10</Text>
              <Text style={styles.avgLabel}>{glamLabel(Math.round(average))}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(average / 10) * 100}%`,
                    backgroundColor: glamColor(Math.round(average)),
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* AI Guide */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>AI 메이크업 가이드</Text>
          {sync.final_glam_level == null ? (
            <Text style={styles.aiPending}>
              꾸밈 정도가 확정되면 AI 메이크업 가이드가 생성돼요
            </Text>
          ) : aiLoading ? (
            <ActivityIndicator color={PINK} style={{ marginVertical: 10 }} />
          ) : aiGuide ? (
            <Text style={styles.aiGuide}>{aiGuide}</Text>
          ) : (
            <Text style={styles.aiPending}>가이드를 불러오지 못했어요.</Text>
          )}
        </View>

        {/* Finalize (host only) */}
        {isHost && sync.final_glam_level == null && (
          <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalize}>
            <Text style={styles.finalizeBtnText}>꾸밈 정도 확정하기</Text>
          </TouchableOpacity>
        )}

        {finalizePickerVisible && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>직접 입력</Text>
            <View style={styles.levelPickerRow}>
              {Array.from({ length: 11 }, (_, i) => i).map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setPickedFinalLevel(i)}
                  style={[
                    styles.levelDot,
                    {
                      backgroundColor: i === pickedFinalLevel ? glamColor(i) : '#fff',
                      borderColor: i === pickedFinalLevel ? glamColor(i) : '#E2D5DC',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.levelDotText,
                      { color: i === pickedFinalLevel ? '#fff' : '#9A8F97' },
                    ]}
                  >
                    {i}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.pickerLabel}>{glamLabel(pickedFinalLevel)}</Text>
            <TouchableOpacity
              style={styles.finalizeBtn}
              onPress={() => applyFinalLevel(pickedFinalLevel)}
            >
              <Text style={styles.finalizeBtnText}>
                {pickedFinalLevel}/10로 확정하기
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {sync.final_glam_level != null && (
          <View style={[styles.card, { backgroundColor: '#FFF5F9' }]}>
            <Text style={styles.doneTitle}>
              확정됨 · {sync.final_glam_level}/10 {glamLabel(sync.final_glam_level)}
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#1A1A1F' },

  content: { padding: 20, paddingBottom: 60, gap: 12 },
  dday: { fontSize: 22, fontWeight: '800', color: PINK },
  eventDate: { fontSize: 13, color: '#8A8A9A', marginBottom: 4 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,220,230,0.5)',
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1F' },

  inviteLabel: { fontSize: 11, color: '#8A8A9A', fontWeight: '600', marginTop: 4 },
  inviteCode: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1F',
    letterSpacing: 3,
    textAlign: 'center',
    paddingVertical: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PINK,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  shareBtnText: { color: '#fff', fontWeight: '700' },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFC4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#C44777' },
  memberName: { flex: 1, fontSize: 13, color: '#1A1A1F', fontWeight: '600' },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pending: { fontSize: 11, color: '#8A8A9A' },

  avgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  avgNum: { fontSize: 32, fontWeight: '800' },
  avgUnit: { fontSize: 14, color: '#8A8A9A' },
  avgLabel: { fontSize: 13, color: '#1A1A1F', marginLeft: 6 },
  progressTrack: {
    height: 8,
    backgroundColor: '#F0E6EC',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%' },

  aiPending: { fontSize: 12, color: '#8A8A9A', lineHeight: 18 },
  aiGuide: { fontSize: 13, color: '#1A1A1F', lineHeight: 21 },

  finalizeBtn: {
    backgroundColor: PINK,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  finalizeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  levelPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  levelDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelDotText: { fontSize: 11, fontWeight: '700' },
  pickerLabel: { fontSize: 13, color: '#1A1A1F', textAlign: 'center', marginTop: 4 },

  doneTitle: { fontSize: 14, fontWeight: '700', color: PINK, textAlign: 'center' },
});
