import fs from 'node:fs';

let resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const match = content.match(/RESEND_API_KEY=([^\r\n]+)/);
  if (match) resendApiKey = match[1].trim();
}

async function testResend() {
  console.log('--- Testing Resend API Key ---');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not found in environment or .env.local');
    process.exit(1);
  }

  try {
    const domainRes = await fetch('https://api.resend.com/domains', {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
    });
    const domains = await domainRes.json();
    console.log('[Resend] Domains response status:', domainRes.status);
    console.log('[Resend] Configured domains:', JSON.stringify(domains, null, 2));

    const apiKeysRes = await fetch('https://api.resend.com/api-keys', {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
    });
    const keys = await apiKeysRes.json();
    console.log('[Resend] API keys response status:', apiKeysRes.status);
    console.log('[Resend] Key count:', keys?.data?.length || 0);
  } catch (err) {
    console.error('[Resend] Error testing Resend:', err);
  }
}

testResend();
