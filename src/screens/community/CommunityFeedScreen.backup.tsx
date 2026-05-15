import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { CommunityStackParamList } from '../../types';
import { TopBar } from '../../components/common/TopBar';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'Community'>;

export interface CommunityPostRow {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author_name?: string | null;
}

export function CommunityFeedScreen() {
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('posts')
      .select('id, user_id, content, image_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[community] posts load:', error.message);
      setPosts([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const list = (rows ?? []) as CommunityPostRow[];
    const userIds = [...new Set(list.map((r) => r.user_id))];
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds);
      if (profiles) {
        nameMap = Object.fromEntries(
          profiles.map((p: { id: string; display_name: string | null }) => [
            p.id,
            p.display_name ?? '',
          ])
        );
      }
    }

    setPosts(
      list.map((r) => ({
        ...r,
        author_name: nameMap[r.user_id] || null,
      }))
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPosts();
    }, [loadPosts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />
      <View style={styles.header}>
        <Text style={styles.title}>커뮤니티</Text>
        <TouchableOpacity
          style={styles.writeBtn}
          onPress={() => navigation.navigate('CreatePost')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add-circle-outline" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={48} color={Colors.textDisabled} />
              <Text style={styles.emptyTitle}>첫 글을 남겨보세요</Text>
              <Text style={styles.emptySub}>사진과 함께 피부 루틴·팁을 공유할 수 있어요</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle-outline" size={22} color={Colors.textSecondary} />
                <Text style={styles.author} numberOfLines={1}>
                  {item.author_name || '회원'}
                </Text>
                <Text style={styles.time}>{formatTime(item.created_at)}</Text>
              </View>
              {item.content ? <Text style={styles.body}>{item.content}</Text> : null}
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { ...Typography.h2 },
  writeBtn: { padding: 4 },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: { flex: 1, ...Typography.body, fontWeight: '600' },
  time: { ...Typography.caption, color: Colors.textSecondary },
  body: { ...Typography.body, lineHeight: 22 },
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderMuted,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyTitle: { ...Typography.h3, marginTop: Spacing.sm },
  emptySub: { ...Typography.bodySecondary, textAlign: 'center' },
});
