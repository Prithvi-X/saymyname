// Verification of SayMyName public & protected route behavior (Phase 2 updated)
const BASE_URL = process.env.WEB_BASE || 'http://127.0.0.1:3001';

const publicRoutes = [
  '/',
  '/eligibility',
  '/safety',
  '/privacy',
  '/terms',
  '/support',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
];

const protectedRoutes = [
  '/discover',
  '/likes',
  '/matches',
  '/chats',
  '/profile',
];

async function verifyRoutes() {
  console.log(`=== SayMyName: Web Routes Verification (${BASE_URL}) ===\n`);

  let allPassed = true;
  for (const route of publicRoutes) {
    try {
      const start = performance.now();
      const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
      const ms = Math.round(performance.now() - start);
      if (res.status === 200) {
        console.log(`[PASS] PUBLIC    ${route.padEnd(18)} -> 200 OK (${ms}ms)`);
      } else {
        console.error(`[FAIL] PUBLIC    ${route.padEnd(18)} -> ${res.status}`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`[FAIL] PUBLIC    ${route.padEnd(18)} -> ${err.message}`);
      allPassed = false;
    }
  }

  for (const route of protectedRoutes) {
    try {
      const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
      const loc = res.headers.get('location') || '';
      if (res.status >= 300 && res.status < 400 && loc.includes('/login')) {
        console.log(`[PASS] PROTECTED ${route.padEnd(18)} -> ${res.status} Redirect (/login)`);
      } else {
        console.error(`[FAIL] PROTECTED ${route.padEnd(18)} -> ${res.status} loc=${loc}`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`[FAIL] PROTECTED ${route.padEnd(18)} -> ${err.message}`);
      allPassed = false;
    }
  }

  // Canonical registration redirect & safe returnUrl enforcement
  const redirectCases = [
    {
      path: '/register',
      check: (loc) => loc === '/onboarding' || loc.endsWith('/onboarding'),
      label: '/register -> /onboarding',
    },
    {
      path: '/register?returnUrl=%2Fmatches',
      check: (loc) => loc.includes('/onboarding?returnUrl=%2Fmatches'),
      label: '/register?returnUrl=/matches preserves safe returnUrl',
    },
    {
      path: '/register?returnUrl=//evil.com',
      check: (loc) => loc === '/onboarding' && !loc.includes('evil.com'),
      label: '/register strips protocol-relative unsafe returnUrl',
    },
    {
      path: '/register?returnUrl=https://evil.com',
      check: (loc) => loc === '/onboarding' && !loc.includes('evil.com'),
      label: '/register strips external URL unsafe returnUrl',
    },
  ];

  for (const rc of redirectCases) {
    try {
      const res = await fetch(`${BASE_URL}${rc.path}`, { redirect: 'manual' });
      const loc = res.headers.get('location') || '';
      if (res.status >= 300 && res.status < 400 && rc.check(loc)) {
        console.log(`[PASS] REDIRECT  ${rc.label} -> ${res.status} (${loc})`);
      } else {
        console.error(`[FAIL] REDIRECT  ${rc.label} -> ${res.status} loc=${loc}`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`[FAIL] REDIRECT  ${rc.label} -> ${err.message}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n=== All 10 Public (200), 4 Registration Redirect/Safety Checks & 5 Protected Routes Verified ===');
  } else {
    process.exit(1);
  }
}

verifyRoutes();
