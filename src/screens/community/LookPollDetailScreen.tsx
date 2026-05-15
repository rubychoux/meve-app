import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList, LookPoll, LookPollVote } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'LookPollDetail'>;
type Rt = RouteProp<MainStackParamList, 'LookPollDetail'>;

const PINK = '#FF6B9D';

interface CommentRow {
  voter_id: string;
  comment: string;
  display_name: string | null;
}

interface VoterRow {
  voter_id: string;
  display_name: string | null;
  avatar_url: string | null;
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

export function LookPollDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { pollId } = useRoute<Rt>().params;
  const { width } = useWindowDimensions();

  const [poll, setPoll] = useState<(LookPoll & { invite_code?: string | null }) | null>(null);
  const [votes, setVotes] = useState<LookPollVote[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: p } = await supabase
        .from('look_polls')
        .select('*')
        .eq('id', pollId)
        .single();
      setPoll((p as LookPoll) ?? null);

      const { data: v } = await supabase
        .from('look_poll_votes')
        .select('*')
        .eq('poll_id', pollId);
      const voteRows = (v as LookPollVote[]) ?? [];
      setVotes(voteRows);

      // Fetch profile info for all voters in one query — used by both voters
      // list and comments section.
      const allVoterIds = Array.from(new Set(voteRows.map((r) => r.voter_id)));
      let profMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (allVoterIds.length > 0) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url')
          .in('id', allVoterIds);
        for (const prof of (profs ?? []) as any[]) {
          profMap[prof.id] = {
            display_name: prof.display_name ?? null,
            avatar_url: prof.avatar_url ?? null,
          };
        }
      }

      setVoters(
        voteRows.map((r) => ({
          voter_id: r.voter_id,
          display_name: profMap[r.voter_id]?.display_name ?? null,
          avatar_url: profMap[r.voter_id]?.avatar_url ?? null,
        }))
      );

      const commentVotes = voteRows.filter(
        (r) => r.comment && r.comment.trim().length > 0
      );
      setComments(
        commentVotes.map((c) => ({
          voter_id: c.voter_id,
          comment: c.comment as string,
          display_name: profMap[c.voter_id]?.display_name ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [pollId])
  );

  const myVote = userId ? votes.find((v) => v.voter_id === userId) ?? null : null;
  const isMine = userId != null && poll?.user_id === userId;
  const remain = poll ? timeRemaining(poll.expires_at) : null;

  const showResults = !!myVote || isMine || remain?.expired;

  const handleVote = async (index: number) => {
    if (voting || !userId || !poll) return;
    if (isMine) {
      Alert.alert('투표 불가', '본인의 투표에는 투표할 수 없어요.');
      return;
    }
    if (remain?.expired) {
      Alert.alert('투표 종료', '이미 종료된 투표예요.');
      return;
    }
    if (myVote) return;
    setVoting(true);
    try {
      const { error } = await supabase.from('look_poll_votes').insert({
        poll_id: poll.id,
        voter_id: userId,
        selected_index: index,
      });
      if (error) throw error;
      Alert.alert('완료', '이 룩에 투표했어요! 💕');
      await load();
    } catch (e: any) {
      Alert.alert('투표 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setVoting(false);
    }
  };

  const handleShare = async () => {
    if (!poll) return;
    const codeLine = poll.invite_code ? `\n초대 코드: ${poll.invite_code}` : '';
    const message = `내 룩 투표에 참여해줘! 어떤 게 더 나아? 💄\n${poll.question}${codeLine}`;
    try {
      await Share.share({ message });
    } catch {}
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || submittingComment || !userId || !poll) return;
    if (!myVote) {
      Alert.alert('투표 먼저', '투표 후에 코멘트를 남길 수 있어요.');
      return;
    }
    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('look_poll_votes')
        .update({ comment: commentText.trim() })
        .eq('poll_id', poll.id)
        .eq('voter_id', userId);
      if (error) throw error;
      setCommentText('');
      await load();
    } catch (e: any) {
      Alert.alert('코멘트 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading || !poll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 80 }} color={PINK} />
      </SafeAreaView>
    );
  }

  const totalVotes = votes.length;
  const counts: number[] = poll.photo_urls.map(
    (_, i) => votes.filter((v) => v.selected_index === i).length
  );
  const maxCount = Math.max(0, ...counts);
  const winnerIndex = maxCount > 0 ? counts.indexOf(maxCount) : -1;

  const photoCount = poll.photo_urls.length;
  const gridSize = width - 40; // 20 padding each side

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>투표 상세</Text>
        <TouchableOpacity onPress={handleShare} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color="#2D2D2D" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>{poll.question}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{totalVotes}명 참여</Text>
          {remain && (
            <View
              style={[
                styles.timeBadge,
                remain.expired && { backgroundColor: '#F0E6EC' },
              ]}
            >
              <Text
                style={[
                  styles.timeBadgeText,
                  remain.expired && { color: '#8A8A9A' },
                ]}
              >
                {remain.label}
              </Text>
            </View>
          )}
        </View>

        {/* Photo display */}
        <View
          style={[
            styles.photoGrid,
            photoCount === 1 && { flexDirection: 'column' },
            photoCount === 2 && { flexDirection: 'row' },
          ]}
        >
          {poll.photo_urls.map((uri, i) => {
            const pct = totalVotes > 0 ? (counts[i] / totalVotes) * 100 : 0;
            const label = photoCount === 2
              ? (i === 0 ? 'A' : 'B')
              : `${i + 1}`;
            const isWinner = showResults && i === winnerIndex && maxCount > 0;
            const slotStyle =
              photoCount === 1
                ? { width: gridSize, height: gridSize }
                : photoCount === 2
                ? { width: (gridSize - 8) / 2, height: (gridSize - 8) / 2 * 1.25 }
                : { width: (gridSize - 8) / 2, height: (gridSize - 8) / 2 };
            return (
              <TouchableOpacity
                key={uri + i}
                activeOpacity={0.85}
                onPress={() => handleVote(i)}
                style={[
                  styles.photoSlot,
                  slotStyle,
                  isWinner && styles.winnerSlot,
                  myVote?.selected_index === i && styles.selectedSlot,
                ]}
                disabled={voting || !!myVote || isMine || remain?.expired}
              >
                <Image source={{ uri }} style={styles.photoImg} />
                <View style={styles.photoLabelWrap}>
                  <Text style={styles.photoLabelText}>{label}</Text>
                </View>
                {isWinner && (
                  <View style={styles.winnerBadge}>
                    <Text style={styles.winnerText}>가장 인기있는 룩 👑</Text>
                  </View>
                )}
                {showResults && (
                  <View style={styles.resultOverlay}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${pct}%` },
                          isWinner && { backgroundColor: PINK },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(pct)}% ({counts[i]})
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!showResults && !isMine && !remain?.expired && (
          <Text style={styles.voteHint}>사진을 탭해서 투표해요</Text>
        )}

        {/* Invite card — hidden once poll has expired */}
        {!remain?.expired && poll.invite_code && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>친구 초대하기</Text>
            <Text style={styles.inviteLabel}>INVITE CODE</Text>
            <Text style={styles.inviteCode}>{poll.invite_code}</Text>
            <TouchableOpacity style={styles.inviteShareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.inviteShareBtnText}>공유하기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Voters */}
        <Text style={styles.sectionTitle}>투표한 친구 ({voters.length})</Text>
        {voters.length === 0 ? (
          <Text style={styles.commentEmpty}>아직 투표한 친구가 없어요</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.voterRow}
          >
            {voters.map((v) => (
              <View key={v.voter_id} style={styles.voterItem}>
                {v.avatar_url ? (
                  <Image source={{ uri: v.avatar_url }} style={styles.voterAvatar} />
                ) : (
                  <View style={[styles.voterAvatar, styles.voterAvatarPlaceholder]}>
                    <Text style={styles.voterAvatarText}>
                      {(v.display_name ?? '?').charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={styles.voterName} numberOfLines={1}>
                  {v.display_name ?? '회원'}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Comments */}
        <Text style={styles.sectionTitle}>코멘트 ({comments.length})</Text>
        {comments.length === 0 ? (
          <Text style={styles.commentEmpty}>아직 코멘트가 없어요</Text>
        ) : (
          comments.map((c, i) => (
            <View key={c.voter_id + i} style={styles.commentRow}>
              <Text style={styles.commentName}>{c.display_name ?? '회원'}</Text>
              <Text style={styles.commentText}>{c.comment}</Text>
            </View>
          ))
        )}

        {myVote && !remain?.expired && (
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="코멘트를 남겨요"
              placeholderTextColor="#B8AFB5"
              maxLength={100}
            />
            <TouchableOpacity
              style={[styles.commentBtn, submittingComment && { opacity: 0.65 }]}
              onPress={handleAddComment}
              disabled={submittingComment}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
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
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1F',
  },

  content: { padding: 20, paddingBottom: 60, gap: 12 },
  question: { fontSize: 18, fontWeight: '700', color: '#1A1A1F', lineHeight: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, color: '#8A8A9A' },
  timeBadge: {
    backgroundColor: '#FFC4D6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timeBadgeText: { fontSize: 11, color: '#C44777', fontWeight: '700' },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  photoSlot: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F0E6EC',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSlot: { borderColor: PINK },
  winnerSlot: { borderColor: PINK },
  photoImg: { width: '100%', height: '100%' },
  photoLabelWrap: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabelText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  winnerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  winnerText: { fontSize: 10, fontWeight: '800', color: PINK },
  resultOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  progressText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  voteHint: { fontSize: 12, color: '#8A8A9A', textAlign: 'center', marginTop: 4 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1F',
    marginTop: 10,
  },
  commentEmpty: { fontSize: 12, color: '#8A8A9A' },
  commentRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: 2,
  },
  commentName: { fontSize: 12, fontWeight: '700', color: PINK },
  commentText: { fontSize: 13, color: '#1A1A1F', lineHeight: 19 },

  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E6EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1A1A1F',
  },
  commentBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,220,230,0.5)',
    gap: 8,
    marginTop: 6,
  },
  inviteLabel: { fontSize: 11, color: '#8A8A9A', fontWeight: '600', marginTop: 4 },
  inviteCode: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1F',
    letterSpacing: 3,
    textAlign: 'center',
    paddingVertical: 6,
  },
  inviteShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PINK,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  inviteShareBtnText: { color: '#fff', fontWeight: '700' },

  voterRow: { gap: 12, paddingVertical: 4 },
  voterItem: { alignItems: 'center', width: 60, gap: 4 },
  voterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0E6EC',
  },
  voterAvatarPlaceholder: {
    backgroundColor: '#FFC4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voterAvatarText: { fontSize: 15, fontWeight: '700', color: '#C44777' },
  voterName: { fontSize: 11, color: '#1A1A1F', textAlign: 'center' },
});
