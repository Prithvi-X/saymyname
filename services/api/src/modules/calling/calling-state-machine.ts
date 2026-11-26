import { ConflictException } from '@nestjs/common';

export type CanonicalCallStatus =
  | 'inviting'
  | 'initiated'
  | 'ringing'
  | 'accepted'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'rejected'
  | 'missed'
  | 'failed';

export const TERMINAL_CALL_STATUSES: ReadonlySet<CanonicalCallStatus> = new Set([
  'ended',
  'rejected',
  'missed',
  'failed',
]);

export const NON_TERMINAL_CALL_STATUSES: ReadonlySet<CanonicalCallStatus> = new Set([
  'inviting',
  'initiated',
  'ringing',
  'accepted',
  'connecting',
  'active',
  'reconnecting',
]);

export const JOINABLE_CALL_STATUSES: ReadonlySet<CanonicalCallStatus> = new Set([
  'accepted',
  'connecting',
  'active',
  'reconnecting',
]);

const ALLOWED_TRANSITIONS: Record<CanonicalCallStatus, ReadonlyArray<CanonicalCallStatus>> = {
  inviting: ['ringing', 'accepted', 'rejected', 'ended', 'missed', 'failed'],
  initiated: ['ringing', 'accepted', 'rejected', 'ended', 'missed', 'failed'],
  ringing: ['accepted', 'rejected', 'ended', 'missed', 'failed'],
  accepted: ['connecting', 'active', 'reconnecting', 'ended', 'failed'],
  connecting: ['active', 'reconnecting', 'ended', 'failed'],
  active: ['reconnecting', 'ended', 'failed'],
  reconnecting: ['connecting', 'active', 'ended', 'failed'],
  ended: [],
  rejected: [],
  missed: [],
  failed: [],
};

export function normalizeCallStatus(raw: string | null | undefined): CanonicalCallStatus {
  const s = String(raw || '').trim().toLowerCase() as CanonicalCallStatus;
  if (s in ALLOWED_TRANSITIONS) {
    return s;
  }
  return 'failed';
}

export function isTerminalCallStatus(status: string | null | undefined): boolean {
  return TERMINAL_CALL_STATUSES.has(normalizeCallStatus(status));
}

export function isNonTerminalCallStatus(status: string | null | undefined): boolean {
  return NON_TERMINAL_CALL_STATUSES.has(normalizeCallStatus(status));
}

export function isJoinableCallStatus(status: string | null | undefined): boolean {
  return JOINABLE_CALL_STATUSES.has(normalizeCallStatus(status));
}

export function canTransitionCallStatus(
  fromStatus: string | null | undefined,
  toStatus: CanonicalCallStatus,
): boolean {
  const normalizedFrom = normalizeCallStatus(fromStatus);
  if (normalizedFrom === toStatus) {
    return true;
  }
  return ALLOWED_TRANSITIONS[normalizedFrom].includes(toStatus);
}

export function assertCallStatusTransition(
  fromStatus: string | null | undefined,
  toStatus: CanonicalCallStatus,
  contextMessage?: string,
): void {
  const normalizedFrom = normalizeCallStatus(fromStatus);
  if (!canTransitionCallStatus(normalizedFrom, toStatus)) {
    throw new ConflictException(
      contextMessage ||
        `Call session cannot transition from '${normalizedFrom}' to '${toStatus}'.`,
    );
  }
}
