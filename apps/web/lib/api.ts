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
  programmeFamily: ProgrammeFamily;
  bio: string;
  locationCity?: string;
  locationState?: string;
  currentTerm?: string;
  avatarColor?: string;
  photos: { id: string; photoUrl: string | null; isPrimary: boolean }[];
  interests: string[];
  promptAnswers: { id?: string; promptText: string; answerText: string }[];
}

export interface LikeResponse {
  likeId: string;
  isMutualMatch: boolean;
  matchId?: string;
}

export interface MatchProfile {
  id: string;
  candidate: DiscoveryCandidate;
  matchedAt: string;
  lastMessage?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  isOwn: boolean;
  deliveryState: 'sent' | 'delivered' | 'read';
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

  async getCandidates(): Promise<DiscoveryCandidate[]> {
    const res = await this.request<any>('/api/bff/v1/dating/candidates');
    const list = Array.isArray(res) ? res : Array.isArray(res?.candidates) ? res.candidates : [];
    return list.map((c: any) => ({
      profileId: c.accountId || c.profileId,
      displayName: c.displayName,
      age: typeof c.age === 'number' ? c.age : null,
      programmeFamily: c.programmeFamily,
      bio: c.bio || '',
      locationCity: c.locationCity,
      locationState: c.locationState,
      currentTerm: c.termOrYear || c.currentTerm,
      avatarColor: c.avatarColor || '#8580C4',
      photos: Array.isArray(c.photos) ? c.photos : [],
      interests: Array.isArray(c.interests) ? c.interests : [],
      promptAnswers: Array.isArray(c.promptAnswers) ? c.promptAnswers : [],
    }));
  }

  async likeCandidate(candidateId: string): Promise<LikeResponse> {
    return this.request<LikeResponse>('/api/bff/v1/dating/likes', {
      method: 'POST',
      body: JSON.stringify({ toAccountId: candidateId }),
    });
  }

  async passCandidate(candidateId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/bff/v1/dating/passes', {
      method: 'POST',
      body: JSON.stringify({ toAccountId: candidateId }),
    });
  }

  async getMatches(): Promise<MatchProfile[]> {
    const res = await this.request<any[]>('/api/bff/v1/dating/matches');
    if (!Array.isArray(res)) return [];
    return res.map((m) => {
      const partner = m.partner || m.candidate || {};
      return {
        id: m.id || m.matchId,
        candidate: {
          profileId: partner.accountId || partner.profileId || m.matchedAccountId || m.id,
          displayName: partner.displayName || 'Matched Student',
          age: typeof partner.age === 'number' ? partner.age : null,
          programmeFamily: partner.programmeFamily || ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
          bio: partner.bio || '',
          locationCity: partner.locationCity,
          currentTerm: partner.termOrYear,
          avatarColor: partner.avatarColor || '#8580C4',
          photos: partner.photos || [],
          interests: partner.interests || [],
          promptAnswers: partner.promptAnswers || [],
        },
        matchedAt: m.matchedAt || 'Recently',
        lastMessage: m.lastMessageText || m.lastMessage,
      };
    });
  }

  // --- Bilateral Messaging ---

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const res = await this.request<any[]>(
      `/api/bff/v1/messaging/conversations/${conversationId}/messages`,
    );
    if (!Array.isArray(res)) return [];
    return res.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId || conversationId,
      senderId: msg.senderAccountId || msg.senderId,
      senderName: msg.senderName || 'Student',
      text: msg.bodyText || msg.text || '',
      createdAt: msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      isOwn: Boolean(msg.isOwn),
      deliveryState: msg.deliveryState || 'delivered',
    }));
  }

  async sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    if (trimmed.length > 1000) {
      throw new Error('Message exceeds 1000 character limit (Doc 04 §6.1)');
    }

    const res = await this.request<any>(
      `/api/bff/v1/messaging/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ bodyText: trimmed }),
      },
    );

    return {
      id: res.id || `msg-${Date.now()}`,
      conversationId,
      senderId: res.senderAccountId || 'self',
      senderName: res.senderName || 'You',
      text: res.bodyText || trimmed,
      createdAt: res.createdAt
        ? new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      deliveryState: 'sent',
    };
  }

  // --- Safety & Moderation ---

  async blockUser(targetUserId: string, reason: string) {
    return this.request<{ success: boolean; message: string }>('/api/bff/v1/safety/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    });
  }

  async reportUser(targetUserId: string, reason: string, details?: string) {
    return this.request<{ success: boolean; message: string }>('/api/bff/v1/safety/report', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason, details }),
    });
  }
}

export const api = new ApiClient();
