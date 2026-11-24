'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export type AuthState = 'LOADING' | 'UNAUTHENTICATED' | 'VERIFICATION_PENDING' | 'VERIFIED_MEMBER' | 'SUSPENDED';

export interface UserContext {
  id: string;
  email: string;
  displayName: string;
  accountStatus: string;
  eligibility?: {
    ageStatus: string;
    studentStatus: string;
    programmeFamily: string | null;
    discoveryEligible: boolean;
  };
}

interface AuthContextType {
  authState: AuthState;
  user: UserContext | null;
  isLoading: boolean;
  login: (token: string, refreshToken?: string) => Promise<UserContext | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authState: 'LOADING',
  user: null,
  isLoading: true,
  login: async () => null,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('LOADING');
  const [user, setUser] = useState<UserContext | null>(null);
  const router = useRouter();

  const evaluateState = (u: UserContext): AuthState => {
    if (u.accountStatus === 'suspended' || u.accountStatus === 'deactivated') {
      return 'SUSPENDED';
    }
    if (u.eligibility?.discoveryEligible) {
      return 'VERIFIED_MEMBER';
    }
    return 'VERIFICATION_PENDING';
  };

  const refreshUser = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setAuthState('UNAUTHENTICATED');
      return;
    }

    try {
      const data = await api.getMe();
      if (data && data.id) {
        setUser(data);
        const state = evaluateState(data);
        setAuthState(state);
      } else {
        throw new Error('Invalid user payload');
      }
    } catch {
      // Token expired or invalid
      api.clearToken();
      document.cookie = 'smn_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      setUser(null);
      setAuthState('UNAUTHENTICATED');
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (token: string, _refreshToken?: string): Promise<UserContext | null> => {
    api.setToken(token);
    // Write cookie for Next.js server middleware
    document.cookie = `smn_auth_token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

    try {
      const data = await api.getMe();
      if (data && data.id) {
        setUser(data);
        const state = evaluateState(data);
        setAuthState(state);
        return data;
      }
      return null;
    } catch (err) {
      api.clearToken();
      document.cookie = 'smn_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      setUser(null);
      setAuthState('UNAUTHENTICATED');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Continue cleanup even if server call fails
    }
    api.clearToken();
    document.cookie = 'smn_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
    setAuthState('UNAUTHENTICATED');
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        authState,
        user,
        isLoading: authState === 'LOADING',
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
