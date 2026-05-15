import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { MainStackParamList, GlamSync } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'GlamSyncList'>;
const PINK = '#FF6B9D';

function formatEventDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86_400_000);
}

export function GlamSyncListScreen() {
  const navigation = useNavigation<Nav>();
  const [syncs, setSyncs] = useState<GlamSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinVisible, setJoinVisible] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('glam_syncs')
        .select('*')
        .order('created_at', { ascending: false });
      setSyncs((data as GlamSync[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('코드 확인', '6자리 초대 코드를 입력해주세요.');
      return;
    }
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const { data: sync, error: fetchErr } = await supabase
        .from('glam_syncs')
        .select('*')
        .eq('invite_code', trimmed)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!sync) throw new Error('해당 코드의 글램 싱크를 찾을 수 없어요.');

      const { error: memberErr } = await supabase
        .from('glam_sync_members')
        .insert({ sync_id: sync.id, user_id: user.id });
      if (memberErr && memberErr.code !== '23505') throw memberErr;

      setJoinVisible(false);
      setCode('');
      navigation.navigate('GlamSyncDetail', { syncId: sync.id });
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
        <Text style={styles.headerTitle}>글램 싱크 ✨</Text>
        <TouchableOpacity onPress={() => setJoinVisible(true)} hitSlop={8}>
          <Text style={styles.headerRight}>초대 코드</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PINK} />
        </View>
      ) : syncs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="sparkles-outline" size={40} color="#FFC4D6" />
          <Text style={styles.emptyTitle}>
            아직 글램 싱크가 없어요.{'\n'}친구와 꾸밈 정도를 맞춰보세요!
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {syncs.map((s) => {
            const d = daysLeft(s.event_date);
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.card}
                onPress={() => navigation.navigate('GlamSyncDetail', { syncId: s.id })}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardName}>{s.event_name}</Text>
                  <Text style={styles.cardMeta}>
                    {formatEventDate(s.event_date)}
                    {d != null ? ` · D-${d}` : ''}
                  </Text>
                  <View style={styles.cardBadges}>
                    {s.final_glam_level != null ? (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>확정 · {s.final_glam_level}/10</Text>
                      </View>
                    ) : (
                      <View style={styles.openBadge}>
                        <Text style={styles.openBadgeText}>진행 중</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C0C0CC" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('GlamSyncCreate')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.fabText}>글램 싱크 만들기</Text>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  emptyTitle: { fontSize: 14, color: '#8A8A9A', textAlign: 'center', lineHeight: 20 },

  list: { padding: 20, gap: 10, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,220,230,0.5)',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1A1A1F' },
  cardMeta: { fontSize: 12, color: '#8A8A9A' },
  cardBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  doneBadge: {
    backgroundColor: '#FFC4D6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  doneBadgeText: { fontSize: 11, color: '#C44777', fontWeight: '700' },
  openBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  openBadgeText: { fontSize: 11, color: '#2D3A6B', fontWeight: '700' },

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
    backgroundColor: 'rgba(45,45,45,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1F' },
  modalSub: { fontSize: 12, color: '#8A8A9A' },
  codeInput: {
    borderWidth: 1,
    borderColor: '#E2D5DC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1F',
    textAlign: 'center',
    letterSpacing: 4,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F0E6EC',
  },
  modalCancelText: { color: '#8A8A9A', fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: PINK,
  },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
