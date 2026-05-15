/**
 * <GlowPulse /> — children 외부에 숨쉬듯 빛나는 글로우.
 *
 * shadowOpacity 0 → maxOpacity → 0 사이클. iOS shadow* + Android elevation.
 * useNativeDriver: false (shadowOpacity는 네이티브 드라이버 미지원).
 */

import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../../theme';

interface GlowPulseProps {
  children: ReactNode;
  /** 한 사이클 시간 (ms). 기본 3500 */
  duration?: number;
  /** 최대 opacity. 기본 0.35 */
  maxOpacity?: number;
  /** glow 컬러 (기본 핑크 톤) */
  shadowColor?: string;
  /** glow 반경 */
  shadowRadius?: number;
  /** 시작 지연 (ms) */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export const GlowPulse: React.FC<GlowPulseProps> = ({
  children,
  duration = motion.duration.glowPulse,
  maxOpacity = motion.glowPulse.maxOpacity,
  shadowColor = motion.glowPulse.color,
  shadowRadius = motion.glowPulse.radius,
  delay = 0,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const half = duration / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: maxOpacity,
          duration: half,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: half,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, maxOpacity, delay, opacity]);

  return (
    <Animated.View
      style={[
        {
          shadowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius,
          shadowOpacity: opacity,
          // Android: elevation은 정적. shadowOpacity 애니메이션은 iOS 전용.
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default GlowPulse;
