// Community notifications — MEVE-200.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import {
  MainStackParamList,
  PostNotification,
  NotificationType,
} from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Notifications'>;

const PINK = '#FF6B9D';
const BLUE = '#2D3A6B';

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

function notificationText(type: NotificationType, actorName: string): string {
  if (type === 'comment')
    return `${actorName}님이 회원님의 게시물에 댓글을 남겼어요`;
  if (type === 'reply')
    return `${actorName}님이 회원님의 댓글에 답글을 달았어요`;
  return `${actorName}님이 회원님의 게시물을 좋아해요`;
}

export function NotificationScreen() {
  const navigation = useNavigation<Nav>();

  const [notifications, setNotifications] = useState<PostNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      if (!user) {
        setNotifications([]);
        return;
      }

      const { data: rows, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const raw = (rows ?? []) as PostNotification[];

      // Fetch actor profiles + post previews in parallel
      const actorIds = Array.from(new Set(raw.map((n) => n.actor_id).filter(Boolean))) as string[];
      const postIds = Array.from(new Set(raw.map((n) => n.post_id).filter(Boolean))) as string[];

      const [profResult, postResult] = await Promise.all([
        actorIds.length > 0
          ? supabase
              .from('user_profiles')
              .select('id, display_name, avatar_url')
              .in('id', actorIds)
          : Promise.resolve({ data: [] as any[] }),
        postIds.length > 0
          ? supabase
              .from('posts')
              .select('id, content, image_urls')
              .in('id', postIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      for (const p of (profResult.data ?? []) as any[]) {
        profiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      }
      const posts: Record<string, { content: string | null; image_urls: string[] | null }> = {};
      for (const p of (postResult.data ?? []) as any[]) {
        posts[p.id] = {
          content: p.content,
          image_urls: Array.isArray(p.image_urls) ? p.image_urls : null,
        };
      }

      const merged: PostNotification[] = raw.map((n) => ({
        ...n,
        actor: n.actor_id ? profiles[n.actor_id] ?? null : null,
        post: n.post_id ? posts[n.post_id] ?? null : null,
      }));
      setNotifications(merged);
    } catch (e: any) {
      Alert.alert('불러오기 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const markAllRead = async () => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e: any) {
      Alert.alert('실패', e?.message ?? '다시 시도해 주세요.');
    }
  };

  const handlePress = async (n: PostNotification) => {
    // Mark this one read
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', n.id);
      } catch {}
    }
    if (n.post_id) {
      navigation.navigate('PostDetail', { postId: n.post_id });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const renderItem = ({ item }: { item: PostNotification }) => {
    const actorName = item.actor?.display_name ?? '누군가';
    const avatar = item.actor?.avatar_url ?? null;
    const initial = actorName[0] ?? '?';
    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        activeOpacity={0.7}
        onPress={() => handlePress(item)}
      >
        {!item.is_read && <View style={styles.unreadDot} />}
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View
            style={[
              styles.typeBadge,
              item.type === 'like'
                ? { backgroundColor: PINK }
                : { backgroundColor: BLUE },
            ]}
          >
            <Text style={styles.typeBadgeText}>
              {item.type === 'like' ? '❤️' : item.type === 'reply' ? '↩️' : '💬'}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>
            {notificationText(item.type, actorName)}
          </Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        {item.post?.image_urls && item.post.image_urls[0] ? (
          <Image source={{ uri: item.post.image_urls[0] }} style={styles.preview} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        <TouchableOpacity onPress={markAllRead} hitSlop={8}>
          <Text style={styles.markAllBtn}>모두 읽음</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PINK} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={notifications.length === 0 ? styles.emptyFill : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PINK}
              colors={[PINK]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>아직 알림이 없어요 🔔</Text>
              <Text style={styles.emptyDesc}>
                게시글을 올리면 댓글과 좋아요 알림을 받을 수 있어요
              </Text>
            </View>
          }
        />
      )}
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
  markAllBtn: { fontSize: 13, color: PINK, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5EEF3',
    position: 'relative',
  },
  rowUnread: { backgroundColor: '#FFF8FA' },
  unreadDot: {
    position: 'absolute',
    left: 6,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PINK,
  },

  avatarWrap: { position: 'relative' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0E6EC',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#8A8A9A', fontWeight: '700', fontSize: 14 },
  typeBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  typeBadgeText: { fontSize: 10 },

  text: { fontSize: 13, color: '#1A1A1F', lineHeight: 19 },
  time: { fontSize: 12, color: '#8A8A9A', marginTop: 2 },

  preview: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0E6EC',
  },

  emptyFill: { flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1F' },
  emptyDesc: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 19,
  },
});
