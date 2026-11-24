// Verification of all Next.js web application routes
const BASE_URL = 'http://localhost:3000';

const routes = [
  '/',
  '/onboarding',
  '/discover',
  '/matches',
  '/chats',
  '/likes',
  '/profile',
  '/eligibility',
  '/safety',
];

async function verifyRoutes() {
  console.log('=== SayMyName: Web Routes Local Hosting Verification ===\n');

  let allPassed = true;
  for (const route of routes) {
    try {
      const res = await fetch(`${BASE_URL}${route}`);
      if (res.status === 200) {
        console.log(`[PASS] ${route.padEnd(16)} -> 200 OK (${res.headers.get('content-type') || 'text/html'})`);
      } else {
        console.error(`[FAIL] ${route.padEnd(16)} -> ${res.status} ${res.statusText}`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`[FAIL] ${route.padEnd(16)} -> Network error: ${err.message}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n=== All 9 Web Client Routes Responding with 200 OK ===');
  } else {
    process.exit(1);
  }
}

verifyRoutes();
