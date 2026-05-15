/**
 * meve Design Tokens v1.5 — Single Import Point
 *
 * Usage:
 *   import { colors, typography, spacing, radius, motion } from '@/theme';
 */

export { colors, getTypeGradient, getTypeTextColor, getElementColor } from './colors';
export type { BeautyTypeCode, ElementCode } from './colors';

export { typography, fonts, fontFiles } from './typography';
export type { TypographyKey } from './typography';

export { spacing, radius, border } from './spacing';
export { motion } from './motion';
