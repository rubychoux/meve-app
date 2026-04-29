// Post detail with comments + replies + AI coach — MEVE-193 / MEVE-198.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList, Post, PostComment, ProductTag } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'PostDetail'>;
type Rt = RouteProp<MainStackParamList, 'PostDetail'>;

const PINK = '#FF6B9D';
const BLUE = '#5BA3D9';

const EVENT_EMOJI: Record<string, string> = {
  wedding: '💍',
  date: '💕',
  graduation: '🎓',
  travel: '✈️',
  photoshoot: '📸',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { postId } = useRoute<Rt>().params;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    displayName: string;
    userId: string;
  } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const [askingAI, setAskingAI] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (postErr) throw postErr;

      const [{ data: commentRows }, { data: likeRows }] = await Promise.all([
        supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true }),
        supabase.from('likes').select('user_id').eq('post_id', postId),
      ]);

      const rawComments = (commentRows ?? []) as any[];
      const userIds = Array.from(
        new Set([postData.user_id, ...rawComments.map((c) => c.user_id)].filter(Boolean))
      );
      const profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        for (const p of (profRows ?? []) as any[]) {
          profiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
      }

      const normalizedPost: Post = {
        ...postData,
        image_urls: Array.isArray((postData as any).image_urls)
          ? ((postData as any).image_urls as string[])
          : [],
        product_tags: Array.isArray((postData as any).product_tags)
          ? ((postData as any).product_tags as ProductTag[])
          : [],
        user_profiles: profiles[postData.user_id] ?? null,
      } as unknown as Post;
      setPost(normalizedPost);

      const mergedComments: PostComment[] = rawComments.map((c) => ({
        ...c,
        user_profiles: profiles[c.user_id] ?? null,
      }));
      setComments(mergedComments);
      setLikeCount((likeRows ?? []).length);
      if (user && (likeRows ?? []).some((r: { user_id: string }) => r.user_id === user.id)) {
        setIsLiked(true);
      } else {
        setIsLiked(false);
      }
    } catch (e: any) {
      Alert.alert('불러오기 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleLike = async () => {
    if (!currentUserId) {
      Alert.alert('로그인이 필요해요');
      return;
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: currentUserId });
        if (error) throw error;
        // Notify post owner (don't notify self-likes)
        if (post && post.user_id !== currentUserId) {
          try {
            await supabase.from('notifications').insert({
              user_id: post.user_id,
              type: 'like',
              actor_id: currentUserId,
              post_id: postId,
            });
          } catch {}
        }
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);
        if (error) throw error;
      }
    } catch (e: any) {
      // Revert
      setIsLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
      Alert.alert('실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || submittingComment) return;
    if (!currentUserId) {
      Alert.alert('로그인이 필요해요');
      return;
    }
    setSubmittingComment(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', currentUserId)
        .single();
      const parentId = replyingTo?.commentId ?? null;
      const parentUserId = replyingTo?.userId ?? null;
      const { data: inserted, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          display_name: profile?.display_name ?? null,
          content: text,
          is_ai: false,
          parent_id: parentId,
        })
        .select()
        .single();
      if (error) throw error;

      // Notifications — best-effort, don't block on failure
      try {
        const newCommentId = inserted?.id ?? null;
        const notifRows: Array<{
          user_id: string;
          type: 'comment' | 'reply';
          actor_id: string;
          post_id: string;
          comment_id: string | null;
        }> = [];
        if (post && post.user_id !== currentUserId) {
          notifRows.push({
            user_id: post.user_id,
            type: parentId ? 'reply' : 'comment',
            actor_id: currentUserId,
            post_id: postId,
            comment_id: newCommentId,
          });
        }
        if (parentId && parentUserId && parentUserId !== currentUserId) {
          notifRows.push({
            user_id: parentUserId,
            type: 'reply',
            actor_id: currentUserId,
            post_id: postId,
            comment_id: newCommentId,
          });
        }
        if (notifRows.length > 0) {
          await supabase.from('notifications').insert(notifRows);
        }
      } catch {}

      setCommentText('');
      if (parentId) {
        setExpandedReplies((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
      setReplyingTo(null);
      await fetchAll();
    } catch (e: any) {
      Alert.alert('댓글 작성 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const startReply = (c: PostComment, displayName: string) => {
    setReplyingTo({ commentId: c.id, displayName, userId: c.user_id });
    setCommentText(`@${displayName} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const deleteComment = (c: PostComment) => {
    Alert.alert('댓글 삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('comments').delete().eq('id', c.id);
            if (error) throw error;
            setComments((prev) => prev.filter((x) => x.id !== c.id));
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '다시 시도해 주세요.');
          }
        },
      },
    ]);
  };

  const askAICoach = async () => {
    if (!post || askingAI) return;
    if (!currentUserId) {
      Alert.alert('로그인이 필요해요');
      return;
    }
    setAskingAI(true);
    try {
      const profileContext = [
        post.skin_type && `피부 타입: ${post.skin_type}`,
        post.personal_color && `퍼스널 컬러: ${post.personal_color}`,
        post.vibe && `추구미: ${post.vibe}`,
        post.face_shape && `얼굴형: ${post.face_shape}`,
        post.event_type && post.dday_count != null
          ? `이벤트: ${post.event_type} D-${post.dday_count}`
          : null,
      ]
        .filter(Boolean)
        .join(', ');

      const prompt = `meve 앱의 AI 뷰티 코치로서 다음 피부/뷰티 고민에 친절하게 해요체로 답변해주세요.
사용자 프로필: ${profileContext || '정보 없음'}
고민 내용: ${post.content}

답변 규칙:
- 해요체로 따뜻하고 친근하게
- 4~6줄, 구체적이고 실용적인 조언
- 성분/제품 카테고리 추천 시 이유 포함
- 마크다운이나 이모지 남용 금지 (핵심 포인트에만)`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      const aiText = data.choices[0].message.content.trim();

      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        user_id: currentUserId,
        display_name: 'AI 코치',
        content: aiText,
        is_ai: true,
      });
      if (error) throw error;
      await fetchAll();
    } catch (e: any) {
      Alert.alert('AI 코치 호출 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setAskingAI(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PINK} />
        </View>
      </SafeAreaView>
    );
  }
  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>게시글을 찾을 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = post.user_profiles?.display_name ?? post.display_name ?? '익명';
  const avatarUrl = post.user_profiles?.avatar_url ?? null;
  const initial = displayName?.[0] ?? '?';
  const hasAIComment = comments.some((c) => c.is_ai);
  const showAICoachPanel = post.post_type === 'question' && !hasAIComment;

  // Separate top-level + replies, group replies by parent
  const { topLevel, repliesByParent } = (() => {
    const top: PostComment[] = [];
    const byParent: Record<string, PostComment[]> = {};
    for (const c of comments) {
      if (!c.parent_id) {
        top.push(c);
      } else {
        if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
        byParent[c.parent_id].push(c);
      }
    }
    return { topLevel: top, repliesByParent: byParent };
  })();

  const openProduct = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시글</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Post body */}
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.postName}>{displayName}</Text>
                <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
              </View>
            </View>

            <View style={styles.tagRow}>
              {post.dday_count != null && post.event_type && (
                <View style={[styles.tag, styles.tagPink]}>
                  <Text style={styles.tagPinkText}>
                    {EVENT_EMOJI[post.event_type] ?? '✨'} D-{post.dday_count}
                  </Text>
                </View>
              )}
              {post.personal_color && (
                <View style={[styles.tag, styles.tagPink]}>
                  <Text style={styles.tagPinkText}>{post.personal_color}</Text>
                </View>
              )}
              {post.vibe && (
                <View style={[styles.tag, styles.tagPink]}>
                  <Text style={styles.tagPinkText}>{post.vibe}</Text>
                </View>
              )}
              {post.skin_type && (
                <View style={[styles.tag, styles.tagBlue]}>
                  <Text style={styles.tagBlueText}>{post.skin_type}</Text>
                </View>
              )}
              {post.face_shape && (
                <View style={[styles.tag, styles.tagBlue]}>
                  <Text style={styles.tagBlueText}>{post.face_shape}</Text>
                </View>
              )}
            </View>

            {post.post_type === 'before_after' &&
            post.before_photo_url &&
            post.after_photo_url ? (
              <View style={styles.baRow}>
                <View style={styles.baCol}>
                  <Image source={{ uri: post.before_photo_url }} style={styles.baImg} />
                  <View style={[styles.baLabel, { backgroundColor: '#8A8A9A' }]}>
                    <Text style={styles.baLabelText}>BEFORE</Text>
                  </View>
                </View>
                <View style={styles.baCol}>
                  <Image source={{ uri: post.after_photo_url }} style={styles.baImg} />
                  <View style={[styles.baLabel, { backgroundColor: PINK }]}>
                    <Text style={styles.baLabelText}>AFTER</Text>
                  </View>
                </View>
              </View>
            ) : post.image_urls && post.image_urls.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {post.image_urls.map((u, i) => (
                  <Image key={`${u}-${i}`} source={{ uri: u }} style={styles.postImage} />
                ))}
              </ScrollView>
            ) : post.image_url ? (
              <Image source={{ uri: post.image_url }} style={styles.postImage} />
            ) : null}

            {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}

            {post.product_tags && post.product_tags.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.productRow}>
                  {post.product_tags.map((p, i) => (
                    <TouchableOpacity
                      key={`${p.name}-${i}`}
                      style={styles.productChip}
                      onPress={() => openProduct(p.oliveyoung_url)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="pricetag-outline" size={12} color={PINK} />
                      <Text style={styles.productChipText} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            <View style={styles.postFooter}>
              <TouchableOpacity style={styles.footerItem} onPress={toggleLike}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isLiked ? PINK : '#8A8A9A'}
                />
                <Text style={styles.footerText}>{likeCount}</Text>
              </TouchableOpacity>
              <View style={styles.footerItem}>
                <Ionicons name="chatbubble-outline" size={19} color="#8A8A9A" />
                <Text style={styles.footerText}>{comments.length}</Text>
              </View>
            </View>
          </View>

          {/* AI coach panel */}
          {showAICoachPanel && (
            <View style={styles.aiPanel}>
              <Text style={styles.aiPanelTitle}>AI 코치의 답변 💙</Text>
              <Text style={styles.aiPanelDesc}>
                meve AI 뷰티 코치에게 고민을 물어볼 수 있어요.
              </Text>
              <TouchableOpacity
                style={[styles.aiAskBtn, askingAI && { opacity: 0.65 }]}
                onPress={askAICoach}
                disabled={askingAI}
                activeOpacity={0.85}
              >
                {askingAI ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.aiAskBtnText}>AI 코치한테 물어보기</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Comments */}
          <Text style={styles.commentsLabel}>댓글 {comments.length}</Text>
          {topLevel.length === 0 && (
            <Text style={styles.commentsEmpty}>첫 댓글을 남겨보세요 ✨</Text>
          )}
          {topLevel.map((c) => {
            const isOwn = c.user_id === currentUserId;
            const name =
              c.user_profiles?.display_name ?? c.display_name ?? (c.is_ai ? 'AI 코치' : '익명');
            const avatar = c.user_profiles?.avatar_url ?? null;
            const replies = repliesByParent[c.id] ?? [];
            const isExpanded = expandedReplies.has(c.id);
            return (
              <View key={c.id} style={c.is_ai ? styles.commentAI : undefined}>
                <TouchableOpacity
                  style={styles.comment}
                  activeOpacity={0.85}
                  onLongPress={isOwn ? () => deleteComment(c) : undefined}
                >
                  {c.is_ai ? (
                    <View style={[styles.avatar, styles.aiAvatar]}>
                      <Ionicons name="sparkles" size={14} color="#fff" />
                    </View>
                  ) : avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{name[0]}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.commentMeta}>
                      <Text style={[styles.commentName, c.is_ai && { color: BLUE }]}>
                        {name}
                      </Text>
                      <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.content}</Text>
                    {!c.is_ai && (
                      <TouchableOpacity
                        onPress={() => startReply(c, name)}
                        hitSlop={6}
                        style={styles.replyBtnWrap}
                      >
                        <Text style={styles.replyBtnBelow}>↩ 답글</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {replies.length > 0 && (
                  <View style={styles.repliesWrap}>
                    <TouchableOpacity
                      style={styles.toggleReplies}
                      onPress={() => toggleReplies(c.id)}
                      hitSlop={6}
                    >
                      <Text style={styles.toggleRepliesText}>
                        {replies.length}개 답글
                      </Text>
                      <Ionicons
                        name="chevron-down-outline"
                        size={12}
                        color={BLUE}
                        style={{
                          transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                        }}
                      />
                    </TouchableOpacity>
                    {isExpanded &&
                      replies.map((r) => {
                        const replyIsOwn = r.user_id === currentUserId;
                        const replyName =
                          r.user_profiles?.display_name ?? r.display_name ?? '익명';
                        const replyAvatar = r.user_profiles?.avatar_url ?? null;
                        // Detect leading @mention for styling
                        const mentionMatch = r.content.match(/^@(\S+)\s*/);
                        const mentionText = mentionMatch ? mentionMatch[0] : null;
                        const rest = mentionText ? r.content.slice(mentionText.length) : r.content;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={styles.replyItem}
                            activeOpacity={0.85}
                            onLongPress={replyIsOwn ? () => deleteComment(r) : undefined}
                          >
                            {replyAvatar ? (
                              <Image source={{ uri: replyAvatar }} style={styles.replyAvatar} />
                            ) : (
                              <View style={[styles.replyAvatar, styles.avatarFallback]}>
                                <Text style={styles.replyAvatarInitial}>
                                  {replyName[0]}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <View style={styles.commentMeta}>
                                <Text style={styles.replyName}>{replyName}</Text>
                                <Text style={styles.commentTime}>
                                  {timeAgo(r.created_at)}
                                </Text>
                              </View>
                              <Text style={styles.commentText}>
                                {mentionText && (
                                  <Text style={styles.mention}>{mentionText}</Text>
                                )}
                                {rest}
                              </Text>
                              <TouchableOpacity
                                onPress={() => startReply(c, replyName)}
                                hitSlop={6}
                                style={styles.replyBtnWrap}
                              >
                                <Text style={styles.replyBtnBelow}>↩ 답글</Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Comment input bar (fixed bottom) */}
        <SafeAreaView edges={['bottom']} style={styles.inputWrap}>
          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                @{replyingTo.displayName}에게 답글 달기
              </Text>
              <TouchableOpacity onPress={cancelReply} hitSlop={6}>
                <Text style={styles.replyBannerCancel}>취소</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={
                replyingTo ? '답글을 남겨보세요' : '댓글을 남겨보세요'
              }
              placeholderTextColor="#B8AFB5"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!commentText.trim() || submittingComment) && { opacity: 0.5 },
              ]}
              onPress={postComment}
              disabled={!commentText.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, color: '#8A8A9A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },

  content: { paddingBottom: 20, gap: 14 },

  postCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,220,230,0.5)',
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0E6EC' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#8A8A9A', fontWeight: '700', fontSize: 13 },
  aiAvatar: {
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postName: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  postTime: { fontSize: 11, color: '#8A8A9A', marginTop: 1 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    borderWidth: 1,
  },
  tagPink: { backgroundColor: '#FFF0F5', borderColor: '#FFC4D6' },
  tagPinkText: { fontSize: 11, color: PINK, fontWeight: '600' },
  tagBlue: { backgroundColor: '#E8F4FD', borderColor: '#B8D8F0' },
  tagBlueText: { fontSize: 11, color: BLUE, fontWeight: '600' },

  postImage: {
    width: 260,
    height: 260,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#F0E6EC',
  },

  baRow: { flexDirection: 'row', gap: 8 },
  baCol: { flex: 1, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  baImg: { width: '100%', height: 240, backgroundColor: '#F0E6EC' },
  baLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  baLabelText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  postContent: { fontSize: 14, color: '#1A1A2E', lineHeight: 21 },

  productRow: { flexDirection: 'row', gap: 6, paddingVertical: 4, paddingRight: 16 },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5F9',
    borderWidth: 1,
    borderColor: '#FFC4D6',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  productChipText: { fontSize: 11, color: PINK, fontWeight: '600' },

  postFooter: {
    flexDirection: 'row',
    gap: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5EEF3',
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12, color: '#8A8A9A', fontWeight: '600' },

  // AI coach panel
  aiPanel: {
    marginHorizontal: 16,
    backgroundColor: '#E8F4FD',
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#B8D8F0',
  },
  aiPanelTitle: { fontSize: 14, fontWeight: '800', color: BLUE },
  aiPanelDesc: { fontSize: 12, color: '#4A6B85', lineHeight: 18 },
  aiAskBtn: {
    marginTop: 8,
    backgroundColor: BLUE,
    borderRadius: 50,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAskBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Comments
  commentsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  commentsEmpty: {
    paddingHorizontal: 20,
    fontSize: 12,
    color: '#8A8A9A',
  },
  comment: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  commentAI: { backgroundColor: '#F0F7FD' },
  commentMeta: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 3 },
  commentName: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  commentTime: { fontSize: 10, color: '#8A8A9A' },
  commentText: { fontSize: 13, color: '#1A1A2E', lineHeight: 19 },

  // Reply button + replies toggle
  replyBtnWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  replyBtnBelow: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '500',
  },
  repliesWrap: {
    paddingLeft: 56,
    paddingRight: 20,
    paddingBottom: 6,
  },
  toggleReplies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  toggleRepliesText: {
    fontSize: 12,
    color: BLUE,
    fontWeight: '600',
  },
  replyItem: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#E8F4FD',
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0E6EC',
  },
  replyAvatarInitial: {
    color: '#8A8A9A',
    fontWeight: '700',
    fontSize: 12,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  mention: {
    color: BLUE,
    fontWeight: '600',
  },

  // Input bar
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: '#EFE8ED',
    backgroundColor: '#fff',
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8F4FD',
  },
  replyBannerText: {
    fontSize: 12,
    color: BLUE,
    fontWeight: '600',
  },
  replyBannerCancel: {
    fontSize: 12,
    color: BLUE,
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F9F5F7',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
    minHeight: 40,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
