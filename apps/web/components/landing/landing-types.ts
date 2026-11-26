export type HeroHeadlineCandidateId = 'A' | 'B' | 'C';

export type HeroCompositionMode = '3d-led' | 'paired';

export type ProductTabId = 'discover' | 'match' | 'chat';

export interface HeroHeadlineCandidate {
  id: HeroHeadlineCandidateId;
  eyebrow: string;
  headline: string;
  subheadline: string;
}

export interface OnboardingStepItem {
  step: string;
  title: string;
  detail: string;
}

export interface ProgrammeFamilyItem {
  code: string;
  name: string;
  scopeNote: string;
}

export interface TrustRuleItem {
  id: string;
  title: string;
  body: string;
}

export interface DiscoverSampleCard {
  name: string;
  age: number;
  initials: string;
  city: string;
  track: string;
  bio: string;
  interests: readonly string[];
}

export interface MatchSampleCard {
  pairLabel: string;
  trackSummary: string;
  citiesSummary: string;
  consentNote: string;
}

export interface ChatSampleMessage {
  id: string;
  sender: 'peer' | 'member';
  author: string;
  timestamp: string;
  text: string;
}

export interface ChatSampleData {
  peerName: string;
  peerTrack: string;
  statusLabel: string;
  messages: readonly ChatSampleMessage[];
  footerNote: string;
}
