import { redirect } from 'next/navigation';
import { isSafeInternalReturnPath } from '../../lib/return-path';

export const dynamic = 'force-dynamic';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

function readSingleParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

/**
 * Canonical /register entry point redirect -> /onboarding (Phase 2 Closure Task 1).
 * Prevents 404 on direct visits to /register while forwarding only validated safe query parameters.
 */
export default async function RegisterRedirectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const resolved = await searchParams;
  const query = new URLSearchParams();

  const stage = readSingleParam(resolved.stage);
  const email = readSingleParam(resolved.email);
  const returnUrl = readSingleParam(resolved.returnUrl);

  if (stage === 'otp') {
    query.set('stage', 'otp');
  }
  if (email && email.length <= 254 && !/[\r\n]/.test(email)) {
    query.set('email', email);
  }
  if (isSafeInternalReturnPath(returnUrl)) {
    query.set('returnUrl', returnUrl);
  }

  const qs = query.toString();
  redirect(qs ? `/onboarding?${qs}` : '/onboarding');
}
