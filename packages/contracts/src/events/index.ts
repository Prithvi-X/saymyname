/**
 * Standard WebSocket Event Envelope per Document 05 & 06
 */
export interface WebSocketEventEnvelope<T = unknown> {
  event: string;
  traceId: string;
  timestamp: string;
  payload: T;
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
