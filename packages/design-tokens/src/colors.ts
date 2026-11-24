/**
 * SayMyName Design Tokens - Colors (Mineral Night)
 * Source: Document 10 (Brand Identity & Digital Design Language - THE INTERVAL)
 * Supersedes Document 03 Warm Editorial Minimalism
 */

export interface MineralNightTokens {
  void: string;        // #0B0D10 - Primary page stage
  coal: string;        // #12161B - Main application surface
  iron: string;        // #1A2027 - Raised surface / panels
  slate: string;       // #252D37 - Selected surface / active area
  edge: string;        // #343D48 - Borders and separators
  chalk: string;       // #F0F1EE - Primary text (17.16:1 contrast on Void)
  silver: string;      // #B6BDC4 - Secondary text (10.25:1 contrast on Void)
  ash: string;         // #8B949E - Tertiary text / metadata (6.33:1 contrast on Void)
  iris: string;        // #8580C4 - Primary brand signal (5.09:1 on Coal)
  ember: string;       // #E18A62 - Secondary signal / warmth (6.93:1 on Coal)
  success: string;     // #77C5A1 - Semantic success
  warning: string;     // #E6BC69 - Semantic warning
  danger: string;      // #F07878 - Critical / destructive
}

export const mineralNightColors: MineralNightTokens = {
  void: '#0B0D10',
  coal: '#12161B',
  iron: '#1A2027',
  slate: '#252D37',
  edge: '#343D48',
  chalk: '#F0F1EE',
  silver: '#B6BDC4',
  ash: '#8B949E',
  iris: '#8580C4',
  ember: '#E18A62',
  success: '#77C5A1',
  warning: '#E6BC69',
  danger: '#F07878',
};

export interface ColorTokens {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceSubtle: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderDefault: string;
  borderSubtle: string;
  borderStrong: string;
  brandPrimary: string;
  brandPrimaryHover: string;
  brandPrimarySubtle: string;
  brandPrimaryTint: string;
  accentWarm: string;
  accentWarmSubtle: string;
  statusSuccess: string;
  statusSuccessSubtle: string;
  statusWarning: string;
  statusWarningSubtle: string;
  statusDanger: string;
  statusDangerSubtle: string;
  statusInfo: string;
  statusInfoSubtle: string;
  focusRing: string;
}

/**
 * Primary dark cinematic theme (Document 10: Mineral Night)
 */
export const darkColors: ColorTokens = {
  canvas: mineralNightColors.void,
  surface: mineralNightColors.coal,
  surfaceRaised: mineralNightColors.iron,
  surfaceSubtle: mineralNightColors.iron,
  surfaceMuted: mineralNightColors.slate,
  textPrimary: mineralNightColors.chalk,
  textSecondary: mineralNightColors.silver,
  textMuted: mineralNightColors.ash,
  borderDefault: mineralNightColors.edge,
  borderSubtle: '#222831',
  borderStrong: '#4B5563',
  brandPrimary: mineralNightColors.iris,
  brandPrimaryHover: '#9894D1',
  brandPrimarySubtle: '#1C1C2E',
  brandPrimaryTint: '#27263E',
  accentWarm: mineralNightColors.ember,
  accentWarmSubtle: '#2D1F18',
  statusSuccess: mineralNightColors.success,
  statusSuccessSubtle: '#13281E',
  statusWarning: mineralNightColors.warning,
  statusWarningSubtle: '#2E2412',
  statusDanger: mineralNightColors.danger,
  statusDangerSubtle: '#301618',
  statusInfo: mineralNightColors.iris,
  statusInfoSubtle: '#1C1C2E',
  focusRing: mineralNightColors.iris,
};

// Aliased as default theme for SayMyName
export const lightColors = darkColors;
