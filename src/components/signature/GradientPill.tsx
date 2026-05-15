/**
 * <GradientPill /> — meve 시그니처 CTA pill 버튼.
 *
 * signatureGradient 배경 + ShimmerSweep + ctaGlow shadow.
 * 메인 액션 ("시작 →", "이대로 따라하기 →" 등).
 *
 * Sizes:
 *   - sm : height 42
 *   - md : height 52 (기본)
 *   - lg : height 58
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radius, motion } from '../../theme';
import { ShimmerSweep } from './ShimmerSweep';

type IconName = 'arrow-right' | 'external-link' | 'arrow-down' | null;

interface GradientPillProps {
  label: string;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  iconRight?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
}

const SIZE_SPECS = {
  sm: { height: 44, paddingH: 14, paddingV: 10, fontSize: 13 },
  md: { height: 52, paddingH: 18, paddingV: 12, fontSize: 15 },
  lg: { height: 56, paddingH: 20, paddingV: 12, fontSize: 16 },
} as const;

const ICON_MAP: Record<NonNullable<IconName>, keyof typeof Ionicons.glyphMap> = {
  'arrow-right': 'arrow-forward',
  'external-link': 'open-outline',
  'arrow-down': 'arrow-down',
};

export const GradientPill: React.FC<GradientPillProps> = ({
  label,
  onPress,
  size = 'md',
  fullWidth = false,
  iconRight = 'arrow-right',
  disabled = false,
  style,
}) => {
  const spec = SIZE_SPECS[size];
  const iconName = iconRight ? ICON_MAP[iconRight] : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outer,
        {
          height: spec.height,
          opacity: disabled ? 0.5 : pressed ? 0.94 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        // CTA glow shadow — only when not disabled
        !disabled ? colors.ctaGlowShadow : null,
        style,
      ]}
    >
      <View style={[styles.pill, { height: spec.height }]}>
        <LinearGradient
          colors={colors.signatureGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Shimmer band */}
        <ShimmerSweep
          duration={motion.duration.shimmerSweepCta}
          widthRatio={0.35}
        />
        {/* Label + icon */}
        <View
          style={[
            styles.content,
            {
              paddingHorizontal: spec.paddingH,
              paddingVertical: spec.paddingV,
            },
          ]}
        >
          <Text
            style={[
              typography.ctaPill,
              {
                color: colors.mysticNavy,
                fontSize: spec.fontSize,
                lineHeight: spec.fontSize * 1.4,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconName ? (
            <Ionicons
              name={iconName}
              size={spec.fontSize + 3}
              color={colors.mysticNavy}
              style={styles.icon}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.ctaPill,
  },
  pill: {
    borderRadius: radius.ctaPill,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginLeft: 8,
  },
});

export default GradientPill;
