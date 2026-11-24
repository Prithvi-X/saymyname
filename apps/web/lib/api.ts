/**
 * SayMyName Production API Client
 * Points to NestJS API server (default http://localhost:4000/api/v1)
 *
 * Strict Security Invariants (Documents 01, 05, 06):
 * - No mock candidates or fabricated conversations in production paths
 * - Protected endpoints require a valid server-issued JWT token
 * - 401 Unauthorized clears client session and cookie
 * - Server is the sole authority for eligibility and match permissions
 */

import { ProgrammeFamily } from '@saymyname/contracts';

/**
 * Dynamically resolves the API base URL:
 * - On localhost/127.0.0.1: automatically points to http://localhost:4000/api/v1
 * - On local WiFi/LAN IP: automatically points to http://<lan-ip>:4000/api/v1
 * - In production/custom deployment: uses NEXT_PUBLIC_API_URL or relative /api/v1
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000/api/v1';
    }
    if (/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(hostname)) {
      return `http://${hostname}:4000/api/v1`;
    }
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    // Deployed fallback points to the live Render web service
    return 'https://saymyname-ri9e.onrender.com/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || process.env.API_BACKEND_URL || 'https://saymyname-ri9e.onrender.com/api/v1';
}

export interface RegisterPayload {
  email: string;
  displayName: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface AgeCheckPayload {
  dateOfBirth: string; // YYYY-MM-DD
}

export interface VerifyStudentPayload {
  programmeFamily: string;
  studentRollNo: string;
  idDocumentRef?: string;
}

export interface DiscoveryCandidate {
  profileId: string;
  displayName: string;
  age: number;
  programmeFamily: ProgrammeFamily;
  bio: string;
  locationCity?: string;
  currentTerm?: string;
  avatarColor?: string;
  photos: { id: string; photoUrl: string; isPrimary: boolean }[];
  interests: string[];
  promptAnswers: { id: string; promptText: string; answerText: string }[];
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

class ApiClient {
  private token: string | null = null;

  setToken(token: string, refreshToken?: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('smn_access_token', token);
      document.cookie = `smn_auth_token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      if (refreshToken) {
        localStorage.setItem('smn_refresh_token', refreshToken);
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('smn_access_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smn_access_token');
      localStorage.removeItem('smn_refresh_token');
      document.cookie = 'smn_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getApiBaseUrl();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkError: any) {
      if (
        networkError?.message?.includes('Failed to fetch') ||
        networkError?.message?.includes('NetworkError') ||
        networkError?.name === 'TypeError'
      ) {
        let domain = baseUrl;
        try {
          domain = new URL(baseUrl).hostname;
        } catch {}
        throw new Error(
          `Unable to connect to the SayMyName API at ${baseUrl}. ` +
          `If you are testing locally, please open http://localhost:3000 (and ensure the backend is running on port 4000). ` +
          `If testing an online deployment, ensure the DNS record for "${domain}" is active in your Cloudflare dashboard.`
        );
      }
      throw networkError;
    }

    if (res.status === 401) {
      this.clearToken();
      throw new Error('Session expired or unauthorized. Please sign in again.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.detail || `API request failed with status ${res.status}`);
    }
    return data;
  }

  // --- Identity & Auth ---

  async register(payload: RegisterPayload) {
    return this.request<{ success: boolean; message: string; syntheticOtp?: string }>(
      '/identity/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async verifyOtp(payload: VerifyOtpPayload) {
    const data = await this.request<{ accessToken: string; refreshToken: string; user?: any; account?: any }>(
      '/identity/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    if (data.accessToken) {
      this.setToken(data.accessToken, data.refreshToken);
    }
    return data;
  }

  async verifyAge(payload: AgeCheckPayload) {
    return this.request<{ isAdult: boolean; calculatedAge?: number; eligibility?: any }>(
      '/identity/age-check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async verifyStudent(payload: VerifyStudentPayload) {
    const data = await this.request<{ success?: boolean; eligibility: any; accessToken?: string }>(
      '/identity/verify-student',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    return data;
  }

  async getMe() {
    return this.request<{ id: string; email: string; displayName: string; accountStatus: string; eligibility: any; profile?: any }>(
      '/identity/me',
    );
  }

  async logout() {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('smn_refresh_token') : null;
    if (refreshToken) {
      try {
        await this.request('/identity/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Continue local cleanup
      }
    }
    this.clearToken();
  }

  // --- Dating Discovery ---

  async getCandidates(): Promise<DiscoveryCandidate[]> {
    const res = await this.request<any[]>('/dating/candidates');
    if (!Array.isArray(res)) return [];
    return res.map((c) => ({
      profileId: c.accountId || c.profileId,
      displayName: c.displayName,
      age: c.age || 22,
      programmeFamily: c.programmeFamily,
      bio: c.bio || '',
      locationCity: c.locationCity,
      currentTerm: c.termOrYear || c.currentTerm,
      avatarColor: c.avatarColor || '#6E2638',
      photos: Array.isArray(c.photos) ? c.photos : [],
      interests: Array.isArray(c.interests) ? c.interests : [],
      promptAnswers: Array.isArray(c.promptAnswers) ? c.promptAnswers : [],
    }));
  }

  async likeCandidate(candidateId: string): Promise<LikeResponse> {
    return this.request<LikeResponse>('/dating/likes', {
      method: 'POST',
      body: JSON.stringify({ toAccountId: candidateId }),
    });
  }

  async passCandidate(candidateId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/dating/passes', {
      method: 'POST',
      body: JSON.stringify({ toAccountId: candidateId }),
    });
  }

  async getMatches(): Promise<MatchProfile[]> {
    const res = await this.request<any[]>('/dating/matches');
    if (!Array.isArray(res)) return [];
    return res.map((m) => {
      const partner = m.partner || m.candidate || {};
      return {
        id: m.id || m.matchId,
        candidate: {
          profileId: partner.accountId || partner.profileId || m.id,
          displayName: partner.displayName || 'Matched Student',
          age: partner.age || 21,
          programmeFamily: partner.programmeFamily || ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
          bio: partner.bio || '',
          locationCity: partner.locationCity,
          currentTerm: partner.termOrYear,
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
    const res = await this.request<any[]>(`/messaging/conversations/${conversationId}/messages`);
    if (!Array.isArray(res)) return [];
    return res.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId || conversationId,
      senderId: msg.senderAccountId || msg.senderId,
      senderName: msg.senderName || 'Student',
      text: msg.bodyText || msg.text || '',
      createdAt: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      isOwn: Boolean(msg.isOwn),
      deliveryState: msg.deliveryState || 'delivered',
    }));
  }

  async sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    if (trimmed.length > 1000) throw new Error('Message exceeds 1000 character limit (Doc 04 §6.1)');

    const res = await this.request<any>(`/messaging/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ bodyText: trimmed }),
    });

    return {
      id: res.id || `msg-${Date.now()}`,
      conversationId,
      senderId: res.senderAccountId || 'self',
      senderName: res.senderName || 'You',
      text: res.bodyText || trimmed,
      createdAt: res.createdAt ? new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      deliveryState: 'sent',
    };
  }

  // --- Safety & Moderation ---

  async blockUser(targetUserId: string, reason: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/safety/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    });
  }

  async reportUser(targetUserId: string, reason: string, details?: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/safety/report', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason, details }),
    });
  }
}

export const api = new ApiClient();
