/**
 * SayMyName API Client for Web Client
 * Points to NestJS API server (default http://localhost:4000/api/v1)
 */

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

class ApiClient {
  private token: string | null = null;

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

  async register(payload: RegisterPayload) {
    return this.request<{ success: boolean; message: string; devOtp?: string }>('/identity/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    return this.request<{ success: boolean; isAdult: boolean; ageStatus: string }>(
      '/identity/age-check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async verifyStudent(payload: VerifyStudentPayload) {
    return this.request<{ success: boolean; studentStatus: string; isFullyEligible: boolean }>(
      '/identity/verify-student',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async getMe() {
    return this.request<{ user: any; eligibility: any }>('/identity/me');
  }
}

export const api = new ApiClient();
