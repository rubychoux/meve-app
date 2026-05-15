/**
 * <PearlIcon /> — 진주 시그니처 아이콘.
 *
 * 진주(원/타원) + 시그니처 그라데이션 + 미세 시머. 스캔 탭 6 카드 메인 아이콘.
 *
 * 6 variants (Phase 1):
 *   - trouble    : 진주 + 트러블 점들
 *   - makeup     : 두 진주 겹침 (블렌딩)
 *   - inspo      : 액자 안의 진주
 *   - ingredient : 중앙 진주 + 위성 4개 (분자)
 *   - face       : 큰 타원 진주 + 미세 features
 *   - color      : 세 컬러 진주 (베니다이어그램)
 *
 * (Phase 2에 SKIN/LOOK 프로필 행, 메이크업 팁 행, 기록 카드 variant 추가 예정)
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../../theme';

export type PearlVariant =
  | 'trouble'
  | 'makeup'
  | 'inspo'
  | 'ingredient'
  | 'face'
  | 'color';

interface PearlIconProps {
  variant: PearlVariant;
  size?: number;
  /** 위아래 미세 float 모션 (4s). 기본 false */
  withFloat?: boolean;
  style?: ViewStyle;
}

/**
 * Variant별 컬러 매핑. SIGNATURE_COMPONENTS.md 의 컬러 매핑 따름.
 */
const PALETTES: Record<
  PearlVariant,
  {
    primary: readonly [string, string];
    accent?: string;
    secondary?: readonly [string, string];
    tertiary?: readonly [string, string];
  }
> = {
  trouble: {
    primary: ['#F0D4E0', '#E8C2CC'] as const, // pinkLavender
    accent: '#E2A8B5', // rose
  },
  makeup: {
    primary: ['#E8C2CC', '#CFB5C2'] as const, // rosePlum
    secondary: ['#F0CFD8', '#D8B5AC'] as const,
  },
  inspo: {
    primary: ['#D8E4F2', '#DCD4EC'] as const, // skyLavender
    accent: '#A3BAD5',
  },
  ingredient: {
    primary: ['#E4D4FF', '#D8E4F2'] as const, // lavenderSky
    accent: '#BFB2CC',
  },
  face: {
    primary: ['#D8E4F2', '#E0D6EC'] as const, // skyLavender
    accent: '#C5CCE0',
  },
  color: {
    primary: ['#FFD4DC', '#E2A8B5'] as const,  // pink
    secondary: ['#E4D4FF', '#BFB2CC'] as const, // lavender
    tertiary: ['#D8E4F2', '#A3BAD5'] as const,  // sky
  },
};

export const PearlIcon: React.FC<PearlIconProps> = ({
  variant,
  size = 44,
  withFloat = false,
  style,
}) => {
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!withFloat) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [withFloat, floatY]);

  const translateY = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const Inner = (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <PearlSvg variant={variant} />
    </Svg>
  );

  if (withFloat) {
    return (
      <Animated.View style={[{ width: size, height: size, transform: [{ translateY }] }, style]}>
        {Inner}
      </Animated.View>
    );
  }
  return <View style={[{ width: size, height: size }, style]}>{Inner}</View>;
};

// ─── Variant SVG paths ─────────────────────────────────────────────────────────

const PearlSvg: React.FC<{ variant: PearlVariant }> = ({ variant }) => {
  const palette = PALETTES[variant];
  const gradId = `pearl-${variant}-primary`;
  const gradId2 = `pearl-${variant}-secondary`;
  const gradId3 = `pearl-${variant}-tertiary`;

  switch (variant) {
    case 'trouble':
      return (
        <>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.primary[0]} />
              <Stop offset="1" stopColor={palette.primary[1]} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="32" cy="34" r="18" fill={`url(#${gradId})`} />
          <Circle cx="26" cy="28" r="2.5" fill="#FFFFFF" opacity={0.7} />
          {/* trouble dots */}
          <Circle cx="46" cy="20" r="2.4" fill={palette.accent!} opacity={0.85} />
          <Circle cx="20" cy="48" r="1.8" fill={palette.accent!} opacity={0.75} />
          <Circle cx="50" cy="42" r="1.6" fill={palette.accent!} opacity={0.7} />
          <Circle cx="14" cy="24" r="1.4" fill={palette.accent!} opacity={0.65} />
        </>
      );

    case 'makeup':
      return (
        <>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.primary[0]} />
              <Stop offset="1" stopColor={palette.primary[1]} />
            </SvgLinearGradient>
            <SvgLinearGradient id={gradId2} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.secondary![0]} />
              <Stop offset="1" stopColor={palette.secondary![1]} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="24" cy="32" r="16" fill={`url(#${gradId})`} opacity={0.92} />
          <Circle cx="42" cy="34" r="16" fill={`url(#${gradId2})`} opacity={0.85} />
          <Circle cx="20" cy="26" r="2.2" fill="#FFFFFF" opacity={0.7} />
          <Circle cx="38" cy="28" r="2" fill="#FFFFFF" opacity={0.55} />
        </>
      );

    case 'inspo':
      return (
        <>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.primary[0]} />
              <Stop offset="1" stopColor={palette.primary[1]} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x="8"
            y="8"
            width="48"
            height="48"
            rx="6"
            fill="transparent"
            stroke={palette.accent!}
            strokeWidth="1.5"
          />
          <Circle cx="32" cy="32" r="14" fill={`url(#${gradId})`} />
          <Circle cx="27" cy="27" r="2.2" fill="#FFFFFF" opacity={0.7} />
          {/* corner accent */}
          <Circle cx="50" cy="14" r="1.4" fill={palette.accent!} opacity={0.6} />
        </>
      );

    case 'ingredient':
      return (
        <>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.primary[0]} />
              <Stop offset="1" stopColor={palette.primary[1]} />
            </SvgLinearGradient>
          </Defs>
          {/* center */}
          <Circle cx="32" cy="32" r="11" fill={`url(#${gradId})`} />
          <Circle cx="29" cy="29" r="1.6" fill="#FFFFFF" opacity={0.7} />
          {/* satellites */}
          <Circle cx="32" cy="10" r="4" fill={palette.accent!} opacity={0.85} />
          <Circle cx="54" cy="32" r="4" fill={palette.accent!} opacity={0.85} />
          <Circle cx="32" cy="54" r="4" fill={palette.accent!} opacity={0.85} />
          <Circle cx="10" cy="32" r="4" fill={palette.accent!} opacity={0.85} />
        </>
      );

    case 'face':
      return (
        <>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.primary[0]} />
              <Stop offset="1" stopColor={palette.primary[1]} />
            </SvgLinearGradient>
          </Defs>
          <Ellipse cx="32" cy="32" rx="17" ry="22" fill={`url(#${gradId})`} />
          {/* eyes */}
          <Ellipse cx="25" cy="28" rx="1.6" ry="1" fill={palette.accent!} opacity={0.8} />
          <Ellipse cx="39" cy="28" rx="1.6" ry="1" fill={palette.accent!} opacity={0.8} />
          {/* lips hint */}
          <Ellipse cx="32" cy="42" rx="3" ry="1" fill={palette.accent!} opacity={0.6} />
          {/* pearl highlight */}
          <Circle cx="26" cy="22" r="2" fill="#FFFFFF" opacity={0.6} />
        </>
      );

    case 'color':
      return (
        <>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.primary[0]} />
              <Stop offset="1" stopColor={palette.primary[1]} />
            </SvgLinearGradient>
            <SvgLinearGradient id={gradId2} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.secondary![0]} />
              <Stop offset="1" stopColor={palette.secondary![1]} />
            </SvgLinearGradient>
            <SvgLinearGradient id={gradId3} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.tertiary![0]} />
              <Stop offset="1" stopColor={palette.tertiary![1]} />
            </SvgLinearGradient>
          </Defs>
          {/* Venn — 3 overlapping pearls */}
          <Circle cx="24" cy="26" r="14" fill={`url(#${gradId})`} opacity={0.78} />
          <Circle cx="40" cy="26" r="14" fill={`url(#${gradId2})`} opacity={0.78} />
          <Circle cx="32" cy="40" r="14" fill={`url(#${gradId3})`} opacity={0.78} />
          <Circle cx="21" cy="22" r="1.6" fill="#FFFFFF" opacity={0.6} />
          <Circle cx="37" cy="22" r="1.6" fill="#FFFFFF" opacity={0.5} />
        </>
      );
  }
};

export default PearlIcon;
