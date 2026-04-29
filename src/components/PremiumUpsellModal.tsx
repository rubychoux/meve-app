import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

export function PremiumUpsellModal({
  visible,
  title = '프리미엄으로 업그레이드',
  subtitle = '잠금 해제하고 모든 기능을 이용해 보세요.',
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.accent} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.benefits}>
            <Benefit text="무제한 AI 피부 스캔" />
            <Benefit text="전체 성분 분석 + 맞춤 추천" />
            <Benefit text="AI 코치 채팅 + Progress 인사이트" />
            <Benefit text="커뮤니티 글/댓글 작성" />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.secondaryText}>나중에</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={onUpgrade} activeOpacity={0.85}>
              <Text style={styles.primaryText}>프리미엄으로 업그레이드</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { ...Typography.h3, flex: 1 },
  subtitle: { ...Typography.bodySecondary, lineHeight: 20, marginBottom: Spacing.md },
  benefits: { gap: 10, marginBottom: Spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { ...Typography.body, flex: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...Typography.cta, color: Colors.textPrimary },
  primaryBtn: {
    flex: 1.4,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...Typography.cta, color: Colors.bg },
});

