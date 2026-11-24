/**
 * SayMyName Design Tokens - Spacing, Radii, Motion & Geometry
 * Source: Document 10, Sections 10, 11 & 15 (THE INTERVAL)
 */

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
};

/**
 * Architectural precision geometry (Document 10: Pill/Capsule explicitly prohibited as default)
 */
export const radii = {
  none: '0px',
  tight: '4px',       // Inputs, compact controls, badges
  control: '8px',     // Buttons, menus, selection controls
  panel: '12px',      // Large content surfaces
  feature: '16px',    // Rare immersive surfaces
  // Legacy alias for compatibility (clamped to panel max)
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '14px',
  '2xl': '16px',
};

export const elevations = {
  none: 'none',
  1: '0 1px 3px rgba(0, 0, 0, 0.35)',
  2: '0 4px 12px rgba(0, 0, 0, 0.45)',
  3: '0 12px 28px rgba(0, 0, 0, 0.6)',
};

/**
 * Fast, tactile motion tokens (Document 10: Section 15)
 */
export const motion = {
  instant: '80ms',
  micro: '120ms',
  standard: '180ms',
  context: '260ms',
  signature: '340ms',
  easeEnter: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',
};
