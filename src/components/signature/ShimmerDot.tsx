/**
 * <ShimmerDot /> — 떠있는 작은 별빛 점.
 *
 * opacity 0.3 → 1.0, scale 0.8 → 1.2 사이클 (기본 4s). delay로 별마다 다른 타이밍.
 * Carded backgrounds, DNA 카드, 시그니처 wash 위에 absolute로 4-5개씩.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet } from 'react-native';
import { motion } from '../../theme';

interface ShimmerDotProps {
  /** absolute 좌표 (% 또는 px) */
  top?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  /** 점 크기 (px). 기본 3 */
  size?: number;
  /** 시작 지연 (ms) */
  delay?: number;
  /** 한 사이클 시간 (ms). 기본 4000 */
  duration?: number;
  /** 색 (기본 흰) */
  color?: string;
}

export const ShimmerDot: React.FC<ShimmerDotProps> = ({
  top,
  left,
  right,
  bottom,
  size = 3,
  delay = 0,
  duration = motion.duration.shimmerDot,
  color = motion.shimmerDot.color,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const half = duration / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: half,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: half,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, delay, progress]);

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.shimmerDot.minOpacity, motion.shimmerDot.maxOpacity],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.shimmerDot.minScale, motion.shimmerDot.maxScale],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        {
          top,
          left,
          right,
          bottom,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});

export default ShimmerDot;
