/**
 * <SignatureWashBg /> — 시그니처 화면 (스플래시, 온보딩, 분석 로딩, DNA 결과) 전체 배경.
 *
 * Liquid Light wash (signatureGradient 135°) + 시머 점 5-6개.
 * 일상 화면은 이거 쓰지 말고 `colors.blushSnow` solid 배경.
 *
 * children은 SafeArea 등 화면 콘텐츠.
 */

import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';
import { ShimmerDot } from './ShimmerDot';

interface SignatureWashBgProps {
  children: ReactNode;
  /** 'normal' = 풀 그라데이션, 'soft' = blushSnow 위 옅은 그라데이션 (온보딩) */
  variant?: 'normal' | 'soft';
  style?: ViewStyle;
}

export const SignatureWashBg: React.FC<SignatureWashBgProps> = ({
  children,
  variant = 'normal',
  style,
}) => {
  const gradientColors =
    variant === 'soft'
      ? ([colors.blushSnow, '#F5E8F0', '#EDE5F5'] as const)
      : colors.signatureGradient;

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* 시머 점 5개 — 위치/딜레이 다양 */}
      <ShimmerDot top="12%" left="18%" size={3} delay={0} />
      <ShimmerDot top="22%" right="22%" size={2} delay={1200} />
      <ShimmerDot top="48%" left="8%" size={4} delay={2500} />
      <ShimmerDot top="62%" right="14%" size={2} delay={800} />
      <ShimmerDot bottom="22%" left="36%" size={3} delay={1800} />
      <ShimmerDot bottom="12%" right="28%" size={2} delay={3200} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.blushSnow,
  },
});

export default SignatureWashBg;
