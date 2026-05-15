import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, ScanAnalysisResult, SkinZone } from '../../types';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../services/supabase';

interface PreviousScan extends ScanAnalysisResult {
  date?: string;
}

type Nav = NativeStackNavigationProp<MainStackParamList, 'ScanResult'>;
type Route = RouteProp<MainStackParamList, 'ScanResult'>;

const ZONE_LABELS: Record<string, string> = {
  forehead: '이마',
  leftCheek: '왼쪽 볼',
  rightCheek: '오른쪽 볼',
  nose: '코',
  chin: '턱',
};

function scoreColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
}

// Normalizes zone data across old (number 1-5) and new (SkinZone) schemas.
function zoneScore(z: SkinZone | number | undefined): number {
  if (z == null) return 0;
  if (typeof z === 'number') return Math.max(0, 100 - (z - 1) * 20);
  return z.score;
}
function zoneStatus(z: SkinZone | number | undefined): string {
  if (z == null || typeof z === 'number') return '';
  return z.status;
}

function scoreLabel(score: number): string {
  if (score >= 80) return '양호';
  if (score >= 60) return '보통';
  return '주의 필요';
}

function formatScanDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function ScanResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { result, isSaved: initialSaved = false } = route.params;

  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [previousScan, setPreviousScan] = useState<PreviousScan | null>(null);

  // Rotate scans: load previous, then promote the existing "last" → "previous"
  // and save current as "last". Skip rotation when isSaved (re-opening from history).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const previousRaw = await AsyncStorage.getItem('meve_previous_scan_result');
        if (previousRaw && !cancelled) {
          try {
            setPreviousScan(JSON.parse(previousRaw) as PreviousScan);
          } catch {}
        }

        if (initialSaved) return;

        const lastRaw = await AsyncStorage.getItem('meve_last_scan_result');
        if (lastRaw) {
          await AsyncStorage.setItem('meve_previous_scan_result', lastRaw);
        }
        await AsyncStorage.setItem(
          'meve_last_scan_result',
          JSON.stringify({ ...result, date: new Date().toISOString() })
        );
      } catch (e) {
        console.warn('[ScanResult] rotate error:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentScore = result.overallScore;
  const previousScore = previousScan?.overallScore;
  const trendUp = previousScore != null && currentScore > previousScore;
  const trendColor = trendUp ? '#7CB798' : '#FF6B6B';

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요');
      const { error } = await supabase.from('skin_scans').insert({
        user_id: user.id,
        scan_result: result,
      });
      if (error) throw error;
      setSaved(true);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const score = result.overallScore ?? 0;
    const skinType = result.skinType ?? '피부';
    try {
      await Share.share({
        message: `meve AI 피부 스캔 결과 ✨\n\n스킨 스코어: ${score}점\n피부 타입: ${skinType}\n\n나도 meve로 내 피부를 분석해봤어요!\n앱 다운로드 → https://meve.app`,
        title: 'meve 피부 스캔 결과 공유',
      });
    } catch {}
  };

  const handleMakeRoutine = async () => {
    try {
      await AsyncStorage.multiSet([
        ['meve_last_scan_result', JSON.stringify(result)],
      ]);
      await AsyncStorage.removeItem('meve_routine');
      navigation.navigate('MainTabs', { screen: 'Scan' } as any);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '다시 시도해 주세요.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <Text style={styles.pageTitle}>피부 분석 결과</Text>

        {/* 지난 스캔과 비교 */}
        {previousScan && previousScore != null && (
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonTitle}>지난 스캔과 비교 📊</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>지난번</Text>
                <Text style={styles.comparisonScore}>{previousScore}점</Text>
                <Text style={styles.comparisonDate}>
                  {formatScanDate(previousScan.date) || '이전'}
                </Text>
              </View>
              <View style={styles.comparisonArrow}>
                <Ionicons
                  name={trendUp ? 'trending-up' : 'trending-down'}
                  size={24}
                  color={trendColor}
                />
                <Text style={[styles.comparisonDiff, { color: trendColor }]}>
                  {currentScore > previousScore ? '+' : ''}
                  {currentScore - previousScore}점
                </Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>이번</Text>
                <Text style={[styles.comparisonScore, { color: '#2D3A6B' }]}>
                  {currentScore}점
                </Text>
                <Text style={styles.comparisonDate}>오늘</Text>
              </View>
            </View>
          </View>
        )}

        {/* 종합 점수 카드 */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreBadge, { borderColor: scoreColor(result.overallScore) }]}>
            <Text style={[styles.scoreNumber, { color: scoreColor(result.overallScore) }]}>
              {result.overallScore}
            </Text>
            <Text style={styles.scoreUnit}>점</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={[styles.scoreStatus, { color: scoreColor(result.overallScore) }]}>
              {scoreLabel(result.overallScore)}
            </Text>
            <Text style={styles.skinCondition}>
              {result.skinType ?? result.skinCondition ?? ''}
            </Text>
            {result.hydrationLevel && (
              <Text style={styles.acneType}>수분 · {result.hydrationLevel}</Text>
            )}
          </View>
        </View>

        {/* AI 요약 */}
        {result.summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{result.summary}</Text>
          </View>
        )}

        {/* 부위별 상태 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>부위별 상태</Text>
          <View style={styles.zonesGrid}>
            {Object.entries(result.zones).map(([key, z]) => {
              const label = ZONE_LABELS[key];
              const score = zoneScore(z as SkinZone | number | undefined);
              const status = zoneStatus(z as SkinZone | number | undefined);
              const color = scoreColor(score);
              return (
                <View key={key} style={styles.zoneItem}>
                  <View style={[styles.zoneDot, { backgroundColor: color }]} />
                  <Text style={styles.zoneLabel}>{label}</Text>
                  {status ? (
                    <Text style={[styles.zoneLevel, { color }]} numberOfLines={1}>
                      {status}
                    </Text>
                  ) : (
                    <Text style={[styles.zoneLevel, { color }]}>{score}점</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* 강점 */}
        {result.strengths && result.strengths.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>피부 강점</Text>
            <View style={[styles.listCard, styles.strengthsCard]}>
              {result.strengths.map((s, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={[styles.bullet, { backgroundColor: Colors.success }]} />
                  <Text style={styles.listText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 주요 고민 */}
        {((result.concerns && result.concerns.length > 0) ||
          (result.keyFindings && result.keyFindings.length > 0)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>주요 고민</Text>
            <View style={styles.listCard}>
              {(result.concerns ?? result.keyFindings ?? []).map((c, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.listText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 추천 성분 */}
        {result.ingredients?.recommended && result.ingredients.recommended.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>추천 성분</Text>
            <View style={styles.listCard}>
              {result.ingredients.recommended.map((name, i) => (
                <View key={i} style={styles.recItem}>
                  <View style={styles.listRow}>
                    <Text style={styles.recIndex}>{i + 1}</Text>
                    <Text style={styles.listText}>{name}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodeURIComponent(name)}`
                      )
                    }
                    style={styles.oliveyoungBtn}
                  >
                    <Text style={styles.oliveyoungText}>올리브영에서 보기 →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 피해야 할 성분 */}
        {result.ingredients?.avoid && result.ingredients.avoid.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>피해야 할 성분</Text>
            <View style={[styles.listCard, styles.rednessCard]}>
              {result.ingredients.avoid.map((name, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={[styles.bullet, { backgroundColor: Colors.danger }]} />
                  <Text style={styles.listText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 루틴 가이드 */}
        {result.routineAdvice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>루틴 가이드</Text>
            <View style={styles.routineCard}>
              <View style={styles.routineHeader}>
                <Ionicons name="sunny-outline" size={16} color={Colors.accent} />
                <Text style={styles.routineLabel}>AM</Text>
              </View>
              <Text style={styles.routineText}>{result.routineAdvice.morning}</Text>
            </View>
            <View style={styles.routineCard}>
              <View style={styles.routineHeader}>
                <Ionicons name="moon-outline" size={16} color="#5BA3D9" />
                <Text style={[styles.routineLabel, { color: '#2D3A6B' }]}>PM</Text>
              </View>
              <Text style={styles.routineText}>{result.routineAdvice.evening}</Text>
            </View>
          </View>
        )}

        {/* 홍조 / 자극 (legacy) */}
        {result.redness?.detected && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>홍조 / 자극</Text>
            <View style={[styles.listCard, styles.rednessCard]}>
              <View style={styles.listRow}>
                <View style={[styles.bullet, { backgroundColor: Colors.danger }]} />
                <Text style={styles.listText}>{result.redness.description}</Text>
              </View>
              <View style={styles.rednessZones}>
                {result.redness.zones.map((zone) => (
                  <View key={zone} style={styles.rednessZoneBadge}>
                    <Text style={styles.rednessZoneText}>{zone}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* 하단 버튼 */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.saveBtn, (saved || saving) && styles.saveBtnDone]}
            onPress={handleSave}
            disabled={saved || saving}
          >
            <Text style={styles.saveBtnText}>
              {saved ? '저장됐어요 ✓' : saving ? '저장 중...' : '결과 저장하기'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={16} color="#5BA3D9" />
            <Text style={styles.shareBtnText}>공유하기</Text>
          </TouchableOpacity>
        </View>

        {/* 이 결과로 루틴 만들기 */}
        <TouchableOpacity
          onPress={handleMakeRoutine}
          activeOpacity={0.85}
          style={styles.routineBtn}
        >
          <Ionicons name="sparkles-outline" size={20} color="#fff" />
          <Text style={styles.routineBtnText}>이 결과로 루틴 만들기 →</Text>
        </TouchableOpacity>

        <View style={[styles.buttons, styles.buttonsBottom]}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryBtnText}>다시 스캔하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.retryBtnText}>홈으로</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.lg,
  },

  pageTitle: { ...Typography.h2, textAlign: 'center' },

  // 점수 카드
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'center',
  },
  scoreNumber: { fontSize: 32, fontWeight: '700' },
  scoreUnit: {
    ...Typography.caption,
    color: Colors.textSecondary,
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  scoreInfo: { flex: 1, gap: 4 },
  scoreStatus: { fontSize: 16, fontWeight: '700' },
  skinCondition: { ...Typography.body, color: Colors.textPrimary },
  acneType: { ...Typography.caption, color: Colors.textSecondary },

  // 섹션
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h3 },

  // 부위별
  zonesGrid: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoneItem: {
    width: '28%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  zoneDot: { width: 36, height: 36, borderRadius: 18 },
  zoneLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  zoneLevel: { fontSize: 12, fontWeight: '600' },

  // 리스트 카드
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 6,
  },
  listText: { ...Typography.body, flex: 1, lineHeight: 22 },
  recItem: {
    gap: 4,
  },
  recIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
    lineHeight: 20,
  },

  oliveyoungBtn: {
    alignSelf: 'flex-start',
    paddingLeft: 28, // align under text (past the index badge)
  },
  oliveyoungText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500',
  },

  // AI 요약 카드
  summaryCard: {
    backgroundColor: '#FFF5F9',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FFC4D6',
  },
  summaryText: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textPrimary,
  },

  // 강점 카드
  strengthsCard: {
    borderColor: '#C8E6C9',
    backgroundColor: '#F1FBF3',
  },

  // 루틴 가이드 카드
  routineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routineLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  routineText: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 21,
  },

  // 홍조 카드
  rednessCard: {
    borderColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
  },
  rednessZones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  rednessZoneBadge: {
    backgroundColor: '#FFCDD2',
    borderRadius: Radius.full,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  rednessZoneText: { fontSize: 11, fontWeight: '600', color: Colors.danger },

  // 버튼
  buttons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  buttonsBottom: { marginBottom: 80 },
  retryBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { ...Typography.cta, color: Colors.accent },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDone: {
    backgroundColor: Colors.success,
  },
  saveBtnText: { ...Typography.cta, color: Colors.surface },
  shareBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#2D3A6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#2D3A6B' },
  routineBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 18,
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  routineBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // 지난 스캔 비교
  comparisonCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F0E6EC',
    gap: Spacing.sm,
  },
  comparisonTitle: { fontSize: 13, fontWeight: '700', color: '#2D2D2D' },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonItem: { alignItems: 'center', flex: 1, gap: 2 },
  comparisonLabel: { fontSize: 11, color: '#9A8F97', fontWeight: '600' },
  comparisonScore: { fontSize: 22, fontWeight: '800', color: '#2D2D2D' },
  comparisonDate: { fontSize: 11, color: '#9A8F97' },
  comparisonArrow: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  comparisonDiff: { fontSize: 13, fontWeight: '700' },
});
