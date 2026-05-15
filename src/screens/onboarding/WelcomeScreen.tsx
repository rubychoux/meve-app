/**
 * WelcomeScreen — meve v1.5 Onboarding (4 slides)
 *
 * 1. Welcome      — "meve" 헤로 텍스트
 * 2. Beauty DNA   — 8 타입 그리드 (asymmetric, GCS featured)
 * 3. D-day        — GlassCard + stage dots
 * 4. Inspo Match  — 인스포 이미지 + 3 매칭 제품
 *
 * Linear: MEVE-266 (디자인 시스템 v1.5 → RN 변환)
 * 참고: SCREEN_CONVERSION_SPEC.md §화면 2-5
 */

import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Easing,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { OnboardingStackParamList } from '../../types';
import { colors, spacing, BeautyTypeCode } from '../../theme';
import {
  SignatureWashBg,
  GradientPill,
  GlassCard,
  GlowPulse,
  ShimmerDot,
  ShimmerSweep,
} from '../../components/signature';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
type SlideId = 'welcome' | 'beauty-dna' | 'd-day' | 'inspo';

const SLIDES: { id: SlideId }[] = [
  { id: 'welcome' },
  { id: 'beauty-dna' },
  { id: 'd-day' },
  { id: 'inspo' },
];

// 8타입 그리드 — GCS featured + 7 small
const FEATURED_TYPE: BeautyTypeCode = 'GCS';
const SMALL_TYPES: BeautyTypeCode[] = ['MCS', 'GWS', 'MCB', 'MWS', 'GCB', 'GWB', 'MWB'];

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<{ id: SlideId }>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      navigation.navigate('AuthGate');
    } else {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  };

  const handleSkip = () => navigation.navigate('AuthGate');

  return (
    <SignatureWashBg variant="soft">
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLogo}>meve</Text>
          {!isLast ? (
            <TouchableOpacity onPress={handleSkip} hitSlop={10}>
              <Text style={styles.headerSkip}>건너뛰기</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 1 }} />
          )}
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(idx);
          }}
          style={styles.flatList}
          renderItem={({ item }) => (
            <View style={[styles.slideWrap, { width }]}>
              {item.id === 'welcome' && <SlideWelcome />}
              {item.id === 'beauty-dna' && <SlideBeautyDNA contentWidth={width - spacing.xxl * 2} />}
              {item.id === 'd-day' && <SlideDday isActive={currentIndex === 2} />}
              {item.id === 'inspo' && <SlideInspo />}
            </View>
          )}
        />

        {/* Footer */}
        <View style={styles.footer}>
          {/* Page dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* CTA */}
          <GradientPill
            label={isLast ? '시작하기' : '다음'}
            size="lg"
            iconRight="arrow-right"
            fullWidth
            onPress={handleNext}
          />

          {/* Disclaimer — last slide only */}
          {isLast && (
            <Text style={styles.disclaimer}>
              시작하기를 누르면 이용약관 및{'\n'}개인정보처리방침에 동의하는 것으로 간주합니다.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </SignatureWashBg>
  );
}

// ─── Slide 1: Welcome ──────────────────────────────────────────────────────────

const MEVE_LETTERS = ['m', 'e', 'v', 'e'] as const;

const SlideWelcome: React.FC = () => {
  const letterOps = useRef(MEVE_LETTERS.map(() => new Animated.Value(0))).current;
  const letterTYs = useRef(MEVE_LETTERS.map(() => new Animated.Value(12))).current;
  const breatheScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered letter entrance (m: 0ms, e: 120ms, v: 240ms, e: 360ms)
    const entranceAnims = MEVE_LETTERS.map((_, i) =>
      Animated.parallel([
        Animated.timing(letterOps[i], {
          toValue: 1,
          duration: 600,
          delay: i * 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(letterTYs[i], {
          toValue: 0,
          duration: 600,
          delay: i * 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.parallel(entranceAnims).start();

    // Breathe scale loop — start ~1s after entrance completes.
    // Entrance total = 600ms duration + 360ms last delay = 960ms. +1000ms wait ≈ 2s.
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, {
          toValue: 1.02,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const breatheTimer = setTimeout(() => breatheLoop.start(), 1960);

    return () => {
      clearTimeout(breatheTimer);
      breatheLoop.stop();
    };
  }, [letterOps, letterTYs, breatheScale]);

  return (
  <View style={styles.slideWelcomeRoot}>
    {/* Top strip glitter (top ~10%) */}
    <ShimmerDot top="3%"  left="12%" size={2} delay={0}    duration={4000} />
    <ShimmerDot top="6%"  left="38%" size={3} delay={1500} duration={4500} />
    <ShimmerDot top="8%"  right="22%" size={2} delay={2800} duration={5000} />
    <ShimmerDot top="5%"  right="44%" size={1} delay={500}  duration={3500} />

    {/* Mid scatter (10 dots) */}
    <ShimmerDot top="18%" left="8%"  size={3} delay={1200} duration={5500} />
    <ShimmerDot top="22%" right="14%" size={2} delay={2000} duration={4000} />
    <ShimmerDot top="30%" left="22%" size={1} delay={400}  duration={3000} />
    <ShimmerDot top="35%" right="32%" size={4} delay={1800} duration={6000} />
    <ShimmerDot top="38%" right="8%"  size={2} delay={3200} duration={4500} />
    <ShimmerDot top="55%" left="18%" size={3} delay={800}  duration={5000} />
    <ShimmerDot top="58%" right="20%" size={2} delay={2500} duration={3500} />
    <ShimmerDot top="62%" left="40%" size={1} delay={4000} duration={4000} />
    <ShimmerDot top="65%" right="6%"  size={3} delay={1500} duration={5500} />
    <ShimmerDot top="70%" left="10%" size={2} delay={3500} duration={4000} />

    {/* Bottom strip glitter (bottom ~15%) */}
    <ShimmerDot bottom="20%" left="18%"  size={2} delay={2200} duration={4500} />
    <ShimmerDot bottom="14%" right="28%" size={3} delay={800}  duration={5000} />
    <ShimmerDot bottom="12%" left="42%"  size={1} delay={3000} duration={3500} />
    <ShimmerDot bottom="6%"  right="14%" size={2} delay={1500} duration={4000} />

    {/* Center: meve text with surrounding glitter + shimmer sweep */}
    <View style={styles.welcomeCenter}>
      <View style={styles.meveWrapper}>
        {/* 6 dots clustered around the text */}
        <ShimmerDot left={-30}   top={-20} size={3} delay={500}  duration={4000} />
        <ShimmerDot left="80%"   top={-25} size={2} delay={1500} duration={3500} />
        <ShimmerDot left="105%"  top={10}  size={4} delay={800}  duration={5000} />
        <ShimmerDot left="85%"   top={40}  size={2} delay={2800} duration={4000} />
        <ShimmerDot left={-20}   top={35}  size={3} delay={2000} duration={4500} />
        <ShimmerDot left={-35}   top={15}  size={2} delay={3500} duration={5000} />

        <Animated.View
          style={[styles.meveLettersRow, { transform: [{ scale: breatheScale }] }]}
        >
          {MEVE_LETTERS.map((letter, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.welcomeLogo,
                {
                  opacity: letterOps[i],
                  transform: [{ translateY: letterTYs[i] }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </Animated.View>
      </View>

      <View style={{ height: spacing.xxxl }} />
      <Text style={styles.welcomeBody}>나다운 아름다움,</Text>
      <Text style={styles.welcomeBody}>가장 정확하게</Text>
    </View>
  </View>
  );
};

// ─── Slide 2: Beauty DNA ───────────────────────────────────────────────────────

const SlideBeautyDNA: React.FC<{ contentWidth: number }> = ({ contentWidth }) => {
  const GAP = 8;
  const colW = (contentWidth - GAP * 2) / 3;
  const featured = colW * 2 + GAP;

  return (
    <View style={styles.slidePadded}>
      <Text style={styles.eyebrow}>Beauty DNA</Text>
      <Text style={styles.slideMain}>
        셀카 한 장으로{'\n'}나만의 뷰티 타입
      </Text>

      <View style={{ marginTop: spacing.xxxl }}>
        {/* Row 1: GCS (2x2) + right column (2 small stacked) */}
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <DnaTypeCard typeCode={FEATURED_TYPE} size={featured} featured />
          <View style={{ width: colW, gap: GAP }}>
            <DnaTypeCard typeCode={SMALL_TYPES[0]} size={colW} />
            <DnaTypeCard typeCode={SMALL_TYPES[1]} size={colW} />
          </View>
        </View>

        {/* Row 2 */}
        <View style={{ flexDirection: 'row', gap: GAP, marginTop: GAP }}>
          <DnaTypeCard typeCode={SMALL_TYPES[2]} size={colW} />
          <DnaTypeCard typeCode={SMALL_TYPES[3]} size={colW} />
          <DnaTypeCard typeCode={SMALL_TYPES[4]} size={colW} />
        </View>

        {/* Row 3 — 2 cards + spacer */}
        <View style={{ flexDirection: 'row', gap: GAP, marginTop: GAP }}>
          <DnaTypeCard typeCode={SMALL_TYPES[5]} size={colW} />
          <DnaTypeCard typeCode={SMALL_TYPES[6]} size={colW} />
          <View style={{ width: colW }} />
        </View>
      </View>
    </View>
  );
};

const DnaTypeCard: React.FC<{
  typeCode: BeautyTypeCode;
  size: number;
  featured?: boolean;
}> = ({ typeCode, size, featured }) => {
  const type = colors.types[typeCode];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: featured ? 16 : 12,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={type.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {featured && <ShimmerSweep duration={3500} widthRatio={0.35} />}
      {/* Bottom gradient overlay for text readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)']}
        start={{ x: 0.5, y: 0.4 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Top-right code */}
      <Text style={[styles.dnaTypeCode, featured && { fontSize: 8 }]}>
        {typeCode}
      </Text>
      {/* Bottom-left name */}
      <Text
        style={featured ? styles.dnaTypeNameFeatured : styles.dnaTypeName}
        numberOfLines={1}
      >
        {type.name}
      </Text>
    </View>
  );
};

// ─── Slide 3: D-day ────────────────────────────────────────────────────────────

const STAGES = [
  { label: 'D-30', state: 'done' as const },
  { label: 'D-14', state: 'now' as const },
  { label: 'D-7', state: 'future' as const },
  { label: 'D-1', state: 'future' as const },
];

// SVG icons for step cards
const PersonSvg = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Circle cx="12" cy="8" r="3.4" fill="#FFFFFF" />
    <Path
      d="M4.5 21 C 4.5 15.5, 8 13.5, 12 13.5 C 16 13.5, 19.5 15.5, 19.5 21 Z"
      fill="#FFFFFF"
    />
  </Svg>
);
const StarSvg = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d="M12 2 L14.3 8.6 L21.2 9 L15.8 13.2 L17.7 19.9 L12 16.1 L6.3 19.9 L8.2 13.2 L2.8 9 L9.7 8.6 Z"
      fill="#FFFFFF"
    />
  </Svg>
);
const SunSvg = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="4.2" fill="#FFFFFF" />
    <Path
      d="M12 1.8 L12 4.5 M12 19.5 L12 22.2 M1.8 12 L4.5 12 M19.5 12 L22.2 12 M4.8 4.8 L6.7 6.7 M17.3 17.3 L19.2 19.2 M19.2 4.8 L17.3 6.7 M6.7 17.3 L4.8 19.2"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Svg>
);

interface StageDetail {
  iconGradient: readonly [string, string];
  icon: ReactNode;
  badge: string;
  title: string;
  desc: string;
}

const STAGE_DETAILS: StageDetail[] = [
  {
    iconGradient: ['#FFD4DC', '#EFC4D4'] as const,
    icon: <PersonSvg />,
    badge: 'D-30',
    title: '피부과·시술 예약',
    desc: '레이저, 리프팅 등 회복 시간이 필요한 관리',
  },
  {
    iconGradient: ['#E4D4FF', '#D4C4F0'] as const,
    icon: <StarSvg />,
    badge: 'D-14',
    title: '피부 안정화 루틴',
    desc: '새 제품 금지, 자극 최소화, 보습 집중',
  },
  {
    iconGradient: ['#D4E4FF', '#C4D4F0'] as const,
    icon: <SunSvg />,
    badge: 'D-7',
    title: '집중 글로우 케어',
    desc: '팩·세럼 집중 루틴, 수분 광채 완성',
  },
];

// ─── Step icon: 34×34 rounded gradient card ────────────────────────────────────

const StepIcon: React.FC<{ gradient: readonly [string, string]; children: ReactNode }> = ({
  gradient,
  children,
}) => (
  <View style={styles.stepIcon}>
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.stepIconInner}>{children}</View>
  </View>
);

// ─── Floating petal particle ───────────────────────────────────────────────────

interface PetalProps {
  leftPct: DimensionValue;
  duration: number;
  size: number;
  color: string;
  delay?: number;
}

const Petal: React.FC<PetalProps> = ({ leftPct, duration, size, color, delay = 0 }) => {
  const { height: H } = useWindowDimensions();
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(ty, {
            toValue: -H,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(op, {
              toValue: 0.5,
              duration: duration * 0.15,
              useNativeDriver: true,
            }),
            Animated.delay(duration * 0.55),
            Animated.timing(op, {
              toValue: 0,
              duration: duration * 0.3,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(ty, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [H, duration, delay, ty, op]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: -size,
        left: leftPct,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: op,
        transform: [{ translateY: ty }],
      }}
    />
  );
};

// ─── SlideDday ─────────────────────────────────────────────────────────────────

const SlideDday: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  // D-38 hero entrance
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroTY = useRef(new Animated.Value(10)).current;
  // dot animations
  const d30Scale = useRef(new Animated.Value(1)).current;
  const d14Scale = useRef(new Animated.Value(1)).current;
  const futureOp = useRef(new Animated.Value(0)).current;
  // step item animations
  const itemOps = useRef(STAGE_DETAILS.map(() => new Animated.Value(0))).current;
  const itemTYs = useRef(STAGE_DETAILS.map(() => new Animated.Value(8))).current;

  useEffect(() => {
    if (!isActive) {
      heroOp.setValue(0);
      heroTY.setValue(10);
      futureOp.setValue(0);
      itemOps.forEach((v) => v.setValue(0));
      itemTYs.forEach((v) => v.setValue(8));
      return;
    }

    // (A) D-38 hero: opacity + translateY (spring-ish bezier)
    Animated.parallel([
      Animated.timing(heroOp, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
      Animated.timing(heroTY, {
        toValue: 0,
        duration: 800,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]).start();

    // (B) Dot D-30: scale pulse once (immediate)
    Animated.sequence([
      Animated.delay(100),
      Animated.timing(d30Scale, { toValue: 1.4, duration: 250, useNativeDriver: true }),
      Animated.timing(d30Scale, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // (B) Dot D-14: infinite pulse (after 300ms)
    const d14Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(d14Scale, { toValue: 1.35, duration: 900, useNativeDriver: true }),
        Animated.timing(d14Scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    const d14Timer = setTimeout(() => d14Loop.start(), 300);

    // (B) Future dots (D-7, D-1): fade in dim at 0.5s
    Animated.timing(futureOp, {
      toValue: 1,
      duration: 500,
      delay: 500,
      useNativeDriver: true,
    }).start();

    // (C) Step items: staggered (delay 300, 500, 700)
    [300, 500, 700].forEach((d, i) => {
      Animated.parallel([
        Animated.timing(itemOps[i], {
          toValue: 1,
          duration: 600,
          delay: d,
          useNativeDriver: true,
        }),
        Animated.timing(itemTYs[i], {
          toValue: 0,
          duration: 600,
          delay: d,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      clearTimeout(d14Timer);
      d14Loop.stop();
    };
  }, [isActive, heroOp, heroTY, d30Scale, d14Scale, futureOp, itemOps, itemTYs]);

  return (
    <View style={styles.ddayRoot}>
      {/* Background inherits SignatureWashBg variant="soft" — no slide-local overlay */}

      {/* Floating petals */}
      <Petal leftPct="15%" duration={7500} size={6} color="rgba(255,200,220,0.5)" delay={0} />
      <Petal leftPct="30%" duration={6800} size={5} color="rgba(230,200,240,0.5)" delay={1200} />
      <Petal leftPct="55%" duration={8500} size={7} color="rgba(255,210,225,0.5)" delay={2400} />
      <Petal leftPct="72%" duration={9000} size={5} color="rgba(220,210,245,0.5)" delay={3000} />
      <Petal leftPct="85%" duration={6200} size={6} color="rgba(255,205,220,0.5)" delay={800} />

      {/* Padded content */}
      <View style={styles.slidePadded}>
        <Text style={styles.eyebrow}>D-day</Text>
        <Text style={styles.slideMain}>
          중요한 날 전에{'\n'}필요한 모든 준비
        </Text>

        {/* (D) GlassCard with infinite glow pulse */}
        <GlowPulse
          duration={4000}
          shadowColor="rgba(255,212,220,1)"
          shadowRadius={28}
          maxOpacity={0.4}
          style={styles.ddayGlowWrap}
        >
          <GlassCard style={styles.ddayCard}>
            <ShimmerSweep duration={5000} widthRatio={0.35} />

            {/* Event label */}
            <Text style={styles.ddayLabel}>💍  WEDDING DAY</Text>

            {/* D-38 (animated entrance) */}
            <Animated.Text
              style={[
                styles.ddayBig,
                { opacity: heroOp, transform: [{ translateY: heroTY }] },
              ]}
            >
              D − 38
            </Animated.Text>

            <View style={styles.ddayDivider} />

            {/* Stage dots */}
            <View style={styles.ddayStages}>
              {STAGES.map((s) => {
                const isDone = s.state === 'done';
                const isNow = s.state === 'now';
                const scale = isDone ? d30Scale : isNow ? d14Scale : undefined;
                const opacity = s.state === 'future' ? futureOp : undefined;
                return (
                  <View key={s.label} style={styles.ddayStage}>
                    <Animated.View
                      style={[
                        styles.ddayDot,
                        isDone && styles.ddayDotDone,
                        isNow && styles.ddayDotNow,
                        s.state === 'future' && styles.ddayDotFuture,
                        scale ? { transform: [{ scale }] } : null,
                        opacity ? { opacity } : null,
                      ]}
                    >
                      {/* D-14 inner dot (center fill) */}
                      {isNow && <View style={styles.ddayDotNowInner} />}
                    </Animated.View>
                    <Animated.Text
                      style={[
                        styles.ddayStageLabel,
                        isNow && styles.ddayStageLabelNow,
                        s.state === 'future' ? { opacity } : null,
                      ]}
                    >
                      {s.label}
                    </Animated.Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.ddayDivider} />

            {/* Step details — staggered fade-in */}
            <View style={styles.ddayDetails}>
              {STAGE_DETAILS.map((d, i) => (
                <Animated.View
                  key={d.title}
                  style={[
                    styles.ddayDetailRow,
                    { opacity: itemOps[i], transform: [{ translateY: itemTYs[i] }] },
                  ]}
                >
                  <StepIcon gradient={d.iconGradient}>{d.icon}</StepIcon>
                  <View style={styles.ddayDetailText}>
                    <Text style={styles.ddayDetailBadge}>{d.badge}</Text>
                    <Text style={styles.ddayDetailTitle}>{d.title}</Text>
                    <Text style={styles.ddayDetailDesc}>{d.desc}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </GlassCard>
        </GlowPulse>
      </View>
    </View>
  );
};

// ─── Slide 4: Inspo Match ──────────────────────────────────────────────────────

interface InspoProduct {
  swatch: string;       // solid hex
  match: string;        // "96%"
  brand: string;        // "rom&nd"
  name: string;         // "Glasting Melting Balm 13"
}

const PRODUCTS: InspoProduct[] = [
  { swatch: '#C8B5E0', match: '96%', brand: 'rom&nd', name: 'Glasting Melting Balm 13' },
  { swatch: '#D49098', match: '95%', brand: '힌스',    name: 'Second Skin Lip 06' },
  { swatch: '#F5DCD0', match: '94%', brand: '라네즈',  name: 'Neo Cushion Matte 23C' },
];

const SlideInspo: React.FC = () => (
  <View style={styles.slideInspoPadded}>
    <Text style={styles.eyebrow}>Inspo Match</Text>
    <Text style={styles.slideMain}>
      인스타에서 본 그 화장{'\n'}나에게 맞는 제품으로
    </Text>

    {/* Inspo photo (4:5 portrait) */}
    <View style={styles.inspoImage}>
      <Image
        source={require('../../../assets/images/inspo_example.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ top: '25%' }}
      />

      {/* Top-right "Inspo 사진" pill */}
      <BlurView
        intensity={20}
        tint="light"
        style={styles.inspoImagePillTopRight}
      >
        <Text style={styles.inspoImagePillText}>Inspo 사진</Text>
      </BlurView>

      {/* Bottom-left "분석 중..." pill with shimmer */}
      <BlurView
        intensity={20}
        tint="light"
        style={styles.inspoImagePillBottomLeft}
      >
        <ShimmerSweep duration={2200} widthRatio={0.5} />
        <Text style={styles.inspoImageAnalyzingText}>분석 중...</Text>
      </BlurView>
    </View>

    {/* Arrow */}
    <View style={styles.inspoArrow}>
      <Ionicons name="arrow-down" size={18} color="rgba(45,58,107,0.5)" />
    </View>

    {/* 3 product cards */}
    <View style={styles.inspoProducts}>
      {PRODUCTS.map((p) => (
        <GlassCard
          key={p.name}
          intensity={15}
          style={styles.inspoProductCard}
        >
          <View style={[styles.inspoSwatch, { backgroundColor: p.swatch }]} />
          <Text style={styles.inspoMatch}>{p.match}</Text>
          <View style={styles.inspoProductLabels}>
            <Text style={styles.inspoBrand} numberOfLines={1}>{p.brand}</Text>
            <Text style={styles.inspoName} numberOfLines={2}>{p.name}</Text>
          </View>
        </GlassCard>
      ))}
    </View>
  </View>
);

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLogo: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 28,
    color: colors.mysticNavy,
  },
  headerSkip: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: 'rgba(45,58,107,0.6)',
  },

  // FlatList wrapping
  flatList: { flex: 1 },
  slideWrap: { flex: 1 },

  // Common slide layouts
  slideCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  slidePadded: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  eyebrow: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 22,
    color: 'rgba(45,58,107,0.7)',
    marginBottom: spacing.sm,
  },
  slideMain: {
    fontFamily: 'Pretendard-Light',
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
    fontWeight: '300',
  },

  // Slide 1: Welcome
  slideWelcomeRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  welcomeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  meveWrapper: {
    // Wrapper around the "meve" text — sizes to text width so absolutely-
    // positioned ShimmerDots (left=−30, left="80%", etc.) and the ShimmerSweep
    // overlay are positioned relative to the text itself.
    position: 'relative',
  },
  meveLettersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  welcomeLogo: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 60,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.mysticNavy,
    fontWeight: '300',
  },
  welcomeBody: {
    fontFamily: 'Pretendard-Thin',
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0,
    color: 'rgba(26,26,31,0.75)',
    fontWeight: '200',
    textAlign: 'center',
  },

  // Slide 2: DNA grid
  dnaTypeCode: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontFamily: 'Menlo',
    fontSize: 6,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  dnaTypeName: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  dnaTypeNameFeatured: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '300',
  },

  // Slide 3: D-day (Wedding edition)
  ddayRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  ddayGlowWrap: {
    marginTop: spacing.xxl,
    borderRadius: 20,
  },
  ddayCard: {
    padding: spacing.xxl,
  },
  ddayLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(45,58,107,0.65)',
    marginBottom: spacing.md,
  },
  ddayBig: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 38,
    lineHeight: 42,
    color: colors.mysticNavy,
    fontWeight: '300',
  },
  ddayDivider: {
    height: 0.5,
    backgroundColor: 'rgba(45,58,107,0.18)',
    marginVertical: spacing.lg,
  },
  ddayStages: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ddayStage: {
    alignItems: 'center',
    gap: 6,
  },
  ddayDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ddayDotDone: {
    backgroundColor: colors.mysticNavy,
  },
  ddayDotNow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.mysticNavy,
  },
  ddayDotNowInner: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.mysticNavy,
  },
  ddayDotFuture: {
    backgroundColor: 'rgba(45,58,107,0.2)',
  },
  ddayStageLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: 'rgba(45,58,107,0.55)',
  },
  ddayStageLabelNow: {
    fontFamily: 'Pretendard-SemiBold',
    color: colors.mysticNavy,
    fontWeight: '600',
  },
  ddayDetails: {
    gap: spacing.md,
  },
  ddayDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepIconInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ddayDetailText: {
    flex: 1,
    gap: 2,
  },
  ddayDetailBadge: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(45,58,107,0.6)',
    fontWeight: '300',
  },
  ddayDetailTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    fontWeight: '500',
  },
  ddayDetailDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(45,58,107,0.6)',
  },

  // Slide 4: Inspo
  slideInspoPadded: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: spacing.lg,
  },
  inspoImage: {
    width: '100%',
    alignSelf: 'center',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: spacing.xxl,
    backgroundColor: 'rgba(45,58,107,0.05)',
  },
  inspoImagePillTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  inspoImagePillBottomLeft: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  inspoImagePillText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    lineHeight: 14,
    color: colors.mysticNavy,
    fontWeight: '500',
  },
  inspoImageAnalyzingText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    lineHeight: 14,
    color: colors.mysticNavy,
    fontWeight: '500',
  },
  inspoArrow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  inspoProducts: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inspoProductCard: {
    flex: 1,
    minHeight: 130,
    paddingVertical: spacing.md,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  inspoSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  inspoMatch: {
    fontFamily: 'Fraunces-LightItalic',
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 18,
    color: colors.mysticNavy,
    fontWeight: '300',
    textAlign: 'center',
  },
  inspoProductLabels: {
    alignItems: 'center',
    gap: 1,
    width: '100%',
  },
  inspoBrand: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  inspoName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: '#1A1A1F',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.mysticNavy,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(45,58,107,0.2)',
  },
  disclaimer: {
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(45,58,107,0.55)',
  },
});
