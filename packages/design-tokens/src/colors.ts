/**
 * SayMyName Design Tokens - Colors
 * Baseline: Warm Editorial Minimalism with Understated Authority (Document 03)
 */

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

export const lightColors: ColorTokens = {
  canvas: '#F7F4EF',
  surface: '#FFFEFB',
  surfaceRaised: '#FFFFFF',
  surfaceSubtle: '#EDE7DF',
  surfaceMuted: '#E4DCD2',
  textPrimary: '#1E1A18',
  textSecondary: '#655C56',
  textMuted: '#887E77',
  borderDefault: '#D8D1C7',
  borderSubtle: '#E8E2D9',
  borderStrong: '#B8ADA1',
  brandPrimary: '#6E2638', // Deep oxblood / wine
  brandPrimaryHover: '#5A1D2D',
  brandPrimarySubtle: '#F4E8EB',
  brandPrimaryTint: '#FAF2F4',
  accentWarm: '#A34C38', // Mineral terracotta
  accentWarmSubtle: '#FAEEEB',
  statusSuccess: '#246550',
  statusSuccessSubtle: '#E8F3EE',
  statusWarning: '#855218',
  statusWarningSubtle: '#FBF4E8',
  statusDanger: '#9B2838',
  statusDangerSubtle: '#FBEBED',
  statusInfo: '#2B577A',
  statusInfoSubtle: '#EBF2F8',
  focusRing: '#6E2638',
};

export const darkColors: ColorTokens = {
  canvas: '#141211',
  surface: '#1E1A18',
  surfaceRaised: '#282321',
  surfaceSubtle: '#2C2624',
  surfaceMuted: '#38312E',
  textPrimary: '#F5EFEB',
  textSecondary: '#C4B9B2',
  textMuted: '#8E837C',
  borderDefault: '#423A36',
  borderSubtle: '#332C28',
  borderStrong: '#5C524C',
  brandPrimary: '#E59BAE',
  brandPrimaryHover: '#F2B4C3',
  brandPrimarySubtle: '#381E25',
  brandPrimaryTint: '#2A171C',
  accentWarm: '#E29C87',
  accentWarmSubtle: '#3A231C',
  statusSuccess: '#78C7A3',
  statusSuccessSubtle: '#193127',
  statusWarning: '#ECC078',
  statusWarningSubtle: '#382914',
  statusDanger: '#EE93A1',
  statusDangerSubtle: '#3B1B20',
  statusInfo: '#95C3EA',
  statusInfoSubtle: '#192D3D',
  focusRing: '#95C3EA',
};
