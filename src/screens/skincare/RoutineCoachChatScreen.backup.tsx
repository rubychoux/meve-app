// AI 루틴 코치 채팅 — MEVE-175. GPT-4o chat with profile-aware system prompt.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { useMode } from '../../stores/modeStore';
import { getEventConfig } from '../../constants/eventConfig';

type Nav = NativeStackNavigationProp<MainStackParamList, 'RoutineCoachChat'>;
type Route = RouteProp<MainStackParamList, 'RoutineCoachChat'>;

const BLUE = '#2D3A6B';
const STORAGE_KEY = 'meve_coach_messages';
const MAX_HISTORY = 20;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

const SUGGESTED_QUESTIONS = [
  '비타민C 써도 돼요?',
  '여드름이 났어요 😢',
  'D-day 전 뭘 집중해요?',
  '지금 루틴 괜찮나요?',
];

function buildSystemPrompt(profileContext: string, eventType: string | null) {
  const eventConfig = getEventConfig(eventType);
  const toneLine = eventConfig
    ? `말투 지시 (이벤트별 톤): ${eventConfig.coachTone}`
    : '';
  return `You are meve's AI skincare coach speaking in Korean 해요체.
Be concise (2-4 sentences per response).
${toneLine}

사용자 프로필:
${profileContext}

Personalize to their profile and event. Never diagnose medically.`;
}

// MEVE-253 — LOOK-mode coach prompt: stylist persona, scoped to beauty/style.
function buildLookSystemPrompt(
  profileContext: string,
  personalColor: string | null,
  vibe: string | null
) {
  return `당신은 meve의 AI 스타일 코치예요.
퍼스널컬러, 메이크업, 룩, 추구미 관련 전문가로서 도움을 드려요.

사용자 프로필:
${profileContext}

규칙:
- 스타일·뷰티·메이크업 관련 질문에만 답하세요
- 퍼스널컬러 (${personalColor ?? '미분석'}) 기반으로 조언하세요
- 추구미 (${vibe ?? '미설정'}) 를 존중하세요
- 한국어 해요체로 답하세요
- 친근하고 스타일리시한 말투로, 2-4문장으로 답하세요`;
}

export function RoutineCoachChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const globalMode = useMode();
  const chatMode: 'skin' | 'look' = route.params?.mode ?? globalMode;
  const getProfileContext = useBeautyProfile((s) => s.getProfileContext);
  const profileEventType = useBeautyProfile((s) => s.eventType);
  const profilePersonalColor = useBeautyProfile((s) => s.personalColor);
  const profileVibe = useBeautyProfile((s) => s.vibe);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Typing indicator dots
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // Load chat history on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
      } catch {}
    })();
  }, []);

  // Animate typing dots when sending
  useEffect(() => {
    if (!sending) return;
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      );
    const a = loop(dot1, 0);
    const b = loop(dot2, 150);
    const c = loop(dot3, 300);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [sending, dot1, dot2, dot3]);

  const persist = useCallback(async (next: ChatMessage[]) => {
    try {
      const trimmed = next.slice(-MAX_HISTORY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    persist(nextHistory);
    setSending(true);

    try {
      const systemPrompt =
        chatMode === 'look'
          ? buildLookSystemPrompt(
              getProfileContext(),
              profilePersonalColor,
              profileVibe
            )
          : buildSystemPrompt(getProfileContext(), profileEventType);
      const gptMessages = [
        { role: 'system', content: systemPrompt },
        ...nextHistory.map((m) => ({ role: m.role, content: m.content })),
      ];
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: gptMessages,
          max_tokens: 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `OpenAI ${res.status}`);
      const reply = data.choices[0].message.content.trim();

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      };
      const withReply = [...nextHistory, aiMsg];
      setMessages(withReply);
      persist(withReply);
    } catch (e: any) {
      Alert.alert('답변 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    Alert.alert('초기화', '대화 내역을 모두 지울까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
          } catch {}
          setMessages([]);
        },
      },
    ]);
  };

  // Inverted FlatList — reverse data + newest first
  const inverted = useMemo(() => [...messages].reverse(), [messages]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.msgRow, { justifyContent: 'flex-end' }]}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.msgRow}>
        <View style={{ maxWidth: '80%' }}>
          <Text style={styles.aiLabel}>AI 코치 💙</Text>
          <View style={styles.aiBubble}>
            <Text style={styles.aiText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI 루틴 코치 💙</Text>
        <TouchableOpacity onPress={handleReset} hitSlop={8}>
          <Text style={styles.resetBtn}>초기화</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {messages.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyHero}>
                  <Ionicons name="chatbubbles" size={40} color={BLUE} />
                  <Text style={styles.emptyTitle}>무엇이든 물어봐요 ✨</Text>
                  <Text style={styles.emptyDesc}>
                    피부 루틴, 성분, D-day 집중 케어까지{'\n'}내 프로필에 맞춰 답변해드려요
                  </Text>
                </View>
                <Text style={styles.suggestLabel}>이런 질문 어때요?</Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                style={{ flex: 1 }}
                data={inverted}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                inverted
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  sending ? (
                    <View style={styles.msgRow}>
                      <View style={styles.aiBubble}>
                        <View style={styles.typingRow}>
                          <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
                          <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
                          <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
                        </View>
                      </View>
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Suggested pill chips — outside TouchableWithoutFeedback so taps fire reliably */}
        {messages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestScroll}
            contentContainerStyle={styles.suggestRow}
            keyboardShouldPersistTaps="handled"
          >
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => sendMessage(q)}
                style={styles.suggestChip}
                activeOpacity={0.75}
              >
                <Text style={styles.suggestChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <SafeAreaView edges={['bottom']} style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력해 주세요"
            placeholderTextColor="#B8AFB5"
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || sending) && { opacity: 0.5 },
            ]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
  resetBtn: { fontSize: 13, color: '#8A8A9A', fontWeight: '600' },

  emptyWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 40, gap: 20 },
  emptyHero: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1F' },
  emptyDesc: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 20,
  },
  suggestLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A9A',
  },
  suggestScroll: {
    height: 44,
    flexGrow: 0,
    marginBottom: 4,
  },
  suggestRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  suggestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: BLUE,
    backgroundColor: '#FFFFFF',
  },
  suggestChipText: { fontSize: 13, color: BLUE, fontWeight: '500' },

  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  msgRow: { flexDirection: 'row', marginVertical: 4 },

  userBubble: {
    backgroundColor: BLUE,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },

  aiLabel: {
    fontSize: 10,
    color: BLUE,
    fontWeight: '700',
    marginBottom: 3,
    marginLeft: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#B0B0B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  aiText: { color: '#1A1A1F', fontSize: 14, lineHeight: 21 },

  typingRow: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BLUE,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFE8ED',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#F9F5F7',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A1F',
    minHeight: 40,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
