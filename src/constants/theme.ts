export const Colors = {
  // Backgrounds — v1.5
  bg: '#FBF5F6',              // v1.5 blushSnow — 메인 배경
  surface: '#FFFFFF',          // 카드, 입력 필드 (legacy alias)
  surfaceElevated: '#FCF0F5',  // 연한 핑크 — 섹션 구분
  cardBg: 'rgba(255,255,255,0.7)',  // v1.5 일상 화면 카드 배경 (반투명)

  // Brand primary — v1.5 mysticNavy
  primary: '#2D3A6B',          // 메인 브랜드 컬러
  accent: '#F2A7C3',           // 메인 포인트 (버튼, CTA) — legacy
  accentMuted: '#F9D0E3',      // 연한 핑크 — 선택 카드 배경
  accentLight: '#FDE8F1',      // 아주 연한 핑크

  // Secondary — Light Blue (legacy)
  secondary: '#A8D5E8',
  secondaryMuted: '#D6EDF7',
  secondaryLight: '#EBF6FB',

  // Status
  success: '#85C1AE',
  warning: '#F5C97A',
  danger: '#F08080',

  // Text — v1.5
  textPrimary: '#1A1A1F',      // v1.5 ink
  textSecondary: '#8E8E93',    // v1.5 coolGray
  textDisabled: '#C8BFC6',

  // UI — v1.5
  border: 'rgba(26,26,31,0.08)',  // v1.5 hairline (ink @ 8% opacity)
  borderMuted: '#F7F0F4',
  overlay: 'rgba(45,45,45,0.4)',

  // Brand
  brandPink: '#F2A7C3',        // 메인 핑크
  brandBlue: '#A8D5E8',        // 메인 블루

  // Ingredient flag aliases (used in ui components + skincare screen)
  flagSafe: '#85C1AE',
  flagCaution: '#F5C97A',
  flagAvoid: '#F08080',
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: Colors.textPrimary },
  h2: { fontSize: 22, fontWeight: '600' as const, color: Colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary },
  bodySecondary: { fontSize: 15, fontWeight: '400' as const, color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: Colors.textSecondary },
  cta: { fontSize: 16, fontWeight: '600' as const },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Baby pink → soft lavender → baby sky blue (matches actual meve logo)
export const MEVE_GRADIENT = {
  colors: ['#F9C4D8', '#E8B4E8', '#C4B8E8', '#B8D4F0'] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
};

// Baby pink → baby sky blue (2-stop simplified)
export const MEVE_GRADIENT_SIMPLE = {
  colors: ['#F9C4D8', '#B8D4F0'] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
};
