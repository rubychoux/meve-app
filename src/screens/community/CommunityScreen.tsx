// Community feed — MEVE-193. Beauty Report hero + 내 핏 / 전체 tabs + FAB.
// Storage bucket 'community-posts' with public read must exist (created via migration).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { MEVE_GRADIENT_SIMPLE } from '../../constants/theme';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import {
  MainStackParamList,
  MainTabParamList,
  Post,
  ProductTag,
} from '../../types';

const logo = require('../../../assets/images/meve-logo.png');

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Community'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const PINK = '#FF6B9D';
const BLUE = '#5BA3D9';
const PURPLE = '#9B59B6';

// Pastel tag palette — matches meve logo gradient (baby pink → lavender → baby blue)
const TAG_PINK = '#C87A9B';
const TAG_PINK_BG = '#FCE4EE';
const TAG_LAVENDER = '#9B8CC4';
const TAG_LAVENDER_BG = '#F3E8FA';
const TAG_BLUE = '#7BA0C4';
const TAG_BLUE_BG = '#E3F0FA';
const TAG_GRAY = '#8A8A9A';
const TAG_GRAY_BG = '#F5F5F5';

interface EventChip {
  key: string | null;
  label: string;
}

const EVENT_CHIPS: EventChip[] = [
  { key: null, label: '전체' },
  { key: 'wedding', label: '웨딩 💍' },
  { key: 'date', label: '데이트 💕' },
  { key: 'graduation', label: '졸업 🎓' },
  { key: 'travel', label: '여행 ✈️' },
  { key: 'photoshoot', label: '촬영 📸' },
];

const EVENT_EMOJI: Record<string, string> = {
  wedding: '💍',
  date: '💕',
  graduation: '🎓',
  travel: '✈️',
  photoshoot: '📸',
};

const EVENT_LABEL: Record<string, string> = {
  wedding: '웨딩',
  date: '데이트',
  graduation: '졸업',
  travel: '여행',
  photoshoot: '촬영',
};

const SKIN_TYPES = ['건성', '지성', '복합성', '민감성'];
const PERSONAL_COLORS = ['봄 웜톤', '여름 쿨톤', '가을 웜톤', '겨울 쿨톤'];
const VIBES = ['청순', '글로우', '볼드', '내추럴', '빈티지', '클린걸', '테토녀', '에겐녀'];
const FACE_SHAPES = ['계란형', '하트형', '둥근형', '각진형', '긴형'];

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

type FeedTab = 'mine' | 'all';
type FilterKey = 'event' | 'skin' | 'color' | 'vibe' | 'face';

export function CommunityScreen() {
  const navigation = useNavigation<Nav>();

  const [feedTab, setFeedTab] = useState<FeedTab>('mine');

  // Source of truth: beauty profile store
  const storeLoaded = useBeautyProfile((s) => s.isLoaded);
  const storeSkinType = useBeautyProfile((s) => s.skinType);
  const storeSkinScore = useBeautyProfile((s) => s.lastSkinScore);
  const storePersonalColor = useBeautyProfile((s) => s.personalColor);
  const storeVibe = useBeautyProfile((s) => s.vibe);
  const storeFaceShape = useBeautyProfile((s) => s.faceShape);
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

  const [similarCount, setSimilarCount] = useState<number | null>(null);

  // Manual filters (used in 전체 tab; also overlaid onto auto-filters)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedSkinType, setSelectedSkinType] = useState<string | null>(null);
  const [selectedPersonalColor, setSelectedPersonalColor] = useState<string | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [selectedFaceShape, setSelectedFaceShape] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<FilterKey | null>(null);

  // Removed auto-filter keys for 내 핏 tab (user can ✕ a my-fit pill)
  const [excludedAutoKeys, setExcludedAutoKeys] = useState<Set<keyof MyProfile>>(
    new Set()
  );

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [displayName, setDisplayName] = useState<string>('회원');

  // Display name for the Beauty Report card hero text.
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

  // ── Fetch posts ──────────────────────────────────────────────────────────
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

      if (feedTab === 'mine') {
        // Auto-filter by profile, excluding any keys the user ✕'d.
        // Never filter on blank / 'unknown' values.
        if (isValidValue(profile.personal_color) && !excludedAutoKeys.has('personal_color'))
          query = query.eq('personal_color', profile.personal_color);
        if (isValidValue(profile.vibe) && !excludedAutoKeys.has('vibe'))
          query = query.eq('vibe', profile.vibe);
        if (isValidValue(profile.face_shape) && !excludedAutoKeys.has('face_shape'))
          query = query.eq('face_shape', profile.face_shape);
        if (
          isValidValue(profile.event_type) &&
          profile.event_type !== '기타' &&
          !excludedAutoKeys.has('event_type')
        )
          query = query.eq('event_type', profile.event_type);
        if (isValidValue(profile.skin_type) && !excludedAutoKeys.has('skin_type'))
          query = query.eq('skin_type', profile.skin_type);
      } else {
        // Manual filters (전체 tab)
        if (selectedEvent) query = query.eq('event_type', selectedEvent);
        if (selectedSkinType) query = query.eq('skin_type', selectedSkinType);
        if (selectedPersonalColor)
          query = query.eq('personal_color', selectedPersonalColor);
        if (selectedVibe) query = query.eq('vibe', selectedVibe);
        if (selectedFaceShape) query = query.eq('face_shape', selectedFaceShape);
      }

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
        product_tags: Array.isArray(r.product_tags)
          ? (r.product_tags as ProductTag[])
          : [],
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
    feedTab,
    profile,
    excludedAutoKeys,
    selectedEvent,
    selectedSkinType,
    selectedPersonalColor,
    selectedVibe,
    selectedFaceShape,
  ]);

  // ── Fetch similar-profile count for hero card ────────────────────────────
  const fetchSimilarCount = useCallback(async () => {
    if (!profileLoaded) return;
    try {
      let q = supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true);
      if (isValidValue(profile.personal_color))
        q = q.eq('personal_color', profile.personal_color);
      if (isValidValue(profile.vibe)) q = q.eq('vibe', profile.vibe);
      if (isValidValue(profile.skin_type)) q = q.eq('skin_type', profile.skin_type);
      if (isValidValue(profile.event_type))
        q = q.eq('event_type', profile.event_type);
      // Only query if at least one filter applies
      const hasAny =
        isValidValue(profile.personal_color) ||
        isValidValue(profile.vibe) ||
        isValidValue(profile.skin_type) ||
        isValidValue(profile.event_type);
      if (!hasAny) {
        setSimilarCount(null);
        return;
      }
      const { count } = await q;
      setSimilarCount(count ?? 0);
    } catch {
      setSimilarCount(null);
    }
  }, [profile, profileLoaded]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        return;
      }
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      storeLoadProfile();
      fetchUnreadCount();
      fetchDisplayName();
    }, [storeLoadProfile, fetchUnreadCount, fetchDisplayName])
  );

  useEffect(() => {
    if (profileLoaded) {
      setLoading(true);
      fetchPosts();
      fetchSimilarCount();
    }
  }, [profileLoaded, fetchPosts, fetchSimilarCount]);

  const onRefresh = () => {
    setRefreshing(true);
    storeLoadProfile().then(() => {
      fetchPosts();
      fetchSimilarCount();
    });
  };

  // ── Actions ──────────────────────────────────────────────────────────────
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
          : p
      )
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
            : p
        )
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

  const goSkin = () => navigation.navigate('MainTabs', { screen: 'Skin' } as any);
  const goLook = () => navigation.navigate('FaceAnalysis');

  // ── Derived ──────────────────────────────────────────────────────────────
  const hasProfile =
    isValidValue(profile.personal_color) ||
    isValidValue(profile.vibe) ||
    isValidValue(profile.face_shape) ||
    isValidValue(profile.event_type) ||
    isValidValue(profile.skin_type) ||
    profile.skinScore != null;

  const myFitPills: Array<{ key: keyof MyProfile; label: string; color: string; bg: string }> = [];
  if (isValidValue(profile.event_type) && !excludedAutoKeys.has('event_type'))
    myFitPills.push({
      key: 'event_type',
      label: `${EVENT_EMOJI[profile.event_type] ?? '✨'} ${EVENT_LABEL[profile.event_type] ?? profile.event_type}${
        profile.dday_count != null ? ` D-${profile.dday_count}` : ''
      }`,
      color: TAG_PINK,
      bg: TAG_PINK_BG,
    });
  if (isValidValue(profile.personal_color) && !excludedAutoKeys.has('personal_color'))
    myFitPills.push({
      key: 'personal_color',
      label: profile.personal_color,
      color: TAG_LAVENDER,
      bg: TAG_LAVENDER_BG,
    });
  if (isValidValue(profile.vibe) && !excludedAutoKeys.has('vibe'))
    myFitPills.push({
      key: 'vibe',
      label: profile.vibe,
      color: TAG_PINK,
      bg: TAG_PINK_BG,
    });
  if (isValidValue(profile.skin_type) && !excludedAutoKeys.has('skin_type'))
    myFitPills.push({
      key: 'skin_type',
      label: profile.skin_type,
      color: TAG_BLUE,
      bg: TAG_BLUE_BG,
    });
  if (isValidValue(profile.face_shape) && !excludedAutoKeys.has('face_shape'))
    myFitPills.push({
      key: 'face_shape',
      label: profile.face_shape,
      color: TAG_GRAY,
      bg: TAG_GRAY_BG,
    });

  const removeAutoKey = (k: keyof MyProfile) =>
    setExcludedAutoKeys((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });

  // ── Renderers ────────────────────────────────────────────────────────────
  const renderHeroCard = () => {
    if (!profileLoaded) {
      return (
        <View style={styles.heroCardEmpty}>
          <ActivityIndicator color={PINK} />
        </View>
      );
    }
    if (!hasProfile) {
      return (
        <View style={styles.heroCardEmpty}>
          <Text style={styles.heroEmptyText}>
            SKIN · LOOK 탭에서 진단받으면{'\n'}나와 딱 맞는 피드를 보여드려요 ✨
          </Text>
          <View style={styles.heroEmptyBtnRow}>
            <TouchableOpacity style={styles.heroEmptyBtn} onPress={goSkin} activeOpacity={0.85}>
              <Text style={styles.heroEmptyBtnText}>피부 스캔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroEmptyBtn, styles.heroEmptyBtnSecondary]}
              onPress={goLook}
              activeOpacity={0.85}
            >
              <Text style={[styles.heroEmptyBtnText, { color: PINK }]}>얼굴 분석</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <LinearGradient
        colors={[
          'rgba(196,168,232,0.35)',
          'rgba(249,196,216,0.35)',
          'rgba(176,210,240,0.2)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.beautyReportCard}
      >
        <Text style={styles.beautyReportLabel}>내 뷰티 리포트 ✨</Text>
        <Text style={styles.beautyReportName}>{displayName}님의 시그니처</Text>

        <View style={styles.beautyReportPills}>
          {profile.skinScore != null && (
            <View
              style={[
                styles.reportPill,
                { backgroundColor: 'rgba(91,163,217,0.15)' },
              ]}
            >
              <Text style={[styles.reportPillText, { color: '#5BA3D9' }]}>
                스킨 {profile.skinScore}점
              </Text>
            </View>
          )}
          {isValidValue(profile.personal_color) && (
            <View
              style={[
                styles.reportPill,
                { backgroundColor: 'rgba(155,89,182,0.12)' },
              ]}
            >
              <Text style={[styles.reportPillText, { color: '#9B59B6' }]}>
                {profile.personal_color}
              </Text>
            </View>
          )}
          {isValidValue(profile.vibe) && (
            <View
              style={[
                styles.reportPill,
                { backgroundColor: 'rgba(255,107,157,0.12)' },
              ]}
            >
              <Text style={[styles.reportPillText, { color: '#FF6B9D' }]}>
                {profile.vibe}
              </Text>
            </View>
          )}
          {isValidValue(profile.event_type) && (
            <View
              style={[
                styles.reportPill,
                { backgroundColor: 'rgba(255,107,157,0.12)' },
              ]}
            >
              <Text style={[styles.reportPillText, { color: '#FF6B9D' }]}>
                {EVENT_EMOJI[profile.event_type] ?? '✨'}{' '}
                {EVENT_LABEL[profile.event_type] ?? profile.event_type}
                {profile.dday_count != null ? ` D-${profile.dday_count}` : ''}
              </Text>
            </View>
          )}
        </View>

        {similarCount != null && similarCount > 0 && (
          <TouchableOpacity onPress={() => setFeedTab('mine')} activeOpacity={0.75}>
            <Text style={styles.similarUsersText}>
              나와 비슷한 {similarCount}명이 활동 중이에요 →
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  };

  const renderFilterTypeChip = (
    key: FilterKey,
    label: string,
    selectedValue: string | null,
    accent: string,
    onClear: () => void
  ) => {
    const isExpanded = expandedFilter === key;
    const hasValue = !!selectedValue;
    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.filterTypeChip,
          (hasValue || isExpanded) && { borderColor: accent, backgroundColor: '#fff' },
        ]}
        onPress={() => setExpandedFilter(isExpanded ? null : key)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.filterTypeText,
            (hasValue || isExpanded) && { color: accent, fontWeight: '700' },
          ]}
        >
          {hasValue ? `${label}: ${selectedValue}` : label}
        </Text>
        {hasValue ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onClear();
            }}
            hitSlop={6}
          >
            <Ionicons name="close" size={12} color={accent} />
          </TouchableOpacity>
        ) : (
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={isExpanded ? accent : '#8A8A9A'}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderOptionChip = (
    label: string,
    active: boolean,
    onPress: () => void,
    accent: string,
    bg: string
  ) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, active && { backgroundColor: bg, borderColor: accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && { color: accent, fontWeight: '700' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.topBar}>
        <Image source={logo} style={styles.logo} />
      </View>

      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>eve</Text>
          <Text style={styles.headerSubtitle}>
            비슷한 뷰티 DNA를 가진 친구들의 이야기
          </Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bellBtn}
            hitSlop={6}
            activeOpacity={0.75}
          >
            <Ionicons name="notifications-outline" size={24} color="#1A1A2E" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtnWrap}
            onPress={() => navigation.navigate('GlamSyncList')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBtnRound, styles.iconBtnGlamRound]}>
              <Ionicons name="people" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtnWrap}
            onPress={() => navigation.navigate('LookPollList')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBtnRound, styles.iconBtnPollRound]}>
              <Ionicons name="thumbs-up" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {renderHeroCard()}

      {/* Feed tabs */}
      <View style={styles.feedTabContainer}>
        <TouchableOpacity
          style={[styles.feedTab, feedTab === 'mine' && styles.feedTabActive]}
          onPress={() => setFeedTab('mine')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.feedTabText,
              feedTab === 'mine' && styles.feedTabTextActive,
            ]}
          >
            내 핏 ✨
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedTab, feedTab === 'all' && styles.feedTabActive]}
          onPress={() => setFeedTab('all')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.feedTabText,
              feedTab === 'all' && styles.feedTabTextActive,
            ]}
          >
            전체
          </Text>
        </TouchableOpacity>
      </View>

      {/* 내 핏 active filter pills */}
      {feedTab === 'mine' && myFitPills.length > 0 && (
        <View style={styles.myFitRow}>
          <Text style={styles.myFitLabel}>내 핏 기준:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.myFitPillRow}
          >
            {myFitPills.map((p) => (
              <View key={p.key} style={styles.myFitPill}>
                <Text style={styles.myFitPillText}>{p.label}</Text>
                <TouchableOpacity onPress={() => removeAutoKey(p.key)} hitSlop={6}>
                  <Ionicons name="close" size={12} color="#FF6B9D" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Manual filter chips (전체 tab only) */}
      {feedTab === 'all' && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {renderFilterTypeChip(
              'event',
              '이벤트',
              selectedEvent
                ? EVENT_CHIPS.find((c) => c.key === selectedEvent)?.label ?? null
                : null,
              TAG_PINK,
              () => setSelectedEvent(null)
            )}
            {renderFilterTypeChip('skin', '피부', selectedSkinType, TAG_BLUE, () =>
              setSelectedSkinType(null)
            )}
            {renderFilterTypeChip('color', '컬러', selectedPersonalColor, TAG_LAVENDER, () =>
              setSelectedPersonalColor(null)
            )}
            {renderFilterTypeChip('vibe', '추구미', selectedVibe, TAG_PINK, () =>
              setSelectedVibe(null)
            )}
            {renderFilterTypeChip('face', '얼굴형', selectedFaceShape, TAG_GRAY, () =>
              setSelectedFaceShape(null)
            )}
          </ScrollView>

          {expandedFilter && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionRow}
            >
              {expandedFilter === 'event' &&
                EVENT_CHIPS.map((c) =>
                  renderOptionChip(
                    c.label,
                    selectedEvent === c.key,
                    () => {
                      setSelectedEvent(c.key);
                      setExpandedFilter(null);
                    },
                    TAG_PINK,
                    TAG_PINK_BG
                  )
                )}
              {expandedFilter === 'skin' &&
                SKIN_TYPES.map((s) =>
                  renderOptionChip(
                    s,
                    selectedSkinType === s,
                    () => {
                      setSelectedSkinType(selectedSkinType === s ? null : s);
                      setExpandedFilter(null);
                    },
                    TAG_BLUE,
                    TAG_BLUE_BG
                  )
                )}
              {expandedFilter === 'color' &&
                PERSONAL_COLORS.map((pc) =>
                  renderOptionChip(
                    pc,
                    selectedPersonalColor === pc,
                    () => {
                      setSelectedPersonalColor(selectedPersonalColor === pc ? null : pc);
                      setExpandedFilter(null);
                    },
                    TAG_LAVENDER,
                    TAG_LAVENDER_BG
                  )
                )}
              {expandedFilter === 'vibe' &&
                VIBES.map((v) =>
                  renderOptionChip(
                    v,
                    selectedVibe === v,
                    () => {
                      setSelectedVibe(selectedVibe === v ? null : v);
                      setExpandedFilter(null);
                    },
                    TAG_PINK,
                    TAG_PINK_BG
                  )
                )}
              {expandedFilter === 'face' &&
                FACE_SHAPES.map((f) =>
                  renderOptionChip(
                    f,
                    selectedFaceShape === f,
                    () => {
                      setSelectedFaceShape(selectedFaceShape === f ? null : f);
                      setExpandedFilter(null);
                    },
                    TAG_GRAY,
                    TAG_GRAY_BG
                  )
                )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={PINK} />
        </View>
      );
    }
    if (feedTab === 'mine' && !hasProfile) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>아직 AI 진단을 받지 않으셨어요 ✨</Text>
          <Text style={styles.emptyDesc}>
            SKIN · LOOK 탭에서 진단받으면{'\n'}나와 비슷한 분들의 게시글을 추천해드려요
          </Text>
          <View style={styles.emptyBtnRow}>
            <TouchableOpacity style={styles.emptyCta} onPress={goSkin} activeOpacity={0.85}>
              <Text style={styles.emptyCtaText}>피부 스캔하러 가기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emptyCta, styles.emptyCtaSecondary]}
              onPress={goLook}
              activeOpacity={0.85}
            >
              <Text style={[styles.emptyCtaText, { color: PINK }]}>
                얼굴 분석하러 가기
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>
          {feedTab === 'mine'
            ? '아직 나와 비슷한 분들의 게시글이 없어요 🌿'
            : '아직 게시글이 없어요 ✨'}
        </Text>
        <Text style={styles.emptyDesc}>조건에 맞는 첫 번째 게시글을 올려봐요!</Text>
        <TouchableOpacity
          style={styles.emptyCtaShadow}
          onPress={() => navigation.navigate('CreatePost')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={MEVE_GRADIENT_SIMPLE.colors}
            start={MEVE_GRADIENT_SIMPLE.start}
            end={MEVE_GRADIENT_SIMPLE.end}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaText}>게시글 올리기</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onToggleLike={() => toggleLike(item.id, item._isLiked)}
            onOpen={() => navigation.navigate('PostDetail', { postId: item.id })}
            onShare={() => sharePost(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PINK}
            colors={[PINK]}
          />
        }
      />

      <TouchableOpacity
        style={styles.fabShadow}
        onPress={() => navigation.navigate('CreatePost')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#D4B8E8', '#FF6B9D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Ionicons name="pencil" size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────

interface PostCardProps {
  post: PostWithMeta;
  onToggleLike: () => void;
  onOpen: () => void;
  onShare: () => void;
}

function PostCard({ post, onToggleLike, onOpen, onShare }: PostCardProps) {
  const displayName =
    post.user_profiles?.display_name ?? post.display_name ?? '익명';
  const avatarUrl = post.user_profiles?.avatar_url ?? null;
  const initial = displayName?.[0] ?? '?';

  const openProduct = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <TouchableOpacity style={styles.postCard} activeOpacity={0.9} onPress={onOpen}>
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
        {post.dday_count != null && isValidValue(post.event_type) && (
          <View style={[styles.tag, styles.tagPink]}>
            <Text style={styles.tagPinkText}>
              {EVENT_EMOJI[post.event_type] ?? '✨'} D-{post.dday_count}
            </Text>
          </View>
        )}
        {isValidValue(post.personal_color) && (
          <View style={[styles.tag, styles.tagPurple]}>
            <Text style={styles.tagPurpleText}>{post.personal_color}</Text>
          </View>
        )}
        {isValidValue(post.vibe) && (
          <View style={[styles.tag, styles.tagPink]}>
            <Text style={styles.tagPinkText}>{post.vibe}</Text>
          </View>
        )}
        {isValidValue(post.skin_type) && (
          <View style={[styles.tag, styles.tagBlue]}>
            <Text style={styles.tagBlueText}>{post.skin_type}</Text>
          </View>
        )}
        {isValidValue(post.face_shape) && (
          <View style={[styles.tag, styles.tagGray]}>
            <Text style={styles.tagGrayText}>{post.face_shape}</Text>
          </View>
        )}
      </View>

      {post.post_type === 'before_after' && post.before_photo_url && post.after_photo_url ? (
        <View style={styles.beforeAfterRow}>
          <View style={styles.beforeAfterCol}>
            <Image source={{ uri: post.before_photo_url }} style={styles.beforeAfterImg} />
            <View style={[styles.baLabel, { backgroundColor: '#8A8A9A' }]}>
              <Text style={styles.baLabelText}>BEFORE</Text>
            </View>
          </View>
          <View style={styles.beforeAfterCol}>
            <Image source={{ uri: post.after_photo_url }} style={styles.beforeAfterImg} />
            <View style={[styles.baLabel, { backgroundColor: PINK }]}>
              <Text style={styles.baLabelText}>AFTER</Text>
            </View>
          </View>
        </View>
      ) : post.image_urls && post.image_urls.length > 0 ? (
        <Image source={{ uri: post.image_urls[0] }} style={styles.postHero} />
      ) : post.image_url ? (
        <Image source={{ uri: post.image_url }} style={styles.postHero} />
      ) : null}

      {!!post.content && (
        <Text style={styles.postContent} numberOfLines={4}>
          {post.content}
        </Text>
      )}

      {post.product_tags && post.product_tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productRow}
        >
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
        </ScrollView>
      )}

      <View style={styles.postFooter}>
        <TouchableOpacity style={styles.footerItem} onPress={onToggleLike} hitSlop={6}>
          <Ionicons
            name={post._isLiked ? 'heart' : 'heart-outline'}
            size={20}
            color={post._isLiked ? PINK : '#8A8A9A'}
          />
          <Text style={styles.footerText}>{post._likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem} onPress={onOpen} hitSlop={6}>
          <Ionicons name="chatbubble-outline" size={19} color="#8A8A9A" />
          <Text style={styles.footerText}>{post._commentCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem} onPress={onShare} hitSlop={6}>
          <Ionicons name="share-social-outline" size={19} color="#8A8A9A" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF8FA' },
  listContent: { paddingBottom: 100 },

  topBar: { paddingHorizontal: 20, paddingTop: 4 },
  logo: {
    width: 170,
    height: 68,
    resizeMode: 'contain',
    alignSelf: 'flex-start',
    marginLeft: -40,
    marginBottom: -8,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  headerSubtitle: {
    fontSize: 12,
    color: '#8A8A9A',
    marginTop: 2,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    position: 'relative',
    marginRight: 8,
    paddingTop: 4,
    paddingRight: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B9D',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  iconBtnWrap: { alignItems: 'center', justifyContent: 'center' },
  iconBtnRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnGlamRound: { backgroundColor: '#FFB6D0' },
  iconBtnPollRound: { backgroundColor: '#B8D8F0' },

  // Beauty Report — gradient hero card
  beautyReportCard: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  beautyReportLabel: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '500',
    marginBottom: 6,
  },
  beautyReportName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  beautyReportPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reportPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  reportPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  similarUsersText: {
    fontSize: 12,
    color: '#8A8A9A',
  },
  // Empty / loading hero (no profile yet)
  heroCardEmpty: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#E0D0E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
    gap: 10,
  },
  heroEmptyText: {
    fontSize: 13,
    color: '#1A1A2E',
    lineHeight: 20,
    fontWeight: '500',
  },
  heroEmptyBtnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  heroEmptyBtn: {
    flex: 1,
    backgroundColor: PINK,
    borderRadius: 50,
    paddingVertical: 10,
    alignItems: 'center',
  },
  heroEmptyBtnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PINK,
  },
  heroEmptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Feed tabs (Claude Design pill)
  feedTabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  feedTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  feedTabActive: {
    backgroundColor: '#FF6B9D',
    borderColor: '#FF6B9D',
  },
  feedTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A9A',
  },
  feedTabTextActive: {
    color: '#FFFFFF',
  },

  // 내 핏 active pills (Claude Design)
  myFitRow: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 12,
    gap: 4,
  },
  myFitLabel: { fontSize: 12, color: '#8A8A9A', fontWeight: '500' },
  myFitPillRow: { flexDirection: 'row', gap: 6 },
  myFitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#FF6B9D',
    backgroundColor: 'rgba(255,107,157,0.08)',
  },
  myFitPillText: { fontSize: 12, color: '#FF6B9D', fontWeight: '500' },

  // Manual filters
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 10,
    alignItems: 'center',
  },
  filterTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 6,
  },
  filterTypeText: { fontSize: 13, color: '#4A4A5A', fontWeight: '500' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipText: { fontSize: 13, color: '#4A4A5A', fontWeight: '500' },

  // Empty
  emptyWrap: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: '#8A8A9A', textAlign: 'center', lineHeight: 19 },
  emptyBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  emptyCtaShadow: {
    borderRadius: 50,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyCta: {
    borderRadius: 50,
    height: 52,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PINK,
  },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Post card — Claude Design aesthetic
  postCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#E0D0E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
    gap: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TAG_PINK_BG,
    borderWidth: 1.5,
    borderColor: '#F9C4D8',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: TAG_PINK, fontWeight: '800', fontSize: 16 },
  postName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  postTime: { fontSize: 12, color: '#8A8A9A', marginTop: 1 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  tagPink: { backgroundColor: 'rgba(255,107,157,0.12)' },
  tagPinkText: { fontSize: 11, color: '#FF6B9D', fontWeight: '600' },
  tagPurple: { backgroundColor: 'rgba(155,89,182,0.12)' },
  tagPurpleText: { fontSize: 11, color: '#9B59B6', fontWeight: '600' },
  tagBlue: { backgroundColor: 'rgba(91,163,217,0.12)' },
  tagBlueText: { fontSize: 11, color: '#5BA3D9', fontWeight: '600' },
  tagGray: { backgroundColor: TAG_GRAY_BG },
  tagGrayText: { fontSize: 11, color: TAG_GRAY, fontWeight: '600' },

  postHero: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F0E6EC',
  },

  beforeAfterRow: { flexDirection: 'row', gap: 8 },
  beforeAfterCol: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  beforeAfterImg: { width: '100%', height: 200, backgroundColor: '#F0E6EC' },
  baLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  baLabelText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  postContent: { fontSize: 14, color: '#1A1A2E', lineHeight: 22, marginTop: 4 },

  productRow: { gap: 6, paddingRight: 14 },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TAG_PINK_BG,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  productChipText: { fontSize: 11, color: TAG_PINK, fontWeight: '600' },

  postFooter: {
    flexDirection: 'row',
    gap: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EEF3',
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12, color: '#8A8A9A', fontWeight: '600' },

  // FAB
  fabShadow: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 26,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
