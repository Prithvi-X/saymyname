import type { DiscoveryCandidate, DiscoveryFeedResponse, ReportCategory } from './api';

export const PROGRAMME_LABELS: Record<string, string> = {
  data_science_applications: 'BS in Data Science and Applications',
  electronic_systems: 'BS in Electronic Systems',
  aeronautics_space: 'BS in Aeronautics and Space Technology',
  management_data_science: 'BS in Management and Data Science',
};

export const INTENTION_LABELS: Record<string, string> = {
  serious_relationship: 'Long-term relationship',
  long_term: 'Long-term connection',
  meaningful_dating: 'Intentional dating',
  getting_to_know: 'Getting to know someone',
  friendship_first: 'Connection & friendship first',
};

export const REPORT_CATEGORY_OPTIONS: {
  value: ReportCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'harassment',
    label: 'Harassment or disrespectful behaviour',
    description: 'Pressuring, abusive, or intimidating conduct.',
  },
  {
    value: 'fake_profile',
    label: 'Fake or impersonation profile',
    description: 'Suspected impersonation, non-genuine photos, or misleading identity.',
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate profile content',
    description: 'Explicit imagery, harmful bio text, or guideline violation.',
  },
  {
    value: 'underage_suspected',
    label: 'Suspected minor (under 18)',
    description: 'Urgent safety escalation for suspected underage account.',
  },
  {
    value: 'spam',
    label: 'Spam or commercial solicitation',
    description: 'Promotional links, external handles harvesting, or scam attempts.',
  },
  {
    value: 'offline_safety',
    label: 'Offline safety concern',
    description: 'Credible threat or unsafe real-world behaviour.',
  },
];

export function formatProgrammeLabel(programmeFamily?: string | null): string {
  if (!programmeFamily) return 'IITM BS Peer';
  return PROGRAMME_LABELS[programmeFamily] || programmeFamily;
}

export function formatIntentionLabel(intention?: string | null): string | null {
  if (!intention || !intention.trim()) return null;
  const key = intention.trim();
  if (INTENTION_LABELS[key]) return INTENTION_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Formats candidate heading safely while respecting ageDisplayMode = 'hidden'.
 * Never renders 'null', 'undefined', or DOB strings.
 */
export function formatCandidateHeading(
  displayName: string,
  age: number | null | undefined,
): string {
  const safeName = displayName?.trim() || 'Verified Peer';
  if (typeof age === 'number' && Number.isFinite(age) && age >= 18) {
    return `${safeName}, ${Math.floor(age)}`;
  }
  return safeName;
}

/**
 * Formats optional self-declared coarse city/state context only.
 * Never formats or implies GPS distances or coordinates.
 */
export function formatCoarseLocation(
  city?: string | null,
  state?: string | null,
): string | null {
  const cleanCity = city?.trim();
  const cleanState = state?.trim();
  if (cleanCity && cleanState) return `${cleanCity}, ${cleanState}`;
  if (cleanCity) return cleanCity;
  if (cleanState) return cleanState;
  return null;
}

export function mergeFeedBatch(
  existing: DiscoveryCandidate[],
  incoming: DiscoveryFeedResponse,
): DiscoveryCandidate[] {
  const seen = new Set(existing.map((c) => c.profileId));
  const merged = [...existing];
  for (const item of incoming.candidates) {
    if (!seen.has(item.profileId)) {
      seen.add(item.profileId);
      merged.push(item);
    }
  }
  return merged;
}

export function removeCandidateById(
  queue: DiscoveryCandidate[],
  profileId: string,
): DiscoveryCandidate[] {
  return queue.filter((c) => c.profileId !== profileId);
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'SM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
