import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList, LookPoll } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'LookPollList'>;
type Tab = 'mine' | 'community';

const PINK = '#FF6B9D';
const BLUE = '#2D3A6B';

interface PollWithVoteCount extends LookPoll {
  voteCount: number;
  hasMyVote: boolean;
}

function timeRemaining(expiresAt: string): { expired: boolean; label: string } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { expired: true, label: '투표 종료' };
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return { expired: false, label: `${hours}시간 ${mins}분 남음` };
  return { expired: false, label: `${mins}분 남음` };
}

export function LookPollListScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('mine');
  const [myPolls, setMyPolls] = useState<PollWithVoteCount[]>([]);
  const [publicPolls, setPublicPolls] = useState<PollWithVoteCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [joinVisible, setJoinVisible] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [mineRes, publicRes] = await Promise.all([
        supabase
          .from('look_polls')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('look_polls')
          .select('*')
          .eq('is_public', true)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const allPolls = [
        ...((mineRes.data as LookPoll[]) ?? []),
        ...((publicRes.data as LookPoll[]) ?? []),
      ];
      const pollIds = allPolls.map((p) => p.id);
      let voteCounts: Record<string, number> = {};
      let myVotes = new Set<string>();
      if (pollIds.length > 0) {
        const { data: voteRows } = await supabase
          .from('look_poll_votes')
          .select('poll_id, voter_id')
          .in('poll_id', pollIds);
        for (const v of (voteRows ?? []) as any[]) {
          voteCounts[v.poll_id] = (voteCounts[v.poll_id] ?? 0) + 1;
          if (v.voter_id === user.id) myVotes.add(v.poll_id);
        }
      }

      const decorate = (p: LookPoll): PollWithVoteCount => ({
        ...p,
        voteCount: voteCounts[p.id] ?? 0,
        hasMyVote: myVotes.has(p.id),
      });
      setMyPolls(((mineRes.data as LookPoll[]) ?? []).map(decorate));
      setPublicPolls(((publicRes.data as LookPoll[]) ?? []).map(decorate));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const current = tab === 'mine' ? myPolls : publicPolls;

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('코드 확인', '6자리 초대 코드를 입력해주세요.');
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('get_poll_by_invite', { code: trimmed });
      if (error) throw error;
      const poll = Array.isArray(data) ? data[0] : data;
      if (!poll || !poll.id) {
        Alert.alert('찾을 수 없음', '해당 코드의 투표를 찾을 수 없어요.');
        return;
      }
      if (poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()) {
        Alert.alert('투표 종료', '이미 종료된 투표예요.');
        return;
      }
      setJoinVisible(false);
      setCode('');
      navigation.navigate('LookPollDetail', { pollId: poll.id });
    } catch (e: any) {
      Alert.alert('참여 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>룩 투표 💄</Text>
        <TouchableOpacity onPress={() => setJoinVisible(true)} hitSlop={8}>
          <Text style={styles.headerRight}>초대 코드</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'mine' && styles.tabActive]}
          onPress={() => setTab('mine')}
        >
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            내 투표
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'community' && styles.tabActive]}
          onPress={() => setTab('community')}
        >
          <Text style={[styles.tabText, tab === 'community' && styles.tabTextActive]}>
            커뮤니티
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PINK} />
        </View>
      ) : current.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={40} color="#FFC4D6" />
          <Text style={styles.emptyText}>
            {tab === 'mine' ? '아직 투표가 없어요' : '공개된 투표가 없어요'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {current.map((p) => {
            const remain = timeRemaining(p.expires_at);
            const thumbs = p.photo_urls.slice(0, 2);
            const isMine = p.user_id === userId;
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.card}
                onPress={() => navigation.navigate('LookPollDetail', { pollId: p.id })}
                activeOpacity={0.85}
              >
                <View style={styles.thumbRow}>
                  {thumbs.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.thumb} />
                  ))}
                </View>
                <Text style={styles.cardQ} numberOfLines={2}>
                  {p.question}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {p.voteCount}명 참여
                  </Text>
                  <Text
                    style={[
                      styles.metaText,
                      { color: remain.expired ? '#B0B0B0' : PINK },
                    ]}
                  >
                    · {remain.label}
                  </Text>
                </View>
                {tab === 'community' && !isMine && !p.hasMyVote && !remain.expired && (
                  <View style={styles.voteCta}>
                    <Text style={styles.voteCtaText}>투표하기 →</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('LookPollCreate')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.fabText}>투표 만들기</Text>
      </TouchableOpacity>

      <Modal
        visible={joinVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setJoinVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setJoinVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>초대 코드 입력</Text>
            <Text style={styles.modalSub}>친구에게 받은 6자리 코드를 입력해주세요</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC123"
              placeholderTextColor="#C0C0CC"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setJoinVisible(false);
                  setCode('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, joining && { opacity: 0.65 }]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>참여하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1F' },
  headerRight: { fontSize: 13, fontWeight: '600', color: PINK },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#F0E6EC',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },
  tabTextActive: { color: BLUE, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#8A8A9A', textAlign: 'center' },

  list: { padding: 20, gap: 12, paddingBottom: 120 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,220,230,0.5)',
    gap: 8,
  },
  thumbRow: { flexDirection: 'row', gap: 6 },
  thumb: { flex: 1, height: 100, borderRadius: 10, backgroundColor: '#F0E6EC' },
  cardQ: { fontSize: 14, fontWeight: '700', color: '#1A1A1F' },
  metaRow: { flexDirection: 'row', gap: 6 },
  metaText: { fontSize: 12, color: '#8A8A9A' },
  voteCta: {
    alignSelf: 'flex-start',
    backgroundColor: PINK,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 2,
  },
  voteCtaText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PINK,
    paddingHorizontal: 18,
    height: 50,
    borderRadius: 25,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1F',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    color: '#8A8A9A',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: 'rgba(220,220,230,0.8)',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1F',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    height: 48,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#C0C0CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A9A',
  },
  modalConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 50,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
