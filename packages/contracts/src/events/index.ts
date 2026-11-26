/**
 * Standard WebSocket Event Envelope per Document 05 & Document 06 §12.2
 * Privacy-minimized: never includes raw message bodies, voice URLs, email, DOB, or internal IDs.
 */
export interface WebSocketEventEnvelope<T = unknown> {
  eventId: string;
  eventType:
    | 'connection.established'
    | 'conversation.subscribed'
    | 'conversation.unsubscribed'
    | 'message.created'
    | 'message.delivered'
    | 'conversation.updated'
    | 'conversation.closed'
    | 'call.invited'
    | 'call.accepted'
    | 'call.state_changed'
    | 'call.ended'
    | 'access.revoked'
    | 'authorization.failed'
    | 'pong';
  schemaVersion: 1;
  occurredAt: string;
  aggregate?: {
    type: 'conversation' | 'account' | 'session';
    id: string;
    version?: number;
  };
  data: T;
}

export interface MessageCreatedEventData {
  conversationId: string;
  messageId: string;
  sequenceNo: number;
  messageType: 'text' | 'voice_note';
  createdAt: string;
}

export interface MessageDeliveredEventData {
  conversationId: string;
  upToSequenceNo: number;
}

export interface ConversationClosedEventData {
  conversationId: string;
  matchId?: string;
  reason: 'connection_ended' | 'connection_unavailable';
}

export interface CallRealtimeEventData {
  callSessionId: string;
  conversationId: string;
  status:
    | 'inviting'
    | 'initiated'
    | 'ringing'
    | 'accepted'
    | 'connecting'
    | 'active'
    | 'reconnecting'
    | 'rejected'
    | 'ended'
    | 'missed'
    | 'failed';
  callType: 'audio';
  endedReason?: string | null;
  expiresAt?: string | null;
  occurredAt: string;
}

export interface MessageSendPayload {
  conversationId: string;
  clientAssignedUuid: string;
  messageType: 'text' | 'voice_note';
  bodyText?: string;
  mediaRefId?: string;
}

export interface MessageReceivedPayload {
  messageId: string;
  conversationId: string;
  sequenceNo: number;
  senderAccountId: string;
  messageType: 'text' | 'voice_note';
  bodyText?: string;
  mediaUrl?: string;
  deliveryState: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface CallInvitePayload {
  callSessionId: string;
  conversationId: string;
  callerId: string;
  callerName: string;
}

export interface CallActionPayload {
  callSessionId: string;
  action: 'accept' | 'decline' | 'hangup' | 'busy';
}

export interface GameMovePayload {
  gameSessionId: string;
  moveType: string;
  moveData: unknown;
}
