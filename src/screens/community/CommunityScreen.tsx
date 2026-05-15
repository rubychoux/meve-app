/**
 * CommunityScreen — v1.5 eve 탭 (실제 eve 탭 콘텐츠).
 *
 * 백업: CommunityScreen.backup.tsx (1502-line original)
 *
 * 새 구조:
 *   1. TopBar (공통)
 *   2. 헤더 "eve" / "커뮤니티" + subline
 *   3. 필터 chips (내 핏 ✨ + 이벤트/피부타입/퍼스널컬러/뷰티타입/바이브)
 *   4. 포스트 FlatList — 새 카드 디자인 (avatar + DNA badge + content + image + tags + action bar)
 *   5. FAB → CreatePost
 *
 * 보존된 logic:
 *   - posts / unreadCount / displayName fetch
 *   - feedTab (mine/all) + 5 filter states (event/skin/color/vibe/face)
 *   - toggleLike / sharePost
 *   - PostDetail / CreatePost navigate
 *   - excludedAutoKeys (내 핏 ✕ pill)
 *
 * 제거됨: 무지개 meve 로고, 내 뷰티 리포트 hero, ModeToggle, 핑크 필터 chips, 게시글 올리기 버튼 → FAB로 통합
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import {
  MainStackParamList,
  MainTabParamList,
  Post,
  ProductTag,
} from '../../types';
import { GradientPill } from '../../components/signature';
import { TopBar } from '../../components/common/TopBar';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Community'>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ─── Static content ───────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  wedding: '웨딩',
  date: '데이트',
  graduation: '졸업',
  travel: '여행',
  photoshoot: '촬영',
};

const EVENT_OPTIONS = [
  { key: 'wedding',    label: '웨딩' },
  { key: 'date',       label: '데이트' },
  { key: 'graduation', label: '졸업' },
  { key: 'travel',     label: '여행' },
  { key: 'photoshoot', label: '촬영' },
];

const SKIN_TYPES = ['건성', '지성', '복합성', '민감성'];
const PERSONAL_COLORS = ['봄 웜톤', '여름 쿨톤', '가을 웜톤', '겨울 쿨톤'];
const FACE_SHAPES = ['계란형', '하트형', '둥근형', '각진형', '긴형'];
const VIBES = ['청순', '글로우', '볼드', '내추럴', '빈티지', '클린걸', '테토녀', '에겐녀'];

const isValidValue = (val: string | null | undefined): val is string =>
  !!val && val.trim() !== '' && val.toLowerCase() !== 'unknown';

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

type PostWithMeta = Post & {
  _isLiked: boolean;
  _likeCount: number;
  _commentCount: number;
};

interface MyProfile {
  skinScore: number | null;
  personal_color: string | null;
  vibe: string | null;
  face_shape: string | null;
  event_type: string | null;
  dday_count: number | null;
  skin_type: string | null;
}

type FilterKey = 'event' | 'skin' | 'color' | 'vibe' | 'face';

// ─── Screen ───────────────────────────────────────────────────────────────────

export function CommunityScreen() {
  const navigation = useNavigation<Nav>();

  // Source of truth: beauty profile store
  const storeLoaded = useBeautyProfile((s) => s.isLoaded);
  const storeSkinType = useBeautyProfile((s) => s.skinType);
  const storeSkinScore = useBeautyProfile((s) => s.lastSkinScore);
  const storePersonalColor = useBeautyProfile((s) => s.personalColor);
  const storeVibe = useBeautyProfile((s) => s.vibe);
  const storeFaceShape = useBeautyProfile((s) => s.faceShape);
  const storeBeautyType = useBeautyProfile((s) => s.beautyType);
  const storeEventType = useBeautyProfile((s) => s.eventType);
  const storeEventDate = useBeautyProfile((s) => s.eventDate);
  const storeLoadProfile = useBeautyProfile((s) => s.loadProfile);

  const profile: MyProfile = React.useMemo(() => {
    let dday_count: number | null = null;
    if (storeEventDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(storeEventDate);
      target.setHours(0, 0, 0, 0);
      dday_count = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
    }
    return {
      skinScore: storeSkinScore,
      personal_color: isValidValue(storePersonalColor) ? storePersonalColor : null,
      vibe: isValidValue(storeVibe) ? storeVibe : null,
      face_shape: isValidValue(storeFaceShape) ? storeFaceShape : null,
      event_type: isValidValue(storeEventType) ? storeEventType : null,
      dday_count,
      skin_type: isValidValue(storeSkinType) ? storeSkinType : null,
    };
  }, [
    storeSkinScore,
    storePersonalColor,
    storeVibe,
    storeFaceShape,
    storeEventType,
    storeEventDate,
    storeSkinType,
  ]);
  const profileLoaded = storeLoaded;

  // ── State ────────────────────────────────────────────────────────────────
  const [myFitActive, setMyFitActive] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedSkinType, setSelectedSkinType] = useState<string | null>(null);
  const [selectedPersonalColor, setSelectedPersonalColor] = useState<string | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [selectedFaceShape, setSelectedFaceShape] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<FilterKey | null>(null);

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState<string>('회원');

  // ── Fetchers (preserved from original) ───────────────────────────────────
  const fetchDisplayName = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      if (data?.display_name) setDisplayName(data.display_name);
    } catch {}
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id ?? null;

      let query = supabase
        .from('posts')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);

      // "내 핏" = 같은 뷰티 DNA 타입만 (e.g. 'GCS'). Independent toggle —
      // can stack with any of the manual filters below.
      if (myFitActive && isValidValue(storeBeautyType)) {
        query = query.eq('beauty_type', storeBeautyType);
      }

      // Manual filters — each is independent and stacks with 내 핏.
      if (selectedEvent)         query = query.eq('event_type', selectedEvent);
      if (selectedSkinType)      query = query.eq('skin_type', selectedSkinType);
      if (selectedPersonalColor) query = query.eq('personal_color', selectedPersonalColor);
      if (selectedVibe)          query = query.eq('vibe', selectedVibe);
      if (selectedFaceShape)     query = query.eq('face_shape', selectedFaceShape);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Post[];

      const postIds = rows.map((r) => r.id);
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const likedIds = new Set<string>();
      const likeCounts: Record<string, number> = {};
      const commentCounts: Record<string, number> = {};
      const profiles: Record<
        string,
        { display_name: string | null; avatar_url: string | null }
      > = {};

      if (postIds.length > 0) {
        const [{ data: allLikes }, { data: allComments }, { data: profRows }] =
          await Promise.all([
            supabase.from('likes').select('post_id, user_id').in('post_id', postIds),
            supabase.from('comments').select('post_id').in('post_id', postIds),
            userIds.length > 0
              ? supabase
                  .from('user_profiles')
                  .select('id, display_name, avatar_url')
                  .in('id', userIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);
        for (const row of allLikes ?? []) {
          likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1;
          if (currentUserId && row.user_id === currentUserId) likedIds.add(row.post_id);
        }
        for (const row of allComments ?? []) {
          commentCounts[row.post_id] = (commentCounts[row.post_id] ?? 0) + 1;
        }
        for (const p of (profRows ?? []) as any[]) {
          profiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
      }

      const withMeta: PostWithMeta[] = rows.map((r) => ({
        ...r,
        image_urls: Array.isArray(r.image_urls) ? (r.image_urls as string[]) : [],
        product_tags: Array.isArray(r.product_tags) ? (r.product_tags as ProductTag[]) : [],
        user_profiles: profiles[r.user_id] ?? null,
        _isLiked: likedIds.has(r.id),
        _likeCount: likeCounts[r.id] ?? r.likes_count ?? 0,
        _commentCount: commentCounts[r.id] ?? r.comments_count ?? 0,
      }));
      setPosts(withMeta);
    } catch (e: any) {
      Alert.alert('불러오기 실패', e?.message ?? '게시글을 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    myFitActive,
    storeBeautyType,
    selectedEvent,
    selectedSkinType,
    selectedPersonalColor,
    selectedVibe,
    selectedFaceShape,
  ]);

  useFocusEffect(
    useCallback(() => {
      storeLoadProfile();
      fetchDisplayName();
    }, [storeLoadProfile, fetchDisplayName]),
  );

  useEffect(() => {
    if (profileLoaded) {
      setLoading(true);
      fetchPosts();
    }
  }, [profileLoaded, fetchPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    storeLoadProfile().then(() => fetchPosts());
  };

  // ── Actions (preserved) ──────────────────────────────────────────────────
  const toggleLike = async (postId: string, isLiked: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('로그인이 필요해요');
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, _isLiked: !isLiked, _likeCount: p._likeCount + (isLiked ? -1 : 1) }
          : p,
      ),
    );
    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    } catch (e: any) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, _isLiked: isLiked, _likeCount: p._likeCount + (isLiked ? 1 : -1) }
            : p,
        ),
      );
      Alert.alert('실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const sharePost = async (post: PostWithMeta) => {
    try {
      const content = post.content?.slice(0, 80) ?? '';
      await Share.share({
        message: `meve 커뮤니티 — ${content}${content.length >= 80 ? '…' : ''}`,
      });
    } catch {}
  };

  // ── Filter chip handlers — all filters are independent and stack ─────────
  const onMyFit = () => {
    setMyFitActive((v) => !v);  // toggle 내 핏 (beauty_type filter)
    setExpandedFilter(null);
  };

  const onFilterChipPress = (key: FilterKey) => {
    setExpandedFilter((cur) => (cur === key ? null : key));
  };

  const clearFilter = (key: FilterKey) => {
    if (key === 'event') setSelectedEvent(null);
    if (key === 'skin')  setSelectedSkinType(null);
    if (key === 'color') setSelectedPersonalColor(null);
    if (key === 'vibe')  setSelectedVibe(null);
    if (key === 'face')  setSelectedFaceShape(null);
  };

  // ── DNA-badge mapping (from post fields) ─────────────────────────────────
  const dnaBadgeFor = (post: PostWithMeta) => {
    const parts = [
      post.personal_color,
      post.vibe,
      post.face_shape,
      post.skin_type,
    ].filter((v): v is string => isValidValue(v));
    if (parts.length === 0) return null;
    return parts.slice(0, 2).join(' · ');
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderPost = ({ item }: { item: PostWithMeta }) => {
    const author = item.user_profiles?.display_name ?? '회원';
    const avatar = item.user_profiles?.avatar_url ?? null;
    const dnaBadge = dnaBadgeFor(item);
    const firstImage = item.image_urls?.[0] ?? null;
    const productTags: ProductTag[] = item.product_tags ?? [];

    return (
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={['#FFD4DC', '#E4D4FF', '#D4E4FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.author} numberOfLines={1}>{author}</Text>
            {dnaBadge && (
              <View style={styles.dnaBadge}>
                <Text style={styles.dnaBadgeText}>{dnaBadge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>

        {/* Image */}
        {firstImage && (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: firstImage }}
              style={styles.postImage}
              resizeMode="cover"
            />
            {item.image_urls && item.image_urls.length > 1 && (
              <View style={styles.baPill}>
                <Text style={styles.baPillText}>B/A</Text>
              </View>
            )}
          </View>
        )}

        {/* Body */}
        {item.content ? <Text style={styles.body}>{item.content}</Text> : null}

        {/* Product tags */}
        {productTags.length > 0 && (
          <View style={styles.tagsRow}>
            {productTags.slice(0, 4).map((tag, i) => (
              <View key={`${tag.name}-${i}`} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            onPress={() => toggleLike(item.id, item._isLiked)}
            style={styles.actionBtn}
            hitSlop={6}
          >
            <Ionicons
              name={item._isLiked ? 'heart' : 'heart-outline'}
              size={16}
              color={item._isLiked ? '#E84A6F' : '#8E8E93'}
            />
            <Text style={styles.actionText}>{item._likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            style={styles.actionBtn}
            hitSlop={6}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#8E8E93" />
            <Text style={styles.actionText}>{item._commentCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => sharePost(item)}
            style={styles.actionBtn}
            hitSlop={6}
          >
            <Ionicons name="share-outline" size={16} color="#8E8E93" />
            <Text style={styles.actionText}>공유</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Filter chip label (active when filter has a value)
  const filterLabel = (key: FilterKey): { label: string; active: boolean } => {
    switch (key) {
      case 'event':
        return {
          label: selectedEvent ? EVENT_LABEL[selectedEvent] ?? selectedEvent : '이벤트',
          active: selectedEvent != null,
        };
      case 'skin':
        return { label: selectedSkinType ?? '피부타입', active: selectedSkinType != null };
      case 'color':
        return { label: selectedPersonalColor ?? '퍼스널컬러', active: selectedPersonalColor != null };
      case 'face':
        return { label: selectedFaceShape ?? '뷰티타입', active: selectedFaceShape != null };
      case 'vibe':
        return { label: selectedVibe ?? '바이브', active: selectedVibe != null };
    }
  };

  // Sub-chip options for the expanded filter
  const subChipOptions = (): { key: string; label: string }[] => {
    if (expandedFilter === 'event') return EVENT_OPTIONS;
    if (expandedFilter === 'skin')  return SKIN_TYPES.map((s) => ({ key: s, label: s }));
    if (expandedFilter === 'color') return PERSONAL_COLORS.map((s) => ({ key: s, label: s }));
    if (expandedFilter === 'face')  return FACE_SHAPES.map((s) => ({ key: s, label: s }));
    if (expandedFilter === 'vibe')  return VIBES.map((s) => ({ key: s, label: s }));
    return [];
  };
  const subChipValue = (): string | null => {
    if (expandedFilter === 'event') return selectedEvent;
    if (expandedFilter === 'skin')  return selectedSkinType;
    if (expandedFilter === 'color') return selectedPersonalColor;
    if (expandedFilter === 'face')  return selectedFaceShape;
    if (expandedFilter === 'vibe')  return selectedVibe;
    return null;
  };
  const setSubChip = (key: string | null) => {
    if (expandedFilter === 'event') setSelectedEvent(key);
    if (expandedFilter === 'skin')  setSelectedSkinType(key);
    if (expandedFilter === 'color') setSelectedPersonalColor(key);
    if (expandedFilter === 'face')  setSelectedFaceShape(key);
    if (expandedFilter === 'vibe')  setSelectedVibe(key);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.eyebrow}>eve</Text>
              <Text style={styles.title}>커뮤니티</Text>
              <Text style={styles.subline}>비슷한 뷰티 DNA를 가진 사람들의 이야기</Text>
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <TouchableOpacity
                onPress={onMyFit}
                style={[styles.chip, myFitActive && styles.chipActive]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="sparkles"
                  size={12}
                  color={myFitActive ? '#FFFFFF' : '#8E8E93'}
                />
                <Text style={[styles.chipText, myFitActive && styles.chipTextActive]}>
                  내 핏
                </Text>
              </TouchableOpacity>
              {(['event', 'skin', 'color', 'face', 'vibe'] as FilterKey[]).map((key) => {
                const { label, active } = filterLabel(key);
                const expanded = expandedFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => onFilterChipPress(key)}
                    style={[
                      styles.chip,
                      (active || expanded) && styles.chipActive,
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        (active || expanded) && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sub-chips (expanded filter) */}
            {expandedFilter && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subChipsRow}
              >
                <TouchableOpacity
                  onPress={() => setSubChip(null)}
                  style={[
                    styles.subChip,
                    subChipValue() == null && styles.subChipActive,
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.subChipText,
                      subChipValue() == null && styles.subChipTextActive,
                    ]}
                  >
                    전체
                  </Text>
                </TouchableOpacity>
                {subChipOptions().map((opt) => {
                  const active = subChipValue() === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setSubChip(opt.key)}
                      style={[styles.subChip, active && styles.subChipActive]}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.subChipText, active && styles.subChipTextActive]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ height: 12 }} />
          </View>
        }
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2D3A6B"
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>아직 게시글이 없어요</Text>
              <Text style={styles.emptySub}>첫 번째 게시글을 올려보세요!</Text>
              <View style={{ marginTop: 16 }}>
                <GradientPill
                  label="게시글 올리기"
                  size="md"
                  iconRight={null}
                  onPress={() => navigation.navigate('CreatePost')}
                />
              </View>
            </View>
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => navigation.navigate('CreatePost')}
        style={styles.fab}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#FFD4DC', '#E4D4FF', '#D4E4FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="add" size={24} color="#2D3A6B" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FBF5F6',
  },

  // Header
  header: {
    paddingHorizontal: 18,
    marginTop: 4,
  },
  eyebrow: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(45,58,107,0.7)',
  },
  title: {
    fontFamily: 'Pretendard-Thin',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: '#1A1A1F',
    fontWeight: '200',
    marginTop: 2,
  },
  subline: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 14,
  },

  // Filter chips
  chipsRow: {
    paddingHorizontal: 18,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
  },
  chipActive: {
    backgroundColor: '#2D3A6B',
    borderColor: '#2D3A6B',
  },
  chipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Sub-chips
  subChipsRow: {
    paddingHorizontal: 18,
    gap: 6,
    paddingTop: 8,
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
  },
  subChipActive: {
    backgroundColor: 'rgba(45,58,107,0.08)',
    borderColor: '#2D3A6B',
  },
  subChipText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8E93',
  },
  subChipTextActive: {
    color: '#2D3A6B',
    fontWeight: '500',
  },

  // Post card
  listContent: {
    paddingBottom: 120,
    gap: 0,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    marginHorizontal: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F4',
  },
  author: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    lineHeight: 16,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  dnaBadge: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: 'rgba(216,228,242,0.4)',
  },
  dnaBadgeText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 9,
    lineHeight: 12,
    color: '#2D3A6B',
    fontWeight: '500',
  },
  time: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
  },

  // Image
  imageWrap: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F2F2F4',
  },
  baPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  baPillText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 9,
    lineHeight: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Body
  body: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#1A1A1F',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Product tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: '#FBF5F6',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
  },
  tagChipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 9,
    lineHeight: 12,
    color: '#2D3A6B',
    fontWeight: '500',
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#F2F2F4',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: '#8E8E93',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 60,
  },
  emptyTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#8E8E93',
    fontWeight: '500',
  },
  emptySub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
    marginTop: 4,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(228,212,255,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
});
