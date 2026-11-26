import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountLifecycleState } from '@saymyname/contracts';
import { ACCESS_COOKIE, REFRESH_COOKIE, getBackendBaseUrl } from '../../lib/server-bff';
import MemberSessionHydrator from '../../components/MemberSessionHydrator';

/**
 * Server Component Guard for authenticated member workspace routes ((app)/*).
 * Ensures no member content renders before authoritative backend lifecycle verification.
 */
export default async function MemberAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value || '';
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value || '';

  if (!accessToken && !refreshToken) {
    redirect('/login');
  }

  const backend = getBackendBaseUrl();

  const fetchMe = async (token: string) =>
    fetch(`${backend}/identity/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

  let meRes = accessToken ? await fetchMe(accessToken).catch(() => null) : null;

  if ((!meRes || meRes.status === 401) && refreshToken) {
    const refRes = await fetch(`${backend}/identity/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => null);

    if (refRes && refRes.ok) {
      const refData = await refRes.json().catch(() => null);
      if (refData?.accessToken) {
        accessToken = refData.accessToken;
        meRes = await fetchMe(accessToken).catch(() => null);
      }
    }
  }

  if (!meRes || !meRes.ok) {
    redirect('/login');
  }

  const me = await meRes.json().catch(() => null);
  if (!me || me.lifecycleState !== AccountLifecycleState.ACTIVE_MEMBER) {
    redirect('/onboarding');
  }

  return <MemberSessionHydrator initialUser={me}>{children}</MemberSessionHydrator>;
}
