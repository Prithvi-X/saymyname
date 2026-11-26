import type {
  ChatSampleData,
  DiscoverSampleCard,
  HeroHeadlineCandidate,
  HeroHeadlineCandidateId,
  MatchSampleCard,
  OnboardingStepItem,
  ProgrammeFamilyItem,
  TrustRuleItem,
} from './landing-types';

/**
 * Approved clean canonical URL for peer sharing.
 * Attribution parameters (?src=peer) remain disabled until DEC-LP-05 legal approval.
 */
export const PEER_SHARE_CANONICAL_URL = 'https://saymyname.in';

export const HERO_CANDIDATES: Record<HeroHeadlineCandidateId, HeroHeadlineCandidate> = {
  A: {
    id: 'A',
    eyebrow: 'FOR THE IITM NON-CAMPUS BS COMMUNITY · 18+',
    headline: 'Same world. Different cities. A chance to meet.',
    subheadline:
      'A dating space for adults (18+) enrolled in the four IIT Madras non-campus BS degree programmes — built for genuine discovery across cities, mutual matches, and conversations that begin on your terms.',
  },
  B: {
    id: 'B',
    eyebrow: 'FOR THE IITM NON-CAMPUS BS COMMUNITY · 18+',
    headline: 'Built for real connection across your BS world.',
    subheadline:
      'A dedicated dating space for verified adults (18+) across IIT Madras non-campus BS programmes — mutual matching, calm pacing, and no stranger DMs.',
  },
  C: {
    id: 'C',
    eyebrow: 'FOR THE IITM NON-CAMPUS BS COMMUNITY · 18+',
    headline: 'A calmer place to meet someone who shares your pace.',
    subheadline:
      'Connect privately with verified adults (18+) in the same four IIT Madras non-campus BS degree tracks — mutual match before messaging, always.',
  },
};

export const HERO_TRUST_SUMMARY =
  'No stranger DMs · Manual 18+ & student review · Mutual match required';

export const HERO_INDEPENDENCE_DISCLOSURE =
  'Independent platform. Not owned, endorsed, or operated by IIT Madras.';

export const ACROSS_CITIES_CONTENT = {
  eyebrow: 'SHARED JOURNEY · ACROSS CITIES',
  headline: 'You already share the same midnight deadlines. Why stay strangers?',
  lead: 'Studying in a non-campus degree means sharing lectures, quizzes, and term sprints with thousands of thoughtful peers across India — without a physical quad where paths naturally cross.',
  body: 'SayMyName creates a quiet, verified room for adults inside that shared academic orbit to meet intentionally, without noisy public feeds or uninvited messages.',
  cities: [
    'Chennai',
    'Bengaluru',
    'Pune',
    'Delhi NCR',
    'Hyderabad',
    'Kolkata',
    'Mumbai',
    'Ranchi',
  ],
} as const;

export const SAMPLE_DISCOVER_CARD: DiscoverSampleCard = {
  name: 'Ananya',
  age: 22,
  initials: 'AN',
  city: 'Bengaluru',
  track: 'Data Science and Applications',
  bio: 'Finding quiet cafes between end-term statistics, early morning runs in Indiranagar, and old Ilaiyaraaja records.',
  interests: ['Statistics', 'Film clubs', 'Filter coffee', 'Cycling'],
};

export const SAMPLE_MATCH_CARD: MatchSampleCard = {
  pairLabel: 'You & Dev, 23',
  trackSummary: 'Electronic Systems · Pune ↔ Bengaluru',
  citiesSummary: 'Mutual interest confirmed independently',
  consentNote:
    'In SayMyName, a Like never opens an inbox on its own. Private 1:1 messaging unlocks only when both members express interest.',
};

export const SAMPLE_CHAT_DATA: ChatSampleData = {
  peerName: 'Rohan, 23',
  peerTrack: 'Management and Data Science · Delhi NCR',
  statusLabel: 'Mutual match · Private 1:1 chat',
  messages: [
    {
      id: 'm1',
      sender: 'peer',
      author: 'Rohan',
      timestamp: '9:14 PM',
      text: 'Glad we matched — how did the term quiz week go in Pune?',
    },
    {
      id: 'm2',
      sender: 'member',
      author: 'You',
      timestamp: '9:18 PM',
      text: 'Finally wrapped up tonight. Looking forward to reading something non-statistical this weekend.',
    },
    {
      id: 'm3',
      sender: 'peer',
      author: 'Rohan',
      timestamp: '9:21 PM',
      text: 'That sounds earned. Which part of town are you exploring lately?',
    },
  ],
  footerNote: 'Phase 1 mutual-match text messaging · Private between both matched members',
};

export const ONBOARDING_STEPS: readonly OnboardingStepItem[] = [
  {
    step: '01',
    title: 'Create your account',
    detail: 'Register cleanly with your email and password over a rate-limited session.',
  },
  {
    step: '02',
    title: 'Confirm institutional email',
    detail: 'Verify ownership of your eligible IIT Madras BS programme student email address.',
  },
  {
    step: '03',
    title: 'Confirm 18+ eligibility',
    detail: 'Submit your date of birth for manual adult-age eligibility verification.',
  },
  {
    step: '04',
    title: 'Select & verify your BS track',
    detail:
      'Choose your approved BS programme family and level (plus optional non-ID enrolment document) for manual verification review.',
  },
  {
    step: '05',
    title: 'Build your profile & publish',
    detail:
      'Add your bio, coarse city and state, and at least one portrait once verified, then publish your profile to enter Discover.',
  },
] as const;

export const APPROVED_PROGRAMME_FAMILIES: readonly ProgrammeFamilyItem[] = [
  {
    code: '01',
    name: 'Data Science and Applications',
    scopeNote: 'Verified Non-Campus BS Track · 18+ Adults',
  },
  {
    code: '02',
    name: 'Electronic Systems',
    scopeNote: 'Verified Non-Campus BS Track · 18+ Adults',
  },
  {
    code: '03',
    name: 'Aeronautics and Space Technology',
    scopeNote: 'Verified Non-Campus BS Track · 18+ Adults',
  },
  {
    code: '04',
    name: 'Management and Data Science',
    scopeNote: 'Verified Non-Campus BS Track · 18+ Adults',
  },
] as const;

export const TRUST_RULES: readonly TrustRuleItem[] = [
  {
    id: 'mutual-match',
    title: 'A Like is never permission to message',
    body: 'Cold messages and unsolicited DMs do not exist here. Private 1:1 messaging opens only after two independent mutual Likes with no active block or restriction.',
  },
  {
    id: 'default-deny',
    title: 'Strict default-deny privacy',
    body: 'Exact dates of birth, verification evidence, and private details never appear on public cards or APIs. Server-side checks enforce ownership and match state on every request.',
  },
  {
    id: 'independent',
    title: 'Independent & human-paced',
    body: 'Built independently for the IIT Madras non-campus BS community — never owned, endorsed, or operated by IIT Madras. No public social feeds or algorithmic rage loops.',
  },
] as const;

export const SHARE_SECTION_CONTENT = {
  eyebrow: 'INVITE AN ELIGIBLE FRIEND',
  headline: 'Good rooms grow through trusted people.',
  body: 'Know someone in the IITM BS cohort studying from another city who is tired of noisy mainstream apps? Send them the clean doorway.',
  primaryCta: 'Create Account',
  secondaryCta: 'Share SayMyName',
  shareTitle: 'SayMyName.in — Same world. Different cities. A chance to meet.',
  shareText:
    'An independent, verified 18+ dating space for students in the IIT Madras non-campus BS degree programmes.',
} as const;
