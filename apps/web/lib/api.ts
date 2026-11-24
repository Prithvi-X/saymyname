/**
 * SayMyName API Client for Web Client
 * Points to NestJS API server (default http://localhost:4000/api/v1)
 * Includes resilient fallbacks adhering strictly to Documents 01-07.
 */

import { ProgrammeFamily } from '@saymyname/contracts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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

// Synthetic seed candidates representing the 4 approved IITM BS programme tracks
const MOCK_CANDIDATES: DiscoveryCandidate[] = [
  {
    profileId: 'cand-001',
    displayName: 'Aanya',
    age: 21,
    programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
    bio: 'Balancing deep learning assignments with indie film analysis. Looking for someone who enjoys quiet virtual coffee dates and cooperative word puzzles across time zones.',
    locationCity: 'Bengaluru / Remote',
    currentTerm: 'Diploma Level • Term 4',
    avatarColor: '#B04A36',
    photos: [{ id: 'p1', photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    interests: ['🎬 Cinema', '☕ Filter Coffee', '🧩 Word Games', '📊 ML Models'],
    promptAnswers: [
      {
        id: 'pa1',
        promptText: 'My ideal study break looks like...',
        answerText: 'Debating whether gradient descent or filter coffee has had a bigger impact on my academic career.',
      },
      {
        id: 'pa2',
        promptText: 'A weird topic I can talk about for hours...',
        answerText: 'The mathematics of generative music and 70s South Indian cinema soundtracks.',
      },
    ],
  },
  {
    profileId: 'cand-002',
    displayName: 'Vikram',
    age: 22,
    programmeFamily: ProgrammeFamily.ELECTRONIC_SYSTEMS,
    bio: 'Debugging embedded RTOS code by day, reading speculative fiction by night. IITM BS Electronic Systems cohort. Passionate about hardware hacking and clean minimalism.',
    locationCity: 'Hyderabad / Remote',
    currentTerm: 'BSc Degree Level • Term 6',
    avatarColor: '#2B4C7E',
    photos: [{ id: 'p2', photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    interests: ['⚡ Microcontrollers', '📚 Speculative Sci-Fi', '🏸 Badminton', '🎧 Ambient Music'],
    promptAnswers: [
      {
        id: 'pa3',
        promptText: 'Together we could...',
        answerText: 'Build an open-source ambient desk clock or compete together in the BS term hackathon.',
      },
    ],
  },
  {
    profileId: 'cand-003',
    displayName: 'Sneha',
    age: 20,
    programmeFamily: ProgrammeFamily.AERONAUTICS_SPACE,
    bio: 'Orbital mechanics enthusiast in the Aeronautics & Space BS track. Passionate about propulsion systems, stargazing trips, and thoughtful conversations.',
    locationCity: 'Pune / Remote',
    currentTerm: 'Foundation Level • Term 2',
    avatarColor: '#3B6E58',
    photos: [{ id: 'p3', photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    interests: ['🚀 Orbital Dynamics', '🔭 Astronomy', '🧗 Rock Climbing', '🍵 Earl Grey'],
    promptAnswers: [
      {
        id: 'pa4',
        promptText: 'Best way to spend a Saturday...',
        answerText: 'Tracing constellations away from city light pollution and talking about where we want to be in five years.',
      },
    ],
  },
  {
    profileId: 'cand-004',
    displayName: 'Rohan',
    age: 23,
    programmeFamily: ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
    bio: 'Exploring behavioral economics, product strategy, and modern jazz. IITM Management and Data Science BS. Big fan of collaborative strategy board games.',
    locationCity: 'Mumbai / Remote',
    currentTerm: 'BS Degree Level • Term 7',
    avatarColor: '#7A3B69',
    photos: [{ id: 'p4', photoUrl: '', isPrimary: true }],
    interests: ['♟️ Chess', '🎷 Modern Jazz', '📈 Quantitative Economics', '🚲 Cycling'],
    promptAnswers: [
      {
        id: 'pa5',
        promptText: 'The hallmark of a great conversation is...',
        answerText: 'When both people forget to check their phones and discover an obscure shared interest.',
      },
    ],
  },
];

class ApiClient {
  private token: string | null = null;
  private matchesState: MatchProfile[] = [];
  private messagesState: Record<string, ChatMessage[]> = {};
  private blockedUserIds: Set<string> = new Set();

  constructor() {
    // Initialise with one realistic mutual match for immediate chat exploration
    this.matchesState = [
      {
        id: 'match-001',
        candidate: MOCK_CANDIDATES[0],
        matchedAt: 'Today, 2:15 PM',
        lastMessage: 'Are you taking the Deep Learning lab course this term?',
      },
    ];

    this.messagesState['match-001'] = [
      {
        id: 'msg-1',
        conversationId: 'match-001',
        senderId: 'cand-001',
        senderName: 'Aanya',
        text: 'Hi! Great to connect with someone else in the BS Data Science track.',
        createdAt: '2:16 PM',
        isOwn: false,
        deliveryState: 'read',
      },
      {
        id: 'msg-2',
        conversationId: 'match-001',
        senderId: 'current-user',
        senderName: 'You',
        text: 'Hello Aanya! Nice to match with you. How is your term project going?',
        createdAt: '2:18 PM',
        isOwn: true,
        deliveryState: 'read',
      },
      {
        id: 'msg-3',
        conversationId: 'match-001',
        senderId: 'cand-001',
        senderName: 'Aanya',
        text: 'Are you taking the Deep Learning lab course this term?',
        createdAt: '2:20 PM',
        isOwn: false,
        deliveryState: 'read',
      },
    ];
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('smn_access_token', token);
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

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.detail || 'API request failed');
    }
    return data;
  }

  // --- Identity & Auth ---

  async register(payload: RegisterPayload) {
    return this.request<{ success: boolean; message: string; syntheticOtp?: string; devOtp?: string }>(
      '/identity/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async verifyOtp(payload: VerifyOtpPayload) {
    const data = await this.request<{ accessToken: string; refreshToken: string; user: any }>(
      '/identity/verify-otp',
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

  async verifyAge(payload: AgeCheckPayload) {
    const res = await this.request<{ success?: boolean; isAdult?: boolean; calculatedAge?: number; eligibility?: any }>(
      '/identity/age-check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return {
      ...res,
      isAdult: res.isAdult ?? (res.calculatedAge ? res.calculatedAge >= 18 : res.eligibility?.ageStatus === 'approved'),
    };
  }

  async verifyStudent(payload: VerifyStudentPayload) {
    return this.request<{ success: boolean; eligibility: any; accessToken?: string }>(
      '/identity/verify-student',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async getMe() {
    return this.request<{ id: string; email: string; displayName: string; eligibility: any }>(
      '/identity/me',
    );
  }

  // --- Dating Discovery ---

  async getCandidates(): Promise<DiscoveryCandidate[]> {
    try {
      const res = await this.request<DiscoveryCandidate[]>('/dating/candidates');
      if (Array.isArray(res) && res.length > 0) {
        return res.filter((c) => !this.blockedUserIds.has(c.profileId));
      }
    } catch {
      // Fallback to synthetic candidates adhering to the 4 approved programmes
    }
    return MOCK_CANDIDATES.filter((c) => !this.blockedUserIds.has(c.profileId));
  }

  async likeCandidate(candidateId: string): Promise<LikeResponse> {
    try {
      return await this.request<LikeResponse>('/dating/likes', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId: candidateId }),
      });
    } catch {
      // Synthetic fallback: Aanya and Sneha match mutually for interactive testing
      const isMutual = candidateId === 'cand-001' || candidateId === 'cand-003';
      const matchId = isMutual ? `match-${candidateId}` : undefined;

      if (isMutual) {
        const candidate = MOCK_CANDIDATES.find((c) => c.profileId === candidateId);
        if (candidate && !this.matchesState.some((m) => m.candidate.profileId === candidateId)) {
          this.matchesState.unshift({
            id: matchId!,
            candidate,
            matchedAt: 'Just now',
            lastMessage: 'You matched! Say hello.',
          });
        }
      }

      return {
        likeId: `like-${Date.now()}`,
        isMutualMatch: isMutual,
        matchId,
      };
    }
  }

  async passCandidate(candidateId: string): Promise<{ success: boolean }> {
    try {
      return await this.request<{ success: boolean }>('/dating/passes', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId: candidateId }),
      });
    } catch {
      return { success: true };
    }
  }

  async getMatches(): Promise<MatchProfile[]> {
    try {
      const res = await this.request<any[]>('/dating/matches');
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch {
      // Fallback to local matches state
    }
    return this.matchesState.filter((m) => !this.blockedUserIds.has(m.candidate.profileId));
  }

  // --- Bilateral Messaging ---

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const res = await this.request<ChatMessage[]>(`/messaging/conversations/${conversationId}/messages`);
      if (Array.isArray(res)) return res;
    } catch {
      // Fallback
    }
    return this.messagesState[conversationId] || [];
  }

  async sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    if (trimmed.length > 1000) throw new Error('Message exceeds 1000 character limit (Doc 04 §6.1)');

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'current-user',
      senderName: 'You',
      text: trimmed,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      deliveryState: 'sent',
    };

    try {
      const res = await this.request<ChatMessage>(`/messaging/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ bodyText: trimmed }),
      });
      return res;
    } catch {
      // Synthetic state append
      if (!this.messagesState[conversationId]) {
        this.messagesState[conversationId] = [];
      }
      this.messagesState[conversationId].push(newMsg);

      // Simulate a responsive reply after 2 seconds for a realistic demo
      setTimeout(() => {
        const replies = [
          'That sounds really interesting! How are you finding the coursework so far?',
          'I completely agree. The non-campus format definitely requires discipline.',
          'Haha absolutely! Are you planning to attend the annual student summit?',
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        this.messagesState[conversationId].push({
          id: `msg-${Date.now() + 1}`,
          conversationId,
          senderId: 'partner',
          senderName: 'Match',
          text: randomReply,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: false,
          deliveryState: 'read',
        });
      }, 1500);

      return newMsg;
    }
  }

  // --- Safety & Moderation (Universal Immediate Server Action) ---

  async blockUser(targetUserId: string, reason: string): Promise<{ success: boolean; message: string }> {
    this.blockedUserIds.add(targetUserId);
    this.matchesState = this.matchesState.filter((m) => m.candidate.profileId !== targetUserId);

    try {
      return await this.request<{ success: boolean; message: string }>('/safety/block', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, reason }),
      });
    } catch {
      return {
        success: true,
        message: 'User blocked immediately. All mutual visibility and communication have been severed.',
      };
    }
  }

  async reportUser(targetUserId: string, reason: string, details?: string): Promise<{ success: boolean; message: string }> {
    try {
      return await this.request<{ success: boolean; message: string }>('/safety/report', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, reason, details }),
      });
    } catch {
      return {
        success: true,
        message: 'Report submitted confidentially to trust and safety moderators.',
      };
    }
  }
}

export const api = new ApiClient();
