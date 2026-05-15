// MEVE-251 — AI trouble cause analysis. Pulls last-7-day data from
// trouble_logs + daily_logs + skin_scans, asks GPT for a structured cause /
// recommendation report, and renders it. Falls back to an "insufficient data"
// state when the user hasn't logged enough yet.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { fetchOpenAIWithTimeout, cleanJson } from '../../utils/openai';
import { useBeautyProfile } from '../../stores/beautyProfileStore';
import { MainStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'TroubleAnalysis'>;

type CauseLevel = 'high' | 'medium' | 'low';

interface AnalysisCause {
  level: CauseLevel;
  title: string;
  reason: string;
  evidence: string;
}

interface AnalysisResult {
  summary: string;
  causes: AnalysisCause[];
  recommendations: string[];
  dataRange: string;
  insufficientData: boolean;
}

interface RawData {
  troubleLogs: any[];
  dailyLogs: any[];
  skinScans: any[];
}

export function TroubleAnalysisScreen() {
  const navigation = useNavigation<Nav>();
  const profile = useBeautyProfile();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLast7DaysData = async (userId: string): Promise<RawData> => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateOnly = sevenDaysAgo.toISOString().split('T')[0];
    const isoSince = sevenDaysAgo.toISOString();

    const [troubleRes, dailyRes, scanRes] = await Promise.all([
      supabase
        .from('trouble_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', dateOnly)
        .order('date', { ascending: true }),
      supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', dateOnly)
        .order('date', { ascending: true }),
      supabase
        .from('skin_scans')
        .select('scan_result, created_at')
        .eq('user_id', userId)
        .gte('created_at', isoSince)
        .order('created_at', { ascending: true }),
    ]);

    return {
      troubleLogs: troubleRes.data ?? [],
      dailyLogs: dailyRes.data ?? [],
      skinScans: scanRes.data ?? [],
    };
  };

  const analyze = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');

      const data = await fetchLast7DaysData(user.id);
      setRawData(data);

      const hasAnyData =
        data.troubleLogs.length > 0 ||
        data.dailyLogs.length > 0 ||
        data.skinScans.length > 0;

      if (!hasAnyData) {
        setResult({
          summary: '아직 분석할 데이터가 부족해요',
          causes: [],
          recommendations: [
            '매일 트러블 체크인을 기록해주세요',
            '라이프스타일 로그를 꾸준히 남겨주세요',
            '7일치 데이터가 쌓이면 정확한 분석이 가능해요',
          ],
          dataRange: '최근 7일',
          insufficientData: true,
        });
        return;
      }

      const troubleSummary = data.troubleLogs.map((log) => ({
        date: log.date,
        status: log.skin_status,
        symptoms: log.symptoms,
        onset: log.onset,
        triggers: log.triggers,
        freeText: log.free_text,
        parsedTags: log.parsed_tags,
        parsedData: log.parsed_data,
      }));

      const lifestyleSummary = data.dailyLogs.map((log) => ({
        date: log.date,
        sleep: log.sleep_hours,
        water: log.water_intake,
        stress: log.stress_level,
        diet: log.diet_tags,
      }));

      const scanSummary = data.skinScans.map((scan) => ({
        date: scan.created_at?.split('T')[0],
        score: scan.scan_result?.overallScore,
        skinType: scan.scan_result?.skinType,
      }));

      const prompt = `당신은 피부과 전문의 수준의 피부 분석 AI예요.
아래 유저의 최근 7일 데이터를 분석해서 피부 트러블 원인을 찾아주세요.

## 유저 기본 정보
- 피부 타입: ${profile.skinType ?? '미설정'}
- 주요 피부 고민: ${profile.skinConcerns?.join(', ') ?? '없음'}
- 스킨 스코어 (최근): ${profile.lastSkinScore ?? '미측정'}점

## 트러블 기록 (최근 7일)
${JSON.stringify(troubleSummary, null, 2)}

## 라이프스타일 기록
${JSON.stringify(lifestyleSummary, null, 2)}

## 피부 스캔 기록
${JSON.stringify(scanSummary, null, 2)}

## 분석 지시사항
1. 데이터에서 실제 상관관계를 찾아내세요 (시간 순서, 빈도, 패턴)
2. 근거가 없는 추측은 하지 마세요
3. 데이터가 부족한 항목은 "데이터 부족"으로 표시하세요
4. 한국어 해요체로 작성하세요
5. 유저 이름은 언급하지 마세요

반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 없이:

{
  "summary": "전체 분석 한 줄 요약 (30자 이내)",
  "causes": [
    {
      "level": "high",
      "title": "원인 제목 (15자 이내)",
      "reason": "왜 이게 원인인지 (50자 이내)",
      "evidence": "데이터 근거 (예: 세럼 사용 D+3에 트러블 시작)"
    }
  ],
  "recommendations": [
    "구체적인 행동 추천 1",
    "구체적인 행동 추천 2",
    "구체적인 행동 추천 3"
  ],
  "dataRange": "최근 7일"
}

causes는 가능성 높음(high) → 가능성 있음(medium) → 무관할 가능성(low) 순으로 정렬.
high는 최대 3개, medium 최대 3개, low 최대 2개.
근거가 있는 것만 포함하세요.`;

      const res = await fetchOpenAIWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        30_000
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? `OpenAI ${res.status}`);
      const content: string = json.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(cleanJson(content));
      setResult({ ...parsed, insufficientData: false });
    } catch (e: any) {
      setError(e?.message ?? '분석에 실패했어요');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLevelConfig = (level: CauseLevel) => {
    switch (level) {
      case 'high':
        return { color: '#FF4444', bg: '#FFF0F0', icon: '🔴', label: '가능성 높음' };
      case 'medium':
        return { color: '#F0A500', bg: '#FFFBF0', icon: '🟡', label: '가능성 있음' };
      case 'low':
        return { color: '#7CB798', bg: '#F0FFF4', icon: '🟢', label: '무관할 가능성' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5BA3D9" />
        <Text style={styles.loadingTitle}>AI가 분석 중이에요</Text>
        <Text style={styles.loadingDesc}>
          최근 7일 데이터를 종합해서{'\n'}원인을 찾고 있어요 💙
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorEmoji}>😅</Text>
        <Text style={styles.loadingTitle}>분석에 실패했어요</Text>
        <Text style={styles.loadingDesc}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={analyze} activeOpacity={0.85}>
          <Text style={styles.retryBtnText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>피부 트러블 원인 분석</Text>
        <TouchableOpacity onPress={analyze} hitSlop={8}>
          <Text style={styles.refreshBtn}>새로고침</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>📊</Text>
          <Text style={styles.summaryTitle}>{result?.dataRange} 데이터 기반</Text>
          <Text style={styles.summaryText}>{result?.summary}</Text>
        </View>

        {result?.insufficientData ? (
          <View style={styles.insufficientCard}>
            <Text style={styles.insufficientTitle}>데이터를 더 모아볼게요</Text>
            {result.recommendations.map((rec, i) => (
              <Text key={i} style={styles.insufficientItem}>
                • {rec}
              </Text>
            ))}
            <TouchableOpacity
              style={styles.checkinBtn}
              onPress={() => navigation.navigate('TroubleCheckin')}
              activeOpacity={0.85}
            >
              <Text style={styles.checkinBtnText}>트러블 기록하러 가기 →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {result?.causes && result.causes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>원인 분석</Text>
                {result.causes.map((cause, i) => {
                  const config = getLevelConfig(cause.level);
                  return (
                    <View
                      key={i}
                      style={[styles.causeCard, { backgroundColor: config.bg }]}
                    >
                      <View style={styles.causeHeader}>
                        <Text style={styles.causeIcon}>{config.icon}</Text>
                        <View style={styles.causeMeta}>
                          <Text style={[styles.causeLevel, { color: config.color }]}>
                            {config.label}
                          </Text>
                          <Text style={styles.causeTitle}>{cause.title}</Text>
                        </View>
                      </View>
                      <Text style={styles.causeReason}>{cause.reason}</Text>
                      <View style={styles.evidencePill}>
                        <Text style={styles.evidenceText}>📌 {cause.evidence}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {result?.recommendations && result.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 AI 추천</Text>
                <View style={styles.recoCard}>
                  {result.recommendations.map((rec, i) => (
                    <View key={i} style={styles.recoItem}>
                      <Text style={styles.recoNumber}>{i + 1}</Text>
                      <Text style={styles.recoText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.coachCta}
              onPress={() =>
                navigation.navigate('MainTabs', { screen: 'Meve' } as any)
              }
              activeOpacity={0.85}
            >
              <Text style={styles.coachCtaText}>
                💙 AI 코치에게 더 자세히 물어보기 →
              </Text>
            </TouchableOpacity>

            {rawData && (
              <View style={styles.dataInfo}>
                <Text style={styles.dataInfoTitle}>분석에 사용된 데이터</Text>
                <Text style={styles.dataInfoItem}>
                  • 트러블 기록 {rawData.troubleLogs.length}개
                </Text>
                <Text style={styles.dataInfoItem}>
                  • 라이프스타일 기록 {rawData.dailyLogs.length}개
                </Text>
                <Text style={styles.dataInfoItem}>
                  • 피부 스캔 {rawData.skinScans.length}회
                </Text>
                <Text style={styles.dataInfoHint}>기록이 쌓일수록 더 정확해져요</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF5F6' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF5F6',
    padding: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1F',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingDesc: {
    fontSize: 14,
    color: '#8A8A9A',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorEmoji: { fontSize: 48 },
  retryBtn: {
    marginTop: 24,
    backgroundColor: '#2D3A6B',
    borderRadius: 50,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: { fontSize: 22, color: '#1A1A1F', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1F' },
  refreshBtn: { fontSize: 14, color: '#2D3A6B', fontWeight: '600' },
  content: { flex: 1 },
  summaryCard: {
    backgroundColor: '#2D3A6B',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  summaryIcon: { fontSize: 32, marginBottom: 8 },
  summaryTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1F',
    marginBottom: 12,
  },
  causeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  causeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  causeIcon: { fontSize: 20 },
  causeMeta: { flex: 1 },
  causeLevel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  causeTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1F' },
  causeReason: {
    fontSize: 14,
    color: '#5A5A7A',
    lineHeight: 20,
    marginBottom: 10,
  },
  evidencePill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 8,
  },
  evidenceText: { fontSize: 12, color: '#5A5A7A' },
  recoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  recoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  recoNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3A6B',
    width: 20,
    textAlign: 'center',
  },
  recoText: { flex: 1, fontSize: 14, color: '#1A1A1F', lineHeight: 20 },
  coachCta: {
    backgroundColor: '#E8F4FD',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  coachCtaText: { fontSize: 14, fontWeight: '600', color: '#2D3A6B' },
  dataInfo: {
    backgroundColor: '#F5F5FA',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  dataInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A8A9A',
    marginBottom: 8,
  },
  dataInfoItem: { fontSize: 13, color: '#8A8A9A', marginBottom: 4 },
  dataInfoHint: {
    fontSize: 12,
    color: '#C0C0CC',
    marginTop: 8,
    fontStyle: 'italic',
  },
  insufficientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#B0B0B0',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  insufficientTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1F',
    marginBottom: 12,
  },
  insufficientItem: {
    fontSize: 14,
    color: '#5A5A7A',
    marginBottom: 8,
    lineHeight: 20,
  },
  checkinBtn: {
    marginTop: 16,
    backgroundColor: '#2D3A6B',
    borderRadius: 50,
    padding: 14,
    alignItems: 'center',
  },
  checkinBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
