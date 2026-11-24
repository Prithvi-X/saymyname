/**
 * SayMyName Design Tokens - Typography (Contemporary Neo-Grotesk)
 * Source: Document 10, Section 09 (Instrument Sans)
 */

export const fontFamilies = {
  ui: '"Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  body: '"Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  display: '"Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"SF Mono", Menlo, Consolas, Monaco, monospace',
};

export interface TypographyStyle {
  fontSize: string;
  lineHeight: string;
  fontWeight: number | string;
  fontFamily: string;
  letterSpacing?: string;
}

export const typeScale: Record<string, TypographyStyle> = {
  displayHero: {
    fontSize: '68px',
    lineHeight: '0.98',
    fontWeight: 700,
    fontFamily: fontFamilies.ui,
    letterSpacing: '-0.03em',
  },
  displayHeroMobile: {
    fontSize: '44px',
    lineHeight: '1.0',
    fontWeight: 700,
    fontFamily: fontFamilies.ui,
    letterSpacing: '-0.025em',
  },
  pageHeading: {
    fontSize: '42px',
    lineHeight: '1.05',
    fontWeight: 650,
    fontFamily: fontFamilies.ui,
    letterSpacing: '-0.02em',
  },
  pageHeadingMobile: {
    fontSize: '34px',
    lineHeight: '1.08',
    fontWeight: 650,
    fontFamily: fontFamilies.ui,
    letterSpacing: '-0.02em',
  },
  sectionHeading: {
    fontSize: '28px',
    lineHeight: '1.12',
    fontWeight: 600,
    fontFamily: fontFamilies.ui,
    letterSpacing: '-0.015em',
  },
  cardTitle: {
    fontSize: '24px',
    lineHeight: '1.15',
    fontWeight: 600,
    fontFamily: fontFamilies.ui,
    letterSpacing: '-0.01em',
  },
  body: {
    fontSize: '16px',
    lineHeight: '1.5',
    fontWeight: 400,
    fontFamily: fontFamilies.ui,
  },
  bodySecondary: {
    fontSize: '14px',
    lineHeight: '1.45',
    fontWeight: 450,
    fontFamily: fontFamilies.ui,
  },
  metadata: {
    fontSize: '12px',
    lineHeight: '1.35',
    fontWeight: 500,
    fontFamily: fontFamilies.ui,
    letterSpacing: '0.01em',
  },
};
