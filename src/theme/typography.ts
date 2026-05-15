/**
 * meve Design Tokens v1.5 — Typography
 *
 * Linear ref: meve 브랜드 디자인 가이드 v1.5 (c55bb293d0d5)
 *
 * ABSOLUTE RULES:
 * - 한글 → Pretendard ONLY. Italic 절대 X. 세리프/명조 절대 X.
 * - 영문 디스플레이 (15pt+) → Fraunces Italic
 * - 영문 UI/라벨/숫자 (15pt-) → Pretendard
 * - 영문이 주인공, 한글은 서브 (시그니처 모먼트에서)
 * - 두 폰트 대비가 meve 시그니처
 */

import { Platform } from 'react-native';

// Font family names (must match expo-font loaded names)
export const fonts = {
  // Pretendard (한글 + 영문 작은 사이즈 + 숫자)
  pretendard: {
    thin:     Platform.select({ ios: 'Pretendard-Thin',       android: 'Pretendard-Thin' })!,
    light:    Platform.select({ ios: 'Pretendard-Light',      android: 'Pretendard-Light' })!,
    regular:  Platform.select({ ios: 'Pretendard-Regular',    android: 'Pretendard-Regular' })!,
    medium:   Platform.select({ ios: 'Pretendard-Medium',     android: 'Pretendard-Medium' })!,
    semibold: Platform.select({ ios: 'Pretendard-SemiBold',   android: 'Pretendard-SemiBold' })!,
    bold:     Platform.select({ ios: 'Pretendard-Bold',       android: 'Pretendard-Bold' })!,
  },
  // Fraunces ITALIC ONLY (영문 디스플레이)
  // weight 300 = display hero / 400 = section labels
  fraunces: {
    italicLight:   Platform.select({ ios: 'Fraunces-LightItalic',   android: 'Fraunces-LightItalic' })!,
    italicRegular: Platform.select({ ios: 'Fraunces-Italic',        android: 'Fraunces-Italic' })!,
  },
  // System mono (DNA 코드, "GCS" 같은 거 — 둘 다 OK)
  mono: Platform.select({ ios: 'Menlo', android: 'monospace' })!,
} as const;

/**
 * Type styles — 각 사용처마다 정해진 조합
 * 사용법: <Text style={typography.displayHero}>Icy Glow</Text>
 */
export const typography = {
  // === DISPLAY (Fraunces Italic — 영문 전용) ===
  /** "Icy Glow" 등 큰 영문 디스플레이 (DNA 결과) */
  displayHero: {
    fontFamily: fonts.fraunces.italicLight,
    fontSize: 46,
    lineHeight: 46 * 0.95,
    letterSpacing: -1.5,
    fontWeight: '300' as const,
  },
  /** "Icy Glow" 미니 (홈 DNA 미니 카드, 프로필 카드 헤더) */
  displayMid: {
    fontFamily: fonts.fraunces.italicLight,
    fontSize: 26,
    lineHeight: 26,
    letterSpacing: -0.8,
    fontWeight: '300' as const,
  },
  /** meve 로고 (상단바) */
  displayBrand: {
    fontFamily: fonts.fraunces.italicLight,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: -0.5,
    fontWeight: '300' as const,
  },
  /** Section 라벨 "Today's Beauty", "For You", "Quick scan" 등 */
  displaySection: {
    fontFamily: fonts.fraunces.italicRegular,
    fontSize: 15,
    lineHeight: 15 * 1.2,
    letterSpacing: -0.2,
  },
  /** 작은 영문 라벨 "Signature", "or", "all →", "94% match" */
  displaySmall: {
    fontFamily: fonts.fraunces.italicRegular,
    fontSize: 12,
    lineHeight: 12 * 1.4,
  },
  /** 매칭 % 큰 표시 ("96%") */
  displayPercent: {
    fontFamily: fonts.fraunces.italicRegular,
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -0.5,
  },

  // === KOREAN UI (Pretendard) ===
  /** 큰 한글 헤더 "스킨케어", "메이크업" (헤더 타이틀) */
  headerTitle: {
    fontFamily: fonts.pretendard.thin,
    fontSize: 26,
    lineHeight: 26 * 1.2,
    letterSpacing: -0.8,
    fontWeight: '200' as const,
  },
  /** 메인 카드 제목 "뷰티 DNA 스캔" */
  cardTitle: {
    fontFamily: fonts.pretendard.light,
    fontSize: 26,
    lineHeight: 26 * 1.1,
    letterSpacing: -0.8,
    fontWeight: '300' as const,
  },
  /** 서브헤딩 "졸업식 D-25" 등 */
  subheading: {
    fontFamily: fonts.pretendard.medium,
    fontSize: 17,
    lineHeight: 17 * 1.3,
    letterSpacing: -0.4,
    fontWeight: '500' as const,
  },
  /** 본문 (팁 카드, 설명 등) */
  body: {
    fontFamily: fonts.pretendard.regular,
    fontSize: 13,
    lineHeight: 13 * 1.65,
    letterSpacing: -0.2,
    fontWeight: '400' as const,
  },
  /** 본문 강조 (b 태그 대신) */
  bodyEmphasis: {
    fontFamily: fonts.pretendard.medium,
    fontSize: 13,
    lineHeight: 13 * 1.65,
    letterSpacing: -0.2,
    fontWeight: '500' as const,
  },
  /** 카드 안 제목 ("오늘의 루틴", "트러블 체크인") */
  cardLabel: {
    fontFamily: fonts.pretendard.medium,
    fontSize: 14,
    lineHeight: 14 * 1.3,
    letterSpacing: -0.2,
    fontWeight: '500' as const,
  },
  /** 캡션 / 메타 정보 ("5월 11일 · 2일 전") */
  caption: {
    fontFamily: fonts.pretendard.regular,
    fontSize: 11,
    lineHeight: 11 * 1.5,
    fontWeight: '400' as const,
  },
  /** 작은 캡션 ("3단계 중 1단계") */
  captionSmall: {
    fontFamily: fonts.pretendard.regular,
    fontSize: 10,
    lineHeight: 10 * 1.5,
    fontWeight: '400' as const,
  },
  /** 라벨 uppercase + tracking ("YOUR BEAUTY DNA", "ALL") */
  labelCap: {
    fontFamily: fonts.pretendard.regular,
    fontSize: 10,
    lineHeight: 10 * 1.5,
    letterSpacing: 2.0, // 0.2em-ish
    textTransform: 'uppercase' as const,
    fontWeight: '400' as const,
  },

  // === NUMBERS / MONO ===
  /** DNA 코드 "GCS" — 모노스페이스 */
  dnaCode: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 11 * 1.4,
    letterSpacing: 3.3, // 0.3em
    fontWeight: '500' as const,
  },
  /** 점수/숫자 강조 ("65", "92%", "₩28,000") */
  scoreNum: {
    fontFamily: fonts.pretendard.semibold,
    fontSize: 13,
    lineHeight: 13 * 1.3,
    fontWeight: '600' as const,
  },
  /** 큰 가격 ("₩28,000") */
  price: {
    fontFamily: fonts.pretendard.semibold,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: -0.5,
    fontWeight: '600' as const,
  },

  // === CTA TEXT ===
  /** CTA pill 버튼 텍스트 ("시작 →") */
  ctaPill: {
    fontFamily: fonts.pretendard.semibold,
    fontSize: 15,
    lineHeight: 15,
    letterSpacing: -0.2,
    fontWeight: '600' as const,
  },
  /** Secondary 버튼 텍스트 ("수정", "all →") */
  buttonSecondary: {
    fontFamily: fonts.pretendard.medium,
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '500' as const,
  },
} as const;

export type TypographyKey = keyof typeof typography;

/**
 * Required fonts to load via expo-font in App.tsx
 *
 * import * as Font from 'expo-font';
 *
 * await Font.loadAsync({
 *   'Pretendard-Thin': require('./assets/fonts/Pretendard-Thin.otf'),
 *   ...
 *   'Fraunces-Italic': require('./assets/fonts/Fraunces-Italic.ttf'),
 *   'Fraunces-LightItalic': require('./assets/fonts/Fraunces-LightItalic.ttf'),
 * });
 *
 * Fraunces download: https://fonts.google.com/specimen/Fraunces
 *   - Light Italic (300) + Italic (400) 두 가지만
 * Pretendard download: https://github.com/orioncactus/pretendard
 */
export const fontFiles = {
  pretendard: [
    'Pretendard-Thin',
    'Pretendard-Light',
    'Pretendard-Regular',
    'Pretendard-Medium',
    'Pretendard-SemiBold',
    'Pretendard-Bold',
  ],
  fraunces: [
    'Fraunces-LightItalic',
    'Fraunces-Italic',
  ],
};
