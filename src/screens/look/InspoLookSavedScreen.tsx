// Saved inspo looks list — MEVE-175 / Look tab polish.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { InspoLookResult, MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'InspoLookSaved'>;

const ACCENT = '#FF6B9D';
const SAVED_KEY = 'meve_inspo_looks';

interface SavedInspo {
  savedAt: string;
  imageUri?: string;
  keyword?: string;
  result: InspoLookResult;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function InspoLookSavedScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<SavedInspo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      const list: SavedInspo[] = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const removeAt = (idx: number) => {
    Alert.alert('삭제', '저장한 인스포 룩을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const next = items.filter((_, i) => i !== idx);
          setItems(next);
          try {
            await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
          } catch {}
        },
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: SavedInspo; index: number }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() =>
        navigation.navigate('InspoLookResult', {
          result: item.result,
          imageUri: item.imageUri,
          keyword: item.keyword,
        })
      }
      onLongPress={() => removeAt(index)}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name="sparkles-outline" size={22} color={ACCENT} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.vibe} numberOfLines={1}>
          {item.result.referenceAnalysis?.overallVibe ?? '인스포 룩'}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {item.result.summary}
        </Text>
        <Text style={styles.date}>{formatDate(item.savedAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C8BFC6" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>저장한 인스포 룩</Text>
        <View style={{ width: 24 }} />
      </View>

      {loaded && items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="sparkles-outline" size={36} color={ACCENT} />
          <Text style={styles.emptyTitle}>저장한 인스포 룩이 아직 없어요</Text>
          <Text style={styles.emptyDesc}>
            마음에 드는 인스포 룩 분석 결과를{'\n'}저장하면 여기서 다시 볼 수 있어요
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => navigation.navigate('InspoLook')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyCtaText}>인스포 룩 분석하러 가기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            items.length > 0 ? (
              <Text style={styles.footerHint}>길게 눌러 삭제할 수 있어요</Text>
            ) : null
          }
        />
      )}
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

  list: { padding: 16, paddingBottom: 40 },
  separator: { height: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0E6EC',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FFF5F9',
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  vibe: { fontSize: 14, fontWeight: '700', color: ACCENT },
  summary: { fontSize: 12, color: '#2D2D2D', lineHeight: 17 },
  date: { fontSize: 11, color: '#9A8F97', marginTop: 2 },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
  emptyDesc: {
    fontSize: 13,
    color: '#9A8F97',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyCta: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 50,
    height: 48,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  footerHint: {
    fontSize: 11,
    color: '#B8AFB5',
    textAlign: 'center',
    marginTop: 14,
  },
});
