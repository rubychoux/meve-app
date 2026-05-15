/**
 * <DNACard /> — meve 시그니처 컴포넌트.
 *
 * 타입별 그라데이션 + Glow Pulse + Shimmer Sweep + 시머 점 4-5개.
 * 홈 미니, 프로필 헤더, DNA 결과 화면 모두에서 같은 컴포넌트로 size만 변경.
 *
 * 3 사이즈:
 *   - mini       : 80h row (홈)
 *   - compressed : 120h row (프로필 헤더)
 *   - full       : aspect 3/4 column (DNA 결과)
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  typography,
  radius,
  spacing,
  motion,
  BeautyTypeCode,
} from '../../theme';
import { ShimmerSweep } from './ShimmerSweep';
import { ShimmerDot } from './ShimmerDot';
import { GlowPulse } from './GlowPulse';

export type DNACardSize = 'mini' | 'compressed' | 'full';

interface DNACardProps {
  typeCode: BeautyTypeCode;
  size: DNACardSize;
  typeName: string;        // "Icy Glow"
  typeKr: string;          // "아이시 글로우"
  showShareButton?: boolean;
  showDate?: string;       // "since 5.8"
  onPress?: () => void;
  onShare?: () => void;
  style?: ViewStyle;
}

// Layout specs per size
const SIZE_SPECS: Record<
  DNACardSize,
  {
    height?: number;
    aspectRatio?: number;
    borderRadius: number;
    paddingH: number;
    paddingV: number;
    titleStyle: TextStyle;
    layout: 'row' | 'column';
  }
> = {
  mini: {
    height: 80,
    borderRadius: 20,
    paddingH: spacing.lg,
    paddingV: spacing.md,
    titleStyle: typography.displayMid,
    layout: 'row',
  },
  compressed: {
    height: 120,
    borderRadius: 24,
    paddingH: spacing.lg,
    paddingV: spacing.lg,
    titleStyle: typography.displayMid,
    layout: 'row',
  },
  full: {
    aspectRatio: 3 / 4,
    borderRadius: radius.cardHero,
    paddingH: spacing.xxl,
    paddingV: spacing.xxl,
    titleStyle: typography.displayHero,
    layout: 'column',
  },
};

export const DNACard: React.FC<DNACardProps> = ({
  typeCode,
  size,
  typeName,
  typeKr,
  showShareButton = false,
  showDate,
  onPress,
  onShare,
  style,
}) => {
  const spec = SIZE_SPECS[size];
  const typeColor = colors.types[typeCode].text;
  const gradient = colors.types[typeCode].gradient;

  const Body = (
    <View
      style={[
        styles.card,
        {
          height: spec.height,
          aspectRatio: spec.aspectRatio,
          borderRadius: spec.borderRadius,
        },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 시머 점 4-5개 (사이즈별로 다양) */}
      <ShimmerDot top="18%" left="22%" size={2.5} delay={motion.shimmerDotDelays[0]} />
      <ShimmerDot top="32%" right="18%" size={2} delay={motion.shimmerDotDelays[1]} />
      <ShimmerDot top="56%" left="14%" size={3} delay={motion.shimmerDotDelays[2]} />
      <ShimmerDot top="72%" right="28%" size={2} delay={motion.shimmerDotDelays[3]} />
      {size === 'full' && (
        <ShimmerDot bottom="20%" left="44%" size={2.5} delay={1500} />
      )}

      {/* Shimmer sweep — 좌 → 우 */}
      <ShimmerSweep duration={motion.duration.shimmerSweep} />

      {/* Content */}
      {spec.layout === 'row' ? (
        <View
          style={[
            styles.rowContent,
            { paddingHorizontal: spec.paddingH, paddingVertical: spec.paddingV },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.dnaCode, { color: typeColor }]}>{typeCode}</Text>
            <Text style={[spec.titleStyle, { color: typeColor }]} numberOfLines={1}>
              {typeName}
            </Text>
            <Text style={[styles.typeKr, { color: typeColor }]} numberOfLines={1}>
              {typeKr}
              {showDate ? `  ·  ${showDate}` : ''}
            </Text>
          </View>

          {size === 'mini' && showShareButton ? (
            <Pressable
              onPress={onShare}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="share-outline" size={18} color={typeColor} />
            </Pressable>
          ) : size === 'compressed' ? (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={typeColor}
              style={{ opacity: 0.7 }}
            />
          ) : null}
        </View>
      ) : (
        // FULL layout — column: top meta + bottom title block
        <View
          style={[
            styles.colContent,
            { paddingHorizontal: spec.paddingH, paddingVertical: spec.paddingV },
          ]}
        >
          <View style={styles.fullTop}>
            <Text style={[styles.dnaCode, { color: typeColor }]}>{typeCode}</Text>
            <Text
              style={[
                typography.displaySmall,
                { color: typeColor, opacity: 0.75 },
              ]}
            >
              meve
            </Text>
          </View>
          <View style={styles.fullBottom}>
            {showDate ? (
              <Text
                style={[
                  typography.displaySmall,
                  { color: typeColor, opacity: 0.7, marginBottom: spacing.xs },
                ]}
              >
                {showDate}
              </Text>
            ) : null}
            <Text style={[spec.titleStyle, { color: typeColor }]}>
              {typeName}
            </Text>
            <Text
              style={[
                typography.cardLabel,
                { color: typeColor, opacity: 0.8, marginTop: spacing.xs },
              ]}
            >
              {typeKr}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const Wrapped = (
    <GlowPulse
      shadowColor={motion.glowPulse.color}
      shadowRadius={motion.glowPulse.radius}
      style={[{ borderRadius: spec.borderRadius }, style]}
    >
      {Body}
    </GlowPulse>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {Wrapped}
      </Pressable>
    );
  }
  return Wrapped;
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    justifyContent: 'center',
  },
  colContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fullTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullBottom: {
    // bottom-anchored content
  },
  dnaCode: {
    ...typography.dnaCode,
    marginBottom: spacing.xs,
  },
  typeKr: {
    ...typography.captionSmall,
    opacity: 0.85,
    marginTop: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

export default DNACard;
