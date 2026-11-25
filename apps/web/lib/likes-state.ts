import { formatRelativeDayLabel } from '@saymyname/validation';
import type { SentLikeItem } from './api';

export function mergePaginatedByLikeId<T extends { likeId: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const seen = new Set(existing.map((item) => item.likeId));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.likeId)) {
      seen.add(item.likeId);
      merged.push(item);
    }
  }
  return merged;
}

export function removeLikeById<T extends { likeId: string }>(
  items: T[],
  likeId: string,
): T[] {
  return items.filter((item) => item.likeId !== likeId);
}

export function markSentLikeWithdrawn(
  items: SentLikeItem[],
  likeId: string,
  updatedAtIso: string = new Date().toISOString(),
): SentLikeItem[] {
  return items.map((item) =>
    item.likeId === likeId
      ? {
          ...item,
          status: 'withdrawn',
          availability: 'withdrawn',
          statusLabel: 'Withdrawn',
          canWithdraw: false,
          updatedAt: updatedAtIso,
        }
      : item,
  );
}

export function formatLikesDateLabel(
  isoString: string,
  referenceDate: Date = new Date(),
): string {
  return formatRelativeDayLabel(isoString, referenceDate);
}

export function getSentLikeStatusMeta(item: SentLikeItem): {
  label: string;
  badgeVariant: 'accent' | 'warning' | 'neutral';
  helperCopy: string;
} {
  if (item.availability === 'withdrawn') {
    return {
      label: 'Withdrawn',
      badgeVariant: 'neutral',
      helperCopy: 'You retracted this like privately before any match formed.',
    };
  }
  if (item.availability === 'unavailable') {
    return {
      label: 'Profile unavailable',
      badgeVariant: 'warning',
      helperCopy: 'This member is not currently active in discovery.',
    };
  }
  return {
    label: 'Awaiting response',
    badgeVariant: 'accent',
    helperCopy: 'Visible privately. You may withdraw anytime before a match forms.',
  };
}
