import { formatRelativeDayLabel } from '@saymyname/validation';
import type { MatchProfile } from './api';

export type MatchesEmptyKind = 'initial' | 'just_ended' | 'unavailable';

export function formatMatchDate(
  isoString?: string | null,
  referenceDate: Date = new Date(),
): string {
  if (!isoString) return 'Recently';
  return formatRelativeDayLabel(isoString, referenceDate);
}

export function removeMatchById(
  matches: MatchProfile[],
  matchId: string,
): MatchProfile[] {
  return matches.filter((m) => m.id !== matchId);
}

export function selectActiveMatch(
  matches: MatchProfile[],
  currentSelectedId: string | null,
  preferredId?: string | null,
): MatchProfile | null {
  if (matches.length === 0) return null;
  if (preferredId) {
    const preferred = matches.find((m) => m.id === preferredId);
    if (preferred) return preferred;
  }
  if (currentSelectedId) {
    const current = matches.find((m) => m.id === currentSelectedId);
    if (current) return current;
  }
  return matches[0];
}

export function filterMatchesByQuery(
  matches: MatchProfile[],
  query: string,
): MatchProfile[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return matches;
  return matches.filter((m) => {
    const name = m.candidate.displayName?.toLowerCase() || '';
    const city = m.candidate.locationCity?.toLowerCase() || '';
    const programme = m.candidate.programmeFamily?.toLowerCase() || '';
    return (
      name.includes(normalized) ||
      city.includes(normalized) ||
      programme.includes(normalized)
    );
  });
}

export function buildChatHrefForMatch(match: Pick<MatchProfile, 'id' | 'conversationId'>): string {
  const params = new URLSearchParams();
  params.set('matchId', match.id);
  if (match.conversationId) {
    params.set('conversationId', match.conversationId);
  }
  return `/chats?${params.toString()}`;
}

export function getUnmatchDialogContent(displayName: string) {
  return {
    title: `End connection with ${displayName}?`,
    description:
      'Unmatching will end this mutual connection and close the associated private conversation.',
    explanation:
      'This member will not be automatically blocked or reported. Private messaging and invitations for this match will end immediately.',
    cancelLabel: 'Keep Match',
    confirmLabel: 'Unmatch',
  };
}
