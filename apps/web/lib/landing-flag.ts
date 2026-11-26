/**
 * Phase 3 Editorial Romance Landing Page Feature Flag Helper.
 * Strictly opt-in (`LANDING_PAGE_EDITORIAL_ENABLED === 'true'`).
 * Unset, empty, 'false', '1', or mixed-case values keep the legacy homepage active.
 */
export function isEditorialLandingEnabled(
  rawValue: string | undefined = process.env.LANDING_PAGE_EDITORIAL_ENABLED,
): boolean {
  return rawValue === 'true';
}
