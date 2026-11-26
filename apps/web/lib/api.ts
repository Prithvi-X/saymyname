/**
 * SayMyName Web BFF API Client (Document 05 §6.2 & D-P2-02)
 *
 * Security Invariants:
 * - Zero tokens stored in localStorage, sessionStorage, or readable document cookies
 * - All browser requests travel via same-origin Next.js BFF routes (/api/auth/* & /api/bff/v1/*)
 * - Session credentials stay strictly in HttpOnly; SameSite=Lax cookies
 * - Mutating requests attach X-SMN-CSRF matching the double-submit smn_csrf cookie
 * - Zero unconfigured cloud fallback URLs (never fails over silently to another environment)
 */

import { AccountLifecycleState, ProgrammeFamily } from '@saymyname/contracts';

export function isPrivateIdentifier(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^\d{2}[a-zA-Z]\d+$/i.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if (trimmed.includes('@')) return true;
  if (/^\d+$/.test(trimmed)) return true;
  return false;
}

export function sanitizeDisplayName(value?: string | null): string {
  if (!value || isPrivateIdentifier(value)) {
    return '';
  }
  return value.trim();
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface AgeCheckPayload {
  dateOfBirth: string;
}

export interface VerifyStudentPayload {
  programmeFamily: string;
  pathwayCode: 'foundation' | 'diploma' | 'degree';
  studentRollNo?: string;
  evidenceObjectKey?: string;
  evidenceType?: string;
  evidenceMimeType?: string;
  evidenceSizeBytes?: number;
  evidenceSha256?: string;
}

export interface DiscoveryCandidate {
  profileId: string;
  displayName: string;
  age: number | null;
  ageVisible?: boolean;
  programmeFamily: ProgrammeFamily;
  bio: string;
  locationCity?: string | null;
  locationState?: string | null;
  currentTerm?: string | null;
  intention?: string | null;
  avatarColor?: string;
  isVerified?: boolean;
  sharedInterests?: string[];
  photos: { id: string; photoUrl: string | null; displayOrder?: number; isPrimary: boolean }[];
  interests: string[];
  promptAnswers: { id?: string; promptId?: string; promptText: string; answerText: string }[];
}

export interface DiscoveryFeedResponse {
  candidates: DiscoveryCandidate[];
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

export interface LikeResponse {
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

export interface ReceivedLikeItem {
  likeId: string;
  profileId: string;
  likedAt: string;
  profile: DiscoveryCandidate;
}

export interface ReceivedLikesResponse {
  items: ReceivedLikeItem[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
  totalActiveCount: number;
  pageSize: number;
  viewerState: 'ready' | 'paused' | 'profile_incomplete';
}

export type SentLikeAvailability = 'pending' | 'unavailable' | 'withdrawn';

export interface SentLikeRecipientPreview {
  profileId: string | null;
  displayName: string;
  age: number | null;
  ageVisible?: boolean;
  programmeFamily: ProgrammeFamily | null;
  currentTerm?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  intention?: string | null;
  bio?: string | null;
  photos: DiscoveryCandidate['photos'];
  interests: string[];
  promptAnswers: DiscoveryCandidate['promptAnswers'];
  isVerified?: boolean;
}

export interface SentLikeItem {
  likeId: string;
  status: string;
  availability: SentLikeAvailability;
  statusLabel: string;
  canWithdraw: boolean;
  sentAt: string;
  updatedAt: string;
  profile: SentLikeRecipientPreview;
}

export interface SentLikesResponse {
  items: SentLikeItem[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
  totalActiveCount: number;
  pageSize: number;
  viewerState: 'ready' | 'paused' | 'profile_incomplete';
}

export interface WithdrawLikeResponse {
  likeId: string;
  status: string;
  withdrawn: boolean;
  alreadyWithdrawn: boolean;
  message: string;
}

export type ReportCategory =
  | 'harassment'
  | 'inappropriate_content'
  | 'underage_suspected'
  | 'fake_profile'
  | 'spam'
  | 'offline_safety';

export interface UnmatchResponse {
  matchId: string;
  status: 'ended' | string;
  alreadyEnded: boolean;
  message: string;
}

export interface MatchProfile {
  id: string;
  conversationId: string | null;
  status: string;
  candidate: DiscoveryCandidate;
  matchedAt: string;
  matchedAtIso: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lastMessageIsOwn?: boolean | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sequenceNo: number;
  senderId: string;
  senderName: string;
  messageType: 'text' | 'voice_note' | 'system_event';
  text: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  createdAt: string;
  createdAtIso?: string;
  isOwn: boolean;
  deliveryState: 'sent' | 'delivered';
  clientAssignedUuid?: string | null;
  localStatus?: 'sending' | 'failed';
}

export interface ConversationListItem {
  conversationId: string;
  matchId: string;
  matchedAt: string;
  lastMessageAt: string | null;
  lastMessage: {
    id: string;
    sequenceNo: number;
    messageType: 'text' | 'voice_note' | 'system_event';
    previewText: string;
    isOwn: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  latestSequenceNo: number;
  ownLastReadSeq: number;
  profile: DiscoveryCandidate;
}

export interface ConversationMessagesHistory {
  messages: ChatMessage[];
  nextCursor: string | null;
  hasOlder: boolean;
  latestSequenceNo: number;
  ownLastReadSeq: number;
  conversationStatus: 'active' | 'closed';
}

export interface VerificationCaseSummary {
  id: string;
  checkType: string;
  providerCode: string;
  status: string;
  reasonCode?: string | null;
  rejectionReason?: string | null;
  submittedAt: string;
  decidedAt?: string | null;
  evidenceCount?: number;
}

class ApiClient {
  private readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const parts = document.cookie ? document.cookie.split('; ') : [];
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx);
      if (k === name) {
        return decodeURIComponent(part.slice(idx + 1));
      }
    }
    return null;
  }

  private async ensureCsrfToken(): Promise<string> {
    const existing = this.readCookie('smn_csrf');
    if (existing) return existing;

    const res = await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return data.csrfToken || this.readCookie('smn_csrf') || '';
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (method !== 'GET' && method !== 'HEAD') {
      const csrf = await this.ensureCsrfToken();
      if (csrf) {
        headers['X-SMN-CSRF'] = csrf;
      }
    }

    let res: Response;
    try {
      res = await fetch(path, {
        ...options,
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch {
      throw new Error(
        'Unable to reach the SayMyName application server. Please verify your connection and retry.',
      );
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const err: any = new Error(
        data.message || 'Session expired or unauthorized. Please sign in again.',
      );
      err.status = 401;
      throw err;
    }

    if (!res.ok) {
      const err: any = new Error(
        data.message || data.detail || `Request failed with status ${res.status}`,
      );
      err.status = res.status;
      err.code = data.code;
      throw err;
    }

    return data as T;
  }

  // --- Auth via BFF (/api/auth/*) ---

  async register(payload: RegisterPayload) {
    return this.request<{
      message: string;
      email: string;
      cooldownSeconds: number;
      devOtp?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resendOtp(email: string) {
    return this.request<{
      message: string;
      email?: string;
      cooldownSeconds: number;
      devOtp?: string;
    }>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOtp(payload: VerifyOtpPayload) {
    return this.request<{
      message: string;
      account: any;
      lifecycleState: AccountLifecycleState;
    }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async login(payload: LoginPayload) {
    return this.request<{
      message: string;
      account: any;
      lifecycleState: AccountLifecycleState;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string; devResetToken?: string }>(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async getMe() {
    return this.request<{
      id: string;
      email: string;
      displayName: string | null;
      accountStatus: string;
      emailVerified: boolean;
      hasPassword: boolean;
      lifecycleState: AccountLifecycleState;
      eligibility: any;
      profile?: any;
    }>('/api/auth/me');
  }

  async logout() {
    return this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async revokeOtherSessions() {
    return this.request<{ message: string; revokedCount: number }>(
      '/api/auth/revoke-others',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
  }

  // --- Verification & Eligibility (/api/bff/v1/*) ---

  async verifyAge(payload: AgeCheckPayload) {
    return this.request<{
      message: string;
      isAdult: boolean;
      calculatedAge: number;
      ageStatus: string;
      verificationPendingReview: boolean;
      caseId: string;
      eligibility: any;
    }>('/api/bff/v1/verification-cases/age', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async presignVerificationEvidence(payload: {
    evidenceType: string;
    mimeType: string;
    fileSizeBytes: number;
  }) {
    return this.request<{
      uploadUrl: string | null;
      adapterMode: string;
      s3Key: string;
      evidenceType: string;
      expiresInSeconds: number;
    }>('/api/bff/v1/verification-cases/evidence/presign', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async verifyStudent(payload: VerifyStudentPayload) {
    return this.request<{
      message: string;
      studentStatus: string;
      discoveryEligible: boolean;
      verificationPendingReview: boolean;
      caseId: string;
      eligibility: any;
    }>('/api/bff/v1/verification-cases/student', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getVerificationCases(): Promise<VerificationCaseSummary[]> {
    return this.request<VerificationCaseSummary[]>('/api/bff/v1/verification-cases/me');
  }

  // --- Profiles & Media ---

  async getProfileCatalog() {
    return this.request<{
      interests: { id: string; name: string; category: string }[];
      prompts: { id: string; promptText: string; category: string }[];
      supportedImageMimes?: string[];
      heicSupported?: boolean;
    }>('/api/bff/v1/profiles/catalog');
  }

  async getProfile() {
    return this.request<{
      id: string;
      accountId: string;
      displayName: string;
      programmeFamily: string;
      profileStatus: string;
      ageDisplayMode?: string;
      bio?: string;
      termOrYear?: string;
      locationCity?: string;
      locationState?: string;
      intention?: string;
      isPublished: boolean;
      isPaused: boolean;
      consentAcceptedAt?: string | null;
      photos: {
        id: string;
        photoUrl: string | null;
        displayOrder: number;
        isPrimary: boolean;
      }[];
      interests: { interest: { id?: string; name: string } }[];
      promptAnswers: { promptId?: string; prompt: { promptText: string }; answerText: string }[];
      preferences?: any;
    }>('/api/bff/v1/profiles/me');
  }

  async updateProfile(payload: {
    displayName?: string;
    bio?: string;
    termOrYear?: string;
    locationCity?: string;
    locationState?: string;
    intention?: string;
    ageDisplayMode?: 'hidden' | 'show_calculated_age';
    interests?: string[];
    promptAnswers?: Array<{ promptId?: string; promptText?: string; answerText: string }>;
  }) {
    return this.request<any>('/api/bff/v1/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async presignPhoto(payload: {
    filename: string;
    mimeType: string;
    fileSizeBytes?: number;
  }) {
    return this.request<{
      uploadUrl: string | null;
      adapterMode: string;
      photoId: string;
      s3Key: string;
      expiresInSeconds: number;
    }>('/api/bff/v1/profiles/me/photos/presign', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Private media upload failed with status ${res.status}.`);
    }
  }

  async addPhoto(payload: {
    s3Key: string;
    mimeType?: string;
    displayOrder?: number;
    isPrimary?: boolean;
  }) {
    return this.request<{
      id: string;
      profileId: string;
      photoUrl: string | null;
      displayOrder: number;
      isPrimary: boolean;
    }>('/api/bff/v1/profiles/me/photos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async setPrimaryPhoto(photoId: string) {
    return this.request<any>(`/api/bff/v1/profiles/me/photos/${photoId}/primary`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });
  }

  async removePhoto(photoId: string) {
    return this.request<{ message: string }>(`/api/bff/v1/profiles/me/photos/${photoId}`, {
      method: 'DELETE',
    });
  }

  async reorderPhotos(photoIds: string[]) {
    return this.request<any>('/api/bff/v1/profiles/me/photos/reorder', {
      method: 'PUT',
      body: JSON.stringify({ photoIds }),
    });
  }

  async getPreferences() {
    return this.request<{
      minAge: number;
      maxAge: number;
      allowedProgrammes: string[];
      maxDistanceKm?: number | null;
      showInDiscovery: boolean;
    }>('/api/bff/v1/profiles/me/preferences');
  }

  async getProfilePreview() {
    return this.request<{
      id: string;
      displayName: string;
      age?: number | null;
      programmeFamily: string;
      termOrYear?: string | null;
      locationCity?: string | null;
      locationState?: string | null;
      intention?: string | null;
      bio?: string | null;
      photos: { id: string; photoUrl: string | null; displayOrder: number; isPrimary: boolean }[];
      interests: string[];
      promptAnswers: { id: string; promptId: string; promptText: string; answerText: string }[];
      isVerified: boolean;
    }>('/api/bff/v1/profiles/me/preview');
  }

  async getPublicProfile(profileId: string) {
    return this.request<any>(`/api/bff/v1/profiles/${profileId}/public`);
  }

  async updatePreferences(payload: {
    minAge?: number;
    maxAge?: number;
    allowedProgrammes?: string[];
    showInDiscovery?: boolean;
  }) {
    return this.request<any>('/api/bff/v1/profiles/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async publishProfile(payload: {
    isPublished?: boolean;
    acceptGuidelinesConsent?: boolean;
  }) {
    return this.request<any>('/api/bff/v1/profiles/me/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async togglePublish(isPublished: boolean) {
    return this.request<any>('/api/bff/v1/profiles/me/publish', {
      method: 'PUT',
      body: JSON.stringify({ isPublished }),
    });
  }

  // --- Dating Discovery ---

  private mapCandidate(c: any): DiscoveryCandidate {
    return {
      profileId: c.profileId,
      displayName: c.displayName,
      age: typeof c.age === 'number' ? c.age : null,
      ageVisible: typeof c.ageVisible === 'boolean' ? c.ageVisible : typeof c.age === 'number',
      programmeFamily: c.programmeFamily,
      bio: c.bio || '',
      locationCity: c.locationCity ?? null,
      locationState: c.locationState ?? null,
      currentTerm: c.termOrYear || c.currentTerm || null,
      intention: c.intention ?? null,
      isVerified: Boolean(c.isVerified),
      sharedInterests: Array.isArray(c.sharedInterests) ? c.sharedInterests : [],
      photos: Array.isArray(c.photos) ? c.photos : [],
      interests: Array.isArray(c.interests) ? c.interests : [],
      promptAnswers: Array.isArray(c.promptAnswers) ? c.promptAnswers : [],
    };
  }

  async getDiscoverFeed(params?: {
    cursor?: string | null;
    limit?: number;
  }): Promise<DiscoveryFeedResponse> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await this.request<any>(`/api/bff/v1/dating/candidates${suffix}`);
    const rawList = Array.isArray(res) ? res : Array.isArray(res?.candidates) ? res.candidates : [];

    return {
      candidates: rawList.map((c: any) => this.mapCandidate(c)),
      nextCursor: typeof res?.nextCursor === 'string' ? res.nextCursor : null,
      hasMore: Boolean(res?.hasMore),
      count: typeof res?.count === 'number' ? res.count : rawList.length,
      pageSize: typeof res?.pageSize === 'number' ? res.pageSize : 10,
      viewerState: res?.viewerState || 'ready',
      preferencesApplied: res?.preferencesApplied,
    };
  }

  async getCandidates(): Promise<DiscoveryCandidate[]> {
    const feed = await this.getDiscoverFeed();
    return feed.candidates;
  }

  async getCandidateDetail(profileId: string): Promise<DiscoveryCandidate> {
    const res = await this.request<any>(`/api/bff/v1/dating/candidates/${profileId}`);
    return this.mapCandidate(res);
  }

  async likeCandidate(targetProfileId: string, idempotencyKey?: string): Promise<LikeResponse> {
    return this.request<LikeResponse>('/api/bff/v1/dating/likes', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ targetProfileId }),
    });
  }

  async passCandidate(
    targetProfileId: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/api/bff/v1/dating/passes', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ targetProfileId }),
    });
  }

  async getReceivedLikes(params?: {
    cursor?: string | null;
    limit?: number;
  }): Promise<ReceivedLikesResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    const qs = query.toString();
    return this.request<ReceivedLikesResponse>(
      `/api/bff/v1/dating/likes/received${qs ? `?${qs}` : ''}`,
    );
  }

  async getReceivedLikeDetail(likeId: string): Promise<ReceivedLikeItem> {
    return this.request<ReceivedLikeItem>(`/api/bff/v1/dating/likes/received/${likeId}`);
  }

  async likeBackReceived(likeId: string, idempotencyKey?: string): Promise<LikeResponse> {
    return this.request<LikeResponse>(`/api/bff/v1/dating/likes/received/${likeId}/like-back`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({}),
    });
  }

  async passReceivedLike(
    likeId: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(
      `/api/bff/v1/dating/likes/received/${likeId}/pass`,
      {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: JSON.stringify({}),
      },
    );
  }

  async getSentLikes(params?: {
    cursor?: string | null;
    limit?: number;
    includeWithdrawn?: boolean;
  }): Promise<SentLikesResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.includeWithdrawn === 'boolean') {
      query.set('includeWithdrawn', String(params.includeWithdrawn));
    }
    const qs = query.toString();
    return this.request<SentLikesResponse>(
      `/api/bff/v1/dating/likes/sent${qs ? `?${qs}` : ''}`,
    );
  }

  async withdrawLike(likeId: string, idempotencyKey?: string): Promise<WithdrawLikeResponse> {
    return this.request<WithdrawLikeResponse>(`/api/bff/v1/dating/likes/${likeId}/withdraw`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({}),
    });
  }

  private mapMatchSummary(m: any): MatchProfile {
    const p = m.profile || m.partner || m.candidate || {};
    const matchedAtIso = m.matchedAt || m.createdAt || new Date().toISOString();
    const lastMsgText =
      typeof m.lastMessageText === 'string'
        ? m.lastMessageText
        : typeof m.lastMessage === 'string'
          ? m.lastMessage
          : (m.lastMessage?.bodyText ?? null);

    return {
      id: m.matchId || m.id,
      conversationId: m.conversationId ?? null,
      status: m.status || 'active',
      candidate: {
        profileId: p.profileId || m.matchId || m.id,
        displayName: p.displayName || 'Verified Match',
        age: typeof p.age === 'number' ? p.age : null,
        ageVisible:
          p.ageVisible !== undefined ? Boolean(p.ageVisible) : typeof p.age === 'number',
        programmeFamily: p.programmeFamily || ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
        bio: p.bio || '',
        locationCity: p.locationCity ?? null,
        locationState: p.locationState ?? null,
        currentTerm: p.currentTerm ?? p.termOrYear ?? null,
        intention: p.intention ?? null,
        avatarColor: p.avatarColor || '#8580C4',
        isVerified: p.isVerified !== false,
        sharedInterests: Array.isArray(p.sharedInterests) ? p.sharedInterests : [],
        photos: Array.isArray(p.photos) ? p.photos : [],
        interests: Array.isArray(p.interests) ? p.interests : [],
        promptAnswers: Array.isArray(p.promptAnswers) ? p.promptAnswers : [],
      },
      matchedAt: matchedAtIso,
      matchedAtIso,
      lastMessage: lastMsgText,
      lastMessageAt: m.lastMessageAt ?? null,
      lastMessageIsOwn: typeof m.lastMessageIsOwn === 'boolean' ? m.lastMessageIsOwn : null,
    };
  }

  async getMatches(): Promise<MatchProfile[]> {
    const res = await this.request<any[]>('/api/bff/v1/dating/matches');
    if (!Array.isArray(res)) return [];
    return res.map((m) => this.mapMatchSummary(m));
  }

  async getMatchDetail(matchId: string): Promise<MatchProfile> {
    const res = await this.request<any>(
      `/api/bff/v1/dating/matches/${encodeURIComponent(matchId)}`,
    );
    return this.mapMatchSummary(res);
  }

  async unmatch(
    matchId: string,
    reason?: string,
    idempotencyKey?: string,
  ): Promise<UnmatchResponse> {
    return this.request<UnmatchResponse>(
      `/api/bff/v1/dating/matches/${encodeURIComponent(matchId)}/unmatch`,
      {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: JSON.stringify(reason ? { reason } : {}),
      },
    );
  }

  // --- Bilateral Messaging (Phase 3.5: Conversations, Pagination, Realtime, Voice Notes) ---

  private mapChatMessage(msg: any, fallbackConversationId: string): ChatMessage {
    const rawIso =
      typeof msg.createdAt === 'string' && msg.createdAt.includes('T')
        ? msg.createdAt
        : new Date().toISOString();
    const deliveryState: 'sent' | 'delivered' =
      msg.deliveryState === 'delivered' || msg.deliveryState === 'read'
        ? 'delivered'
        : 'sent';
    return {
      id: msg.id,
      conversationId: msg.conversationId || fallbackConversationId,
      sequenceNo: Number(msg.sequenceNo || 0),
      senderId: msg.isOwn ? 'self' : 'partner',
      senderName: msg.senderName || (msg.isOwn ? 'You' : 'Match'),
      messageType: msg.messageType || 'text',
      text: msg.bodyText || msg.text || '',
      mediaId: msg.mediaId ?? null,
      mediaUrl: msg.mediaUrl ?? null,
      mimeType: msg.mimeType ?? null,
      durationSeconds:
        typeof msg.durationSeconds === 'number' ? msg.durationSeconds : null,
      fileSizeBytes:
        typeof msg.fileSizeBytes === 'number' ? msg.fileSizeBytes : null,
      createdAt: msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      createdAtIso: rawIso,
      isOwn: Boolean(msg.isOwn),
      deliveryState,
      clientAssignedUuid: msg.clientAssignedUuid ?? null,
    };
  }

  async getConversations(): Promise<ConversationListItem[]> {
    const res = await this.request<any[]>('/api/bff/v1/messaging/conversations');
    if (!Array.isArray(res)) return [];
    return res.map((c) => ({
      conversationId: c.conversationId,
      matchId: c.matchId,
      matchedAt: c.matchedAt || new Date().toISOString(),
      lastMessageAt: c.lastMessageAt ?? null,
      lastMessage: c.lastMessage
        ? {
            id: c.lastMessage.id,
            sequenceNo: Number(c.lastMessage.sequenceNo || 0),
            messageType: c.lastMessage.messageType || 'text',
            previewText: c.lastMessage.previewText || c.lastMessage.bodyText || '',
            isOwn: Boolean(c.lastMessage.isOwn),
            createdAt: c.lastMessage.createdAt,
          }
        : null,
      unreadCount: Number(c.unreadCount || 0),
      latestSequenceNo: Number(c.latestSequenceNo || 0),
      ownLastReadSeq: Number(c.ownLastReadSeq || 0),
      profile: this.mapCandidate(c.profile || {}),
    }));
  }

  async issueRealtimeWsTicket(): Promise<{
    ticket: string;
    wsPath: string;
    wsUrl: string;
    expiresInSeconds: number;
  }> {
    return this.request('/api/auth/ws-ticket', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getMessageHistory(
    conversationId: string,
    params?: { beforeSeq?: number; afterSeq?: number; limit?: number },
  ): Promise<ConversationMessagesHistory> {
    const qs = new URLSearchParams();
    if (typeof params?.beforeSeq === 'number') qs.set('beforeSeq', String(params.beforeSeq));
    if (typeof params?.afterSeq === 'number') qs.set('afterSeq', String(params.afterSeq));
    if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await this.request<any>(
      `/api/bff/v1/messaging/conversations/${encodeURIComponent(conversationId)}/history${suffix}`,
    );
    const rawList = Array.isArray(res?.messages) ? res.messages : [];
    return {
      messages: rawList.map((m: any) => this.mapChatMessage(m, conversationId)),
      nextCursor: typeof res?.nextCursor === 'string' ? res.nextCursor : null,
      hasOlder: Boolean(res?.hasOlder),
      latestSequenceNo: Number(res?.latestSequenceNo || 0),
      ownLastReadSeq: Number(res?.ownLastReadSeq || 0),
      conversationStatus: res?.conversationStatus === 'closed' ? 'closed' : 'active',
    };
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const history = await this.getMessageHistory(conversationId, { limit: 50 });
    return history.messages;
  }

  async sendMessage(
    conversationId: string,
    text: string,
    options?: { clientAssignedUuid?: string; idempotencyKey?: string },
  ): Promise<ChatMessage> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    if (trimmed.length > 1000) {
      throw new Error('Message exceeds 1000 character limit (Doc 04 §6.1)');
    }

    const res = await this.request<any>(
      `/api/bff/v1/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: options?.idempotencyKey
          ? { 'Idempotency-Key': options.idempotencyKey }
          : undefined,
        body: JSON.stringify({
          bodyText: trimmed,
          ...(options?.clientAssignedUuid
            ? { clientAssignedUuid: options.clientAssignedUuid }
            : {}),
        }),
      },
    );

    return this.mapChatMessage(
      {
        ...res,
        isOwn: true,
        senderName: res.senderName || 'You',
        bodyText: res.bodyText || trimmed,
        deliveryState: res.deliveryState || 'sent',
      },
      conversationId,
    );
  }

  async markInboxSeen(
    conversationId: string,
    upToSequenceNo: number,
  ): Promise<{ conversationId: string; ownLastReadSeq: number; unreadCount: number }> {
    return this.request(
      `/api/bff/v1/messaging/conversations/${encodeURIComponent(conversationId)}/inbox-seen`,
      {
        method: 'POST',
        body: JSON.stringify({ upToSequenceNo }),
      },
    );
  }

  async ackMessageDelivery(
    conversationId: string,
    upToSequenceNo: number,
  ): Promise<{ conversationId: string; acknowledgedSeq: number; transitionedCount: number }> {
    return this.request(
      `/api/bff/v1/messaging/conversations/${encodeURIComponent(conversationId)}/delivery-ack`,
      {
        method: 'POST',
        body: JSON.stringify({ upToSequenceNo }),
      },
    );
  }

  async presignMessagingVoiceNote(
    conversationId: string,
    payload: {
      filename: string;
      mimeType: string;
      durationSeconds: number;
      fileSizeBytes?: number;
    },
  ): Promise<{
    uploadUrl: string | null;
    adapterMode: string;
    mediaRefId: string;
    uploadToken: string;
    expiresInSeconds: number;
    maxBytes: number;
    maxDurationSeconds: number;
  }> {
    return this.request(
      `/api/bff/v1/messaging/conversations/${encodeURIComponent(conversationId)}/voice-notes/presign`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async uploadBlobToPresignedUrl(
    uploadUrl: string,
    blob: Blob,
    contentType: string,
  ): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!res.ok) {
      throw new Error(`Private voice-note upload failed with status ${res.status}.`);
    }
  }

  async sendMessagingVoiceNote(
    conversationId: string,
    payload: {
      mediaRefId: string;
      uploadToken: string;
      durationSeconds: number;
      clientAssignedUuid?: string;
    },
    idempotencyKey?: string,
  ): Promise<ChatMessage> {
    const res = await this.request<any>(
      `/api/bff/v1/messaging/conversations/${encodeURIComponent(conversationId)}/voice-notes`,
      {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: JSON.stringify(payload),
      },
    );
    return this.mapChatMessage({ ...res, isOwn: true, messageType: 'voice_note' }, conversationId);
  }

  async getAuthorizedVoiceNoteUrl(mediaId: string): Promise<{
    mediaId: string;
    url: string | null;
    mimeType: string;
    durationSeconds: number | null;
    expiresInSeconds: number | null;
  }> {
    return {
      mediaId,
      url: `/api/bff/v1/messaging/media/${encodeURIComponent(mediaId)}/stream`,
      mimeType: 'audio/webm',
      durationSeconds: null,
      expiresInSeconds: null,
    };
  }

  // --- Safety & Moderation ---

  async blockCandidate(targetProfileId: string, reason?: string) {
    return this.request<{ success: boolean; message: string }>('/api/bff/v1/safety/block', {
      method: 'POST',
      body: JSON.stringify({ targetProfileId, reason }),
    });
  }

  async reportCandidate(
    targetProfileId: string,
    reportCategory: ReportCategory,
    description?: string,
    idempotencyKey?: string,
    context?: { conversationId?: string; messageId?: string },
  ) {
    return this.request<{
      success: boolean;
      reportId?: string;
      alreadyReported?: boolean;
      message: string;
    }>('/api/bff/v1/safety/report', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({
        targetProfileId,
        reportCategory,
        description,
        ...(context?.conversationId ? { conversationId: context.conversationId } : {}),
        ...(context?.messageId ? { messageId: context.messageId } : {}),
      }),
    });
  }

  async blockUser(targetAccountOrId: string, reason: string) {
    return this.request<{ success: boolean; message: string }>('/api/bff/v1/safety/block', {
      method: 'POST',
      body: JSON.stringify({ blockedId: targetAccountOrId, reason }),
    });
  }

  async reportUser(targetAccountOrId: string, categoryOrReason: string, details?: string) {
    const categories = new Set([
      'harassment',
      'inappropriate_content',
      'underage_suspected',
      'fake_profile',
      'spam',
      'offline_safety',
    ]);
    const reportCategory = categories.has(categoryOrReason)
      ? categoryOrReason
      : 'inappropriate_content';
    const description = categories.has(categoryOrReason)
      ? details
      : details
        ? `${categoryOrReason}: ${details}`
        : categoryOrReason;

    return this.request<{ success: boolean; message: string }>('/api/bff/v1/safety/report', {
      method: 'POST',
      body: JSON.stringify({
        reportedId: targetAccountOrId,
        reportCategory,
        description,
      }),
    });
  }
}

export const api = new ApiClient();
