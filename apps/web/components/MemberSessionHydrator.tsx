'use client';

import { useEffect } from 'react';
import { useAuth, UserContext } from '../lib/auth-context';

export default function MemberSessionHydrator({
  initialUser,
  children,
}: {
  initialUser: UserContext;
  children: React.ReactNode;
}) {
  const { hydrateSessionUser } = useAuth();

  useEffect(() => {
    hydrateSessionUser(initialUser);
  }, [initialUser, hydrateSessionUser]);

  return <>{children}</>;
}
