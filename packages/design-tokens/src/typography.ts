/**
 * SayMyName Design Tokens - Typography
 * Baseline: Newsreader (Display Serif) + DM Sans (Interface Sans) (Document 03, Section 4)
 */

export const fontFamilies = {
  display: 'Newsreader, Georgia, serif',
  body: 'DM Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export interface TypographyStyle {
  fontSize: string;
  lineHeight: string;
  fontWeight: number | string;
  fontFamily: string;
  letterSpacing?: string;
}

export const typeScale: Record<string, TypographyStyle> = {
  displayLg: {
    fontSize: '48px',
    lineHeight: '54px',
    fontWeight: 400,
    fontFamily: fontFamilies.display,
  },
  displayMd: {
    fontSize: '40px',
    lineHeight: '46px',
    fontWeight: 400,
    fontFamily: fontFamilies.display,
  },
  heading1: {
    fontSize: '32px',
    lineHeight: '38px',
    fontWeight: 700,
    fontFamily: fontFamilies.body,
  },
  heading2: {
    fontSize: '24px',
    lineHeight: '30px',
    fontWeight: 700,
    fontFamily: fontFamilies.body,
  },
  heading3: {
    fontSize: '20px',
    lineHeight: '26px',
    fontWeight: 600,
    fontFamily: fontFamilies.body,
  },
  heading4: {
    fontSize: '18px',
    lineHeight: '24px',
    fontWeight: 600,
    fontFamily: fontFamilies.body,
  },
  bodyLg: {
    fontSize: '18px',
    lineHeight: '28px',
    fontWeight: 400,
    fontFamily: fontFamilies.body,
  },
  bodyMd: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
    fontFamily: fontFamilies.body,
  },
  bodySm: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 400,
    fontFamily: fontFamilies.body,
  },
  labelMd: {
    fontSize: '14px',
    lineHeight: '18px',
    fontWeight: 600,
    fontFamily: fontFamilies.body,
  },
  meta: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 500,
    fontFamily: fontFamilies.body,
  },
};
