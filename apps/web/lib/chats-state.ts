import { formatRelativeDayLabel } from '@saymyname/validation';
import type { ChatMessage, ConversationListItem } from './api';

export interface TextLinkSegment {
  type: 'text' | 'link';
  content: string;
  href?: string;
}

const URL_SPLIT_REGEX = /(https?:\/\/[^\s<>"'`]+)/gi;
const DRAFT_PREFIX = 'smn_msg_draft_v1:';

export function extractSafeUrlsAndSegments(text: string): TextLinkSegment[] {
  if (!text) return [];
  const parts = text.split(URL_SPLIT_REGEX);
  const segments: TextLinkSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (/^https?:\/\//i.test(part)) {
      try {
        const parsed = new URL(part);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          segments.push({ type: 'link', content: part, href: parsed.toString() });
          continue;
        }
      } catch {
        // Fall through to plain text if invalid URL syntax
      }
    }
    segments.push({ type: 'text', content: part });
  }
  return segments;
}

export function sortMessagesChronologically(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort((a, b) => {
    const seqA = Number(a.sequenceNo || 0);
    const seqB = Number(b.sequenceNo || 0);
    if (seqA !== seqB) return seqA - seqB;
    const tA = new Date(a.createdAtIso || a.createdAt || 0).getTime();
    const tB = new Date(b.createdAtIso || b.createdAt || 0).getTime();
    if (tA !== tB) return tA - tB;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function mergeChronologicalMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const byClientUuid = new Map<string, string>();

  for (const msg of existing) {
    byId.set(msg.id, msg);
    if (msg.clientAssignedUuid) {
      byClientUuid.set(msg.clientAssignedUuid, msg.id);
    }
  }

  for (const inc of incoming) {
    if (inc.clientAssignedUuid && byClientUuid.has(inc.clientAssignedUuid)) {
      const prevId = byClientUuid.get(inc.clientAssignedUuid)!;
      if (prevId !== inc.id) {
        byId.delete(prevId);
      }
    }
    const existingItem = byId.get(inc.id);
    byId.set(inc.id, existingItem ? { ...existingItem, ...inc } : inc);
    if (inc.clientAssignedUuid) {
      byClientUuid.set(inc.clientAssignedUuid, inc.id);
    }
  }

  return sortMessagesChronologically(Array.from(byId.values()));
}

export function markMessagesDeliveredUpTo(
  messages: ChatMessage[],
  upToSequenceNo: number,
): ChatMessage[] {
  let changed = false;
  const updated = messages.map((m) => {
    if (
      m.isOwn &&
      typeof m.sequenceNo === 'number' &&
      m.sequenceNo <= upToSequenceNo &&
      m.deliveryState === 'sent'
    ) {
      changed = true;
      return { ...m, deliveryState: 'delivered' as const };
    }
    return m;
  });
  return changed ? updated : messages;
}

export function sortConversationsDeterministically(
  items: ConversationListItem[],
): ConversationListItem[] {
  return [...items].sort((a, b) => {
    const tA = new Date(a.lastMessageAt || a.matchedAt || 0).getTime();
    const tB = new Date(b.lastMessageAt || b.matchedAt || 0).getTime();
    const safeA = Number.isNaN(tA) ? 0 : tA;
    const safeB = Number.isNaN(tB) ? 0 : tB;
    if (safeB !== safeA) return safeB - safeA;
    return b.conversationId.localeCompare(a.conversationId);
  });
}

export function filterConversationsByQuery(
  items: ConversationListItem[],
  query: string,
): ConversationListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const name = item.profile.displayName?.toLowerCase() || '';
    const prog = item.profile.programmeFamily?.toLowerCase() || '';
    const city = item.profile.locationCity?.toLowerCase() || '';
    const preview = item.lastMessage?.previewText?.toLowerCase() || '';
    return (
      name.includes(q) || prog.includes(q) || city.includes(q) || preview.includes(q)
    );
  });
}

export function getCalendarDayKey(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getMessageDateSeparatorLabel(
  isoString: string,
  referenceDate: Date = new Date(),
): string {
  return formatRelativeDayLabel(isoString, referenceDate);
}

export function shouldGroupWithPrevious(
  prev: ChatMessage | undefined,
  curr: ChatMessage,
): boolean {
  if (!prev) return false;
  if (prev.isOwn !== curr.isOwn) return false;
  const prevIso = prev.createdAtIso || prev.createdAt;
  const currIso = curr.createdAtIso || curr.createdAt;
  if (getCalendarDayKey(prevIso) !== getCalendarDayKey(currIso)) return false;
  const diffMs = new Date(currIso).getTime() - new Date(prevIso).getTime();
  return Number.isFinite(diffMs) && diffMs >= 0 && diffMs <= 5 * 60 * 1000;
}

export function formatVoiceDuration(seconds?: number | null): string {
  const safe = Math.max(0, Math.round(Number(seconds || 0)));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function selectSupportedAudioRecordingMime(
  isTypeSupported?: (mime: string) => boolean,
): { mimeType: string; baseMime: string; extension: string } | null {
  const checker =
    isTypeSupported ||
    (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      ? (m: string) => MediaRecorder.isTypeSupported(m)
      : null);
  if (!checker) return null;

  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', baseMime: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/webm', baseMime: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', baseMime: 'audio/ogg', extension: 'ogg' },
    { mimeType: 'audio/ogg', baseMime: 'audio/ogg', extension: 'ogg' },
    { mimeType: 'audio/mp4', baseMime: 'audio/mp4', extension: 'm4a' },
  ];

  for (const candidate of candidates) {
    try {
      if (checker(candidate.mimeType)) {
        return candidate;
      }
    } catch {
      // Try next supported codec cleanly
    }
  }
  return null;
}

export function readConversationDraft(conversationId: string): string {
  if (typeof window === 'undefined' || !conversationId) return '';
  try {
    return window.localStorage.getItem(`${DRAFT_PREFIX}${conversationId}`) || '';
  } catch {
    return '';
  }
}

export function saveConversationDraft(conversationId: string, text: string): void {
  if (typeof window === 'undefined' || !conversationId) return;
  try {
    if (!text) {
      window.localStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`);
    } else {
      window.localStorage.setItem(`${DRAFT_PREFIX}${conversationId}`, text.slice(0, 1000));
    }
  } catch {
    // Ignore storage quota issues cleanly
  }
}

export function clearConversationDraft(conversationId: string): void {
  if (typeof window === 'undefined' || !conversationId) return;
  try {
    window.localStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`);
  } catch {}
}

export function clearAllConversationDrafts(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {}
}
