// MEVE-253 — meve AI tab. Mode-aware tip channel (chat-style log of past
// daily tips from Supabase) plus a "new consultation" CTA into RoutineCoachChat.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ModeToggle } from '../../components/ui/ModeToggle';
import { useMode } from '../../stores/modeStore';
import { supabase } from '../../services/supabase';
import { MainStackParamList, MainTabParamList } from '../../types';

// v3 — MeveScreen lives in MainStack (reachable from TopBar sparkles icon).
type Nav = NativeStackNavigationProp<MainStackParamList, 'Meve'>;

interface TipMessage {
  id: string;
  tip_text: string;
  tip_date: string;
  mode: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function MeveScreen() {
  const navigation = useNavigation<Nav>();
  const mode = useMode();
  const [tips, setTips] = useState<TipMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const loadTips = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setTips([]);
        return;
      }
      const { data } = await supabase
        .from('daily_tips')
        .select('id, tip_text, tip_date, mode')
        .eq('user_id', user.id)
        .eq('mode', mode)
        .order('tip_date', { ascending: true })
        .limit(30);
      setTips((data as TipMessage[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  useFocusEffect(
    useCallback(() => {
      loadTips();
    }, [loadTips])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>meve AI</Text>
        <TouchableOpacity
          style={[
            styles.newChatBtn,
            mode === 'look' ? styles.newChatBtnLook : styles.newChatBtnSkin,
          ]}
          onPress={() => navigation.navigate('RoutineCoachChat', { context: mode })}
          activeOpacity={0.85}
        >
          <Text style={styles.newChatBtnText}>
            {mode === 'skin' ? '💙 새 피부 상담' : '💕 새 스타일 상담'}
          </Text>
        </TouchableOpacity>
      </View>

      <ModeToggle />

      <View style={styles.channelLabel}>
        <Text style={styles.channelLabelText}>
          {mode === 'skin' ? '💙 meve SKIN 채널' : '💕 meve LOOK 채널'}
        </Text>
        <Text style={styles.channelLabelSub}>매일 업데이트되는 뷰티 팁</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#5BA3D9" />
        </View>
      ) : tips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{mode === 'skin' ? '💙' : '💕'}</Text>
          <Text style={styles.emptyTitle}>아직 팁이 없어요</Text>
          <Text style={styles.emptyDesc}>
            홈탭에서 오늘의 팁을 확인하면{'\n'}여기에 기록이 쌓여요
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {tips.map((tip, index) => {
            const prevTip = index > 0 ? tips[index - 1] : null;
            const showDate = !prevTip || prevTip.tip_date !== tip.tip_date;
            return (
              <View key={tip.id}>
                {showDate && (
                  <View style={styles.dateDivider}>
                    <View style={styles.dateDividerLine} />
                    <Text style={styles.dateDividerText}>
                      {formatDate(tip.tip_date)}
                    </Text>
                    <View style={styles.dateDividerLine} />
                  </View>
                )}
                <View style={styles.tipMessage}>
                  <View
                    style={[
                      styles.tipAvatar,
                      mode === 'look' ? styles.tipAvatarLook : styles.tipAvatarSkin,
                    ]}
                  >
                    <Text style={styles.tipAvatarText}>m</Text>
                  </View>
                  <View style={styles.tipBubbleWrapper}>
                    <Text style={styles.tipSender}>meve</Text>
                    <View
                      style={[
                        styles.tipBubble,
                        mode === 'look' ? styles.tipBubbleLook : styles.tipBubbleSkin,
                      ]}
                    >
                      <Text style={styles.tipModeLabel}>
                        {mode === 'skin'
                          ? '💙 오늘의 SKIN 팁'
                          : '💕 오늘의 LOOK 팁'}
                      </Text>
                      <Text style={styles.tipText}>{tip.tip_text}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1F' },
  newChatBtn: {
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newChatBtnSkin: { backgroundColor: '#2D3A6B' },
  newChatBtnLook: { backgroundColor: '#FF6B9D' },
  newChatBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  channelLabel: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelLabelText: { fontSize: 14, fontWeight: '700', color: '#1A1A1F' },
  channelLabelSub: { fontSize: 11, color: '#8A8A9A' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 22,
  },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 32 },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 8,
  },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  dateDividerText: { fontSize: 12, color: '#8A8A9A', fontWeight: '500' },
  tipMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  tipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipAvatarSkin: { backgroundColor: '#2D3A6B' },
  tipAvatarLook: { backgroundColor: '#FF6B9D' },
  tipAvatarText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  tipBubbleWrapper: { flex: 1 },
  tipSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A9A',
    marginBottom: 4,
  },
  tipBubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
    maxWidth: '90%',
  },
  tipBubbleSkin: { backgroundColor: '#E8F4FD' },
  tipBubbleLook: { backgroundColor: '#FFF0F5' },
  tipModeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A9A',
    marginBottom: 6,
  },
  tipText: { fontSize: 14, color: '#1A1A1F', lineHeight: 22 },
});
