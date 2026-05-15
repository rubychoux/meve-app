/**
 * <ShimmerSweep /> — 흰 띠가 좌→우로 가로지르는 시머 효과.
 *
 * 카드 안에 absolute로 배치. 부모는 overflow: 'hidden'이어야 자연스러움.
 * Built-in Animated API + useNativeDriver: true (성능 60fps).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { motion } from '../../theme';

interface ShimmerSweepProps {
  /** 한 사이클 시간 (ms). 기본 3500 */
  duration?: number;
  /** 시작 지연 (ms) */
  delay?: number;
  /** 띠 컬러 (기본 흰 0.5) */
  color?: string;
  /** 띠 너비 — 부모 대비 비율 (0~1). 기본 0.3 */
  widthRatio?: number;
  /** 시머 띠 기울기 */
  skewDeg?: number;
  style?: ViewStyle;
}

export const ShimmerSweep: React.FC<ShimmerSweepProps> = ({
  duration = motion.duration.shimmerSweep,
  delay = 0,
  color = motion.shimmer.color,
  widthRatio = 0.3,
  skewDeg = -15,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [parentW, setParentW] = useState(0);

  useEffect(() => {
    if (!parentW) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, delay, progress, parentW]);

  const bandW = parentW * widthRatio;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandW * 1.5, parentW + bandW * 0.5],
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== parentW) setParentW(w);
  };

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayout}
      style={[styles.container, style]}
    >
      {parentW > 0 && (
        <Animated.View
          style={[
            styles.band,
            {
              width: bandW,
              transform: [{ translateX }, { skewX: `${skewDeg}deg` }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', color, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: '-10%',
    left: 0,
    height: '120%',
  },
});

export default ShimmerSweep;
