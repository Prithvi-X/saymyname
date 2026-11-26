import {
  ProgrammeFamily,
  AccountStatus,
  VerificationStatus,
  PathwayCode,
  ProfileStatus,
  VerificationCheckType,
  AccountLifecycleState,
  MatchStatus,
  MessageType,
  DeliveryState,
  CallStatus,
  GameSessionStatus,
  VirtualDateStatus,
  RelationshipProposalStatus,
  ActivityType,
} from '../enums';

export interface AccountDto {
  id: string;
  email: string;
  accountStatus: AccountStatus;
  emailVerifiedAt?: string | null;
  displayName?: string | null;
  createdAt: string;
}

export interface AccountEligibilityDto {
  accountId: string;
  ageStatus: VerificationStatus;
  studentStatus: VerificationStatus;
  programmeFamily?: ProgrammeFamily | null;
  pathwayCode?: PathwayCode | string | null;
  discoveryEligible: boolean;
  ageVerifiedAt?: string | null;
  studentVerifiedAt?: string | null;
  validUntil?: string | null;
  verifiedAt?: string | null;
}

export interface VerificationCaseDto {
  id: string;
  checkType: VerificationCheckType | string;
  providerCode: string;
  status: VerificationStatus | string;
  reasonCode?: string | null;
  rejectionReason?: string | null;
  submittedAt: string;
  decidedAt?: string | null;
  evidenceCount?: number;
}

export interface SafeAccountMeDto {
  id: string;
  email: string;
  displayName: string | null;
  accountStatus: AccountStatus | string;
  emailVerified: boolean;
  hasPassword: boolean;
  lifecycleState: AccountLifecycleState;
  eligibility: AccountEligibilityDto | null;
  profile: ProfileDto | null;
}

export interface ProfileDto {
  id: string;
  accountId: string;
  displayName: string;
  bio?: string | null;
  programmeFamily: ProgrammeFamily;
  termOrYear?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  intention?: string | null;
  profileStatus?: ProfileStatus | string;
  ageDisplayMode?: 'hidden' | 'show_calculated_age' | string;
  publishedAt?: string | null;
  consentAcceptedAt?: string | null;
  isPublished: boolean;
  isPaused?: boolean;
  photos: ProfilePhotoDto[];
  interests: string[];
  promptAnswers: ProfilePromptAnswerDto[];
}

export interface ProfilePhotoDto {
  id: string;
  photoUrl?: string | null;
  displayOrder: number;
  isPrimary: boolean;
  moderationStatus?: string;
}

export interface ProfilePromptAnswerDto {
  id: string;
  promptId: string;
  promptText: string;
  answerText: string;
}

export interface PublicProfileDto {
  id: string;
  displayName: string;
  age?: number | null;
  programmeFamily: ProgrammeFamily;
  termOrYear?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  intention?: string | null;
  bio?: string | null;
  photos: ProfilePhotoDto[];
  interests: string[];
  promptAnswers: ProfilePromptAnswerDto[];
  isVerified: boolean;
}

export interface DatingPreferencesDto {
  minAge: number;
  maxAge: number;
  allowedProgrammes: string[];
  maxDistanceKm?: number | null;
  showInDiscovery: boolean;
}

export interface PhotoReorderDto {
  photoIds: string[];
}

export interface DiscoveryCandidatePhotoDto {
  id: string;
  photoUrl: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface DiscoveryCandidatePromptDto {
  id?: string;
  promptId?: string;
  promptText: string;
  answerText: string;
}

export interface DiscoveryCandidateDto {
  profileId: string;
  displayName: string;
  age: number | null;
  ageVisible?: boolean;
  programmeFamily: ProgrammeFamily;
  termOrYear?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  intention?: string | null;
  bio?: string | null;
  photos: DiscoveryCandidatePhotoDto[];
  interests: string[];
  promptAnswers: DiscoveryCandidatePromptDto[];
  isVerified?: boolean;
  sharedInterests?: string[];
}

export interface DiscoveryFeedResponseDto {
  candidates: DiscoveryCandidateDto[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
  pageSize: number;
  viewerState: 'ready' | 'paused' | 'profile_incomplete';
  preferencesApplied?: {
    minAge: number;
    maxAge: number;
    allowedProgrammes: string[];
    dormantDistanceIgnored: boolean;
  };
}

export interface LikeResponseDto {
  likeId: string;
  isMutualMatch: boolean;
  matchId?: string | null;
  conversationId?: string | null;
  message?: string;
  matchedProfile?: {
    profileId: string;
    displayName: string;
    programmeFamily: ProgrammeFamily;
    primaryPhotoUrl?: string | null;
  } | null;
}

export interface ReceivedLikeItemDto {
  likeId: string;
  profileId: string;
  likedAt: string;
  profile: DiscoveryCandidateDto;
}

export interface ReceivedLikesResponseDto {
  items: ReceivedLikeItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
  totalActiveCount: number;
  pageSize: number;
  viewerState: 'ready' | 'paused' | 'profile_incomplete';
}

export type SentLikeAvailability = 'pending' | 'unavailable' | 'withdrawn';

export interface SentLikeRecipientPreviewDto {
  profileId: string | null;
  displayName: string;
  age: number | null;
  ageVisible: boolean;
  programmeFamily: ProgrammeFamily | null;
  currentTerm?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  intention?: string | null;
  bio?: string | null;
  photos: DiscoveryCandidatePhotoDto[];
  interests: string[];
  promptAnswers: DiscoveryCandidatePromptDto[];
  isVerified?: boolean;
}

export interface SentLikeItemDto {
  likeId: string;
  status: string;
  availability: SentLikeAvailability;
  statusLabel: string;
  canWithdraw: boolean;
  sentAt: string;
  updatedAt: string;
  profile: SentLikeRecipientPreviewDto;
}

export interface SentLikesResponseDto {
  items: SentLikeItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
  totalActiveCount: number;
  pageSize: number;
  viewerState: 'ready' | 'paused' | 'profile_incomplete';
}

export interface WithdrawLikeResponseDto {
  likeId: string;
  status: string;
  withdrawn: boolean;
  alreadyWithdrawn: boolean;
  message: string;
}

export interface MatchDto {
  id: string;
  userLowId: string;
  userHighId: string;
  status: MatchStatus;
  createdAt: string;
  endedAt?: string | null;
}

export interface MatchSummaryDto {
  matchId: string;
  conversationId: string | null;
  status: MatchStatus | 'active' | 'ended';
  matchedAt: string;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  lastMessageIsOwn?: boolean | null;
  profile: DiscoveryCandidateDto;
}

export interface UnmatchResponseDto {
  matchId: string;
  status: 'ended';
  alreadyEnded: boolean;
  message: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  sequenceNo: number;
  senderAccountId: string;
  messageType: MessageType;
  bodyText?: string | null;
  mediaUrl?: string | null;
  durationSeconds?: number | null;
  deliveryState: DeliveryState;
  createdAt: string;
}

export interface SanitizedChatMessageDto {
  id: string;
  conversationId: string;
  sequenceNo: number;
  senderName: string;
  isOwn: boolean;
  messageType: MessageType | 'text' | 'voice_note';
  bodyText: string | null;
  mediaId?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  deliveryState: 'sent' | 'delivered';
  createdAt: string;
  clientAssignedUuid?: string | null;
}

export interface MessagesHistoryResponseDto {
  messages: SanitizedChatMessageDto[];
  nextCursor: string | null;
  hasOlder: boolean;
  latestSequenceNo: number;
  ownLastReadSeq: number;
  conversationStatus: 'active' | 'closed';
}

export interface ConversationSummaryDto {
  conversationId: string;
  matchId: string;
  matchedAt: string;
  lastMessageAt: string | null;
  lastMessage: {
    id: string;
    sequenceNo: number;
    messageType: MessageType | 'text' | 'voice_note';
    previewText: string;
    isOwn: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  latestSequenceNo: number;
  ownLastReadSeq: number;
  profile: DiscoveryCandidateDto;
}

export interface MessagingVoiceNotePresignResponseDto {
  uploadUrl: string | null;
  adapterMode: 'r2_presigned_put' | 'local_stub_non_prod';
  mediaRefId: string;
  uploadToken: string;
  expiresInSeconds: number;
  maxBytes: number;
  maxDurationSeconds: number;
}

export interface MessagingRealtimeTicketDto {
  ticket: string;
  wsPath: string;
  expiresInSeconds: number;
}

export interface CallSessionDto {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  callStatus: CallStatus;
  livekitRoomId: string;
  callType?: 'audio';
  startedAt?: string | null;
  expiresAt?: string | null;
  endedAt?: string | null;
  endedReason?: string | null;
  durationSeconds?: number | null;
  evictionStatus?: string | null;
}

export interface CallInviteRequestDto {
  conversationId: string;
}

export interface CallInviteResponseDto {
  callSession: CallSessionDto;
  expiresAt: string;
}

export interface CallRespondRequestDto {
  action: 'accept' | 'decline' | 'busy' | 'cancel';
}

export interface CallStateTransitionRequestDto {
  state: 'ringing' | 'connecting' | 'active' | 'reconnecting';
}

export interface CallTokenResponseDto {
  callSessionId: string;
  livekitRoomId: string;
  token: string;
  callStatus: CallStatus;
  livekitUrl?: string;
  expiresAt?: string;
  participantIdentity?: string;
}

export interface GameCatalogItemDto {
  id: string;
  gameKey: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isActive: boolean;
}

export interface GameInviteRequestDto {
  conversationId: string;
  gameKey: string;
}

export interface GameRespondRequestDto {
  action: 'accept' | 'decline';
}

export interface GameMoveRequestDto {
  moveType: string;
  moveData: Record<string, unknown>;
}

export interface GameSessionMemberDto {
  accountId: string;
  role: string;
  score: number;
}

export interface GameSessionDto {
  id: string;
  conversationId: string;
  gameKey: string;
  title: string;
  sessionStatus: GameSessionStatus;
  currentState: Record<string, unknown>;
  winnerAccountId?: string | null;
  invitedByAccountId?: string | null;
  members?: GameSessionMemberDto[];
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface VirtualDateProposeRequestDto {
  conversationId: string;
  scheduledFor: string;
  timezone: string;
  activityType: ActivityType | string;
  proposalNotes?: string;
}

export interface VirtualDateRespondRequestDto {
  action: 'accept' | 'cancel';
}

export interface VirtualDateDto {
  id: string;
  conversationId: string;
  proposedById: string;
  scheduledFor: string;
  timezone: string;
  activityType: string;
  status: VirtualDateStatus;
  proposalNotes?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface RelationshipProposeRequestDto {
  matchId: string;
}

export interface RelationshipProposalDto {
  matchId: string;
  proposedByAccountId: string;
  status: RelationshipProposalStatus;
  createdAt: string;
}

export interface RelationshipRespondRequestDto {
  action: 'accept' | 'decline';
}

export interface RelationshipSpaceDto {
  id: string;
  matchId: string;
  partnerAccountId: string;
  isActive: boolean;
  activatedAt: string;
  activeDays: number;
  disbandedAt?: string | null;
}

export interface RelationshipStatusDto {
  matchId: string;
  proposalStatus: 'none' | 'proposed' | 'active' | 'declined' | 'disbanded';
  proposedById: string | null;
  isActive: boolean;
  space: RelationshipSpaceDto | null;
}

export interface RelationshipMilestoneDto {
  id: string;
  spaceId: string;
  title: string;
  milestoneDate: string;
  description?: string | null;
  createdById: string;
  createdAt: string;
}

export interface RelationshipMilestoneCreateDto {
  title: string;
  milestoneDate: string;
  description?: string;
}

export interface RelationshipJournalDto {
  id: string;
  spaceId: string;
  entryText: string;
  entryDate: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipJournalCreateDto {
  entryText: string;
  entryDate: string;
}
