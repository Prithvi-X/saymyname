/**
 * SayMyName Design Tokens - Colors
 * Baseline: Warm Editorial Minimalism (Document 03, Section 3)
 */

export interface ColorTokens {
  canvas: string;
  surface: string;
  surfaceRaised?: string;
  surfaceSubtle: string;
  textPrimary: string;
  textSecondary: string;
  borderDefault: string;
  brandPrimary: string;
  brandPrimaryHover: string;
  brandPrimarySubtle: string;
  accentWarm: string;
  statusSuccess: string;
  statusWarning: string;
  statusDanger: string;
  statusInfo: string;
  focusRing: string;
}

export const lightColors: ColorTokens = {
  canvas: '#F7F4EF',
  surface: '#FFFEFC',
  surfaceSubtle: '#EFE9E1',
  textPrimary: '#25211F',
  textSecondary: '#6B625D',
  borderDefault: '#D6CEC6',
  brandPrimary: '#7A3045', // Deep berry
  brandPrimaryHover: '#65263A',
  brandPrimarySubtle: '#F3E6EA',
  accentWarm: '#A6533D', // Terracotta
  statusSuccess: '#286B55',
  statusWarning: '#81561C',
  statusDanger: '#A52F41',
  statusInfo: '#315E82',
  focusRing: '#315E82',
};

export const darkColors: ColorTokens = {
  canvas: '#171413',
  surface: '#211D1C',
  surfaceRaised: '#2C2624',
  surfaceSubtle: '#302927',
  textPrimary: '#F4EEEA',
  textSecondary: '#C2B7B0',
  borderDefault: '#4A403D',
  brandPrimary: '#E7A0B2', // Rose berry
  brandPrimaryHover: '#F0BCC8',
  brandPrimarySubtle: '#3B232B',
  accentWarm: '#E1A08B', // Soft terracotta
  statusSuccess: '#7FCCAA',
  statusWarning: '#F0C17A',
  statusDanger: '#F19BA7',
  statusInfo: '#98C6EC',
  focusRing: '#98C6EC',
};
