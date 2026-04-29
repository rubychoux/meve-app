import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { PrimaryButton, GhostButton } from '../../components/ui';
import { setLocalPremium } from '../../services/premium';

type PlanKey = 'monthly' | 'yearly';

const PRICE_MONTHLY = 9900;
const YEARLY_DISCOUNT = 0.2;

function formatWon(n: number) {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function PaywallScreen() {
  const [selected, setSelected] = useState<PlanKey>('yearly');

  const yearlyPrice = useMemo(() => Math.round(PRICE_MONTHLY * 12 * (1 - YEARLY_DISCOUNT)), []);

  const startPurchase = async () => {
    Alert.alert(
      '결제 연동 필요',
      'RevenueCat(권장) 또는 네이티브 인앱결제 연결 후 실제 구매가 가능해요.\n\n지금은 데모로 프리미엄을 활성화할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '데모 활성화',
          onPress: async () => {
            await setLocalPremium(true);
            Alert.alert('Premium 활성화', '데모 프리미엄이 켜졌어요. (로컬 저장)');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="sparkles-outline" size={16} color={Colors.accent} />
            <Text style={styles.badgeText}>Premium</Text>
          </View>
          <Text style={styles.title}>잠금 해제하고{"\n"}나에게 딱 맞는 피부 관리</Text>
          <Text style={styles.subtitle}>스캔·성분·코치·인사이트까지 한 번에</Text>
        </View>

        <View style={styles.benefits}>
          <Benefit text="AI 피부 스캔 무제한" />
          <Benefit text="전체 성분 분석 + 추천" />
          <Benefit text="AI 코치 채팅" />
          <Benefit text="Progress 인사이트" />
          <Benefit text="커뮤니티 글/댓글 작성" />
          <Benefit text="모든 룩/콘텐츠 열람" />
        </View>

        <View style={styles.planWrap}>
          <Text style={styles.planTitle}>플랜 선택</Text>

          <TouchableOpacity
            style={[styles.planCard, selected === 'monthly' && styles.planCardActive]}
            onPress={() => setSelected('monthly')}
            activeOpacity={0.85}
          >
            <View style={styles.planLeft}>
              <Text style={styles.planName}>월간</Text>
              <Text style={styles.planDesc}>언제든 취소 가능</Text>
            </View>
            <Text style={styles.planPrice}>{formatWon(PRICE_MONTHLY)}/월</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, selected === 'yearly' && styles.planCardActive]}
            onPress={() => setSelected('yearly')}
            activeOpacity={0.85}
          >
            <View style={styles.planLeft}>
              <View style={styles.row}>
                <Text style={styles.planName}>연간</Text>
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>20% 할인</Text>
                </View>
              </View>
              <Text style={styles.planDesc}>1년치 결제로 더 저렴하게</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.planPrice}>{formatWon(yearlyPrice)}/년</Text>
              <Text style={styles.planSub}>{formatWon(Math.round(yearlyPrice / 12))}/월</Text>
            </View>
          </TouchableOpacity>
        </View>

        <PrimaryButton label="구독 시작하기" onPress={startPurchase} />
        <GhostButton
          label="복원하기 (Restore Purchases)"
          onPress={() => Alert.alert('TODO', 'RevenueCat/StoreKit/Play Billing 연동 후 구현할게요.')}
          style={{ marginTop: Spacing.sm }}
        />

        <Text style={styles.legal}>
          구독은 자동 갱신되며, 결제는 App Store/Google Play 계정으로 처리돼요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  header: { gap: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { ...Typography.caption, color: Colors.accent, fontWeight: '700' },
  title: { ...Typography.h2, lineHeight: 34 },
  subtitle: { ...Typography.bodySecondary, lineHeight: 20 },
  benefits: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 10,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { ...Typography.body, flex: 1 },
  planWrap: { gap: Spacing.sm },
  planTitle: { ...Typography.h3 },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardActive: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  planLeft: { gap: 2, flex: 1 },
  planName: { ...Typography.body, fontWeight: '800' },
  planDesc: { ...Typography.caption, color: Colors.textSecondary },
  planPrice: { ...Typography.body, fontWeight: '800' },
  planSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountPill: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  discountText: { fontSize: 11, color: Colors.bg, fontWeight: '800' },
  legal: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginTop: 4 },
});

