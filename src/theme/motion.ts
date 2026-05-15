/**
 * meve Design Tokens v1.5 — Motion
 *
 * 4 signature motions:
 *
 * 1. Liquid Light — 시그니처 wash 흐름 (18s) / CTA pill (8s)
 *    react-native-reanimated 사용. background-position 흉내 (LinearGradient gradient).
 *
 * 2. Pearl Reveal — DNA 결과 진입 (1.5s, 한 번)
 *    스캔 → 결과 전환의 클라이맥스 — 8 pearl particles scatter
 *
 * 3. Glow Pulse — DNA 카드 (모든 화면, 3-4s 사이클)
 *    box-shadow opacity 0 → 0.35 → 0
 *
 * 4. Shimmer Sweep — 카드 위 시머 띠 (3.5-4s) + 시머 점 깜빡 (4s)
 *
 * Implementation: react-native-reanimated 3 + Animated.View
 */

export const motion = {
  // === DURATIONS (ms) ===
  duration: {
    liquidLight: 18000,         // wash 배경 흐름
    liquidLightCta: 8000,       // CTA pill 흐름 (더 빠름)
    glowPulse: 3500,            // DNA 카드 glow
    shimmerSweep: 3500,         // 카드 위 시머 띠
    shimmerSweepCta: 4000,      // CTA pill 시머
    shimmerSweepLoose: 5000,    // 카드 안 그라데이션 strip (홈 등)
    shimmerDot: 4000,           // 시머 점 깜빡 사이클
    pearlReveal: 1500,          // 진주 흩어짐 (한 번만)

    // 일반 UI
    fast: 150,                  // 작은 transition
    medium: 250,                // 토글, 버튼
    slow: 350,                  // 카드 펼침/접힘
  },

  // === EASING ===
  easing: {
    standard: 'ease-in-out',
    overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    spring: { damping: 20, stiffness: 200, mass: 1 },
  },

  // === GLOW PULSE shadow keyframes ===
  // RN에서는 opacity animation. box-shadow → shadowOpacity로 변환.
  glowPulse: {
    minOpacity: 0,
    maxOpacity: 0.35,
    color: 'rgba(255, 212, 220, 1)',  // 핑크 톤
    secondaryColor: 'rgba(212, 228, 255, 1)', // 스카이 톤 (DNA 카드 deep glow)
    radius: 30,                       // shadow radius
  },

  // === SHIMMER SWEEP ===
  // 흰 띠가 좌→우로 가로지름. transform: translateX
  shimmer: {
    width: '30%',                      // 띠 너비
    color: 'rgba(255, 255, 255, 0.5)', // 흰 톤
    skew: '-15deg',
  },

  // === SHIMMER DOT (배경/카드에 떠있는 별빛) ===
  shimmerDot: {
    minOpacity: 0.3,
    maxOpacity: 1.0,
    minScale: 0.8,
    maxScale: 1.2,
    color: 'rgba(255, 255, 255, 1)',
    secondaryColor: 'rgba(232, 220, 255, 1)', // 살짝 라벤더
  },

  // === DELAYS (시머 점 4개에 각자 다른 delay) ===
  shimmerDotDelays: [0, 1200, 2500, 800] as const, // ms
} as const;

/**
 * Pre-built reanimated worklets — 컴포넌트에서 재사용
 *
 * 예시 (실제 컴포넌트에선 import):
 *
 * ```ts
 * import { useGlowPulse } from '@/components/signature/motion';
 *
 * const glowOpacity = useGlowPulse({ duration: motion.duration.glowPulse });
 * ```
 *
 * Hook 구현은 /src/components/signature/motion.ts 에서.
 */
