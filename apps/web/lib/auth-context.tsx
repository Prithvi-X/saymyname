'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AccountLifecycleState } from '@saymyname/contracts';
import { api, sanitizeDisplayName } from './api';
import { clearAllConversationDrafts } from './chats-state';

export type AuthState =
  | 'LOADING'
  | 'UNAUTHENTICATED'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED_MEMBER'
  | 'SUSPENDED';

export interface UserContext {
  id: string;
  email: string;
  displayName: string | null;
  accountStatus: string;
  emailVerified?: boolean;
  hasPassword?: boolean;
  lifecycleState: AccountLifecycleState;
  eligibility?: {
    ageStatus: string;
    studentStatus: string;
    programmeFamily: string | null;
    pathwayCode?: string | null;
    discoveryEligible: boolean;
  };
  profile?: {
    id: string;
    displayName: string;
    profileStatus?: string;
    isPublished?: boolean;
    isPaused?: boolean;
    photos?: Array<{ id: string; photoUrl: string | null; isPrimary: boolean }>;
  } | null;
}

interface AuthContextType {
  authState: AuthState;
  lifecycleState: AccountLifecycleState;
  user: UserContext | null;
  isLoading: boolean;
  refreshUser: () => Promise<UserContext | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authState: 'LOADING',
  lifecycleState: AccountLifecycleState.UNAUTHENTICATED,
  user: null,
  isLoading: true,
  refreshUser: async () => null,
  logout: async () => {},
});

function deriveAuthState(lifecycle: AccountLifecycleState): AuthState {
  if (lifecycle === AccountLifecycleState.SUSPENDED) return 'SUSPENDED';
  if (lifecycle === AccountLifecycleState.ACTIVE_MEMBER) return 'VERIFIED_MEMBER';
  if (lifecycle === AccountLifecycleState.UNAUTHENTICATED) return 'UNAUTHENTICATED';
  return 'VERIFICATION_PENDING';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('LOADING');
  const [lifecycleState, setLifecycleState] = useState<AccountLifecycleState>(
    AccountLifecycleState.UNAUTHENTICATED,
  );
  const [user, setUser] = useState<UserContext | null>(null);
  const router = useRouter();

  const refreshUser = useCallback(async (): Promise<UserContext | null> => {
    try {
      const data = await api.getMe();
      if (!data || !data.id) {
        throw new Error('Unauthenticated');
      }
      const cleanName = sanitizeDisplayName(data.displayName);
      const normalizedUser: UserContext = {
        ...data,
        displayName: cleanName || null,
      };
      const resolvedLifecycle =
        data.lifecycleState || AccountLifecycleState.VERIFICATION_PENDING;
      setUser(normalizedUser);
      setLifecycleState(resolvedLifecycle);
      setAuthState(deriveAuthState(resolvedLifecycle));
      return normalizedUser;
    } catch {
      setUser(null);
      setLifecycleState(AccountLifecycleState.UNAUTHENTICATED);
      setAuthState('UNAUTHENTICATED');
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Clear local state regardless
    }
    setUser(null);
    setLifecycleState(AccountLifecycleState.UNAUTHENTICATED);
    setAuthState('UNAUTHENTICATED');
    clearAllConversationDrafts();
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        authState,
        lifecycleState,
        user,
        isLoading: authState === 'LOADING',
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
