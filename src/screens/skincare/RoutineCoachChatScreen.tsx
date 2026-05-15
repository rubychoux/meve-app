/**
 * RoutineCoachChatScreen — v1.5 meve AI 통합 코치.
 *
 * 백업: RoutineCoachChatScreen.backup.tsx
 *
 * 핵심 변경:
 *   - SKIN/LOOK 채널 토글 제거 → 하나의 통합 코치
 *   - "AI 루틴 코치" → "meve AI"
 *   - context 기반 동적 시스템 프롬프트 + 프리셋 질문
 *   - GPT 응답에 특수 태그 ([PRODUCT_CARD] / [ROUTINE_CHANGE] / [ACTION_BUTTON]
 *     / [DDAY_CARD])를 파싱하여 인라인 카드로 렌더링
 *   - 사용자 데이터 (프로필 / 스코어 / 루틴 / D-day / 라이프스타일 / 제품 반응)
 *     를 시스템 프롬프트에 주입
 *
 * 보존된 logic:
 *   - GPT-4o API 호출
 *   - 채팅 메시지 state + AsyncStorage 저장 (Supabase 저장은 별도 테이블 생기면 추가)
 *   - 키보드 핸들링 (KeyboardAvoidingView + TouchableWithoutFeedback)
 *   - 타이핑 애니메이션 (3 dots)
 *   - useBeautyProfile 구독 + AsyncStorage 'meve_routine' 로드
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { getEventConfig, phaseStatus } from '../../constants/eventConfig';
import { colors, BeautyTypeCode } from '../../theme';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<MainStackParamList, 'RoutineCoachChat'>;
type Route = RouteProp<MainStackParamList, 'RoutineCoachChat'>;

const STORAGE_KEY = 'meve_coach_messages';
const MAX_HISTORY = 20;
const BLUE = '#2D3A6B';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

type Context = 'skin' | 'look' | 'home' | 'product' | 'scan_result';

interface ProductCardData {
  brand: string;
  name: string;
  matchPercent: number;
  reason: string;
  productId?: string;
  swatch?: string;
}
interface RoutineChangeData {
  action: 'add' | 'remove' | 'swap';
  step: string;
  position?: number;
  routine: 'AM' | 'PM';
}
interface ActionButtonData {
  label: string;
  screen: string;
  icon?: keyof typeof Ionicons.glyphMap;
}
interface DDayCardData {
  label: string;
  title: string;
  desc: string;
}

type ParsedPart =
  | { type: 'text'; content: string }
  | { type: 'product_card'; content: ProductCardData }
  | { type: 'routine_change'; content: RoutineChangeData }
  | { type: 'action_button'; content: ActionButtonData }
  | { type: 'dday_card'; content: DDayCardData };

// ─── Preset questions per context ─────────────────────────────────────────────

const PRESETS: Record<Context, string[]> = {
  home: ['오늘 뭐 바를까?', '스코어 왜 떨어졌어?', 'D-day 준비 뭐 해야 해?'],
  skin: ['루틴 바꾸고 싶어', '이 성분 써도 돼?', '트러블 원인 뭐야?'],
  look: ['오늘 메이크업 추천', '쿨톤 립 뭐가 좋아?', '쉐딩 어떻게 해?'],
  product: ['이 제품 내 피부에 맞아?', '비슷한 제품 추천', '성분 괜찮아?'],
  scan_result: ['결과 설명해줘', '어떻게 관리해?', '추천 제품 있어?'],
};

// ─── Response parser ──────────────────────────────────────────────────────────

function parseCoachResponse(text: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  const regex = /\[(PRODUCT_CARD|ROUTINE_CHANGE|ACTION_BUTTON|DDAY_CARD)\]([\s\S]*?)\[\/\1\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const txt = text.slice(lastIndex, match.index).trim();
      if (txt) parts.push({ type: 'text', content: txt });
    }
    try {
      const json = JSON.parse(match[2]);
      const tag = match[1].toLowerCase();
      if (tag === 'product_card') parts.push({ type: 'product_card', content: json });
      else if (tag === 'routine_change') parts.push({ type: 'routine_change', content: json });
      else if (tag === 'action_button') parts.push({ type: 'action_button', content: json });
      else if (tag === 'dday_card') parts.push({ type: 'dday_card', content: json });
    } catch {
      // Malformed JSON — keep tag content as text fallback
      parts.push({ type: 'text', content: match[2] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim();
    if (tail) parts.push({ type: 'text', content: tail });
  }
  return parts;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function RoutineCoachChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  // Backward-compat: legacy `mode` → context
  const context: Context =
    route.params?.context ??
    (route.params?.mode === 'look' ? 'look' : route.params?.mode === 'skin' ? 'skin' : 'home');
  const contextData = route.params?.contextData;
  const insets = useSafeAreaInsets();

  // ── Profile / data store subscriptions ───────────────────────────────────
  const beautyType = useBeautyProfile((s) => s.beautyType);
  const personalColor = useBeautyProfile((s) => s.personalColor);
  const faceShape = useBeautyProfile((s) => s.faceShape);
  const eyeType = useBeautyProfile((s) => s.eyeType);
  const skinType = useBeautyProfile((s) => s.skinType);
  const skinConcerns = useBeautyProfile((s) => s.skinConcerns);
  const vibe = useBeautyProfile((s) => s.vibe);
  const lastSkinScore = useBeautyProfile((s) => s.lastSkinScore);
  const eventType = useBeautyProfile((s) => s.eventType);
  const eventDate = useBeautyProfile((s) => s.eventDate);
  const loadProfile = useBeautyProfile((s) => s.loadProfile);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // ── Extra user data (fetched on mount) ───────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [scoreDiff, setScoreDiff] = useState<number | null>(null);
  const [amRoutine, setAmRoutine] = useState<string[]>([]);
  const [pmRoutine, setPmRoutine] = useState<string[]>([]);

  // Animated typing dots
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // ── Load chat history (Supabase → AsyncStorage fallback) ────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('id, role, content, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(50);
          if (!error && data && data.length > 0) {
            const loaded: ChatMessage[] = data.map((r: any) => ({
              id: r.id,
              role: r.role,
              content: r.content,
              createdAt: new Date(r.created_at).getTime(),
            }));
            setMessages(loaded);
            return;
          }
        }
      } catch {}
      // Offline / legacy fallback
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
      } catch {}
    })();
  }, []);

  // ── Fetch user data for system prompt ────────────────────────────────────
  useEffect(() => {
    loadProfile();

    (async () => {
      // Display name
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle();
          if (data?.display_name) setDisplayName(data.display_name);
        }
      } catch {}

      // Last 2 scans for scoreDiff
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('skin_scans')
            .select('scan_result, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(2);
          if (data && data.length === 2) {
            const cur = (data[0] as any).scan_result?.overallScore ?? 0;
            const prev = (data[1] as any).scan_result?.overallScore ?? 0;
            setScoreDiff(cur - prev);
          }
        }
      } catch {}

      // Routine steps
      try {
        const raw = await AsyncStorage.getItem('meve_routine');
        if (raw) {
          const parsed = JSON.parse(raw);
          const toLabels = (arr: any): string[] =>
            Array.isArray(arr)
              ? arr
                  .map((s: any) =>
                    typeof s === 'string'
                      ? s
                      : s?.product ?? s?.category ?? s?.step ?? '',
                  )
                  .filter(Boolean)
              : [];
          setAmRoutine(toLabels(parsed?.am));
          setPmRoutine(toLabels(parsed?.pm));
        }
      } catch {}
    })();
  }, [loadProfile]);

  // ── Typing dots animation ────────────────────────────────────────────────
  useEffect(() => {
    if (!sending) return;
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
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

  // ── Derived values ───────────────────────────────────────────────────────
  const dnaCode = (beautyType as BeautyTypeCode | null) ?? null;
  const dnaInfo = dnaCode ? colors.types[dnaCode] : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = eventDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(eventDate).setHours(0, 0, 0, 0) - today.getTime()) /
            86_400_000,
        ),
      )
    : null;

  const eventTheme = getEventConfig(eventType);
  const currentPhase = (() => {
    if (!eventTheme || daysLeft == null) return null;
    for (const phase of eventTheme.plan) {
      if (phaseStatus(phase.daysBeforeLabel, daysLeft) === 'current') {
        return phase;
      }
    }
    return null;
  })();

  // ── System prompt builder ────────────────────────────────────────────────
  const buildSystemPrompt = useCallback((): string => {
    const lines: string[] = [
      'You are meve AI 코치. 사용자의 뷰티 전문가 친구처럼 대화해.',
      '한국어 반말, 친근하게. 답변은 3-4문장 이내로 짧고 실용적으로.',
      '',
      '=== 사용자 프로필 ===',
      `이름: ${displayName || '회원'}`,
      dnaInfo
        ? `뷰티 DNA: ${dnaCode} (${dnaInfo.name} / ${dnaInfo.kr})`
        : '뷰티 DNA: 미설정',
      `퍼스널컬러: ${personalColor ?? '미설정'}`,
      `얼굴형: ${faceShape ?? '미설정'}`,
      `눈 모양: ${eyeType ?? '미설정'}`,
      `피부 타입: ${skinType ?? '미설정'}`,
      `피부 고민: ${skinConcerns?.length ? skinConcerns.join(', ') : '미설정'}`,
      `추구미: ${vibe ?? '미설정'}`,
      '',
      '=== 현재 상태 ===',
      `스킨 스코어: ${lastSkinScore ?? '미측정'}점${scoreDiff != null ? ` (지난 측정 대비 ${scoreDiff > 0 ? '+' : ''}${scoreDiff})` : ''}`,
      '',
      '=== 현재 루틴 ===',
      `AM: ${amRoutine.length > 0 ? amRoutine.join(' → ') : '미설정'}`,
      `PM: ${pmRoutine.length > 0 ? pmRoutine.join(' → ') : '미설정'}`,
      '',
      '=== D-day ===',
      `이벤트: ${eventType ?? '없음'}`,
      `남은 일수: ${daysLeft != null ? `D-${daysLeft}` : '없음'}`,
      `현재 케어 단계: ${currentPhase?.title ?? '없음'}`,
      '',
      `=== 현재 화면 컨텍스트 ===`,
      `context: ${context}`,
    ];
    if (contextData?.productId) lines.push(`productId: ${contextData.productId}`);
    if (contextData?.scanResultId) lines.push(`scanResultId: ${contextData.scanResultId}`);
    if (contextData?.currentScreen) lines.push(`currentScreen: ${contextData.currentScreen}`);

    lines.push(
      '',
      '=== 규칙 ===',
      '1. 위 데이터를 기반으로 개인화된 답변. "일반적으로" 금지.',
      '2. 제품 추천 시 매칭 근거를 사용자 프로필 기반으로 설명.',
      '3. D-day가 있으면 항상 남은 일수 맥락에서 답변.',
      '4. 루틴 변경은 현재 루틴 기준 어디에 추가/삭제하는지 구체적으로.',
      '',
      '=== 특수 태그 (응답에 인라인 삽입 가능) ===',
      '제품 추천:',
      '[PRODUCT_CARD]{"brand":"힌스","name":"Second Skin Lip 06","matchPercent":95,"reason":"쿨톤·MLBB·청순"}[/PRODUCT_CARD]',
      '루틴 변경:',
      '[ROUTINE_CHANGE]{"action":"add","step":"세라마이드 세럼","position":3,"routine":"AM"}[/ROUTINE_CHANGE]',
      '화면 이동:',
      '[ACTION_BUTTON]{"label":"트러블 분석 보기","screen":"TroubleAnalysis","icon":"analytics-outline"}[/ACTION_BUTTON]',
      'D-day:',
      '[DDAY_CARD]{"label":"D-38 · 졸업식","title":"지금 해야 할 것","desc":"새 제품 테스트 기간"}[/DDAY_CARD]',
      '태그는 일반 문장 사이에 자연스럽게 삽입. 모든 응답에 태그를 강제하지는 마.',
    );
    return lines.join('\n');
  }, [
    displayName, dnaCode, dnaInfo, personalColor, faceShape, eyeType, skinType,
    skinConcerns, vibe, lastSkinScore, scoreDiff, amRoutine, pmRoutine,
    eventType, daysLeft, currentPhase, context, contextData,
  ]);

  // ── Persist ──────────────────────────────────────────────────────────────
  const persist = useCallback(async (next: ChatMessage[]) => {
    try {
      const trimmed = next.slice(-MAX_HISTORY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────
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

    // Persist user message to Supabase (fire-and-forget).
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('chat_messages').insert({
            user_id: user.id,
            role: 'user',
            content: trimmed,
          });
        }
      } catch {}
    })();

    try {
      const systemPrompt = buildSystemPrompt();
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
          max_tokens: 600,
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

      // Persist assistant message to Supabase.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('chat_messages').insert({
            user_id: user.id,
            role: 'assistant',
            content: reply,
          });
        }
      } catch {}
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
          // Clear local cache
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
          } catch {}
          // Clear remote history
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('chat_messages')
                .delete()
                .eq('user_id', user.id);
            }
          } catch {}
          setMessages([]);
        },
      },
    ]);
  };

  // Inverted list — newest at the bottom
  const inverted = useMemo(() => [...messages].reverse(), [messages]);
  const presets = PRESETS[context];

  // ── Render coach bubble parts (incl. inline cards) ───────────────────────
  const renderCoachParts = (parts: ParsedPart[]) => (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <View key={`t-${i}`} style={styles.coachBubble}>
              <Text style={styles.coachText}>{part.content}</Text>
            </View>
          );
        }
        if (part.type === 'product_card') {
          const p = part.content;
          return (
            <TouchableOpacity
              key={`p-${i}`}
              style={styles.cardInline}
              onPress={() => navigation.navigate('PostDetail', { postId: p.productId ?? '' } as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.productSwatch, { backgroundColor: p.swatch ?? '#E4D4FF' }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.productBrand}>{p.brand}</Text>
                <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.productReason} numberOfLines={1}>{p.reason}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.productMatch}>{p.matchPercent}%</Text>
                <Ionicons name="chevron-forward" size={14} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          );
        }
        if (part.type === 'routine_change') {
          const r = part.content;
          return (
            <View key={`r-${i}`} style={[styles.cardInline, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
              <Text style={styles.routineCardTitle}>{r.routine} 루틴 변경 제안</Text>
              <View style={styles.routineStepRow}>
                <LinearGradient
                  colors={['#FFD4DC', '#E4D4FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.routineDotNew}
                />
                <Text style={styles.routineStepText}>{r.step}</Text>
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.routineCtaPrimary}
                  onPress={() => Alert.alert('추가됨', `${r.routine} 루틴에 "${r.step}" 추가 (저장은 곧 지원)`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.routineCtaPrimaryText}>추가하기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.routineCtaSecondary} activeOpacity={0.85}>
                  <Text style={styles.routineCtaSecondaryText}>나중에</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        if (part.type === 'action_button') {
          const a = part.content;
          return (
            <TouchableOpacity
              key={`a-${i}`}
              style={styles.actionBtn}
              onPress={() => navigation.navigate(a.screen as any)}
              activeOpacity={0.85}
            >
              {a.icon && <Ionicons name={a.icon} size={16} color={BLUE} />}
              <Text style={styles.actionBtnText}>{a.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={BLUE} />
            </TouchableOpacity>
          );
        }
        if (part.type === 'dday_card') {
          const d = part.content;
          return (
            <View key={`d-${i}`} style={styles.ddayCard}>
              <LinearGradient
                colors={['rgba(255,212,220,0.2)', 'rgba(228,212,255,0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.ddayLabel}>{d.label}</Text>
              <Text style={styles.ddayTitle}>{d.title}</Text>
              <Text style={styles.ddayDesc}>{d.desc}</Text>
            </View>
          );
        }
        return null;
      })}
    </>
  );

  // ── List item renderer ───────────────────────────────────────────────────
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
    const parts = parseCoachResponse(item.content);
    return (
      <View style={styles.msgRow}>
        <View style={styles.coachAvatar}>
          <LinearGradient
            colors={['#FFD4DC', '#E4D4FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.coachAvatarChar}>m</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8, gap: 6 }}>
          {renderCoachParts(parts)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={BLUE} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>meve AI</Text>
          <Text style={styles.headerSub}>너의 뷰티를 아는 코치</Text>
        </View>
        <TouchableOpacity onPress={handleReset} hitSlop={8}>
          <Text style={styles.resetBtn}>초기화</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {messages.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.coachAvatarLg}>
                  <LinearGradient
                    colors={['#FFD4DC', '#E4D4FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.coachAvatarLgChar}>m</Text>
                </View>
                <Text style={styles.emptyTitle}>무엇이든 물어봐</Text>
                <Text style={styles.emptyDesc}>
                  내 프로필, 루틴, D-day까지{'\n'}전부 알고 답해줄게
                </Text>
              </View>
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={inverted}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                inverted
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListHeaderComponent={
                  sending ? (
                    <View style={styles.msgRow}>
                      <View style={styles.coachAvatar}>
                        <LinearGradient
                          colors={['#FFD4DC', '#E4D4FF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <Text style={styles.coachAvatarChar}>m</Text>
                      </View>
                      <View style={[styles.coachBubble, { marginLeft: 8 }]}>
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

        {/* Preset chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presetRow}
          keyboardShouldPersistTaps="handled"
        >
          {presets.map((q, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => sendMessage(q)}
              style={styles.presetChip}
              activeOpacity={0.75}
            >
              <Text style={styles.presetChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력해 주세요"
            placeholderTextColor="rgba(26,26,31,0.3)"
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
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF5F6' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 20,
    color: BLUE,
    fontWeight: '300',
  },
  headerSub: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 9,
    lineHeight: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  resetBtn: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: '#8E8E93',
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  coachAvatarLg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  coachAvatarLgChar: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 28,
    lineHeight: 32,
    color: BLUE,
    fontWeight: '300',
  },
  emptyTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  emptyDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Message list
  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  msgRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-start',
  },

  // Coach avatar (small, on each message)
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  coachAvatarChar: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 14,
    color: BLUE,
    fontWeight: '300',
  },

  // Coach bubble
  coachBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '92%',
  },
  coachText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#1A1A1F',
  },

  // User bubble
  userBubble: {
    backgroundColor: BLUE,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#FFFFFF',
  },

  // Typing dots
  typingRow: { flexDirection: 'row', gap: 4, paddingVertical: 2 },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BLUE,
  },

  // ── Inline cards ──
  cardInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    borderRadius: 14,
    padding: 12,
  },
  productSwatch: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  productBrand: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 9,
    color: '#8E8E93',
  },
  productName: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#1A1A1F',
    fontWeight: '500',
    marginTop: 2,
  },
  productReason: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 9,
    color: '#8E8E93',
    marginTop: 2,
  },
  productMatch: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 10,
    color: BLUE,
    fontWeight: '300',
  },

  // Routine change card
  routineCardTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    color: '#1A1A1F',
    fontWeight: '600',
  },
  routineStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routineDotNew: {
    width: 6,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  routineStepText: {
    flex: 1,
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#1A1A1F',
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: 'rgba(45,58,107,0.08)',
  },
  newBadgeText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 8,
    color: BLUE,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  routineCtaPrimary: {
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  routineCtaPrimaryText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  routineCtaSecondary: {
    backgroundColor: 'rgba(45,58,107,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  routineCtaSecondaryText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Action button
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(45,58,107,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  actionBtnText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: BLUE,
    fontWeight: '500',
    flex: 1,
  },

  // D-day card
  ddayCard: {
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  ddayLabel: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 11,
    color: BLUE,
    fontWeight: '300',
  },
  ddayTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#1A1A1F',
    fontWeight: '600',
    marginTop: 2,
  },
  ddayDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
  },

  // Preset chips
  presetScroll: {
    height: 42,
    flexGrow: 0,
  },
  presetRow: {
    paddingHorizontal: 14,
    gap: 6,
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(45,58,107,0.15)',
    backgroundColor: '#FFFFFF',
  },
  presetChipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    color: BLUE,
    fontWeight: '500',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FBF5F6',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#ECECEF',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#1A1A1F',
    minHeight: 40,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
