/**
 * <GlassCard /> — Glass Morphism 카드.
 *
 * 시그니처 화면 (DNA 결과, 스플래시) 전용. 일상 화면은 솔리드 흰 카드.
 *
 * iOS BlurView 잘 작동, Android는 약함 — backgroundColor opacity 살짝 더 올림.
 */

import React, { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, spacing } from '../../theme';

interface GlassCardProps {
  children: ReactNode;
  /** Blur 강도. 기본 20 */
  intensity?: number;
  /** 'light' | 'dark' | 'default' */
  tint?: 'light' | 'dark' | 'default';
  style?: ViewStyle;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 20,
  tint = 'light',
  style,
}) => {
  // Android의 BlurView는 약함 → bg opacity 올려서 보강
  const androidBoost = Platform.OS === 'android';

  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[
        styles.card,
        {
          backgroundColor: androidBoost
            ? 'rgba(255,255,255,0.78)'
            : colors.glassWhite,
        },
        style,
      ]}
    >
      {/* hairline glass border (BlurView 내부에서 추가) */}
      <View pointerEvents="none" style={styles.borderOverlay} />
      {children}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.cardLg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.cardLg,
    borderWidth: 0.5,
    borderColor: colors.glassWhiteBorder,
  },
});

export default GlassCard;
