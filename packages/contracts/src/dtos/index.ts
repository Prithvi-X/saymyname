import {
  ProgrammeFamily,
  AccountStatus,
  VerificationStatus,
  MatchStatus,
  MessageType,
  DeliveryState,
  CallStatus,
} from '../enums';

export interface AccountDto {
  id: string;
  email: string;
  accountStatus: AccountStatus;
  displayName?: string | null;
  createdAt: string;
}

export interface AccountEligibilityDto {
  accountId: string;
  ageStatus: VerificationStatus;
  studentStatus: VerificationStatus;
  programmeFamily?: ProgrammeFamily | null;
  discoveryEligible: boolean;
  verifiedAt?: string | null;
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
  isPublished: boolean;
  photos: ProfilePhotoDto[];
  interests: string[];
  promptAnswers: ProfilePromptAnswerDto[];
}

export interface ProfilePhotoDto {
  id: string;
  photoUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ProfilePromptAnswerDto {
  id: string;
  promptId: string;
  promptText: string;
  answerText: string;
}

export interface DiscoveryCandidateDto {
  profileId: string;
  displayName: string;
  age: number;
  programmeFamily: ProgrammeFamily;
  bio?: string | null;
  locationCity?: string | null;
  photos: ProfilePhotoDto[];
  interests: string[];
  promptAnswers: ProfilePromptAnswerDto[];
}

export interface LikeResponseDto {
  likeId: string;
  isMutualMatch: boolean;
  matchId?: string | null;
}

export interface MatchDto {
  id: string;
  userLowId: string;
  userHighId: string;
  status: MatchStatus;
  createdAt: string;
  endedAt?: string | null;
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

export interface CallSessionDto {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  callStatus: CallStatus;
  livekitRoomId: string;
  startedAt?: string | null;
  durationSeconds?: number | null;
}
