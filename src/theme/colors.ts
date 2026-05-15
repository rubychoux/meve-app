/**
 * meve Design Tokens v1.5 — Colors
 *
 * Linear ref: meve 브랜드 디자인 가이드 v1.5 (c55bb293d0d5)
 *
 * Rules:
 * - 일상 화면 배경: blushSnow (#FBF5F6)
 * - 시그니처 화면 배경: 그라데이션 wash (signatureGradient)
 * - CTA 시그니처: gradient pill / CTA 일상: mysticNavy solid
 * - 검정 솔리드 #1A1A1F CTA 금지 (IT 톤)
 * - 베이지 X / 비비드 X / 3D X
 */

export const colors = {
  // === BASE ===
  blushSnow: '#FBF5F6',      // 메인 배경 (일상 화면)
  pureWhite: '#FFFFFF',       // 솔리드 카드
  glassWhite: 'rgba(255, 255, 255, 0.55)',  // 시그니처 화면 카드 (반투명 + blur)
  glassWhiteBorder: 'rgba(255, 255, 255, 0.8)',

  // === TEXT ===
  ink: '#1A1A1F',             // 본문 텍스트
  coolGray: '#8E8E93',        // 보조 텍스트
  c7Gray: '#C7C7CC',          // arrow / placeholder
  mysticNavy: '#2D3A6B',      // DNA·CTA 텍스트, SKIN 영역 액센트
  rosePlum: '#5C2C3F',        // LOOK 영역 액센트

  // === BORDERS / DIVIDERS ===
  hairline: '#ECECEF',
  dividerSoft: '#F2F2F4',
  bgSubtle: '#F3EBED',        // avatar bg, recent thumb fallback

  // === SIGNATURE GRADIENT (모먼트 전용) ===
  signatureGradient: ['#FFD4DC', '#E4D4FF', '#D4E4FF'] as const, // 135°
  signatureGradientPair: ['#FFD4DC', '#E4D4FF'] as const, // 작은 액센트용 (strip 등)

  // === 8 BEAUTY TYPES (DNA) ===
  // 각 타입: gradient 페어 (135°)
  types: {
    GWS: { name: 'Honey Bloom',     kr: '허니 블룸',     gradient: ['#F5DDB5', '#FAEEDC'] as const, text: '#854F0B' },
    GWB: { name: 'Golden Glam',     kr: '골든 글램',     gradient: ['#E8C896', '#F0CFB0'] as const, text: '#854F0B' },
    GCS: { name: 'Icy Glow',        kr: '아이시 글로우', gradient: ['#D8E4F2', '#DCD4EC'] as const, text: '#2D3A6B' },
    GCB: { name: 'Crystal Edge',    kr: '크리스털 엣지', gradient: ['#C5CCE0', '#DBDEE5'] as const, text: '#2D3A6B' },
    MWS: { name: 'Velvet Peach',    kr: '벨벳 피치',     gradient: ['#F0C5B0', '#F5DCC8'] as const, text: '#993556' },
    MWB: { name: 'Terra Chic',      kr: '테라 시크',     gradient: ['#D89E92', '#D8B5AC'] as const, text: '#5C2C3F' },
    MCS: { name: 'Misty Rose',      kr: '미스티 로즈',   gradient: ['#E8C2CC', '#CFB5C2'] as const, text: '#5C2C3F' },
    MCB: { name: 'Moonlight Chic',  kr: '문라이트 시크', gradient: ['#BFB2CC', '#B0AEC0'] as const, text: '#534AB7' },
  },

  // === FUNCTIONAL (v1.1) ===
  functional: {
    dustyRose:  '#E2A8B5',    // 좋아요, 알림 점, 피해야 할 성분 액센트
    softSteel:  '#A3BAD5',    // 링크
    warmSand:   '#D4B59D',    // 경고
    sage:       '#B1C5AB',    // 성공 / ↑ 변화량
  },

  // === ELEMENT ACCENT (LOOK 탭 5요소별 라벨/아이콘) ===
  element: {
    base:   '#993556',
    eye:    '#2D3A6B',
    lip:    '#993556',
    cheek:  '#5C2C3F',
    brow:   '#534AB7',
  },

  // === CTA GLOW SHADOW (pill 버튼만) ===
  ctaGlowShadow: {
    shadowColor: '#E4D4FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6, // Android
  },
} as const;

// Type for beauty type codes
export type BeautyTypeCode = keyof typeof colors.types;
export type ElementCode = keyof typeof colors.element;

// Helpers
export const getTypeGradient = (code: BeautyTypeCode) => colors.types[code].gradient;
export const getTypeTextColor = (code: BeautyTypeCode) => colors.types[code].text;
export const getElementColor = (code: ElementCode) => colors.element[code];
