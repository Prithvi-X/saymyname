const BASE_URL = 'http://localhost:4000/api/v1';

async function testLiveAdapters() {
  console.log('--- Testing Live API Adapters (Resend & Cloudflare R2) ---');

  // 1. Health probe
  const healthRes = await fetch(`${BASE_URL}/health`);
  console.log('[1/3] Health probe status:', healthRes.status, await healthRes.json());

  // 2. Register with institutional email to trigger real Resend dispatch
  const studentEmail = '21f1000123@study.iitm.ac.in';
  console.log(`[2/3] Calling POST /identity/register for "${studentEmail}"...`);
  const regRes = await fetch(`${BASE_URL}/identity/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: studentEmail,
      displayName: 'Priya Iyer',
      password: 'StrongStudentPass123!',
    }),
  });
  const regData = await regRes.json();
  console.log('Register response status:', regRes.status);
  console.log('Register response payload:', regData);

  // 3. Authenticate and test R2 Photo Pre-signing
  const otpRes = await fetch(`${BASE_URL}/identity/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: studentEmail,
      otp: regData.syntheticOtp || '123456',
    }),
  });
  const otpData = await otpRes.json();
  const token = otpData.accessToken;

  console.log(`[3/3] Calling POST /profiles/me/photos/presign...`);
  const presignRes = await fetch(`${BASE_URL}/profiles/me/photos/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: 'campus_photo.jpg',
      mimeType: 'image/jpeg',
    }),
  });
  const presignData = await presignRes.json();
  console.log('Photo presign status:', presignRes.status);
  console.log('Photo presign response:', presignData);

  const isR2Url = presignData.uploadUrl && presignData.uploadUrl.includes('r2.cloudflarestorage.com');
  console.log('Is live Cloudflare R2 Signed URL?', isR2Url ? 'YES! [VERIFIED]' : 'Fallback mock');

  // 4. Test actual PUT upload to the pre-signed R2 URL!
  if (isR2Url) {
    console.log('[4/4] Uploading binary test JPEG to Cloudflare R2 via pre-signed URL...');
    const dummyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const uploadRes = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: dummyJpeg,
    });
    console.log('Cloudflare R2 PUT response status:', uploadRes.status);
    if (uploadRes.status === 200) {
      console.log('🎉 DIRECT CLIENT UPLOAD TO CLOUDFLARE R2 VERIFIED 100%!');
    }
  }

  console.log('\n🎉 Live Adapter Verification Complete!');
}

testLiveAdapters().catch(console.error);
