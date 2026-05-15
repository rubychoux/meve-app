/**
 * meve Design Tokens v1.5 — Spacing & Layout
 *
 * Linear ref: meve 브랜드 디자인 가이드 v1.5 (c55bb293d0d5)
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,

  // Common screen paddings
  screenH: 20,         // 화면 좌우 padding
  screenTop: 8,
  cardPadding: 16,
  cardPaddingLg: 20,
} as const;

export const radius = {
  chip: 8,             // 8px 칩, 작은 pill
  card: 16,            // 일반 카드
  cardLg: 20,          // 큰 카드 (프로필 등)
  cardHero: 28,        // DNA 카드 (시그니처)
  ctaPill: 100,        // CTA pill 버튼 (full pill)
  iconBox: 11,         // 진주 아이콘 wrap
  avatar: 50,          // 원형 (50% = perfect circle)
} as const;

export const border = {
  hairline: 0.5,
  // Common border styles (use with colors.hairline / glassWhiteBorder)
} as const;

/**
 * 화면 톤 매트릭스 (참고용 — 화면별 어떤 토큰 쓰는지)
 *
 * | 화면          | 배경        | 카드        | CTA              |
 * |---------------|-------------|-------------|------------------|
 * | 스플래시      | wash        | —           | —                |
 * | 온보딩        | blushSnow   | solid       | mysticNavy       |
 * | 분석 로딩     | wash        | —           | —                |
 * | DNA 결과      | wash        | glass       | gradient pill    |
 * | 홈            | blushSnow   | solid       | gradient pill    |
 * | SKIN 탭       | blushSnow   | solid       | gradient pill    |
 * | LOOK 탭       | blushSnow   | solid       | gradient pill    |
 * | 스캔 탭       | blushSnow   | solid       | DNA 카드 gradient|
 * | eve 탭        | blushSnow   | solid       | mysticNavy       |
 * | 마이페이지    | blushSnow   | solid       | —                |
 * | 인스포 결과   | blushSnow   | solid       | gradient pill    |
 * | 제품 디테일   | blushSnow   | solid       | gradient pill    |
 */
