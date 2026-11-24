/**
 * Phase 1 IIT Madras Approved Programmes
 * Strictly restricted to these 4 non-campus BS families (Doc 01 §3.1)
 */
export enum ProgrammeFamily {
  DATA_SCIENCE_APPLICATIONS = 'data_science_applications',
  ELECTRONIC_SYSTEMS = 'electronic_systems',
  AERONAUTICS_SPACE = 'aeronautics_space',
  MANAGEMENT_DATA_SCIENCE = 'management_data_science',
}

export enum AccountStatus {
  REGISTERED = 'registered',
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
  DELETED = 'deleted',
}

export enum VerificationStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  NEEDS_INFORMATION = 'needs_information',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum PathwayCode {
  FOUNDATION = 'foundation',
  DIPLOMA = 'diploma',
  DEGREE = 'degree',
}

export enum ProfileStatus {
  DRAFT = 'draft',
  READY_FOR_REVIEW = 'ready_for_review',
  LIVE = 'live',
  PAUSED = 'paused',
  RESTRICTED = 'restricted',
  REMOVED = 'removed',
}

export enum VerificationCheckType {
  AGE = 'age',
  STUDENT_ENROLMENT = 'student_enrolment',
}

export enum AccountLifecycleState {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  EMAIL_PENDING = 'EMAIL_PENDING',
  AGE_VERIFICATION = 'AGE_VERIFICATION',
  STUDENT_VERIFICATION = 'STUDENT_VERIFICATION',
  VERIFICATION_PENDING = 'VERIFICATION_PENDING',
  VERIFICATION_NEEDS_INFORMATION = 'VERIFICATION_NEEDS_INFORMATION',
  VERIFICATION_REJECTED = 'VERIFICATION_REJECTED',
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',
  ACTIVE_MEMBER = 'ACTIVE_MEMBER',
  SUSPENDED = 'SUSPENDED',
}

export enum MatchStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
}

export enum LikeStatus {
  ACTIVE = 'active',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

export enum MessageType {
  TEXT = 'text',
  VOICE_NOTE = 'voice_note',
  SYSTEM_EVENT = 'system_event',
}

export enum DeliveryState {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ENDED = 'ended',
  MISSED = 'missed',
  FAILED = 'failed',
}

export enum GameSessionStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DECLINED = 'declined',
  ABANDONED = 'abandoned',
}

export enum VirtualDateStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RelationshipProposalStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  WITHDRAWN = 'withdrawn',
}

export enum ActivityType {
  STUDY_SESSION = 'study_session',
  CAMPUS_WALK = 'campus_walk',
  GAME_NIGHT = 'game_night',
  MUSIC_SHARE = 'music_share',
  COFFEE_CHAT = 'coffee_chat',
}

export enum GameType {
  WORD_SCRAMBLE = 'word_scramble',
  IITM_TRIVIA = 'iitm_trivia',
  TWENTY_QUESTIONS = 'twenty_questions',
}
