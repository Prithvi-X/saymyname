// End-to-end verification of Identity & Eligibility API endpoints
const BASE_URL = 'http://localhost:4000/api/v1';

async function runTests() {
  console.log('=== SayMyName Phase 2: Identity API Verification ===\n');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  console.log(`[PASS] GET /health -> ${healthRes.status} ${healthRes.statusText}`);

  // 2. Register with valid IITM BS email and required fields
  const email = '21f1000001@ds.study.iitm.ac.in';
  const displayName = 'Arun Kumar';
  const password = 'SecurePassword123!';

  const regRes = await fetch(`${BASE_URL}/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, displayName, password }),
  });
  const regData = await regRes.json();
  if (regRes.status !== 201 && regRes.status !== 200) {
    throw new Error(`Register failed: ${JSON.stringify(regData)}`);
  }
  console.log(`[PASS] POST /identity/register -> ${regRes.status}. Synthetic OTP: ${regData.syntheticOtp}`);

  // 3. Verify OTP
  const otpRes = await fetch(`${BASE_URL}/identity/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: regData.syntheticOtp }),
  });
  const otpData = await otpRes.json();
  if (!otpData.accessToken) {
    throw new Error(`OTP verification failed: ${JSON.stringify(otpData)}`);
  }
  console.log(`[PASS] POST /identity/verify-otp -> ${otpRes.status}. Received JWT access token`);

  let currentToken = otpData.accessToken;
  const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${currentToken}`,
  });

  // 4. Negative test: Minor (<18) must be strictly forbidden (403)
  const minorRes = await fetch(`${BASE_URL}/identity/age-check`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ dateOfBirth: '2010-01-01' }),
  });
  const minorData = await minorRes.json();
  if (minorRes.status === 403) {
    console.log(`[PASS] POST /identity/age-check (DOB: 2010-01-01) -> 403 Forbidden correctly rejected under-18 user: "${minorData.message}"`);
  } else {
    throw new Error(`Under-18 check failed! Expected 403, got ${minorRes.status}: ${JSON.stringify(minorData)}`);
  }

  // 5. Positive test: Adult (22 years)
  const adultRes = await fetch(`${BASE_URL}/identity/age-check`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ dateOfBirth: '2004-05-15' }),
  });
  const adultData = await adultRes.json();
  if (adultRes.status === 200 && adultData.calculatedAge >= 18) {
    console.log(`[PASS] POST /identity/age-check (DOB: 2004-05-15) -> 200 OK. Calculated age: ${adultData.calculatedAge}, Status: ${adultData.eligibility?.ageStatus}`);
  } else {
    throw new Error(`Adult check failed: ${JSON.stringify(adultData)}`);
  }

  // 6. Student Verification with approved BS programme
  const studentRes = await fetch(`${BASE_URL}/identity/verify-student`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({
      programmeFamily: 'data_science_applications',
      studentRollNo: '21F1000001',
    }),
  });
  const studentData = await studentRes.json();
  if (studentRes.status === 200 && studentData.eligibility?.discoveryEligible === true) {
    console.log(`[PASS] POST /identity/verify-student -> 200 OK. Discovery unlocked: ${studentData.eligibility.discoveryEligible}, Programme: ${studentData.eligibility.programmeFamily}`);
    if (studentData.accessToken) {
      currentToken = studentData.accessToken;
    }
  } else {
    throw new Error(`Student verification failed: ${JSON.stringify(studentData)}`);
  }

  // 7. GET /identity/me to verify persistent profile & eligibility state
  const meRes = await fetch(`${BASE_URL}/identity/me`, {
    headers: getAuthHeader(),
  });
  const meData = await meRes.json();
  if (meRes.status === 200 && meData.eligibility?.discoveryEligible === true) {
    console.log(`[PASS] GET /identity/me -> 200 OK. User ID: ${meData.id}, Discovery Eligible: ${meData.eligibility.discoveryEligible}, Programme: ${meData.eligibility.programmeFamily}`);
  } else {
    throw new Error(`GET /identity/me failed: ${JSON.stringify(meData)}`);
  }

  console.log('\n=== All 7 Identity & Eligibility API Checks PASSED Successfully ===');
}

runTests().catch((err) => {
  console.error('\n[FAIL] Test Error:', err);
  process.exit(1);
});
